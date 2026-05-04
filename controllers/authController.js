const db = require("../database");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { appendMasteryToSystem, extractMasteryFromReply } = require("../utils/mastery");
const { scoreMasteryWithOllamaFetch } = require("../utils/masteryScorer");
const { verifyUserOwnsChat, setChatMasteryScore } = require("../utils/chatMastery");
const { pickUnusedTitle } = require("../utils/chatTitles");

const SECRET = "supersecretkey";

// ── Subject system prompts ────────────────────────────────────────────────────
const SUBJECT_PROMPTS = {
    math:    "You are an expert Mathematics tutor. Explain every concept step-by-step, show all working clearly, and use precise notation. When solving problems, walk through each step and explain why.",
    science: "You are an expert Science tutor covering physics, chemistry, and biology. Use real-world analogies, reference relevant experiments, and ground your answers in scientific principles.",
    history: "You are an expert History tutor. Provide rich historical context, discuss causes and effects, mention key figures and dates, and connect past events to modern relevance.",
    english: "You are an expert English and Literature tutor. Help with writing, grammar, literary analysis, essay structure, and reading comprehension. Be encouraging and specific.",
    cs:      "You are an expert Computer Science tutor. Help with algorithms, data structures, programming concepts, debugging, and system design. Provide clear code examples when useful.",
    general: "You are a helpful, knowledgeable academic tutor. Answer clearly and thoroughly, adapting your explanation to the student's level.",
};


// REGISTER USER
exports.registerUser = async (req, res) => {
    const { name, email, password } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        db.run(
            "INSERT INTO users (name, email, password) VALUES (?, ?, ?)",
            [name, email, hashedPassword],
            function(err) {
                if (err) return res.status(400).json({ error: err.message });
                res.json({ message: "User registered successfully" });
            }
        );
    } catch (error) {
        res.status(500).json({ error: "Server error" });
    }
};


// LOGIN USER
exports.loginUser = (req, res) => {
    const { email, password } = req.body;
    db.get(
        "SELECT * FROM users WHERE email = ?",
        [email],
        async (err, user) => {
            if (err)   return res.status(500).json({ error: "Database error" });
            if (!user) return res.status(401).json({ error: "User not found" });

            const validPassword = await bcrypt.compare(password, user.password);
            if (!validPassword) return res.status(401).json({ error: "Invalid password" });

            const token = jwt.sign({ id: user.id }, SECRET, { expiresIn: "1h" });

            db.run(
                "INSERT INTO login_activity (student_id, login_time) VALUES (?, datetime('now'))",
                [user.id]
            );

            res.json({
                message: "Login successful",
                token,
                userId: user.id,
                name: user.name,
            });
        }
    );
};


// GET STUDENT PROGRESS
exports.getProgress = (req, res) => {
    const studentId = req.params.id;
    db.all(
        "SELECT assignment, score FROM progress WHERE student_id = ?",
        [studentId],
        (err, rows) => {
            if (err) return res.status(500).json({ error: "Database error" });
            res.json({ studentId, progress: rows });
        }
    );
};


// GET MASTERY LIST (one row per named chat session)
// Optional ?activeChatId= — include that row even if it has no messages yet; otherwise only sessions with ≥1 conversation.
exports.getMastery = (req, res) => {
    const studentId = req.params.id;
    if (String(req.user.id) !== String(studentId)) {
        return res.status(403).json({ error: "Forbidden" });
    }
    const rawActive = req.query && req.query.activeChatId;
    const activeId = parseInt(String(rawActive), 10);
    const hasActive = rawActive != null && String(rawActive).trim() !== "" && activeId > 0;

    let sql;
    let params;
    const countSel =
        "(SELECT COUNT(*) FROM conversations c WHERE c.chat_id = s.id AND c.user_id = s.user_id) AS message_count";
    if (hasActive) {
        sql =
            "SELECT s.id, s.title, s.mastery_score, s.updated_at, " +
            countSel +
            " FROM chat_sessions s " +
            "WHERE s.user_id = ? AND (s.id = ? OR EXISTS (" +
            "SELECT 1 FROM conversations c WHERE c.chat_id = s.id AND c.user_id = ? LIMIT 1" +
            ")) ORDER BY datetime(s.updated_at) DESC";
        params = [studentId, activeId, studentId];
    } else {
        sql =
            "SELECT s.id, s.title, s.mastery_score, s.updated_at, " +
            countSel +
            " FROM chat_sessions s " +
            "WHERE s.user_id = ? AND EXISTS (" +
            "SELECT 1 FROM conversations c WHERE c.chat_id = s.id AND c.user_id = ? LIMIT 1" +
            ") ORDER BY datetime(s.updated_at) DESC";
        params = [studentId, studentId];
    }

    db.all(sql, params, (err, rows) => {
        if (err) return res.status(500).json({ error: "Database error" });
        res.json({ chats: rows || [] });
    });
};


// CREATE CHAT SESSION (named thread for mastery + scoped history)
// Title is always chosen server-side: "Study session 1", "Study session 2", … (body title ignored).
exports.createChat = (req, res) => {
    const userId = req.user.id;
    db.all(
        "SELECT DISTINCT title FROM chat_sessions WHERE user_id = ?",
        [userId],
        (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            const used = new Set((rows || []).map((r) => r.title).filter(Boolean));
            const title = pickUnusedTitle(used);
            db.run(
                "INSERT INTO chat_sessions (user_id, title, mastery_score, created_at, updated_at) VALUES (?, ?, 0, datetime('now'), datetime('now'))",
                [userId, title],
                function(err2) {
                    if (err2) return res.status(500).json({ error: err2.message });
                    res.json({ chatId: this.lastID, title });
                }
            );
        }
    );
};

/** Latest thread by `updated_at` — for landing “recent session” (title matches Study Room). */
exports.getRecentChatSession = (req, res) => {
    const userId = req.user.id;
    db.get(
        "SELECT id, title FROM chat_sessions WHERE user_id = ? ORDER BY datetime(updated_at) DESC, id DESC LIMIT 1",
        [userId],
        (err, row) => {
            if (err) return res.status(500).json({ error: "Database error" });
            if (!row) return res.json({});
            res.json({ id: row.id, title: row.title });
        }
    );
};


// GET LOGIN ACTIVITY
exports.getActivity = (req, res) => {
    const studentId = req.params.id;
    db.all(
        "SELECT login_time FROM login_activity WHERE student_id = ?",
        [studentId],
        (err, rows) => {
            if (err) return res.status(500).json({ error: "Database error" });
            res.json({ studentId, loginHistory: rows });
        }
    );
};


// ── CHAT MESSAGE ──────────────────────────────────────────────────────────────
// Sends message to Ollama, injects subject-based system prompt, saves reply.
exports.chatMessage = async (req, res) => {
    // req.body is parsed by express.json() — always JSON, never FormData
    const { message, model, subject, chatId: chatIdRaw } = req.body;
    const userId        = req.user.id;
    const selectedModel = model || "llama3";
    const baseSystem = SUBJECT_PROMPTS[(subject || "general").toLowerCase()]
                        || SUBJECT_PROMPTS.general;
    const systemPrompt = appendMasteryToSystem(baseSystem);

    if (!message) {
        return res.status(400).json({ error: "message is required" });
    }

    let chatId;
    try {
        chatId = await verifyUserOwnsChat(chatIdRaw, userId);
    } catch {
        return res.status(400).json({ error: "chatId is required and must refer to a chat you own" });
    }

    try {
        // Fetch recent conversation history for context
        const history = await new Promise((resolve, reject) => {
            db.all(
                "SELECT message, reply FROM conversations WHERE user_id = ? AND chat_id = ? AND message NOT LIKE '[%' ORDER BY created_at DESC LIMIT 10",
                [userId, chatId],
                (err, rows) => { if (err) reject(err); else resolve(rows.reverse()); }
            );
        });

        // Build message thread: system → history → new message
        const messages = [{ role: "system", content: systemPrompt }];
        history.forEach(row => {
            messages.push({ role: "user",      content: row.message });
            messages.push({ role: "assistant", content: row.reply   });
        });
        messages.push({ role: "user", content: message });

        const response = await fetch("http://127.0.0.1:11434/api/chat", {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify({ model: selectedModel, messages, stream: false }),
        });

        const data = await response.json();

        if (!response.ok) {
            console.error("Ollama HTTP error:", data);
            return res.status(500).json({
                reply: data.error || "AI model error. Make sure Ollama is running."
            });
        }

        const rawReply = data.message?.content || data.response || "No response from model.";
        const { reply } = extractMasteryFromReply(rawReply);

        const subjectKey = (subject || "general").toLowerCase();
        let finalScore = null;
        if (reply && String(reply).trim()) {
            finalScore = await scoreMasteryWithOllamaFetch({
                model: selectedModel,
                studentMessage: message,
                assistantReply: reply,
                subjectKey,
            });
        }
        if (finalScore == null && String(reply || "").trim()) {
            console.warn("[mastery] scorer failed", { chatId, provider: "ollama" });
        }

        db.run(
            "INSERT INTO conversations (user_id, message, reply, created_at, chat_id) VALUES (?, ?, ?, datetime('now'), ?)",
            [userId, message, reply, chatId]
        );
        setChatMasteryScore(chatId, userId, finalScore);
        db.run("UPDATE chat_sessions SET updated_at = datetime('now') WHERE id = ? AND user_id = ?", [chatId, userId]);

        res.json({ reply, mastery: finalScore });

    } catch (err) {
        console.error("Ollama fetch error:", err);
        res.status(500).json({
            reply: "AI model error. Make sure Ollama is running and the model is pulled (`ollama pull " + selectedModel + "`)."
        });
    }
};


// ── GET CONVERSATION HISTORY ──────────────────────────────────────────────────
exports.getConversations = (req, res) => {
    const userId = req.params.id;
    db.all(
        "SELECT message, reply, created_at, chat_id FROM conversations WHERE user_id = ? ORDER BY created_at DESC",
        [userId],
        (err, rows) => {
            if (err) return res.status(500).json({ error: "Database error" });
            res.json({ conversations: rows });
        }
    );
};


// ── SEARCH CONVERSATIONS ──────────────────────────────────────────────────────
exports.searchConversations = (req, res) => {
    const { query } = req.query;
    const userId    = req.user.id;
    db.all(
        "SELECT message, reply, created_at FROM conversations WHERE user_id = ? AND message LIKE ?",
        [userId, `%${query}%`],
        (err, rows) => {
            if (err) return res.status(500).json({ error: "Database error" });
            res.json({ results: rows });
        }
    );
};


// ── MULTI-MODEL CHAT ──────────────────────────────────────────────────────────
// Fans message out to multiple Ollama models in parallel.
exports.multiModelChat = async (req, res) => {
    const { message, models, subject, chatId: chatIdRaw } = req.body;
    const userId       = req.user.id;
    const baseSystem = SUBJECT_PROMPTS[(subject || "general").toLowerCase()]
                       || SUBJECT_PROMPTS.general;
    const systemPrompt = appendMasteryToSystem(baseSystem);

    if (!message) {
        return res.status(400).json({ error: "Message is required" });
    }
    if (!models || !Array.isArray(models) || models.length === 0) {
        return res.status(400).json({ error: "At least one model must be selected" });
    }

    let chatId;
    try {
        chatId = await verifyUserOwnsChat(chatIdRaw, userId);
    } catch {
        return res.status(400).json({ error: "chatId is required and must refer to a chat you own" });
    }

    // Shared conversation history
    const history = await new Promise((resolve, reject) => {
        db.all(
            "SELECT message, reply FROM conversations WHERE user_id = ? AND chat_id = ? AND message NOT LIKE '[%' ORDER BY created_at DESC LIMIT 10",
            [userId, chatId],
            (err, rows) => { if (err) reject(err); else resolve(rows.reverse()); }
        );
    });

    const historyMessages = [{ role: "system", content: systemPrompt }];
    history.forEach(row => {
        historyMessages.push({ role: "user",      content: row.message });
        historyMessages.push({ role: "assistant", content: row.reply   });
    });

    const subjectKeyMulti = (subject || "general").toLowerCase();
    const modelRequests = models.map(async (model) => {
        try {
            const messages = [...historyMessages, { role: "user", content: message }];
            const response = await fetch("http://127.0.0.1:11434/api/chat", {
                method:  "POST",
                headers: { "Content-Type": "application/json" },
                body:    JSON.stringify({ model, messages, stream: false }),
            });

            const data = await response.json();

            if (!response.ok) {
                return { model, reply: `Error: ${data.error || "Model unavailable"}`, error: true };
            }

            const rawReply = data.message?.content || data.response || "No response from model.";
            const { reply } = extractMasteryFromReply(rawReply);

            let mastery = null;
            if (reply && String(reply).trim()) {
                mastery = await scoreMasteryWithOllamaFetch({
                    model,
                    studentMessage: message,
                    assistantReply: reply,
                    subjectKey: subjectKeyMulti,
                });
            }

            db.run(
                "INSERT INTO conversations (user_id, message, reply, created_at, chat_id) VALUES (?, ?, ?, datetime('now'), ?)",
                [userId, `[${model}] ${message}`, reply, chatId]
            );

            return { model, reply, error: false, mastery };

        } catch (err) {
            console.error(`Error querying model ${model}:`, err);
            return {
                model,
                reply: `Could not reach model "${model}". Run: ollama pull ${model}`,
                error: true,
                mastery: null,
            };
        }
    });

    const results = await Promise.all(modelRequests);
    const scores = results.filter((r) => !r.error && r.mastery != null).map((r) => r.mastery);
    if (!scores.length) {
        const anyReply = results.some((r) => !r.error && r.reply && String(r.reply).trim());
        if (anyReply) {
            console.warn("[mastery/multi] all scorers failed", { chatId, provider: "ollama" });
        }
    }

    if (scores.length) {
        setChatMasteryScore(chatId, userId, Math.max(...scores));
        db.run("UPDATE chat_sessions SET updated_at = datetime('now') WHERE id = ? AND user_id = ?", [chatId, userId]);
    }

    res.json({
        message,
        results: results.map(({ model, reply, error }) => ({ model, reply, error })),
    });
};


// ── GET AVAILABLE OLLAMA MODELS ───────────────────────────────────────────────
exports.getModels = async (req, res) => {
    try {
        const response = await fetch("http://127.0.0.1:11434/api/tags");
        const data     = await response.json();
        // Return plain name strings — frontend normalizeModel() handles conversion
        const models   = (data.models || []).map(m => m.name);
        res.json({ models });
    } catch (err) {
        console.error("Could not fetch Ollama models:", err);
        res.json({ models: ["llama3", "mistral", "phi3"] });
    }
};

const db = require("../database");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const SECRET = "supersecretkey";


// REGISTER USER
exports.registerUser = async (req, res) => {
    const { name, email, password } = req.body;

    try {
        const hashedPassword = await bcrypt.hash(password, 10);

        db.run(
            "INSERT INTO users (name, email, password) VALUES (?, ?, ?)",
            [name, email, hashedPassword],
            function(err) {
                if (err) {
                    return res.status(400).json({ error: err.message });
                }
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

            if (err) {
                return res.status(500).json({ error: "Database error" });
            }

            if (!user) {
                return res.status(401).json({ error: "User not found" });
            }

            const validPassword = await bcrypt.compare(password, user.password);

            if (!validPassword) {
                return res.status(401).json({ error: "Invalid password" });
            }

            const token = jwt.sign(
                { id: user.id },
                SECRET,
                { expiresIn: "1h" }
            );

            // Record login activity
            db.run(
                "INSERT INTO login_activity (student_id, login_time) VALUES (?, datetime('now'))",
                [user.id]
            );

            res.json({
                message: "Login successful",
                token: token,
                userId: user.id,
                name: user.name
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

            if (err) {
                return res.status(500).json({ error: "Database error" });
            }

            res.json({
                studentId: studentId,
                progress: rows
            });
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

            if (err) {
                return res.status(500).json({ error: "Database error" });
            }

            res.json({
                studentId: studentId,
                loginHistory: rows
            });
        }
    );
};


// CHAT MESSAGE - sends message to Ollama via HTTP and saves reply to database
exports.chatMessage = async (req, res) => {

    const { message, model } = req.body;
    const userId = req.user.id;
    const selectedModel = model || "llama3";

    try {
        // Fetch recent conversation history to maintain context
        const history = await new Promise((resolve, reject) => {
            db.all(
                "SELECT message, reply FROM conversations WHERE user_id = ? AND message NOT LIKE '[%' ORDER BY created_at DESC LIMIT 10",
                [userId],
                (err, rows) => { if (err) reject(err); else resolve(rows.reverse()); }
            );
        });

        // Build message thread: past exchanges + new message
        const messages = [];
        history.forEach(row => {
            messages.push({ role: "user", content: row.message });
            messages.push({ role: "assistant", content: row.reply });
        });
        messages.push({ role: "user", content: message });

        const response = await fetch("http://127.0.0.1:11434/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                model: selectedModel,
                messages: messages,
                stream: false
            })
        });

        const data = await response.json();

        if (!response.ok) {
            console.error("Ollama HTTP error:", data);
            return res.status(500).json({
                reply: data.error || "AI model error. Make sure Ollama is running."
            });
        }

        const reply = data.message?.content || "No response from model.";

        db.run(
            "INSERT INTO conversations (user_id, message, reply, created_at) VALUES (?, ?, ?, datetime('now'))",
            [userId, message, reply]
        );

        res.json({ reply });

    } catch (err) {
        console.error("Ollama fetch error:", err);
        res.status(500).json({
            reply: "AI model error. Make sure Ollama is running."
        });
    }
};


// GET CONVERSATION HISTORY
exports.getConversations = (req, res) => {

    const userId = req.params.id;

    db.all(
        "SELECT message, reply, created_at FROM conversations WHERE user_id = ? ORDER BY created_at DESC",
        [userId],
        (err, rows) => {

            if (err) {
                return res.status(500).json({ error: "Database error" });
            }

            res.json({ conversations: rows });
        }
    );
};


// SEARCH CONVERSATIONS
exports.searchConversations = (req, res) => {

    const { query } = req.query;
    const userId = req.user.id;

    db.all(
        "SELECT message, reply, created_at FROM conversations WHERE user_id = ? AND message LIKE ?",
        [userId, `%${query}%`],
        (err, rows) => {

            if (err) {
                return res.status(500).json({ error: "Database error" });
            }

            res.json({ results: rows });
        }
    );
};


// MULTI-MODEL CHAT - fans message out to multiple Ollama models in parallel
exports.multiModelChat = async (req, res) => {
    const { message, models } = req.body;
    const userId = req.user.id;

    if (!message) {
        return res.status(400).json({ error: "Message is required" });
    }

    if (!models || !Array.isArray(models) || models.length === 0) {
        return res.status(400).json({ error: "At least one model must be selected" });
    }

    // Fetch shared conversation history for context
    const history = await new Promise((resolve, reject) => {
        db.all(
            "SELECT message, reply FROM conversations WHERE user_id = ? AND message NOT LIKE '[%' ORDER BY created_at DESC LIMIT 10",
            [userId],
            (err, rows) => { if (err) reject(err); else resolve(rows.reverse()); }
        );
    });

    const historyMessages = [];
    history.forEach(row => {
        historyMessages.push({ role: "user", content: row.message });
        historyMessages.push({ role: "assistant", content: row.reply });
    });

    // Query all selected models in parallel
    const modelRequests = models.map(async (model) => {
        try {
            const messages = [...historyMessages, { role: "user", content: message }];
            const response = await fetch("http://127.0.0.1:11434/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    model: model,
                    messages: messages,
                    stream: false
                })
            });

            const data = await response.json();

            if (!response.ok) {
                return { model, reply: `Error: ${data.error || "Model unavailable"}`, error: true };
            }

            const reply = data.message?.content || "No response from model.";

            // Save each model's response to conversations
            db.run(
                "INSERT INTO conversations (user_id, message, reply, created_at) VALUES (?, ?, ?, datetime('now'))",
                [userId, `[${model}] ${message}`, reply]
            );

            return { model, reply, error: false };

        } catch (err) {
            console.error(`Error querying model ${model}:`, err);
            return { model, reply: `Could not reach model "${model}". Make sure it is running in Ollama.`, error: true };
        }
    });

    const results = await Promise.all(modelRequests);
    res.json({ message, results });
};


// GET AVAILABLE OLLAMA MODELS
exports.getModels = async (req, res) => {
    try {
        const response = await fetch("http://127.0.0.1:11434/api/tags");
        const data = await response.json();
        const models = (data.models || []).map(m => m.name);
        res.json({ models });
    } catch (err) {
        console.error("Could not fetch Ollama models:", err);
        // Return common defaults if Ollama unreachable
        res.json({ models: ["llama3", "mistral", "phi3"] });
    }
};

const db = require("../database");

const OLLAMA_URL = "http://127.0.0.1:11434/api/chat";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "llama3";

const MOCK_REPLY =
    process.env.MOCK_LLM_REPLY || "Mock assistant reply for automated tests.";

function parseConversationId(req) {
    const id = parseInt(req.params.id, 10);
    return Number.isFinite(id) ? id : null;
}

exports.createConversation = (req, res) => {
    const userId = req.user.id;
    const title =
        req.body.title != null && String(req.body.title).trim() !== ""
            ? String(req.body.title).trim()
            : "New chat";

    db.run(
        "INSERT INTO conversations (user_id, title) VALUES (?, ?)",
        [userId, title],
        function (err) {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            const convId = this.lastID;
            db.get(
                "SELECT id, title, updated_at FROM conversations WHERE id = ?",
                [convId],
                (e2, row) => {
                    if (e2 || !row) {
                        return res.status(500).json({ error: "Database error" });
                    }
                    res.status(201).json(row);
                }
            );
        }
    );
};

exports.listConversations = (req, res) => {
    const userId = req.user.id;

    db.all(
        `SELECT id, title, updated_at FROM conversations
         WHERE user_id = ? ORDER BY datetime(updated_at) DESC`,
        [userId],
        (err, rows) => {
            if (err) {
                return res.status(500).json({ error: "Database error" });
            }
            res.json({ conversations: rows });
        }
    );
};

exports.searchConversations = (req, res) => {
    const userId = req.user.id;
    const q = req.query.q != null ? String(req.query.q).trim() : "";

    if (!q) {
        return res.json({ results: [] });
    }

    const safe = q.replace(/[%_\\]/g, "");
    const like = `%${safe}%`;

    db.all(
        `SELECT DISTINCT c.id, c.title, c.updated_at
         FROM conversations c
         LEFT JOIN messages m ON m.conversation_id = c.id
         WHERE c.user_id = ?
           AND (c.title LIKE ? OR m.content LIKE ?)
         ORDER BY datetime(c.updated_at) DESC`,
        [userId, like, like],
        (err, rows) => {
            if (err) {
                return res.status(500).json({ error: "Database error" });
            }
            res.json({ results: rows });
        }
    );
};

exports.getMessages = (req, res) => {
    const convId = parseConversationId(req);
    if (convId == null) {
        return res.status(400).json({ error: "Invalid conversation id" });
    }
    const userId = req.user.id;

    db.get(
        "SELECT id, user_id FROM conversations WHERE id = ?",
        [convId],
        (err, conv) => {
            if (err) {
                return res.status(500).json({ error: "Database error" });
            }
            if (!conv) {
                return res.status(404).json({ error: "Conversation not found" });
            }
            if (Number(conv.user_id) !== Number(userId)) {
                return res.status(403).json({ error: "Forbidden" });
            }

            db.all(
                `SELECT id, role, content, created_at FROM messages
                 WHERE conversation_id = ? ORDER BY id ASC`,
                [convId],
                (e2, messages) => {
                    if (e2) {
                        return res.status(500).json({ error: "Database error" });
                    }
                    res.json({ conversationId: convId, messages });
                }
            );
        }
    );
};

exports.postMessage = async (req, res) => {
    const convId = parseConversationId(req);
    if (convId == null) {
        return res.status(400).json({ error: "Invalid conversation id" });
    }
    const userId = req.user.id;
    const content =
        req.body.message != null ? String(req.body.message).trim() : "";

    if (!content) {
        return res.status(400).json({ error: "Message is required" });
    }

    db.get(
        "SELECT id, user_id, title FROM conversations WHERE id = ?",
        [convId],
        async (err, conv) => {
            if (err) {
                return res.status(500).json({ error: "Database error" });
            }
            if (!conv) {
                return res.status(404).json({ error: "Conversation not found" });
            }
            if (Number(conv.user_id) !== Number(userId)) {
                return res.status(403).json({ error: "Forbidden" });
            }

            db.run(
                `INSERT INTO messages (conversation_id, role, content) VALUES (?, 'user', ?)`,
                [convId, content],
                function (e2) {
                    if (e2) {
                        return res.status(500).json({ error: "Database error" });
                    }

                    const shouldSetTitle =
                        !conv.title ||
                        conv.title === "New chat" ||
                        conv.title === "";

                    if (shouldSetTitle) {
                        const shortTitle =
                            content.length > 60
                                ? `${content.slice(0, 57)}...`
                                : content;
                        db.run(
                            "UPDATE conversations SET title = ? WHERE id = ?",
                            [shortTitle, convId]
                        );
                    }

                    db.all(
                        `SELECT role, content FROM messages
                         WHERE conversation_id = ? ORDER BY id ASC`,
                        [convId],
                        async (e3, messages) => {
                            if (e3) {
                                return res
                                    .status(500)
                                    .json({ error: "Database error" });
                            }

                            const ollamaMessages = messages.map((m) => ({
                                role: m.role,
                                content: m.content
                            }));

                            let replyText;

                            if (process.env.MOCK_LLM === "true") {
                                replyText = MOCK_REPLY;
                            } else {
                                try {
                                    const response = await fetch(OLLAMA_URL, {
                                        method: "POST",
                                        headers: {
                                            "Content-Type": "application/json"
                                        },
                                        body: JSON.stringify({
                                            model: OLLAMA_MODEL,
                                            messages: ollamaMessages,
                                            stream: false
                                        })
                                    });

                                    const data = await response.json();

                                    if (!response.ok) {
                                        console.error(
                                            "Ollama HTTP error:",
                                            data
                                        );
                                        return res.status(500).json({
                                            reply:
                                                data.error ||
                                                "AI model error. Make sure Ollama is running."
                                        });
                                    }

                                    replyText =
                                        data.message?.content ||
                                        "No response from model.";
                                } catch (fetchErr) {
                                    console.error("Ollama fetch error:", fetchErr);
                                    return res.status(500).json({
                                        reply:
                                            "AI model error. Make sure Ollama is running."
                                    });
                                }
                            }

                            db.run(
                                `INSERT INTO messages (conversation_id, role, content) VALUES (?, 'assistant', ?)`,
                                [convId, replyText],
                                (e4) => {
                                    if (e4) {
                                        return res
                                            .status(500)
                                            .json({ error: "Database error" });
                                    }

                                    db.run(
                                        `UPDATE conversations SET updated_at = datetime('now') WHERE id = ?`,
                                        [convId],
                                        () => {
                                            res.json({ reply: replyText });
                                        }
                                    );
                                }
                            );
                        }
                    );
                }
            );
        }
    );
};

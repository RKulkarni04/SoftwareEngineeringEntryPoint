const ollama = require("ollama");
const db = require("../database");
const ollama = require("ollama");
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
                userId: user.id
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


// CHAT MESSAGE - sends message to Ollama and saves to database
exports.chatMessage = async (req, res) => {

    const { message } = req.body;
    const userId = req.user.id;

    try {
        const ollama = require("ollama");
        const response = await ollama.chat({
            model: "llama3",
            messages: [{ role: "user", content: message }]
        });

        const reply = response.message.content;

        // Save conversation to database
        db.run(
            "INSERT INTO conversations (user_id, message, reply, created_at) VALUES (?, ?, ?, datetime('now'))",
            [userId, message, reply]
        );

        res.json({ reply });

    } catch (err) {
        console.error("Ollama error:", err);
        res.status(500).json({ reply: "AI model error. Make sure Ollama is running." });
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
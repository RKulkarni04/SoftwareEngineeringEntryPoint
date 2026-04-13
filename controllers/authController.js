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


// CHAT MESSAGE - sends message to Ollama via HTTP and saves reply to database
exports.chatMessage = async (req, res) => {
    const { message } = req.body;
    
    // 1. Check if user exists (Prevent crash on req.user.id)
    if (!req.user || !req.user.id) {
        console.error("DEBUG: No user found in request. Auth might be failing on message 2.");
        return res.status(401).json({ reply: "Session expired. Please log in again." });
    }

    const userId = req.user.id;
    console.log(`DEBUG: Processing message from user ${userId}: "${message}"`);

    try {
        console.log("DEBUG: Sending request to Ollama...");
        const response = await fetch("http://127.0.0.1:11434/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                model: "llama3",
                messages: [{ role: "user", content: message }],
                stream: false
            })
        });

        const data = await response.json();

        if (!response.ok) {
            console.error("DEBUG: Ollama Error Status:", response.status);
            return res.status(500).json({ reply: "Ollama is struggling. Check the Ollama logs." });
        }

        const reply = data.message?.content || "No response from model.";
        console.log("DEBUG: Received reply from Ollama. Saving to DB...");

        // 2. Wrap DB in a callback to prevent silent crashes
        db.run(
            "INSERT INTO conversations (user_id, message, reply, created_at) VALUES (?, ?, ?, datetime('now'))",
            [userId, message, reply],
            function(err) {
                if (err) {
                    console.error("DEBUG: Database Insert Error:", err.message);
                    // We still send the reply so the user isn't stuck
                    return res.json({ reply });
                }
                console.log("DEBUG: Successfully saved to DB. Sending response to browser.");
                res.json({ reply });
            }
        );

    } catch (err) {
        console.error("DEBUG: Critical Fetch Error:", err);
        res.status(500).json({ reply: "Backend error. Check terminal logs." });
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
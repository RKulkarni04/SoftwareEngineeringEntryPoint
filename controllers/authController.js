const CAS = require("cas");
const APP_URL = process.env.APP_URL || "http://localhost:3000";

const cas = new CAS({
    base_url: "https://cas.rutgers.edu",
    service: APP_URL + "/api/auth/cas/callback",
    version: 2.0
});

const db = require("../database");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const speakeasy = require("speakeasy");
const nodemailer = require("nodemailer");
const crypto = require("crypto");

const SECRET = process.env.JWT_SECRET || "supersecretkey";
const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MINUTES = 15;

// Email transporter (configure via .env)
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.ethereal.email",
    port: parseInt(process.env.SMTP_PORT || "587"),
    auth: {
        user: process.env.SMTP_USER || "",
        pass: process.env.SMTP_PASS || ""
    }
});

function resetFailedAttempts(userId) {
    db.run(
        "UPDATE users SET failed_attempts = 0, locked_until = NULL WHERE id = ?",
        [userId]
    );
}

// REGISTER USER
exports.registerUser = async (req, res) => {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
        return res.status(400).json({ error: "Name, email, and password are required" });
    }
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
    const { email, password, totp_token } = req.body;

    db.get("SELECT * FROM users WHERE email = ?", [email], async (err, user) => {
        if (err) return res.status(500).json({ error: "Database error" });
        if (!user) return res.status(401).json({ error: "User not found" });

        // Check if account is locked
        if (user.locked_until) {
            const lockedUntil = new Date(user.locked_until);
            if (new Date() < lockedUntil) {
                const remaining = Math.ceil((lockedUntil - new Date()) / 60000);
                return res.status(423).json({
                    error: `Account locked due to too many failed attempts. Try again in ${remaining} minute(s).`
                });
            } else {
                resetFailedAttempts(user.id);
                user.failed_attempts = 0;
                user.locked_until = null;
            }
        }

        const validPassword = await bcrypt.compare(password, user.password);

        if (!validPassword) {
            const newAttempts = (user.failed_attempts || 0) + 1;
            if (newAttempts >= MAX_FAILED_ATTEMPTS) {
                const lockUntil = new Date(Date.now() + LOCK_DURATION_MINUTES * 60 * 1000).toISOString();
                db.run(
                    "UPDATE users SET failed_attempts = ?, locked_until = ? WHERE id = ?",
                    [newAttempts, lockUntil, user.id]
                );
                return res.status(423).json({
                    error: `Account locked after ${MAX_FAILED_ATTEMPTS} failed attempts. Try again in ${LOCK_DURATION_MINUTES} minutes.`
                });
            } else {
                db.run("UPDATE users SET failed_attempts = ? WHERE id = ?", [newAttempts, user.id]);
                const attemptsLeft = MAX_FAILED_ATTEMPTS - newAttempts;
                return res.status(401).json({
                    error: `Invalid password. ${attemptsLeft} attempt(s) remaining before account lock.`
                });
            }
        }

        // 2FA verification
        if (user.totp_enabled && user.totp_secret) {
            if (!totp_token) {
                return res.status(401).json({ error: "2FA token required", requires2FA: true });
            }
            const verified = speakeasy.totp.verify({
                secret: user.totp_secret,
                encoding: "base32",
                token: totp_token,
                window: 1
            });
            if (!verified) {
                return res.status(401).json({ error: "Invalid 2FA token" });
            }
        }

        resetFailedAttempts(user.id);

        const token = jwt.sign({ id: user.id }, SECRET, { expiresIn: "1h" });

        db.run(
            "INSERT INTO login_activity (student_id, login_time) VALUES (?, datetime('now'))",
            [user.id]
        );

        res.json({ message: "Login successful", token, userId: user.id, name: user.name });
    });
};

// SETUP 2FA
exports.setup2FA = (req, res) => {
    const userId = req.user.id;
    db.get("SELECT email FROM users WHERE id = ?", [userId], (err, user) => {
        if (err || !user) return res.status(404).json({ error: "User not found" });
        const secret = speakeasy.generateSecret({ name: `EntryPoint (${user.email})`, length: 20 });
        db.run("UPDATE users SET totp_secret = ? WHERE id = ?", [secret.base32, userId], (err) => {
            if (err) return res.status(500).json({ error: "Failed to save 2FA secret" });
            res.json({ secret: secret.base32, otpauth_url: secret.otpauth_url });
        });
    });
};

// ENABLE 2FA (verify token then activate)
exports.enable2FA = (req, res) => {
    const userId = req.user.id;
    const { token } = req.body;
    db.get("SELECT totp_secret FROM users WHERE id = ?", [userId], (err, user) => {
        if (err || !user || !user.totp_secret) {
            return res.status(400).json({ error: "2FA setup not started. Call /api/2fa/setup first." });
        }
        const verified = speakeasy.totp.verify({
            secret: user.totp_secret, encoding: "base32", token, window: 1
        });
        if (!verified) return res.status(401).json({ error: "Invalid token. Please try again." });
        db.run("UPDATE users SET totp_enabled = 1 WHERE id = ?", [userId], (err) => {
            if (err) return res.status(500).json({ error: "Failed to enable 2FA" });
            res.json({ message: "2FA enabled successfully" });
        });
    });
};

// DISABLE 2FA
exports.disable2FA = (req, res) => {
    const userId = req.user.id;
    db.run("UPDATE users SET totp_enabled = 0, totp_secret = NULL WHERE id = ?", [userId], (err) => {
        if (err) return res.status(500).json({ error: "Failed to disable 2FA" });
        res.json({ message: "2FA disabled successfully" });
    });
};

// REQUEST PASSWORD RESET
exports.requestPasswordReset = (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email is required" });

    db.get("SELECT * FROM users WHERE email = ?", [email], async (err, user) => {
        if (err) return res.status(500).json({ error: "Database error" });
        const genericResponse = { message: "If an account with that email exists, a reset link has been sent." };
        if (!user) return res.json(genericResponse);

        const resetToken = crypto.randomBytes(32).toString("hex");
        const expires = new Date(Date.now() + 60 * 60 * 1000).toISOString();

        db.run(
            "UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE id = ?",
            [resetToken, expires, user.id],
            async (err) => {
                if (err) return res.status(500).json({ error: "Failed to save reset token" });
                const resetUrl = `${process.env.APP_URL || "http://localhost:3000"}/reset-password.html?token=${resetToken}`;
                try {
                    await transporter.sendMail({
                        from: process.env.SMTP_FROM || "noreply@entrypoint.app",
                        to: email,
                        subject: "EntryPoint Password Reset",
                        html: `<p>Hi ${user.name},</p><p>Click below to reset your password:</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>This link expires in 1 hour. If you did not request this, ignore this email.</p>`
                    });
                } catch (emailErr) {
                    console.error("Email send error:", emailErr);
                }
                res.json(genericResponse);
            }
        );
    });
};

// RESET PASSWORD
exports.resetPassword = async (req, res) => {
    const { token, new_password } = req.body;
    if (!token || !new_password) {
        return res.status(400).json({ error: "Token and new password are required" });
    }
    db.get("SELECT * FROM users WHERE reset_token = ?", [token], async (err, user) => {
        if (err) return res.status(500).json({ error: "Database error" });
        if (!user) return res.status(400).json({ error: "Invalid or expired reset token" });
        if (!user.reset_token_expires || new Date() > new Date(user.reset_token_expires)) {
            return res.status(400).json({ error: "Reset token has expired" });
        }
        const hashedPassword = await bcrypt.hash(new_password, 10);
        db.run(
            "UPDATE users SET password = ?, reset_token = NULL, reset_token_expires = NULL, failed_attempts = 0, locked_until = NULL WHERE id = ?",
            [hashedPassword, user.id],
            (err) => {
                if (err) return res.status(500).json({ error: "Failed to update password" });
                res.json({ message: "Password reset successful. You can now log in." });
            }
        );
    });
};

// GET STUDENT PROGRESS
exports.getProgress = (req, res) => {
    const studentId = req.params.id;
    db.all("SELECT assignment, score FROM progress WHERE student_id = ?", [studentId], (err, rows) => {
        if (err) return res.status(500).json({ error: "Database error" });
        res.json({ studentId, progress: rows });
    });
};

// GET LOGIN ACTIVITY
exports.getActivity = (req, res) => {
    const studentId = req.params.id;
    db.all("SELECT login_time FROM login_activity WHERE student_id = ?", [studentId], (err, rows) => {
        if (err) return res.status(500).json({ error: "Database error" });
        res.json({ studentId, loginHistory: rows });
    });
};

// CHAT MESSAGE
exports.chatMessage = async (req, res) => {
    const { message } = req.body;
    const userId = req.user.id;
    try {
        const response = await fetch("http://127.0.0.1:11434/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ model: "llama3", messages: [{ role: "user", content: message }], stream: false })
        });
        const data = await response.json();
        if (!response.ok) {
            return res.status(500).json({ reply: data.error || "AI model error. Make sure Ollama is running." });
        }
        const reply = data.message?.content || "No response from model.";
        db.run(
            "INSERT INTO conversations (user_id, message, reply, created_at) VALUES (?, ?, ?, datetime('now'))",
            [userId, message, reply]
        );
        res.json({ reply });
    } catch (err) {
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
            if (err) return res.status(500).json({ error: "Database error" });
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
            if (err) return res.status(500).json({ error: "Database error" });
            res.json({ results: rows });
        }
    );
};

// ─── RUTGERS CAS: START LOGIN ─────────────────────────────────────────────
exports.startCASLogin = (req, res) => {
    const casLoginUrl = `https://cas.rutgers.edu/login?service=${encodeURIComponent(APP_URL + "/api/auth/cas/callback")}`;
    res.redirect(casLoginUrl);
};

// ─── RUTGERS CAS: CALLBACK ────────────────────────────────────────────────
exports.casCallback = (req, res) => {
    const ticket = req.query.ticket;

    if (!ticket) {
        return res.redirect("/landing.html?error=no_ticket");
    }

    cas.validate(ticket, (err, status, netid) => {
        if (err || !status || !netid) {
            console.error("CAS validation error:", err);
            return res.redirect("/landing.html?error=cas_failed");
        }

        const email = `${netid}@scarletmail.rutgers.edu`;
        const name = netid;

        // Find existing user or create one
        db.get("SELECT * FROM users WHERE email = ?", [email], (err, user) => {
            if (err) return res.redirect("/landing.html?error=db_error");

            if (user) {
                // Existing user — issue token
                const token = jwt.sign({ id: user.id }, SECRET, { expiresIn: "1h" });
                db.run(
                    "INSERT INTO login_activity (student_id, login_time) VALUES (?, datetime('now'))",
                    [user.id]
                );
                return res.redirect(`/landing.html?token=${token}&userId=${user.id}&name=${encodeURIComponent(user.name)}`);
            } else {
                // New user — auto-register with NetID
                db.run(
                    "INSERT INTO users (name, email, password) VALUES (?, ?, ?)",
                    [name, email, ""],
                    function(err) {
                        if (err) return res.redirect("/landing.html?error=register_failed");
                        const newUserId = this.lastID;
                        const token = jwt.sign({ id: newUserId }, SECRET, { expiresIn: "1h" });
                        db.run(
                            "INSERT INTO login_activity (student_id, login_time) VALUES (?, datetime('now'))",
                            [newUserId]
                        );
                        return res.redirect(`/landing.html?token=${token}&userId=${newUserId}&name=${encodeURIComponent(name)}`);
                    }
                );
            }
        });
    });
};

const db = require("../database");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const SECRET = "supersecretkey";

const LOCKOUT_MINUTES = 15;
const MAX_FAILED_ATTEMPTS = 5;

exports.registerUser = async (req, res) => {
    const { name, email, password } = req.body;

    try {
        const hashedPassword = await bcrypt.hash(password, 10);

        db.run(
            "INSERT INTO users (name, email, password) VALUES (?, ?, ?)",
            [name, email, hashedPassword],
            function (err) {
                if (err) {
                    if (String(err.message).includes("UNIQUE")) {
                        return res.status(400).json({ error: "Email already in use" });
                    }
                    return res.status(400).json({ error: err.message });
                }

                res.json({ message: "User registered successfully" });
            }
        );
    } catch (error) {
        res.status(500).json({ error: "Server error" });
    }
};

function finishLogin(user, password, res) {
    bcrypt.compare(password, user.password).then((validPassword) => {
        if (!validPassword) {
            const attempts = (user.failed_login_attempts || 0) + 1;
            let newLockedUntil = null;
            if (attempts >= MAX_FAILED_ATTEMPTS) {
                const until = new Date(
                    Date.now() + LOCKOUT_MINUTES * 60 * 1000
                );
                newLockedUntil = until.toISOString();
            }
            db.run(
                "UPDATE users SET failed_login_attempts = ?, locked_until = ? WHERE id = ?",
                [attempts, newLockedUntil, user.id],
                () => {
                    return res.status(401).json({ error: "Invalid password" });
                }
            );
            return;
        }

        db.run(
            "UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = ?",
            [user.id],
            () => {
                const token = jwt.sign({ id: user.id }, SECRET, {
                    expiresIn: "1h"
                });

                db.run(
                    "INSERT INTO login_activity (student_id, login_time) VALUES (?, datetime('now'))",
                    [user.id]
                );

                res.json({
                    message: "Login successful",
                    token,
                    userId: user.id
                });
            }
        );
    });
}

exports.loginUser = (req, res) => {
    const { email, password } = req.body;

    db.get(
        "SELECT * FROM users WHERE email = ?",
        [email],
        (err, user) => {
            if (err) {
                return res.status(500).json({ error: "Database error" });
            }

            if (!user) {
                return res.status(401).json({ error: "User not found" });
            }

            const lockedUntil = user.locked_until
                ? new Date(user.locked_until)
                : null;
            if (lockedUntil && lockedUntil > new Date()) {
                return res.status(403).json({
                    error: "Account temporarily locked"
                });
            }

            if (lockedUntil && lockedUntil <= new Date()) {
                db.run(
                    "UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = ?",
                    [user.id],
                    (e2) => {
                        if (e2) {
                            return res.status(500).json({ error: "Database error" });
                        }
                        db.get(
                            "SELECT * FROM users WHERE id = ?",
                            [user.id],
                            (e3, fresh) => {
                                if (e3 || !fresh) {
                                    return res
                                        .status(500)
                                        .json({ error: "Database error" });
                                }
                                finishLogin(fresh, password, res);
                            }
                        );
                    }
                );
                return;
            }

            finishLogin(user, password, res);
        }
    );
};

exports.getProgress = (req, res) => {
    const studentId = req.user.id;

    db.all(
        "SELECT assignment, score FROM progress WHERE student_id = ?",
        [studentId],
        (err, rows) => {
            if (err) {
                return res.status(500).json({ error: "Database error" });
            }

            res.json({
                studentId: String(studentId),
                progress: rows
            });
        }
    );
};

exports.getActivity = (req, res) => {
    const studentId = req.user.id;

    db.all(
        "SELECT login_time FROM login_activity WHERE student_id = ?",
        [studentId],
        (err, rows) => {
            if (err) {
                return res.status(500).json({ error: "Database error" });
            }

            res.json({
                studentId: String(studentId),
                loginHistory: rows
            });
        }
    );
};

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
const jwt = require("jsonwebtoken");

const SECRET = "supersecretkey";

const authenticateToken = (req, res, next) => {

    const authHeader = req.headers["authorization"];

    if (!authHeader) {
        return res.status(401).json({ error: "Access token required" });
    }

    const token = authHeader.split(" ")[1];

    jwt.verify(token, SECRET, (err, user) => {

        if (err) {
            return res.status(403).json({ error: "Invalid or expired token" });
        }

        req.user = user;

        next();
    });
};

module.exports = authenticateToken;
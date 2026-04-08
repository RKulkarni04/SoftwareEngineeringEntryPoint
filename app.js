const express = require("express");
const cors = require("cors");
const path = require("path");

require("./database");

const authRoutes = require("./routes/authRoutes");
const conversationRoutes = require("./routes/conversationRoutes");

function createApp() {
    const app = express();

    app.use(cors());
    app.use(express.json());

    app.use(express.static(path.join(__dirname, "frontend")));

    app.use("/api", authRoutes);
    app.use("/api", conversationRoutes);

    app.get("/", (req, res) => {
        res.sendFile(path.join(__dirname, "frontend", "landing.html"));
    });

    app.get("/login", (req, res) => {
        res.sendFile(path.join(__dirname, "frontend", "login.html"));
    });

    app.get("/dashboard", (req, res) => {
        res.sendFile(path.join(__dirname, "frontend", "dashboard.html"));
    });

    return app;
}

module.exports = { createApp };

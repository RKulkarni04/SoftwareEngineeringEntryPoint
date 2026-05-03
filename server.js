const express = require("express");
const cors = require("cors");
const path = require("path");

require("./database");

const authRoutes = require("./routes/authRoutes");

const app = express();

app.use(cors());
app.use(express.json());

app.use(express.static(path.join(__dirname, "frontend")));

// Demo chat archive storage
let demoConversations = [];

// Get available Ollama models
app.get("/api/models", async (req, res) => {
    try {
        const response = await fetch("http://localhost:11434/api/tags");
        const data = await response.json();

        const models = data.models.map(model => model.name);
        res.json({ models });
    } catch (error) {
        console.error("Error fetching models:", error);
        res.json({ models: [] });
    }
});

// Chat with Ollama
app.post("/api/chat", async (req, res) => {
    try {
        const { message, model } = req.body;

        const response = await fetch("http://localhost:11434/api/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                model: model || "llama3:latest",
                prompt: message,
                stream: false
            })
        });

        const data = await response.json();
        const reply = data.response || "No response";

        demoConversations.unshift({
            message: message,
            reply: reply,
            created_at: new Date().toLocaleString()
        });

        res.json({ reply });

    } catch (error) {
        console.error("Chat error:", error);
        res.json({ reply: "Error connecting to Ollama" });
    }
});

// Search archived conversations — MUST be before /:userId
app.get("/api/conversations/search", (req, res) => {
    const query = (req.query.query || "").toLowerCase();

    const results = demoConversations.filter(c =>
        c.message.toLowerCase().includes(query) ||
        c.reply.toLowerCase().includes(query)
    );

    res.json({ results });
});

// Load archived conversations
app.get("/api/conversations/:userId", (req, res) => {
    res.json({ conversations: demoConversations });
});

// Auth routes must come AFTER Ollama/archive routes
app.use("/api", authRoutes);

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "frontend", "landing.html"));
});

const PORT = 3000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

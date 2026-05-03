const express = require("express");
const cors = require("cors");
const path = require("path");

require("./database");

const authRoutes = require("./routes/authRoutes");
const llmRoutes  = require("./routes/llm");

const app = express();

app.use(cors());
app.use(express.json());

app.use(express.static(path.join(__dirname, "frontend")));

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

// LLM + weather routes (must be registered so /api/weather and /api/llm/* resolve)
app.use("/api", llmRoutes);

// Auth routes
app.use("/api", authRoutes);

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "frontend", "landing.html"));
});

const PORT = 3000;

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Chat UI → http://localhost:${PORT}/chat.html`);
});
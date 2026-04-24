const express = require("express");
const cors = require("cors");
const path = require("path");

// Import query controller functions
const { validatePrompt, validateModels, queryModels } = require("./queryController");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Serve frontend files from the individual/frontend folder
app.use(express.static(path.join(__dirname, "frontend")));

// Serve the main page at root
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "frontend", "index.html"));
});

// POST /api/query - receives prompt and model list, queries all models simultaneously
app.post("/api/query", async (req, res) => {
    const { prompt, models } = req.body;

    // Validate prompt
    const promptCheck = validatePrompt(prompt);
    if (!promptCheck.valid) {
        return res.status(400).json({ error: promptCheck.error });
    }

    // Validate models
    const modelsCheck = validateModels(models);
    if (!modelsCheck.valid) {
        return res.status(400).json({ error: modelsCheck.error });
    }

    try {
        // Query all selected models at the same time
        const results = await queryModels(models, prompt);
        res.json({ results });
    } catch (err) {
        console.error("Query error:", err);
        res.status(500).json({ error: "Failed to query models." });
    }
});

// Start server on port 3001 to avoid conflict with group project on 3000
const PORT = 3001;
app.listen(PORT, () => {
    console.log(`Individual iteration server running on port ${PORT}`);
    console.log(`Open http://localhost:${PORT} in your browser`);
});
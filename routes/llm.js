// routes/llm.js
// Mount this in server.js with:  app.use("/api", require("./routes/llm"));
//
// Endpoints:
//   GET  /api/llm/models          — list available models + configuration status
//   POST /api/llm/chat            — send a message (multipart/form-data, optional file)
//   GET  /api/weather             — fetch current weather (?lat=&lon=&units=)

const express = require("express");
const router = express.Router();

const { chat, listModels } = require("../controllers/llmController");
const { getWeather } = require("../controllers/weatherController");
const { upload } = require("../middleware/upload");
const authenticateToken = require("../middleware/authMiddleware");

// LLM routes
router.get("/llm/models", authenticateToken, listModels);

// Accept an optional single file upload named "file"
router.post("/llm/chat", authenticateToken, upload.single("file"), chat);

// Weather route
router.get("/weather", getWeather);

// Multer error handler (file too large, wrong type, etc.)
router.use((err, _req, res, _next) => {
  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({ error: "File too large. Maximum size is 10 MB." });
  }
  return res.status(400).json({ error: err.message });
});

module.exports = router;

const express = require("express");
const cors = require("cors");
const path = require("path");

// Database
require("./database");

// Routes
const authRoutes = require("./routes/authRoutes");
const llmRoutes  = require("./routes/llm");

const app = express();

// ── Core middleware ────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ── Static: uploaded files ─────────────────────────────────────────────────────
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ── API routes (must come before catch-all static) ────────────────────────────
app.use("/api", authRoutes);   // auth: /api/login, /api/register, etc.
app.use("/api", llmRoutes);    // LLM:  /api/llm/chat, /api/llm/models, /api/weather

// ── Static: frontend (catch-all — keep last) ──────────────────────────────────
app.use(express.static(path.join(__dirname, "frontend")));

// ── Root route ─────────────────────────────────────────────────────────────────
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "frontend", "landing.html"));
});

// ── Start ──────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Chat UI → http://localhost:${PORT}/chat.html`);
});
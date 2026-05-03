// server.js — ADD these lines to your existing server.js
// (This file shows only the additions needed — don't replace your whole server.js)
//
// ─────────────────────────────────────────────────────────────────────────────
// 1. At the top, with your other requires:
// ─────────────────────────────────────────────────────────────────────────────

const path = require("path");

// ─────────────────────────────────────────────────────────────────────────────
// 2. After app = express() and your existing middleware (cors, json, etc.):
// ─────────────────────────────────────────────────────────────────────────────

// Serve uploaded files statically (optional — lets you preview images)
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Serve the new chat frontend
app.use("/chat", express.static(path.join(__dirname, "frontend")));

// Mount all LLM + weather routes under /api
const llmRoutes = require("./routes/llm");
app.use("/api", llmRoutes);

// ─────────────────────────────────────────────────────────────────────────────
// That's it. Your existing routes (/auth, /login, etc.) are untouched.
// Navigate to http://localhost:<PORT>/chat/chat.html to use the new UI.
// ─────────────────────────────────────────────────────────────────────────────

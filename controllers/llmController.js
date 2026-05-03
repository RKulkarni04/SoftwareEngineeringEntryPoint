// controllers/llmController.js
// Unified LLM router — supports Claude, Gemini, GPT-4, and local Ollama models.
// All providers share the same input/output contract so the frontend stays model-agnostic.
//
// Required env vars (add to .env — only the providers you use need keys):
//   ANTHROPIC_API_KEY   — for Claude
//   OPENAI_API_KEY      — for GPT-4 / GPT-4o
//   GEMINI_API_KEY      — for Gemini

const { readFileForContext } = require("../middleware/upload");
const db = require("../database");
const { appendMasteryPrompt, extractMasteryFromReply } = require("../utils/mastery");
const { verifyUserOwnsChat, setChatMasteryScore } = require("../utils/chatMastery");

// ─── Subject system prompts ───────────────────────────────────────────────────
const SUBJECT_PROMPTS = {
  math: `You are an expert Math tutor. Explain concepts step-by-step, show your working, 
and use clear notation. When solving problems walk through each step.`,

  science: `You are an expert Science tutor covering physics, chemistry, and biology. 
Use real-world analogies, mention relevant experiments, and cite scientific principles.`,

  history: `You are an expert History tutor. Provide historical context, discuss causes and 
effects, mention key figures, and connect past events to modern relevance.`,

  english: `You are an expert English & Literature tutor. Help with writing, grammar, 
literary analysis, essay structure, and reading comprehension.`,

  cs: `You are an expert Computer Science tutor. Help with algorithms, data structures, 
programming concepts, and debugging. Provide code examples when useful.`,

  general: `You are a helpful, knowledgeable academic tutor. Answer clearly and thoroughly, 
adapting your explanation to the student's level.`,
};

// ─── Provider adapters ────────────────────────────────────────────────────────

async function callClaude({ systemPrompt, userMessage, model }) {
  const modelId = model || "claude-sonnet-4-20250514";
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: modelId,
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    }),
  });
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Claude API error ${response.status}: ${err}`);
  }
  const data = await response.json();
  return data.content?.[0]?.text || "";
}

async function callGemini({ systemPrompt, userMessage, model }) {
  const modelId = model || "gemini-2.0-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${process.env.GEMINI_API_KEY}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: "user", parts: [{ text: userMessage }] }],
      generationConfig: { maxOutputTokens: 2048 },
    }),
  });
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini API error ${response.status}: ${err}`);
  }
  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

async function callOpenAI({ systemPrompt, userMessage, model }) {
  const modelId = model || "gpt-4o";
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: modelId,
      max_tokens: 2048,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
    }),
  });
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenAI API error ${response.status}: ${err}`);
  }
  const data = await response.json();
  return data.choices?.[0]?.message?.content || "";
}

async function callOllama({ systemPrompt, userMessage, model }) {
  const modelId = model || "llama3";
  const { Ollama } = require("ollama");
  const ollama = new Ollama();
  const response = await ollama.chat({
    model: modelId,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ],
  });
  return response.message?.content || "";
}

// ─── Provider registry — add new providers here ───────────────────────────────
const PROVIDERS = {
  claude: callClaude,
  gemini: callGemini,
  openai: callOpenAI,
  gpt4: callOpenAI,  // alias
  ollama: callOllama,
};

// Model → provider auto-detection
function detectProvider(model) {
  if (!model) return "claude";
  const m = model.toLowerCase();
  if (m.startsWith("claude")) return "claude";
  if (m.startsWith("gemini")) return "gemini";
  if (m.startsWith("gpt") || m.startsWith("o1") || m.startsWith("o3")) return "openai";
  // Anything else assumed to be an Ollama local model
  return "ollama";
}

// ─── Main handler ─────────────────────────────────────────────────────────────

/**
 * POST /api/llm/chat
 * Body (multipart/form-data or JSON):
 *   message      {string}  required — the user's question
 *   subject      {string}  optional — math|science|history|english|cs|general
 *   provider     {string}  optional — claude|gemini|openai|ollama (auto-detected from model if omitted)
 *   model        {string}  optional — specific model ID (e.g. "claude-opus-4-6", "gemini-2.0-flash")
 *   weatherCtx   {string}  optional — weather context string injected by weatherController
 *   file         {file}    optional — uploaded file whose text is injected as context
 */
async function chat(req, res) {
  try {
    const { message, subject, provider: explicitProvider, model, weatherCtx, chatId: chatIdRaw } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ error: "message is required" });
    }

    const userId = req.user?.id;
    let chatId;
    try {
      chatId = await verifyUserOwnsChat(chatIdRaw, userId);
    } catch {
      return res.status(400).json({ error: "chatId is required and must refer to a chat you own" });
    }

    // Build subject system prompt
    const subjectKey = (subject || "general").toLowerCase();
    let systemPrompt = SUBJECT_PROMPTS[subjectKey] || SUBJECT_PROMPTS.general;

    // Inject weather context if provided
    if (weatherCtx) {
      systemPrompt += `\n\nCurrent weather context: ${weatherCtx}`;
    }

    // Inject uploaded file content
    let userMessage = message.trim();
    if (req.file) {
      const fileContent = readFileForContext(req.file.path, req.file.mimetype);
      userMessage = `[Attached file: ${req.file.originalname}]\n\`\`\`\n${fileContent}\n\`\`\`\n\n${userMessage}`;
    }
    const userMessageForModel = appendMasteryPrompt(userMessage);

    // Resolve provider
    const providerKey = explicitProvider || detectProvider(model);
    const providerFn = PROVIDERS[providerKey];
    if (!providerFn) {
      return res.status(400).json({
        error: `Unknown provider: "${providerKey}". Supported: ${Object.keys(PROVIDERS).join(", ")}`,
      });
    }

    // Check API key availability
    const keyMap = {
      claude: "ANTHROPIC_API_KEY",
      gemini: "GEMINI_API_KEY",
      openai: "OPENAI_API_KEY",
      gpt4: "OPENAI_API_KEY",
    };
    const requiredKey = keyMap[providerKey];
    if (requiredKey && !process.env[requiredKey]) {
      return res.status(503).json({
        error: `${providerKey} requires ${requiredKey} to be set in your .env file.`,
      });
    }

    const rawReply = await providerFn({ systemPrompt, userMessage: userMessageForModel, model });
    const { reply, score } = extractMasteryFromReply(rawReply);

    db.run(
      "INSERT INTO conversations (user_id, message, reply, created_at, chat_id) VALUES (?, ?, ?, datetime('now'), ?)",
      [userId, message.trim(), reply, chatId]
    );
    setChatMasteryScore(chatId, userId, score);
    db.run("UPDATE chat_sessions SET updated_at = datetime('now') WHERE id = ? AND user_id = ?", [chatId, userId]);

    return res.json({
      reply,
      mastery: score,
      provider: providerKey,
      model: model || null,
      subject: subjectKey,
    });
  } catch (err) {
    console.error("[llmController] error:", err);
    return res.status(500).json({ error: err.message });
  }
}

/**
 * GET /api/llm/models
 * Returns cloud provider models (from env keys) PLUS whatever is actually
 * installed in Ollama right now — no hardcoded model names.
 */
async function listModels(_req, res) {
  // ── Cloud models (static, gated by API key presence) ──────────────────────
  const cloudModels = [
    { provider: "claude", label: "Claude Sonnet 4",  model: "claude-sonnet-4-20250514", configured: !!process.env.ANTHROPIC_API_KEY },
    { provider: "claude", label: "Claude Opus 4",    model: "claude-opus-4-20250514",   configured: !!process.env.ANTHROPIC_API_KEY },
    { provider: "gemini", label: "Gemini 2.0 Flash", model: "gemini-2.0-flash",         configured: !!process.env.GEMINI_API_KEY },
    { provider: "gemini", label: "Gemini 1.5 Pro",   model: "gemini-1.5-pro",           configured: !!process.env.GEMINI_API_KEY },
    { provider: "openai", label: "GPT-4o",           model: "gpt-4o",                   configured: !!process.env.OPENAI_API_KEY },
    { provider: "openai", label: "GPT-4 Turbo",      model: "gpt-4-turbo",              configured: !!process.env.OPENAI_API_KEY },
    { provider: "openai", label: "o3",               model: "o3",                       configured: !!process.env.OPENAI_API_KEY },
  ];

  // ── Ollama models: fetch what's actually installed ─────────────────────────
  let ollamaModels = [];
  try {
    const r = await fetch("http://127.0.0.1:11434/api/tags");
    const d = await r.json();
    ollamaModels = (d.models || []).map(m => ({
      provider:   "ollama",
      label:      m.name,          // e.g. "llama3", "mistral", "phi3"
      model:      m.name,
      configured: true,
    }));
  } catch {
    // Ollama not running — return no local models rather than wrong ones
    console.warn("[listModels] Ollama unreachable — no local models listed");
  }

  return res.json({ models: [...cloudModels, ...ollamaModels] });
}

module.exports = { chat, listModels };

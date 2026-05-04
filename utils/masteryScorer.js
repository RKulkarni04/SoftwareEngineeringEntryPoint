/**
 * Fallback mastery when the tutor model does not emit the trailing {NNN} token.
 * One JSON object only; parsed field "mastery" must be 0–100.
 */

const SCORER_SYSTEM = `You are a strict grader. Output ONLY valid JSON on a single line.
Schema: {"mastery":<integer 0-100>}
Rules:
- Score reflects the STUDENT's demonstrated understanding in this exchange only (reasoning, recall, correct use of ideas from their message). Ignore politeness fluff.
- Be harsh: vague questions alone, no attempt, or no evidence of understanding → use low scores (0–15).
- No markdown, no code fences, no explanation before or after the JSON.`;

function buildScorerUserMessage(studentMessage, assistantReply, subjectKey) {
  const subj = subjectKey && String(subjectKey).trim() ? String(subjectKey).trim() : "general";
  return (
    `Subject: ${subj}\n\n` +
    `Student message:\n${String(studentMessage ?? "")}\n\n` +
    `Assistant reply (evaluate the student, not the assistant's style):\n${String(assistantReply ?? "")}\n\n` +
    `Respond with exactly one JSON object: {"mastery":<0-100>}`
  );
}

function parseMasteryJson(text) {
  const s = String(text ?? "").trim();
  const i = s.indexOf("{");
  const j = s.lastIndexOf("}");
  if (i < 0 || j <= i) return null;
  try {
    const obj = JSON.parse(s.slice(i, j + 1));
    const m = obj && obj.mastery;
    const n = Math.round(Number(m));
    if (!Number.isFinite(n) || Number.isNaN(n)) return null;
    return Math.min(100, Math.max(0, n));
  } catch {
    return null;
  }
}

/**
 * @param {(args: { systemPrompt: string; userMessage: string; model?: string }) => Promise<string>} providerFn
 */
async function scoreMasteryWithProvider(providerFn, model, studentMessage, assistantReply, subjectKey) {
  if (typeof providerFn !== "function") return null;
  try {
    const raw = await providerFn({
      systemPrompt: SCORER_SYSTEM,
      userMessage: buildScorerUserMessage(studentMessage, assistantReply, subjectKey),
      model,
    });
    return parseMasteryJson(raw);
  } catch {
    return null;
  }
}

async function scoreMasteryWithOllamaFetch({ model, studentMessage, assistantReply, subjectKey }) {
  const messages = [
    { role: "system", content: SCORER_SYSTEM },
    { role: "user", content: buildScorerUserMessage(studentMessage, assistantReply, subjectKey) },
  ];
  try {
    const response = await fetch("http://127.0.0.1:11434/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: model || "llama3", messages, stream: false }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return null;
    const raw = data.message?.content || data.response || "";
    return parseMasteryJson(raw);
  } catch {
    return null;
  }
}

module.exports = {
  SCORER_SYSTEM,
  buildScorerUserMessage,
  parseMasteryJson,
  scoreMasteryWithProvider,
  scoreMasteryWithOllamaFetch,
};

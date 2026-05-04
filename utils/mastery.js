/**
 * Internal rules only: never echo mastery in the assistant reply; scoring is separate.
 * Wording avoids "UI/interface" so vague student messages are not steered off-topic.
 */
const MASTERY_UI_SYSTEM_ADDENDUM = `

INTERNAL (do not turn this into a lesson topic for the student):
• Do not include a mastery score, a 0–100 grade, or any "{NNN}"-style token in your answer. Do not write labels like "Mastery Token:" or "mastery score". Progress is recorded separately—do not explain how; only answer what the student asked.
• If the student's message is too short or unclear to have a real subject (e.g. a single digit), briefly ask what topic or question they mean before giving a long substantive answer.`;

function appendMasteryToSystem(systemPrompt) {
  const base = String(systemPrompt ?? "").trimEnd();
  return base + MASTERY_UI_SYSTEM_ADDENDUM;
}

/** @deprecated No longer appends to user text; kept for compatibility — returns text unchanged. */
function appendMasteryPrompt(userText) {
  return userText || "";
}

/** Lines models add that leak scoring meta */
function stripMasteryMetaLines(s) {
  let metaScore = null;
  const lines = String(s).split(/\r?\n/);
  const kept = [];
  const reMasteryScore = /\bmastery\s+score\b/i;
  const reMasteryToken = /\bmastery\s*token\b/i;
  for (const line of lines) {
    const isMetaLine =
      /\{\d{3}\}/.test(line) &&
      (reMasteryScore.test(line) || reMasteryToken.test(line));
    if (isMetaLine) {
      const tokens = line.match(/\{(\d{3})\}/g);
      if (tokens && tokens.length) {
        const lastTok = tokens[tokens.length - 1].match(/\{(\d{3})\}/);
        if (lastTok) {
          metaScore = Math.min(100, Math.max(0, parseInt(lastTok[1], 10)));
        }
      }
    } else {
      kept.push(line);
    }
  }
  let text = kept.join("\n");
  text = text.replace(/^\s*Mastery\s*Token\s*:\s*\{\d{3}\}\s*\.?\s*/i, "");
  text = text.replace(/\s*Mastery\s*Token\s*:\s*\{\d{3}\}\s*\.?\s*$/i, "");
  return { text, metaScore };
}

/**
 * Strip mastery token from model reply and parse 0–100 score.
 */
function extractMasteryFromReply(text) {
  const { text: stripped, metaScore } = stripMasteryMetaLines(String(text ?? ""));
  const s = stripped;

  const endTok = s.match(/\{(\d{3})\}\.?\s*$/);
  if (endTok) {
    const n = Math.min(100, Math.max(0, parseInt(endTok[1], 10)));
    return { reply: s.slice(0, endTok.index).trimEnd(), score: n };
  }

  const re = /\{(\d{3})\}/g;
  let match;
  let last = null;
  while ((match = re.exec(s)) !== null) {
    last = match;
  }
  if (last) {
    const afterBrace = s.slice(last.index + last[0].length);
    if (/^\.?\s*$/.test(afterBrace)) {
      const n = Math.min(100, Math.max(0, parseInt(last[1], 10)));
      return { reply: s.slice(0, last.index).trimEnd(), score: n };
    }
  }

  if (metaScore != null) {
    return { reply: s.trimEnd(), score: metaScore };
  }

  return { reply: s.trimEnd(), score: null };
}

module.exports = { appendMasteryToSystem, appendMasteryPrompt, extractMasteryFromReply };

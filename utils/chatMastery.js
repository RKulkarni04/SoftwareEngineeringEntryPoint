const db = require("../database");

function verifyUserOwnsChat(chatIdRaw, userId) {
  const chatId = parseInt(String(chatIdRaw), 10);
  if (!chatId || chatId < 1) {
    return Promise.reject(new Error("INVALID_CHAT"));
  }
  return new Promise((resolve, reject) => {
    db.get(
      "SELECT id FROM chat_sessions WHERE id = ? AND user_id = ?",
      [chatId, userId],
      (err, row) => {
        if (err || !row) reject(new Error("INVALID_CHAT"));
        else resolve(chatId);
      }
    );
  });
}

function setChatMasteryScore(chatId, userId, score) {
  if (score == null || Number.isNaN(score)) return;
  const s = Math.min(100, Math.max(0, score));
  db.run(
    "UPDATE chat_sessions SET mastery_score = ?, updated_at = datetime('now') WHERE id = ? AND user_id = ?",
    [s, chatId, userId]
  );
}

module.exports = { verifyUserOwnsChat, setChatMasteryScore };

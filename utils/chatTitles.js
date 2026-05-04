/**
 * Session titles for new chats: "Study session 1", "Study session 2", … per user (first unused N).
 */

/**
 * @param {Set<string>|Iterable<string>} usedTitles titles already taken by this user
 * @returns {string} max length 200
 */
function pickUnusedTitle(usedTitles) {
  const used = usedTitles instanceof Set ? usedTitles : new Set(usedTitles);
  const prefix = "Study session ";
  let n = 1;
  while (used.has(`${prefix}${n}`)) {
    n += 1;
  }
  return `${prefix}${n}`.slice(0, 200);
}

module.exports = { pickUnusedTitle };

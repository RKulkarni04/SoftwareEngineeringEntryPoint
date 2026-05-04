const test = require("node:test");
const assert = require("node:assert/strict");
const { extractMasteryFromReply } = require("./mastery");

test("strict suffix at end of string", () => {
  const { reply, score } = extractMasteryFromReply("Hello world.\n{042}\n");
  assert.equal(score, 42);
  assert.equal(reply, "Hello world.");
});

test("strict: no token", () => {
  const { reply, score } = extractMasteryFromReply("Just text");
  assert.equal(score, null);
  assert.equal(reply, "Just text");
});

test("relaxed: token then only trailing whitespace", () => {
  const { reply, score } = extractMasteryFromReply("Answer here.\n{007}  \n");
  assert.equal(score, 7);
  assert.equal(reply, "Answer here.");
});

test("reject last token if non-whitespace follows", () => {
  const { reply, score } = extractMasteryFromReply("See {010} and more");
  assert.equal(score, null);
  assert.equal(reply, "See {010} and more");
});

test("bounds clamp to 100", () => {
  const { score } = extractMasteryFromReply("x{100}\n");
  assert.equal(score, 100);
});

test("optional period after token at end", () => {
  const { reply, score } = extractMasteryFromReply("Two is 2.\n{042}.");
  assert.equal(score, 42);
  assert.equal(reply, "Two is 2.");
});

test("strip mastery score narration line and use its token", () => {
  const raw = "The sum is 2.\nThat's our mastery score of {042}.";
  const { reply, score } = extractMasteryFromReply(raw);
  assert.equal(score, 42);
  assert.equal(reply, "The sum is 2.");
});

test("narration-only single line", () => {
  const { reply, score } = extractMasteryFromReply("That's our mastery score of {015}.");
  assert.equal(score, 15);
  assert.equal(reply, "");
});

test("end token wins over earlier meta line score", () => {
  const raw = "Body text.\nThat's our mastery score of {010}.\n{042}.";
  const { reply, score } = extractMasteryFromReply(raw);
  assert.equal(score, 42);
  assert.equal(reply, "Body text.");
});

test("strip Mastery Token label line at start (model leak)", () => {
  const raw = "Mastery Token:{042} .\n\nHello there.";
  const { reply, score } = extractMasteryFromReply(raw);
  assert.equal(score, 42);
  assert.equal(reply.trim(), "Hello there.");
});

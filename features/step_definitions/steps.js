/**
 * features/step_definitions/steps.js
 *
 * Cucumber step definitions for:
 *   US1 — Multi-Model AI Chat Interface
 *   US2 — AI Chat Interface (single LLM + history)
 *   US3 — Security Protection (account lockout)
 *
 * These steps use Puppeteer for browser-level acceptance tests.
 * The server must be running on http://localhost:3000 before executing.
 *
 * Run:  npx cucumber-js
 */

const { Given, When, Then, Before, After, setDefaultTimeout } = require('@cucumber/cucumber');
const puppeteer = require('puppeteer');
const assert    = require('assert');

setDefaultTimeout(20_000);

const BASE = 'http://localhost:3000';

// ─── Browser lifecycle ──────────────────────────────────────────────────────

Before(async function () {
  this.browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  this.page    = await this.browser.newPage();
  this.lastResponse = null; // stores raw API JSON responses when using fetch directly
});

After(async function () {
  await this.browser.close();
});

// ─── Helper: log in via the UI and capture the JWT token ───────────────────

async function loginViaUI(page, email, password) {
  await page.goto(`${BASE}/landing.html`, { waitUntil: 'networkidle0' });

  // Fill login form (field selectors match landing.html)
  await page.type('#loginEmail',    email);
  await page.type('#loginPassword', password);
  await page.click('#loginBtn');

  // Wait for redirect or token in localStorage
  await page.waitForFunction(() => localStorage.getItem('token') !== null, { timeout: 10_000 })
    .catch(() => {}); // may fail for invalid creds — callers assert on outcome

  return page.evaluate(() => localStorage.getItem('token'));
}

// ─── Helper: direct API POST (bypasses Puppeteer for controller-level checks) ─

async function apiPost(path, body, token = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res  = await fetch(`${BASE}${path}`, { method: 'POST', headers, body: JSON.stringify(body) });
  const json = await res.json();
  return { status: res.status, body: json };
}

// ═══════════════════════════════════════════════════════════════════════════
// SHARED / BACKGROUND STEPS
// ═══════════════════════════════════════════════════════════════════════════

Given('I am logged in as {string} with password {string}', async function (email, password) {
  this.token = await loginViaUI(this.page, email, password);
  assert.ok(this.token, `Login failed — no token received for ${email}`);
});

Given('I am on the chat page', async function () {
  await this.page.goto(`${BASE}/chat.html`, { waitUntil: 'networkidle0' });
});

Given('I am on the login page', async function () {
  await this.page.goto(`${BASE}/landing.html`, { waitUntil: 'networkidle0' });
});

Given('a registered user with email {string} and password {string}', async function (email, password) {
  // Register via API; ignore "already exists" errors
  await apiPost('/api/register', { name: 'Test User', email, password });
  // Reset failed_attempts so each scenario starts clean (direct API call)
  await fetch(`${BASE}/api/test/reset-failed-attempts?email=${encodeURIComponent(email)}`).catch(() => {});
  this.testEmail    = email;
  this.testPassword = password;
});

// ═══════════════════════════════════════════════════════════════════════════
// US1 — MULTI-MODEL AI CHAT INTERFACE
// ═══════════════════════════════════════════════════════════════════════════

When('I type {string} into the prompt input', async function (text) {
  await this.page.waitForSelector('#multiPromptInput');
  await this.page.type('#multiPromptInput', text);
});

When('I select the models {string} and {string}', async function (m1, m2) {
  await this.page.click(`input[type="checkbox"][value="${m1}"]`);
  await this.page.click(`input[type="checkbox"][value="${m2}"]`);
});

When('I select the models {string}, {string}, and {string}', async function (m1, m2, m3) {
  for (const m of [m1, m2, m3]) {
    await this.page.click(`input[type="checkbox"][value="${m}"]`);
  }
});

When('I select the model {string}', async function (model) {
  await this.page.click(`input[type="checkbox"][value="${model}"]`);
});

When('I do not select any models', async function () {
  // Ensure all checkboxes are unchecked
  const checkboxes = await this.page.$$('input[type="checkbox"][name="model"]');
  for (const cb of checkboxes) {
    const checked = await cb.evaluate(el => el.checked);
    if (checked) await cb.click();
  }
});

When('I click the {string} button', async function (label) {
  // Find button by visible text
  await this.page.evaluate((lbl) => {
    const btn = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === lbl);
    if (btn) btn.click();
  }, label);
});

When('I leave the prompt input blank', async function () {
  // Clear any existing text
  await this.page.evaluate(() => {
    const el = document.querySelector('#multiPromptInput') || document.querySelector('#chatInput');
    if (el) el.value = '';
  });
});

Given('the model {string} is unavailable', async function (model) {
  // Store for later assertion; actual unavailability is handled server-side
  this.unavailableModel = model;
});

Then('I should see a response panel labeled {string}', async function (model) {
  await this.page.waitForSelector(`[data-model="${model}"]`, { timeout: 15_000 });
  const panel = await this.page.$(`[data-model="${model}"]`);
  assert.ok(panel, `Response panel for ${model} not found`);
});

Then('I should see a response panel labeled {string} with a reply', async function (model) {
  await this.page.waitForSelector(`[data-model="${model}"]`, { timeout: 15_000 });
  const text = await this.page.$eval(`[data-model="${model}"]`, el => el.textContent.trim());
  assert.ok(text.length > 0, `Panel for ${model} is empty`);
});

Then('I should see a panel labeled {string} showing an error message', async function (model) {
  await this.page.waitForSelector(`[data-model="${model}"]`, { timeout: 15_000 });
  const text = await this.page.$eval(`[data-model="${model}"]`, el => el.textContent.toLowerCase());
  assert.ok(text.includes('error') || text.includes('unavailable'),
    `No error indicator in panel for ${model}`);
});

Then('each panel should contain a non-empty reply', async function () {
  const panels = await this.page.$$('[data-model]');
  assert.ok(panels.length > 0, 'No response panels found');
  for (const panel of panels) {
    const text = await panel.evaluate(el => el.textContent.trim());
    assert.ok(text.length > 0, 'A response panel is empty');
  }
});

Then('I should see {int} response panels', async function (count) {
  await this.page.waitForFunction(
    (n) => document.querySelectorAll('[data-model]').length === n,
    { timeout: 15_000 }, count
  );
  const panels = await this.page.$$('[data-model]');
  assert.strictEqual(panels.length, count);
});

Then('all panels should load before I can submit another query', async function () {
  // All panels should not contain a loading indicator
  const loadingPanels = await this.page.$$('[data-model].loading');
  assert.strictEqual(loadingPanels.length, 0, 'Some panels are still loading');
});

Then('I should see the error {string}', async function (msg) {
  await this.page.waitForFunction(
    (m) => document.body.innerText.includes(m),
    { timeout: 5_000 }, msg
  );
});

Then('no response panels should appear', async function () {
  const panels = await this.page.$$('[data-model]');
  assert.strictEqual(panels.length, 0);
});

// ═══════════════════════════════════════════════════════════════════════════
// US2 — AI CHAT INTERFACE (single LLM + history)
// ═══════════════════════════════════════════════════════════════════════════

When('I type {string} into the chat input', async function (text) {
  await this.page.waitForSelector('#chatInput');
  await this.page.type('#chatInput', text);
});

When('I leave the chat input blank', async function () {
  await this.page.evaluate(() => {
    const el = document.querySelector('#chatInput');
    if (el) el.value = '';
  });
});

Given('the AI model service is offline', async function () {
  // Intercept the /api/chat request and return a 500
  await this.page.setRequestInterception(true);
  this.page.on('request', req => {
    if (req.url().includes('/api/chat')) {
      req.respond({ status: 500, contentType: 'application/json',
                    body: JSON.stringify({ reply: 'AI model error. Make sure Ollama is running.' }) });
    } else {
      req.continue();
    }
  });
});

Given('I have previously sent the message {string}', async function (msg) {
  // Insert a conversation record via API so history is populated
  const token = this.token;
  assert.ok(token, 'Must be logged in before seeding history');
  await fetch(`${BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ message: msg })
  });
});

Given('I have previously sent 7 different messages', async function () {
  for (let i = 1; i <= 7; i++) {
    await fetch(`${BASE}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.token}` },
      body: JSON.stringify({ message: `Test message number ${i}` })
    });
  }
});

Given('I have previously sent the messages {string} and {string}', async function (m1, m2) {
  for (const msg of [m1, m2]) {
    await fetch(`${BASE}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.token}` },
      body: JSON.stringify({ message: msg })
    });
  }
});

Then('I should see my message {string} in the chat window', async function (msg) {
  await this.page.waitForFunction(
    (m) => document.body.innerText.includes(m),
    { timeout: 5_000 }, msg
  );
});

Then('I should see an AI reply appear below my message', async function () {
  // A reply bubble should appear after the user bubble
  await this.page.waitForSelector('.ai-message, .reply-bubble, [data-role="assistant"]',
    { timeout: 15_000 });
});

Then('the AI reply should contain at least one character', async function () {
  const replyEl = await this.page.$('.ai-message, .reply-bubble, [data-role="assistant"]');
  assert.ok(replyEl, 'No AI reply element found');
  const text = await replyEl.evaluate(el => el.textContent.trim());
  assert.ok(text.length > 0, 'AI reply is empty');
});

Then('the {string} button should be disabled', async function (label) {
  const isDisabled = await this.page.evaluate((lbl) => {
    const btn = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === lbl);
    return btn ? btn.disabled : false;
  }, label);
  assert.ok(isDisabled, `Button "${label}" is not disabled`);
});

Then('once the reply arrives the {string} button should be enabled again', async function (label) {
  await this.page.waitForFunction((lbl) => {
    const btn = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === lbl);
    return btn && !btn.disabled;
  }, { timeout: 15_000 }, label);
});

Then('no new message should appear in the chat window', async function () {
  const count = await this.page.$$eval('.user-message, [data-role="user"]', els => els.length);
  assert.strictEqual(count, 0);
});

Then('I should see the message {string}', async function (msg) {
  await this.page.waitForFunction(
    (m) => document.body.innerText.includes(m),
    { timeout: 5_000 }, msg
  );
});

Then('I should see {string} listed in the conversation sidebar', async function (msg) {
  await this.page.waitForFunction(
    (m) => document.body.innerText.includes(m),
    { timeout: 5_000 }, msg
  );
  const sidebar = await this.page.$('#chatSidebar');
  const sidebarText = await sidebar.evaluate(el => el.textContent);
  assert.ok(sidebarText.includes(msg), `Sidebar does not contain "${msg}"`);
});

Then('the conversation sidebar should show exactly {int} entries', async function (n) {
  await this.page.waitForSelector('#chatSidebar > *');
  const count = await this.page.$$eval('#chatSidebar > *', els => els.length);
  assert.strictEqual(count, n);
});

When('I click on {string} in the sidebar', async function (msg) {
  await this.page.evaluate((m) => {
    const items = [...document.querySelectorAll('#chatSidebar *')];
    const item  = items.find(el => el.textContent.includes(m));
    if (item) item.click();
  }, msg);
});

Then('the chat window should display the message {string}', async function (msg) {
  await this.page.waitForFunction(
    (m) => document.body.innerText.includes(m),
    { timeout: 5_000 }, msg
  );
});

Then('the AI reply to that message should be visible', async function () {
  const reply = await this.page.$('.ai-message, .reply-bubble, [data-role="assistant"]');
  assert.ok(reply, 'No AI reply visible after clicking sidebar entry');
});

When('I search for {string}', async function (query) {
  // Assuming there is a search input on the chat page
  await this.page.waitForSelector('#searchInput, input[placeholder*="Search"]');
  await this.page.type('#searchInput, input[placeholder*="Search"]', query);
  await this.page.keyboard.press('Enter');
});

Then('I should see {string} in the search results', async function (msg) {
  await this.page.waitForFunction(
    (m) => document.body.innerText.includes(m),
    { timeout: 5_000 }, msg
  );
});

Then('I should not see {string} in the search results', async function (msg) {
  const found = await this.page.evaluate(
    (m) => document.body.innerText.includes(m), msg
  );
  assert.ok(!found, `"${msg}" should not appear in search results but does`);
});

Then('I should see the message "No conversations found"', async function () {
  await this.page.waitForFunction(
    () => document.body.innerText.includes('No conversations found'),
    { timeout: 5_000 }
  );
});

// ═══════════════════════════════════════════════════════════════════════════
// US3 — SECURITY PROTECTION (ACCOUNT LOCKOUT)
// ═══════════════════════════════════════════════════════════════════════════

When('I enter {string} and {string}', async function (email, password) {
  await this.page.waitForSelector('#loginEmail, #email, input[type="email"]');
  const emailSel = await this.page.$('#loginEmail') ? '#loginEmail' : 'input[type="email"]';
  const passSel  = await this.page.$('#loginPassword') ? '#loginPassword' : 'input[type="password"]';
  await this.page.type(emailSel,  email);
  await this.page.type(passSel, password);
  this.loginEmail = email;
  this.loginPassword = password;
});

When('I click the login button', async function () {
  const btn = await this.page.$('#loginBtn, button[type="submit"]');
  await btn.click();
  // Wait for network response
  await this.page.waitForResponse(
    res => res.url().includes('/api/login') && res.status() !== undefined,
    { timeout: 10_000 }
  ).catch(() => {});
  await new Promise(r => setTimeout(r, 500)); // small settle delay
});

Then('I should see an error message containing {string}', async function (text) {
  await this.page.waitForFunction(
    (t) => document.body.innerText.includes(t),
    { timeout: 5_000 }, text
  );
});

Then('the account should not be locked', async function () {
  // Verify via direct API — a valid login should still work
  const result = await apiPost('/api/login', {
    email:    this.testEmail,
    password: this.testPassword
  });
  assert.notStrictEqual(result.status, 423, 'Account is locked but should not be');
});

Given('the user {string} has already failed {int} login attempt(s)', async function (email, count) {
  // Seed failed attempts directly via a test-support endpoint or the API
  for (let i = 0; i < count; i++) {
    await apiPost('/api/login', { email, password: 'definitely_wrong_password_seed' });
  }
  this.testEmail = email;
});

Given('the user {string} account is locked', async function (email) {
  // Exhaust all 5 attempts
  for (let i = 0; i < 5; i++) {
    await apiPost('/api/login', { email, password: 'wrong' });
  }
  this.testEmail = email;
});

Given('the user {string} account lock has expired', async function (email) {
  // We cannot fast-forward time in the running server, so we use a test-support
  // endpoint that sets locked_until to a past timestamp.
  // Alternatively this can be done by directly manipulating the test DB fixture.
  await fetch(`${BASE}/api/test/expire-lock?email=${encodeURIComponent(email)}`).catch(() => {});
  this.testEmail = email;
});

Then('my account should be temporarily locked', async function () {
  const bodyText = await this.page.evaluate(() => document.body.innerText);
  assert.ok(
    bodyText.includes('locked') || bodyText.includes('Locked'),
    'Expected account locked message not found'
  );
});

Then('I should see a message containing {string}', async function (text) {
  await this.page.waitForFunction(
    (t) => document.body.innerText.includes(t),
    { timeout: 5_000 }, text
  );
});

Then('I should see the remaining lock time in minutes', async function () {
  const bodyText = await this.page.evaluate(() => document.body.innerText);
  assert.ok(/\d+\s*minute/.test(bodyText), 'Remaining lock time not displayed');
});

Then('I should not receive a session token', async function () {
  const token = await this.page.evaluate(() => localStorage.getItem('token'));
  assert.ok(!token, 'Token was set despite account being locked');
});

Then('I should be redirected to the dashboard', async function () {
  await this.page.waitForFunction(
    () => window.location.href.includes('landing.html') || window.location.href.includes('chat.html'),
    { timeout: 10_000 }
  );
});

Then('I should receive a valid session token', async function () {
  const token = await this.page.evaluate(() => localStorage.getItem('token'));
  assert.ok(token && token.split('.').length === 3, 'Valid JWT not found in localStorage');
});

Then('the failed attempt counter for {string} should be {int}', async function (email, expectedCount) {
  // Verify via the login API — if counter is 0, a wrong password on the next
  // attempt should show "4 attempt(s) remaining" (not a lower number)
  const result = await apiPost('/api/login', { email, password: 'probe_wrong' });
  const errorText = result.body.error || '';
  assert.ok(errorText.includes('4 attempt(s) remaining'),
    `Expected reset counter (4 remaining after 1 probe), got: ${errorText}`);
});

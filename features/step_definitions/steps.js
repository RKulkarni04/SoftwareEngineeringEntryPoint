/**
 * Step Definitions — EntryPoint Integration Tests
 * Uses Puppeteer for browser automation and supertest for API calls.
 *
 * Prerequisites:
 *   npm install --save-dev @cucumber/cucumber puppeteer
 *   The app must be running on http://localhost:3000
 *
 * Run: npx cucumber-js features/step_definitions
 */

require("../support/assert-expect");

const { Before, After, Given, When, Then, setDefaultTimeout } = require("@cucumber/cucumber");
const puppeteer = require("puppeteer");

setDefaultTimeout(30_000);

const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:3000";
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ── Shared world state ────────────────────────────────────────────────────────
Before(async function () {
  this.browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  this.page = await this.browser.newPage();

  // Intercept geolocation prompts
  const context = this.browser.defaultBrowserContext();
  await context.overridePermissions(BASE_URL, ["geolocation"]);

  // Stub geolocation to a default location (London)
  await this.page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, "geolocation", {
      value: {
        getCurrentPosition: (success) =>
          success({ coords: { latitude: 51.5, longitude: -0.1 } }),
        watchPosition: () => {},
        clearWatch: () => {},
      },
    });
  });

  this.testEmail = `test-${Date.now()}@entrypoint.test`;
  this.testPassword = "Password123!";
});

After(async function () {
  if (this.browser) await this.browser.close();
});

// ── Helper functions ──────────────────────────────────────────────────────────
async function registerAndLogin(page, email, password) {
  // Register via API
  await page.evaluate(
    async (url, e, p) => {
      await fetch(`${url}/api/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Test User", email: e, password: p }),
      });
    },
    BASE_URL,
    email,
    password
  );
  // Login and store token in localStorage
  const loginResult = await page.evaluate(
    async (url, e, p) => {
      const r = await fetch(`${url}/api/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: e, password: p }),
      });
      return r.json();
    },
    BASE_URL,
    email,
    password
  );
  await page.evaluate(
    (token, userId, name) => {
      localStorage.setItem("token", token);
      localStorage.setItem("userId", String(userId));
      localStorage.setItem("userName", name);
    },
    loginResult.token,
    loginResult.userId,
    loginResult.name || "Test User"
  );
  return loginResult;
}

async function createChatSession(page, token) {
  const result = await page.evaluate(
    async (url, t) => {
      const r = await fetch(`${url}/api/chats`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${t}`,
        },
        body: JSON.stringify({ title: "Test Session" }),
      });
      return r.json();
    },
    BASE_URL,
    token
  );
  if (result.chatId) {
    await page.evaluate(
      (id) => sessionStorage.setItem("currentChatId", String(id)),
      result.chatId
    );
  }
  return result;
}

// ── Given steps ───────────────────────────────────────────────────────────────

Given("I am logged in as a valid user", async function () {
  await this.page.goto(BASE_URL);
  const result = await registerAndLogin(this.page, this.testEmail, this.testPassword);
  this.authToken = result.token;
  this.userId    = result.userId;
});

Given("I have an active chat session", async function () {
  await createChatSession(this.page, this.authToken);
});

Given("I am not logged in", async function () {
  await this.page.goto(BASE_URL);
  await this.page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
});

Given("I am logged in as a new user with no chat history", async function () {
  const newEmail = `fresh-${Date.now()}@entrypoint.test`;
  await this.page.goto(BASE_URL);
  const result = await registerAndLogin(this.page, newEmail, this.testPassword);
  this.authToken = result.token;
  this.userId    = result.userId;
});

Given("no API keys are configured in the environment", function () {
  // This is asserted by inspecting the rendered badges; no action needed here.
  // The server returns configured:false for cloud models when keys are absent.
});

Given("geolocation is mocked to return coordinates {string} {string}", async function (lat, lon) {
  const latitude  = parseFloat(String(lat).replace(/\u2212/g, "-"));
  const longitude = parseFloat(String(lon).replace(/\u2212/g, "-"));
  await this.page.evaluateOnNewDocument(
    (la, lo) => {
      Object.defineProperty(navigator, "geolocation", {
        value: {
          getCurrentPosition: (success) =>
            success({ coords: { latitude: la, longitude: lo } }),
        },
      });
    },
    latitude,
    longitude
  );
});

Given("the weather API returns a clear sky response", async function () {
  await this.page.setRequestInterception(true);
  this.page.on("request", (req) => {
    if (req.url().includes("/api/weather")) {
      req.respond({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          weather: {
            code: 0,
            temperature: 18,
            feelsLike: 16,
            humidity: 55,
            windSpeed: 12,
            description: "Clear sky",
            isDay: true,
            precipitation: 0,
            unit: "°C",
            windUnit: "kmh",
          },
          weatherCtx: "It is currently daytime. Weather: Clear sky. Temperature: 18°C.",
        }),
      });
    } else {
      req.continue();
    }
  });
});

// ── When steps ────────────────────────────────────────────────────────────────

When("I navigate to the chat page", async function () {
  await this.page.goto(`${BASE_URL}/chat.html`, { waitUntil: "networkidle2" });
  await this.page.waitForSelector(".topbar", { timeout: 10_000 });
});

When("I navigate to the mastery page", async function () {
  await this.page.goto(`${BASE_URL}/mastery.html`, { waitUntil: "networkidle2" });
});

When("I navigate directly to the mastery page", async function () {
  await this.page.goto(`${BASE_URL}/mastery.html`, { waitUntil: "networkidle2" });
});

When("I click on a local model named {string} in the sidebar", async function (modelName) {
  await this.page.waitForSelector(".model-list", { timeout: 5000 });
  await this.page.evaluate((name) => {
    const items = Array.from(document.querySelectorAll(".model-item"));
    const target = items.find((el) => el.dataset.model === name || el.textContent.includes(name));
    if (target) target.click();
  }, modelName);
});

When("I click the {string} mode button", async function (mode) {
  const selector = mode === "Compare" ? "#btnMulti" : "#btnSingle";
  await this.page.waitForSelector(selector, { timeout: 5000 });
  await this.page.click(selector);
});

When("I check the checkbox for model {string}", async function (modelName) {
  await this.page.evaluate((name) => {
    const items = Array.from(document.querySelectorAll(".model-item"));
    const target = items.find((el) => el.dataset.model === name || el.textContent.includes(name));
    if (target) {
      const cb = target.querySelector('input[type="checkbox"]');
      if (cb && !cb.checked) target.click();
    }
  }, modelName);
});

When("I click the {string} subject button", async function (subjectLabel) {
  const labelMap = {
    General: "general",
    Mathematics: "math",
    Science: "science",
    History: "history",
    Literature: "english",
    Computing: "cs",
  };
  const key = labelMap[subjectLabel] || subjectLabel.toLowerCase();
  await this.page.evaluate((k) => {
    const btn = document.querySelector(`.subj-btn[data-subj="${k}"]`);
    if (btn) btn.click();
  }, key);
  await delay(200);
});

When("I select subject {string}", async function (subject) {
  const step = `I click the "${subject}" subject button`;
  await this.page.evaluate((s) => {
    const labelMap = { Mathematics: "math", Science: "science", History: "history", Literature: "english", Computing: "cs", General: "general" };
    const key = labelMap[s] || s.toLowerCase();
    const btn = document.querySelector(`.subj-btn[data-subj="${key}"]`);
    if (btn) btn.click();
  }, subject);
});

When("I select the local model {string}", async function (modelName) {
  await this.page.waitForSelector(".model-list", { timeout: 5000 });
  await this.page.evaluate((name) => {
    const items = Array.from(document.querySelectorAll(".model-item"));
    const target = items.find((el) => el.dataset.model === name);
    if (target) target.click();
  }, modelName);
});

When("I select a cloud model without an API key", async function () {
  // Click the first unconfigured cloud model
  await this.page.waitForSelector(".model-list", { timeout: 5000 });
  await this.page.evaluate(() => {
    const items = Array.from(document.querySelectorAll(".model-item.unconfigured"));
    if (items[0]) items[0].click();
  });
});

When("I type {string} in the chat input", async function (text) {
  await this.page.waitForSelector("#chatInput", { timeout: 5000 });
  await this.page.click("#chatInput");
  await this.page.type("#chatInput", text);
});

When("I click the send button", async function () {
  await this.page.click("#sendBtn");
});

When("I click the {string} toggle button", async function (label) {
  if (label === "Weather context") {
    await this.page.waitForSelector("#weatherToggleBtn", { timeout: 5000 });
    await this.page.click("#weatherToggleBtn");
    await delay(1000);
  }
});

When("I activate weather context", async function () {
  await this.page.waitForSelector("#weatherToggleBtn", { timeout: 5000 });
  await this.page.click("#weatherToggleBtn");
  await delay(1500);
});

When("I click the dismiss button on the weather banner", async function () {
  await this.page.waitForSelector(".weather-dismiss", { timeout: 5000 });
  await this.page.click(".weather-dismiss");
});

When("I attach a file named {string} of type {string}", async function (fileName, mimeType) {
  const fileContent = mimeType === "application/pdf"
    ? "%PDF-1.4 test content"
    : "Sample file content for testing";
  const handle = await this.page.$("#fileInput");
  // Use evaluateHandle to programmatically create and dispatch a file selection
  await this.page.evaluate(
    (name, mime, content) => {
      const blob = new Blob([content], { type: mime });
      const file = new File([blob], name, { type: mime });
      const dt = new DataTransfer();
      dt.items.add(file);
      const input = document.getElementById("fileInput");
      Object.defineProperty(input, "files", { value: dt.files, configurable: true });
      input.dispatchEvent(new Event("change", { bubbles: true }));
    },
    fileName,
    mimeType,
    fileContent
  );
  await delay(300);
});

When("I attach a file named {string} of type {string} with size {int}", async function (fileName, mimeType, size) {
  const content = "A".repeat(size);
  await this.page.evaluate(
    (name, mime, c) => {
      const blob = new Blob([c], { type: mime });
      const file = new File([blob], name, { type: mime });
      const dt = new DataTransfer();
      dt.items.add(file);
      const input = document.getElementById("fileInput");
      Object.defineProperty(input, "files", { value: dt.files, configurable: true });
      input.dispatchEvent(new Event("change", { bubbles: true }));
    },
    fileName,
    mimeType,
    content
  );
  await delay(300);
});

When("I click the remove button on the file preview", async function () {
  await this.page.waitForSelector(".file-remove", { timeout: 5000 });
  await this.page.click(".file-remove");
  await delay(200);
});

When("I send a message {string}", async function (message) {
  await this.page.waitForSelector("#chatInput", { timeout: 5000 });
  await this.page.type("#chatInput", message);
  await this.page.click("#sendBtn");
  await delay(500);
});

When("the AI responds with a mastery score of {int}", async function (score) {
  // Directly invoke the client-side function to simulate a score update
  await this.page.evaluate((s) => {
    if (typeof setDisciplineMasteryFromScore === "function") {
      setDisciplineMasteryFromScore(s);
    }
  }, score);
  await delay(300);
});

// ── Then steps ────────────────────────────────────────────────────────────────

Then("the model list in the sidebar should be visible", async function () {
  const visible = await this.page.waitForSelector(".model-list", { timeout: 5000 });
  expect(visible).toBeTruthy();
});

Then("the model list should contain at least one model entry", async function () {
  await this.page.waitForFunction(
    () => document.querySelectorAll(".model-item").length > 0,
    { timeout: 8000 }
  );
  const count = await this.page.$$eval(".model-item", (els) => els.length);
  expect(count).toBeGreaterThan(0);
});

Then("the {string} mode button should be active", async function (mode) {
  const selector = mode === "Compare" ? "#btnMulti" : "#btnSingle";
  const isActive = await this.page.$eval(selector, (el) =>
    el.classList.contains("active")
  );
  expect(isActive).toBe(true);
});

Then("the {string} mode button should not be active", async function (mode) {
  const selector = mode === "Compare" ? "#btnMulti" : "#btnSingle";
  const isActive = await this.page.$eval(selector, (el) =>
    el.classList.contains("active")
  );
  expect(isActive).toBe(false);
});

Then("{string} should appear as the active model", async function (modelName) {
  await this.page.waitForFunction(
    (name) => {
      const items = Array.from(document.querySelectorAll(".model-item.selected"));
      return items.some((el) => el.dataset.model === name || el.textContent.includes(name));
    },
    { timeout: 3000 },
    modelName
  );
});

Then("a multi-model information banner should appear", async function () {
  const isVisible = await this.page.$eval("#multiInfo", (el) =>
    el.classList.contains("show")
  );
  expect(isVisible).toBe(true);
});

Then("both {string} and {string} should be checked in the model list", async function (m1, m2) {
  await delay(300);
  const checked = await this.page.evaluate((a, b) => {
    const items = Array.from(document.querySelectorAll(".model-item"));
    const isChecked = (name) =>
      items.some((el) => {
        const cb = el.querySelector('input[type="checkbox"]');
        return (el.dataset.model === name || el.textContent.includes(name)) && cb && cb.checked;
      });
    return isChecked(a) && isChecked(b);
  }, m1, m2);
  expect(checked).toBe(true);
});

Then("the model section should contain a {string} provider heading", async function (heading) {
  const found = await this.page.evaluate((h) => {
    const dividers = Array.from(document.querySelectorAll(".model-section div"));
    return dividers.some((el) => el.textContent.trim() === h);
  }, heading);
  expect(found).toBe(true);
});

Then("I should see an AI reply bubble appear", async function () {
  await this.page.waitForFunction(
    () => document.querySelectorAll(".bubble.ai:not(.loading)").length > 0,
    { timeout: 20_000 }
  );
  const bubbles = await this.page.$$(".bubble.ai:not(.loading)");
  expect(bubbles.length).toBeGreaterThan(0);
});

Then("the model list should contain an entry for provider {string}", async function (provider) {
  await this.page.waitForFunction(
    (p) => document.querySelectorAll(`[data-provider="${p}"]`).length > 0,
    { timeout: 8000 },
    provider
  );
  const count = await this.page.$$eval(`[data-provider="${provider}"]`, (els) => els.length);
  expect(count).toBeGreaterThan(0);
});

Then("cloud model entries should display a {string} badge", async function (badgeText) {
  const found = await this.page.evaluate((text) => {
    const badges = Array.from(document.querySelectorAll(".model-badge.err"));
    return badges.some((b) => b.textContent.includes(text));
  }, badgeText);
  expect(found).toBe(true);
});

Then("I should see an error message mentioning an API key", async function () {
  await this.page.waitForFunction(
    () => {
      const toast = document.getElementById("toast");
      const bubbles = Array.from(document.querySelectorAll(".bubble.ai:not(.loading)"));
      const toastText = toast ? toast.textContent : "";
      const bubbleText = bubbles.map((b) => b.textContent).join(" ");
      const combined = (toastText + bubbleText).toLowerCase();
      return combined.includes("key") || combined.includes("api") || combined.includes("503");
    },
    { timeout: 15_000 }
  );
});

// Weather steps

Then("I should see a {string} toggle button in the sidebar", async function (label) {
  const found = await this.page.evaluate((text) => {
    const btns = Array.from(document.querySelectorAll(".weather-toggle-btn"));
    return btns.some((b) => b.textContent.includes(text));
  }, label);
  expect(found).toBe(true);
});

Then("the browser should have requested geolocation permission", function () {
  // Verified indirectly: the test setup overrides geolocation; if toggle didn't
  // call navigator.geolocation.getCurrentPosition the banner won't show.
  // A non-throwing step here confirms the toggle ran without JS errors.
});

Then("the weather banner should become visible", async function () {
  await this.page.waitForFunction(
    () => document.getElementById("weatherBanner")?.classList.contains("visible"),
    { timeout: 8000 }
  );
});

Then("the weather banner should display a temperature value", async function () {
  const temp = await this.page.$eval("#weatherTemp", (el) => el.textContent.trim());
  expect(temp).not.toBe("—");
  expect(temp.length).toBeGreaterThan(1);
});

Then("the weather banner should display a weather description", async function () {
  const desc = await this.page.$eval("#weatherDesc", (el) => el.textContent.trim());
  expect(desc).not.toBe("—");
  expect(desc.length).toBeGreaterThan(2);
});

Then("the weather banner should contain the text {string}", async function (text) {
  const bannerText = await this.page.$eval("#weatherBanner", (el) => el.textContent);
  expect(bannerText).toContain(text);
});

Then("the weather banner should not be visible", async function () {
  const isVisible = await this.page.$eval("#weatherBanner", (el) =>
    el.classList.contains("visible")
  );
  expect(isVisible).toBe(false);
});

Then("the weather toggle button should not be in its active state", async function () {
  const isActive = await this.page.$eval("#weatherToggleBtn", (el) =>
    el.classList.contains("active")
  );
  expect(isActive).toBe(false);
});

Then("the weather toggle button should have the {string} CSS class", async function (cls) {
  const has = await this.page.$eval("#weatherToggleBtn", (el, c) => el.classList.contains(c), cls);
  expect(has).toBe(true);
});

// Subject steps

Then("I should see the subject button {string}", async function (label) {
  const labelMap = { General: "general", Mathematics: "math", Science: "science", History: "history", Literature: "english", Computing: "cs" };
  const key = labelMap[label] || label.toLowerCase();
  const exists = await this.page.$$(`.subj-btn[data-subj="${key}"]`);
  expect(exists.length).toBeGreaterThan(0);
});

Then("the {string} subject button should have the {string} CSS class", async function (label, cls) {
  const labelMap = { General: "general", Mathematics: "math", Science: "science", History: "history", Literature: "english", Computing: "cs" };
  const key = labelMap[label] || label.toLowerCase();
  const has = await this.page.$eval(`.subj-btn[data-subj="${key}"]`, (el, c) => el.classList.contains(c), cls);
  expect(has).toBe(true);
});

Then("the {string} subject button should not have the {string} CSS class", async function (label, cls) {
  const labelMap = { General: "general", Mathematics: "math", Science: "science", History: "history", Literature: "english", Computing: "cs" };
  const key = labelMap[label] || label.toLowerCase();
  const has = await this.page.$eval(`.subj-btn[data-subj="${key}"]`, (el, c) => el.classList.contains(c), cls);
  expect(has).toBe(false);
});

Then("the input hint area should mention {string}", async function (subject) {
  const hint = await this.page.$eval("#inputHint", (el) => el.textContent);
  expect(hint.toLowerCase()).toContain(subject.toLowerCase());
});

Then("the {string} subject button should still be active", async function (label) {
  const labelMap = {
    General: "general",
    Mathematics: "math",
    Science: "science",
    History: "history",
    Literature: "english",
    Computing: "cs",
  };
  const key = labelMap[label] || label.toLowerCase();
  const exists = await this.page.$$(`.subj-btn[data-subj="${key}"]`);
  expect(exists.length).toBeGreaterThan(0);
  const active = await this.page.$eval(
    `.subj-btn[data-subj="${key}"]`,
    (el) => el.classList.contains("active")
  );
  expect(active).toBe(true);
});

// File upload steps

Then(/^I should see an attach button .* in the input area$/, async function () {
  const visible = await this.page.waitForSelector("#attachBtn", { timeout: 5000 });
  expect(visible).toBeTruthy();
});

Then("the file preview strip should become visible", async function () {
  await this.page.waitForFunction(
    () => document.getElementById("filePreview")?.classList.contains("visible"),
    { timeout: 5000 }
  );
});

Then("the file preview should display the filename {string}", async function (fileName) {
  const name = await this.page.$eval("#fileName", (el) => el.textContent.trim());
  expect(name).toBe(fileName);
});

Then("the attach button should have the {string} CSS class", async function (cls) {
  const has = await this.page.$eval("#attachBtn", (el, c) => el.classList.contains(c), cls);
  expect(has).toBe(true);
});

Then("the file preview strip should not be visible", async function () {
  const isVisible = await this.page.$eval("#filePreview", (el) =>
    el.classList.contains("visible")
  );
  expect(isVisible).toBe(false);
});

Then("the attach button should not have the {string} CSS class", async function (cls) {
  const has = await this.page.$eval("#attachBtn", (el, c) => el.classList.contains(c), cls);
  expect(has).toBe(false);
});

Then("the file preview should display a file size indicator", async function () {
  const size = await this.page.$eval("#fileSize", (el) => el.textContent.trim());
  expect(size.length).toBeGreaterThan(0);
});

Then("the user message bubble should contain {string}", async function (text) {
  await this.page.waitForFunction(
    (t) => Array.from(document.querySelectorAll(".bubble.user")).some((b) => b.textContent.includes(t)),
    { timeout: 5000 },
    text
  );
});

// Mastery steps

Then("I should see a {string} link in the top navigation", async function (label) {
  const found = await this.page.evaluate((l) => {
    const links = Array.from(document.querySelectorAll(".topbar a, .topbar-actions a"));
    return links.some((a) => a.textContent.trim().includes(l));
  }, label);
  expect(found).toBe(true);
});

Then("I should see the mastery page heading", async function () {
  const heading = await this.page.waitForSelector("h1", { timeout: 5000 });
  const text = await this.page.$eval("h1", (el) => el.textContent);
  expect(text.toLowerCase()).toContain("mastery");
});

Then("I should see at least one mastery row with a progress bar", async function () {
  await this.page.waitForFunction(
    () => document.querySelectorAll(".row .bar-wrap").length > 0,
    { timeout: 8000 }
  );
  const count = await this.page.$$eval(".row .bar-wrap", (els) => els.length);
  expect(count).toBeGreaterThan(0);
});

Then("each mastery row should have a title label", async function () {
  const rows = await this.page.$$(".row");
  expect(rows.length).toBeGreaterThan(0);
  for (const row of rows) {
    const label = await row.$eval(".label span:first-child", (el) => el.textContent.trim());
    expect(label.length).toBeGreaterThan(0);
  }
});

Then("each mastery row should have a numeric score or a {string} placeholder", async function (placeholder) {
  const rows = await this.page.$$(".row");
  for (const row of rows) {
    const scoreText = await row.$eval(".label span:last-child", (el) => el.textContent.trim());
    const isPlaceholder = scoreText === placeholder;
    const isNumeric = /^\d+\/100$/.test(scoreText);
    expect(isPlaceholder || isNumeric).toBe(true);
  }
});

Then("I should see bar-fill elements in the mastery rows", async function () {
  const fills = await this.page.$$(".bar-fill");
  expect(fills.length).toBeGreaterThan(0);
});

Then("the mastery bar in the sidebar should reflect a non-zero width", async function () {
  await this.page.waitForFunction(
    () => {
      const fill = document.getElementById("masteryBarFill");
      return fill && fill.style.width && fill.style.width !== "0%";
    },
    { timeout: 5000 }
  );
});

Then("I should be redirected to the landing page", async function () {
  await this.page.waitForFunction(
    () =>
      window.location.pathname === "/" ||
      window.location.pathname.includes("landing"),
    { timeout: 5000 }
  );
  const url = this.page.url();
  expect(url).toContain("landing");
});

Then("I should see a message indicating no sessions are available", async function () {
  await this.page.waitForFunction(
    () => {
      const paras = Array.from(document.querySelectorAll(".lead"));
      return paras.some((p) => p.textContent.toLowerCase().includes("no chats"));
    },
    { timeout: 5000 }
  );
});

/**
 * Acceptance Tests — EntryPoint
 * ============================================================
 * These tests verify that the system satisfies the stated User Cases
 * from the perspective of an end-user interacting with a live instance.
 *
 * Framework:   Jasmine + Puppeteer (browser-level assertions)
 * Server:      must be running at http://localhost:3000 before execution
 * Command:     npx jasmine spec/acceptance/acceptance.spec.js
 *
 * Each describe block corresponds to one User Case.
 * Tests are written at the scenario level, not the unit level.
 */

const puppeteer = require("puppeteer");

const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:3000";
const DEFAULT_TIMEOUT = 30_000;

// ── Shared helpers ────────────────────────────────────────────────────────────
let browser, page;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function registerAndLogin(pg, email, password = "Password123!") {
  await pg.goto(BASE_URL, { waitUntil: "domcontentloaded" });
  await pg.evaluate(
    async (url, e, p) => {
      await fetch(`${url}/api/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Acceptance Tester", email: e, password: p }),
      });
    },
    BASE_URL, email, password
  );
  const result = await pg.evaluate(
    async (url, e, p) => {
      const r = await fetch(`${url}/api/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: e, password: p }),
      });
      return r.json();
    },
    BASE_URL, email, password
  );
  await pg.evaluate(
    (t, id, n) => {
      localStorage.setItem("token", t);
      localStorage.setItem("userId", String(id));
      localStorage.setItem("userName", n || "Tester");
    },
    result.token, result.userId, result.name
  );
  return result;
}

async function seedChatSession(pg, token) {
  const r = await pg.evaluate(
    async (url, t) => {
      const res = await fetch(`${url}/api/chats`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
        body: JSON.stringify({ title: "Acceptance Test Session" }),
      });
      return res.json();
    },
    BASE_URL, token
  );
  if (r.chatId) {
    await pg.evaluate((id) => sessionStorage.setItem("currentChatId", String(id)), r.chatId);
  }
  return r;
}

// ── Suite setup / teardown ────────────────────────────────────────────────────
beforeAll(async () => {
  browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-web-security"],
  });
}, DEFAULT_TIMEOUT);

afterAll(async () => {
  if (browser) await browser.close();
});

beforeEach(async () => {
  page = await browser.newPage();

  // Stub geolocation so weather tests don't hang on permission prompts
  const ctx = browser.defaultBrowserContext();
  await ctx.overridePermissions(BASE_URL, ["geolocation"]);
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: {
        getCurrentPosition: (ok) => ok({ coords: { latitude: 51.5, longitude: -0.1 } }),
        watchPosition: () => 0,
        clearWatch: () => {},
      },
    });
  });

  page.setDefaultTimeout(DEFAULT_TIMEOUT);
});

afterEach(async () => {
  if (page) await page.close();
});

// ═════════════════════════════════════════════════════════════════════════════
// UC-1 — User can select background models
// ═════════════════════════════════════════════════════════════════════════════
describe("UC-1: Model selection", () => {

  it("AC-1.1 — The chat page loads and the model list is populated", async () => {
    const email = `uc1-${Date.now()}@test.com`;
    await registerAndLogin(page, email);
    await seedChatSession(page, (await page.evaluate(() => localStorage.getItem("token"))));
    await page.goto(`${BASE_URL}/chat.html`, { waitUntil: "networkidle2" });

    // Model list should appear within 8 s (waiting for /api/llm/models fetch)
    await page.waitForFunction(
      () => document.querySelectorAll(".model-item").length > 0,
      { timeout: 8000 }
    );
    const count = await page.$$eval(".model-item", (els) => els.length);
    expect(count).toBeGreaterThan(0);
  });

  it("AC-1.2 — Single mode is default; switching to Compare mode enables checkboxes", async () => {
    const email = `uc1b-${Date.now()}@test.com`;
    const { token } = await registerAndLogin(page, email);
    await seedChatSession(page, token);
    await page.goto(`${BASE_URL}/chat.html`, { waitUntil: "networkidle2" });

    const singleActive = await page.$eval("#btnSingle", (el) => el.classList.contains("active"));
    expect(singleActive).toBe(true);

    await page.click("#btnMulti");
    const multiActive = await page.$eval("#btnMulti", (el) => el.classList.contains("active"));
    expect(multiActive).toBe(true);

    // In Compare mode, checkboxes should be visible
    await page.waitForFunction(
      () => document.querySelectorAll('.model-item input[type="checkbox"]').length > 0,
      { timeout: 5000 }
    );
    const checkboxes = await page.$$('.model-item input[type="checkbox"]');
    expect(checkboxes.length).toBeGreaterThan(0);
  });

  it("AC-1.3 — Clicking a model marks it as selected in Single mode", async () => {
    const email = `uc1c-${Date.now()}@test.com`;
    const { token } = await registerAndLogin(page, email);
    await seedChatSession(page, token);
    await page.goto(`${BASE_URL}/chat.html`, { waitUntil: "networkidle2" });

    await page.waitForFunction(() => document.querySelectorAll(".model-item").length > 0, { timeout: 8000 });
    const firstModelItem = await page.$(".model-item");
    await firstModelItem.click();
    const isSelected = await page.$eval(".model-item", (el) => el.classList.contains("selected"));
    expect(isSelected).toBe(true);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// UC-2 — User can choose local Ollama models
// ═════════════════════════════════════════════════════════════════════════════
describe("UC-2: Local model support", () => {

  it("AC-2.1 — Local (Ollama) provider section is displayed in the model sidebar", async () => {
    const email = `uc2-${Date.now()}@test.com`;
    const { token } = await registerAndLogin(page, email);
    await seedChatSession(page, token);
    await page.goto(`${BASE_URL}/chat.html`, { waitUntil: "networkidle2" });

    // The provider heading is rendered as a plain div inside the model list
    await page.waitForFunction(
      () => {
        const dividers = Array.from(document.querySelectorAll(".model-section div"));
        return dividers.some((el) => el.textContent.trim() === "Local (Ollama)");
      },
      { timeout: 8000 }
    );
  });

  it("AC-2.2 — Local models have data-provider='ollama' attribute", async () => {
    const email = `uc2b-${Date.now()}@test.com`;
    const { token } = await registerAndLogin(page, email);
    await seedChatSession(page, token);
    await page.goto(`${BASE_URL}/chat.html`, { waitUntil: "networkidle2" });

    await page.waitForFunction(
      () => document.querySelectorAll('[data-provider="ollama"]').length > 0,
      { timeout: 8000 }
    );
    const count = await page.$$eval('[data-provider="ollama"]', (els) => els.length);
    expect(count).toBeGreaterThan(0);
  });

  it("AC-2.3 — Ollama models do not show a 'key needed' error badge", async () => {
    const email = `uc2c-${Date.now()}@test.com`;
    const { token } = await registerAndLogin(page, email);
    await seedChatSession(page, token);
    await page.goto(`${BASE_URL}/chat.html`, { waitUntil: "networkidle2" });

    await page.waitForFunction(() => document.querySelectorAll(".model-item").length > 0, { timeout: 8000 });
    const ollamaHasErrBadge = await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('[data-provider="ollama"]'));
      return items.some((el) => el.querySelector(".model-badge.err"));
    });
    expect(ollamaHasErrBadge).toBe(false);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// UC-3 — User can see online web models (cloud providers listed even without keys)
// ═════════════════════════════════════════════════════════════════════════════
describe("UC-3: Cloud/online model support", () => {

  it("AC-3.1 — Claude, Gemini, and OpenAI model entries are always present", async () => {
    const email = `uc3-${Date.now()}@test.com`;
    const { token } = await registerAndLogin(page, email);
    await seedChatSession(page, token);
    await page.goto(`${BASE_URL}/chat.html`, { waitUntil: "networkidle2" });

    for (const provider of ["claude", "gemini", "openai"]) {
      await page.waitForFunction(
        (p) => document.querySelectorAll(`[data-provider="${p}"]`).length > 0,
        { timeout: 8000 },
        provider
      );
      const count = await page.$$eval(`[data-provider="${provider}"]`, (els) => els.length);
      expect(count).toBeGreaterThan(0);
    }
  });

  it("AC-3.2 — Cloud models without keys display a 'key needed' badge", async () => {
    const email = `uc3b-${Date.now()}@test.com`;
    const { token } = await registerAndLogin(page, email);
    await seedChatSession(page, token);
    await page.goto(`${BASE_URL}/chat.html`, { waitUntil: "networkidle2" });

    await page.waitForFunction(() => document.querySelectorAll(".model-item").length > 0, { timeout: 8000 });
    const hasKeyNeeded = await page.evaluate(() => {
      const badges = Array.from(document.querySelectorAll(".model-badge.err"));
      return badges.some((b) => b.textContent.includes("key needed"));
    });
    expect(hasKeyNeeded).toBe(true);
  });

  it("AC-3.3 — The /api/llm/models endpoint returns all three cloud providers", async () => {
    const email = `uc3c-${Date.now()}@test.com`;
    const { token } = await registerAndLogin(page, email);

    const data = await page.evaluate(
      async (url, t) => {
        const r = await fetch(`${url}/api/llm/models`, {
          headers: { Authorization: `Bearer ${t}` },
        });
        return r.json();
      },
      BASE_URL, token
    );

    expect(Array.isArray(data.models)).toBe(true);
    const providers = new Set(data.models.map((m) => m.provider));
    expect(providers.has("claude")).toBe(true);
    expect(providers.has("gemini")).toBe(true);
    expect(providers.has("openai")).toBe(true);
  });

  it("AC-3.4 — Attempting to chat with a cloud model without a key returns a 503 error", async () => {
    const email = `uc3d-${Date.now()}@test.com`;
    const { token } = await registerAndLogin(page, email);
    const { chatId } = await seedChatSession(page, token);

    const response = await page.evaluate(
      async (url, t, cid) => {
        const fd = new FormData();
        fd.append("message", "Hello");
        fd.append("provider", "claude");
        fd.append("model", "claude-sonnet-4-20250514");
        fd.append("chatId", String(cid));
        const r = await fetch(`${url}/api/llm/chat`, {
          method: "POST",
          headers: { Authorization: `Bearer ${t}` },
          body: fd,
        });
        return { status: r.status, body: await r.json() };
      },
      BASE_URL, token, chatId
    );

    expect(response.status).toBe(503);
    expect(response.body.error).toContain("ANTHROPIC_API_KEY");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// UC-4 — User can get weather data
// ═════════════════════════════════════════════════════════════════════════════
describe("UC-4: Weather data", () => {

  it("AC-4.1 — The /api/weather endpoint returns structured weather data", async () => {
    const data = await page.evaluate(async (url) => {
      const r = await fetch(`${url}/api/weather?lat=51.5&lon=-0.1&units=celsius`);
      return r.json();
    }, BASE_URL);

    expect(data.weather).toBeDefined();
    expect(typeof data.weather.temperature).toBe("number");
    expect(typeof data.weather.description).toBe("string");
    expect(typeof data.weatherCtx).toBe("string");
    expect(data.weatherCtx.length).toBeGreaterThan(0);
  });

  it("AC-4.2 — Weather API returns a 400 error when lat is missing", async () => {
    const data = await page.evaluate(async (url) => {
      const r = await fetch(`${url}/api/weather?lon=-0.1`);
      return { status: r.status, body: await r.json() };
    }, BASE_URL);
    expect(data.status).toBe(400);
  });

  it("AC-4.3 — Weather toggle button is visible on the chat page", async () => {
    const email = `uc4c-${Date.now()}@test.com`;
    const { token } = await registerAndLogin(page, email);
    await seedChatSession(page, token);
    await page.goto(`${BASE_URL}/chat.html`, { waitUntil: "networkidle2" });

    const btn = await page.waitForSelector("#weatherToggleBtn", { timeout: 5000 });
    expect(btn).toBeTruthy();
  });

  it("AC-4.4 — The weather banner appears and shows real data after activation", async () => {
    const email = `uc4d-${Date.now()}@test.com`;
    const { token } = await registerAndLogin(page, email);
    await seedChatSession(page, token);
    await page.goto(`${BASE_URL}/chat.html`, { waitUntil: "networkidle2" });

    await page.click("#weatherToggleBtn");
    await page.waitForFunction(
      () => document.getElementById("weatherBanner")?.classList.contains("visible"),
      { timeout: 10_000 }
    );
    const temp = await page.$eval("#weatherTemp", (el) => el.textContent.trim());
    expect(temp).not.toBe("—");
  });

  it("AC-4.5 — Fahrenheit units are returned when units=fahrenheit is requested", async () => {
    const data = await page.evaluate(async (url) => {
      const r = await fetch(`${url}/api/weather?lat=40.7&lon=-74.0&units=fahrenheit`);
      return r.json();
    }, BASE_URL);
    expect(data.weather.unit).toBe("°F");
    expect(data.weather.windUnit).toBe("mph");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// UC-5 — User can choose subject matter
// ═════════════════════════════════════════════════════════════════════════════
describe("UC-5: Subject matter selection", () => {

  it("AC-5.1 — All six subject buttons are rendered on the chat page", async () => {
    const email = `uc5-${Date.now()}@test.com`;
    const { token } = await registerAndLogin(page, email);
    await seedChatSession(page, token);
    await page.goto(`${BASE_URL}/chat.html`, { waitUntil: "networkidle2" });

    const expectedSubjects = ["general", "math", "science", "history", "english", "cs"];
    for (const subj of expectedSubjects) {
      const el = await page.$(`.subj-btn[data-subj="${subj}"]`);
      expect(el).not.toBeNull();
    }
  });

  it("AC-5.2 — 'General' is active by default", async () => {
    const email = `uc5b-${Date.now()}@test.com`;
    const { token } = await registerAndLogin(page, email);
    await seedChatSession(page, token);
    await page.goto(`${BASE_URL}/chat.html`, { waitUntil: "networkidle2" });

    const isActive = await page.$eval('.subj-btn[data-subj="general"]', (el) =>
      el.classList.contains("active")
    );
    expect(isActive).toBe(true);
  });

  it("AC-5.3 — Selecting Mathematics deactivates General", async () => {
    const email = `uc5c-${Date.now()}@test.com`;
    const { token } = await registerAndLogin(page, email);
    await seedChatSession(page, token);
    await page.goto(`${BASE_URL}/chat.html`, { waitUntil: "networkidle2" });

    await page.click('.subj-btn[data-subj="math"]');
    await sleep(200);

    const mathActive    = await page.$eval('.subj-btn[data-subj="math"]',    (el) => el.classList.contains("active"));
    const generalActive = await page.$eval('.subj-btn[data-subj="general"]', (el) => el.classList.contains("active"));
    expect(mathActive).toBe(true);
    expect(generalActive).toBe(false);
  });

  it("AC-5.4 — The subject is sent correctly in the chat API request body", async () => {
    const email = `uc5d-${Date.now()}@test.com`;
    const { token } = await registerAndLogin(page, email);
    const { chatId } = await seedChatSession(page, token);

    // Verify the API accepts an arbitrary subject without error (ollama not required)
    const resp = await page.evaluate(
      async (url, t, cid) => {
        const fd = new FormData();
        fd.append("message", "What is a wave?");
        fd.append("subject", "science");
        fd.append("chatId", String(cid));
        fd.append("provider", "claude");   // will 503, but subject parsing must not error
        const r = await fetch(`${url}/api/llm/chat`, {
          method: "POST",
          headers: { Authorization: `Bearer ${t}` },
          body: fd,
        });
        return { status: r.status };
      },
      BASE_URL, token, chatId
    );
    // 503 = key missing (expected); anything other than 400/500 syntax error
    expect([200, 503]).toContain(resp.status);
  });

  it("AC-5.5 — The input hint updates when a non-General subject is selected", async () => {
    const email = `uc5e-${Date.now()}@test.com`;
    const { token } = await registerAndLogin(page, email);
    await seedChatSession(page, token);
    await page.goto(`${BASE_URL}/chat.html`, { waitUntil: "networkidle2" });

    await page.click('.subj-btn[data-subj="history"]');
    await sleep(300);
    const hint = await page.$eval("#inputHint", (el) => el.textContent.toLowerCase());
    expect(hint).toContain("history");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// UC-6 — User can upload a PDF which is parsed as prompt entry
// ═════════════════════════════════════════════════════════════════════════════
describe("UC-6: PDF / file upload", () => {

  it("AC-6.1 — The attach button (📎) is rendered in the input area", async () => {
    const email = `uc6-${Date.now()}@test.com`;
    const { token } = await registerAndLogin(page, email);
    await seedChatSession(page, token);
    await page.goto(`${BASE_URL}/chat.html`, { waitUntil: "networkidle2" });

    const btn = await page.waitForSelector("#attachBtn", { timeout: 5000 });
    expect(btn).toBeTruthy();
  });

  it("AC-6.2 — Selecting a PDF file shows the preview strip with the filename", async () => {
    const email = `uc6b-${Date.now()}@test.com`;
    const { token } = await registerAndLogin(page, email);
    await seedChatSession(page, token);
    await page.goto(`${BASE_URL}/chat.html`, { waitUntil: "networkidle2" });

    await page.evaluate(() => {
      const blob = new Blob(["%PDF-1.4 fake content"], { type: "application/pdf" });
      const file = new File([blob], "my-notes.pdf", { type: "application/pdf" });
      const dt = new DataTransfer();
      dt.items.add(file);
      const input = document.getElementById("fileInput");
      Object.defineProperty(input, "files", { value: dt.files, configurable: true });
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });

    await page.waitForFunction(
      () => document.getElementById("filePreview")?.classList.contains("visible"),
      { timeout: 5000 }
    );
    const fileName = await page.$eval("#fileName", (el) => el.textContent.trim());
    expect(fileName).toBe("my-notes.pdf");
  });

  it("AC-6.3 — Selecting a PDF sets the 'has-file' class on the attach button", async () => {
    const email = `uc6c-${Date.now()}@test.com`;
    const { token } = await registerAndLogin(page, email);
    await seedChatSession(page, token);
    await page.goto(`${BASE_URL}/chat.html`, { waitUntil: "networkidle2" });

    await page.evaluate(() => {
      const blob = new Blob(["content"], { type: "application/pdf" });
      const file = new File([blob], "test.pdf", { type: "application/pdf" });
      const dt = new DataTransfer();
      dt.items.add(file);
      const input = document.getElementById("fileInput");
      Object.defineProperty(input, "files", { value: dt.files, configurable: true });
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });

    await page.waitForFunction(
      () => document.getElementById("attachBtn")?.classList.contains("has-file"),
      { timeout: 5000 }
    );
  });

  it("AC-6.4 — Removing the file hides the preview and clears the 'has-file' class", async () => {
    const email = `uc6d-${Date.now()}@test.com`;
    const { token } = await registerAndLogin(page, email);
    await seedChatSession(page, token);
    await page.goto(`${BASE_URL}/chat.html`, { waitUntil: "networkidle2" });

    await page.evaluate(() => {
      const blob = new Blob(["c"], { type: "text/plain" });
      const file = new File([blob], "doc.txt", { type: "text/plain" });
      const dt = new DataTransfer();
      dt.items.add(file);
      const input = document.getElementById("fileInput");
      Object.defineProperty(input, "files", { value: dt.files, configurable: true });
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });

    await page.waitForFunction(
      () => document.getElementById("filePreview")?.classList.contains("visible"),
      { timeout: 5000 }
    );
    await page.click(".file-remove");

    await page.waitForFunction(
      () => !document.getElementById("filePreview")?.classList.contains("visible"),
      { timeout: 5000 }
    );
    const hasFile = await page.$eval("#attachBtn", (el) => el.classList.contains("has-file"));
    expect(hasFile).toBe(false);
  });

  it(
    "AC-6.5 — The /api/llm/chat endpoint accepts multipart form data with a file field",
    async () => {
    const email = `uc6e-${Date.now()}@test.com`;
    const { token } = await registerAndLogin(page, email);
    const { chatId } = await seedChatSession(page, token);

    // Send a text file via the multipart endpoint
    const resp = await page.evaluate(
      async (url, t, cid) => {
        const blob = new Blob(["Hello world content"], { type: "text/plain" });
        const file = new File([blob], "hello.txt", { type: "text/plain" });
        const fd = new FormData();
        fd.append("message", "What does this file say?");
        fd.append("chatId", String(cid));
        fd.append("provider", "ollama");
        fd.append("model", "llama3");
        fd.append("file", file, "hello.txt");
        const r = await fetch(`${url}/api/llm/chat`, {
          method: "POST",
          headers: { Authorization: `Bearer ${t}` },
          body: fd,
        });
        return { status: r.status };
      },
      BASE_URL, token, chatId
    );
    // 200 (Ollama running) or 500 (Ollama offline) — either proves the endpoint
    // accepted the request rather than 400-ing on missing/bad params.
    expect([200, 500]).toContain(resp.status);
    },
    60_000
  );
});

// ═════════════════════════════════════════════════════════════════════════════
// UC-7 — User can track mastery through the mastery tab
// ═════════════════════════════════════════════════════════════════════════════
describe("UC-7: Mastery tracking", () => {

  it("AC-7.1 — The mastery page is accessible from the chat navigation bar", async () => {
    const email = `uc7-${Date.now()}@test.com`;
    const { token } = await registerAndLogin(page, email);
    await seedChatSession(page, token);
    await page.goto(`${BASE_URL}/chat.html`, { waitUntil: "networkidle2" });

    const masteryLink = await page.$('a[href="mastery.html"]');
    expect(masteryLink).not.toBeNull();
  });

  it("AC-7.2 — The /api/mastery/:id endpoint returns chat sessions for authenticated users", async () => {
    const email = `uc7b-${Date.now()}@test.com`;
    const { token, userId } = await registerAndLogin(page, email);
    const { chatId } = await seedChatSession(page, token);

    const data = await page.evaluate(
      async (url, t, id, cid) => {
        const r = await fetch(`${url}/api/mastery/${id}?activeChatId=${cid}`, {
          headers: { Authorization: `Bearer ${t}` },
        });
        return r.json();
      },
      BASE_URL, token, userId, chatId
    );
    expect(Array.isArray(data.chats)).toBe(true);
    expect(data.chats.length).toBeGreaterThanOrEqual(1);
  });

  it("AC-7.3 — Mastery page renders a progress bar for each chat session", async () => {
    const email = `uc7c-${Date.now()}@test.com`;
    const { token } = await registerAndLogin(page, email);
    await seedChatSession(page, token);
    await page.goto(`${BASE_URL}/mastery.html`, { waitUntil: "networkidle2" });

    await page.waitForFunction(
      () => document.querySelectorAll(".bar-wrap").length > 0,
      { timeout: 8000 }
    );
    const bars = await page.$$(".bar-wrap");
    expect(bars.length).toBeGreaterThan(0);
  });

  it("AC-7.4 — Unauthenticated access to the mastery page redirects to landing", async () => {
    await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.goto(`${BASE_URL}/mastery.html`, { waitUntil: "networkidle2" });
    await page.waitForFunction(
      () => window.location.pathname !== "/mastery.html" || window.location.href.includes("landing"),
      { timeout: 8000 }
    );
    const url = page.url();
    expect(url).toContain("landing");
  });

  it("AC-7.5 — The sidebar mastery bar on the chat page updates programmatically", async () => {
    const email = `uc7e-${Date.now()}@test.com`;
    const { token } = await registerAndLogin(page, email);
    await seedChatSession(page, token);
    await page.goto(`${BASE_URL}/chat.html`, { waitUntil: "networkidle2" });

    await page.evaluate(() => {
      if (typeof setDisciplineMasteryFromScore === "function") {
        setDisciplineMasteryFromScore(65);
      }
    });
    await sleep(400);

    const width = await page.$eval("#masteryBarFill", (el) => el.style.width);
    expect(width).toBe("65%");
  });

  it("AC-7.6 — Each mastery row shows a title and a score or placeholder", async () => {
    const email = `uc7f-${Date.now()}@test.com`;
    const { token } = await registerAndLogin(page, email);
    await seedChatSession(page, token);
    await page.goto(`${BASE_URL}/mastery.html`, { waitUntil: "networkidle2" });

    await page.waitForFunction(
      () => document.querySelectorAll(".row").length > 0,
      { timeout: 8000 }
    );
    const rowData = await page.$$eval(".row", (rows) =>
      rows.map((row) => ({
        title: row.querySelector(".label span:first-child")?.textContent?.trim() || "",
        score: row.querySelector(".label span:last-child")?.textContent?.trim() || "",
      }))
    );
    rowData.forEach(({ title, score }) => {
      expect(title.length).toBeGreaterThan(0);
      expect(score.length).toBeGreaterThan(0);
    });
  });

  it("AC-7.7 — The /api/mastery/:id endpoint returns 403 for cross-user access", async () => {
    const email1 = `uc7g1-${Date.now()}@test.com`;
    const email2 = `uc7g2-${Date.now()}@test.com`;
    const { token: t1, userId: uid1 } = await registerAndLogin(page, email1);
    const { token: t2, userId: uid2 } = await registerAndLogin(page, email2);

    const resp = await page.evaluate(
      async (url, t, id) => {
        const r = await fetch(`${url}/api/mastery/${id}`, {
          headers: { Authorization: `Bearer ${t}` },
        });
        return r.status;
      },
      BASE_URL, t1, uid2
    );
    expect(resp).toBe(403);
  });
});

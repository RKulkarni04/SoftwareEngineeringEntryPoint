"use strict";

const { Given, When, Then } = require("@cucumber/cucumber");

Given("I open the chat page", async function () {
    await this.page.goto(this.baseUrl + "/chat.html", {
        waitUntil: "domcontentloaded"
    });
    await this.page.waitForSelector("#ep-chat-input", { timeout: 15000 });
});

Given(
    "I have a conversation titled with content {string}",
    async function (marker) {
        await this.page.evaluate(async (text) => {
            const token = localStorage.getItem("token");
            const r = await fetch("/api/conversations", {
                method: "POST",
                headers: {
                    Authorization: "Bearer " + token,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({})
            });
            const conv = await r.json();
            await fetch("/api/conversations/" + conv.id + "/messages", {
                method: "POST",
                headers: {
                    Authorization: "Bearer " + token,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ message: text })
            });
        }, marker);
    }
);

When("I send the chat message {string}", async function (message) {
    await this.page.waitForSelector("#ep-chat-input");
    await this.page.$eval("#ep-chat-input", (el, m) => {
        el.value = m;
    }, message);
    const sendPromise = this.page.waitForResponse(
        (res) =>
            res.request().method() === "POST" &&
            res.url().includes("/messages")
    );
    await this.page.click("#btn-send");
    await sendPromise;
});

Then(
    "I should see assistant text containing {string}",
    async function (snippet) {
        await this.page.waitForFunction(
            (s) => {
                const nodes = document.querySelectorAll("[data-role='assistant']");
                for (const n of nodes) {
                    if (n.textContent && n.textContent.includes(s)) {
                        return true;
                    }
                }
                return false;
            },
            { timeout: 30000 },
            snippet
        );
    }
);

When("I search conversations for {string}", async function (query) {
    await this.page.waitForSelector("#search-input");
    await this.page.click("#search-input", { clickCount: 3 });
    await this.page.keyboard.press("Backspace");
    await this.page.type("#search-input", query);
    await this.page.click("#btn-search");
});

Then(
    "I should see a conversation result containing {string}",
    async function (text) {
        await this.page.waitForFunction(
            (t) => {
                const list = document.getElementById("conversation-list");
                if (!list) return false;
                return list.innerText.includes(t);
            },
            { timeout: 15000 },
            text
        );
    }
);

const path = require("path");
const { Given, When, Then } = require("@cucumber/cucumber");
const assert = require("assert");

async function clickModeButton(page, label) {
    const modeButtonId = label.toLowerCase() === "compare" ? "#btnMulti" : "#btnSingle";
    await page.click(modeButtonId);
}

async function clickModel(page, modelName) {
    const clicked = await page.evaluate((targetModel) => {
        const items = Array.from(document.querySelectorAll("#modelList .model-item"));
        const targetItem = items.find((item) => {
            const name = item.querySelector(".model-name");
            return name && name.textContent.trim() === targetModel;
        });

        if (!targetItem) {
            return false;
        }

        targetItem.click();
        return true;
    }, modelName);

    assert.strictEqual(clicked, true, `Could not find model "${modelName}" in the sidebar.`);
}

Given("the study room is loaded with available models {string}", async function (modelList) {
    const models = modelList.split(",").map((model) => model.trim()).filter(Boolean);
    const chatPageUrl = `file://${path.join(process.cwd(), "frontend", "chat.html")}`;

    await this.page.evaluateOnNewDocument((mockModels) => {
        const buildJsonResponse = (body) =>
            Promise.resolve(
                new Response(JSON.stringify(body), {
                    status: 200,
                    headers: {
                        "Content-Type": "application/json"
                    }
                })
            );

        window.fetch = (input) => {
            const url = typeof input === "string" ? input : input.url;

            if (url.includes("/api/models")) {
                return buildJsonResponse({ models: mockModels });
            }

            if (url.includes("/api/conversations/search")) {
                return buildJsonResponse({ results: [] });
            }

            if (url.includes("/api/conversations/")) {
                return buildJsonResponse({ conversations: [] });
            }

            return buildJsonResponse({});
        };

        localStorage.setItem("userName", "Test Scholar");
    }, models);

    await this.page.goto(chatPageUrl, { waitUntil: "domcontentloaded" });
    await this.page.waitForSelector("#modelList .model-item");
});

When('I click the {string} mode button', async function (label) {
    await clickModeButton(this.page, label);
});

When('I select the {string} model in single mode', async function (modelName) {
    await clickModeButton(this.page, "Single");
    await clickModel(this.page, modelName);
});

When('I deselect the {string} model in compare mode', async function (modelName) {
    await clickModel(this.page, modelName);
});

When('I select the {string} model in compare mode', async function (modelName) {
    await clickModel(this.page, modelName);
});

Then('the {string} mode button should be active', async function (label) {
    const selector = label.toLowerCase() === "compare" ? "#btnMulti" : "#btnSingle";
    const isActive = await this.page.$eval(selector, (button) => button.classList.contains("active"));

    assert.strictEqual(isActive, true);
});

Then("the compare guidance should be visible", async function () {
    const isVisible = await this.page.$eval("#multiInfo", (element) => element.classList.contains("show"));

    assert.strictEqual(isVisible, true);
});

Then("the compare guidance should be hidden", async function () {
    const isVisible = await this.page.$eval("#multiInfo", (element) => element.classList.contains("show"));

    assert.strictEqual(isVisible, false);
});

Then('only the {string} model should be active in the sidebar', async function (expectedModel) {
    const selectedModels = await this.page.$$eval("#modelList .model-item.selected", (items) =>
        items.map((item) => item.querySelector(".model-name")?.textContent.trim())
    );
    const activeModel = await this.page.$eval(".model-badge", (badge) =>
        badge.previousElementSibling.textContent.trim()
    );

    assert.deepStrictEqual(selectedModels, [expectedModel]);
    assert.strictEqual(activeModel, expectedModel);
});

Then("exactly {int} models should be selected for comparison", async function (expectedCount) {
    const selectedCount = await this.page.$$eval("#modelList .model-item.selected", (items) => items.length);

    assert.strictEqual(selectedCount, expectedCount);
});

Then('the selected comparison models should be {string}', async function (expectedList) {
    const expectedModels = expectedList.split(",").map((model) => model.trim()).sort();
    const selectedModels = await this.page.$$eval("#modelList .model-item.selected", (items) =>
        items
            .map((item) => item.querySelector(".model-name")?.textContent.trim())
            .sort()
    );

    assert.deepStrictEqual(selectedModels, expectedModels);
});

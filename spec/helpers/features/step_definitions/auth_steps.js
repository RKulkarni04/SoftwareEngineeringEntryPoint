"use strict";

const assert = require("assert");
const { Given, When, Then } = require("@cucumber/cucumber");

Given("I am on the login page", async function () {
    await this.page.goto(this.baseUrl + "/login.html", {
        waitUntil: "networkidle0"
    });
});

Given(
    "a registered user {string} with password {string}",
    async function (email, password) {
        await this.page.goto(this.baseUrl + "/login.html", {
            waitUntil: "domcontentloaded"
        });
        await this.page.evaluate(
            async (em, pw) => {
                await fetch("/api/register", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        name: "LockUser",
                        email: em,
                        password: pw
                    })
                });
            },
            email,
            password
        );
    }
);

When("I enter {string} and {string}", async function (email, password) {
    await this.page.waitForSelector("#email");
    await this.page.click("#email", { clickCount: 3 });
    await this.page.keyboard.press("Backspace");
    await this.page.type("#email", email, { delay: 5 });
    await this.page.click("#password", { clickCount: 3 });
    await this.page.keyboard.press("Backspace");
    await this.page.type("#password", password, { delay: 5 });
});

When("I click the login button", async function () {
    await this.page.click("#login-button");
});

Then("I should be redirected to the dashboard", async function () {
    await this.page.waitForFunction(
        () => /dashboard\.html/i.test(window.location.href),
        { timeout: 20000 }
    );
});

Then("I should see an error message", async function () {
    await this.page.waitForSelector("#errorBanner", { visible: true, timeout: 15000 });
});

Then(
    "I should see an error message containing {string}",
    async function (text) {
        await this.page.waitForSelector("#errorBanner", {
            visible: true,
            timeout: 15000
        });
        const msg = await this.page.$eval("#errorBanner", (el) =>
            el.textContent.trim()
        );
        assert.ok(
            msg.includes(text),
            `Expected error to include "${text}", got "${msg}"`
        );
    }
);

When(
    "I fail to login {int} times with email {string} and wrong password {string}",
    async function (count, email, wrongPassword) {
        assert.strictEqual(count, 5);
        for (let i = 0; i < 5; i++) {
            await this.page.goto(this.baseUrl + "/login.html", {
                waitUntil: "networkidle0"
            });
            await this.page.type("#email", email);
            await this.page.type("#password", wrongPassword);
            await this.page.click("#login-button");
            await this.page.waitForSelector("#errorBanner", {
                visible: true,
                timeout: 15000
            });
        }
        await this.page.goto(this.baseUrl + "/login.html", {
            waitUntil: "networkidle0"
        });
        await this.page.type("#email", email);
        await this.page.type("#password", wrongPassword);
        await this.page.click("#login-button");
    }
);

Then("I should have a valid session token in storage", async function () {
    await this.page.waitForFunction(
        () => /dashboard\.html/i.test(window.location.href),
        { timeout: 20000 }
    );
    const token = await this.page.evaluate(() =>
        localStorage.getItem("token")
    );
    assert.ok(token && token.length > 10, "Expected JWT in localStorage");
});

Given("I am on the signup page", async function () {
    await this.page.goto(this.baseUrl + "/signup.html", {
        waitUntil: "networkidle0"
    });
});

When("I sign up as a new unique user", async function () {
    const id = Date.now();
    const email = `newuser_${id}@test.edu`;
    await this.page.waitForSelector("#signup-email");
    await this.page.type("#signup-name", "New User");
    await this.page.type("#signup-email", email);
    await this.page.type("#signup-password", "Password123");
    await this.page.click("#signup-submit");
});

When(
    "I enter signup name {string}, email {string}, password {string}",
    async function (name, email, password) {
        await this.page.waitForSelector("#signup-email");
        await this.page.type("#signup-name", name);
        await this.page.type("#signup-email", email);
        await this.page.type("#signup-password", password);
    }
);

When("I click the signup submit button", async function () {
    await this.page.click("#signup-submit");
});

Then("I should see signup error {string}", async function (text) {
    await this.page.waitForSelector("#messageBox", { visible: true, timeout: 15000 });
    const msg = await this.page.$eval("#messageBox", (el) =>
        el.textContent.trim()
    );
    assert.ok(
        msg.includes(text),
        `Expected signup error to include "${text}", got "${msg}"`
    );
});

Given(
    "I am logged in as {string} with password {string}",
    async function (email, password) {
        await this.page.goto(this.baseUrl + "/login.html", {
            waitUntil: "networkidle0"
        });
        await this.page.type("#email", email);
        await this.page.type("#password", password);
        await this.page.click("#login-button");
        await this.page.waitForFunction(
            () => /dashboard\.html/i.test(window.location.href),
            { timeout: 20000 }
        );
    }
);

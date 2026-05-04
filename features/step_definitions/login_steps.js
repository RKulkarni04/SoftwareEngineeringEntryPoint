const { Given, When, Then } = require("@cucumber/cucumber");

const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:3000";

Given("I am on the login page", async function () {
  await this.page.goto(`${BASE_URL}/login`);
});

When('I enter {string} and {string}', async function (username, password) {
  await this.page.type('#username', username);
  await this.page.type('#password', password);
});

When('I click the login button', async function () {
  await this.page.click('#login-button');
});

Then("I should be redirected to the dashboard", async function () {
  await this.page.waitForFunction(
    () =>
      window.location.pathname.includes("dashboard") ||
      window.location.href.toLowerCase().includes("dashboard"),
    { timeout: 15_000 }
  );
});

Then('I should see an error message', async function () {
  await this.page.waitForSelector('.error-message');
});
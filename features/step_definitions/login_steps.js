const { Given, When, Then } = require('@cucumber/cucumber');

Given('I am on the login page', async function () {
  await this.page.goto('http://localhost:3000/login');
});

When('I enter {string} and {string}', async function (username, password) {
  await this.page.type('#username', username);
  await this.page.type('#password', password);
});

When('I click the login button', async function () {
  await this.page.click('#login-button');
});

Then('I should be redirected to the dashboard', async function () {
  await this.page.waitForURL('**/dashboard');
});

Then('I should see an error message', async function () {
  await this.page.waitForSelector('.error-message');
});
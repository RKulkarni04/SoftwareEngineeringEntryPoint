const puppeteer = require("puppeteer");
const { Before, After } = require("@cucumber/cucumber");

function getChromeExecutablePath() {
    return process.env.PUPPETEER_EXECUTABLE_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
}

Before(async function () {
    this.browser = await puppeteer.launch({
        headless: true,
        executablePath: getChromeExecutablePath()
    });
    this.page = await this.browser.newPage();
});

After(async function () {
    if (this.browser) {
        await this.browser.close();
    }
});

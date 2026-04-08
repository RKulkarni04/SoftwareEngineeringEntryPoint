"use strict";

const { setWorldConstructor, setDefaultTimeout } = require("@cucumber/cucumber");
const puppeteer = require("puppeteer");

class EntryPointWorld {
    constructor() {
        this.baseUrl = process.env.BASE_URL || "http://127.0.0.1:3000";
        this.browser = null;
        this.page = null;
    }

    async openBrowser() {
        this.browser = await puppeteer.launch({
            headless: process.env.HEADLESS !== "false",
            args: ["--no-sandbox", "--disable-setuid-sandbox"]
        });
        this.page = await this.browser.newPage();
        await this.page.setViewport({ width: 1280, height: 800 });
        this.page.setDefaultNavigationTimeout(60000);
        this.page.setDefaultTimeout(30000);
    }

    async closeBrowser() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
            this.page = null;
        }
    }
}

setDefaultTimeout(120 * 1000);
setWorldConstructor(EntryPointWorld);

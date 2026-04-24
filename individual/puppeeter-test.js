// Puppeteer automated browser test
// Records interaction with the multi-LLM query page

const puppeteer = require("puppeteer");

async function runTest() {
    console.log("Starting Puppeteer test...");

    // Launch browser visibly so it can be screen recorded for demo
    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();

    // Set window size
    await page.setViewport({ width: 1280, height: 800 });

    // Navigate to the app
    console.log("Navigating to app...");
    await page.goto("http://localhost:3001");
    await page.waitForSelector('#promptInput');

    // Type a question
    console.log("Typing question...");
    await page.type('#promptInput', 'What is machine learning? Explain simply.');
    await new Promise(r => setTimeout(r, 500));

    // Select Llama3 (already checked by default)
    console.log("Selecting Llama3...");
    const llama3Checked = await page.$eval('#llama3', el => el.checked);
    if (!llama3Checked) {
        await page.click('#llama3');
    }

    // Take screenshot before sending
    await page.screenshot({ path: 'individual/screenshots/before-send.png' });
    console.log("Screenshot saved: before-send.png");

    // Click send button
    console.log("Clicking Send...");
    await page.click('button');

    // Wait for response to appear
    console.log("Waiting for response...");
    await page.waitForSelector('#llama3Response:not(.hidden)', { timeout: 60000 });

    // Take screenshot after response
    await page.screenshot({ path: 'individual/screenshots/after-response.png' });
    console.log("Screenshot saved: after-response.png");

    console.log("Puppeteer test completed!");
    await browser.close();
}

runTest().catch(console.error);
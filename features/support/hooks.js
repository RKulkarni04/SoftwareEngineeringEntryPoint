"use strict";

const { BeforeAll, AfterAll, Before, After } = require("@cucumber/cucumber");
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const http = require("http");

const projectRoot = path.join(__dirname, "..", "..");
const testDbPath = path.join(projectRoot, "test-e2e.db");
const testPort = process.env.TEST_PORT || "3099";
const baseUrl = `http://127.0.0.1:${testPort}`;

let serverProcess;

function waitForServer(url, maxAttempts = 40) {
    return new Promise((resolve, reject) => {
        let n = 0;
        function tryOnce() {
            const req = http.get(url, (res) => {
                res.resume();
                resolve();
            });
            req.on("error", () => {
                n += 1;
                if (n >= maxAttempts) {
                    return reject(new Error("Server failed to start at " + url));
                }
                setTimeout(tryOnce, 250);
            });
        }
        tryOnce();
    });
}

function postJson(hostname, port, pathname, body) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify(body);
        const opts = {
            hostname,
            port,
            path: pathname,
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Content-Length": Buffer.byteLength(data)
            }
        };
        const req = http.request(opts, (res) => {
            let b = "";
            res.on("data", (c) => {
                b += c;
            });
            res.on("end", () => {
                let parsed = {};
                try {
                    parsed = b ? JSON.parse(b) : {};
                } catch {
                    parsed = {};
                }
                resolve({ status: res.statusCode, body: parsed });
            });
        });
        req.on("error", reject);
        req.write(data);
        req.end();
    });
}

BeforeAll({ timeout: 120000 }, async function () {
    process.env.BASE_URL = baseUrl;
    process.env.DATABASE_PATH = testDbPath;
    process.env.MOCK_LLM = "true";
    process.env.PORT = testPort;

    if (fs.existsSync(testDbPath)) {
        fs.unlinkSync(testDbPath);
    }

    serverProcess = spawn(process.execPath, [path.join(projectRoot, "server.js")], {
        cwd: projectRoot,
        env: {
            ...process.env,
            DATABASE_PATH: testDbPath,
            MOCK_LLM: "true",
            PORT: testPort,
            NODE_ENV: "test"
        },
        stdio: "pipe"
    });

    serverProcess.stderr.on("data", (d) => {
        if (process.env.CUCUMBER_DEBUG) {
            process.stderr.write(d);
        }
    });

    await waitForServer(baseUrl + "/");

    await postJson("127.0.0.1", testPort, "/api/register", {
        name: "E2E User",
        email: "testuser@test.edu",
        password: "password123"
    });

    await postJson("127.0.0.1", testPort, "/api/register", {
        name: "Existing",
        email: "existing@test.edu",
        password: "Password123"
    });
});

AfterAll(async function () {
    if (serverProcess) {
        serverProcess.kill("SIGTERM");
        serverProcess = null;
    }
});

Before(async function () {
    this.baseUrl = baseUrl;
    await this.openBrowser();
});

After(async function () {
    const pauseMs = Number.parseInt(process.env.CUCUMBER_PAUSE_MS || "", 10);
    if (Number.isFinite(pauseMs) && pauseMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, pauseMs));
    }
    await this.closeBrowser();
});

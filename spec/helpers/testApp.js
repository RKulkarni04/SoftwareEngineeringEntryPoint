"use strict";

const fs = require("fs");
const path = require("path");
const supertest = require("supertest");

const projectRoot = path.join(__dirname, "..", "..");
const testDbPath = path.join(projectRoot, "spec", "test-app.db");

function purgeProjectRequireCache() {
    Object.keys(require.cache).forEach((key) => {
        if (!key.startsWith(projectRoot) || key.includes("node_modules")) {
            return;
        }
        if (key.includes(`${path.sep}spec${path.sep}`)) {
            return;
        }
        const rel = key.slice(projectRoot.length + 1);
        if (
            rel === "database.js" ||
            rel === "app.js" ||
            rel.startsWith("controllers" + path.sep) ||
            rel.startsWith("routes" + path.sep)
        ) {
            delete require.cache[key];
        }
    });
}

function makeTestRequest() {
    process.env.DATABASE_PATH = testDbPath;
    process.env.MOCK_LLM = "true";
    if (fs.existsSync(testDbPath)) {
        fs.unlinkSync(testDbPath);
    }
    const { createApp } = require("../../app");
    return supertest(createApp());
}


function getDb() {
    return require("../../database");
}

/**
 * Clear data tables (keeps schema). Uses same DB file as makeTestRequest.
 */
function clearAllTables(done) {
    const db = getDb();
    db.serialize(() => {
        db.run("DELETE FROM messages");
        db.run("DELETE FROM conversations");
        db.run("DELETE FROM login_activity");
        db.run("DELETE FROM progress");
        db.run("DELETE FROM users", (err) => {
            done(err);
        });
    });
}

module.exports = {
    makeTestRequest,
    getDb,
    clearAllTables,
    testDbPath,
    purgeProjectRequireCache
};

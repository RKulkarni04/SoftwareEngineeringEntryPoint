const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const dbPath = process.env.DATABASE_PATH || path.join(__dirname, "database.db");

const db = new sqlite3.Database(dbPath);

function runIgnoreDuplicateColumn(err) {
    if (err && !String(err.message).includes("duplicate column")) {
        console.error("Database migration error:", err.message);
    }
}

db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            email TEXT UNIQUE,
            password TEXT
        )
    `);

    db.run(
        "ALTER TABLE users ADD COLUMN failed_login_attempts INTEGER DEFAULT 0",
        runIgnoreDuplicateColumn
    );
    db.run(
        "ALTER TABLE users ADD COLUMN locked_until TEXT",
        runIgnoreDuplicateColumn
    );

    db.run(`
        CREATE TABLE IF NOT EXISTS progress (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            student_id INTEGER,
            assignment TEXT,
            score INTEGER
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS login_activity (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            student_id INTEGER,
            login_time TEXT
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS conversations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            title TEXT,
            updated_at TEXT NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            conversation_id INTEGER NOT NULL,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY (conversation_id) REFERENCES conversations(id)
        )
    `);
});

/**
 * Close DB connection (for tests / process shutdown).
 */
function closeDatabase(callback) {
    db.close(callback);
}

module.exports = db;
module.exports.closeDatabase = closeDatabase;
module.exports.dbPath = dbPath;

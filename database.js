const sqlite3 = require("sqlite3").verbose();

const db = new sqlite3.Database("./database.db");

db.serialize(() => {

    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            email TEXT UNIQUE,
            password TEXT,
            failed_attempts INTEGER DEFAULT 0,
            locked_until TEXT DEFAULT NULL,
            totp_secret TEXT DEFAULT NULL,
            totp_enabled INTEGER DEFAULT 0,
            reset_token TEXT DEFAULT NULL,
            reset_token_expires TEXT DEFAULT NULL
        )
    `);

    // Add security columns to existing users table if they don't exist
    const securityColumns = [
        "ALTER TABLE users ADD COLUMN failed_attempts INTEGER DEFAULT 0",
        "ALTER TABLE users ADD COLUMN locked_until TEXT DEFAULT NULL",
        "ALTER TABLE users ADD COLUMN totp_secret TEXT DEFAULT NULL",
        "ALTER TABLE users ADD COLUMN totp_enabled INTEGER DEFAULT 0",
        "ALTER TABLE users ADD COLUMN reset_token TEXT DEFAULT NULL",
        "ALTER TABLE users ADD COLUMN reset_token_expires TEXT DEFAULT NULL"
    ];

    securityColumns.forEach(sql => {
        db.run(sql, (err) => {
            // Ignore "duplicate column" errors on existing DBs
        });
    });

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
            user_id INTEGER,
            message TEXT,
            reply TEXT,
            created_at TEXT
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS active_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            token_hash TEXT,
            created_at TEXT,
            expires_at TEXT
        )
    `);

});

module.exports = db;

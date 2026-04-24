"use strict";

const fs = require("fs");
const path = require("path");
const supertest = require("supertest");

const testDbPath = path.join(__dirname, "test-app.db");

function clearAllTables(done) {
    const db = require("../database");
    db.serialize(() => {
        db.run("DELETE FROM messages");
        db.run("DELETE FROM conversations");
        db.run("DELETE FROM login_activity");
        db.run("DELETE FROM progress");
        db.run("DELETE FROM users", (err) => {
            if (err) {
                return done(err);
            }
            done();
        });
    });
}

describe("REST API (integration)", () => {
    let request;

    beforeAll(() => {
        process.env.DATABASE_PATH = testDbPath;
        process.env.MOCK_LLM = "true";
        if (fs.existsSync(testDbPath)) {
            fs.unlinkSync(testDbPath);
        }
        const { createApp } = require("../app");
        request = supertest(createApp());
    });

    beforeEach((done) => {
        clearAllTables(done);
    });

    describe("Authentication", () => {
        it("registers a new user", (done) => {
            request
                .post("/api/register")
                .send({
                    name: "Test User",
                    email: "t1@test.edu",
                    password: "EntryPoint_Tst_9fK2mQx!"
                })
                .expect(200)
                .end((err, res) => {
                    if (err) return done(err);
                    expect(res.body.message).toContain("registered");
                    done();
                });
        });

        it("rejects duplicate email on register", (done) => {
            const body = {
                name: "A",
                email: "dup@test.edu",
                password: "EntryPoint_Tst_9fK2mQx!"
            };
            request
                .post("/api/register")
                .send(body)
                .expect(200)
                .end((err) => {
                    if (err) return done(err);
                    request
                        .post("/api/register")
                        .send(body)
                        .expect(400)
                        .end((e2, res) => {
                            if (e2) return done(e2);
                            expect(res.body.error).toBe("Email already in use");
                            done();
                        });
                });
        });

        it("logs in with valid credentials and returns a JWT", (done) => {
            request
                .post("/api/register")
                .send({
                    name: "L",
                    email: "log@test.edu",
                    password: "EntryPoint_Tst_9fK2mQx!"
                })
                .end((err) => {
                    if (err) return done(err);
                    request
                        .post("/api/login")
                        .send({ email: "log@test.edu", password: "EntryPoint_Tst_9fK2mQx!" })
                        .expect(200)
                        .end((e2, res) => {
                            if (e2) return done(e2);
                            expect(res.body.token).toBeDefined();
                            expect(res.body.userId).toBeDefined();
                            done();
                        });
                });
        });

        it("rejects login with invalid password", (done) => {
            request
                .post("/api/register")
                .send({
                    name: "L",
                    email: "badpw@test.edu",
                    password: "EntryPoint_Tst_9fK2mQx!"
                })
                .end((err) => {
                    if (err) return done(err);
                    request
                        .post("/api/login")
                        .send({
                            email: "badpw@test.edu",
                            password: "wrongpassword"
                        })
                        .expect(401)
                        .end((e2, res) => {
                            if (e2) return done(e2);
                            expect(res.body.error).toBe("Invalid password");
                            done();
                        });
                });
        });

        it("locks account after five failed login attempts", (done) => {
            request
                .post("/api/register")
                .send({
                    name: "Lock",
                    email: "lock@test.edu",
                    password: "EntryPoint_Tst_9fK2mQx!"
                })
                .end((err) => {
                    if (err) return done(err);
                    let n = 0;
                    function failOnce(cb) {
                        request
                            .post("/api/login")
                            .send({
                                email: "lock@test.edu",
                                password: "wrong"
                            })
                            .end((e, res) => {
                                if (e) return cb(e);
                                expect(res.status).toBe(401);
                                n += 1;
                                if (n < 5) return failOnce(cb);
                                cb();
                            });
                    }
                    failOnce((e3) => {
                        if (e3) return done(e3);
                        request
                            .post("/api/login")
                            .send({
                                email: "lock@test.edu",
                                password: "wrong"
                            })
                            .expect(403)
                            .end((e4, res) => {
                                if (e4) return done(e4);
                                expect(res.body.error).toBe(
                                    "Account temporarily locked"
                                );
                                done();
                            });
                    });
                });
        });

        it("returns progress for authenticated user only", (done) => {
            request
                .post("/api/register")
                .send({
                    name: "P",
                    email: "prog@test.edu",
                    password: "EntryPoint_Tst_9fK2mQx!"
                })
                .end((err) => {
                    if (err) return done(err);
                    request
                        .post("/api/login")
                        .send({
                            email: "prog@test.edu",
                            password: "EntryPoint_Tst_9fK2mQx!"
                        })
                        .end((e2, res) => {
                            if (e2) return done(e2);
                            const token = res.body.token;
                            request
                                .get("/api/progress")
                                .set("Authorization", "Bearer " + token)
                                .expect(200)
                                .end((e3, r2) => {
                                    if (e3) return done(e3);
                                    expect(r2.body.progress).toEqual([]);
                                    done();
                                });
                        });
                });
        });
    });

    describe("Conversations (Iteration 2)", () => {
        it("requires auth for conversations", (done) => {
            request
                .post("/api/conversations")
                .expect(401)
                .end((err) => {
                    if (err) {
                        return done(err);
                    }
                    done();
                });
        });

        it("creates conversation, sends message, receives mock LLM reply", (done) => {
            request
                .post("/api/register")
                .send({
                    name: "C",
                    email: "conv@test.edu",
                    password: "EntryPoint_Tst_9fK2mQx!"
                })
                .end((err) => {
                    if (err) return done(err);
                    request
                        .post("/api/login")
                        .send({
                            email: "conv@test.edu",
                            password: "EntryPoint_Tst_9fK2mQx!"
                        })
                        .end((e2, res) => {
                            if (e2) return done(e2);
                            const token = res.body.token;
                            request
                                .post("/api/conversations")
                                .set("Authorization", "Bearer " + token)
                                .send({})
                                .expect(201)
                                .end((e3, cres) => {
                                    if (e3) return done(e3);
                                    const cid = cres.body.id;
                                    request
                                        .post(
                                            "/api/conversations/" +
                                                cid +
                                                "/messages"
                                        )
                                        .set("Authorization", "Bearer " + token)
                                        .send({ message: "Hello" })
                                        .expect(200)
                                        .end((e4, mres) => {
                                            if (e4) return done(e4);
                                            expect(mres.body.reply).toContain(
                                                "Mock assistant reply"
                                            );
                                            request
                                                .get(
                                                    "/api/conversations/search?q=Hello"
                                                )
                                                .set(
                                                    "Authorization",
                                                    "Bearer " + token
                                                )
                                                .expect(200)
                                                .end((e5, sres) => {
                                                    if (e5) return done(e5);
                                                    expect(
                                                        sres.body.results.length
                                                    ).toBeGreaterThan(0);
                                                    done();
                                                });
                                        });
                                });
                        });
                });
        });

        it("returns stored message history on GET for continuing a conversation", (done) => {
            request
                .post("/api/register")
                .send({
                    name: "Hist",
                    email: "hist@test.edu",
                    password: "EntryPoint_Tst_9fK2mQx!"
                })
                .end((err) => {
                    if (err) return done(err);
                    request
                        .post("/api/login")
                        .send({
                            email: "hist@test.edu",
                            password: "EntryPoint_Tst_9fK2mQx!"
                        })
                        .end((e2, res) => {
                            if (e2) return done(e2);
                            const token = res.body.token;
                            request
                                .post("/api/conversations")
                                .set("Authorization", "Bearer " + token)
                                .send({})
                                .expect(201)
                                .end((e3, cres) => {
                                    if (e3) return done(e3);
                                    const cid = cres.body.id;
                                    request
                                        .post(
                                            "/api/conversations/" +
                                                cid +
                                                "/messages"
                                        )
                                        .set("Authorization", "Bearer " + token)
                                        .send({ message: "StoredLine" })
                                        .expect(200)
                                        .end((e4) => {
                                            if (e4) return done(e4);
                                            request
                                                .get(
                                                    "/api/conversations/" +
                                                        cid +
                                                        "/messages"
                                                )
                                                .set(
                                                    "Authorization",
                                                    "Bearer " + token
                                                )
                                                .expect(200)
                                                .end((e5, hres) => {
                                                    if (e5) return done(e5);
                                                    const msgs =
                                                        hres.body.messages || [];
                                                    expect(msgs.length).toBe(2);
                                                    expect(msgs[0].role).toBe(
                                                        "user"
                                                    );
                                                    expect(
                                                        msgs[0].content
                                                    ).toContain("StoredLine");
                                                    expect(msgs[1].role).toBe(
                                                        "assistant"
                                                    );
                                                    expect(
                                                        msgs[1].content
                                                    ).toContain(
                                                        "Mock assistant reply"
                                                    );
                                                    done();
                                                });
                                        });
                                });
                        });
                });
        });

        it("accepts up to four models and returns per-model replies", (done) => {
            request
                .post("/api/register")
                .send({
                    name: "Multi",
                    email: "multi@test.edu",
                    password: "EntryPoint_Tst_9fK2mQx!"
                })
                .end((err) => {
                    if (err) return done(err);
                    request
                        .post("/api/login")
                        .send({
                            email: "multi@test.edu",
                            password: "EntryPoint_Tst_9fK2mQx!"
                        })
                        .end((e2, res) => {
                            if (e2) return done(e2);
                            const token = res.body.token;
                            request
                                .post("/api/conversations")
                                .set("Authorization", "Bearer " + token)
                                .send({})
                                .expect(201)
                                .end((e3, cres) => {
                                    if (e3) return done(e3);
                                    request
                                        .post(
                                            "/api/conversations/" +
                                                cres.body.id +
                                                "/messages"
                                        )
                                        .set("Authorization", "Bearer " + token)
                                        .send({
                                            message: "Multi model check",
                                            models: [
                                                "llama3",
                                                "mistral",
                                                "phi3",
                                                "qwen2.5"
                                            ]
                                        })
                                        .expect(200)
                                        .end((e4, mres) => {
                                            if (e4) return done(e4);
                                            expect(mres.body.models).toEqual([
                                                "llama3",
                                                "mistral",
                                                "phi3",
                                                "qwen2.5"
                                            ]);
                                            expect(
                                                Object.keys(
                                                    mres.body.replies || {}
                                                ).length
                                            ).toBe(4);
                                            expect(
                                                mres.body.replies.llama3
                                            ).toContain("Mock assistant reply");
                                            done();
                                        });
                                });
                        });
                });
        });

        it("returns modelOutputs in GET history for assistant messages", (done) => {
            request
                .post("/api/register")
                .send({
                    name: "Hist2",
                    email: "hist2@test.edu",
                    password: "EntryPoint_Tst_9fK2mQx!"
                })
                .end((err) => {
                    if (err) return done(err);
                    request
                        .post("/api/login")
                        .send({
                            email: "hist2@test.edu",
                            password: "EntryPoint_Tst_9fK2mQx!"
                        })
                        .end((e2, res) => {
                            if (e2) return done(e2);
                            const token = res.body.token;
                            request
                                .post("/api/conversations")
                                .set("Authorization", "Bearer " + token)
                                .send({})
                                .expect(201)
                                .end((e3, cres) => {
                                    if (e3) return done(e3);
                                    const cid = cres.body.id;
                                    request
                                        .post(
                                            "/api/conversations/" +
                                                cid +
                                                "/messages"
                                        )
                                        .set("Authorization", "Bearer " + token)
                                        .send({
                                            message: "Need outputs",
                                            models: ["llama3", "mistral"]
                                        })
                                        .expect(200)
                                        .end((e4) => {
                                            if (e4) return done(e4);
                                            request
                                                .get(
                                                    "/api/conversations/" +
                                                        cid +
                                                        "/messages"
                                                )
                                                .set(
                                                    "Authorization",
                                                    "Bearer " + token
                                                )
                                                .expect(200)
                                                .end((e5, hres) => {
                                                    if (e5) return done(e5);
                                                    const msgs =
                                                        hres.body.messages || [];
                                                    const assistant = msgs.find(
                                                        (m) =>
                                                            m.role ===
                                                            "assistant"
                                                    );
                                                    expect(assistant).toBeDefined();
                                                    expect(
                                                        assistant.modelOutputs
                                                    ).toBeDefined();
                                                    expect(
                                                        assistant.modelOutputs
                                                            .llama3
                                                    ).toContain(
                                                        "Mock assistant reply"
                                                    );
                                                    expect(
                                                        assistant.modelOutputs
                                                            .mistral
                                                    ).toContain(
                                                        "Mock assistant reply"
                                                    );
                                                    done();
                                                });
                                        });
                                });
                        });
                });
        });
    });
});

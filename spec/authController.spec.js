/**
 * Unit Tests — EntryPoint App
 * US1: Multi-Model AI Chat Interface
 * US2: AI Chat Interface (single LLM, history, search)
 * US3: Security Protection (account lockout after 5 failed attempts)
 *
 * Run with:  npx jasmine spec/authController.spec.js
 */

const authController = require('../controllers/authController');
const db = require('../database');

function mockRes() {
  const res = { _status: 200, _body: null };
  res.status = (code) => { res._status = code; return res; };
  res.json   = (body)  => { res._body  = body;  return res; };
  return res;
}
function mockReq({ body = {}, user = null, params = {}, query = {} } = {}) {
  return { body, user, params, query };
}
function fakeOllama(content) {
  return Promise.resolve({ ok: true, json: () => Promise.resolve({ message: { content } }) });
}

// ═══════════════════════════════════════════════════════════════════════════
// US1 — Multi-Model AI Chat Interface
// ═══════════════════════════════════════════════════════════════════════════

describe('US1 — Multi-Model AI Chat Interface', () => {

  beforeEach(() => spyOn(db, 'run').and.callFake((s, p, cb) => cb && cb(null)));

  it('returns the model reply on success, and 500 when Ollama is unreachable', async () => {
    spyOn(global, 'fetch').and.returnValue(fakeOllama('Hello from llama3'));
    const res = mockRes();
    await authController.chatMessage(mockReq({ body: { message: 'Hi' }, user: { id: 1 } }), res);
    expect(res._body.reply).toBe('Hello from llama3');

    fetch.and.returnValue(Promise.reject(new Error('ECONNREFUSED')));
    const res2 = mockRes();
    await authController.chatMessage(mockReq({ body: { message: 'Hi' }, user: { id: 1 } }), res2);
    expect(res2._status).toBe(500);
  });

  it('queries all requested models in parallel and returns a keyed reply map [TDD]', async () => {
    if (typeof authController.multiModelChat !== 'function') pending('not yet implemented');
    const replies = { llama3: 'A', mistral: 'B', gemma: 'C' };
    spyOn(global, 'fetch').and.callFake((url, opts) => fakeOllama(replies[JSON.parse(opts.body).model]));

    const res = mockRes();
    await authController.multiModelChat(
      mockReq({ body: { message: 'Go', models: ['llama3', 'mistral', 'gemma'] }, user: { id: 1 } }), res
    );
    expect(res._body.replies).toEqual(replies);
  });

  it('returns 400 when the models list is empty [TDD]', async () => {
    if (typeof authController.multiModelChat !== 'function') pending('not yet implemented');
    const res = mockRes();
    await authController.multiModelChat(mockReq({ body: { message: 'Hi', models: [] }, user: { id: 1 } }), res);
    expect(res._status).toBe(400);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// US2 — AI Chat Interface
// ═══════════════════════════════════════════════════════════════════════════

describe('US2 — AI Chat Interface', () => {

  it('sends the correct Ollama payload and persists the exchange to the DB', async () => {
    const runSpy = spyOn(db, 'run').and.callFake((s, p, cb) => cb && cb(null));
    const fetchSpy = spyOn(global, 'fetch').and.returnValue(fakeOllama('reply'));

    await authController.chatMessage(mockReq({ body: { message: 'What is Node.js?' }, user: { id: 7 } }), mockRes());

    const payload = JSON.parse(fetchSpy.calls.mostRecent().args[1].body);
    expect(payload.model).toBe('llama3');
    expect(payload.messages[0].content).toBe('What is Node.js?');
    expect(runSpy.calls.all().some(c => c.args[0].includes('INSERT INTO conversations'))).toBeTrue();
  });

  it('returns conversation history, and 500 on a DB error', (done) => {
    const fakeConvos = [{ message: 'Hello', reply: 'Hi', created_at: '2025-01-01' }];
    spyOn(db, 'all').and.callFake((sql, params, cb) => cb(null, fakeConvos));

    const res = mockRes();
    authController.getConversations(mockReq({ params: { id: '1' } }), res);

    setTimeout(() => {
      expect(res._body.conversations).toEqual(fakeConvos);

      db.all.and.callFake((sql, params, cb) => cb(new Error('DB down'), null));
      const res2 = mockRes();
      authController.getConversations(mockReq({ params: { id: '1' } }), res2);
      setTimeout(() => { expect(res2._status).toBe(500); done(); }, 10);
    }, 10);
  });

  it('searches with a %wildcard% pattern scoped to the authenticated user', (done) => {
    const allSpy = spyOn(db, 'all').and.callFake((sql, params, cb) => cb(null, []));
    authController.searchConversations(mockReq({ query: { query: 'gravity' }, user: { id: 77 } }), mockRes());

    setTimeout(() => {
      const params = allSpy.calls.mostRecent().args[1];
      expect(params[0]).toBe(77);
      expect(params[1]).toBe('%gravity%');
      done();
    }, 10);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// US3 — Security Protection (Account Lockout)
// ═══════════════════════════════════════════════════════════════════════════

describe('US3 — Security Protection (Account Lockout)', () => {

  function setupLogin({ attempts, lockedUntil = null, passwordMatch }) {
    spyOn(db, 'get').and.callFake((s, p, cb) => cb(null, {
      id: 1, email: 'u@test.com', password: '$2a$10$x',
      failed_attempts: attempts, locked_until: lockedUntil, totp_enabled: 0
    }));
    spyOn(db, 'run').and.callFake((s, p, cb) => cb && cb(null));
    spyOn(require('bcryptjs'), 'compare').and.returnValue(Promise.resolve(passwordMatch));
  }

  it('returns 401 with countdown on wrong password, and 423 on the 5th failed attempt', (done) => {
    setupLogin({ attempts: 0, passwordMatch: false });
    const res = mockRes();
    authController.loginUser(mockReq({ body: { email: 'u@test.com', password: 'bad' } }), res);

    setTimeout(() => {
      expect(res._status).toBe(401);
      expect(res._body.error).toContain('4 attempt(s) remaining');

      db.get.and.callFake((s, p, cb) => cb(null, {
        id: 1, email: 'u@test.com', password: '$2a$10$x',
        failed_attempts: 4, locked_until: null, totp_enabled: 0
      }));
      const res2 = mockRes();
      authController.loginUser(mockReq({ body: { email: 'u@test.com', password: 'bad' } }), res2);
      setTimeout(() => { expect(res2._status).toBe(423); done(); }, 50);
    }, 50);
  });

  it('returns 423 while the account is locked', (done) => {
    const future = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    setupLogin({ attempts: 5, lockedUntil: future, passwordMatch: false });

    const res = mockRes();
    authController.loginUser(mockReq({ body: { email: 'u@test.com', password: 'any' } }), res);
    setTimeout(() => { expect(res._status).toBe(423); done(); }, 20);
  });

  it('resets failed_attempts to 0 after a successful login', (done) => {
    setupLogin({ attempts: 3, passwordMatch: true });
    spyOn(require('jsonwebtoken'), 'sign').and.returnValue('tok');

    authController.loginUser(mockReq({ body: { email: 'u@test.com', password: 'correct' } }), mockRes());
    setTimeout(() => {
      expect(db.run.calls.all().some(c => c.args[0].includes('failed_attempts = 0'))).toBeTrue();
      done();
    }, 50);
  });
});

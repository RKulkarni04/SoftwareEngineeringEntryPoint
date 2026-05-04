/**
 * Jasmine-like expect() for Cucumber (no active Jasmine spec required).
 */
"use strict";

const assert = require("assert");

function expect(actual) {
  const chain = {
    toBeTruthy() {
      assert.ok(actual);
    },
    toBe(expected) {
      assert.strictEqual(actual, expected);
    },
    toContain(sub) {
      assert.ok(
        typeof actual === "string" && actual.includes(sub),
        `expected string to contain ${JSON.stringify(sub)}`
      );
    },
    toBeGreaterThan(n) {
      assert.ok(actual > n, `expected ${actual} to be greater than ${n}`);
    },
    toBeGreaterThanOrEqual(n) {
      assert.ok(actual >= n, `expected ${actual} to be >= ${n}`);
    },
    not: {
      toBe(expected) {
        assert.notStrictEqual(actual, expected);
      },
    },
  };
  return chain;
}

global.expect = expect;

import assert from "node:assert/strict";
import test from "node:test";
import jwt from "jsonwebtoken";

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret";

const {
  getBearerToken,
  optionalAuth,
  requireAuth,
  verifyJwtToken,
} = await import("../src/request-auth.js");

test("getBearerToken parses Bearer header", () => {
  const request = { headers: { authorization: "Bearer abc123" } };
  assert.equal(getBearerToken(request), "abc123");
});

test("getBearerToken returns null for missing/invalid header", () => {
  assert.equal(getBearerToken({ headers: {} }), null);
  assert.equal(getBearerToken({ headers: { authorization: "Token abc" } }), null);
});

test("verifyJwtToken returns decoded payload for valid token", () => {
  const token = jwt.sign({ sub: "42", email: "user@example.com" }, process.env.JWT_SECRET, {
    expiresIn: "5m",
  });
  const decoded = verifyJwtToken(token);
  assert.equal(decoded.sub, "42");
  assert.equal(decoded.email, "user@example.com");
});

test("verifyJwtToken returns null for invalid token", () => {
  assert.equal(verifyJwtToken("bad-token"), null);
});

test("optionalAuth returns null for missing token", () => {
  const user = optionalAuth({ headers: {} });
  assert.equal(user, null);
});

test("optionalAuth returns decoded user for valid token", () => {
  const token = jwt.sign({ sub: "7", name: "Dan" }, process.env.JWT_SECRET, { expiresIn: "5m" });
  const user = optionalAuth({ headers: { authorization: `Bearer ${token}` } });
  assert.equal(user.sub, "7");
  assert.equal(user.name, "Dan");
});

test("requireAuth throws NO_AUTH when header missing", () => {
  assert.throws(() => requireAuth({ headers: {} }), /NO_AUTH/);
});

test("requireAuth throws BAD_TOKEN when token invalid", () => {
  assert.throws(() => requireAuth({ headers: { authorization: "Bearer invalid" } }), /BAD_TOKEN/);
});

test("requireAuth returns decoded payload when token valid", () => {
  const token = jwt.sign({ sub: "99", email: "ok@example.com" }, process.env.JWT_SECRET, {
    expiresIn: "5m",
  });
  const user = requireAuth({ headers: { authorization: `Bearer ${token}` } });
  assert.equal(user.sub, "99");
});

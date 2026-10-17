import test from 'node:test';
import assert from 'node:assert/strict';
import { API_MESSAGES, apiError, describeApiFailure } from '../utils/apiErrors.mjs';

test('a timed-out request is reported as a slow server, not as a canceled fetch', () => {
  // Expo 57 surfaces our abort as "fetch failed: Fetch request has been canceled".
  const error = apiError({ timedOut: true, cause: new Error('fetch failed: Fetch request has been canceled') });
  assert.equal(error.message, API_MESSAGES.timeout);
  assert.equal(error.kind, 'timeout');
  assert.equal(error.status, undefined);
});

test('transport failures without a response read as a connection problem', () => {
  assert.equal(describeApiFailure({}).message, API_MESSAGES.network);
  assert.equal(apiError({ cause: new TypeError('Network request failed') }).kind, 'network');
});

test('HTTP failures keep their status and get a human message', () => {
  assert.equal(apiError({ status: 429, body: { error: 'Too Many Requests', message: 'Rate limit exceeded, retry in 1 minute' } }).message, API_MESSAGES.rateLimited);
  assert.equal(apiError({ status: 502, body: '<html>Bad Gateway</html>' }).message, API_MESSAGES.server);
  assert.equal(apiError({ status: 500, body: { error: 'Eroare server' } }).message, API_MESSAGES.server);
  const login = apiError({ status: 401, body: { error: 'Credențiale invalide' } });
  assert.equal(login.message, API_MESSAGES.credentials);
  assert.equal(login.status, 401);
  assert.equal(apiError({ status: 401, body: { error: 'Neautorizat' } }).message, API_MESSAGES.session);
  assert.equal(apiError({ status: 404, body: { error: 'Not Found' } }).message, API_MESSAGES.notFound);
  assert.equal(apiError({ status: 400, body: { statusCode: 400, error: 'Bad Request', message: 'body must be object' } }).message, API_MESSAGES.generic);
});

test('specific backend messages written for people are kept', () => {
  assert.equal(apiError({ status: 409, body: { error: 'Email deja folosit' } }).message, 'Email deja folosit');
  assert.equal(apiError({ status: 400, body: 'Format email invalid' }).message, 'Format email invalid');
});

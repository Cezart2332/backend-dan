import test from 'node:test';
import assert from 'node:assert/strict';
import { cachedSubscription, liveSubscription, subscriptionLoadingVisible } from '../utils/subscriptionPolicy.mjs';

const now = Date.parse('2026-09-30T10:00:00Z');
const future = '2026-10-01T00:00:00Z';
const cached = { _ownerId: '42', _status: 'active', type: 'premium', ends_at: future };

test('automatic startup and foreground checks never open the loading modal', () => {
  for (const initializing of [true, false]) for (const subscriptionResolved of [true, false]) {
    assert.equal(subscriptionLoadingVisible({ isAuthed: true, initializing, subscriptionResolved, paywallRequested: false }), false);
  }
});

test('only an explicit paywall request may display verification progress', () => {
  const state = { isAuthed: true, paywallRequested: true, initializing: false, subscriptionResolved: false };
  assert.equal(subscriptionLoadingVisible(state), true);
  assert.equal(subscriptionLoadingVisible({ ...state, isAuthed: false }), false);
  assert.equal(subscriptionLoadingVisible({ ...state, subscriptionResolved: true }), false);
  assert.equal(subscriptionLoadingVisible({ ...state, pendingAction: 'restore' }), false);
});

test('all four paid plans can hydrate immediately from a valid account cache', () => {
  for (const type of ['basic', 'premium', 'vip', 'pro']) {
    const snapshot = { ...cached, type };
    assert.equal(cachedSubscription(snapshot, 42, now), snapshot);
  }
});

test('expired, unknown, malformed and foreign cache entries cannot grant access', () => {
  for (const snapshot of [
    { ...cached, _ownerId: '43' }, { ...cached, _ownerId: undefined },
    { ...cached, ends_at: null }, { ...cached, ends_at: 'invalid' },
    { ...cached, ends_at: new Date(now).toISOString() }, { ...cached, _status: 'none' },
  ]) assert.equal(cachedSubscription(snapshot, 42, now).type, undefined);
  assert.equal(cachedSubscription(cached, null, now).type, undefined);
});

test('trial cache remains a trial and never becomes paid entitlement', () => {
  const trial = { ...cached, type: 'trial', _status: 'none' };
  assert.equal(cachedSubscription(trial, 42, now).type, 'trial');
  const result = liveSubscription({ owner: 42, backend: { status: 'active', subscription: trial } }, now);
  assert.equal(result.type, 'trial');
  assert.equal(result._status, 'none');
});

test('network failure differs from confirmed revocation', () => {
  assert.equal(liveSubscription({ owner: 42 }, now), null);
  assert.equal(liveSubscription({ owner: 42, backend: { status: 'none', trialEligible: true } }, now).type, undefined);
  assert.equal(liveSubscription({ owner: 42, backend: { status: 'none', trialEligible: true } }, now)._trialEligible, true);
});

test('live backend paid access keeps its plan when RevenueCat has no entitlement', () => {
  const result = liveSubscription({ owner: 42, backend: { status: 'active', subscription: { type: 'basic', ends_at: future } }, revenueCat: { hasEntitlement: false, nextStatus: 'none' } }, now);
  assert.equal(result.type, 'basic');
  assert.equal(result._status, 'active');
});

test('verified RevenueCat access wins over a stale server response', () => {
  const result = liveSubscription({ owner: 42, backend: { status: 'none' }, revenueCat: { hasEntitlement: true, subscription: { type: 'pro', ends_at: future } } }, now);
  assert.equal(result.type, 'pro');
  assert.equal(result._ownerId, '42');
});

test('live lifetime access needs verification and malformed expiries are rejected', () => {
  const backend = { status: 'active', subscription: { type: 'vip', ends_at: null } };
  assert.equal(liveSubscription({ owner: 42, backend }, now).type, 'vip');
  assert.equal(cachedSubscription(liveSubscription({ owner: 42, backend }, now), 42, now).type, undefined);
  assert.equal(liveSubscription({ owner: 42, backend: { ...backend, subscription: { ...backend.subscription, ends_at: 'invalid' } } }, now).type, undefined);
});

test('ownership mismatch or actual expiry cannot grant access', () => {
  const backend = { status: 'active', subscription: { type: 'premium', ends_at: future } };
  assert.equal(liveSubscription({ owner: 42, backend, revenueCat: { ownershipMismatch: true } }, now).type, undefined);
  const expired = liveSubscription({ owner: 42, backend: { ...backend, subscription: { ...backend.subscription, ends_at: new Date(now).toISOString() } } }, now);
  assert.equal(expired.type, undefined);
  assert.equal(expired._status, 'expired');
});

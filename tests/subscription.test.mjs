import test from 'node:test';
import assert from 'node:assert/strict';
import { cachedSubscription, hasActiveTrial, hasPaidAccess, hasWebinarAccess, liveSubscription, revenueCatOwnershipMismatch, subscriptionLoadingVisible } from '../utils/subscriptionPolicy.mjs';

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

test('RevenueCat data from another SDK identity is ignored, never the server verdict', () => {
  const backend = { status: 'active', subscription: { type: 'premium', ends_at: future } };
  const foreign = { ownershipMismatch: true, hasEntitlement: true, subscription: { type: 'pro', ends_at: future } };
  assert.equal(liveSubscription({ owner: 42, backend, revenueCat: foreign }, now).type, 'premium');
  assert.equal(liveSubscription({ owner: 42, backend: { status: 'none' }, revenueCat: foreign }, now).type, undefined);
  // Without a server answer a foreign identity is no verdict at all.
  assert.equal(liveSubscription({ owner: 42, revenueCat: foreign }, now), null);
});

test('an account aliased to an anonymous RevenueCat customer still owns its purchase', () => {
  // Customer 598: originalAppUserId is $RCAnonymousID:..., the SDK is identified as 598.
  assert.equal(revenueCatOwnershipMismatch({ hasEntitlement: true, sdkAppUserId: '598', owner: '598' }), false);
  assert.equal(revenueCatOwnershipMismatch({ hasEntitlement: true, sdkAppUserId: '$RCAnonymousID:02fa', owner: '598' }), true);
  assert.equal(revenueCatOwnershipMismatch({ hasEntitlement: true, sdkAppUserId: null, owner: '598' }), true);
  assert.equal(revenueCatOwnershipMismatch({ hasEntitlement: false, sdkAppUserId: '1', owner: '598' }), false);
});

test('actual expiry cannot grant access', () => {
  const backend = { status: 'active', subscription: { type: 'premium', ends_at: future } };
  const expired = liveSubscription({ owner: 42, backend: { ...backend, subscription: { ...backend.subscription, ends_at: new Date(now).toISOString() } } }, now);
  assert.equal(expired.type, undefined);
  assert.equal(expired._status, 'expired');
});

test('webinars follow the server rule: Premium, VIP and pro until expiry, never Basic or trial', () => {
  for (const type of ['premium', 'VIP', 'pro']) assert.equal(hasWebinarAccess({ type, ends_at: future }, now), true);
  assert.equal(hasWebinarAccess({ type: 'vip', ends_at: null }, now), true);
  for (const type of ['basic', 'trial', '', undefined]) assert.equal(hasWebinarAccess({ type, ends_at: future }, now), false);
  assert.equal(hasWebinarAccess({ type: 'premium', ends_at: '2026-09-01T00:00:00Z' }, now), false);
  assert.equal(hasWebinarAccess(null, now), false);
});

test('paid content opens with a store entitlement or a paid plan, never with a trial alone', () => {
  assert.equal(hasPaidAccess({ hasProEntitlement: true, subscription: null }), true);
  for (const type of ['basic', 'Premium', 'vip', 'pro']) assert.equal(hasPaidAccess({ subscription: { type } }), true);
  for (const type of ['trial', '', undefined]) assert.equal(hasPaidAccess({ subscription: { type } }), false);
  assert.equal(hasPaidAccess(), false);
});

test('the account trial runs until its end date, and without one it counts as running', () => {
  assert.equal(hasActiveTrial({ type: 'trial', ends_at: future }, now), true);
  assert.equal(hasActiveTrial({ type: 'TRIAL' }, now), true);
  assert.equal(hasActiveTrial({ type: 'trial', ends_at: '2026-09-29T00:00:00Z' }, now), false);
  assert.equal(hasActiveTrial({ type: 'premium', ends_at: future }, now), false);
  assert.equal(hasActiveTrial(null, now), false);
});

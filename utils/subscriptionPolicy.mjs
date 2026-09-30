const paid = (type) => ['basic','premium','vip','pro'].includes(String(type || '').toLowerCase());
const empty = (owner, status = 'none', trialEligible = false) => ({ _ownerId: String(owner), _status: status, _trialEligible: trialEligible });
const liveExpiryValid = (endsAt, now) => endsAt == null || (Number.isFinite(Date.parse(endsAt)) && Date.parse(endsAt) > now);

// A cached grant must belong to this account and have a known future expiry.
export function cachedSubscription(snapshot, owner, now = Date.now()) {
  if (!owner || String(snapshot?._ownerId) !== String(owner)) return empty(owner || '');
  const expiry = Date.parse(snapshot?.ends_at || '');
  const future = Number.isFinite(expiry) && expiry > now;
  if ((snapshot?._status === 'active' && paid(snapshot.type) || snapshot?.type === 'trial') && future) return snapshot;
  return empty(owner, Number.isFinite(expiry) && expiry <= now ? 'expired' : snapshot?._status === 'expired' ? 'expired' : 'none', Boolean(snapshot?._trialEligible));
}

// Live server verification also supports lifetime subscriptions. A failure is
// distinct from a verified "none", so it cannot revoke a valid cached grant.
export function liveSubscription({ owner, backend, revenueCat }, now = Date.now()) {
  if (revenueCat?.ownershipMismatch) return empty(owner);
  const backendExpiry = Date.parse(backend?.subscription?.ends_at || '');
  const backendActive = backend?.status === 'active' && liveExpiryValid(backend.subscription?.ends_at, now);
  if (backendActive && paid(backend.subscription?.type)) return { ...backend.subscription, _ownerId: String(owner), _status: 'active', _trialEligible: false };
  const rcExpiry = Date.parse(revenueCat?.subscription?.ends_at || '');
  if (revenueCat?.hasEntitlement && liveExpiryValid(revenueCat.subscription?.ends_at, now)) return { ...revenueCat.subscription, _ownerId: String(owner), _status: 'active', _trialEligible: false };
  if (backendActive && backend.subscription?.type === 'trial') return { ...backend.subscription, _ownerId: String(owner), _status: 'none', _trialEligible: false };
  if (!backend && !revenueCat) return null;
  return empty(owner, backend?.status === 'expired' || revenueCat?.nextStatus === 'expired' || Number.isFinite(backendExpiry) && backendExpiry <= now || Number.isFinite(rcExpiry) && rcExpiry <= now ? 'expired' : 'none', Boolean(backend?.trialEligible));
}

export function subscriptionLoadingVisible({ isAuthed, paywallRequested, initializing, subscriptionResolved, pendingAction }) {
  return Boolean(isAuthed && paywallRequested && !pendingAction && (initializing || !subscriptionResolved));
}

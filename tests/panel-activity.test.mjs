import test from "node:test";
import assert from "node:assert/strict";
import { createPanelActivityRepository } from "../utils/panelActivityRepository.mjs";

const identity = { owner: "1", token: "account-one" };
const attempt = {
  clientId: "stable-attempt",
  challengeId: "l1_c1",
  startedAt: "2026-09-30T09:00:00Z",
};
function fixture(save = async () => {}) {
  const data = new Map();
  let active = identity;
  const repo = createPanelActivityRepository({
    storage: {
      getItem: async (key) => data.get(key),
      setItem: async (key, value) => data.set(key, value),
      removeItem: async (key) => data.delete(key),
    },
    session: async () => active,
    save,
    now: () => Date.parse("2026-09-30T10:00:00Z"),
  });
  return {
    repo,
    data,
    pending: () => JSON.parse(data.get("panel_activity_v1:1") || "[]"),
    switchTo: (value) => {
      active = value;
    },
  };
}
const deferred = () => {
  let resolve;
  const promise = new Promise((r) => {
    resolve = r;
  });
  return { promise, resolve };
};

test("foreground visits deduplicate by UTC day while different days remain distinct", async () => {
  const f = fixture();
  await Promise.all(
    Array.from({ length: 5 }, () =>
      f.repo.queue(identity, "visit", { day: "2026-09-30", platform: "ios" }),
    ),
  );
  await f.repo.queue(identity, "visit", { day: "2026-09-29", platform: "ios" });
  assert.equal(f.pending().length, 2);
});

test("a failed or lost response retains the stable attempt and completion for retry", async () => {
  const sent = [];
  let fail = true;
  const f = fixture(async (kind, value, token) => {
    sent.push({ kind, value, token });
    if (fail) throw new Error("lost response");
  });
  await f.repo.queue(identity, "challenge", attempt);
  await assert.rejects(f.repo.flush(identity));
  await f.repo.queue(identity, "challenge", {
    ...attempt,
    completedAt: "2026-09-30T09:10:00Z",
  });
  fail = false;
  await f.repo.flush(identity);
  assert.equal(sent[0].value.clientId, sent[1].value.clientId);
  assert.equal(sent[1].value.completedAt, "2026-09-30T09:10:00Z");
  assert.deepEqual(f.pending(), []);
});

test("changing accounts during upload preserves unsent data and stops the next request", async () => {
  const started = deferred(),
    done = deferred();
  let calls = 0;
  const f = fixture(async () => {
    calls++;
    started.resolve();
    await done.promise;
  });
  await f.repo.queue(identity, "challenge", attempt);
  await f.repo.queue(identity, "visit", {
    day: "2026-09-30",
    platform: "android",
  });
  const flush = f.repo.flush(identity);
  await started.promise;
  f.switchTo({ owner: "2", token: "account-two" });
  done.resolve();
  await flush;
  await f.repo.queue(identity, "challenge", {
    ...attempt,
    completedAt: "2026-09-30T09:10:00Z",
  });
  assert.equal(calls, 1);
  assert.equal(f.pending().length, 2);
  assert.equal(f.pending()[0].value.completedAt, undefined);
  f.switchTo(identity);
  await f.repo.flush(identity);
  assert.deepEqual(f.pending(), []);
});

test("account deletion cannot be undone by an upload acknowledgement or a late event", async () => {
  const started = deferred(),
    done = deferred();
  const f = fixture(async () => {
    started.resolve();
    await done.promise;
  });
  await f.repo.queue(identity, "challenge", attempt);
  const flush = f.repo.flush(identity);
  await started.promise;
  const remove = f.repo.remove(identity.owner);
  done.resolve();
  await Promise.all([flush, remove]);
  await f.repo.queue(identity, "challenge", attempt);
  assert.equal(f.data.has("panel_activity_v1:1"), false);
});

test("invalid queued events do not block valid events, but server/network failures keep them", async () => {
  const f = fixture(async (_kind, value) => {
    if (value.clientId === attempt.clientId)
      throw Object.assign(new Error("invalid"), { status: 409 });
  });
  await f.repo.queue(identity, "challenge", attempt);
  await f.repo.queue(identity, "visit", { day: "2026-09-30", platform: "web" });
  await f.repo.flush(identity);
  assert.deepEqual(f.pending(), []);
  const offline = fixture(async () => {
    throw Object.assign(new Error("unavailable"), { status: 503 });
  });
  await offline.repo.queue(identity, "challenge", attempt);
  await assert.rejects(offline.repo.flush(identity));
  assert.equal(offline.pending().length, 1);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { messagePreview, notifySocial, socialNotification } from '../src/social-push.js';

function pool({ socialPush = 1, tokens = ['ExponentPushToken[a]', 'ExponentPushToken[b]'], actor = { id: 1, name: 'Ana' } } = {}) {
  const queries = [];
  return {
    queries,
    async query(sql, args) {
      queries.push({ sql, args });
      if (sql.includes('social:push-actor')) return [actor ? [actor] : []];
      if (sql.includes('social:push-tokens')) return [socialPush ? tokens.map((expo_push_token) => ({ expo_push_token })) : []];
      if (sql.startsWith('UPDATE user_push_tokens')) return [{}];
      throw new Error(`Unexpected query: ${sql}`);
    },
  };
}

test('each social event has its own text and opens the right place', () => {
  const actor = { id: 7, name: ' Ana ' };
  assert.deepEqual(socialNotification('friend_request', actor), {
    title: 'Cerere de prietenie', body: 'Ana ți-a trimis o cerere de prietenie.', data: { type: 'friend_request', userId: '7' },
  });
  assert.equal(socialNotification('friend_accepted', actor).body, 'Ana ți-a acceptat cererea de prietenie.');
  const message = socialNotification('private_message', actor, 'Salut!');
  assert.equal(message.title, 'Ana');
  assert.equal(message.body, 'Salut!');
  assert.deepEqual(message.data, { type: 'private_message', userId: '7', name: 'Ana' });
  assert.equal(socialNotification('friend_request', { id: 7, name: '' }).body, 'Cineva ți-a trimis o cerere de prietenie.');
});

test('message previews are short and on one line', () => {
  assert.equal(messagePreview('  linia 1\n\nlinia 2  '), 'linia 1 linia 2');
  const long = messagePreview('a'.repeat(500));
  assert.equal(long.length, 120);
  assert.ok(long.endsWith('…'));
});

test('a push goes to every enabled device of the recipient on the social channel', async () => {
  const db = pool(), sent = [];
  const result = await notifySocial({ pool: db, recipientId: 2, actorId: 1, kind: 'private_message', content: 'Salut', send: async (message) => { sent.push(message); return { sentCount: 2, invalidTokens: [] }; } });
  assert.equal(result.sentCount, 2);
  assert.deepEqual(sent[0].tokens, ['ExponentPushToken[a]', 'ExponentPushToken[b]']);
  assert.equal(sent[0].channelId, 'social');
  assert.equal(sent[0].title, 'Ana');
  assert.deepEqual(db.queries.find((q) => q.sql.includes('push-tokens')).args, [2]);
});

test('muted recipients get nothing and devices that no longer exist are disabled', async () => {
  let calls = 0;
  const muted = await notifySocial({ pool: pool({ socialPush: 0 }), recipientId: 2, actorId: 1, kind: 'friend_request', send: async () => { calls++; return { sentCount: 1 }; } });
  assert.equal(muted.sentCount, 0);
  assert.equal(calls, 0);

  const db = pool();
  await notifySocial({ pool: db, recipientId: 2, actorId: 1, kind: 'friend_request', send: async () => ({ sentCount: 1, invalidTokens: ['ExponentPushToken[b]'] }) });
  const disable = db.queries.find((q) => q.sql.startsWith('UPDATE user_push_tokens'));
  assert.deepEqual(disable.args, ['ExponentPushToken[b]']);
});

test('a failing push never breaks the action that triggered it', async () => {
  const result = await notifySocial({ pool: pool(), recipientId: 2, actorId: 1, kind: 'friend_request', send: async () => { throw new Error('Expo down'); } });
  assert.deepEqual(result, { sentCount: 0 });
  assert.deepEqual(await notifySocial({ pool: pool({ actor: null }), recipientId: 2, actorId: 1, kind: 'friend_request' }), { sentCount: 0 });
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { isFriendNotification, isPrivateMessageFrom, socialNotificationTarget } from '../utils/socialNotificationRoutes.mjs';

test('tapping a social notification opens the matching screen', () => {
  assert.deepEqual(socialNotificationTarget({ type: 'friend_request', userId: '7' }), { name: 'Friends' });
  assert.deepEqual(socialNotificationTarget({ type: 'friend_accepted', userId: '7' }), { name: 'PublicProfile', params: { userId: 7 } });
  assert.deepEqual(socialNotificationTarget({ type: 'private_message', userId: '7', name: 'Ana' }), { name: 'PrivateChat', params: { userId: 7, name: 'Ana' } });
  assert.deepEqual(socialNotificationTarget({ type: 'private_message', userId: '7' }).params.name, 'Prieten');
});

test('malformed or unrelated notifications are left to the existing handling', () => {
  assert.deepEqual(socialNotificationTarget({ type: 'private_message', userId: 'abc' }), { name: 'Friends' });
  assert.equal(socialNotificationTarget({ type: 'chat_message' }), null);
  assert.equal(socialNotificationTarget({}), null);
  assert.equal(socialNotificationTarget(undefined), null);
});

test('only messages from the open conversation are treated as already seen', () => {
  assert.equal(isPrivateMessageFrom({ type: 'private_message', userId: '7' }, 7), true);
  assert.equal(isPrivateMessageFrom({ type: 'private_message', userId: '8' }, 7), false);
  assert.equal(isPrivateMessageFrom({ type: 'private_message', userId: '7' }, null), false);
  assert.equal(isPrivateMessageFrom({ type: 'friend_request', userId: '7' }, 7), false);
  assert.equal(isFriendNotification({ type: 'friend_request' }), true);
  assert.equal(isFriendNotification({ type: 'friend_accepted' }), true);
  assert.equal(isFriendNotification({ type: 'private_message' }), false);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveLessonSource } from '../utils/lessonSource.mjs';

const base = 'https://media.example.test';
const file = 'intelege_anxietatea_intro.mp4';
const response = hlsUrl => async () => ({ ok: true, json: async () => ({ hlsUrl }) });

test('published video lookup retains the original media filename and resolves relative HLS', async () => {
  const source = await resolveLessonSource(file,base,async url => {
    assert.equal(url, `${base}/api/videos/intelege_anxietatea_intro`);
    return { ok: true, json: async () => ({ hlsUrl: '/hls/intro/index.m3u8' }) };
  });
  assert.equal(source, `${base}/hls/intro/index.m3u8`);
});

test('absolute published HLS sources work without inventing another audio asset', async () => {
  const source = 'https://cdn.example.test/intro/index.m3u8';
  assert.equal(await resolveLessonSource(file,base,response(source)),source);
});

test('failed or missing HLS metadata rejects instead of requesting an MP4', async () => {
  for (const fetcher of [async () => { throw Error('offline'); }, async () => ({ ok: false }), response(null), response(''), async () => ({ ok: true, json: async () => { throw Error('invalid JSON'); } })]) {
    await assert.rejects(resolveLessonSource(file,base,fetcher));
  }
});

test('unsupported schemes and MP4 sources cannot replace HLS', async () => {
  for (const url of ['javascript:alert(1)', 'file:///private/file.mp4', 'data:audio/mp3;base64,test', 'https://cdn.example.test/intro.mp4']) {
    await assert.rejects(resolveLessonSource(file,base,response(url)));
  }
});

test('leaving the player cancels a pending source lookup', async () => {
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(resolveLessonSource(file,base,async (_, { signal }) => { assert.equal(signal,controller.signal); throw Error('cancelled'); },controller.signal),/cancelled/);
});

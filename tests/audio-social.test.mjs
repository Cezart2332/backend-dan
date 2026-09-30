import test from 'node:test';
import assert from 'node:assert/strict';
import { createAudioTracker } from '../utils/audioTracker.mjs';
import { mergePrivateMessages } from '../utils/privateMessages.mjs';
import { createAudioActivityRepository } from '../utils/audioActivityRepository.mjs';

test('completed means reaching the end after at least 90% continuous coverage', () => {
  const tracker = createAudioTracker();
  for (let i=0;i<=100;i++) tracker.sample(i,i*1000,true);
  assert.equal(tracker.snapshot(100).completed,false);
  tracker.end(); assert.deepEqual(tracker.snapshot(100),{durationMs:100000,listenedMs:100000,completed:true});
});
test('seeking to the end cannot count as a completed lesson', () => {
  const tracker = createAudioTracker(); tracker.sample(0,0,true); tracker.sample(5,5000,true);
  tracker.sample(99,5500,true); tracker.sample(100,6500,false); tracker.end();
  assert.equal(tracker.snapshot(100).listenedMs,6000); assert.equal(tracker.snapshot(100).completed,false);
});
test('pause, rate changes and replayed intervals do not inflate a session', () => {
  const tracker = createAudioTracker(); tracker.sample(0,0,true); tracker.sample(10,10000,false);
  tracker.sample(10,40000,false); tracker.discontinuity(10,40000,true);
  tracker.sample(20,45000,true,2); tracker.discontinuity(0,46000,true);
  tracker.sample(10,56000,true); assert.equal(tracker.snapshot(100).listenedMs,20000);
});
test('completion threshold and duplicate end events are stable', () => {
  for(const covered of [89,90]) { const tracker=createAudioTracker(); tracker.sample(0,0,true); tracker.sample(covered,covered*1000,true); tracker.end(); tracker.end(); assert.equal(tracker.snapshot(100).completed,covered===90); }
});
test('message acknowledgement and retry merge into one bubble, scoped by sender', () => {
  const pending={clientId:'a',senderId:1,createdAt:'2026-09-30T10:00:00Z',pending:true};
  const ack={...pending,id:4,pending:undefined};
  const result=mergePrivateMessages([pending],[ack,{...pending,failed:true},{...pending,senderId:2,id:5}]);
  assert.equal(result.length,2); assert.deepEqual(result[1],ack); assert.equal(result[0].id,5);
});
const defer=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
function fixture(save=async()=>{}) {
  const data=new Map(), active={owner:1,token:'one'};
  const storage={getItem:async k=>data.get(k),setItem:async(k,v)=>data.set(k,v),removeItem:async k=>data.delete(k)};
  const repo=createAudioActivityRepository({storage,session:async()=>({...active}),save,fetchStats:async()=>({stats:{audioCompleted:2}})});
  return {repo,data,active,pending:()=>JSON.parse(data.get('audio_activity_v1:1')).pending};
}
const snapshot={clientId:'stable',listenedMs:1000,durationMs:10000,completed:false};
test('offline retry retains stable IDs and a lost response cannot discard queued progress',async()=>{
  let attempts=0; const ids=[]; const f=fixture(async s=>{ids.push(s.clientId);if(!attempts++)throw new Error('offline');});
  await f.repo.saveSnapshot(1,snapshot); await assert.rejects(f.repo.sync()); assert.equal(Object.keys(f.pending()).length,1);
  await f.repo.sync(); assert.deepEqual(ids,['stable','stable']); assert.deepEqual(f.pending(),{});
});
test('an acknowledgement cannot remove a newer playback snapshot',async()=>{
  const started=defer(),done=defer();const f=fixture(async()=>{started.resolve();await done.promise;});
  await f.repo.saveSnapshot(1,snapshot);const sync=f.repo.sync();await started.promise;
  await f.repo.saveSnapshot(1,{...snapshot,listenedMs:2000});done.resolve();await sync;
  assert.equal(f.pending().stable.listenedMs,2000);await f.repo.sync();assert.deepEqual(f.pending(),{});
});
test('account change preserves unsent entries and stops acknowledgement',async()=>{
  const started=defer(),done=defer();const f=fixture(async()=>{started.resolve();await done.promise;});
  await f.repo.saveSnapshot(1,snapshot);const sync=f.repo.sync();await started.promise;f.active.owner=2;f.active.token='two';done.resolve();await sync;
  assert.equal(Object.keys(f.pending()).length,1);await f.repo.saveSnapshot(1,{...snapshot,listenedMs:3000});assert.equal(f.pending().stable.listenedMs,1000);
  assert.equal((await f.repo.loadStats()).stats.audioCompleted,2);assert.equal(JSON.parse(f.data.get('audio_activity_v1:2')).stats.audioCompleted,2);
});
test('account deletion cannot be undone by an in-flight sync acknowledgement',async()=>{
  const started=defer(),done=defer();const f=fixture(async()=>{started.resolve();await done.promise;});
  await f.repo.saveSnapshot(1,snapshot);const sync=f.repo.sync();await started.promise;await f.repo.remove(1);done.resolve();await sync;
  await f.repo.saveSnapshot(1,snapshot);assert.equal(f.data.has('audio_activity_v1:1'),false);
});
test('offline cached totals do not double-count pending snapshots',async()=>{
  const f=fixture(async()=>{throw new Error('offline');});await f.repo.loadStats();await f.repo.saveSnapshot(1,snapshot);
  assert.deepEqual(await f.repo.loadStats(),{stats:{audioCompleted:2},offline:true,pending:true});
});

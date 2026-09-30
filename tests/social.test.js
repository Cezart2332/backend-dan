import test from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import { registerSocialRoutes, migrateSocial, validateAudio, pairOf } from '../src/social.js';

// Route integration fixture; records are deliberately shared between all viewers
// to catch cross-account reads, rejected writes and lost-response duplicates.
function database() {
  const users=new Map([1,2,3].map(id=>[id,{id,name:`User ${id}`,avatar_url:null}]));
  const friends=new Map(),blocks=new Set(),messages=[],audio=new Map(),preferences=new Map(),reads=new Map();
  const key=(a,b)=>[a,b].sort((a,b)=>a-b).join(':');
  let seq=0;
  const db={users,friends,blocks,messages,audio,preferences,reads,commits:0,rollbacks:0,
    async beginTransaction(){},async commit(){this.commits++;},async rollback(){this.rollbacks++;},release(){},async getConnection(){return this;},
    async query(sql,args=[]) {
      const tag=sql.match(/social:([\w-]+)/)?.[1];
      const [a,b,c,d]=args;
      switch(tag) {
        case 'user':return [users.has(a)?[{id:a}]:[]];
        case 'lock':return [[a,b].filter(id=>users.has(id)).map(id=>({id}))];
        case 'block':return [blocks.has(`${a}:${b}`)||blocks.has(`${b}:${a}`)?[{user_id:a}]:[]];
        case 'pair':return [friends.has(key(a,b))?[friends.get(key(a,b))]:[]];
        case 'request':if(!friends.has(key(a,b)))friends.set(key(a,b),{id:++seq,user_low:a,user_high:b,requested_by:c,status:'pending'});return [{}];
        case 'accept':friends.get(key(a,b)).status='accepted';return [{}];
        case 'remove':friends.delete(key(a,b));return [{}];
        case 'block-save':blocks.add(`${a}:${b}`);return [{}];
        case 'unblock':blocks.delete(`${a}:${b}`);return [{}];
        case 'message-save':if(!messages.some(m=>m.senderId===a&&m.clientId===c))messages.push({id:++seq,senderId:a,recipientId:b,clientId:c,content:d,createdAt:new Date().toISOString()});return [{}];
        case 'message-get':return [messages.filter(m=>m.senderId===a&&m.clientId===b)];
        case 'messages':return [messages.filter(m=>(m.senderId===a&&m.recipientId===b)||(m.senderId===c&&m.recipientId===d)).filter(m=>!args[4]||(sql.includes('AND id <')?m.id<args[4]:m.id>args[4])).sort((x,y)=>sql.includes('id ASC')?x.id-y.id:y.id-x.id).slice(0,51)];
        case 'read-check':return [messages.filter(m=>m.id===a&&((m.senderId===b&&m.recipientId===c)||(m.senderId===d&&m.recipientId===args[4])))];
        case 'read-save':reads.set(`${a}:${b}`,Math.max(reads.get(`${a}:${b}`)||0,c));return [{}];
        case 'audio-save':{const k=`${a}:${b}`,old=audio.get(k);if(!old)audio.set(k,{user_id:a,media_key:c,listened_ms:d,duration_ms:args[4],completed:args[5]});else if(old.media_key===c&&old.duration_ms===args[4]){old.listened_ms=Math.max(old.listened_ms,d);old.completed=Math.max(old.completed,args[5]);}return [{}];}
        case 'audio-get':return [audio.has(`${a}:${b}`)?[audio.get(`${a}:${b}`)]:[]];
        case 'audio-stats':{const rows=[...audio.values()].filter(r=>r.user_id===a);return [[{audioCompleted:rows.filter(r=>r.completed).length,uniqueAudios:new Set(rows.filter(r=>r.completed).map(r=>r.media_key)).size,listenedMs:rows.reduce((n,r)=>n+r.listened_ms,0)}]];}
        case 'challenge-stats':return [[{challengesCompleted:a===1?3:0,uniqueChallenges:a===1?2:0}]];
        case 'profile':return [users.has(a)?[{...users.get(a),share_activity:preferences.get(a)||0}]:[]];
        case 'preferences-save':preferences.set(a,b);return [{}];
        case 'search':return [[...users.values()].filter(u=>u.id!==a&&u.id>b&&!blocks.has(`${a}:${u.id}`)&&!blocks.has(`${u.id}:${a}`)).slice(0,31)];
        case 'friends':return [[...friends.values()].filter(f=>(f.user_low===a||f.user_high===a)&&f.id>args[5]).map(f=>({...users.get(f.user_low===a?f.user_high:f.user_low),friendshipId:f.id,status:f.status,requested_by:f.requested_by,unreadCount:0})).slice(0,51)];
        case 'blocked-list':return [[...users.values()].filter(u=>u.id>b&&blocks.has(`${a}:${u.id}`)).slice(0,51)];
        case 'unread':return [[{requests:[...friends.values()].filter(f=>(f.user_low===a||f.user_high===a)&&f.status==='pending'&&f.requested_by!==a).length,messages:messages.filter(m=>m.recipientId===a&&friends.get(key(m.senderId,a))?.status==='accepted'&&!blocks.has(`${a}:${m.senderId}`)&&!blocks.has(`${m.senderId}:${a}`)&&m.id>(reads.get(`${a}:${m.senderId}`)||0)).length}]];
        default:throw new Error(`Unexpected query: ${tag}`);
      }
    },
  }; return db;
}
async function fixture(t) {
  const pool=database(),app=Fastify(),secret='social-tests-only';
  await registerSocialRoutes(app,{pool,jwtSecret:secret});t.after(()=>app.close());
  const call=(viewer,method,url,payload)=>app.inject({method,url,payload,headers:viewer?{authorization:`Bearer ${jwt.sign({sub:viewer},secret)}`}:{}});
  const befriend=async(a=1,b=2)=>{assert.equal((await call(a,'POST',`/api/social/friends/${b}`)).statusCode,200);assert.equal((await call(b,'POST',`/api/social/friends/${a}/accept`)).statusCode,200);};
  return {app,pool,call,befriend};
}
test('all social and activity routes require a valid existing account',async t=>{
  const {call}=await fixture(t);
  for(const url of ['/api/activity/stats','/api/social/profiles/2','/api/social/friends','/api/social/private/2/messages','/api/social/people?q=User']) {
    assert.equal((await call(null,'GET',url)).statusCode,401);assert.equal((await call(999,'GET',url)).statusCode,401);
  }
});
test('a request is idempotent, cannot target self, and only its recipient can accept',async t=>{
  const {call,pool}=await fixture(t);
  assert.equal((await call(1,'POST','/api/social/friends/1')).statusCode,400);
  assert.equal((await call(1,'POST','/api/social/friends/999')).statusCode,404);
  await call(1,'POST','/api/social/friends/2');await call(1,'POST','/api/social/friends/2');await call(2,'POST','/api/social/friends/1');
  assert.equal(pool.friends.size,1);assert.equal(pool.friends.get('1:2').status,'pending');
  assert.equal((await call(1,'POST','/api/social/friends/2/accept')).statusCode,403);
  assert.equal((await call(3,'POST','/api/social/friends/1/accept')).statusCode,403);
  assert.equal((await call(2,'POST','/api/social/friends/1/accept')).statusCode,200);
  assert.equal((await call(1,'GET','/api/social/profiles/2')).json().relationship,'friend');
});
test('pending and unrelated users cannot send, read, or mark private conversations read',async t=>{
  const {call,befriend}=await fixture(t);await call(1,'POST','/api/social/friends/2');
  const payload={clientId:randomUUID(),content:'Salut'};
  assert.equal((await call(1,'POST','/api/social/private/2/messages',payload)).statusCode,403);
  await befriend();assert.equal((await call(1,'POST','/api/social/private/2/messages',payload)).statusCode,200);
  for(const method of ['GET','POST'])assert.equal((await call(3,method,'/api/social/private/1/messages',method==='POST'?payload:undefined)).statusCode,403);
  assert.equal((await call(3,'POST','/api/social/private/1/read',{lastId:1})).statusCode,403);
});
test('lost-response retries return one message; reused IDs cannot alter recipient/content',async t=>{
  const {call,befriend,pool}=await fixture(t);await befriend();await befriend(1,3);
  const payload={clientId:randomUUID(),content:' Salut '};
  const first=await call(1,'POST','/api/social/private/2/messages',payload),retry=await call(1,'POST','/api/social/private/2/messages',payload);
  assert.equal(first.statusCode,200);assert.deepEqual(first.json(),retry.json());assert.equal(pool.messages.length,1);
  assert.equal((await call(1,'POST','/api/social/private/3/messages',payload)).statusCode,409);
  assert.equal((await call(1,'POST','/api/social/private/2/messages',{...payload,content:'Changed'})).statusCode,409);
  const own=await call(2,'POST','/api/social/private/1/messages',payload);assert.equal(own.statusCode,200);assert.equal(pool.messages.length,2);
});
test('blocking in either direction revokes private access and requests; unblock requires a new friendship',async t=>{
  const {call,befriend,pool}=await fixture(t);await befriend();await call(2,'POST','/api/social/blocks/1');
  assert.equal(pool.friends.size,0);
  for(const [a,b] of [[1,2],[2,1]]) {
    assert.equal((await call(a,'GET',`/api/social/profiles/${b}`)).statusCode,404);
    assert.equal((await call(a,'POST',`/api/social/friends/${b}`)).statusCode,403);
    assert.equal((await call(a,'GET',`/api/social/private/${b}/messages`)).statusCode,403);
  }
  await call(2,'DELETE','/api/social/blocks/1');assert.equal((await call(1,'GET','/api/social/private/2/messages')).statusCode,403);
  await befriend();assert.equal((await call(1,'GET','/api/social/private/2/messages')).statusCode,200);
});
test('removing friendship immediately closes private conversations',async t=>{
  const {call,befriend}=await fixture(t);await befriend();await call(1,'DELETE','/api/social/friends/2');
  assert.equal((await call(2,'POST','/api/social/private/1/messages',{clientId:randomUUID(),content:'Hello'})).statusCode,403);
});
test('private pagination has no gaps, is scoped to the pair, and reads cannot reference another conversation',async t=>{
  const {call,befriend,pool}=await fixture(t);await befriend();await befriend(1,3);
  for(let i=1;i<=123;i++)pool.messages.push({id:100+i,senderId:1,recipientId:2,clientId:randomUUID(),content:`${i}`,createdAt:new Date().toISOString()});
  pool.messages.push({id:999,senderId:3,recipientId:1,clientId:randomUUID(),content:'Private',createdAt:new Date().toISOString()});
  const all=[];let before,more;
  do {const res=await call(2,'GET',`/api/social/private/1/messages${before?`?before=${before}`:''}`);assert.equal(res.statusCode,200);const data=res.json();all.push(...data.items);before=data.items[0].id;more=data.hasMore;}while(more);
  assert.equal(all.length,123);assert.equal(new Set(all.map(m=>m.id)).size,123);
  const after=(await call(2,'GET','/api/social/private/1/messages?after=150')).json();assert.equal(after.items[0].id,151);assert.equal(after.hasMore,true);
  assert.equal((await call(2,'POST','/api/social/private/1/read',{lastId:999})).statusCode,400);
  for(const lastId of [210,180])assert.equal((await call(2,'POST','/api/social/private/1/read',{lastId})).statusCode,200);
  assert.equal(pool.reads.get('2:1'),210);
});
test('public activity defaults to private; sharing requires explicit owner opt-in and omits personal data',async t=>{
  const {call,pool}=await fixture(t);pool.users.get(1).email='private@example.test';
  let res=(await call(2,'GET','/api/social/profiles/1')).json();assert.equal(res.stats,null);assert.equal(res.user.email,undefined);
  res=(await call(1,'GET','/api/social/profiles/1')).json();assert.equal(res.relationship,'self');assert.equal(res.stats.challengesCompleted,3);
  await call(1,'PUT','/api/social/preferences',{shareActivity:true});res=(await call(2,'GET','/api/social/profiles/1')).json();assert.equal(res.stats.challengesCompleted,3);
  await call(1,'PUT','/api/social/preferences',{shareActivity:false});assert.equal((await call(2,'GET','/api/social/profiles/1')).json().stats,null);
});
test('audio progress is monotonic, deduplicated, account scoped and counted once per session',async t=>{
  const {call,pool}=await fixture(t);const payload={clientId:randomUUID(),mediaKey:'intro.mp4',durationMs:120000,listenedMs:60000,completed:false,occurredAt:new Date().toISOString()};
  for(const p of [payload,{...payload,listenedMs:120000,completed:true},payload])assert.equal((await call(1,'POST','/api/activity/audio',p)).statusCode,200);
  assert.equal(pool.audio.size,1);assert.deepEqual((await call(1,'GET','/api/activity/stats')).json().stats,{audioCompleted:1,uniqueAudios:1,listeningMinutes:2,challengesCompleted:3,uniqueChallenges:2});
  assert.equal((await call(2,'GET','/api/activity/stats')).json().stats.audioCompleted,0);
  assert.equal((await call(1,'POST','/api/activity/audio',{...payload,mediaKey:'different.mp4'})).statusCode,409);
});
test('invalid message content, IDs, cursors and completion claims are rejected',async t=>{
  const {call,befriend}=await fixture(t);await befriend();
  for(const patch of [{content:''},{content:'x'.repeat(2001)},{content:{}},{content:{trim:'invalid'}},{clientId:'not-a-uuid'}])assert.equal((await call(1,'POST','/api/social/private/2/messages',{clientId:randomUUID(),content:'Hi',...patch})).statusCode,400);
  for(const query of ['before=0','after=-1','before=2&after=3','before=1.5'])assert.equal((await call(1,'GET',`/api/social/private/2/messages?${query}`)).statusCode,400);
  assert.throws(()=>pairOf(1,1));assert.throws(()=>validateAudio({clientId:randomUUID(),mediaKey:'a.mp4',listenedMs:1,durationMs:100,completed:true,occurredAt:new Date().toISOString()}));
});
test('unread counter includes received requests and private messages until read, excludes revoked friendships',async t=>{
  const {call,befriend}=await fixture(t);await call(2,'POST','/api/social/friends/1');
  assert.equal((await call(1,'GET','/api/social/unread-count')).json().unreadCount,1);
  await call(1,'POST','/api/social/friends/2/accept');
  const message=(await call(2,'POST','/api/social/private/1/messages',{clientId:randomUUID(),content:'Hello'})).json().item;
  assert.equal((await call(1,'GET','/api/social/unread-count')).json().unreadCount,1);
  await call(1,'POST','/api/social/private/2/read',{lastId:message.id});assert.equal((await call(1,'GET','/api/social/unread-count')).json().unreadCount,0);
  await call(2,'POST','/api/social/private/1/messages',{clientId:randomUUID(),content:'Hello again'});
  await call(1,'DELETE','/api/social/friends/2');assert.equal((await call(1,'GET','/api/social/unread-count')).json().unreadCount,0);
});
test('migrations are additive with deletion cascades for every account-owned table',async()=>{
  const queries=[];await migrateSocial({query:async sql=>queries.push(sql)});assert.equal(queries.length,6);
  for(const sql of queries){assert.match(sql,/CREATE TABLE IF NOT EXISTS/);assert.match(sql,/ON DELETE CASCADE/);assert.doesNotMatch(sql,/DROP TABLE/);}
});

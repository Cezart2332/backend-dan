import test from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import jwt from 'jsonwebtoken';
import { registerWellbeingRoutes, validateRecord, migrateWellbeing } from '../src/wellbeing.js';

const secret='wellbeing-test-secret';
const clientId='389c6f0e-197b-48b1-a403-8cfab56ba308';
const checkin={clientId,occurredAt:'2026-09-30T10:00:00.000Z',timezoneOffset:-180,timezone:'Europe/Bucharest',level:4};
const session={...checkin,duration:180,elapsedMs:12000,pattern:'4-6',status:'stopped',techniques:['breathing'],feedback:null};
function fakePool({paid=true}={}) {
  const records=new Map();
  const calls=[];
  return {records,calls,async query(sql,args=[]) {
    calls.push({sql,args});
    if(sql.includes('SELECT u.id FROM users'))return [paid?[{id:args[0]}]:[]];
    if(sql.startsWith('INSERT INTO wellbeing_')) {
      const table=sql.match(/INSERT INTO (\w+)/)[1];const key=`${table}:${args[0]}:${args[1]}`;
      if(!records.has(key))records.set(key,{id:records.size+1,user_id:args[0],payload:JSON.parse(args[3]),revision:0});
      return [{affectedRows:1}];
    }
    if(sql.startsWith('UPDATE wellbeing_sessions')) {
      const key=`wellbeing_sessions:${args[2]}:${args[3]}`,row=records.get(key);
      if(row&&row.revision<args[4]){row.payload.feedback=JSON.parse(args[0]);row.revision=args[1];}
      return [{affectedRows:row?1:0}];
    }
    if(sql.includes('WHERE user_id = ? AND client_id = ?')) {
      const table=sql.match(/FROM (\w+)/)[1];const row=records.get(`${table}:${args[0]}:${args[1]}`);return [row?[row]:[]];
    }
    if(sql.startsWith('CREATE TABLE'))return [{}];
    if(sql.includes('COUNT(*)'))return [[{total:records.size}]];
    if(sql.includes('WHERE w.id = ?'))return [[...records.values()].filter((r)=>r.id===args[0])];
    if(sql.includes('SELECT w.')) {
      const table=sql.match(/FROM (\w+)/)[1];
      const userIndex=sql.includes('WHERE 1 = 1')?args.length-3:0;
      return [[...records.entries()].filter(([key,row])=>key.startsWith(`${table}:`)&&(!sql.includes('w.user_id = ?')||row.user_id===args[userIndex])).map(([,row])=>row)];
    }
    throw new Error(`Unexpected SQL: ${sql}`);
  }};
}
async function fixture(options={}) {
  const pool=fakePool(options),app=Fastify();
  await registerWellbeingRoutes(app,{pool,jwtSecret:secret,adminAuth:async(req)=>req.headers['x-admin-token']==='admin-test'});
  const auth=(id=1)=>({authorization:`Bearer ${jwt.sign({sub:id},secret)}`});
  return {app,pool,auth};
}
test('unauthenticated, invalid-token and non-paid API requests are rejected',async(t)=>{
  const {app,auth}=await fixture({paid:false});t.after(()=>app.close());
  assert.equal((await app.inject({method:'GET',url:'/api/wellbeing/checkins'})).statusCode,401);
  assert.equal((await app.inject({method:'GET',url:'/api/wellbeing/checkins',headers:{authorization:'Bearer broken'}})).statusCode,401);
  assert.equal((await app.inject({method:'POST',url:'/api/wellbeing/checkins',headers:auth(),payload:checkin})).statusCode,403);
});
test('idempotent create returns one row even after a retry with modified payload',async(t)=>{
  const {app,pool,auth}=await fixture();t.after(()=>app.close());
  for(const level of [4,9]) {
    const response=await app.inject({method:'POST',url:'/api/wellbeing/checkins',headers:auth(),payload:{...checkin,level}});
    assert.equal(response.statusCode,200);assert.equal(response.json().item.level,4);
  }
  assert.equal(pool.records.size,1);
});
test('ownership is derived from token and another user cannot read or update the record',async(t)=>{
  const {app,auth}=await fixture();t.after(()=>app.close());
  await app.inject({method:'POST',url:'/api/wellbeing/sessions',headers:auth(1),payload:{...session,userId:2}});
  const list=await app.inject({method:'GET',url:'/api/wellbeing/sessions',headers:auth(2)});assert.deepEqual(list.json().items,[]);
  const patch=await app.inject({method:'PATCH',url:`/api/wellbeing/sessions/${clientId}/feedback`,headers:auth(2),payload:{feedback:{rating:'helpful'},revision:1}});assert.equal(patch.statusCode,404);
});
test('feedback retries and out-of-order updates cannot overwrite a newer revision',async(t)=>{
  const {app,auth}=await fixture();t.after(()=>app.close());
  await app.inject({method:'POST',url:'/api/wellbeing/sessions',headers:auth(),payload:session});
  for(const [revision,rating]of[[2,'helpful'],[1,'unhelpful'],[2,'neutral']]) {
    const response=await app.inject({method:'PATCH',url:`/api/wellbeing/sessions/${clientId}/feedback`,headers:auth(),payload:{feedback:{rating},revision}});
    assert.equal(response.statusCode,200);assert.equal(response.json().item.feedback.rating,'helpful');assert.equal(response.json().item.revision,2);
  }
});
test('input ranges, date, context and pagination reject malformed requests',async(t)=>{
  const {app,auth}=await fixture();t.after(()=>app.close());
  for(const patch of[{level:0},{level:11},{level:1.5},{level:null},{context:'gps'},{timezoneOffset:900},{note:'a'.repeat(4001)},{occurredAt:'bad'},{clientId:'not-an-id'}]) {
    assert.equal((await app.inject({method:'POST',url:'/api/wellbeing/checkins',headers:auth(),payload:{...checkin,...patch}})).statusCode,400);
  }
  for(const query of['page=0','limit=101','page=1.2','since=invalid']) assert.equal((await app.inject({url:`/api/wellbeing/checkins?${query}`,headers:auth()})).statusCode,400);
  assert.throws(()=>validateRecord('sessions',{...session,elapsedMs:180001}));
});
test('admin list and detail require admin authentication and support date/user filters',async(t)=>{
  const {app,pool,auth}=await fixture();t.after(()=>app.close());
  await app.inject({method:'POST',url:'/api/wellbeing/checkins',headers:auth(),payload:checkin});
  assert.equal((await app.inject({url:'/api/admin/wellbeing/checkins',headers:auth()})).statusCode,403);
  const response=await app.inject({url:'/api/admin/wellbeing/checkins?user_id=1&since=2026-09-01&until=2026-10-01',headers:{'x-admin-token':'admin-test'}});
  assert.equal(response.statusCode,200);assert.equal(response.json().items.length,1);
  assert.ok(pool.calls.some((call)=>call.sql.includes('w.occurred_at >= ?')&&call.sql.includes('w.occurred_at <= ?')&&call.sql.includes('w.user_id = ?')));
  assert.equal((await app.inject({url:'/api/admin/wellbeing/checkins/1',headers:{'x-admin-token':'admin-test'}})).statusCode,200);
  assert.equal((await app.inject({url:'/api/admin/wellbeing/checkins/999',headers:{'x-admin-token':'admin-test'}})).statusCode,404);
});
test('migration is additive with owner-scoped unique IDs and cascading account deletion',async()=>{
  const pool=fakePool();await migrateWellbeing(pool);await migrateWellbeing(pool);
  assert.equal(pool.calls.length,4);
  for(const {sql}of pool.calls){assert.match(sql,/CREATE TABLE IF NOT EXISTS/);assert.match(sql,/UNIQUE KEY.*\(user_id, client_id\)/);assert.match(sql,/ON DELETE CASCADE/);}
});

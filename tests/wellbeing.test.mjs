import test from 'node:test';
import assert from 'node:assert/strict';
import { accessAllowed, breathingPhase, createSessionClock, observedPatterns, recommendations, reminderDate } from '../utils/wellbeingCore.mjs';
import { createWellbeingRepository } from '../utils/wellbeingRepository.mjs';
import { createWellbeingSync } from '../utils/wellbeingSync.mjs';
import { createReminderScheduler, reminderPlan } from '../utils/wellbeingReminder.mjs';

function storage() {
  const records = new Map();
  return { getItem: async (key) => records.get(key) ?? null, setItem: async (key,value) => records.set(key,value), removeItem: async (key) => records.delete(key) };
}
const entry = (id, fields = {}) => ({ clientId:id, occurredAt:'2026-09-30T08:00:00.000Z', timezoneOffset:-180, level:4, ...fields });

test('paid access needs matching owner and finite future expiry; trial never qualifies', () => {
  const now = Date.parse('2026-09-30T10:00:00Z');
  for (const type of ['basic','premium','vip','pro']) assert.equal(accessAllowed({owner:'1',type,status:'active',expiresAt:'2026-10-01T10:00:00Z'},'1',now),true);
  for (const expiresAt of [null,'invalid','2026-09-30T10:00:00Z']) assert.equal(accessAllowed({owner:'1',type:'pro',status:'active',expiresAt},'1',now),false);
  assert.equal(accessAllowed({owner:'2',type:'pro',status:'active',expiresAt:'2026-10-01T10:00:00Z'},'1',now),false);
  assert.equal(accessAllowed({owner:'1',type:'trial',status:'active',expiresAt:'2026-10-01T10:00:00Z'},'1',now),false);
  assert.equal(accessAllowed({owner:'1',type:'basic',status:'active',expiresAt:null},'1',now,true),true);
});
test('clock pauses without consuming time and caps elapsed at duration', () => {
  let now=0;
  const clock=createSessionClock(180000,()=>now);
  clock.resume();now=10000;clock.pause();now=200000;assert.equal(clock.elapsed(),10000);
  clock.resume();clock.resume();now=205000;assert.equal(clock.elapsed(),15000);
  now=600000;clock.pause();assert.equal(clock.elapsed(),180000);clock.resume();assert.equal(clock.running,false);
});
test('phase boundaries share a stable key; held phase and next cycle are distinct', () => {
  assert.equal(breathingPhase(3999).name,'inhale');assert.equal(breathingPhase(4000).name,'exhale');
  assert.equal(breathingPhase(10000).name,'inhale');
  assert.notEqual(breathingPhase(0).key,breathingPhase(10000).key);
  assert.equal(breathingPhase(4000,'4-2-6').name,'hold');assert.equal(breathingPhase(6000,'4-2-6').name,'exhale');
  assert.equal(breathingPhase(12000,'4-2-6').name,'inhale');
});
test('reminder waits 72 hours and selects the first eligible local 18:00', () => {
  const last = new Date(2026,8,20,17,0);
  const date=reminderDate(last,new Date(2026,8,20,18,0));
  assert.equal(date.getDate(),23);assert.equal(date.getHours(),18);
  assert.equal(reminderDate(new Date(2026,8,20,19,0),new Date(2026,8,20,20,0)).getDate(),24);
  assert.equal(reminderDate(new Date(2026,8,20,18,0),new Date(2026,8,20,20,0)).getDate(),23);
  assert.ok(reminderDate(last,new Date(2026,8,25,19)).getTime()>new Date(2026,8,25,19).getTime());
});
test('patterns require 10 samples, groups of 3 and a one-point difference', () => {
  const rows=Array.from({length:10},(_,i)=>entry(String(i),{caffeine:i<5?'none':'much',level:i<5?3:7}));
  assert.deepEqual(observedPatterns(rows.slice(0,9)),[]);
  assert.equal(observedPatterns(rows).find((r)=>r.title==='Cafeina raportată').text.includes('(5 check-in-uri)'),true);
  assert.deepEqual(observedPatterns(rows.map((r)=>({...r,level:4}))),[]);
  assert.deepEqual(observedPatterns(rows.map((r,i)=>({...r,caffeine:i<2?'none':'much'}))),[]);
});
test('hour patterns use recorded timezone rather than current device timezone', () => {
  const rows=Array.from({length:10},(_,i)=>entry(String(i),{occurredAt:i<5?'2026-09-30T08:00:00Z':'2026-09-30T14:00:00Z',timezoneOffset:-300,level:i<5?2:8}));
  assert.match(observedPatterns(rows)[0].text,/Seara/);assert.match(observedPatterns(rows)[0].text,/După-amiaza/);
});
test('recommendations prioritize recent context, then helpful count; no-history is empty', () => {
  const now=Date.parse('2026-09-30T10:00:00Z');
  const sessions=[{occurredAt:'2026-09-29T08:00:00Z',techniques:['breathing'],feedback:{rating:'helpful',context:'home'}},{occurredAt:'2026-09-29T09:00:00Z',techniques:['grounding'],feedback:{rating:'helpful',context:'work'}},{occurredAt:'2026-09-29T10:00:00Z',techniques:['breathing'],feedback:{rating:'helpful',context:'home'}}];
  assert.equal(recommendations(sessions,[entry('check',{context:'work'})],now)[0].technique,'grounding');
  assert.equal(recommendations(sessions,[],now)[0].technique,'breathing');
  assert.deepEqual(recommendations([],[],now),[]);
  assert.equal(recommendations(sessions,[entry('old',{occurredAt:'2026-09-29T08:00:00Z',context:'work'})],now)[0].technique,'breathing');
});
test('serialized writes preserve simultaneous entries and independent preferences', async () => {
  const repo=createWellbeingRepository(storage());
  await Promise.all([repo.save('1','checkins',entry('a')),repo.save('1','checkins',entry('b'))]);
  await Promise.all([repo.update('1',(d)=>({preferences:{...d.preferences,sound:true}})),repo.update('1',(d)=>({preferences:{...d.preferences,haptics:false}}))]);
  const data=await repo.read('1');assert.equal(data.checkins.length,2);assert.deepEqual(data.preferences,{sound:true,haptics:false});
});
test('server merge cannot discard an unsynced entry or newer pending feedback', async () => {
  const repo=createWellbeingRepository(storage());
  await repo.save('1','sessions',entry('session',{feedback:{rating:'helpful'}}));
  await repo.save('1','sessions',entry('session',{feedback:{rating:'neutral'}}));
  await repo.merge('1','sessions',[entry('session',{feedback:null,revision:0}),entry('server',{revision:0})]);
  await repo.acknowledge('1','sessions','session',0);
  const data=await repo.read('1');assert.equal(data.sessions.length,2);assert.equal(data.sessions.find((r)=>r.clientId==='session').pending,true);
  assert.equal(data.sessions.find((r)=>r.clientId==='session').feedback.rating,'neutral');
});
test('account data is isolated; deletion removes only that owner', async () => {
  const repo=createWellbeingRepository(storage());await repo.save('1','checkins',entry('a'));await repo.save('2','checkins',entry('b'));
  await repo.remove('1');assert.equal((await repo.read('1')).checkins.length,0);assert.equal((await repo.read('2')).checkins.length,1);
  await assert.rejects(repo.save('1','sessions',entry('late')),/șterse/);
});
test('offline save survives lost response; retry reuses stable ID and downloads every page', async () => {
  const repo=createWellbeingRepository(storage());await repo.save('1','checkins',entry('a'));
  let attempts=0;const ids=[],pages=[];
  const api={createWellbeing:async(kind,row)=>{ids.push(row.clientId);attempts++;if(attempts===1)throw new Error('lost response');},listWellbeing:async(kind,page)=>{pages.push(`${kind}:${page}`);return{items:[],hasMore:kind==='checkins'&&page===1};}};
  const sync=createWellbeingSync({repository:repo,api,isCurrent:()=>true});
  await assert.rejects(sync({owner:'1',token:'token',generation:1}));assert.equal((await repo.read('1')).checkins[0].pending,true);
  await sync({owner:'1',token:'token',generation:1});assert.deepEqual(ids,['a','a']);assert.equal((await repo.read('1')).checkins[0].pending,false);assert.deepEqual(pages,['checkins:1','checkins:2','sessions:1']);
});
test('sync does not acknowledge a newer edit made while uploading', async () => {
  const repo=createWellbeingRepository(storage());await repo.save('1','sessions',entry('a',{feedback:null}));
  const api={createWellbeing:async()=>repo.save('1','sessions',entry('a',{feedback:{rating:'helpful'}})),listWellbeing:async()=>({items:[],hasMore:false})};
  await createWellbeingSync({repository:repo,api,isCurrent:()=>true})({owner:'1',token:'t',generation:1});
  assert.equal((await repo.read('1')).sessions[0].pending,true);
});
test('account switch cancels subsequent sync writes and downloads', async () => {
  const repo=createWellbeingRepository(storage());await repo.save('1','checkins',entry('a'));let current=true;
  const api={createWellbeing:async()=>{current=false;},listWellbeing:async()=>assert.fail('must not download another account')};
  await createWellbeingSync({repository:repo,api,isCurrent:()=>current})({owner:'1',token:'t',generation:1});assert.equal((await repo.read('1')).checkins[0].pending,true);
});
test('periodic retries upload the outbox without redownloading the full history', async () => {
  const repo=createWellbeingRepository(storage());await repo.save('1','checkins',entry('a'));
  const api={createWellbeing:async()=>{},listWellbeing:async()=>assert.fail('periodic outbox retry must not download history')};
  await createWellbeingSync({repository:repo,api,isCurrent:()=>true})({owner:'1',token:'t',generation:1,pull:false});
  assert.equal((await repo.read('1')).checkins[0].pending,false);
});
test('failed local write is reported rather than pretending it saved', async () => {
  const memory=storage();memory.setItem=async()=>{throw new Error('disk full');};
  const repo=createWellbeingRepository(memory);await assert.rejects(repo.save('1','checkins',entry('a')),/disk full/);
});

test('reminder opt-out, expiry, already-delivered and changed check-in policies', () => {
  const now=new Date('2026-09-30T10:00:00Z');
  const data={preferences:{reminder:true},access:{owner:'1',type:'pro',status:'active',expiresAt:'2026-10-10T10:00:00Z'},checkins:[entry('old',{occurredAt:'2026-09-28T08:00:00Z'})],reminderAnchor:'2026-09-30T08:00:00Z'};
  assert.equal(reminderPlan(data,'1',now).anchor,'2026-09-28T08:00:00Z');
  assert.equal(reminderPlan({...data,preferences:{reminder:false}},'1',now),null);
  assert.equal(reminderPlan({...data,access:{...data.access,expiresAt:'2026-09-30T11:00:00Z'}},'1',now),null);
  const delivered={...data,reminderScheduledFor:data.checkins[0].occurredAt,reminderScheduledAt:'2026-09-29T18:00:00Z'};
  assert.equal(reminderPlan(delivered,'1',now),null);
  assert.ok(reminderPlan({...delivered,checkins:[entry('new',{occurredAt:'2026-09-30T09:00:00Z'})]},'1',now));
});
test('scheduler keeps one notification, reprograms after check-in, cancels on logout or opt-out', async () => {
  const repo=createWellbeingRepository(storage()),scheduled=new Map();let current=true,creates=0;
  const native={SchedulableTriggerInputTypes:{DATE:'date'},getPermissionsAsync:async()=>({status:'granted'}),getAllScheduledNotificationsAsync:async()=>[...scheduled.values()],cancelScheduledNotificationAsync:async(id)=>scheduled.delete(id),scheduleNotificationAsync:async(item)=>{creates++;scheduled.set(item.identifier,item);}};
  await repo.update('1',{preferences:{reminder:true},access:{owner:'1',type:'pro',status:'active',expiresAt:'2026-10-10T10:00:00Z'},reminderAnchor:'2026-09-30T08:00:00Z'});
  const scheduler=createReminderScheduler({repository:repo,notifications:native,isCurrent:()=>current,ensureChannel:async()=>{},now:()=>new Date('2026-09-30T10:00:00Z')});
  await scheduler.schedule('1',1);await scheduler.schedule('1',1);assert.equal(creates,1);assert.equal(scheduled.size,1);
  await repo.save('1','checkins',entry('new',{occurredAt:'2026-09-30T09:00:00Z'}));await scheduler.schedule('1',1);assert.equal(creates,2);assert.equal(scheduled.size,1);
  await repo.update('1',{preferences:{reminder:false}});await scheduler.schedule('1',1);assert.equal(scheduled.size,0);
  await repo.update('1',{preferences:{reminder:true}});await scheduler.schedule('1',1);current=false;await scheduler.cancel();assert.equal(scheduled.size,0);
  await scheduler.schedule('1',1);assert.equal(scheduled.size,0);
});

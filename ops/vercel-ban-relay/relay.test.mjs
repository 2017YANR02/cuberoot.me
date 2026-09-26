import { test } from 'node:test';
import assert from 'node:assert/strict';
import { absorb, managedRule, SOURCES } from './relay.ts';
const now = Date.parse('2026-09-26T07:00:00Z');
const event = { startTime: '2026-09-26 06:55:00.000', public_ip: '198.51.100.1', ruleId: [...SOURCES][0], action: 'deny' };
test('30-day expiry, repeated events do not extend, expiry is removed', () => {
 const s = absorb({ cursor: now, bans: {} }, [event], now);
 assert.equal(s.bans[event.public_ip], Date.parse('2026-10-26T06:55:00Z'));
 absorb(s, [{...event,startTime:'2026-09-27 06:55:00.000'}], now+86400000);
 assert.equal(s.bans[event.public_ip], Date.parse('2026-10-26T06:55:00Z'));
 absorb(s, [], Date.parse('2026-10-26T06:55:00Z')); assert.deepEqual(s.bans, {});
});
test('ignore unrelated rules, non-deny events, invalid IPs and future timestamps', () => {
 const invalid = [{...event,ruleId:'unrelated'}, {...event, action:'challenge'}, {...event,public_ip:'bad'}, {...event,startTime:'invalid'}, {...event,startTime:'2027-01-01 00:00:00'}];
 assert.deepEqual(absorb({cursor:now,bans:{}}, invalid, now).bans, {});
});
test('CN excluded, exact IPs only, empty lists disabled and bounded', () => {
 const r=managedRule(['198.51.100.1']); assert.equal(r.action.mitigate.actionDuration,null);
 assert.deepEqual(r.conditionGroup[0].conditions[1],{type:'geo_country',op:'neq',value:'CN'});
 assert.equal(managedRule([]).active,false); assert.throws(()=>managedRule(Array(1876).fill('198.51.100.1')));
});

test('IP lists fit Vercel 75 values and 25 groups limits without widening addresses', () => {
 const ips=Array.from({length:1875},(_,i)=>`10.0.${Math.floor(i/250)}.${i%250+1}`);
 const r=managedRule(ips);assert.equal(r.conditionGroup.length,25);
 assert.ok(r.conditionGroup.every(g=>g.conditions[0].value.length<=75 && g.conditions[1].value==='CN'));
 assert.deepEqual(r.conditionGroup.flatMap(g=>g.conditions[0].value),ips);
 assert.equal(managedRule([],1).name,'Rolling 30-day incident IP bans 2');
});

test('relay publishes chunked rules, verifies order, avoids redundant writes and retains events on write failure', async () => {
 const {mkdtempSync,writeFileSync,readFileSync}=await import('node:fs');
 const {tmpdir}=await import('node:os');const {join}=await import('node:path');const {run}=await import('./relay.ts');
 const dir=mkdtempSync(join(tmpdir(),'cuberoot-relay-test-'));const config=join(dir,'config.json');
 writeFileSync(config,JSON.stringify({projectId:'test',teamId:'test',token:'test-only'}));
 const previousConfig=process.env.CUBEROOT_BAN_CONFIG,previousState=process.env.CUBEROOT_BAN_STATE_DIR,fetchBefore=global.fetch;
 process.env.CUBEROOT_BAN_CONFIG=config;process.env.CUBEROOT_BAN_STATE_DIR=dir;
 const current=Date.now(),source=[...SOURCES][0];
 const events=Array.from({length:1900},(_,i)=>({startTime:new Date(current-60000).toISOString(),public_ip:`10.1.${Math.floor(i/250)}.${i%250+1}`,ruleId:source,action:'deny'}));
 let rules=[{id:'rule_china_mainland_traffic_exemption_aOC64j',name:'CN',valid:true}];let writes=0,fail=false;
 global.fetch=async(url,init)=>{
  const u=new URL(url);let result={};
  if(u.pathname.endsWith('/events')) result={actions:events.filter((_,i)=>i%20===Math.floor(Number(u.searchParams.get('startTimestamp'))/60000)%20)};
  else if(init.method==='PATCH') {
   writes++; if(fail)return Response.json({error:'simulated'},{status:500});
   const body=JSON.parse(init.body);
   if(body.value?.conditionGroup) for(const g of body.value.conditionGroup)assert.ok(g.conditions[0].value.length<=75);
   if(body.action==='rules.insert')rules.push({...body.value,id:'managed-'+rules.length,valid:true});
   else if(body.action==='rules.update') rules=rules.map(r=>r.id===body.id?{...body.value,id:body.id,valid:true}:r);
   else if(body.action==='rules.priority'){const index=rules.findIndex(r=>r.id===body.id);const [r]=rules.splice(index,1);rules.splice(body.value,0,r);}
  } else result={rules};
  return Response.json(result);
 };
 try {
  writeFileSync(join(dir,'state.json'),JSON.stringify({cursor:current-22*60000,bans:{}}));
  await run();const first=JSON.parse(readFileSync(join(dir,'state.json')));assert.equal(Object.keys(first.bans).length,1900);assert.equal(rules.length,3);assert.equal(rules[1].name,MANAGED_NAME_FOR_TEST());
  const written=writes;await run();assert.equal(writes,written);assert.deepEqual(JSON.parse(readFileSync(join(dir,'state.json'))).bans,first.bans);
  events.push({...events[0],public_ip:'203.0.113.199'});fail=true;
  // Force inclusion in one of the upcoming overlap windows.
  const s=JSON.parse(readFileSync(join(dir,'state.json')));s.cursor=current-22*60000;writeFileSync(join(dir,'state.json'),JSON.stringify(s));
  await assert.rejects(run(),/HTTP 500/);assert.ok(JSON.parse(readFileSync(join(dir,'state.json'))).bans['203.0.113.199']);
 } finally {global.fetch=fetchBefore;if(previousConfig===undefined)delete process.env.CUBEROOT_BAN_CONFIG;else process.env.CUBEROOT_BAN_CONFIG=previousConfig;if(previousState===undefined)delete process.env.CUBEROOT_BAN_STATE_DIR;else process.env.CUBEROOT_BAN_STATE_DIR=previousState;}
});
function MANAGED_NAME_FOR_TEST(){return 'Rolling 30-day incident IP bans';}

test('capacity follows actual slots, reserves two rules, and queues without dropping records', async () => {
 const {planCapacity}=await import('./relay.ts');const ips=Array.from({length:67847},(_,i)=>String(i));
 const plan=planCapacity(ips,10,13);assert.equal(plan.count,28);assert.equal(plan.capacity,52500);assert.equal(plan.admitted.length,52500);assert.equal(plan.pending,15347);assert.equal(ips.length,67847);
 assert.deepEqual(plan.admitted,ips.slice(0,52500));
 assert.equal(planCapacity([],10,13).count,13);
 assert.equal(planCapacity(ips,10,30).capacity,56250);
 assert.throws(()=>planCapacity(ips,40,0),/No custom/);
 assert.throws(()=>planCapacity(ips,40,1),/capacity exceeded/);
});

test('a full queue still publishes admitted IPs and removes expired bans on the next sync', async () => {
 const {mkdtempSync,writeFileSync,readFileSync}=await import('node:fs');const {tmpdir}=await import('node:os');const {join}=await import('node:path');const {run}=await import('./relay.ts');
 const dir=mkdtempSync(join(tmpdir(),'cuberoot-capacity-test-'));const config=join(dir,'config.json');writeFileSync(config,JSON.stringify({projectId:'test',teamId:'test',token:'test-only'}));
 const previous={config:process.env.CUBEROOT_BAN_CONFIG,state:process.env.CUBEROOT_BAN_STATE_DIR,bark:process.env.BARK_KEY,fetch:global.fetch};
 process.env.CUBEROOT_BAN_CONFIG=config;process.env.CUBEROOT_BAN_STATE_DIR=dir;delete process.env.BARK_KEY;
 const now=Date.now(),ips=Array.from({length:4000},(_,i)=>`10.2.${Math.floor(i/250)}.${i%250+1}`);const bans=Object.fromEntries(ips.map(ip=>[ip,now+86400000]));
 let rules=[{id:'rule_china_mainland_traffic_exemption_aOC64j',name:'CN',valid:true},...Array.from({length:36},(_,i)=>({id:'other-'+i,name:'Other '+i,valid:true}))];
 global.fetch=async(url,init)=>{const u=new URL(url);if(u.pathname.endsWith('/events'))return Response.json({actions:[]});if(init.method==='PATCH'){const b=JSON.parse(init.body);if(b.action==='rules.insert')rules.push({...b.value,id:'managed',valid:true});if(b.action==='rules.update')rules=rules.map(r=>r.id===b.id?{...b.value,id:b.id,valid:true}:r);if(b.action==='rules.priority'){const [r]=rules.splice(rules.findIndex(r=>r.id===b.id),1);rules.splice(b.value,0,r);}return Response.json({});}return Response.json({rules});};
 const installed=()=>rules[1].conditionGroup.flatMap(g=>g.conditions[0].value);
 try {writeFileSync(join(dir,'state.json'),JSON.stringify({cursor:now,bans}));await run();assert.equal(rules.length,38);assert.deepEqual(installed(),ips.slice(0,1875));let state=JSON.parse(readFileSync(join(dir,'state.json')));assert.equal(Object.keys(state.bans).length,4000);assert.ok(state.lastSyncedAt);
 for(const ip of ips.slice(0,10))state.bans[ip]=now-1;writeFileSync(join(dir,'state.json'),JSON.stringify(state));await run();assert.deepEqual(installed(),ips.slice(10,1885));assert.equal(Object.keys(JSON.parse(readFileSync(join(dir,'state.json'))).bans).length,3990);
 }finally{global.fetch=previous.fetch;for(const [key,value] of [['CUBEROOT_BAN_CONFIG',previous.config],['CUBEROOT_BAN_STATE_DIR',previous.state],['BARK_KEY',previous.bark]]){if(value===undefined)delete process.env[key];else process.env[key]=value;}}
});

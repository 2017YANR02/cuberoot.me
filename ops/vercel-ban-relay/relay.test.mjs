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
 assert.equal(managedRule([]).active,false); assert.throws(()=>managedRule(Array(10001).fill('198.51.100.1')));
});

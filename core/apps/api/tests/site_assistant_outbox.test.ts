import { expect, it, vi } from 'vitest';
import { applyAssistantCompletion } from '../src/utils/site_assistant_outbox.js';

const id='aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
const now=new Date().toISOString();

it('replays the legacy nine-parameter completion with an empty private context',async()=>{
  const run=vi.fn().mockResolvedValue([]);
  await applyAssistantCompletion({id,createdAt:now,params:['success',null,now,10,null,'answer',{sources:[]},{},id]},run);
  expect(run.mock.calls[0][1]).toHaveLength(10);
  expect(run.mock.calls[0][1][8]).toBeNull();
  expect(run.mock.calls[0][1][9]).toBe(id);
});

it('scrubs private context and answer payloads when an outbox completion is past retention',async()=>{
  const run=vi.fn().mockResolvedValue([]),old=new Date(Date.now()-31*86400_000).toISOString();
  await applyAssistantCompletion({id,createdAt:old,params:['success',null,now,10,null,'answer',{sources:[]},{},{version:1},id]},run);
  expect(run.mock.calls[0][1][5]).toBeNull();
  expect(run.mock.calls[0][1][6]).toBeNull();
  expect(run.mock.calls[0][1][8]).toBeNull();
});

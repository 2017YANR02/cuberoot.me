import {expect,it} from 'vitest';
import {previewProgress} from '../src/routes/dev_preview_progress';
const now=Date.parse('2026-11-17T08:00:00Z');
const worker={request_id:'mine',expires_at:new Date(now+60_000),updated_at:new Date(now),progress:{stage:'https',state:'waiting',jobs:[{name:'Deploy Core',state:'queued',runId:123,secret:'hidden'}]}};
it('normal deployment queueing is never reported as a retry or leaked to a different request',()=>{
  const result=previewProgress('mine','provisioning',{...worker,attempt:4},now);
  expect(result).toMatchObject({stage:'https',state:'waiting',attempt:0,retryAt:null,jobs:[{name:'Deploy Core',state:'queued',runId:123}]});
  expect(JSON.stringify(result)).not.toContain('hidden');
  expect(previewProgress('another','provisioning',worker,now)).toBeNull();
  expect(previewProgress('mine','ready',worker,now)).toBeNull();
});
it('distinguishes a real scheduled retry from a lost worker lease',()=>{
  const expired={...worker,expires_at:new Date(now-1)};
  expect(previewProgress('mine','provisioning',expired,now)?.state).toBe('waiting_worker');
  expect(previewProgress('mine','provisioning',{...expired,progress:{...worker.progress,state:'retrying'},retry_at:now+30_000,attempt:2},now)).toMatchObject({state:'retrying',retryAt:'2026-11-17T08:00:30.000Z',attempt:2});
});
it('accepts legacy checkpoints without inventing a failure and sanitizes untrusted links',()=>{
  expect(previewProgress('mine','provisioning',{...worker,progress:undefined,https_sha:'commit'},now)).toMatchObject({stage:'https',state:'waiting'});
  expect(previewProgress('mine','provisioning',{...worker,progress:{stage:'unknown',jobs:[{name:'evil',state:'queued',runId:1},{name:'Deploy Core',state:'running',runId:'javascript:bad'}]}},now)?.jobs).toEqual([{name:'Deploy Core',state:'running',runId:null}]);
});

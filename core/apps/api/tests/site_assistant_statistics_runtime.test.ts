import { createHash } from 'node:crypto';
import { expect, it, vi } from 'vitest';
import { readStatisticsRuntime, statisticsRuntimePrefetchIds } from '../src/utils/site_assistant_statistics_runtime.js';
import { runDataTool, toolCallSchema } from '../src/utils/site_assistant_tools.js';
import { boundAssistantToolResult } from '../src/utils/site_assistant_evidence.js';
import { answerSiteQuestion } from '../src/utils/site_assistant.js';
import { modelResponse, wireEvidence } from './fixtures/site_assistant_model.js';

const started = '2026-11-15T20:00:00Z', previous = '2026-11-13T20:00:00Z', finished = '2026-11-13T22:00:00Z';
const sha = 'a'.repeat(40), hash = 'b'.repeat(64);
const run = (id: number, date: string, event = 'schedule', conclusion = 'success') => ({ id, run_attempt: 1, event, head_branch: 'main', path: '.github/workflows/stats.yml', status: 'completed', conclusion, created_at: date, run_started_at: date, head_sha: sha });
const steps = ['Compute all statistics', 'Build historical ranks snapshot', 'Build SOR over-time DAILY race JSON', 'Apply historical ranks on server', 'Publish latest statistics snapshot'];
const jobs = (skip = false) => ({ total_count: 1, jobs: [{ name: 'build', status: 'completed', conclusion: 'success', completed_at: finished,
  steps: steps.map(name => ({ name, status: 'completed', conclusion: skip ? 'skipped' : 'success', completed_at: finished })) }] });
const inventory = { schema: 1, kind: 'snapshot', sourceCommit: sha, generatedAt: '2026-11-15T23:00:00Z', files: [{ path: 'index.json', bytes: 2, sha256: hash }] };
const version = createHash('sha256').update(JSON.stringify(inventory.files)).digest('hex');
const receipt = { schema: 1, archiveSha256: 'c'.repeat(64), inventoryVersion: version, sourceCommit: sha, publishedAt: '2026-11-15T23:10:00Z', timestampBasis: 'publication-finalized' };
const baseRead = async (url: string): Promise<any> => {
  if (url.includes('/runs?')) {
    if (url.includes('event=workflow_dispatch')) return { workflow_runs: url.includes('status=success') ? [run(2, started, 'workflow_dispatch')] : [] };
    return { workflow_runs: url.includes('status=success') ? [run(1, previous)] : [run(3, started, 'schedule', 'failure'), run(99, started, 'push')] };
  }
  if (url.includes('/runs/3/')) return { total_count: 1, jobs: [{ name: 'build', status: 'completed', conclusion: 'failure', completed_at: started, steps: [{ name: 'Check server capacity before computation', status: 'completed', conclusion: 'failure', completed_at: started }] }] };
  if (url.includes('/runs/2/')) return jobs(true); // Successful extra-only dispatch is not full statistics success.
  if (url.includes('/runs/1/')) return jobs();
  if (url.endsWith('/_inventory.json')) return inventory;
  if (url.endsWith('/publication.json')) return receipt;
  if (url.endsWith('/historical-ranks/meta')) return { lastImportedAt: '2026-11-14T21:00:00Z' };
  if (url.endsWith('/nemesizer/meta.json')) return { generatedAt: previous, exportDate: '2026-11-13' };
  if (url.endsWith('/double-zbll/manifest.json')) return { schema: 1, version: 'd'.repeat(16), dataSha256: hash, casesSha256: hash, generatedAt: previous };
  throw new Error('Unexpected endpoint');
};
const data = (result: Awaited<ReturnType<typeof readStatisticsRuntime>>) => result.evidence as any;
it('focuses named-family runtime reads while preserving complete inventories', () => {
  expect(statisticsRuntimePrefetchIds('WCA 统计最近成功了吗？')).toEqual(['wca-heavy', 'wca-history']);
  expect(statisticsRuntimePrefetchIds('双底 ZBLL 当前发布版本？')).toEqual(['double-zbll']);
  expect(statisticsRuntimePrefetchIds('所有统计最近运行成功了吗？')).toEqual([undefined]);
});
it('separates latest failure, actual successful computation, active publication and PG import', async () => {
  const read = vi.fn(baseRead);
  const result = await readStatisticsRuntime({}, 'zh', read);
  const entries = data(result).entries;
  const latest = entries.find((e: any) => e.kind === 'last-run');
  expect(latest.lastRun.runId).toBe(3); expect(latest.lastRun.conclusion).toBe('failure');
  expect(latest.lastRun.failedStage).toEqual(['Check server capacity before computation']);
  expect(entries.filter((e: any) => e.kind === 'last-success').map((e: any) => [e.runId, e.lastSuccessAt])).toEqual([[1, finished], [1, finished]]);
  expect(entries.find((e: any) => e.id === 'statistics-runtime:active-snapshot').publishedDataVersion).toBe(version);
  expect(entries.find((e: any) => e.kind === 'publication-receipt').lastPublishedAt).toBe(receipt.publishedAt);
  expect(entries.find((e: any) => e.kind === 'database-import').lastImportedAt).toBe('2026-11-14T21:00:00Z');
  expect(entries.find((e: any) => e.kind === 'source-cutoff').sourceDataCutoff).toBe('2026-11-13');
  expect(boundAssistantToolResult(result, 14000)).toBe(result);
  expect(read.mock.calls.filter(([url]) => url.includes('/runs/1/'))).toHaveLength(1);
  expect(read.mock.calls.every(([url]) => !/\.tgz|\.bin|\/logs/.test(url))).toBe(true);
});
it('keeps current data when GitHub is down and never substitutes import time for successful run time', async () => {
  const result = await readStatisticsRuntime({}, 'en', async url => { if (url.startsWith('https://api.github.com')) throw Error('rate limited'); return baseRead(url); });
  expect(data(result).entries.some((e: any) => e.kind === 'last-success')).toBe(false);
  expect(data(result).entries.some((e: any) => e.kind === 'publication')).toBe(true);
  expect(data(result).entries.some((e: any) => e.kind === 'database-import')).toBe(true);
  expect(data(result).gaps.some((g: any) => g.scope === 'wca-last-run')).toBe(true);
});
it.each(['missing', 'mismatch'])('preserves active version with unknown publication time for a %s receipt', async mode => {
  const result = await readStatisticsRuntime({ id: 'scramble' }, 'en', async url => {
    if (url.endsWith('/publication.json')) { if (mode === 'missing') throw Error('404'); return { ...receipt, inventoryVersion: 'f'.repeat(64) }; }
    return baseRead(url);
  });
  expect(data(result).entries.find((e: any) => e.kind === 'publication').publishedDataVersion).toBe(version);
  expect(data(result).entries.find((e: any) => e.kind === 'publication').lastPublishedAt).toBe('unknown');
  expect(data(result).entries.some((e: any) => e.kind === 'publication-receipt')).toBe(false);
});
it('retains known last-run status if jobs cannot be read', async () => {
  const result = await readStatisticsRuntime({ id: 'wca-heavy' }, 'en', async url => { if (url.includes('/runs/3/')) throw Error('503'); return baseRead(url); });
  expect(data(result).entries.find((e: any) => e.kind === 'last-run').lastRun).toMatchObject({ conclusion: 'failure', failedStage: 'unknown', finishedAt: 'unknown' });
});
it('never infers most-recent success across an unreadable newer candidate', async () => {
  const result = await readStatisticsRuntime({ id: 'wca-heavy' }, 'en', async url => { if (url.includes('/runs/2/')) throw Error('503'); return baseRead(url); });
  expect(data(result).entries.some((e: any) => e.kind === 'last-success')).toBe(false);
  expect(data(result).gaps).toContainEqual({ scope: 'wca-heavy-last-success', reason: 'history_incomplete' });
});
it('does not claim a latest run when either event listing is missing', async () => {
  const result = await readStatisticsRuntime({ id: 'wca-heavy' }, 'en', async url => { if (url.includes('event=workflow_dispatch') && !url.includes('status=success')) throw Error('503'); return baseRead(url); });
  expect(data(result).entries.some((e: any) => e.kind === 'last-run')).toBe(false);
  expect(data(result).entries.some((e: any) => e.kind === 'last-success')).toBe(true);
});
it('does not silently skip a malformed newer run to claim an older one is latest', async () => {
  const result = await readStatisticsRuntime({ id: 'wca-heavy' }, 'en', async url => {
    if (url.includes('event=schedule') && !url.includes('status=success')) return { workflow_runs: [{ ...run(4, started), id: 'invalid' }, run(3, previous)] };
    return baseRead(url);
  });
  expect(data(result).entries.some((e: any) => e.kind === 'last-run')).toBe(false);
  expect(data(result).entries.some((e: any) => e.kind === 'last-success')).toBe(true);
});
it('rejects malformed inventory and keeps independently verified run evidence', async () => {
  const result = await readStatisticsRuntime({ id: 'wca-heavy' }, 'en', async url => url.endsWith('_inventory.json') ? { ...inventory, files: [{ ...inventory.files[0], path: '../secret' }] } : baseRead(url));
  expect(data(result).entries.some((e: any) => e.kind === 'publication')).toBe(false);
  expect(data(result).entries.some((e: any) => e.kind === 'last-success')).toBe(true);
});
it('keeps disconnected local jobs unknown without borrowing a WCA workflow result', async () => {
  const read = vi.fn(baseRead);
  const result = await runDataTool(toolCallSchema.parse({ tool: 'statistics_metadata', id: 'lsll', view: 'runtime' }) as any, 'en', read);
  expect(data(result).entries).toEqual([]); expect(read).not.toHaveBeenCalled();
  expect(data(result).gaps).toContainEqual({ scope: 'lsll-local-runs', reason: 'local_run_receipts_not_uploaded' });
});
it('keeps runtime sources paired with retained evidence when context is bounded', async () => {
  const result = boundAssistantToolResult(await readStatisticsRuntime({}, 'zh', baseRead), 4000);
  expect(data(result).entries.length).toBeGreaterThan(0);
  expect(data(result).contextIncomplete).toBe(true);
  expect(result.sources.map(s => s.id)).toEqual(data(result).entries.map((e: any) => e.sourceId));
});
it('prefetches and cites fresh runtime facts through the complete answer path', async () => {
  const config = { key: 'fixture', baseUrl: 'https://model.example/v1', model: 'test' };
  const fetcher = vi.fn<typeof fetch>(async (input, init) => {
    if (!String(input).startsWith(config.baseUrl)) return Response.json(await baseRead(String(input)));
    const evidence = wireEvidence(JSON.parse(String(init?.body)));
    expect(evidence.some((item: any) => item.tool?.view === 'runtime')).toBe(true);
    return modelResponse({ answerKind: 'site_content', answer: '最近运行失败，失败步骤是容量检查。 [[statistics-runtime:wca-last-run]] 最近成功流程是 11 月 13 日。 [[statistics-runtime:wca-heavy-last-success]] 当前静态版本另见快照。 [[statistics-runtime:active-snapshot]]', sourceIds: ['statistics-runtime:wca-last-run', 'statistics-runtime:wca-heavy-last-success', 'statistics-runtime:active-snapshot'] });
  });
  const result = await answerSiteQuestion('WCA 统计最近运行成功了吗，当前发布版本是什么？', 'zh', config, AbortSignal.timeout(5000), fetcher);
  expect(result.answer).toContain('最近运行失败'); expect(result.answer).toContain(version); expect(result.sources).toHaveLength(3);
});

it('preformats the previous local calendar day without replacing raw instants', async () => {
  const result=await readStatisticsRuntime({id:'wca-heavy'},'zh',async url=>{
    const value=await baseRead(url);
    if(url.includes('/runs/1/')) value.jobs[0].completed_at='2026-11-13T07:44:24Z';
    return value;
  },Date.now,'America/Los_Angeles');
  const success=data(result).entries.find((e:any)=>e.kind==='last-success');
  expect(success.lastSuccessAt).toBe('2026-11-13T07:44:24Z');
  expect(success.displayTimes.lastSuccessAt).toBe('2026-11-12 23:44:24 GMT-8 (America/Los_Angeles)');
});
it.each([false,true])('repairs runtime prose omissions even with every source selected; still incomplete=%s', async stillIncomplete => {
  const config={key:'fixture',baseUrl:'https://dashscope.aliyuncs.com/compatible-mode/v1',model:'qwen3.8-flash'};let calls=0;
  const ids=['statistics-runtime:wca-last-run','statistics-runtime:wca-heavy-last-success','statistics-runtime:active-snapshot','statistics-runtime:historical-database'];
  const fetcher=vi.fn<typeof fetch>(async(input,init)=>{
    if(!String(input).startsWith(config.baseUrl))return Response.json(await baseRead(String(input)));
    const request=JSON.parse(String(init?.body));expect(request.tools??[]).toEqual([]);calls++;
    expect(request.enable_thinking).toBe(calls===1);
    if(calls===2)expect(request.messages.at(-1).content).toContain('previous prose omitted');
    const answer=calls===1 || stillIncomplete ? '最近运行失败，原因是在' : '最近运行失败。 [[statistics-runtime:wca-last-run]] 最近成功为 2026-11-13。 [[statistics-runtime:wca-heavy-last-success]] 当前版本 '+version+'。 [[statistics-runtime:active-snapshot]] 数据库导入为 2026-11-14，与成功时间不同。 [[statistics-runtime:historical-database]]';
    return modelResponse({answerKind:'grounded',answer,sourceIds:ids});
  });
  const result=answerSiteQuestion('WCA 统计最近运行、最近成功和当前版本是什么？数据库导入时间相同吗？','zh',config,AbortSignal.timeout(5000),fetcher,[],undefined,undefined,'UTC',[],'deep');
  if(stillIncomplete)await expect(result).rejects.toMatchObject({code:'model_output_invalid'});
  else expect((await result).answer).toContain('与成功时间不同');
  expect(calls).toBe(2);
});
it('repairs a broken deep JSON object without repeating its reasoning pass', async () => {
  const config={key:'fixture',baseUrl:'https://dashscope.aliyuncs.com/compatible-mode/v1',model:'qwen3.8-flash'};let calls=0;
  const fetcher=vi.fn<typeof fetch>(async(input,init)=>{
    if(!String(input).startsWith(config.baseUrl))return Response.json(await baseRead(String(input)));
    const request=JSON.parse(String(init?.body));calls++;expect(request.enable_thinking).toBe(calls===1);
    if(calls===1)return Response.json({id:'test',created:1,model:'test',choices:[{index:0,finish_reason:'stop',message:{role:'assistant',content:JSON.stringify({answerKind:'grounded',answer:'当前版本为',unexpected:'misplaced prose'})}}]});
    return modelResponse({answerKind:'grounded',answer:version+' [[statistics-runtime:active-snapshot]]',sourceIds:['statistics-runtime:active-snapshot']});
  });
  const result=await answerSiteQuestion('WCA 统计当前线上版本是什么？','zh',config,AbortSignal.timeout(5000),fetcher,[],undefined,undefined,'UTC',[],'deep');
  expect(result.answer).toContain(version);expect(calls).toBe(2);
});
it('passes the visitor timezone through tool dispatch and observes daylight saving time', async () => {
  const result=await runDataTool(toolCallSchema.parse({tool:'statistics_metadata',id:'double-zbll',view:'runtime'}) as any,'en',async url=>({...await baseRead(url),generatedAt:'2026-07-01T00:30:00Z'}),undefined,undefined,'America/Los_Angeles');
  const entry=data(result).entries[0];
  expect(entry.generatedAt).toBe('2026-07-01T00:30:00Z');
  expect(entry.displayTimes.generatedAt).toBe('2026-06-30 17:30:00 GMT-7 (America/Los_Angeles)');
  expect(entry.lastPublishedAt).toBe('unknown');
  expect(entry.displayTimes.lastPublishedAt).toBeUndefined();
});

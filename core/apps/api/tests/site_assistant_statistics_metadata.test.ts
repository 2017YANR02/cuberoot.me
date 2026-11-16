import { afterEach, expect, it, vi } from 'vitest';
import { answerSiteQuestion, requestedAssistantEvidence } from '../src/utils/site_assistant.js';
import { readStatisticsMetadata, assistantPageAudience, statisticsMetadataFollowUp } from '../src/utils/site_assistant_statistics_metadata.js';
import { runDataTool, toolCallSchema } from '../src/utils/site_assistant_tools.js';
import { boundAssistantToolResult } from '../src/utils/site_assistant_evidence.js';
import { modelResponse, wireEvidence } from './fixtures/site_assistant_model.js';

const config = { key: 'fixture', baseUrl: 'https://model.example/v1', model: 'test' };
afterEach(() => vi.unstubAllEnvs());

it.each([
  '目前站内有哪些统计是计算量很大的？分别以什么方式更新？',
  '哪些统计最耗 CPU？', '平均榜怎样更新？', 'LSLL 的最优解如何生成？',
  '统计是不是打开页面才计算？', '统计最近成功更新了吗？',
  'WCA 统计最近运行成功了吗？', '统计线上版本是什么？',
  'Which statistics are computationally expensive and how are they updated?',
])('routes maintenance questions to the complete metadata catalog: %s', question => {
  expect(requestedAssistantEvidence(question)).toBe('statistics_metadata');
  expect(assistantPageAudience(question)).toBe('developer');
});
it.each(['谁的平均最快？', '三阶单次世界纪录是多少？', '统计连续登台最多的选手', 'Which competitor has the fastest average?'])('preserves result queries: %s', question => {
  expect(requestedAssistantEvidence(question)).toBe('auto');
});
it('retains page evidence obligations for UI instructions', () => {
  expect(requestedAssistantEvidence('站内统计如何更新，以及如何使用统计筛选？')).toBe('pages');
  expect(requestedAssistantEvidence('只给我统计更新说明页面的链接')).toBe('navigation');
  expect(assistantPageAudience('请根据页面解释求解器实现原理')).toBe('developer');
  expect(assistantPageAudience('计时器怎么用')).toBe('user');
});
it('resolves these-statistics follow-ups without treating old answers as evidence', () => {
  const followUp='这些是不是打开页面才计算？';
  expect(requestedAssistantEvidence(statisticsMetadataFollowUp(followUp,'站内有哪些重计算统计？'))).toBe('statistics_metadata');
  expect(statisticsMetadataFollowUp(followUp,'谁的平均最快？')).toBe(followUp);
  expect(statisticsMetadataFollowUp('现在谁的平均最快？','站内有哪些重计算统计？')).toBe('现在谁的平均最快？');
});

it('returns every registered family within the actual prefetch budget, without network or computation', async () => {
  const read = vi.fn().mockRejectedValue(new Error('must not fetch'));
  const call = toolCallSchema.parse({ tool: 'statistics_metadata', scope: 'all' });
  const result = await runDataTool(call as any, 'zh', read);
  const bounded = boundAssistantToolResult(result, 14000);
  const data = bounded.evidence as any;
  expect(bounded).toBe(result);
  expect(data.total).toBe(7); expect(data.returned).toBe(data.total);
  expect(data.completeRegisteredCatalog).toBe(true);
  expect(data.entries.map((entry: any) => entry.id)).toEqual(['wca-heavy', 'wca-history', 'scramble', 'exact-distributions', 'lsll', 'double-zbll', 'solver-tables']);
  expect(new Set(result.sources.map(source => source.id)).size).toBe(7);
  expect(read).not.toHaveBeenCalled();
  expect(data.runtime.status).toBe('not_loaded');
  expect(data.coverage.gaps).toContain('Local run receipts not uploaded');
  expect(data.entries.find((entry: any) => entry.id === 'wca-heavy').cost).toContain('NOT a CPU ranking');
  expect(data.entries.find((entry: any) => entry.id === 'double-zbll').cost).toContain('without loading solver tables');
});
it('distinguishes configuration from runtime and supplies real provenance on a focused read', () => {
  const result = readStatisticsMetadata({ id: 'wca-heavy' }, 'en');
  const data = result.evidence as any;
  expect(data.returned).toBe(1); expect(data.completeRegisteredCatalog).toBe(false);
  expect(data.entries[0].workflow.cron).toEqual(['0 20 * * *']);
  expect(data.entries[0].workflow.jobConditions.build).toBe("github.event_name == 'schedule' || github.event_name == 'workflow_dispatch'");
  expect(data.entries[0].heavyStatIds).toContain('round_top3_sum');
  expect(data.entries[0].provenance.every((source: any) => /^[0-9a-f]{64}$/.test(source.sha256))).toBe(true);
  expect(data.runtime.status).toBe('not_loaded');
});
it('rejects arbitrary paths, writes and invented family IDs without fabricating evidence', () => {
  for (const call of [{ tool: 'statistics_metadata', id: '../../private' }, { tool: 'statistics_metadata', run: true }, { tool: 'statistics_metadata', scope: 'all', id: 'lsll' }]) expect(toolCallSchema.safeParse(call).success).toBe(false);
  const result = readStatisticsMetadata({ id: 'not-registered' }, 'zh');
  expect(result.sources).toEqual([]); expect(result.outcome?.reason).toBe('metadata_missing');
});
it('drops source IDs for metadata entries removed by the context budget', () => {
  const result = boundAssistantToolResult(readStatisticsMetadata({ scope: 'all' }, 'zh'), 4000);
  const data = result.evidence as any;
  expect(data.contextIncomplete).toBe(true);
  expect(result.sources.map(source => source.id)).toEqual(data.entries.map((entry: any) => entry.sourceId));
  expect(result.sources.length).toBeLessThan(7);
});

it('answers the original question from metadata even when labelled site_content, without a page request', async () => {
  const requests: any[] = [];
  const sourceIds = readStatisticsMetadata({}, 'zh').sources.map(source => source.id);
  const answer = 'WCA 重聚合与历史统计按工作流更新；打乱统计补缺续算后发布；精确分布、LSLL、双底题库分别维护；求解表复用。最近运行状态未接入。 ' + sourceIds.map(id => `[[${id}]]`).join(' ');
  const fetcher = vi.fn<typeof fetch>(async (input, init) => {
    expect(String(input)).toMatch(/^https:\/\/model\.example\//);
    const request = JSON.parse(String(init?.body)); requests.push(request);
    const evidence = wireEvidence(request);
    expect(evidence.some((item: any) => item.tool?.tool === 'statistics_metadata')).toBe(true);
    return modelResponse({ answerKind: 'site_content', answer, sourceIds });
  });
  const result = await answerSiteQuestion('目前站内有哪些统计是计算量很大的？分别以什么方式更新？', 'zh', config, AbortSignal.timeout(5000), fetcher);
  expect(result.answer).toBe(answer); expect(result.sources).toHaveLength(7);
  expect(requests.length).toBe(1); // Existing pipeline composes directly from raw evidence in review mode.
});
it('preserves supported metadata when a supplemental service is unavailable', async () => {
  let rounds = 0;
  const sourceId = 'statistics-metadata:double-zbll';
  const fetcher = vi.fn<typeof fetch>(async input => {
    if (!String(input).startsWith(config.baseUrl)) return new Response('', { status: 503 });
    if (++rounds === 1) return modelResponse([{ tool: 'pages', query: '双底 ZBLL 更新', audience: 'developer', pageIds: [] }]);
    return modelResponse({ answerKind: 'site_content', answer: `双底 ZBLL 摘要读取已有题库，不加载求解大表。 [[${sourceId}]] 补充页面无法读取，最近执行状态未知。`, sourceIds: [sourceId] });
  });
  const result = await answerSiteQuestion('双底 ZBLL 统计如何更新？', 'zh', config, AbortSignal.timeout(5000), fetcher);
  expect(result.answer).toContain('不加载求解大表'); expect(result.answer).toContain('状态未知');
  expect(result.sources.map(source => source.id)).toEqual([sourceId]);
});
it('still rejects invented inline citations after metadata evidence is available', async () => {
  const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => modelResponse({ answerKind: 'site_content', answer: '统计今天已全部发布。 [[fabricated]]', sourceIds: ['statistics-metadata:wca-heavy'] }));
  const result = await answerSiteQuestion('统计如何更新？', 'zh', config, AbortSignal.timeout(5000), fetcher);
  expect(result.answer).not.toContain('今天已全部发布'); expect(result.sources).toEqual([]);
});
it('does not let metadata stand in for UI instructions on a mixed question', async () => {
  vi.stubEnv('SITE_ASSISTANT_KNOWLEDGE_ENABLED', '0');
  const fetcher = vi.fn<typeof fetch>(async input => {
    if (!String(input).startsWith(config.baseUrl)) return new Response('', { status: 404 });
    return modelResponse({ answerKind: 'site_content', answer: '点击一键更新就能全量计算。 [[statistics-metadata:scramble]]', sourceIds: ['statistics-metadata:scramble'] });
  });
  const result = await answerSiteQuestion('站内统计如何更新，以及如何使用统计筛选？', 'zh', config, AbortSignal.timeout(5000), fetcher);
  expect(result.answer).not.toContain('点击一键更新'); expect(result.sources).toEqual([]);
});

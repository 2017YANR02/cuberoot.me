import { afterEach, describe, expect, it, vi } from 'vitest';
import { answerSiteQuestion } from '../src/utils/site_assistant.js';
import { runAnalysisQuery } from '../src/utils/site_assistant_analysis_db.js';
import { modelResponse } from './fixtures/site_assistant_model.js';

vi.mock('../src/utils/site_assistant_analysis_db.js', async importOriginal => ({
  ...(await importOriginal<object>()), runAnalysisQuery: vi.fn(),
}));

const config = { key: 'test-secret', baseUrl: 'https://model.example/v1', model: 'qwen3.8-flash' };
const source = { id: 'analysis:comparison', title: '参赛次数比较', href: '/wca/results', read: true };
const table = { kind: 'table' as const, title: source.title, columns: ['今年', '去年', '变化'], rows: [['26', '30', '-4']] };
afterEach(() => vi.restoreAllMocks());

describe('reviewed analysis answer presentation', () => {
  it.each([
    ['今年参加了 26 场，比去年少 4 场；今年统计截至目前。', '今年参加了 26 场，比去年少 4 场；今年统计截至目前。 [[analysis:comparison]]'],
    ['今年参加了 26 场。[analysis:comparison]', '今年参加了 26 场。[[analysis:comparison]]'],
    ['', '现场计算结果见下表。 [[analysis:comparison]]'],
  ])('preserves the reviewed conclusion and uses a summary only for empty prose: %s', async (answer, expected) => {
    vi.mocked(runAnalysisQuery).mockResolvedValue({
      sources: [source], factualSummary: '现场计算结果见下表。', artifacts: [table],
      evidence: { rows: table.rows },
    });
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(modelResponse({ calls: [
        { tool: 'analysis_schema', datasets: ['results'] },
        { tool: 'analysis_query', title: source.title, description: 'Distinct competitions and their difference', query: {} },
      ] }))
      .mockResolvedValueOnce(modelResponse({ answerKind: 'grounded', answer: '初步结果。', sourceIds: [source.id] }))
      .mockResolvedValueOnce(modelResponse({ answerKind: 'grounded', answer, sourceIds: [source.id], reviewedSourceIds: [source.id] }));
    const result = await answerSiteQuestion('比较我今年和去年的参赛次数', 'zh', config, AbortSignal.timeout(5000), fetcher, [], '2017YANR02');
    expect(result.answer).toBe(expected);
    expect(result.sources).toEqual([source]);
    expect(result.artifacts).toEqual([table]);
    expect(fetcher).toHaveBeenCalledTimes(3);
  });
});

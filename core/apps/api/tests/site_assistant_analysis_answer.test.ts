import { afterEach, describe, expect, it, vi } from 'vitest';
import { answerSiteQuestion } from '../src/utils/site_assistant.js';
import { runAnalysisQuery } from '../src/utils/site_assistant_analysis_db.js';
import { modelResponse } from './fixtures/site_assistant_model.js';
import { championQuery } from './fixtures/site_assistant_champions.js';

vi.mock('../src/utils/site_assistant_analysis_db.js', async importOriginal => ({
  ...(await importOriginal<object>()), runAnalysisQuery: vi.fn(),
}));

const config = { key: 'test-secret', baseUrl: 'https://model.example/v1', model: 'qwen3.8-flash' };
const source = { id: 'analysis:comparison', title: '参赛次数比较', href: '/wca/results', read: true };
const table = { kind: 'table' as const, title: source.title, columns: ['今年', '去年', '变化'], rows: [['26', '30', '-4']] };
afterEach(() => { vi.restoreAllMocks();vi.useRealTimers(); });

describe('reviewed analysis answer presentation', () => {
  it.each([false,true])('uses only the selected reviewed query and preserves multiple selected analyses: %s',async selectBoth=>{
    vi.useFakeTimers();vi.setSystemTime(new Date('2024-03-04T12:00:00Z'));
    const winnerSource={...source,id:'analysis:winners',title:'冠军名单'};
    const winnerTable={kind:'table' as const,title:winnerSource.title,columns:['比赛','选手','平均'],rows:[['Alpha Open','First Person','8.2']]};
    vi.mocked(runAnalysisQuery)
      .mockResolvedValueOnce({sources:[source],artifacts:[table],evidence:{truncated:false,rows:table.rows}})
      .mockResolvedValueOnce({sources:[winnerSource],artifacts:[winnerTable],evidence:{truncated:false,rows:winnerTable.rows}});
    const sourceIds=selectBoth?[source.id,winnerSource.id]:[winnerSource.id];
    const fetcher=vi.fn<typeof fetch>()
      .mockResolvedValueOnce(modelResponse({calls:[{tool:'analysis_schema',datasets:['results','persons','competitions']},
        {tool:'analysis_query',title:source.title,description:'Earlier analysis',query:{from:{dataset:'results',as:'r'},select:[{as:'count',label:'Count',expr:{fn:'count',args:[]}}]}},
        {tool:'analysis_query',title:winnerSource.title,description:'Winners',query:championQuery}]}))
      .mockResolvedValueOnce(modelResponse({answerKind:'grounded',answer:'保留两份分析的说明。',sourceIds,reviewedSourceIds:sourceIds}));
    const result=await answerSiteQuestion('上周末谁拿了冠军？','zh',config,AbortSignal.timeout(5000),fetcher);
    expect(result.answer).toBe(selectBoth
      ? `保留两份分析的说明。 [[${source.id}]] [[${winnerSource.id}]]`
      : '2024-03-02~03 期间举办的比赛，三阶决赛冠军如下：[[analysis:winners]]');
    expect(result.artifacts).toEqual(selectBoth?[table,winnerTable]:[winnerTable]);
    const review=JSON.parse(String(fetcher.mock.calls[1][1]?.body));
    expect(review.messages[0].content).toContain('Every requested calculated measure');
    expect(JSON.parse(review.messages[1].content).draftAnswer).toBeUndefined();
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it.each([true,false])('uses the actual winner query only after the table is reviewed: %s',async reviewed=>{
    vi.useFakeTimers();vi.setSystemTime(new Date('2024-03-04T12:00:00Z'));
    const winnerSource={...source,id:'analysis:winners',title:'冠军名单'};
    const winnerTable={kind:'table' as const,title:winnerSource.title,columns:['比赛','选手','平均'],rows:[['Alpha Open','First Person','8.2'],['Beta Open','Second Person','7.5']]};
    vi.mocked(runAnalysisQuery).mockResolvedValue({sources:[winnerSource],artifacts:[winnerTable],evidence:{truncated:false,rows:winnerTable.rows}});
    const prose='最快是第三位；赛历其余 30 场尚未导入决赛。';
    const fetcher=vi.fn<typeof fetch>()
      .mockResolvedValueOnce(modelResponse({calls:[{tool:'analysis_schema',datasets:['results','persons','competitions']},{tool:'analysis_query',title:winnerSource.title,description:'A description is not evidence',query:championQuery}]}))
      .mockResolvedValueOnce(modelResponse({answerKind:'grounded',answer:prose,sourceIds:[winnerSource.id],reviewedSourceIds:reviewed?[winnerSource.id]:[]}));
    const result=await answerSiteQuestion('上周末谁拿了冠军？','zh',config,AbortSignal.timeout(5000),fetcher);
    if(reviewed) {
      expect(result.answer).toBe('2024-03-02~03 期间举办的比赛，三阶决赛冠军如下：[[analysis:winners]]');
      expect(result.artifacts).toEqual([winnerTable]);
      expect(result.sources).toEqual([winnerSource]);
    } else {
      expect(result.answer).toContain('未通过核验');
      expect(result.artifacts).toEqual([]);
    }
    expect(result.answer).not.toContain('30');
    expect(result.answer).not.toContain('最快');
  });

  it.each([
    ['今年参加了 26 场，比去年少 4 场；今年统计截至目前。', '今年参加了 26 场，比去年少 4 场；今年统计截至目前。 [[analysis:comparison]]'],
    ['今年参加了 26 场。[analysis:comparison]', '今年参加了 26 场。[[analysis:comparison]]'],
    ['', '现场计算结果见下表。 [[analysis:comparison]]'],
  ])('preserves the reviewed conclusion and repairs empty prose before displaying the table: %s', async (answer, expected) => {
    vi.mocked(runAnalysisQuery).mockResolvedValue({
      sources: [source], factualSummary: '现场计算结果见下表。', artifacts: [table],
      evidence: { rows: table.rows },
    });
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(modelResponse({ calls: [
        { tool: 'analysis_schema', datasets: ['results'] },
        { tool: 'analysis_query', title: source.title, description: 'Distinct competitions and their difference', query: {} },
      ] }))
      .mockResolvedValueOnce(modelResponse({ answerKind: 'grounded', answer, sourceIds: [source.id], reviewedSourceIds: [source.id] }));
    if(!answer)fetcher.mockResolvedValueOnce(modelResponse({answerKind:'grounded',answer:'现场计算结果见下表。',sourceIds:[source.id],reviewedSourceIds:[source.id]}));
    const result = await answerSiteQuestion('比较我今年和去年的参赛次数', 'zh', config, AbortSignal.timeout(5000), fetcher, [], '2017YANR02');
    expect(result.answer).toBe(expected);
    expect(result.sources).toEqual([source]);
    expect(result.artifacts).toEqual([table]);
    expect(fetcher).toHaveBeenCalledTimes(answer?2:3);
    if(!answer) {
      const repair=JSON.parse(String(fetcher.mock.calls[2][1]?.body));
      expect(repair.tools).toBeUndefined();
      expect(repair.messages.at(-1).content).toContain('a non-empty plain string');
    }
  });
});

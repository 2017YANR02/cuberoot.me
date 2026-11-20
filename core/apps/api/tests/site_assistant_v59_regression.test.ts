import { expect, it, vi } from 'vitest';
import { answerSiteQuestion, requestedAssistantEvidence } from '../src/utils/site_assistant.js';
import { assistantPlanSemanticViolation, resolveAssistantPlanShape } from '../src/utils/site_assistant_plan.js';
import fixtures from './fixtures/assistant-v59-as.json';

type Sample = typeof fixtures[keyof typeof fixtures];
function replay(row: Sample, draft: unknown, repair = draft) {
  const reply = (value: unknown) => Response.json({
    choices: [{ index: 0, finish_reason: 'stop', message: { role: 'assistant', content: JSON.stringify(value) } }],
  });
  const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(reply(draft)).mockImplementation(async () => reply(repair));
  const history = row.history.map(({ role, content }) => ({ role: role === 'user' ? 'user' as const : 'assistant' as const, content }));
  return {fetcher, result: answerSiteQuestion(row.question, row.lang === 'en' ? 'en' : 'zh',
    { key: 'fixture', baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-flash' }, AbortSignal.timeout(5000), fetcher, history)};
}

it.each(fixtures.AS01.drafts)('keeps the two timed checks and independent invitation in call $call', async ({value}) => {
  const {fetcher, result} = replay(fixtures.AS01, value);
  const {answer} = await result;
  expect(answer).toMatch(/^1\. Live check[^\n]*: \d+ seconds\n[\s\S]*\n2\. Replay check[^\n]*: \d+ seconds\n[\s\S]*\n\n(?:and )?Noor[^\n]*Tuesday[?.]$/);
  expect(answer.split(/\n\n/)).toHaveLength(2);
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it('keeps timed practice out of the site-page evidence route', () => {
  expect(requestedAssistantEvidence(fixtures.AS03.question)).toBe('auto');
  expect(requestedAssistantEvidence('本站的计时器可以导出成绩吗？')).toBe('pages');
});

it.each(fixtures.AS03.drafts.slice(0,2))('accepts visually checked alternatives without a deep repair in call $call', async ({value}) => {
  const {fetcher, result} = replay(fixtures.AS03, value);
  expect((await result).answer).toMatch(/肉眼核对[\s\S]*R2[\s\S]*肉眼核对[\s\S]*B′/);
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(JSON.parse(String(fetcher.mock.calls[0][1]?.body)).thinking).toEqual({type: 'disabled'});
});

it('rejects an undeclared backup or an insertion after failure', () => {
  const {question, history, drafts} = fixtures.AS03;
  const scopedQuestion = history[0].content+'\n'+question;
  for(const bad of ['R2，转完再做熟悉的插入','D2']) {
    const plan = structuredClone(drafts[0].value.plan);
    plan.activities[1].steps[0].action = plan.activities[1].steps[0].action.replace('改做一次 B′','改做一次 '+bad);
    expect(assistantPlanSemanticViolation(scopedQuestion,'',question,plan)).toBeDefined();
  }
});

it('accepts exact earlier user quotes and uses their time once the exercises are executable', async () => {
  const row = fixtures.AS04;
  const draft = structuredClone(row.drafts[1].value);
  for(const [index,turn] of ['U2','D′'].entries()) {
    draft.plan.activities[index].steps[0].action = `Try to set up the familiar case and look at the edge, corner, and target slot. Only if they visibly match, perform the known insertion once; otherwise do one slow ${turn} turn and stop.`;
  }
  const {fetcher,result} = replay(row,draft);
  expect((await result).answer).toMatch(/target slot[\s\S]*U2[\s\S]*target slot[\s\S]*D′/);
  const body = JSON.stringify(fetcher.mock.calls[0][1]?.body);
  expect(body).toContain('There are 96 seconds available.');
  expect(fetcher).toHaveBeenCalledTimes(1);
  const badQuote = structuredClone(draft);
  badQuote.plan.inputs[0].quote = row.history[1].content;
  await expect(replay(row,badQuote).result).rejects.toMatchObject({code: 'model_output_invalid'});
});

it.each([0,2])('uses the actual rendered word range and shows all four timed steps (%i)', async index => {
  const row = fixtures.AS06;
  const {fetcher,result} = replay(row,row.drafts[index].value,row.drafts[index+1].value);
  const {answer} = await result;
  const words = answer.trim().split(/\s+/).length;
  expect(words).toBeGreaterThanOrEqual(148);
  expect(words).toBeLessThanOrEqual(169);
  expect(answer.match(/^  - \d+ seconds:/gm)).toHaveLength(4);
  expect(answer).toMatch(/say[\s\S]*uncover[\s\S]*write[\s\S]*uncover/i);
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it.each(fixtures.AS13.drafts)('supersedes the old count without losing the old sheet in call $call', async ({value}) => {
  const row = fixtures.AS13;
  expect(resolveAssistantPlanShape(row.question,[row.history[0].content]).shape).toMatchObject({activities:3,substepsPerActivity:2});
  const {fetcher,result} = replay(row,value);
  const {answer} = await result;
  expect(answer.match(/^\d+\. /gm)).toHaveLength(3);
  expect(answer.match(/^  - \d+ 秒:/gm)).toHaveLength(6);
  expect(fetcher).toHaveBeenCalledTimes(1);
});

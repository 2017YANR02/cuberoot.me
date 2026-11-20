import { expect, it, vi } from 'vitest';
import { answerSiteQuestion } from '../src/utils/site_assistant.js';
import { assistantPlanShape, assistantPlanSemanticViolation } from '../src/utils/site_assistant_plan.js';
import fixtures from './fixtures/assistant-v56-ap.json';

type Sample = typeof fixtures[keyof typeof fixtures];
const replay = (row: Sample, draft: unknown, repair = draft) => {
  let attempt = 0;
  const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => Response.json({
    choices: [{ index: 0, finish_reason: 'stop', message: { role: 'assistant', content: JSON.stringify(attempt++ ? repair : draft) } }],
  }));
  const history = row.history.map(({ role, content }) => ({ role: role === 'user' ? 'user' as const : 'assistant' as const, content }));
  const result = answerSiteQuestion(row.question, row.lang === 'en' ? 'en' : 'zh',
    { key: 'fixture', baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-flash' },
    AbortSignal.timeout(5000), fetcher, history);
  return { fetcher, result };
};

it.each(fixtures.AP02.drafts)('renders timed headings and keeps the final invitation in call $call', async ({ value }) => {
  const { fetcher, result } = replay(fixtures.AP02, value);
  const { answer } = await result;
  expect(answer).toMatch(/^1\. .+: \d+ seconds\n[\s\S]*\n2\. .+: \d+ seconds\n[\s\S]*\n\nInez, (?:could you|please) film both tests tomorrow[?.]$/);
  expect(answer.split(/\n\n/)).toHaveLength(2);
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it('preserves the requested 64-second limit and local sentence count', async () => {
  const row = fixtures.AP02;
  const draft = row.drafts[1].value;
  for (const answer of [draft.answer.replace('check: 34 seconds', 'check: 35 seconds'), draft.answer + ' Bring a tripod.']) {
    await expect(replay(row, { ...draft, answer }).result).rejects.toMatchObject({ code: 'model_output_invalid' });
  }
});

it.each(fixtures.AP03.drafts)('keeps visual enumeration in call $call and repairs the missing setup', async ({ value }) => {
  const row = fixtures.AP03;
  expect(assistantPlanSemanticViolation(row.question, '', row.history[0].content, value.plan)).toBe('plan_case_setup_missing');
  const repair = structuredClone(value);
  for (const activity of repair.plan.activities) {
    const step = activity.steps[0];
    step.action = '先尝试摆位。' + step.action.replace(/^(?:先不转，|重新)/, '');
  }
  const { fetcher, result } = replay(row, value, repair);
  expect((await result).answer).toMatch(/F2[\s\S]*B′/);
  expect(fetcher).toHaveBeenCalledTimes(2);
  const body = JSON.parse(String(fetcher.mock.calls[1][1]?.body));
  expect(body.thinking).toEqual({ type: 'disabled' });
});

it('requires visual confirmation and a known move in the backup branch', () => {
  const { question, history, drafts } = fixtures.AP03;
  const source = history[0].content;
  const plan = structuredClone(drafts[0].value.plan);
  const step = plan.activities[1].steps[0];
  for (const action of [
    step.action.replace(/用眼睛逐项看[^；;]+[；;]/, ''),
    step.action.replaceAll('B′', 'R2'),
    step.action + '然后做一次已会的插入。',
  ]) {
    const altered = structuredClone(plan);
    altered.activities[1].steps[0].action = action;
    expect(assistantPlanSemanticViolation(question, '', source, altered)).toMatch(/^plan_(?:fallback_branch_missing|slow_turn_alternative_missing)$/);
  }
});

it.each(fixtures.AP06.drafts)('compacts redundant reasons in call $call and preserves actions', async ({ value }) => {
  const { fetcher, result } = replay(fixtures.AP06, value);
  const { answer } = await result;
  expect(answer.trim().split(/\s+/).length).toBeGreaterThanOrEqual(137);
  expect(answer.trim().split(/\s+/).length).toBeLessThanOrEqual(161);
  for (const activity of value.plan.activities) {
    for (const step of activity.steps) expect(answer).toContain(step.action);
  }
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it('replaces the earlier two-activity contract and retains two timed steps per activity', async () => {
  const { question, drafts } = fixtures.AP13;
  expect(assistantPlanShape(question)).toMatchObject({ activities: 3, substepsPerActivity: 2 });
  const { fetcher, result } = replay(fixtures.AP13, drafts[0].value, drafts[1].value);
  const { answer } = await result;
  expect(answer.match(/^\d+[.)、]\s/gm)).toHaveLength(3);
  expect(answer.match(/^  - /gm)).toHaveLength(6);
  expect(fetcher).toHaveBeenCalledTimes(2);
});

it('routes the Chinese hand tests to direct contact observation guidance', async () => {
  const { fetcher, result } = replay(fixtures.AP01, fixtures.AP01.drafts[0].value);
  await result;
  expect(fetcher).toHaveBeenCalledTimes(1);
  const body = JSON.parse(String(fetcher.mock.calls[0][1]?.body));
  expect(JSON.stringify(body.messages)).toContain('a real gap between fingertip and sticker');
  expect(body.thinking).toEqual({ type: 'disabled' });
});

it('uses the existing sheet and changes only the covered column', async () => {
  const { fetcher, result } = replay(fixtures.AP07, fixtures.AP07.drafts[0].value);
  const { answer } = await result;
  expect(answer).toContain('保持词表同一面朝上');
  expect(answer).not.toMatch(/若词表未列出|翻回同一面/);
  expect(answer).toContain('先在纸上手写对应的葡萄牙语原词');
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it.each(fixtures.AP10.drafts)('requires individual reset and timed substeps for call $call', async ({ value }) => {
  const repair = structuredClone(value);
  const written = repair.plan.activities[1];
  written.steps[0].action = '把两张卡都摆成中文面朝上，逐张先看中文，在纸上手写英文，再翻到英文面核对，随即把这张卡翻回中文面，才进入下一张。';
  written.steps[1].action = '若有拼错的卡，只重练那些卡：逐张看中文、在纸上先写英文、翻到英文面核对、立即把这张卡翻回中文面；若全对就结束。';
  const { fetcher, result } = replay(fixtures.AP10, value, repair);
  const { answer } = await result;
  expect(answer.match(/^  - \d+ 秒:/gm)).toHaveLength(4);
  expect(answer).toContain('核对，随即把这张卡翻回中文面，才进入下一张');
  expect(fetcher).toHaveBeenCalledTimes(2);
});

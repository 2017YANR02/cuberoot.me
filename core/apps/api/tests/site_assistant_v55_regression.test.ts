import { expect, it, vi } from 'vitest';
import { answerSiteQuestion } from '../src/utils/site_assistant.js';
import fixtures from './fixtures/assistant-v55-ao.json';

const config = { key: 'fixture', baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-flash' };
type Sample = typeof fixtures[keyof typeof fixtures];
const replay = (row: Sample, draft: unknown) => {
  const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => Response.json({
    choices: [{ index: 0, finish_reason: 'stop', message: { role: 'assistant', content: JSON.stringify(draft) } }],
  }));
  const result = answerSiteQuestion(row.question, row.lang === 'en' ? 'en' : 'zh', config,
    AbortSignal.timeout(5000), fetcher, row.history.map(({ role, content }) => ({ role: role === 'user' ? 'user' : 'assistant', content })));
  return { fetcher, result };
};

it.each(fixtures.AO03.drafts)('accepts separate verified and fallback outcomes in call $call', async ({ value }) => {
  const { fetcher, result } = replay(fixtures.AO03, value);
  expect((await result).answer).toMatch(/(?:做|改做)一次(?:慢速)? U2[\s\S]*再做(?:一次)? F′/);
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it.each(fixtures.AO12.drafts)('uses the original same-sheet user quote in call $call', async ({ value }) => {
  const { fetcher, result } = replay(fixtures.AO12, value);
  const { answer } = await result;
  expect(answer).not.toMatch(/[\r\n]/);
  expect(answer).toMatch(/cover the German column[\s\S]*uncover[\s\S]*cover the Catalan column[\s\S]*uncover/i);
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it.each(fixtures.AO09.drafts)('keeps the whole-deck repeat when the first round has no mistakes in call $call', async ({ value }) => {
  const { fetcher, result } = replay(fixtures.AO09, value);
  expect((await result).answer).toMatch(/若没有写错，就进入第二项从中文面重做整套/);
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it.each(fixtures.AO08.drafts)('does not mistake a reference to a completed flip for a new flip in call $call', async ({ value }) => {
  const { fetcher, result } = replay(fixtures.AO08, value);
  expect((await result).answer).toMatch(/return that same card picture-side up[\s\S]*restore that same card picture-side up/);
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it('continues rejecting a fallback followed by an insertion', async () => {
  const value = structuredClone(fixtures.AO03.drafts[0].value);
  value.plan.activities[1].steps[0].action = value.plan.activities[1].steps[0].action.replace('不再插入或检查槽位', '然后做一次已会的插入');
  await expect(replay(fixtures.AO03, value).result).rejects.toMatchObject({ code: 'model_output_invalid' });
});

it('continues rejecting a quote from the assistant instead of the user', async () => {
  const value = structuredClone(fixtures.AO12.drafts[0].value);
  value.plan.inputs[0].quote = fixtures.AO12.history[1].content;
  await expect(replay(fixtures.AO12, value).result).rejects.toMatchObject({ code: 'model_output_invalid' });
});

it('continues rejecting a new repetition before restoring the picture face', async () => {
  const { value } = fixtures.AO08.drafts[0];
  const answer = value.answer.replace(/, then return that same card picture-side up to a discard pile/, '');
  await expect(replay(fixtures.AO08, { ...value, answer }).result).rejects.toMatchObject({ code: 'model_output_invalid' });
});

it('continues rejecting a zero-error branch that selects only missed cards', async () => {
  const value = structuredClone(fixtures.AO09.drafts[0].value);
  const first = value.plan.activities[0].steps[0];
  first.action = first.action.replace('进入第二项从中文面重做整套', '重做错卡');
  await expect(replay(fixtures.AO09, value).result).rejects.toMatchObject({ code: 'model_output_invalid' });
});

import { expect, it, vi } from 'vitest';
import { answerSiteQuestion } from '../src/utils/site_assistant.js';
import { normalizeAssistantCardCheckFace, normalizeAssistantWordSheetTransitions } from '../src/utils/site_assistant_plan.js';
import fixtures from './fixtures/assistant-v58-ar.json';

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

it.each(fixtures.AR05.drafts)('distinguishes a layer label preceding sticker selection in call $call', async ({value}) => {
  const {fetcher, result} = replay(fixtures.AR05, value);
  expect((await result).answer).toMatch(/B\s*层选[\s\S]*B2[\s\S]*D\s*层选[\s\S]*D′/);
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it.each([0,2])('fits the original or repaired word sheet to the requested length (%i)', async index => {
  const row = fixtures.AR06;
  const repair = row.drafts[index+1].value;
  const {fetcher, result} = replay(row, row.drafts[index].value, repair);
  const {answer} = await result;
  expect(answer.trim().split(/\s+/).length).toBeGreaterThanOrEqual(145);
  expect(answer.trim().split(/\s+/).length).toBeLessThanOrEqual(168);
  expect(answer.match(/^  - \d+ seconds:/gm)).toHaveLength(4);
  expect(answer).toMatch(/uncover to check[\s\S]*write the Estonian[\s\S]*uncover to check/);
  expect(fetcher.mock.calls.length).toBeLessThanOrEqual(2);
});

it.each([1,3])('fits the slightly oversized model repair locally (%i)', async index => {
  const row = fixtures.AR06;
  const {fetcher, result} = replay(row, row.drafts[index].value);
  expect((await result).answer.trim().split(/\s+/).length).toBeLessThanOrEqual(168);
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it.each(fixtures.AR10.drafts)('preserves the Chinese back for forward recall and checks English on the other face in call $call', ({value}) => {
  const normalized = normalizeAssistantCardCheckFace(value.plan,fixtures.AR10.question);
  expect(normalized?.activities[0]).toEqual(value.plan.activities[0]);
  expect(normalized?.activities[1].steps[0].action).toContain('翻到英文面核对拼写');
});

it('renders the prepared deck and keeps the two reverse timed steps', async () => {
  const row = fixtures.AR10;
  const {fetcher, result} = replay(row,row.drafts[0].value,row.drafts[1].value);
  const {answer} = await result;
  expect(answer).toMatch(/口头说出中文[\s\S]*翻到背面核对[\s\S]*写出英文[\s\S]*翻到英文面核对拼写/);
  expect(answer.match(/^  - \d+ 秒:/gm)).toHaveLength(4);
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it('continues rejecting the batch reset after correcting the reverse check face', async () => {
  const row = fixtures.AR10;
  await expect(replay(row,row.drafts[2].value,row.drafts[3].value).result).rejects.toMatchObject({code: 'model_output_invalid'});
});

it('keeps a legitimate back-face check when English was written on the back', () => {
  const row = fixtures.AR10;
  const plan = structuredClone(row.drafts[1].value.plan);
  plan.activities[0].steps[0].action = '在正面写中文释义，在背面写对应英文。';
  expect(normalizeAssistantCardCheckFace(plan,row.question)).toBeUndefined();
});

it.each(fixtures.AR12.drafts.slice(0,2))('exposes the new cue when switching directions in call $call', async ({value}) => {
  const {fetcher, result} = replay(fixtures.AR12, value);
  const {answer} = await result;
  expect(answer).toContain('cover the WORD column, uncover the MEANING column, read each MEANING');
  expect(answer).toContain('for a word-to-meaning attempt uncover the WORD column and cover the MEANING column');
  expect(answer).not.toMatch(/[\r\n]/);
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it('preserves the rejection of an actual unlisted turn and truly hidden cues', async () => {
  const slow = fixtures.AR05;
  const bad = structuredClone(slow.drafts[0].value);
  bad.plan.activities[0].steps[0].action = bad.plan.activities[0].steps[0].action.replace('做一次B2','做一次B');
  await expect(replay(slow,bad).result).rejects.toMatchObject({code:'model_output_invalid'});
  const conflicting = 'Cover the MEANING column, read each MEANING and write the WORD.';
  expect(normalizeAssistantWordSheetTransitions(conflicting)).toBe(conflicting);
});

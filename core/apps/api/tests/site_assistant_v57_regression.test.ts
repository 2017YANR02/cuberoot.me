import { expect, it, vi } from 'vitest';
import { answerSiteQuestion } from '../src/utils/site_assistant.js';
import fixtures from './fixtures/assistant-v57-aq.json';

type Case = typeof fixtures[keyof typeof fixtures];
function replay(row: Case, draft: unknown, repair = draft) {
  const reply = (value: unknown) => Response.json({
    choices: [{ index: 0, finish_reason: 'stop', message: { role: 'assistant', content: JSON.stringify(value) } }],
  });
  const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(reply(draft)).mockImplementation(async () => reply(repair));
  const history = row.history.map(({role, content}) => ({ role: role === 'user' ? 'user' as const : 'assistant' as const, content }));
  const result = answerSiteQuestion(row.question, 'zh',
    {key: 'fixture', baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-flash'},
    AbortSignal.timeout(5000), fetcher, history);
  return {fetcher, result};
}

it.each(fixtures.AQ03.drafts)('accepts the earlier user turn with listed moves in call $call', async ({value}) => {
  const {fetcher, result} = replay(fixtures.AQ03, value);
  expect((await result).answer).toMatch(/D2[\s\S]*R′/);
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it.each(fixtures.AQ13.drafts)('accepts the original word sheet quote in call $call', async ({value}) => {
  const {fetcher, result} = replay(fixtures.AQ13, value);
  const {answer} = await result;
  expect(answer.match(/^\d+\. /gm)).toHaveLength(3);
  expect(answer.match(/^  - \d+ 秒:/gm)).toHaveLength(6);
  expect(answer).not.toContain('若词表尚未列出');
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it.each(fixtures.AQ05.drafts)('distinguishes the selected layer from the turn in call $call', async ({value}) => {
  const {fetcher, result} = replay(fixtures.AQ05, value);
  expect((await result).answer).toMatch(/R层[\s\S]*慢做R2[\s\S]*U层[\s\S]*慢做U′/);
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it.each(fixtures.AQ09.drafts)('recognizes the prepared opposite faces in call $call', async ({value}) => {
  const {fetcher, result} = replay(fixtures.AQ09, value);
  expect((await result).answer).toMatch(/翻面核对[\s\S]*翻回中文面[\s\S]*全套/);
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it.each(fixtures.AQ10.drafts.slice(0,2))('distinguishes flipping to write card references in call $call', async ({value}) => {
  const {fetcher, result} = replay(fixtures.AQ10, value);
  const {answer} = await result;
  expect(answer).toMatch(/birch[\s\S]*桦树[\s\S]*逐卡翻到英文面核对刚写的拼写，核对完把该卡翻回中文面/);
  expect(answer.match(/^  - \d+ 秒:/gm)).toHaveLength(4);
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it('keeps rejecting a wrong activity shape and a delayed batch reset', async () => {
  const row = fixtures.AQ10;
  await expect(replay(row,row.drafts[2].value,row.drafts[3].value).result).rejects.toMatchObject({code: 'model_output_invalid'});
});

it('keeps rejecting assistant quotes, turns outside the allowed list and unwritten card backs', async () => {
  const sheet = fixtures.AQ13;
  const badQuote = structuredClone(sheet.drafts[0].value);
  badQuote.plan.inputs[0].quote = sheet.history[1].content;
  const slow = fixtures.AQ05;
  const badMove = {...slow.drafts[0].value, answer: slow.drafts[0].value.answer.replace('慢做R2','慢做R层')};
  const cards = fixtures.AQ10;
  const badLayout = structuredClone(cards.drafts[0].value);
  const setup = badLayout.plan.activities[0].steps[0];
  setup.action = setup.action.replace('，翻面各写 桦树 与 云杉','');
  for (const [row,draft] of [[sheet,badQuote],[slow,badMove],[cards,badLayout]] as const) {
    await expect(replay(row,draft).result).rejects.toMatchObject({code: 'model_output_invalid'});
  }
});

it('checks the original per-activity and total time after normalizing legacy headings', async () => {
  const row = fixtures.AQ05;
  const draft = row.drafts[0].value;
  const aboveActivityCap = draft.answer.replace('一（34秒）','一（38秒）');
  const aboveTotalCap = draft.answer.replaceAll('（34秒）','（36秒）');
  for (const answer of [aboveActivityCap,aboveTotalCap]) {
    await expect(replay(row,{...draft,answer}).result).rejects.toMatchObject({code: 'model_output_invalid'});
  }
});

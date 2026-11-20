import { expect, it, vi } from 'vitest';
import { answerSiteQuestion } from '../src/utils/site_assistant.js';
import { assistantPlanTimeBounds, distinguishAssistantKnownTurnAlternatives } from '../src/utils/site_assistant_plan.js';
import { assistantPresentationContract, assistantPresentationViolation } from '../src/utils/site_assistant_presentation.js';
import replays from './fixtures/assistant-v42-ab.json';

const config={key:'fixture',baseUrl:'https://api.deepseek.com/v1',model:'deepseek-flash'};
type Replay=typeof replays[number];
const modelResponse=(draft:Replay['drafts'][number])=>Response.json({choices:[{index:0,finish_reason:'stop',message:{role:'assistant',content:JSON.stringify(draft)}}]});
const history=(entry:Replay)=>entry.history.map(({role,content})=>({role:role==='user'?'user' as const:'assistant' as const,content}));
const answer=(entry:Replay,fetcher:typeof fetch)=>answerSiteQuestion(entry.question,'zh',config,AbortSignal.timeout(5000),fetcher,history(entry));

for(const replay of replays) {
  it.each(replay.drafts.map((draft,index)=>({draft,call:replay.calls[index]})))(
    `accepts ${replay.id} provider draft $call on the first call`,async({draft})=>{
      const fetcher=vi.fn<typeof fetch>().mockResolvedValueOnce(modelResponse(draft));
      const result=await answer(replay,fetcher);
      expect(fetcher).toHaveBeenCalledTimes(1);
      if(replay.id==='AB01') {
        const [first,second]=result.answer.split('\n');
        expect(first).toMatch(/备用|摆不出|无法摆出/);
        expect(first).toContain('每转一步就停一下');
        expect(second).toContain('先预测哪一块会移动');
        expect(first).toContain('100 秒');
        expect(second).toContain('75 秒');
      } else if(replay.id==='AB02') {
        expect(assistantPlanTimeBounds(replay.history[0].content).total).toBe(145);
        expect(result.answer).toMatch(/75 秒[\s\S]*70 秒/);
      } else {
        expect(result.answer).toBe(draft.answer);
        expect(result.answer.split('\n\n')).toHaveLength(2);
      }
    });
}

it('checks a replayed drill against the user budget and exact quotes',async()=>{
  const replay=replays.find(entry=>entry.id==='AB02')!;
  const valid=replay.drafts[0];
  const over=structuredClone(valid);
  over.plan.activities[0].seconds++;
  over.plan.activities[0].steps[0].seconds++;
  const forged=structuredClone(valid);
  forged.plan.inputs![0].quote='这一轮只有两分三十秒';
  for(const broken of [over,forged]){
    const fetcher=vi.fn<typeof fetch>().mockResolvedValueOnce(modelResponse(broken)).mockResolvedValueOnce(modelResponse(valid));
    await answer(replay,fetcher);
    expect(fetcher).toHaveBeenCalledTimes(2);
  }
});

it('still rejects a missing paragraph break and an extra sentence in the final task',()=>{
  const replay=replays.find(entry=>entry.id==='AB12')!;
  const contract=assistantPresentationContract(replay.question);
  expect(assistantPresentationViolation(replay.drafts[0].answer.replace('\n\n',' '),contract)).toBe('presentation_local_sentence_scope');
  expect(assistantPresentationViolation(replay.drafts[0].answer+'记得带上魔方。',contract)).toBe('presentation_local_sentence_count');
});

it('renders a paragraph plan and its independent closing sentence as two separate paragraphs',async()=>{
  const draft=structuredClone(replays.find(entry=>entry.id==='AB12')!.drafts[0]);
  draft.answer='小柯，周三一起练习吧！';
  const question='给两项练习，练习部分全部写成一段。另写一句邀请小柯周三练习的话，另起一段。';
  const fetcher=vi.fn<typeof fetch>().mockResolvedValueOnce(modelResponse(draft));
  const result=await answerSiteQuestion(question,'zh',config,AbortSignal.timeout(5000),fetcher);
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(result.answer.split('\n\n')).toEqual([expect.stringMatching(/固定顺序检查法.*清单打勾留痕法/),draft.answer]);
});

it('leaves concrete, distinct alternatives and generic alternatives without a distinctness request alone',()=>{
  const duplicate=replays.find(entry=>entry.id==='AB01')!;
  const distinct=replays.find(entry=>entry.id==='AB02')!;
  expect(distinguishAssistantKnownTurnAlternatives(distinct.drafts[1].plan,distinct.question,'zh')).toBeUndefined();
  expect(distinguishAssistantKnownTurnAlternatives(duplicate.drafts[0].plan,duplicate.question.replace('不同的',''),'zh')).toBeUndefined();
});

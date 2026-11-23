import { expect, it, vi } from 'vitest';
import { answerSiteQuestion } from '../src/utils/site_assistant.js';
import { assistantPlanDurationViolation, assistantPlanExceedsDuration } from '../src/utils/site_assistant_plan.js';

const twoActivities={activities:2};
const labelled='1. **观察：30 秒**\n观察食指离开贴纸的时点。\n2. **对比：25 秒**\n换用较慢的转动确认离面的时点。';

it.each([
  labelled,
  '1. **Observe: 30 seconds**\nWatch the contact point.\n2. Compare: 25 seconds.\nCheck the release.',
  '1. 观察（30 秒）\n观察指尖。\n2. 对比（25 秒）\n检查是否离开。',
])('accepts exact named allocations and still checks the sum (%s)',text=>{
  expect(assistantPlanDurationViolation(text,60/60,twoActivities)).toBeUndefined();
  expect(assistantPlanDurationViolation(text,54/60,twoActivities)).toBe('duration_limit_exceeded');
  expect(assistantPlanExceedsDuration(text,54/60)).toBe(true);
});

it.each([
  '观察：每次看 30 秒。',
  '观察：30 秒后再看。',
  '观察：30 秒左右。',
  '观察：约 30 秒。',
  '观察：20–30 秒。',
  '观察：30 秒或 40 秒。',
  '观察：30 秒：或 40 秒。',
  'At 2:30 seconds',
])('does not infer an allocation from an ambiguous field (%s)',field=>{
  const answer='1. '+field+'\n2. 对比：25 秒';
  expect(assistantPlanDurationViolation(answer,1,twoActivities)).toBe('plan_duration_unverifiable');
});

it('checks parent and child limits and sums with colon-labelled allocations',()=>{
  const text='1. 观察：30 秒\n  - 第一步：12 秒\n  - 第二步：18 秒\n2. 对比：25 秒\n  - 第一步：10 秒\n  - 第二步：15 秒';
  const shape={...twoActivities,substepsPerActivity:2};
  expect(assistantPlanDurationViolation(text,1,{...shape,activitySecondsMaximum:30,stepSecondsMaximum:18})).toBeUndefined();
  expect(assistantPlanDurationViolation(text,1,{...shape,activitySecondsMaximum:29})).toBe('duration_limit_exceeded');
  expect(assistantPlanDurationViolation(text,1,{...shape,stepSecondsMaximum:17})).toBe('duration_limit_exceeded');
  expect(assistantPlanDurationViolation(text.replace('18 秒','17 秒'),1,shape)).toBe('plan_duration_mismatch');
  expect(assistantPlanDurationViolation(text.replace('18 秒','先回忆'),1,shape)).toBe('plan_duration_unverifiable');
});

it('returns the original valid prose draft without spending a repair call',async()=>{
  const question='给两项检查慢速拨层时食指离开贴纸的定时练习，合计不超过六十秒。';
  const fetcher=vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({choices:[{
    index:0,finish_reason:'stop',message:{role:'assistant',content:JSON.stringify({
      answerKind:'general',answer:labelled,sourceIds:[],
    })},
  }]}));
  const result=await answerSiteQuestion(question,'zh',{key:'fixture',baseUrl:'https://api.deepseek.com/v1',model:'deepseek-flash'},AbortSignal.timeout(5000),fetcher);
  expect(result.answer).toBe(labelled);
  expect(fetcher).toHaveBeenCalledTimes(1);
});

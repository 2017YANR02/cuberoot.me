import { describe, expect, it, vi } from 'vitest';
import { ASSISTANT_FEATURE_LINKS, ASSISTANT_MODE_DESTINATIONS, isAssistantNavigationTarget, assistantAnswerHistory, type AssistantMessage } from '@cuberoot/shared/site-assistant';
import { answerSiteQuestion } from '../src/utils/site_assistant.js';
import { assistantNavigationRequest } from '../src/utils/site_assistant_navigation.js';

describe('spoken and typed site navigation',()=>{
  it('opens Frame Count without a model or a catalog read even when a provider is configured',async()=>{
    const fetcher=vi.fn<typeof fetch>(async()=>{throw Error('Unexpected network call');});
    const result=await answerSiteQuestion('打开数帧','zh',{key:'test',baseUrl:'https://model.example/v1',model:'qwen3.8-flash'},AbortSignal.timeout(1000),fetcher);
    expect(fetcher).not.toHaveBeenCalled();
    expect(result.navigation).toBe('open');
    expect(result.actions?.map(a=>a.href)).toEqual(['/frame-count']);
  });
  it.each([
    ['计时器入口在哪','link','/timer'],['带我去计时器','open','/timer'],
    ['请打开十字训练','open','/cross_trainer'],['带我去查三盲公式','open','/alg/3bld/lookup'],
    ['我想练盲拧','choose','/alg/3bld/memo'],['带我去视频数帧','open','/frame-count'],
    ['我想跟朋友在一台电脑上比一把，帮我打开两个人一起计时的页面','open','/timer?players=2'],
    ['我想跟朋友在一台电脑上比一把帮我打开两个人一起计时的页面','open','/timer?players=2'],
    ['我在和朋友联机，帮我打开两个人一起计时的页面','open','/timer?players=net'],
    ['两个人一起计时的入口在哪里','link','/timer?players=2'],
    ['请打开三阶梯ll公式训练','choose','/alg/3x3/pll/select'],
    ['麻烦你打开两人同屏即时','choose','/timer?players=2'],
    ['带我去皮艾尔艾尔公司训练','choose','/alg/3x3/pll/select'],
    ['带我去皮艾尔艾尔公式训练','choose','/alg/3x3/pll/select'],
    ['请帮我打开三阶 P L L 训练页面','open','/alg/3x3/pll/select'],
    ['公式库入口在哪','link','/alg'],['我想练毛宁','choose','/alg/3bld/memo'],
    ['带我去视频数证','choose','/frame-count'],['恭喜库入口在哪','choose','/alg'],
  ])('%s',async(question,mode,first)=>{
    const answer=await answerSiteQuestion(question,'zh',null,AbortSignal.timeout(1000),async()=>{throw Error('unexpected lookup')});
    expect(answer.navigation).toBe(mode);
    expect(answer.actions?.[0].href).toBe(first);
  });
  it('keeps an unspecified battle timer ambiguous and opens only the selected mode',()=>{
    const choices=assistantNavigationRequest('请打开对战计时',[],'zh')!;
    expect(choices.navigation).toBe('choose');
    expect(choices.actions?.map(a=>a.href)).toEqual(['/timer?players=2','/timer?players=net']);
    const history:AssistantMessage[]=[{role:'assistant',content:assistantAnswerHistory(choices,'https://cuberoot.me')}];
    expect(assistantNavigationRequest('打开第二个',history,'zh')?.actions).toEqual([choices.actions![1]]);
  });
  it('explains a quoted command using the registered destination without navigating',()=>{
    const preview=assistantNavigationRequest('如果我说“帮我打开双人计时”，会发生什么？',[],'zh');
    expect(preview?.answer).toContain('直接打开「双人计时」');
    expect(preview?.navigation).toBeUndefined();
    expect(preview?.actions).toBeUndefined();
  });
  it('opens each registered feature in its actual view or offers it by name', () => {
    for (const [href,zh,en] of [...ASSISTANT_FEATURE_LINKS, ...ASSISTANT_MODE_DESTINATIONS]) {
      expect(isAssistantNavigationTarget(href),href).toBe(true);
      for (const [lang,command] of [['zh','打开'+zh],['en','open '+en]] as const) {
        const result=assistantNavigationRequest(command,[],lang);
        expect(result?.actions?.map(a=>a.href),command).toContain(href);
      }
    }
  });
  it.each(['/scramble/solver?event=unknown','/meet?view=join&room=1234','//elsewhere.example','/../admin','/docs/edit?id=other'])('rejects unregistered auto-open target %s',href=>{
    expect(isAssistantNavigationTarget(href)).toBe(false);
  });
  it('asks for the document link when no document was identified',()=>{
    const answer=assistantNavigationRequest('打开编辑协作文档',[],'zh');
    expect(answer?.answer).toContain('文档链接');
    expect(answer?.actions).toBeUndefined();
  });
  it('resolves the ordinal in the actual last displayed order and releases it after a new topic',()=>{
    const choices=assistantNavigationRequest('我想练盲拧',[],'zh')!;
    const history:AssistantMessage[]=[{role:'assistant',content:assistantAnswerHistory(choices,'https://cuberoot.me')}];
    expect(assistantNavigationRequest('打开第二个',history,'zh')?.actions).toEqual([choices.actions![1]]);
    history.push({role:'assistant',content:'新的普通回答'});
    expect(assistantNavigationRequest('打开第二个',history,'zh')?.actions).toBeUndefined();
  });
  it.each(['三盲是什么意思','三毛是什么意思','不要打开计时器','打开计时器以后怎么操作','我想知道计时器为什么不准','我想知道怎么让朋友帮我打开双人计时','我想翻译这句话，帮我打开双人计时','我想跟朋友讨论一下，别帮我打开双人计时','三阶梯ll公式训练是什么意思','双人计时比单人计时多了什么'])('keeps %s in chat',q=>{
    expect(assistantNavigationRequest(q,[],'zh')).toBeUndefined();
  });
});

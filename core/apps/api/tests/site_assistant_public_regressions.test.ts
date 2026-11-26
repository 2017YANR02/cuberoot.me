import { describe, expect, it, vi } from 'vitest';
import { answerSiteQuestion } from '../src/utils/site_assistant.js';
import { couldBeWcaFaq, matchedWcaFaq, readWcaFaq, WCA_FAQ } from '../src/utils/site_assistant_wca_faq.js';
import suite from './fixtures/site_assistant_public_regressions.json' with { type: 'json' };
import { modelResponse } from './fixtures/site_assistant_model.js';

const config = { key: 'fixture', baseUrl: 'https://model.example/v1', model: 'test' };
const faq = [
  ['R02','如何获得 WCA ID？','当你第一次参加的比赛的成绩公示后，你就会获得 WCA ID 和个人成绩页。'],
  ['R04','如何报名比赛？如果报名时有问题我应该联系谁？','请查看<a href="/competitions">比赛列表</a>。有些比赛使用自己的报名系统，如遇到问题请联系该场主办方。'],
  ['R08','我丢了一个中心盖，这个魔方还能使用吗？','不能使用这个魔方。请参阅 <a href="/regulations/#3j">3j</a>。'],
];
const html = faq.map(([id,title,body]) => {
  const slug = suite.cases.find(c => c.id === id)!.source.split('#')[1];
  return '<li class="list-group-item"><h4 class="list-group-item-heading"><span id="'+slug+'">'+title+'</span></h4><div class="list-group-item-text"><p>'+body+'</p><script>hidden()</script></div></li>';
}).join('');
const run = (q: string, lang: 'zh'|'en', fetcher: typeof fetch) => answerSiteQuestion(q,lang,config,AbortSignal.timeout(5000),fetcher);

describe('public comparison regressions', () => {
  it.each(faq)('answers %s from the verified FAQ in one read', async id => {
    const c=suite.cases.find(item=>item.id===id)!;
    const fetcher=vi.fn<typeof fetch>(async (url,init)=>{
      expect(String(url)).toBe(WCA_FAQ+'?locale=zh-CN');
      expect(new Headers(init?.headers).get('Accept-Language')).toBe('zh-CN');
      return new Response(html);
    });
    const answer=await run(c.question,'zh',fetcher);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(answer.sources).toMatchObject([{href:c.source,read:true}]);
    expect(answer.answer).toContain('[['+answer.sources[0].id+']]');
    expect(answer.answer).toMatch(({R02:/第一次.*成绩公示/,R04:/主办方/,R08:/不能使用/})[id]!);
    expect(answer.answer).not.toMatch(/hidden\(|<script/);
  });

  it.each(['我该怎么报名参加比赛？还要查明天的截止时间。','还原过程中我的中心盖掉了，这次成绩算 DNF 吗？','如何获得 WCA ID？只用 JSON 回答。'])('leaves extra obligations on the normal path', question=>{
    expect(matchedWcaFaq(question,readWcaFaq(html,'zh'))).toBeUndefined();
  });
  it('answers two matched requests with their own sources and preserves an unmatched third request',()=>{
    const entries=readWcaFaq(html,'zh');
    const both='如何获得 WCA ID？我丢了一个中心盖，这个魔方还能使用吗？';
    const answer=matchedWcaFaq(both,entries)!;
    expect(answer.sources).toHaveLength(2);
    expect(answer.answer).toContain('[['+answer.sources[0].id+']]\n\n2.');
    expect(matchedWcaFaq(both+'报名费是多少？',entries)).toBeUndefined();
  });
  it('rejects a mismatched language and avoids reading for named events',()=>{
    expect(readWcaFaq(html,'en')).toEqual([]);
    expect(couldBeWcaFaq('How can I register for a competition in 2027?')).toBe(false);
  });
  it.each([
    ['R01','Repeating a fixed sequence','1. Use a new random-state scramble for each practice solve.\n2. Apply a scramble generated for the solved cube.'],
    ['R03','U and D preserve corner orientations','A single twist violates the invariant that the corner twist sum is zero modulo three.'],
    ['R05','Rw or 2Rw','Use R for the outer face and Rw for the two right layers. Unofficial lowercase r depends on the convention.'],
    ['R12','4-cycle has odd sign','Four wings can exchange two pairs, even though the reduced 3x3 appears to swap only two edges.'],
  ])('supplies the corrective mechanics for %s at the public entry point',async(id,fact,answer)=>{
    const c=suite.cases.find(item=>item.id===id)!;
    let firstRequest='';
    const fetcher: typeof fetch=async(url,init)=>{
      if(!String(url).startsWith(config.baseUrl))return new Response('',{status:404});
      firstRequest ||= String(init?.body);
      return modelResponse({answerKind:'general',answer});
    };
    const result=await run(c.question,'en',fetcher);
    expect(firstRequest).toContain(fact);
    expect(result.answer).toContain(answer.split('\n')[0]);
  });
});

import { describe, expect, it, vi } from 'vitest';
import { answerSiteQuestion, canReadPublicResult } from '../src/utils/site_assistant.js';
import { assistantNavigationRequest } from '../src/utils/site_assistant_navigation.js';
import { publishedFactAnswer, publishedFactIntent } from '../src/utils/site_assistant_page_facts.js';
import { fewestMovesQuestion, fewestMovesVerdict, inspectionScenario, multiBlindTimeCount, multiBlindTimeVerdict } from '../src/utils/site_assistant_regulations.js';
import { suppliedAverageAnswer } from '../src/utils/site_assistant_calculation.js';

describe('standalone site questions',()=>{
  it.each([
    ['想练三盲的棱块公式，直接带我去。','open','/alg/3bld/edge'],
    ['只想看 FTO 的转动记号说明，哪一页？','link','/alg/fto/notation'],
    ['想从录像里数帧计时，帮我打开工具。','open','/frame-count'],
    ['我和同学共用笔记本，带我去能两个人同时计时的页面。','open','/timer?players=2'],
    ['哪里可以按月份看比赛日历的统计？发链接就好。','link','/wca/comp/stats'],
  ])('resolves a registered destination for %s',(query,mode,href)=>{
    const reply=assistantNavigationRequest(query,[],'zh');
    expect(reply?.navigation).toBe(mode);
    expect(reply?.actions?.map(action=>action.href)).toEqual([href]);
  });
  it.each(['不要打开数帧工具，解释一下帧率','给我分析 FTO 的转动记号','如果打开双人计时器会怎样？'])('keeps an ordinary question in chat: %s',q=>{
    expect(assistantNavigationRequest(q,[],'zh')?.navigation).toBeUndefined();
  });
  it('keeps alternative destinations selectable and respects exclusions',()=>{
    const reply=assistantNavigationRequest('带我去数帧或计时器',[],'zh');
    expect(reply?.navigation).toBe('choose');
    expect(reply?.actions?.map(a=>a.href)).toEqual(expect.arrayContaining(['/frame-count','/timer']));
    expect(assistantNavigationRequest('打开不含数帧功能的编辑器',[],'zh')?.navigation).toBeUndefined();
  });
  it('requires the mosaic resolution paragraph, including for questions about facial detail',()=>{
    const intent=publishedFactIntent('照片有四千万像素，魔方墙只有十来列，是不是原图越高清就一定能保住所有五官？');
    expect(intent?.href).toBe('/mosaic-about');
    expect(publishedFactAnswer(intent!,[])).toBeUndefined();
  });
  it('reads FMC and multi-blind limits from the matching clauses',()=>{
    const html='<html><body><p id="H1b">fewer than 6 puzzles: time limit of 10 minutes times the number of puzzles, else the time limit is 60 minutes</p><p id="E2b">total time limit of 60 minutes to find and write a solution</p></body></html>';
    const url='https://www.worldcubeassociation.org/regulations/';
    expect(multiBlindTimeCount('多盲打算试 6 个魔方，最多能用多久？')).toBe(6);
    expect(multiBlindTimeVerdict(html,url,8,'zh')?.answer).toMatch(/8 个魔方的通常时限为 60 分钟/);
    expect(fewestMovesQuestion('FMC 一轮有多少分钟？')).toBe('time');
    expect(fewestMovesVerdict(html,url,'time','zh')?.answer).toContain('60 分钟');
    expect(fewestMovesVerdict(html,url,'inverse','zh')).toBeUndefined();
  });
  it('admits source-backed reads through the same gate as the worker',async()=>{
    const q='FMC 一轮有多少分钟？';
    expect(canReadPublicResult({question:q,history:[]})).toBe(true);
    const fetcher=vi.fn<typeof fetch>(async()=>new Response('<html><body><p id="E2b">total time limit of 60 minutes to find and write a solution</p></body></html>'));
    const reply=await answerSiteQuestion(q,'zh',null,new AbortController().signal,fetcher);
    expect(reply.answer).toContain('60 分钟');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('answers from the supplied public paragraph with a single read',async()=>{
    const href='/alg/sq1/parity-game';
    const fetcher=vi.fn<typeof fetch>(async url=>{
      expect(String(url)).toMatch(/\/assistant\/pages.json$/);
      return Response.json({pages:[{lang:'zh',href,title:'SQ1 奇偶游戏',text:'把未出现的颜色补在末尾，再判断相对 O-B-R-G 是奇排列还是偶排列。'}]});
    });
    const reply=await answerSiteQuestion('SQ1 奇偶游戏缺的颜色放哪，按什么顺序判？','zh',null,new AbortController().signal,fetcher);
    expect(reply.answer).toMatch(/末尾.*O-B-R-G/);
    expect(reply.sources).toEqual([expect.objectContaining({href,read:true})]);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it.each(['H perm 和 T perm 哪个更常遇到，还要给我两套指法','CoLPI 可以删除别人的账号吗？','打乱留空时视频复盘怎么导出 PDF？'])('defers unsupported facets: %s',q=>{
    expect(publishedFactIntent(q)).toBeUndefined();
  });
  it('keeps inspection boundaries and unrelated incidents separate',()=>{
    expect(inspectionScenario('比赛观察 17.1 秒才开始还原，算加二吗？')).toEqual({kind:'standard',times:[17.1]});
    expect(inspectionScenario('观察用了 18.2 秒才启动 Stackmat，还能记作加二吗？')).toEqual({kind:'standard',times:[18.2]});
    expect(inspectionScenario('观察用了 18.2 秒才启动 Stackmat，还能记作加二吗？如果计时器故障呢？')).toBeUndefined();
  });
  it('separates an exact trimmed mean from its rounded display',()=>{
    const q=(target:number)=>'目标五把平均 '+target+' 秒，前四把 15、8、10、9，最后一把最慢能多少？按 Ao5。';
    expect(suppliedAverageAnswer(q(10),'zh')).toMatch(/11\.00 秒.*11\.01 秒/);
    expect(suppliedAverageAnswer(q(8),'zh')).toContain('无法达到');
    expect(suppliedAverageAnswer(q(10)+'如果第一个是 DNF 呢？','zh')).toBeUndefined();
  });
});

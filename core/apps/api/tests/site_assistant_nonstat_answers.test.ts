import { AllFaces, CubeData, Face, parseAlgorithm } from '@cuberoot/visualcube';
import { describe, expect, it, vi } from 'vitest';
import type { AssistantStreamEvent } from '@cuberoot/shared/site-assistant';
import { answerSiteQuestion } from '../src/utils/site_assistant.js';
import { clubDirectoryAnswer, pairFindingDrill, reductionParityGuide } from '../src/utils/site_assistant_cubing_help.js';
import { inspectionScenario, inspectionStartTimes } from '../src/utils/site_assistant_regulations.js';
import { inverseMoveAnswer, notationExampleEvidence } from '../src/utils/site_assistant_moves.js';

const config = {key:'fixture',baseUrl:'https://model.invalid/v1',model:'fixture'};
const signal = () => AbortSignal.timeout(5000);
const directory = '<a href="/clubs/cn-beijing">Beijing (北京) Cubing Club</a>';
const pll = {
  puzzle:'3x3',set:'pll',cases:[{
    id:17,name:'T',subgroup:'Adjacent',setup:'',sticker:{kind:'raw',tag:'',attrs:{}},
    algs:[[{alg:"R U R' U' R' F R2 U' R' U' R U R' F'"}]],
  }],
};

describe('playable case answers', () => {
  it('uses the case as actually drawn and needs just the public library for recognition',async()=>{
    const fetcher=vi.fn<typeof fetch>(async()=>Response.json(pll));
    const answer=await answerSiteQuestion('请给三阶 PLL 的 T-perm 公式卡和识别要点。','zh',config,signal(),fetcher);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(answer.answer).toContain('右 ↔ 左');
    expect(answer.answer).toContain('右前 ↔ 右后');
    expect(answer.artifacts?.[0]).toMatchObject({kind:'algorithms',cards:[{caseId:17,alg:pll.cases[0].algs[0][0].alg}]});
  });
  it('publishes a usable card before an unavailable explanation and retains it at completion',async()=>{
    const events:AssistantStreamEvent[]=[];
    const fetcher=vi.fn<typeof fetch>(async url=>String(url).endsWith('/3x3/pll')
      ? Response.json(pll) : new Response('unavailable',{status:400}));
    const result=await answerSiteQuestion('给三阶 PLL 的 T-perm 公式卡，并解释怎么记这个公式。','zh',config,signal(),fetcher,[],undefined,async e=>{events.push(e);});
    expect(events.find(e=>e.type==='answer')).toMatchObject({artifacts:[{kind:'algorithms',cards:[{caseId:17}]}]});
    expect(result.artifacts).toMatchObject([{kind:'algorithms',cards:[{caseId:17}]}]);
    expect(result.answer).toContain('补充讲解');
    expect(result.sources).toHaveLength(1);
  });
});

describe('non-statistical question constraints',()=>{
  it('plays the inverse from the end and rejects partial or unsupported inputs',async()=>{
    const answer=await inverseMoveAnswer('How do I undo `L2 B′ U`?', 'en', signal());
    expect(answer?.answer).toContain("U' B L2");
    const playback=new URL(answer!.actions![1].href,'https://cuberoot.me');
    expect(playback.searchParams.get('setup')).toBe("L2 B' U");
    expect(playback.searchParams.get('anchor')).toBe('start');
    expect(await inverseMoveAnswer('四阶 Rw U 的逆序是？','zh',signal())).toBeUndefined();
    expect(await inverseMoveAnswer('求逆 `R U Q`','zh',signal())).toBeUndefined();
  });
  it('retains the six-minute budget, observes an eyes-open restriction and handles a two-sentence revision',()=>{
    const q='F2L 没有计时器，今天只有 6 分钟，只练找块，两项练习。不要闭眼。';
    expect(pairFindingDrill(q,[],'zh')).toContain('6 分钟');
    const revised=pairFindingDrill('第二项练习改成找一对角和棱，给出核对方法。',[{role:'user',content:q}],'zh',2);
    expect(revised?.match(/。/g)).toHaveLength(2);
    expect(revised).toContain('睁眼');expect(revised).not.toContain('闭眼');
    expect(pairFindingDrill(q+' 不许转体。',[],'zh')).toBeUndefined();
  });
  it('limits the parity diagnostic and the inspection shortcut to questions they can answer fully',()=>{
    const q='四阶降阶后单翻和最后两条棱互换怎么区分？';
    expect(reductionParityGuide(q,'zh')?.answer).toContain('可以同时出现');
    expect(reductionParityGuide(q+' 也给出公式。','zh')).toBeUndefined();
    expect(inspectionStartTimes('三阶 WCA 观察恰好 15.00 秒起表怎么判？')).toEqual([15]);
    expect(inspectionStartTimes('观察第 8 秒报时，裁判忘了选手何时起表，会罚时吗？')).toBeUndefined();
    const timed='WCA 三阶，从揭罩到起表分别用了14.99秒、15秒和17秒。请按顺序告诉我裁判结果和依据。';
    expect(inspectionStartTimes(timed)).toEqual([14.99,15,17]);
    expect(inspectionStartTimes(timed+'同时解释怎么申诉。')).toBeUndefined();
    expect(inspectionStartTimes('请先介绍规则历史。'+timed)).toBeUndefined();
    expect(inspectionStartTimes(timed.replace('15秒和','15秒停表后'))).toBeUndefined();
    expect(inspectionStartTimes('裁判观察 14.999、15.00 秒起表，何时报时？')).toEqual([14.999,15]);
    expect(inspectionStartTimes('裁判观察 14.99、15.00 秒起表，第一转慢了怎么判，何时报时？')).toBeUndefined();
  });
  it('only links a city found in the live directory and honours a site-only request',async()=>{
    const load=vi.fn(async()=>directory);
    const q='请给北京俱乐部的城市目录入口';
    const found=await clubDirectoryAnswer(q,'zh',load,signal());
    expect(found?.actions?.[1].href).toBe('https://speedcubing.app/clubs/cn-beijing');
    expect(found?.sources?.[1].read).toBe(false);
    const internal=await clubDirectoryAnswer(q+'，仅限本站','zh',load,signal());
    expect(internal?.actions?.map(a=>a.href)).toEqual(['/wca/teams']);
    expect(load).toHaveBeenCalledTimes(1);
    const unavailable=await clubDirectoryAnswer(q,'zh',async()=>'',signal());
    expect(unavailable?.actions?.[1].href).toBe('https://speedcubing.app/clubs/directory');
  });
});


describe('review question regressions',()=>{
  it('keeps both requested PLLs in request order with diagram-derived distinctions and no unrelated page of results',async()=>{
    const jb={...pll.cases[0],id:18,name:'J',algs:[[{alg:"(R U R' F') (R U R' U') (R' F R2 U' R') U'"}]]};
    const fetcher=vi.fn<typeof fetch>(async()=>Response.json({...pll,cases:[pll.cases[0],jb]}));
    const answer=await answerSiteQuestion('比较三阶 PLL 的 Jb-perm 和 T-perm，给各自的公式和识别区别。','zh',config,signal(),fetcher);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(answer.answer).toContain('同色三连块在');
    expect(answer.answer).toContain('没有同色三连块');
    const artifact=answer.artifacts?.[0];
    expect(artifact).toMatchObject({kind:'algorithms',total:2,cards:[{caseId:18,alg:jb.algs[0][0].alg},{caseId:17,alg:pll.cases[0].algs[0][0].alg}]});
    expect(artifact?.kind==='algorithms' && artifact.nextOffset).toBeUndefined();
  });
  it('keeps unrelated incidents out of the ordinary inspection shortcut',()=>{
    expect(inspectionScenario('WCA head-to-head inspection: started the timer at 16 seconds after GO. Penalty?')).toEqual({kind:'head-to-head'});
    expect(inspectionScenario('三阶盲拧对决，观察 16 秒起表怎么判？')).toBeUndefined();
    expect(inspectionScenario('三阶观察 16 秒起表，然后一只手停表，罚时怎么判？')).toBeUndefined();
    expect(inspectionScenario('三阶比赛第一把观察 16 秒起表，第二把放下魔方后用单手停表，两把怎么判？')).toEqual({kind:'independent-stop',times:[16]});
    expect(inspectionScenario('第一次观察 16 秒起表，第二次没有用单手停表，已经放下魔方。')).toBeUndefined();
  });
  it('checks the teaching algorithm against a UF-flipped 4x4 with the whole last layer initially oriented except UF',()=>{
    const guide=reductionParityGuide('4x4 reduction: give me moves for an OLL parity flipped edge and explain the grip and Rw.','en')!;
    const alg=guide.answer.split('\n\n')[1];
    expect(guide.answer).toMatch(/up-front.*UF/);
    expect(guide.answer).toContain('two right layers');
    const cube=new CubeData(4,Object.fromEntries(AllFaces.map(face=>[face,Array(16).fill(face)])));
    // Independently construct a single flipped edge, avoiding a self-inverse test.
    for(const i of [13,14])cube.faces[Face.U][i]=Face.F;
    for(const i of [1,2])cube.faces[Face.F][i]=Face.U;
    for(const turn of parseAlgorithm(alg))cube.turn(turn);
    const u=cube.faces[Face.U];
    for(const i of [1,2,4,7,8,11,13,14])expect(u[i]).toBe(u[5]);
    for(const f of [Face.F,Face.R,Face.B,Face.L]){
      const face=cube.faces[f];
      expect(face.slice(4).every(color=>color===face[5])).toBe(true);
      expect(face[1]).toBe(face[2]);
    }
    expect(reductionParityGuide('四阶降阶单翻，请给不用转体的公式','zh')).toBeUndefined();
  });
  it('retains the one-line constraint on an edited inverse and keeps unconstrained playback available',async()=>{
    const q='求逆 `F B2 L`，只给一行，不要链接。';
    const result=await inverseMoveAnswer(q,'zh',signal());
    expect(result).toEqual({answer:"L' B2 F'",sources:[]});
    const edited=await inverseMoveAnswer('把原动作的最后一步改成 R，其他条件保持不变。','zh',signal(),[{role:'user',content:q},{role:'assistant',content:result!.answer}]);
    expect(edited).toEqual({answer:"R' B2 F'",sources:[]});
  });
  it('finds each named city in requested order against the same directory read',async()=>{
    const load=vi.fn(async()=>directory+'<a href="/clubs/cn-shanghai">Shanghai (上海) Cubing Club</a>');
    const answer=await clubDirectoryAnswer('上海与北京的俱乐部目录各给一条。','zh',load,signal());
    expect(load).toHaveBeenCalledTimes(1);
    expect(answer?.actions?.map(a=>a.href)).toEqual(['https://speedcubing.app/clubs/cn-shanghai','https://speedcubing.app/clubs/cn-beijing']);
  });
  it('honours a one-attempt F2L drill even on failure and checks notation examples on the cube',async()=>{
    const drill=pairFindingDrill('我没有计时器，F2L 找块给两项练习，每项只能试一次，错也要停。',[],'zh');
    expect(drill).toContain('找错或找不到');
    expect(drill).toContain('中层');
    expect(drill).not.toContain('两次');
    const guidance=await notationExampleEvidence('Compare conjugates and commutators.');
    expect(guidance).toContain("R U R' U' changes 4 corners and 3 edges");
    expect(guidance).toContain("R U R' changes 4 corners and 4 edges");
  });
});

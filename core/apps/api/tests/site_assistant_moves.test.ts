import { describe, expect, it, vi } from 'vitest';
import { answerSiteQuestion } from '../src/utils/site_assistant.js';
import { requestsCubeMoveVerification, verifyAssistantCubeMoves } from '../src/utils/site_assistant_moves.js';
import { modelResponse } from './fixtures/site_assistant_model.js';

const signal = () => AbortSignal.timeout(5000);
const config = { key: 'fixture', baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-flash' };
const tool = 'verify_cube_moves' as const;

describe('assistant verification of supplied 3×3 moves', () => {
  it('simulates both sequences from the same setup and gives independently playable links', async () => {
    const call = { tool, setup: 'F', algorithm: 'Rw Rw', comparison: 'r2′' };
    const question = '请比较起始局面 `F` 下，转法 `Rw Rw` 和 `r2′` 的最终状态是否相同。';
    expect(requestsCubeMoveVerification(question)).toBe(true);
    const result = await verifyAssistantCubeMoves(call, question, 'zh', signal());
    expect(result?.answer).toContain('最终状态相同');
    const links = result?.actions?.map(action => new URL(action.href, 'https://cuberoot.me'));
    expect(links?.map(url => [url.pathname, url.searchParams.get('setup'), url.searchParams.get('alg')])).toEqual([
      ['/sim', 'F', 'Rw Rw'], ['/sim', 'F', "r2'"],
    ]);
    expect(links?.every(url => url.searchParams.get('anchor') === 'start')).toBe(true);
  });

  it('distinguishes solving from a scramble, a different result, and whole-cube orientation', async () => {
    const inverse = await verifyAssistantCubeMoves({ tool, setup: 'R U', algorithm: "U' R'" },
      "Does U' R' solve the 3x3 from setup R U?", 'en', signal());
    expect(inverse?.answer).toContain('solves the cube');
    const unequal = await verifyAssistantCubeMoves({ tool, algorithm: 'R', comparison: 'U' },
      'Compare `R` and `U`: do these moves give the same final state?', 'en', signal());
    expect(unequal?.answer).toContain('different final states');
    const rotated = await verifyAssistantCubeMoves({ tool, algorithm: 'x' },
      'Does the algorithm `x` end in the solved state?', 'en', signal());
    expect(rotated?.answer).toContain('differs from the solved state');
  });

  it('rejects substituted, truncated, omitted, or unsupported sequences', async () => {
    expect(await verifyAssistantCubeMoves({ tool, algorithm: 'R' },
      'Does `R U` solve the 3x3?', 'en', signal())).toBeUndefined();
    expect(await verifyAssistantCubeMoves({ tool, algorithm: 'R' },
      'Does `R` solve after setup `U`?', 'en', signal())).toBeUndefined();
    expect(await verifyAssistantCubeMoves({ tool, algorithm: 'R' },
      'Does `R` solve after setup `(U)2`?', 'en', signal())).toBeUndefined();
    expect(await verifyAssistantCubeMoves({ tool, algorithm: 'R', comparison: 'R' },
      'Compare `R` with `(R U)2`: same state?', 'en', signal())).toBeUndefined();
    expect(await verifyAssistantCubeMoves({ tool, setup: 'R', algorithm: 'F', comparison: 'R' },
      'Compare `R` and `R` from setup `F`: same state?', 'en', signal())).toBeUndefined();
    expect(await verifyAssistantCubeMoves({ tool, algorithm: 'R' },
      'Does `R` solve the 4x4?', 'en', signal())).toBeUndefined();
  });

  it('verifies complete input at the normal assistant entry without a model rewrite', async () => {
    const fetcher = vi.fn<typeof fetch>();
    const result = await answerSiteQuestion("Does `RR'` solve a 3x3 cube?", 'en', config, signal(), fetcher);
    expect(result.answer).toContain('solves the cube');
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('compares final-state equality from a shared starting setup without a source lookup', async () => {
    const fetcher = vi.fn<typeof fetch>();
    const result = await answerSiteQuestion(
      "Use `D' F2` as the common 3x3 starting setup. Compare `U L L' U'` with `R2 R2` for final-state equality and give a playback link for each.",
      'en', config, signal(), fetcher);
    expect(result.answer).toContain('same final state');
    const links = result.actions?.map(action => new URL(action.href, 'https://cuberoot.me').searchParams);
    expect(links?.map(link=>[link.get('setup'),link.get('alg'),link.get('anchor')])).toEqual([
      ["D' F2","U L L' U'",'start'], ["D' F2",'R2 R2','start'],
    ]);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('does not expose verification for ordinary queries or let a model claim verification without running it', async () => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => modelResponse({ answerKind: 'general', answer: 'Hello.' }));
    expect((await answerSiteQuestion('Hello!', 'en', config, signal(), fetcher)).answer).toBe('Hello.');
    const wire = JSON.parse(String(fetcher.mock.calls[0][1]?.body));
    expect(wire.tools).not.toContainEqual(expect.objectContaining({ function: expect.objectContaining({ name: tool }) }));
    expect((await answerSiteQuestion('Can you verify whether `(U′ R)2` and `L` are equivalent?', 'en', config, signal(), fetcher)).answer)
      .toContain('different final states');
  });

  it('preserves the exact playback setup, moves and anchor after parsing natural-language requests', async () => {
    const fetcher = vi.fn<typeof fetch>();
    const compare = await answerSiteQuestion('起始局面为 `B2`。比较 `R U U′ R′` 和 `M M′` 的终态是否一致。给两条可以从同一局面播放的模拟器入口。','zh',config,signal(),fetcher);
    const inverse = await answerSiteQuestion("With setup `L2 D' R`, does `R' D L2` solve the 3x3 in its original orientation? Give me a simulator link that starts from this setup.",'en',config,signal(),fetcher);
    const unequal = await answerSiteQuestion('Compare `R U` and `U R` on a solved 3x3. Do the two algorithms produce the same final state? Let me open each in the simulator.','en',config,signal(),fetcher);
    const orientation = await answerSiteQuestion('从复原态做 `z2` 是否能回到原朝向的复原状态？使用固定朝向比较，不允许把整体转过的朝向视作相同。','zh',config,signal(),fetcher);
    expect(compare.answer).toContain('最终状态相同');
    expect(inverse.answer).toContain('solves the cube');
    expect(unequal.answer).toContain('different final states');
    expect(orientation.answer).toContain('方块相对中心仍是复原的');
    const links=[compare,inverse,unequal,orientation].flatMap(result=>result.actions ?? []).map(action=>new URL(action.href,'https://cuberoot.me'));
    expect(links.map(url=>[url.pathname,url.searchParams.get('puzzle'),url.searchParams.get('anchor'),url.searchParams.get('setup'),url.searchParams.get('alg')])).toEqual([
      ['/sim','3','start','B2',"R U U' R'"], ['/sim','3','start','B2',"M M'"],
      ['/sim','3','start',"L2 D' R","R' D L2"], ['/sim','3','start',null,'R U'],
      ['/sim','3','start',null,'U R'], ['/sim','3','start',null,'z2'],
    ]);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('keeps the supplied setup distinct from ordered natural-language turns', async () => {
    const fetcher = vi.fn<typeof fetch>();
    const compare = await answerSiteQuestion("我已经把三阶转到 F R2 了。继续做 S2 S2 和 B′ B，分别算一下最后的状态是否一样，并给两个播放入口。",'zh',config,signal(),fetcher);
    const inverse = await answerSiteQuestion("Can you test if R2 B' L takes my 3x3 back to solved from L' B R2? Please give me a simulator replay.",'en',config,signal(),fetcher);
    const noncommuting = await answerSiteQuestion('With the 3×3 solved, do U then F. Compare that with F then U. Is the result identical?','en',config,signal(),fetcher);
    const commutator = await answerSiteQuestion('Can you verify [R,U] gives the same stickers as R U R′ U′ on a 3×3?','en',config,signal(),fetcher);
    expect(compare.answer).toContain('最终状态相同');
    expect(inverse.answer).toContain('solves the cube');
    expect(noncommuting.answer).toContain('different final states');
    expect(commutator.answer).toContain('same final state');
    expect(commutator.actions).toHaveLength(2);
    const links=[compare,inverse,noncommuting].flatMap(result=>result.actions ?? []).map(action=>new URL(action.href,'https://cuberoot.me'));
    expect(links.map(url=>[url.searchParams.get('setup'),url.searchParams.get('alg')])).toEqual([
      ['F R2','S2 S2'], ['F R2',"B' B"], ["L' B R2","R2 B' L"], [null,'U F'], [null,'F U'],
    ]);
    expect(fetcher).not.toHaveBeenCalled();
  });
});

it.each([
  ['三阶求逆 `B2 L F2`。另外，按面转计数和四分之一转计数，原动作各有几步？请把两个数都写出来。',"F2 L' B2",3,5],
  ['Invert `D2 U2 R2 L` and give both HTM and QTM counts.',"L' R2 U2 D2",4,7],
])('gives verified inverse playback and both requested counts',async(question,inverse,htm,qtm)=>{
  const {inverseMoveAnswer}=await import('../src/utils/site_assistant_moves.js');
  const result=await inverseMoveAnswer(String(question),'zh',AbortSignal.timeout(2000));
  expect(result?.answer).toContain(inverse);expect(result?.answer).toContain('HTM '+htm);
  expect(result?.answer).toContain('QTM '+qtm);expect(result?.actions).toHaveLength(2);
});

it('expands nested conjugates and repeated compact moves from the supplied setup',async()=>{
  const fetcher=vi.fn<typeof fetch>();
  const question="从 `B2` 开始，比较 [F:[R,U]] 和 `F R U R' U' F'` 的最终状态是否相同？分别展开并给第一串的 HTM 步数。";
  const result=await answerSiteQuestion(question,'zh',config,signal(),fetcher);
  expect(result.answer).toContain('最终状态相同');
  expect(result.answer).toContain('HTM 6 步');
  expect(result.actions?.map(a=>new URL(a.href,'https://cuberoot.me').searchParams.get('setup'))).toEqual(['B2','B2']);
  const grouped=await answerSiteQuestion("验证 (RU)2 和 `R U R U` 的最终状态是否相同？",'zh',config,signal(),fetcher);
  expect(grouped.answer).toContain('最终状态相同');
  const counts=await answerSiteQuestion('验证 (R)2 和 `R2` 的最终状态是否相同？分别给两串的 HTM 步数。','zh',config,signal(),fetcher);
  expect(counts.answer).toContain('HTM 2 / 1 步');
  expect(fetcher).not.toHaveBeenCalled();
});

it.each(['(R U]2','(R U)100000000','[Q,U]','(R U','[R,]','((R)120)120','((R)0)999999','（R U）2'])('does not verify a fragment of %s',async input=>{
  const result=await answerSiteQuestion('三阶：验证 '+input+' 和 `U` 的最终状态是否相同。','zh',config,signal(),vi.fn());
  expect(result.actions).toBeUndefined();
  expect(result.answer).not.toContain('已从复原态验证');
});

it('honors the original or inverse end turn, one-line format, and extra tasks',async()=>{
  const {inverseMoveAnswer}=await import('../src/utils/site_assistant_moves.js');
  const direct=await inverseMoveAnswer("三阶求逆 `D2 F R'`，再告诉我原动作第一步转的是哪个面、转多少度。只写一行。",'zh',signal());
  expect(direct?.answer).toMatch(/^R F' D2[^\n]*底面[^\n]*180°$/);
  const edited=await inverseMoveAnswer("Invert `F2 D B` and describe the inverse first move's face and angle, in one line.",'en',signal());
  expect(edited?.answer).toMatch(/^B' D' F2.*back face 90° counterclockwise/);
  const seed=vi.fn();
  expect(await inverseMoveAnswer('求逆 `F U`，并设计一个练习表。','zh',signal(),[],seed)).toBeUndefined();
  expect(await inverseMoveAnswer('求逆 `F U`，并说明这段转法影响了哪些角块。','zh',signal(),[],seed)).toBeUndefined();
  expect(seed).toHaveBeenCalledWith(expect.stringContaining("U' F'"));
  const fetcher=vi.fn<typeof fetch>().mockImplementation(async()=>modelResponse({answerKind:'general',answer:"U' F'"}));
  await answerSiteQuestion('求逆 `F U`，并说明这段转法影响了哪些角块。','zh',config,signal(),fetcher);
  const wire=JSON.parse(String(fetcher.mock.calls[0][1]?.body));
  expect(JSON.stringify(wire.messages)).toContain("verified the inverse of F U as U' F'");

});

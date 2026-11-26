import { applyScramble } from '@cuberoot/shared/timer/reconstruct/state';
import { communityMechanicsEvidence, conflictingCubePeriod, directCommunityProof, invalidJPermClaim, invalidPocketColourWitness } from '../src/utils/site_assistant_mechanics.js';
import { describe, expect, it, vi } from 'vitest';
import suite from './fixtures/site_assistant_community_regressions.json' with { type: 'json' };
import { modelResponse } from './fixtures/site_assistant_model.js';
import { answerSiteQuestion, requestedAssistantEvidence } from '../src/utils/site_assistant.js';
import { requestsCubeMoveVerification } from '../src/utils/site_assistant_moves.js';
import { resolveAssistantAlgorithmRequest } from '../src/utils/site_assistant_algorithm_request.js';
import { assistantAnswerRequirements } from '../src/utils/site_assistant_answer_check.js';
import { checkedFaceColourAnswer, cubeConceptFacts } from '../src/utils/site_assistant_cubing_help.js';
import { cornerTwistContestQuestion, cornerTwistContestVerdict, WCA_REGULATIONS_URL } from '../src/utils/site_assistant_regulations.js';
import { matchedWcaFaq, readWcaFaq } from '../src/utils/site_assistant_wca_faq.js';

const config = { key:'fixture', baseUrl:'https://model.example/v1', model:'test' };
function previous(id:string) { return suite.cases.find(c=>c.id===id)!; }

describe('community question regressions',()=>{
  it.each(['H06','H08'])('does not interpret state labels, numbered stickers or quoted prose as moves (%s)',id=>{
    expect(requestsCubeMoveVerification(previous(id).question)).toBe(false);
  });
  it.each([previous('H09').question,'高阶魔方的特殊情况公式怎么记？','Show parity algorithms for larger cubes.'])('does not select a Square-1 library from the word parity',async question=>{
    const load=vi.fn();
    expect(await resolveAssistantAlgorithmRequest(question,[],'en',load)).toBeUndefined();
    expect(load).not.toHaveBeenCalled();
  });
  it('preserves explicitly selected Square-1 cards',async()=>{
    const load=vi.fn().mockRejectedValue(new Error('requested correct catalog'));
    await expect(resolveAssistantAlgorithmRequest('Show the Square-1 parity algorithms',[],'en',load)).rejects.toThrow('requested correct catalog');
    expect(load).toHaveBeenCalledWith('sq1','parity');
  });
  it.each([
    ['H01','3x3x3 CFOP → last layer'], ['H04','R2 L2 U2 D2 F2 B2'],
    ['H08','rotate in place'], ['H11','does not establish randomness'],
  ])('makes the corrective fact available for %s',(id,fact)=>{
    expect(cubeConceptFacts(previous(id).question)).toContain(fact);
  });
  it.each(['H02','H05'])('still resolves the previously missed official FAQ (%s)',id=>{
    const c=previous(id),slug=c.source.split('#')[1];
    const html='<li class="list-group-item"><h4 class="list-group-item-heading"><span id="'+slug+'">'+c.question+'</span></h4><div class="list-group-item-text"><p>FAQ entry</p></div></li>';
    expect(matchedWcaFaq(c.question,readWcaFaq(html,c.lang as 'zh'|'en'))?.sources).toMatchObject([{href:c.source,read:true}]);
  });
  it('composes the parity teaching answer without fetching cards or waiting for a tool',async()=>{
    const answer='Learn one big-cube reduction case at a time. Rehearse short move chunks and join them from the same orientation.';
    const urls:string[]=[];const prompts:string[]=[];
    const result=await answerSiteQuestion(previous('H09').question,'en',config,AbortSignal.timeout(5000),async(input,init)=>{
      urls.push(String(input));prompts.push(String(init?.body));
      return modelResponse({answerKind:'general',answer});
    });
    expect(urls).toEqual([config.baseUrl+'/chat/completions']);
    expect(prompts[0]).toContain('finger-friendly chunks');
    expect(result.answer).toBe(answer);
    expect(result.artifacts ?? []).toHaveLength(0);
  });
  it('preserves the arbitrary-target solver subquestion when composing state distance',async()=>{
    const q=previous('H06').question;
    const prompts:string[]=[];
    const fetcher:typeof fetch=async(url,init)=>{
      if(!String(url).startsWith(config.baseUrl))return new Response('',{status:404});
      prompts.push(String(init?.body));
      return modelResponse({answerKind:'general',answer:'1. At most 20 face turns.\n2. Solve the relative state.\n3. The identity is just a reference.\n4. The solveto API accepts a custom target.'});
    };
    const result=await answerSiteQuestion(q,'en',config,AbortSignal.timeout(5000),fetcher);
    expect(prompts[0]).toContain('solveto(cubestring, goalstring');
    expect(result.answer).toContain('20 face turns');
    expect(result.answer).toContain('custom target');
  });
});

describe('community state questions', () => {
  it.each(['C01','C02','C03','C04','C05','C06','C07','C08','C09','C10','C11','C12'])(
    'keeps the original community request out of the generic move checker (%s)', id => {
      expect(requestsCubeMoveVerification(previous(id).question)).toBe(false);
    });
  it.each([
    ['C01','two-look PLL six'], ['C02','hidden corner'], ['C03','half turn does not toggle'],
    ['C05','failed attempt'], ['C06','relative PERMUTATIONS'], ['C07','no edge parity constraint'],
    ['C08','interchange the two pieces'], ['C09','five faces'], ['C10','total corner twist'],
    ['C12','historical identification'],
  ])('supplies the corrective mechanical premise for %s', (id,fact) => {
    expect(cubeConceptFacts(previous(id).question)).toContain(fact);
  });
  it.each([
    ['Is a single twisted corner possible on a 3x3?', 'corner twist modulo 3'],
    ['Is just one flipped edge solvable on a standard 3x3 cube?', 'edge flip modulo 2'],
    ['为什么三阶魔方只扭一个角不能复原？','角扭总和模 3'],
  ])('checks the single-piece invariant from the six face moves',async (question,fact)=>{
    const fetcher=vi.fn<typeof fetch>();
    const answer=await answerSiteQuestion(question,question.startsWith('为什么')?'zh':'en',config,AbortSignal.timeout(4000),fetcher);
    expect(answer.answer).toContain(fact);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('checks the requested sequence independently of an earlier example', async () => {
    const fetcher=vi.fn<typeof fetch>();
    const answer=await answerSiteQuestion("For example I used `R U`. Does `F F’` solve the cube from solved?",'en',config,AbortSignal.timeout(4000),fetcher);
    expect(answer.answer).toContain('solves the cube');
    expect(answer.actions).toHaveLength(1);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('keeps a failed attempt in the first model question instead of returning its simulated state', async () => {
    const fetcher=vi.fn<typeof fetch>(async()=>modelResponse({answerKind:'general',answer:'A single twisted corner cannot be solved by legal turns.'}));
    const answer=await answerSiteQuestion(previous('C05').question,'en',config,AbortSignal.timeout(4000),fetcher);
    expect(answer.answer).toContain('single twisted corner');
    expect(JSON.stringify(fetcher.mock.calls[0])).toContain('R’ D’ R D');
  });
  it('checks a per-face colour bound and leaves additional requirements with the planner', async () => {
    const question=previous('C11').question;
    const fetcher=vi.fn<typeof fetch>();
    const answer=await answerSiteQuestion(question,'en',config,AbortSignal.timeout(4000),fetcher);
    expect(answer.answer).toContain('2, 2, 2, 2, 2, 2');
    expect(fetcher).not.toHaveBeenCalled();
    expect(checkedFaceColourAnswer(question+' Also give a shortest solution.','en')).toBeUndefined();
  });
  it('counts independent questions even when the first includes a parenthetical premise',()=>{
    expect(assistantAnswerRequirements(previous('C02').question)).toEqual([]);
    expect(assistantAnswerRequirements(previous('C02').question+' How do I repair a flipped edge?')).toHaveLength(2);
  });
  it.each([
    ['I tried R U — why does my single corner stay twisted when I solve the cube?',false],
    ['我试过 `R U`。为什么我的魔方只有一个角不能复原？',false],
    ['For example, does `R R’` solve the cube from solved?',true],
    ['我举例用了 `R R’`。请验证上面这串从复原态出发能否复原。',true],
  ])('distinguishes incidental and requested notation in both languages',(question,expected)=>{
    expect(requestsCubeMoveVerification(String(question))).toBe(expected);
  });
  it('retains checked sections when a mechanical checklist repair times out',async()=>{
    const fetcher=vi.fn<typeof fetch>(async()=>{
      if(fetcher.mock.calls.length===1)return modelResponse({answerKind:'general',answer:'1. The total corner twist is zero modulo three.'});
      throw new DOMException('review timeout','TimeoutError');
    });
    const answer=await answerSiteQuestion('On a standard cube: 1) Explain corner twist. 2) Explain edge flips.','en',config,AbortSignal.timeout(15000),fetcher);
    expect(answer.answer).toContain('zero modulo three');
    expect(answer.answer).toContain('Still unverified');
    expect(answer.answer).toContain('edge flips');
  });
});

describe('community mechanics and routing',()=>{
  it.each(['N01','N02','N03','N04','N05','N06','N07','N08','N09','N10','N11','N12'])(
    'treats original community question %s as a question, not an explicit equality test', id=>{
      expect(requestsCubeMoveVerification(previous(id).question)).toBe(false);
    });
  it('keeps a generic layer name out of the FTO catalog',async()=>{
    const load=vi.fn();
    expect(await resolveAssistantAlgorithmRequest(previous('N01').question,[],'en',load)).toBeUndefined();
    expect(load).not.toHaveBeenCalled();
  });
  it('measures repetitions on the visible cube and returns a closed numeric answer without a provider',async()=>{
    const fetcher=vi.fn<typeof fetch>();
    const answer=await answerSiteQuestion('What is the order of R U on a 3x3 cube?','en',config,AbortSignal.timeout(4000),fetcher);
    expect(answer.answer).toContain('105');
    expect(fetcher).not.toHaveBeenCalled();
    expect(await communityMechanicsEvidence(previous('N03').question,'en')).toContain("R U2 D' B D'` → 1260");
  });
  it('rejects a contradictory claimed period while accepting the measured colour state',async()=>{
    expect(await conflictingCubePeriod('R U has order 60.')).toBe(true);
    expect(await conflictingCubePeriod('R U has order 105.')).toBe(false);
    expect(await conflictingCubePeriod('The question asks whether R U has order 60.')).toBe(false);
  });
  it('distinguishes a periodic walk through states from a proof of return to the starting state',async()=>{
    expect(await communityMechanicsEvidence(previous('N05').question,'en')).toContain('permutation of finitely many states');
    expect(await communityMechanicsEvidence(previous('N06').question,'en')).toContain('1260L');
  });
  it.each([['N11','diagonally'],['N12','ABA / CDC / ABA']])('checks all six faces against the requested constraint for %s',async(id,claim)=>{
    const result=await communityMechanicsEvidence(previous(id).question,'en');
    expect(result).toContain('E M2 S');
    expect(result).toContain(claim);
  });
});

describe('retaining a computed answer on long community questions',()=>{
  it('checks an alternating-turn obstruction with both starting directions',async()=>{
    const proof=await communityMechanicsEvidence(previous('M04').question,'en');
    expect(proof).toContain('648 distinct corner permutations');
    const items=assistantAnswerRequirements(previous('M04').question);
    expect(items.some(item=>item.includes('which positions'))).toBe(true);
    expect(items.some(item=>item.startsWith("Let's say"))).toBe(false);
  });
  it('separates a mathematical example from the request after it',async()=>{
    const question=previous('M12').question;
    expect(assistantAnswerRequirements(question).some(item=>item.includes('Some examples'))).toBe(false);
    expect(requestedAssistantEvidence(question)).toBe('auto');
    expect(requestedAssistantEvidence(question+' Can the site timer save my splits?')).toBe('pages');
    const offline=vi.fn<typeof fetch>(async()=>new Response('',{status:400}));
    const answer=await answerSiteQuestion(question,'en',config,AbortSignal.timeout(5000),offline);
    expect(answer.answer).toContain('120°');
  });
  it('keeps the actual half-turn solving question and excludes notation definitions',()=>{
    const items=assistantAnswerRequirements(previous('M08').question);
    expect(items.some(item=>item.includes('defined analogously'))).toBe(false);
    expect(items.join(' ')).toContain('half turns');
  });
  it('retains a verified mechanical conclusion on provider failure',async()=>{
    const fetcher=vi.fn<typeof fetch>(async()=>new Response('',{status:400}));
    const answer=await answerSiteQuestion(previous('M04').question,'en',config,AbortSignal.timeout(5000),fetcher);
    expect(answer.answer).toContain('648 distinct corner permutations');
    expect(answer.answer).toContain('Additional details could not be verified.');
  });
});

describe('reference answers for community regression questions',()=>{
  it('checks the two-layer minimum with all six faces and both quarter-turn directions',()=>{
    const moves = ['R','L','U','D','F','B'].flatMap(face=>[face,face+"'"]);
    const fourColours = (word:string) => Object.values(applyScramble(2,word)).every(face=>new Set(face).size===4);
    let level = [''];
    for (let depth=0; depth<=3; depth++) {
      expect(level.some(fourColours)).toBe(false);
      if (depth<3) level=level.flatMap(prefix=>moves.map(move=>(prefix+' '+move).trim()));
    }
    expect(fourColours('L D2 B')).toBe(true);
    expect(previous('T01').expected).toContain('Four quarter turns');
  });
});

describe('community answer delivery',()=>{
  it.each([['T01','four quarter-turns'],['T06','36 individual sticker readings']])('answers the complete closed problem from verified mechanics (%s)',async(id,expected)=>{
    const fetcher=vi.fn<typeof fetch>();
    const result=await answerSiteQuestion(previous(id).question,'en',config,AbortSignal.timeout(3000),fetcher);
    expect(result.answer).toContain(expected);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('keeps independent requests for proof, citations and alternate move constraints',async()=>{
    const q=previous('T01').question;
    expect(directCommunityProof(q+' Also show how to solve it using only R turns.','en')).toBeUndefined();
    expect(directCommunityProof(q+' Cite the forum post.','en')).toBeUndefined();
    expect(invalidPocketColourWitness('From solved, do `U F R`.','en')).toContain('repeated colours');
    expect(invalidPocketColourWitness('From solved, do `L D2 B`.','en')).toBeUndefined();
  });
  it('keeps method terminology out of the algorithm case picker',async()=>{
    const load=vi.fn();
    expect(await resolveAssistantAlgorithmRequest(previous('T02').question,[],'en',load)).toBeUndefined();
    expect(load).not.toHaveBeenCalled();
    expect(await communityMechanicsEvidence(previous('T02').question,'en')).toContain('EOCross');
  });
  it.each([200,404])('continues general composition after a forum lookup (%s)',async status=>{
    let modelCalls=0, forumReads=0;
    const answer='Practise tracking one corner and its matching edge together.';
    const fetcher:typeof fetch=async url=>{
      if(String(url).includes('/forum/search')) {
        forumReads++;
        return Response.json({threads:[]},{status});
      }
      return ++modelCalls===1 ? modelResponse([{tool:'forum',query:'tracking a pair'}]) : modelResponse({answerKind:'general',answer});
    };
    const result=await answerSiteQuestion('How can I improve tracking pairs on my cube?', 'en',config,AbortSignal.timeout(4000),fetcher);
    expect(result.answer).toContain(answer);
    expect(result.sources).toEqual([]);
    expect(forumReads).toBe(1);
    expect(modelCalls).toBe(2);
  });
});

describe('checking generated permutation claims',()=>{
  it('distinguishes an exact J-perm from the same word missing its final U adjustment',async()=>{
    const incomplete="R U R' F' R U R' U' R' F R2 U' R'";
    expect(await invalidJPermClaim('The standard '+incomplete+' form for one J perm.')).toBe(true);
    expect(await invalidJPermClaim('Jb-perm is `'+incomplete+" U'`." )).toBe(false);
    expect(await invalidJPermClaim('My failed attempt was `'+incomplete+'`.')).toBe(false);
    expect(await communityMechanicsEvidence(previous('V06').question,'en')).toContain('two displaced corners');
  });
  it('uses centre orientations when the solved cube has arrows on the centres',async()=>{
    expect(await communityMechanicsEvidence(previous('V02').question,'en')).toContain('2,048');
    expect(await communityMechanicsEvidence('How many different unmarked 3x3 scrambles are there?','en')).toBeUndefined();
  });
});

describe('scope and evidence in long community posts',()=>{
  it('keeps narrative objects and relative clauses out of site and checklist obligations',()=>{
    const question=previous('F03').question;
    expect(requestedAssistantEvidence(question)).toBe('auto');
    expect(assistantAnswerRequirements(question)).toEqual([]);
    expect(assistantAnswerRequirements(question+' Also explain the odds of termination.')).toHaveLength(2);
    expect(requestedAssistantEvidence('The tool is a marker. Can the prisoners signal?')).toBe('auto');
    expect(requestedAssistantEvidence('Can the tool save my splits?')).toBe('pages');
  });

  it('derives the counter threshold for a different population and permits a blocked first visit',async()=>{
    const question=previous('F03').question.replaceAll('100','12');
    const proof=await communityMechanicsEvidence(question,'en');
    expect(proof).toContain('point 22');
    expect(proof).toContain('20 genuine signals plus one');
    expect(proof).toContain('blocked visit does not consume a signal');
  });

  it.each([
    ['Can I determine the full state of a 2x2 cube from three adjacent faces?', 'U=BULD'],
    ['Can I swap just two corners on a cube and a Skewb by legal turns?', 'order three'],
  ])('delivers the verified answer without a model for a closed question',async(question,fact)=>{
    const fetcher=vi.fn<typeof fetch>();
    const result=await answerSiteQuestion(question,'en',config,AbortSignal.timeout(3000),fetcher);
    expect(result.answer).toContain(fact);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('compares independent states in a fixed frame, including an unseen face',async()=>{
    const answer=await communityMechanicsEvidence(previous('F01').question,'en');
    const words=[...(answer??'').matchAll(/`([^`]+)`/g)].map(m=>applyScramble(2,m[1]));
    expect(words).toHaveLength(2);
    for(const face of ['U','F','R'] as const) expect(words[0][face]).toEqual(words[1][face]);
    expect(words[0].D).not.toEqual(words[1].D);
  });

  it('requires the official twist exception before attaching a ruling',()=>{
    const question=previous('F05').question;
    expect(cornerTwistContestQuestion(question)).toBe(true);
    expect(cornerTwistContestQuestion(question+' Also describe a blindfolded repair.')).toBe(false);
    expect(cornerTwistContestVerdict('<html><body><li id="5d">5d</li></body></html>',WCA_REGULATIONS_URL,'en')).toBeUndefined();
  });

  it('checks the two requested corner orientations and the turn metric',async()=>{
    const proof=await communityMechanicsEvidence(previous('F04').question,'en');
    expect(proof).toContain('14 quarter-turns');
    const word=proof!.match(/`([^`]+)`/)![1];
    expect(word.split(' ')).toHaveLength(14);
    const faces=applyScramble(3,word);
    expect([faces.R[0],faces.L[2]]).toEqual(['U','U']);
  });

  it('replaces a wrong top-layer tetrad with a state-to-coordinate algorithm',async()=>{
    const fetcher=vi.fn<typeof fetch>(async()=>modelResponse({answerKind:'general',answer:'The tetrads are two groups of four (e.g. URF, UFL, ULB, UBR and their complement).'}));
    const result=await answerSiteQuestion(previous('F06').question,'en',config,AbortSignal.timeout(3000),fetcher);
    expect(result.answer).toContain('h[p[0]]');
    expect(result.answer).toContain('96 distinct permutations');
    expect(result.answer).toContain('three keys');
  });
});

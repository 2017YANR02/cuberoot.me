import {describe,expect,it,vi} from 'vitest';
import {checkedMoveGoal,conflictsWithMoveGoal} from '../src/utils/site_assistant_move_goal.js';
import {chinaFaqEntries,matchChinaFaq,productClaimIssue,productIssue,questionProduct} from '../src/utils/site_assistant_product.js';
import {answerSiteQuestion} from '../src/utils/site_assistant.js';
import {checkedPassageOpening} from '../src/utils/site_assistant_answer_check.js';

describe('verified community conclusions',()=>{
  it('checks the target slots, side turns and both directions',async()=>{
    const goal=await checkedMoveGoal('How to cycle the up-front, up-back, and down-front edges?','en');
    expect(goal?.answer).toMatch(/UF → (?:DF|UB)/);
    expect(await conflictsWithMoveGoal("Do M2 U M2 U′ M2 U M2 U′.",goal!)).toBe(true);
    expect(await conflictsWithMoveGoal(goal!.answer,goal!)).toBe(false);
    const front=await checkedMoveGoal('Rotate the last three edges. The solved edge is at the front, last layer on top. I never turn the back face.','en');
    expect(front?.slots).toEqual([1,2,3]);
    expect(front?.words.every(w=>!w.includes('B'))).toBe(true);
  });
  it('keeps the correct two-corner swap separate from twisting the corners',async()=>{
    const goal=await checkedMoveGoal('How do I swap opposite corners on a 2x2?','en');
    expect(goal?.pocket).toBe(true);
    expect(await conflictsWithMoveGoal('Corner permutation must be even.',goal!)).toBe(true);
    expect(await conflictsWithMoveGoal(goal!.answer,goal!)).toBe(false);
    expect(await checkedMoveGoal('How do I swap opposite corners on a 3x3?','en')).toBeUndefined();
  });
  it('retains a checked first paragraph if the remaining model request fails',async()=>{
    const events:string[]=[];
    let modelRequests=0;
    const answer=await answerSiteQuestion('How to cycle UF, UB and DF edges? Also explain how to pick the direction.','en',
      {key:'fixture',baseUrl:'https://model.example/v1',model:'test'},AbortSignal.timeout(10000),async input=>{
        if (String(input).includes('model.example')) modelRequests++;
        return new Response('',{status:503});
      },[],undefined,
      async event=>{if(event.type==='answer')events.push(event.answer);});
    expect(events[0]).toMatch(/UF →/);expect(answer.answer).toContain(events[0]);
    expect(modelRequests).toBe(2);
  });
});

describe('external product sources',()=>{
  it('streams a cited first item only when it matches the read passage and the request',()=>{
    const quote='Refund requests close on the last day of registration.';
    const passages=new Map([['official',[quote]]]);
    const line=quote+' [[official]]';
    expect(checkedPassageOpening(line+'\nUnverified second item.','When do refund requests close?',passages)).toEqual({answer:line,id:'official'});
    expect(checkedPassageOpening(line,'Where is the venue?',passages)).toBeUndefined();
    expect(checkedPassageOpening(line.replace('last','first'),'When do refund requests close?',passages)).toBeUndefined();
    expect(checkedPassageOpening(line.replace('official','unread'),'When do refund requests close?',passages)).toBeUndefined();
  });
  const data=[{titleZh:1,contentZh:2,alias:3},'如何报名？','<p>选项目</p><p>确认后缴费。</p>','enter'];
  const html='<div id="enter"><button>如何报名？</button></div><script id="__NUXT_DATA__">'+JSON.stringify(data)+'</script>';
  it('reads published rows by field references and keeps additional requests visible',()=>{
    const entries=chinaFaqEntries(html);
    expect(matchChinaFaq('[粗饼网] 如何报名？怎么退款？',entries)).toMatchObject({fact:{answer:expect.stringContaining('确认后缴费'),sources:[{href:'https://cubing.com/faq#enter'}]},pending:['怎么退款？']});
    expect(chinaFaqEntries(html.replace('id="enter"','id="unpublished"'))).toEqual([]);
  });
  it('reads the specified repository and excludes a same-name claim from another site',async()=>{
    const p=questionProduct('[csTimer] Option to change keybindings?')!;
    const reader=vi.fn().mockResolvedValueOnce([{title:'Option to change keybindings?',number:373,comments:1}]).mockResolvedValueOnce([{author_association:'OWNER',body:'Use the layout selector.'}]);
    const hit=await productIssue(p,'[csTimer] Option to change keybindings?',reader);
    expect(hit?.statements[0].text).toContain('layout');expect(reader.mock.calls[1][0]).toContain('/cs0x7f/cstimer/issues/373/');
    const wrong={id:'local',href:'/timer',read:true,title:'Timer'};
    const sources=new Map([[wrong.id,wrong],[hit!.source.id,hit!.source]]);
    expect(productClaimIssue(p,'It has no setting [[local]]',['local'],sources)).toBe('claim_product_source');
    expect(productClaimIssue(p,'Use the layout [['+hit!.source.id+']]',[hit!.source.id],sources)).toBeUndefined();
    expect(productClaimIssue(p,'csTimer has no setting.',[],sources)).toBe('claim_product_source');
  });
});

import {checkedStateExplanation, correctCycleExamples} from '../src/utils/site_assistant_state_questions.js';
import {organizerFaqAnswer, organizerFaqUrl, organizerQuestion} from '../src/utils/site_assistant_wca_faq.js';
import {cubieStateFromFacelets} from '@cuberoot/shared/smart-cube/cubie';

describe('organizer identity and checked state claims',()=>{
  it('keeps an edition-specific answer tied to the organizer page and all requested clauses',()=>{
    const url='https://www.cubingusa.org/worlds/contact';
    const record={id:'WC2025',website:'https://cubingusa.org/worlds',contact:'[Contact]('+url+')'};
    expect(organizerQuestion('[WCA World Championship 2025] Can I get a refund?')).toEqual({id:'WC2025',text:'Can I get a refund?'});
    expect(organizerFaqUrl(record,'WC2025')).toBe(url);
    expect(organizerFaqUrl({...record,contact:'[Contact](https://elsewhere.com/worlds/contact)'},'WC2025')).toBeUndefined();
    const page='<html><head><title>Worlds 2025</title></head><body><div id="faq"><div class="card"><h5 class="card-header" id="refund">Can I get a refund?</h5><div class="card-body">Apply <a href="/worlds/contact">here</a>.</div></div></div></body></html>';
    expect(organizerFaqAnswer(page,url,'WC2025','Can I get a refund?')?.sources[0].href).toBe(url+'#refund');
    expect(organizerFaqAnswer(page,url,'WC2023','Can I get a refund?')).toBeUndefined();
    expect(organizerFaqAnswer(page,url,'WC2025','Can I get a refund? What about a guest?')).toBeUndefined();
  });
  it('counts round trips under the moving-edge constraint and checks picture-centre words',async()=>{
    expect(await checkedStateExplanation('Edge round trip on a supercube: how many center orientations using ONLY moves which affect this edge?','en')).toMatch(/128.*3072/);
    expect(await checkedStateExplanation('There are pictures on the faces; the orientation of the central pieces matters.','en')).toContain("M' U M U'");
    expect(await correctCycleExamples("For instance R U R' U' cycles three pieces. Learn F2L next.")).toMatch(/4 corners and 3 edges.*Learn F2L/);
    expect(await checkedStateExplanation('Minimum number of cuts for 9x9x9? Stacking cut pieces is fine. Straight cuts only.','en')).toContain('9×9×9 → 12');
  });
  it('checks every uniform-background single-diagonal colouring with the physical cube validator',()=>{
    const faces='URFDLB';
    let tested=0, legal=0;
    function visit(background:string) {
      if (background.length<6) {
        for(const color of faces) if (!background.includes(color) && color!==faces[background.length]) visit(background+color);
        return;
      }
      for(let diagonals=0;diagonals<64;diagonals++) {
        let stickers='';
        for(let face=0;face<6;face++) {
          const diagonal=diagonals & (1<<face) ? [2,4,6] : [0,4,8];
          for(let i=0;i<9;i++) stickers+=diagonal.includes(i)?faces[face]:background[face];
        }
        tested++;if(cubieStateFromFacelets(stickers)) legal++;
      }
    }
    visit('');expect([tested,legal]).toEqual([16960,0]);
  });
});

it('keeps the repository resolution of an illustrated report when the model fails',async()=>{
  const events:string[]=[];
  const title='Module not found: missing WASM asset';
  const fetcher:typeof fetch=async input=>{
    const url=String(input);
    if (url.endsWith('/issues?state=all&per_page=100')) return Response.json([{title,number:376,comments:1}]);
    if (url.endsWith('/issues/376/comments?per_page=30')) return Response.json([{author_association:'MEMBER',body:'Please try `v0.55.2`!'}]);
    return new Response('',{status:503});
  };
  const answer=await answerSiteQuestion('[cubing.js] '+title+'\nThe screenshot shows my build error.','en',
    {key:'fixture',baseUrl:'https://model.example/v1',model:'test'},AbortSignal.timeout(10000),fetcher,[],undefined,
    async event=>{if(event.type==='answer') events.push(event.answer);},'UTC',[{mediaType:'image/png',data:'iVBORw0KGgo='}]);
  expect(events[0]).toContain('v0.55.2');
  expect(answer.answer).toContain(events[0]);
  expect(answer.sources.map(source=>source.href)).toEqual(['https://github.com/cubing/cubing.js/issues/376']);
});

import {assistantAnswerRequirements} from '../src/utils/site_assistant_answer_check.js';
import {issueOpening, onlyScrambleFilterRequests, scrambleFilterOpening} from '../src/utils/site_assistant_product.js';
import {ukGuideArticle,ukGuideAnswer} from '../src/utils/site_assistant_wca_faq.js';
import {checkSolutionWitness} from '../src/utils/site_assistant_state_questions.js';
import {applyScramble,toFaceletString} from '@cuberoot/shared/timer/reconstruct/state';

describe('community failures from the paired evaluation',()=>{
  it('separates numbered reproduction steps from explicit questions and cites a bare fix hash',()=>{
    const question='Exported Skewb definition has oriented centres\n### Steps to reproduce the issue\n1. Open Twizzle.\n2. Export the definition.\n### Observed behaviour\n3. Notice the centres.\n### Questions\n1. Which commit fixes this?\n2. Which release includes it?';
    expect(assistantAnswerRequirements(question)).toEqual(['Which commit fixes this?','Which release includes it?']);
    const url='https://github.com/cubing/cubing.js/issues/384';
    const sha='7ed73a151e36dd2a1539c8a13fa1ab1ac7709354';
    const fact=issueOpening({source:{id:'i',title:'Skewb definition',read:true,href:url},statements:[{role:'repository participant',text:'Fixed by '+sha+'.'}]},'en');
    expect(fact?.answer).toContain('https://github.com/cubing/cubing.js/commit/'+sha);
    expect(fact?.sources[0].href).toBe(url);
  });
  it('anchors All-Stars to its own edition even when the question mentions next year',()=>{
    const q=organizerQuestion('[Rubik’s x TheCubicle CubingUSA All-Stars 2025] Will this format be used for CubingUSA Nationals 2026?')!;
    expect(q.id).toBe('CubingUSAAllStars2025');
    const record={id:q.id,website:'https://cubingusa.org/nationals/2025'};
    expect(organizerFaqUrl(record,q.id)).toBe(record.website+'/contact');
    expect(organizerFaqUrl({...record,website:'https://cubingusa.org/nationals/2026'},q.id)).toBeUndefined();
  });
  it('uses official UK guide headings, with no navigation or glossary in the answer',()=>{
    const title='Can we get a refund?'; const url='https://www.ukca.org/parents-guide-refunds';
    const idx='<main><a href="/parents-guide-refunds">Can we get a refund? Can we transfer?</a></main>';
    expect(ukGuideArticle(idx,title)).toBe(url);
    expect(ukGuideArticle(idx,title+' Are there age limits?')).toBeUndefined();
    expect(ukGuideArticle(idx.replace('href="/','href="https://elsewhere.test/'),title)).toBeUndefined();
    const doc='<main><h1>'+title+'</h1><div class="sqs-code-container">Usually 75% before the deadline.</div><div class="sqs-code-container">Glossary: WCA</div></main>';
    expect(ukGuideAnswer(doc,url,title)).toMatchObject({answer:expect.stringContaining('75%'),sources:[{href:url,read:true}]});
    expect(ukGuideAnswer(doc,url,title)?.answer).not.toContain('Glossary');
  });
  it('computes rather than guessing group order and distinguishes decimal rendering from stored precision',async()=>{
    const count=await checkedStateExplanation('How many configurations if I only turn the faces Top, Left and Front?','en');
    expect(count).toContain('170,659,735,142,400');
    expect(await checkedStateExplanation('How many states if I only turn the faces Top and Bottom?','en')).toContain('16 reachable');
    const q='javascript: 12 edgepieces, 8 corners, ((factorial(edges) * (factorial(corners)) / 2)). Why different?';
    expect(await checkedStateExplanation(q,'en')).toContain('43252003274489856000');
    const action=await checkedStateExplanation('Does the cube group act freely on reachable positions of coloured stickers?','en');
    expect(action).toMatch(/stabilizer is the identity/);
    const order=await checkedStateExplanation("How to find the order of an algorithm? For example, the algorithm $R U R' U'$.",'en');
    expect(order).toContain('is 6.');
  });
  it('checks HTM distance, facelets and the inverse separately',async()=>{
    const answer=await checkedStateExplanation("What's one such position that requires 19 moves to solve, please give the faces and moves?",'en');
    const [setup,solution]=[...answer!.matchAll(/`([^`]+)`/g)].map(m=>m[1]);
    expect(setup.split(' ')).toHaveLength(19);
    expect(toFaceletString(applyScramble(3,setup+' '+solution))).toBe(toFaceletString(applyScramble(3,'')));
    expect(answer).toContain(toFaceletString(applyScramble(3,setup)).match(/.{9}/g)!.join(' / '));
    expect(answer).toContain('remaining 1 turn');
    expect(await checkedStateExplanation('Give a position that requires 19 moves in QTM.','en')).toBeUndefined();
    expect(checkSolutionWitness("Scramble: R U\nSolution: U R",'en')).toMatch(/does not restore/);
    expect(checkSolutionWitness("Scramble: R U\nSolution: U' R'\nThe solution takes 4 moves.",'en')).toContain('2 HTM');
    expect(checkSolutionWitness("Scramble: R U\nSolution: U' R'",'en')).toBeUndefined();
  });
});

describe('complete upstream reports and constructive colour bounds',()=>{
  it('answers a single original device request from the second index page without a model round',async()=>{
    const title='New hardware timer', body='Please add support for the hardware timer';
    const seen:string[]=[];
    const fetcher:typeof fetch=async input=>{
      const url=String(input);seen.push(url);
      if (url.endsWith('per_page=100')) return Response.json(Array.from({length:100},(_,i)=>({title:'Other '+i,number:i+1})));
      if (url.endsWith('&page=2')) return Response.json([{title,body,number:121,comments:1}]);
      if (url.endsWith('/121/comments?per_page=30')) return Response.json([{author_association:'OWNER',body:'The Bluetooth protocol is not yet open.'}]);
      return new Response('',{status:503});
    };
    const answer=await answerSiteQuestion('[csTimer] '+title+'\n'+body,'en',{key:'fixture',baseUrl:'https://model.example/v1',model:'test'},AbortSignal.timeout(10000),fetcher);
    expect(answer.answer).toContain('not yet open');
    expect(answer.sources[0].href).toBe('https://github.com/cs0x7f/cstimer/issues/121');
    expect(seen.some(u=>u.includes('model.example'))).toBe(false);
  });
  it('distinguishes a reported observation, a pending release and a disputed fix',()=>{
    const source={id:'issue',title:'A new issue',href:'https://github.com/cubing/cubing.js/issues/2',read:true};
    const statement={role:'repository participant',text:'Fixed on master, still pending release.'};
    expect(issueOpening({source,statements:[statement]},'en')?.answer).toContain('pending release');
    expect(issueOpening({source,statements:[statement,{role:'original reporter',text:'This is still broken.'}]},'en')).toBeUndefined();
    const observation={role:'original reporter',text:'The “Why compete?” banner only appears when signed out.'};
    expect(issueOpening({source,statements:[observation]},'en')?.answer).toContain('original reporter');
    expect(issueOpening({source:{...source,title:'Untrusted [[other]]'},statements:[statement]},'en')).toBeUndefined();
  });
  it('requires both canonical location and directory title for an alternate article heading',()=>{
    const title='What happens at competitions?',url='https://www.ukca.org/parents-guide-competitions';
    const page='<html><head><title>Parents’ Guide: '+title+' — UK Cube Association</title><link rel="canonical" href="'+url+'"></head><body><main><h1>What happens at speedcubing competitions?</h1><div class="sqs-code-container">Arrive before registration.</div></main></body></html>';
    expect(ukGuideAnswer(page,url,title)?.answer).toContain('Arrive before');
    expect(ukGuideAnswer(page,url+'-other',title)).toBeUndefined();
    expect(ukGuideAnswer(page,url,'What happens after competitions?')).toBeUndefined();
  });
  it('verifies all six faces and distinguishes inclusive from strict bounds',async()=>{
    const q='Can a 3x3 Rubik’s cube have at most 2 stickers of the same color on every face?';
    const result=await checkedStateExplanation(q,'en');
    const word=/`([^`]+)`/.exec(result!)![1];
    const faces=toFaceletString(applyScramble(3,word)).match(/.{9}/g)!;
    expect(faces).toHaveLength(6);
    for(const face of faces) {
      expect(result).toContain(face);
      expect(Math.max(...[...new Set(face)].map(c=>face.split(c).length-1))).toBe(2);
    }
    expect(await checkedStateExplanation(q.replace('at most 2 stickers','less than 2 times'),'en')).toMatch(/^No\./);
    expect(await checkedStateExplanation('三阶魔方每面同色最多1格可能吗？','zh')).toMatch(/^不可以/);
    expect(await checkedStateExplanation(q.replace('3x3','4x4'),'en')).toBeUndefined();
  });
});

it('pairs a checked fix with the preceding contributor diagnosis and leaves speculative causes out',()=>{
  const source={id:'i',title:'Connection failure',read:true,href:'https://github.com/example/project/issues/1'};
  const diagnosis='The change broke the `Cube.verify()` method. It does not accept some valid states.';
  const fix={role:'repository participant',text:'Fixed in '+ 'a'.repeat(40)};
  const fact=(text:string)=>issueOpening({source,statements:[{role:'repository participant',text},fix]},'en')!;
  expect(fact(diagnosis).answer).toContain(diagnosis);
  expect(fact('Maybe '+diagnosis).answer).not.toContain('Maybe');
});

it('retains composition for a structured issue with reproduction steps and more than one observation',async()=>{
  const {resolvesOriginalReport}=await import('../src/utils/site_assistant_product.js');
  const issue={source:{id:'i',title:'Export',read:true,href:'https://github.com/example/project/issues/1'},originalReport:true,completeDiscussion:true,statements:[{role:'repository participant',text:'Fixed in '+ 'f'.repeat(40)}]};
  expect(resolvesOriginalReport(issue,'[Example] Export\n### Observed behavior\n1. Both Skewb and 3x3 exports contain oriented centres.')).toBe(false);
  expect(resolvesOriginalReport(issue,'[Example] Export\nPlease correct the exporter.')).toBe(true);
});

it('routes reproduction algorithms to the named repository and preserves explicit sequence checks',async()=>{
  const {reportedProduct,asksToCheckReportMoves}=await import('../src/utils/site_assistant_product.js');
  const title='FMC scramble padding cancels in output';
  const q='[cubing.js] '+title+'\n### Steps to reproduce\nGenerate random scrambles and check the first turn.\n### Observed behaviour\nThe padding `F F2` is equivalent to `F\x27`. TNoodle handles this differently.';
  expect(reportedProduct(q)?.name).toBe('cubing.js');
  expect(asksToCheckReportMoves(q)).toBe(false);
  expect(asksToCheckReportMoves(q+'\nPlease verify these two sequences.')).toBe(true);
  expect(asksToCheckReportMoves(q+'\nAre the two algorithms equivalent?')).toBe(true);
  expect(asksToCheckReportMoves(q+'\n这两套手顺等价吗？')).toBe(true);
  const sha='9'.repeat(40);
  const fetcher:typeof fetch=async input=>{
    const url=String(input);
    if(url.endsWith('per_page=100')) return Response.json([{title,number:78,comments:1}]);
    if(url.endsWith('/78/comments?per_page=30')) return Response.json([{author_association:'OWNER',body:'Fixed in '+sha}]);
    return new Response('',{status:503});
  };
  const answer=await answerSiteQuestion(q,'en',{key:'fixture',baseUrl:'https://model.example/v1',model:'test'},AbortSignal.timeout(10000),fetcher);
  expect(answer.answer).toContain('/commit/'+sha);
  expect(answer.sources[0].href).toBe('https://github.com/cubing/cubing.js/issues/78');
});

import {cubeConstruction,faceComponents,halfTurnConstruction} from '../src/utils/site_assistant_cube_constructions.js';

describe('construction and ticket regressions',()=>{
  it('deduplicates connected shapes under rotations and reflections',()=>{
    const regions=faceComponents('RRRUBBURU');
    const mirrored=faceComponents('RRRBBUURU');
    expect(mirrored.map(r=>r.shape).sort()).toEqual(regions.map(r=>r.shape).sort());
    expect(regions.reduce((sum,r)=>sum+r.area,0)).toBe(9);
    expect(cubeConstruction('What is the maximum number of distinct free polyominoes on a 3x3 Rubik’s cube?','en')).toContain('maximum is 12');
    expect(cubeConstruction('What is the maximum number of distinct free polyominoes on a 4x4 cube?','en')).toBeUndefined();
  });
  it('distinguishes fixed centres, freely assigned stickers and detachable centres',()=>{
    const text=cubeConstruction('On a Rubik’s cube I randomly place 54 stickers, 9 per color. What is the probability of a solvable scheme?','en');
    expect(text).toContain('3.0803e-16');expect(text).toContain('4.2783e-19');
    expect(cubeConstruction('What is the probability of solving a randomly reassembled Rubik’s cube with fixed centers, corners and edges?','en')).toContain('1/12');
    expect(cubeConstruction('Randomly reassemble a cube with detachable centers, corners and edges. What is the probability on a 3x3?','en')).toContain('1/360');
  });
  it('checks the actual restricted setup and distinguishes contact at a point from edge adjacency',()=>{
    const q='Apply the move sequence M2 U M2 U2 M2 U M2 (H-perm). Can I solve it using only half turns?';
    expect(halfTurnConstruction(q,'en')).toContain('54 stickers');
    expect(halfTurnConstruction(q.replace('M2 U M2 U2 M2 U M2','M2 U2'),'en')).toBeUndefined();
    expect(halfTurnConstruction(q+' Give the shortest solution.','en')).toBeUndefined();
    const colours='A Rubik’s cube has 9 × 6 tiles. What is the minimum number of colors if neighbors share a vertex?';
    expect(cubeConstruction(colours,'en')).toContain('Four colours');
    expect(cubeConstruction(colours.replace('share a vertex','share an edge'),'en')).toBeUndefined();
  });
  it('reads archived issue titles locally, scopes hits to their repository, and preserves attribution',async()=>{
    const p=questionProduct('[worldcubeassociation.org] Region selector')!;
    const issue={title:'Region selector',number:42,comments:1,body:'Switch regions.',repository_url:'https://api.github.com/repos/'+p.repo};
    const reader=vi.fn().mockResolvedValueOnce([]).mockResolvedValueOnce({items:[{...issue,repository_url:'https://api.github.com/repos/other/project'},issue]}).mockResolvedValueOnce([{author_association:'MEMBER',body:'I just implemented a region switch on the map.'}]);
    const hit=await productIssue(p,'[worldcubeassociation.org] Region selector\nSwitch regions.',reader);
    expect(reader.mock.calls[1][0]).not.toContain('Region');
    expect(issueOpening(hit!,'en')?.answer).toContain('implemented a region switch');
    const previous=reader.mock.calls.length;
    reader.mockResolvedValueOnce(issue).mockResolvedValueOnce([{author_association:'MEMBER',body:'I will close this issue and open another.'}]);
    const ref='What happened to WCA website issue #42?';
    expect(questionProduct(ref)).toBe(p);
    const direct=await productIssue(p,ref,reader);
    expect(reader.mock.calls[previous][0]).toBe('https://api.github.com/repos/'+p.repo+'/issues/42');
    expect(issueOpening(direct!,'en')?.answer).toContain('will close');
  });
});

import {requestedAssistantEvidence} from '../src/utils/site_assistant.js';
import {legacySliceDirections,requestedOrderWitnesses} from '../src/utils/site_assistant_state_questions.js';
import {colourCubeOrder} from '../src/utils/site_assistant_mechanics.js';

describe('misrouted mechanics and release-specific ticket evidence',()=>{
  it('constructs and verifies elements of each requested order even when PLL examples appear in the question',async()=>{
    const q="On the Rubik’s cube group, give me an element of order 7 and one of order 11. Is a U permutation relevant?";
    const answer=await requestedOrderWitnesses(q,'en');
    const words=[...answer!.matchAll(/Order (\d+): `([^`]+)`/g)];
    expect(words.map(m=>Number(m[1]))).toEqual([7,11]);
    for(const [,n,word] of words) expect(await colourCubeOrder(word)).toBe(Number(n));
    expect(await requestedOrderWitnesses(q.replace('Rubik’s cube','4x4 Rubik’s cube'),'en')).toBeUndefined();
    expect(await requestedOrderWitnesses(q+' Use only turning the U face.','en')).toBeUndefined();
  });
  it('keeps a previously read article as background while respecting an independent lookup',async()=>{
    expect(requestedAssistantEvidence('I read an article about this. Can every Rubik’s cube be solved in at most 20 moves?')).toBe('auto');
    expect(requestedAssistantEvidence('I read an article about this. Please check the official page.')).toBe('pages');
    expect(requestedAssistantEvidence('Where can I read the article?')).toBe('pages');
    expect(await checkedStateExplanation('Can you prove why every Rubik’s cube takes at most 20 moves?', 'en')).toContain('cosets');
    expect(await checkedStateExplanation('Can you prove why every 4x4 Rubik’s cube takes at most 20 moves?', 'en')).toBeUndefined();
    expect(await requestedOrderWitnesses('Give elements of orders 7, 11 and 13 in the Rubik group.', 'en')).toBeUndefined();
  });
  it('converts both legacy slice directions and preserves literal turn order',()=>{
    const text=legacySliceDirections('Using Cu for center slice up and Cd for center slice down, try Cu U2 Cd U2. What is the standard notation for a center slice move?','en');
    expect(text).toContain("Cu = M′ and Cd = M");
    expect(text).toContain("M' U2 M U2");
    expect(legacySliceDirections('What is the standard notation for a center slice move?','en')).toBeUndefined();
  });
  it('identifies the tagged component when GitHub attributes an earlier discussion to another repo',async()=>{
    const {reportedProduct}=await import('../src/utils/site_assistant_product.js');
    const report='[WCA Statistics] Login does not preserve the target\nThe query page should reopen.';
    const footer='\nOriginally posted by @user in https://github.com/thewca/worldcubeassociation.org/issues/567#issuecomment-789';
    expect(reportedProduct(report+footer)?.name).toBe('WCA Statistics');
    expect(reportedProduct(report+' Compare it to csTimer.'+footer)).toBeUndefined();
  });
  it('attributes a reported release, a duplicate and a conditional configuration diagnosis separately',()=>{
    const source={id:'tn',title:'TNoodle issue',href:'https://github.com/thewca/tnoodle/issues/182',read:true};
    const opening=(text:string,role='repository participant')=>issueOpening({source,statements:[{role,text}]},'en');
    expect(opening('This is a duplicate of #42.')?.answer).toContain('https://github.com/thewca/tnoodle/issues/42');
    expect(opening('Fixed in 2.1.3','thread participant')?.answer).toContain('A participant in the issue reported');
    expect(opening('The setting came from the WCA API.\n\n<img src="image">\n\nPlease update it there and refresh the page.')?.answer).toContain('update it there and refresh');
    expect(opening("I'm not sure whether the website supports that. I'll run some tests.")?.answer).toContain("I'll run some tests");
    expect(opening("I'm not sure whether the website supports that.")?.answer).toBeUndefined();
    expect(opening('This is not a duplicate of #42.')).toBeUndefined();
    expect(opening('I think the next version might fix this.')?.answer).toBeUndefined();
  });
});

describe('community questions with missing constructions or evidence',()=>{
  it('checks a shortest adjacent-corner solution on independent sticker triples',async()=>{
    const q="Swap adjacent corners of the U layer. I don't care about orientation of all corners, position of all edges or their flips.";
    const result=await checkedStateExplanation(q,'en');
    const word=result?.match(/`([URFDLB2' ]+)`/)?.[1];
    expect(word?.split(' ')).toHaveLength(5);
    const slots=['U9 R1 F3','U7 F1 L3','U1 L1 B3','U3 B1 R3','D3 F9 R7','D1 L9 F7','D7 B9 L7','D9 R9 B7'];
    const cubies=(alg:string)=>{
      const faces=applyScramble(3,alg);
      return slots.map(slot=>slot.split(' ').map(id=>faces[id[0] as keyof typeof faces][Number(id[1])-1]).sort().join(''));
    };
    const expected=cubies('');
    [expected[0],expected[1]]=[expected[1],expected[0]];
    expect(cubies(word!)).toEqual(expected);
    expect(await checkedStateExplanation(q+' Keep all edges fixed.','en')).toBeUndefined();
  });

  it('distinguishes a sufficient game bound from a loss below it',async()=>{
    const q='For every 12 moves you make, the cube makes 3 moves. You cannot reverse immediately, but can reverse from a different state.';
    expect(await checkedStateExplanation(q,'en')).toContain('8 moves');
    expect(await checkedStateExplanation(q.replace('12 moves','5 moves'),'en')).toContain('1 move for progress');
    expect(await checkedStateExplanation(q.replace('12 moves','4 moves'),'en')).toContain('cannot force a win');
    const general=q.replace('12 moves','18 moves').replace('3 moves','2 moves')+' Can you generalize?';
    const proof=await checkedStateExplanation(general,'en');
    expect(proof).toContain('at most 6 moves in your second turn');
    expect(proof).toContain('190,080 reachable projections');
    expect(await checkedStateExplanation(q+' Use QTM.','en')).toBeUndefined();
    expect(await checkedStateExplanation(q.replace('from a different state','at any point'),'en')).toBeUndefined();
  });

  it('has two edge-disjoint two-turn detours for each directed face turn',()=>{
    for (const face of 'URFDLB') {
      const powers=['',face,face+'2',face+"'"];
      const vertices=powers.map(word=>toFaceletString(applyScramble(3,word)));
      expect(new Set(vertices).size).toBe(4);
      for (let from=0;from<4;from++) for (let to=0;to<4;to++) {
        if (from===to) continue;
        const edges=new Set<string>();
        for (let via=0;via<4;via++) {
          if (via===from || via===to) continue;
          const first=powers[(via-from+4)%4], second=powers[(to-via+4)%4];
          expect(toFaceletString(applyScramble(3,[powers[from],first].join(' ')))).toBe(vertices[via]);
          expect(toFaceletString(applyScramble(3,[powers[from],first,second].join(' ')))).toBe(vertices[to]);
          edges.add(from+'-'+via);edges.add(via+'-'+to);
        }
        expect(edges.size).toBe(4);
      }
    }
  });

  it('checks a physical transcription separately from the simulated construction',async()=>{
    const q='Can a standard 3x3 have at most 2 stickers of the same color on every face? Test on a real cube.';
    const proof=await checkedStateExplanation(q,'en');
    expect(proof).toMatch(/^I have no firsthand/);
    const alg=proof?.match(/`([^`]+)`/)?.[1];
    expect(alg?.split(' ')).toHaveLength(5);
    const data=applyScramble(3,alg!);
    const readings=Object.entries(data).map(([face,stickers])=>face+'='+stickers.join('')).join(' ');
    expect(await checkedStateExplanation(q+' '+readings,'en')).toContain('Your readings meet');
    expect(await checkedStateExplanation(q+' U=UUUUUUUUU R=RRRRRRRRR F=FFFFFFFFF D=DDDDDDDDD L=LLLLLLLLL B=BBBBBBBBB','en')).toContain('Your readings exceed');
    const strict=q.replace('at most 2 stickers','less than X times');
    expect(await checkedStateExplanation(strict+' U=UUUUUUUUU R=RRRRRRRRR F=FFFFFFFFF D=DDDDDDDDD L=LLLLLLLLL B=BBBBBBBBB','en')).toContain('smallest integer X is 10');
    expect(await checkedStateExplanation(q+' No simulations.','en')).toBe('I have no firsthand physical-cube test to report.');
    const remote=vi.fn(async()=>new Response('',{status:503}));
    const followup=await answerSiteQuestion(readings,'en',{key:'fixture',baseUrl:'https://model.example/v1',model:'test'},
      AbortSignal.timeout(2000),remote,[{role:'user',content:q},{role:'assistant',content:proof!}]);
    expect(followup.answer).toContain('Your readings meet');
    expect(remote.mock.calls).toHaveLength(0);
    expect(await checkedStateExplanation(q+' '+readings+' U=UUUUUUUUU','en')).toContain('send one nine-letter reading');
  });

  it('uses release evidence only for matching requests and intact source files',async()=>{
    const question='Can the same scramble be generated twice in the same round?';
    expect(onlyScrambleFilterRequests([question,'Is there any protection against this in TNoodle?'])).toBe(true);
    expect(onlyScrambleFilterRequests(['TNoodle 会在同一轮生成重复的打乱吗？'])).toBe(true);
    expect(onlyScrambleFilterRequests(['TNoodle 会在同一轮生成重复的打乱吗？再计算发生概率。'])).toBe(false);
    expect(onlyScrambleFilterRequests([question,'Can you calculate the probability?'])).toBe(false);
    const read=vi.fn(async(url:string)=>({sha:url.split('/').at(-1),encoding:'base64',content:'YWJj'}));
    const product=questionProduct('TNoodle')!;
    expect(await scrambleFilterOpening(product,question+' On version 1.1.2.','en',read)).toBeUndefined();
    expect(read).not.toHaveBeenCalled();
    expect(await scrambleFilterOpening(product,question,'en',read)).toBeUndefined();
    expect(read).toHaveBeenCalledTimes(2);
  });

  it('bounds duplicate lookups to one trusted same-repository reference and cites the fix separately',async()=>{
    const product=questionProduct('TNoodle')!;
    const issue={title:'Browser exception report',number:20,comments:1,body:'It crashes.'};
    const read=vi.fn().mockResolvedValueOnce([issue])
      .mockResolvedValueOnce([{author_association:'OWNER',body:'Duplicate of #19.'}])
      .mockResolvedValueOnce([{body:'Fixed in 2.4.1.'}]);
    const result=await productIssue(product,'[TNoodle] Browser exception report\nIt crashes.',read);
    expect(read.mock.calls.at(-1)?.[0]).toBe('https://api.github.com/repos/thewca/tnoodle/issues/19/comments?per_page=30');
    expect(issueOpening(result!,'en')?.sources.map(s=>s.id)).toEqual(['product:issue:thewca/tnoodle:20','product:issue:thewca/tnoodle:19']);
    const ambiguous=vi.fn().mockResolvedValueOnce([issue]).mockResolvedValueOnce([{author_association:'MEMBER',body:'Maybe a duplicate of #19.'}]);
    const unrelated=await productIssue(product,'[TNoodle] Browser exception report\nIt crashes.',ambiguous);
    expect(ambiguous).toHaveBeenCalledTimes(2);
    expect(unrelated?.duplicateResolution).toBeUndefined();
  });

  it('separates a camera developer’s feature from a request about a site tool',()=>{
    expect(requestedAssistantEvidence('I added a feature to calibrate the camera. How can I improve it?')).toBe('auto');
    expect(requestedAssistantEvidence('I added a feature to calibrate the camera. How does the site tool work?')).toBe('pages');
  });
});

it('checks the paired-slice circle construction on interior points including both axes',()=>{
  const radius=5, face=10;
  // Pull each visible point backwards through the rotations to find its
  // original colour. Include both orders to catch interference between pairs.
  const pairs=[[0,5],[3,4],[4,3],[5,0]];
  for (const order of [pairs,[...pairs].reverse()]) {
    for (let u=-9;u<=9;u++) for (let v=-9;v<=9;v++) {
      let x=u,y=v,z=face;
      for (const [a,b] of order) {
        if (Math.abs(y)===a) [x,z]=[z,-x];
        if (Math.abs(z)===b) [x,y]=[-x,-y];
        if (Math.abs(y)===a) [x,z]=[-z,x];
      }
      expect(x===-face || y===-face || z===-face).toBe(u*u+v*v===radius*radius);
    }
  }
});

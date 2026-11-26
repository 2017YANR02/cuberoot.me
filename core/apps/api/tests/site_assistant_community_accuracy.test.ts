import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';
import { matchScrambledState, repeatedEdgeColour, repeatedCornerOrientation, lastPairExchange, cubieRepresentation, oddCubeCornerExchange, reductionDefinition, cubeConceptFacts } from '../src/utils/site_assistant_cubing_help.js';
import { repairedPythonFaceWalk, pythonScrambleListAnswer, invertedScrambleLoop, checkedScrambleExample, cppFaceWalk, distinctFaceGenerator } from '../src/utils/site_assistant_scramble_code.js';
import { requestsOnlyIssueDiscussion, misattributedIssueQuote, attributedIssueOpening, issueOpening, productIssue, questionProduct } from '../src/utils/site_assistant_product.js';
import { requestedAssistantEvidence } from '../src/utils/site_assistant.js';

describe('community evidence and executable answers', () => {
  it('keeps authors distinct when a reporter and reviewer have the same repository association', async () => {
    const question='WCA website issue #51';
    const issue=await productIssue(questionProduct(question)!,question,async url => url.includes('/comments') ? [
      {author_association:'CONTRIBUTOR',user:{login:'Reviewer'},body:'You are welcome to submit a pull request.'},
      {author_association:'CONTRIBUTOR',user:{login:'Reporter'},body:'I will implement it next week.'},
    ] : {number:51,comments:2,user:{login:'Reporter'},title:'Export',body:'I saw an export error.'});
    expect(issue!.statements.map(s=>[s.author,s.originalReporter])).toEqual([['Reviewer',false],['Reporter',true]]);
    expect(issueOpening(issue!,'en')!.answer).toContain('original reporter @Reporter');
    expect(misattributedIssueQuote(issue!, '@Reviewer wrote: “I will implement it next week.”')).toBe(true);
    expect(misattributedIssueQuote(issue!, '@Reporter wrote: “I will implement it next week.”')).toBe(false);
  });

  it('keeps a reported observation, a qualified diagnosis and a pending change with their authors', () => {
    const issue={source:{id:'issue:1',href:'https://github.com/thewca/worldcubeassociation.org/issues/1',title:'Registration',read:true},
      reporter:'Reporter',reportBody:'The registration list is empty.',statements:[
        {role:'thread participant',author:'A',text:'> Someone else said it was fixed.\nOur working theory is a stale filter.'},
        {role:'repository participant',author:'B',text:'A fix is proposed in #42. It will need downtime.'},
      ]};
    const answer=attributedIssueOpening(issue,'Who explained the issue and proposed a change?','en')!;
    expect(answer.answer).toContain('@Reporter wrote, “The registration list is empty.” [[issue:1]]');
    expect(answer.answer).toContain('@A wrote, “Our working theory is a stale filter.” [[issue:1]]');
    expect(answer.answer).toContain('@B wrote, “A fix is proposed in #42. It will need downtime.” [[issue:1]]');
    expect(answer.answer).not.toContain('Someone else');
    expect(attributedIssueOpening({...issue,source:{...issue.source,read:false}},'Who explained it?','en')).toBeUndefined();
  });

  it('requires a stated odd-order corner swap and keeps the physical diagnosis conditional', () => {
    const question='On a 7x7 only two corners are swapped. Is disassembly necessary?';
    expect(oddCubeCornerExchange(question,'en')).toMatch(/If just those two corners/);
    expect(oddCubeCornerExchange(question.replace('7x7','6x6'),'en')).toBeUndefined();
    expect(oddCubeCornerExchange(question.replace('swapped','twisted'),'en')).toBeUndefined();
  });

  it('grounds the last-edge diagnosis, solver encoding and loop condition in verifiable invariants', () => {
    const edges='The cube is solved except two edges on the last layer. Is there an algorithm?';
    expect(lastPairExchange(edges,'en')).toContain('three transpositions');
    expect(lastPairExchange('4x4 '+edges,'en')).toBeUndefined();
    const represent="How can I represent a Rubik's cube in code?";
    const stateCount=43252003274489856000n;
    expect(stateCount.toString(2)).toHaveLength(66);
    expect(cubieRepresentation(represent,'en')).toContain('66 bits');
    expect(cubieRepresentation(represent+' Also build a solver.','en')).toBeUndefined();
    const python='Python cube scramble infinite loop and index out of range\nwhile size < 20:\n  if valid(moves, size - 1) == False:\n    print ("retry")\n    while (valid(moves, size - 1)) != False:\n      moves.remove(size - 1)\n      moves.append(move)\nwhile i < 20:\n  if valid(moves, i) == False:\n    break\n  i += 1';
    expect(invertedScrambleLoop(python,'en')).toContain('range(20)');
    expect(invertedScrambleLoop(python.replace('while (valid(moves, size - 1))','while (valid(moves, size))'),'en')).toBeUndefined();
  });

  it.skipIf(spawnSync('c++',['--version']).status!==0)('compiles the published C++ and checks every face transition', () => {
    const question='My scramble generator uses cout << move. How do I prevent opposing faces repeating more than once, like R L R?';
    const answer=checkedScrambleExample(question,'en')!;
    expect(answer).toContain(cppFaceWalk);
    expect(checkedScrambleExample(question+' Also prove uniform sampling.','en')).toBeUndefined();
    const scratch=fileURLToPath(new URL('../../../../.tmp/scratch/',import.meta.url));
    mkdirSync(scratch,{recursive:true});
    const dir=mkdtempSync(join(scratch,'face-walk-'));
    try {
      const exe=join(dir,'check');
      const main=answer.split('```cpp\n')[1].split('\n```')[0];
      const compile=(input:string)=>spawnSync('c++',['-std=c++17','-x','c++','-','-o',exe],{input,encoding:'utf8'});
      expect(compile(main).status).toBe(0);
      expect(spawnSync(exe,[],{encoding:'utf8'}).stdout.trim().split(/\s+/)).toHaveLength(22);
      const test=cppFaceWalk+`\nint main() {
        for (int a=0; a<6; ++a) for (int b=0; b<6; ++b) for (int c=0; c<6; ++c) {
            bool sameAxis = a/2 == b/2;
            if (allowedFace(a,b,c) != (b!=c && !(sameAxis && a!=b && a==c))) return 1;
        }
        return !(allowedFace(-1,0,1) && allowedFace(0,4,0) && !allowedFace(0,1,0));
      }`;
      expect(compile(test).status).toBe(0);
      expect(spawnSync(exe).status).toBe(0);
    } finally { rmSync(dir,{recursive:true,force:true}); }
  });

  it('distinguishes a positive index from a predecessor, and preserves move suffixes', () => {
    const length='Python cube scramble: more than one item?\nif turns:\n    print(turns[-1])\nturns.append(move)';
    const result=pythonScrambleListAnswer(length,'en');
    expect(result).toContain('len(turns) > 1');
    expect(result).toContain('true when choosing the second move');
    const output='Python cube scramble: print without quotes and no repeated faces.\nwhile len(moves) < 17:\n    moves.append(face + suffix)';
    const answer=pythonScrambleListAnswer(output,'en')!;
    expect(answer).toContain('print(scramble(17))');
    expect(pythonScrambleListAnswer(output+' Also enforce opposite face constraints.','en')).toBeUndefined();
  });

  it('distinguishes a cubie from its current slot and verifies the corner-twist counterexample', async () => {
    const {cube3x3x3}=await import('cubing/puzzles');
    const solved=(await cube3x3x3.kpuzzle()).defaultPattern();
    const orientations=solved.applyAlg('R R R').patternData.CORNERS.orientation;
    expect(orientations.filter(value=>value!==0)).toHaveLength(4);
    expect(orientations).toEqual(solved.applyAlg("R'").patternData.CORNERS.orientation);
    expect(repeatedCornerOrientation('Do three repeats reset corner orientation even if corners permute?','en')).toContain('sum');
    expect(repeatedCornerOrientation('Do three repeats of the following algorithm R U F reset corner orientation?','en')).toBeUndefined();
    expect(repeatedEdgeColour('How should I fix an edge with the same color on both stickers?','en')).toContain('inventory all 12');
    expect(repeatedEdgeColour('How do I orient a last-layer edge?','en')).toBeUndefined();
  });

  it('computes order examples as mathematics and composes two reachable states via solved', async () => {
    const {functionOrderExamples}=await import('../src/utils/site_assistant_mechanics.js');
    const answer=await functionOrderExamples("Give the order function for each sequence: F(U,R), F(U',R) and F(F,F).",'en');
    expect(answer).toMatch(/105 repetitions, 210 face turns/);
    expect(answer).toMatch(/63 repetitions, 126 face turns/);
    expect(answer).toMatch(/2 repetitions, 4 face turns/);
    expect(await functionOrderExamples('Verify F(U,R) as typed.','en')).toBeUndefined();
    const matching=matchScrambledState('Can one scrambled 3×3 be exactly the same as another cube?','en');
    expect(matching).toContain('inverse of B’s solution');
    expect(matchScrambledState('What is the chance that two scrambled 3×3 cubes are exactly the same?','en')).toBeUndefined();
  });
  it('carries original issue checklist items through the final paragraph and retains short acknowledgments', () => {
    const issue={source:{id:'issue:9',title:'Product · Layout',href:'https://github.com/example/project/issues/9',read:true},
      reporter:'Reporter',reportBody:'- [x] Show the list header\n- [ ] Pin the item count\n- [x] Consider a reset button',
      statements:[{author:'Reviewer',role:'repository participant',text:'Will do'}]};
    const answer=attributedIssueOpening(issue,'Summarize the discussion','en')!;
    expect(answer.answer).toContain('Consider a reset button');
    expect(answer.answer).toContain('@Reviewer wrote, “Will do”');
  });
  it('derives directed pairs from executable Python comparisons', () => {
    const q='My Python scramble sometimes uses the same face twice.\nfor i in range(12):\n    seq.append(random.choice(faces))\nif seq[j] == "F" and seq[j+1] == "B":\n    seq[j+1] == random.choice(faces)';
    const answer=repairedPythonFaceWalk(q,'en')!;
    expect(answer).toContain('length=12');
    expect(answer).toContain('forbidden = {("F", "B")}');
    expect(repairedPythonFaceWalk(q.replace('seq[j+1] == random.choice','seq[j+1] = random.choice'),'en')).toBeUndefined();
  });
  it('limits direct issue summaries to complete attributed discussions and retains the source of an observation', () => {
    const issue={source:{id:'issue:42',title:'Product · Registration',href:'https://github.com/example/project/issues/42',read:true},
      reporter:'Reporter',reportBody:'Failed at https://www.worldcubeassociation.org/competitions/Test2025/live but worked after a refresh.',
      completeDiscussion:true,statements:[{author:'Reviewer',role:'repository participant',text:'I think this is related to indexing.'}]};
    const request=issue.source.href+'\nRegistration\nSummarize the discussion.';
    expect(requestsOnlyIssueDiscussion(issue,request)).toBe(true);
    expect(requestsOnlyIssueDiscussion(issue,request+' Also calculate the capacity.')).toBe(false);
    expect(requestsOnlyIssueDiscussion({...issue,completeDiscussion:false},request)).toBe(false);
    expect(attributedIssueOpening(issue,request,'en')?.answer).toContain('Failed at Test2025 but worked after a refresh.');
  });

  it('keeps simple definitions bounded and gives odd and even order context to mixed questions', () => {
    expect(reductionDefinition('高階方塊 降階法是什麼？','zh')).toContain('中棱');
    expect(reductionDefinition('What is reduction? Also give an algorithm.','en')).toBeUndefined();
    expect(cubeConceptFacts('Can my 6x6 have edge parity?')).toContain('Even orders have neither reference piece');
    expect(cubeConceptFacts('Odd order big cube reduction: why pair wings?')).toContain('Wing-pairing cases can still arise');
  });

  it('runs the published JS for all 90 legal two-move face/second-suffix combinations', () => {
    // Only our own literal is executed. Exercise both boundaries of every pick bucket.
    const generate=runInNewContext('('+distinctFaceGenerator+')',{Math:{floor:Math.floor,random:()=>draws.shift()!}}) as (n:number)=>string;
    const draws:number[]=[];
    const outcomes=new Set<string>();
    for(let first=0;first<6;first++) for(let next=0;next<5;next++) for(let suffix=0;suffix<3;suffix++) for(const offset of [0,0.999]) {
      draws.push((first+offset)/6,0,(next+offset)/5,(suffix+offset)/3);
      const word=generate(2),[a,b]=word.split(' ');
      expect(a).toMatch(/^[URFDLB]$/);
      expect(b).toMatch(/^[URFDLB]['2]?$/);
      expect(b[0]).not.toBe(a);
      outcomes.add(word);
    }
    expect(outcomes.size).toBe(90);
    expect(generate(0)).toBe('');
  });

  it('keeps compound programming requirements and explicit product lookups on the normal path', () => {
    const question="How can I stop my JavaScript scramble generator choosing the same face twice in a row?";
    expect(checkedScrambleExample(question,'en')).toContain(distinctFaceGenerator);
    expect(checkedScrambleExample(question+' Also avoid opposite faces.','en')).toBeUndefined();
    expect(requestedAssistantEvidence(question+' I am building a Rubik’s cube timer website.')).toBe('auto');
    expect(requestedAssistantEvidence(question+' Please check the documentation.')).toBe('pages');
  });
});

describe('community requests through the public Agent entry', () => {
  async function answer(question:string, thinking:'auto'|'deep'='auto') {
    const {answerSiteQuestion}=await import('../src/utils/site_assistant.js');
    const rules='<html><body><ul><li id="4b">4b) Use a current official WCA scramble program.</li><li id="4b3">4b3) Require at least 2 moves to solve, with equal probability for eligible states.</li></ul></body></html>';
    const read:typeof fetch=async input=>{
      if(String(input)==='https://www.worldcubeassociation.org/regulations/') return new Response(rules,{headers:{'content-type':'text/html'}});
      throw new Error('Unexpected dependency: '+String(input));
    };
    return answerSiteQuestion(question,'en',null,AbortSignal.timeout(5000),read,[],undefined,undefined,'UTC',[],thinking);
  }
  it.each(['auto','deep'] as const)('separates function notation, restricted generators and observational ambiguity in %s',async mode=>{
    const period=await answer("Can we calculate how many times to repeat a sequence until solved? Define an order function F(U,R) and F(U',R).",mode);
    expect(period.answer).toMatch(/105/);
    expect(period.answer).toMatch(/63/);
    const cyclic=await answer("Is it possible to solve the 3x3 with only the commutator [U,R]?",mode);
    expect(cyclic.answer).toMatch(/cyclic subgroup/);
    expect(cyclic.answer).toMatch(/order.*6\b/);
    const hidden=await answer("When can I solve a legal cube blindly from three adjacent faces?",mode);
    expect(hidden.answer).toMatch(/DB and DL/);
    expect(hidden.answer).toMatch(/any compatible state/);
  });
  it('uses the actual JavaScript traceback and verifies an official rule before answering a practice-code question',async()=>{
    const diag=await answer('Python scramble failure on win32\nexecjs/_external_runtime.py\nexecjs._exceptions.ProgramError: SyntaxError: Unexpected token');
    expect(diag.answer).toContain('execjs.get().name');
    const q='What rules do scrambles have to follow for competitions? My Python scrambler gives double moves.\nimport random\nturns = ["R", "R\'", "D"]\nmove = turns[random.randrange(0, 2)]';
    const walk=await answer(q,'deep');
    expect(walk.answer).toMatch(/unreachable entries: D/);
    expect(walk.answer).toContain('practice_scramble');
    expect(walk.sources).toEqual(expect.arrayContaining([expect.objectContaining({id:'wca:regulations:4',read:true})]));
  });
  it('binds Python dispatch arguments once and invokes the selected method exactly once per iteration',async()=>{
    const {pythonMoveDispatch}=await import('../src/utils/site_assistant_scramble_code.js');
    const q='Python dictionary for a cube scramble\nturns = {0: self.up(), 1: self.up("inverted")}\nfor i in range(50):\n  key = random.randint(0,1)\n  turns[key]';
    const code=pythonMoveDispatch(q,'en')?.split('```python\n')[1]?.split('```')[0];
    expect(code).toBeDefined();
    const check='\nseen=[]\nclass Cube:\n    def up(self, flag=None): seen.append(flag)\nfrom unittest.mock import patch\nwith patch("random.choice", side_effect=[0,1]*25): random_cube(Cube())\nassert seen == [None,"inverted"]*25\n';
    expect(spawnSync('python3',['-I','-c',code+check]).status).toBe(0);
  });
});

it('keeps numbered alternatives and subsequent edits with the contributor',async()=>{
  const issue={reporter:'A',reportBody:'Prices are displayed incorrectly.',source:{id:'i',href:'https://github.com/thewca/worldcubeassociation.org/issues/1',title:'Prices',read:true},
    statements:[{author:'B',role:'repository participant',text:'I see three options.\n1. Compile the source data\n2. Provide formatting from the backend\n3. Override the client formatter\nEdit: another option is to port the library.'}]};
  const result=attributedIssueOpening(issue,'Summarize the discussion','en');
  for(const part of ['1. Compile','2. Provide','3. Override','another option']) expect(result?.answer).toContain(part);
});

describe('community follow-ups preserve the scope of the question',()=>{
  it('derives hidden edges from the actual observed faces',async()=>{
    const {threeFaceBlindSolve}=await import('../src/utils/site_assistant_mechanics.js');
    const ask=(faces:string)=>'Can I solve a legal 3x3 blind seeing just '+faces+'?';
    expect(threeFaceBlindSolve(ask('U, D and F'),'en')).toContain('hidden edges are BL, BR.');
    expect(threeFaceBlindSolve(ask('L, F and U'),'en')).toContain('hidden edges are DB, DR, BR.');
    // Every choice of three visible faces leaves all edges between two
    // unobserved, non-opposite faces hidden.
    const faces=[...'URFDLB'], opposite:Record<string,string>={U:'D',D:'U',L:'R',R:'L',F:'B',B:'F'};
    for (let a=0;a<4;a++) for (let b=a+1;b<5;b++) for (let c=b+1;c<6;c++) {
      const view=[faces[a],faces[b],faces[c]];
      const rest=faces.filter(f=>!view.includes(f));
      const actual=threeFaceBlindSolve(ask(view.join(', ')),'en')?.match(/hidden edges are ([A-Z, ]+)\./)?.[1].split(', ');
      const expected=rest.flatMap((f,i)=>rest.slice(i+1).filter(g=>g!==opposite[f]).map(g=>[f,g].sort().join('')));
      expect(actual?.map(e=>[...e].sort().join('')).sort()).toEqual(expected.sort());
    }
    expect(threeFaceBlindSolve(ask('U, D and F plus B'),'en')).toBeUndefined();
    expect(threeFaceBlindSolve('合法三阶只看 U、D、F 三面能盲拧吗？','zh')).toContain('BL、BR');
  });

  it('computes the subgroup size for a sequence operand and for commuting faces',async()=>{
    const {generalSolveCommutator,singleCommutatorSolve}=await import('../src/utils/site_assistant_mechanics.js');
    const ask=(word:string)=>'Can I solve any 3x3 using only the commutator '+word+'?';
    const word=generalSolveCommutator(ask('[R U,F]'))!;
    const {getCube3}=await import('@cuberoot/shared/recon/cube3');
    const cube=await getCube3(), solved=cube.defaultPattern();
    const move=cube.algToTransformation("R U F U' R' F'");
    let state=solved.applyTransformation(move), order=1;
    while(!state.isIdentical(solved) && order<1300){state=state.applyTransformation(move);order++;}
    expect(order).toBeLessThan(1300);
    expect(await singleCommutatorSolve(word,'en')).toContain('is '+order+',');
    expect(await singleCommutatorSolve(generalSolveCommutator(ask('[R,L]'))!,'en')).toContain('only one state');
    expect(generalSolveCommutator(ask('[R,U] and [F,D]'))).toBeUndefined();
    expect(generalSolveCommutator('Can I solve this scramble using only the commutator [R,U]?')).toBeUndefined();
  });

  it('checks literal Python sampling bounds, negative indices and duplicate entries',async()=>{
    const {competitionPythonWalk}=await import('../src/utils/site_assistant_scramble_code.js');
    const ask=(moves:string,draw:string)=>'My Python scrambler has double moves. What are the competition rules?\nturns = ['+moves+']\nturn = turns[random.'+draw+']';
    const moves='"U","D","F"';
    expect(competitionPythonWalk(ask(moves,'randrange(2)'),'en')).toContain('unreachable entries: F');
    expect(competitionPythonWalk(ask(moves,'randint(0, 3)'),'en')).toContain('IndexError');
    expect(competitionPythonWalk(ask(moves,'randrange(-1,-4,-1)'),'en')).not.toMatch(/IndexError|unreachable entries/);
    expect(competitionPythonWalk(ask(moves,'randrange(0,3,0)'),'en')).toContain('ValueError');
    expect(competitionPythonWalk(ask('"R","U","R"','randrange(2)'),'en')).not.toContain('unreachable entries');
    expect(competitionPythonWalk(ask(moves,'randrange(n)'),'en')).toBeUndefined();
  });

  it('keeps an inline issue reference, the original request and a later reversal with their authors',()=>{
    const href='https://github.com/thewca/worldcubeassociation.org/issues/7';
    const issue={reporter:'Author',reportBody:'We tried it yesterday. It works in staging. Please keep the mobile label as well.',source:{id:'ticket:7',href,title:'Button',read:true},completeDiscussion:true,
      statements:[{author:'Reviewer',role:'repository participant',text:'I proposed a change. It should fix #4. This will fix #5. We decided against the change.'}]};
    const q='Who proposed what, and what was the outcome? '+href;
    expect(requestsOnlyIssueDiscussion(issue,q)).toBe(true);
    const answer=attributedIssueOpening(issue,q,'en')!.answer;
    expect(answer).toContain('Please keep the mobile label');
    expect(answer).toMatch(/Outcome recorded[^\n]+@Reviewer[^\n]+decided against/);
    expect(requestsOnlyIssueDiscussion(issue,'Summarize the discussion in '+href)).toBe(true);
    expect(requestsOnlyIssueDiscussion(issue,q+' Also translate the original report.')).toBe(false);
    expect(requestsOnlyIssueDiscussion({...issue,reportTruncated:true},q)).toBe(false);
    expect(misattributedIssueQuote(issue,'@Reviewer wrote, “Please keep the mobile label as well.”')).toBe(true);
  });
});

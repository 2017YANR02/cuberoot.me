import { parseCubeAlg } from '@cuberoot/shared/alg-transform';
import { type Alg, Move, Grouping, Commutator, Conjugate } from 'cubing/alg';
import { canonicalize3x3WideMoves, countMoves, tokenizeMoves } from '@cuberoot/shared/alg-notation';
import { getCube3, invertAlg } from '@cuberoot/shared/recon/cube3';
import type { AssistantAnswer, AssistantMessage } from '@cuberoot/shared/site-assistant';
import { z } from 'zod';

const sequence = z.string().trim().min(1).max(480);
export const verifyCubeMovesCall = z.object({
  tool: z.literal('verify_cube_moves'),
  setup: sequence.optional(),
  algorithm: sequence,
  comparison: sequence.optional(),
}).strict();

export type VerifyCubeMovesCall = z.infer<typeof verifyCubeMovesCall>;

export function requestsCubeMoveVerification(question: string) {
  const intent = /(?:验证|校验|核验|检验|检查|对比|比较|等价|能(?:否|不能|不能够)|是否|会不会|一样|试一下)|\b(?:verify|check|test|simulate|compare|equivalent|identical|same|will|does|would|do|can)\b/i;
  const moves = /魔方|三阶|起始局面|转法|手顺|(?:两套|这[套条]|这[两二]套)公式|\b(?:cube|moves?|algorithms?|scramble|3\s*[x×]\s*3|[URFDLBMESxyz](?:w)?[2']?)\b/i;
  const goal = /能否还原|能不能还原|是否还原|能还原|还原吗|复原|归位|等价|(?:终态|状态|局面|结果).{0,8}(?:一样|相同|不同|一致|相等)|(?:一样|相同|不同|一致|相等).{0,8}(?:终态|状态|局面|结果)|\b(?:solv(?:e[ds]?|ing)|equivalent|identical|(?:same|different)\s+(?:(?:final|ending)\s+)?(?:state|pattern|result|position|stickers?))\b/i;
  const stateEquality = /\b(?:final|ending)[ -]state (?:equality|equivalence)\b/i;
  if (!intent.test(question) || !moves.test(question) || !(goal.test(question) || stateEquality.test(question))) return false;
  const supplied = suppliedSequences(question);
  return supplied === undefined || supplied.length > 0;
}

const normalizePrimes = (value: string) => value.replace(/[’′]/g, "'");
const supportedMove = /^(?:[URFDLB]w?|[urfdlbMESmsexyz])(?:[2']|2')?$/;

function plainCubeAlg(value: string) {
  if (/[()[\]]/.test(value)) {
    const normalized = normalizePrimes(value);
    if (normalized.length > 480 || !/^[URFDLBMESurfdlbmesxyzw\d',:\s()[\]]+$/.test(normalized)) return;
    try {
      const tree = parseCubeAlg(normalized);
      // Bound the expanded leaf count before iterating any repetitions. Reject
      // empty subtrees too: repeating an empty group can consume unbounded work.
      function size(alg: Alg): number {
        let total = 0;
        for (const node of alg.childAlgNodes()) {
          if (node instanceof Move && supportedMove.test(node.toString())) total++;
          else if (node instanceof Grouping) total += size(node.alg) * Math.abs(node.amount);
          else if (node instanceof Commutator) total += 2*(size(node.A)+size(node.B));
          else if (node instanceof Conjugate) total += 2*size(node.A)+size(node.B);
          else return Infinity;
          if (total > 120 || !Number.isFinite(total)) return Infinity;
        }
        return total || Infinity;
      }
      if (!(size(tree) <= 120)) return;
      return [...tree.experimentalLeafMoves()].map(move => move.toString()).join(' ');
    } catch { return; }
  }
  const { moves, junk } = tokenizeMoves(normalizePrimes(value));
  if (junk.length || moves.length === 0 || moves.length > 120 || moves.some(move => !supportedMove.test(move.raw))) return;
  return moves.map(move => move.raw).join(' ');
}

/** Accept complete sequences only. A model may label the supplied inputs, never rewrite them. */
type SuppliedSequence = { alg: string; start: number; end: number };

function suppliedSequences(question: string) {
  const sequences: SuppliedSequence[] = [];
  let invalidQuote = false;
  let unquoted = normalizePrimes(question).replace(/`([^`\n]+)`|"([^"\n]+)"|“([^”\n]+)”|「([^」\n]+)」/g,
    (match, code: string, double: string, curved: string, angle: string, start: number) => {
      const alg = plainCubeAlg(code || double || curved || angle);
      if (alg) sequences.push({ alg, start, end: start + match.length });
      else invalidQuote = true;
      return '|'.padEnd(match.length);
    });
  if (invalidQuote || /[`“”「」]/.test(unquoted)) return;
  const groupStart = /[([](?=\s*(?:[URFDLBMESurfdlbmesxyz][URFDLBMESurfdlbmesxyzw2']*(?=[\s,:()[\]]|$)|[([]))/g;
  for (let match; (match = groupStart.exec(unquoted));) {
    const start = match.index;
    let depth = 1, end = start + 1;
    while (depth && end < unquoted.length) {
      const c = unquoted[end++];
      if (c === '(' || c === '[') depth++;
      if (c === ')' || c === ']') depth--;
    }
    if (depth) return;
    end += /^\d*'?/.exec(unquoted.slice(end))![0].length;
    const alg = plainCubeAlg(unquoted.slice(start,end));
    if (!alg) return;
    sequences.push({alg,start,end});
    unquoted = unquoted.slice(0,start) + '|'.repeat(end-start) + unquoted.slice(end);
    groupStart.lastIndex = end;
  }
  // Unconsumed notation delimiters could hide a malformed operand.
  const prose = unquoted.replace(/\((?:\s*3\s*[x×]\s*3\s*|[a-z]{3,}(?: [a-z]{2,})*)\)/g,'');
  if (/[()[\]（）［］]/.test(prose)) return;
  // An unsupported standalone move next to a group must not be silently
  // dropped from the verification. English 'I' is a pronoun in prose.
  if (sequences.length && /(?<![A-Za-z0-9])[CGHJKNOPQTVWXYZ](?:2'?|')?(?![A-Za-z0-9])/.test(prose)) return;
  const add = (start: number, end: number) => {
    const alg = plainCubeAlg(unquoted.slice(start, end));
    if (alg) sequences.push({ alg, start, end });
  };
  let start = 0, end = 0;
  for (const token of unquoted.matchAll(/[A-Za-z0-9'_-]+/g)) {
    // A prose word such as "use" or "Use" is not a series of compact moves.
    // Recognized single turns such as Rw are still valid outside quotes.
    const wordLike = /^[A-Za-z][a-z]+$/.test(token[0]) && !supportedMove.test(token[0]);
    if (wordLike || !plainCubeAlg(token[0])) {
      if (end > start) add(start, end);
      end = start = token.index + token[0].length;
      continue;
    }
    if (end === start || unquoted.slice(end, token.index).trim()) {
      if (end > start) add(start, end);
      start = token.index;
    }
    end = token.index + token[0].length;
  }
  if (end > start) add(start, end);
  const ordered: SuppliedSequence[] = [];
  for (const span of sequences.sort((a,b)=>a.start-b.start)) {
    const previous = ordered.at(-1);
    const connector = previous && question.slice(previous.end,span.start).trim();
    // "U then F" is ordered notation; plain "U and F" can be two candidates.
    const adjacent = previous && connector === '' && !/[`"“「]/.test(question.slice(previous.start,span.end));
    if (previous && (adjacent || /^(?:(?:and )?then|followed by|后|接着|然后|再(?:转|做)?)$/i.test(connector ?? ''))
      && !suppliesSetup(question,previous)) {
      const alg = plainCubeAlg(previous.alg+' '+span.alg);
      if (!alg) return;
      ordered[ordered.length-1]={alg,start:previous.start,end:span.end};
    } else ordered.push(span);
  }
  return ordered;
}

function suppliesSetup(question: string, span: SuppliedSequence) {
  const before = question.slice(Math.max(0, span.start - 60), span.start);
  const after = question.slice(span.end, span.end + 64);
  return /(?:初始|起始|开始)(?:局面|状态)?(?:是|为)?[：:\s]*$|(?:打乱(?:是|为)?|摆成|从)[：:\s]*$|\b(?:setup|scramble|starting (?:state|position))\s*(?:(?:is|from|of|sequence)\s*)?[:：\s]*$/i.test(before)
    || /(?:已(?:经)?|刚(?:刚)?|先)(?:把(?:三阶|魔方)(?:魔方)?)?\s*(?:摆到|转到|转成|做完)\s*$/i.test(before)
    || (/\b(?:from|after)\s*$/i.test(before) && /\b(?:back to (?:the )?solved|solves?|return(?:s)? to (?:the )?solved|compare)\b/i.test(question))
    || /^\s*(?:作为(?:初始|起始|打乱)|开始|as (?:the |a )?(?:(?:shared|common) )?(?:3\s*[x×]\s*3 )?(?:setup|scramble|starting (?:setup|state|position))\b)/i.test(after);
}

function needsComparison(question: string) {
  return /(?:两|二|2)(?:套|条|组).{0,14}(?:转法|公式|序列)|(?:终态|(?:最终|最后)的?(?:状态|局面|结果)).{0,8}(?:一样|相同|不同|一致|相等)|等价|\b(?:equivalent|compare the two|compare both|(?:two|both) (?:algorithms|sequences))\b/i.test(question)
    && !/(?:与|和|跟|是否与)(?:原|出发|开始|起始|初始)?(?:朝向的)?(?:复原态|复原状态)|\b(?:as|to) (?:a |the )?solved (?:state|position)\b/i.test(question);
}

function suppliedMoveCall(question: string): VerifyCubeMovesCall | undefined {
  const otherSize = [...question.matchAll(/\b(\d{1,2})\s*[x×]\s*(\d{1,2})\b/gi)].some(match => match[1] !== '3' || match[2] !== '3');
  if (otherSize || /(?:[二四五六七八九十]|\b(?!3\s*阶)\d+)\s*阶|SQ-?1|Pyraminx|Skewb|Megaminx/i.test(question)) return;
  const supplied = suppliedSequences(question);
  if (!supplied) return;
  const setups = supplied.filter(span => suppliesSetup(question, span));
  if (setups.length > 1) return;
  const setup = setups[0]?.alg;
  const moves = supplied.filter(span => span !== setups[0]);
  if (moves.length < 1 || moves.length > 2 || (moves.length === 1 && needsComparison(question))) return;
  if (!setup && !/从复原|\bfrom (?:a |the )?solved\b/i.test(question)
    && /打乱为|摆成|从.{0,12}(?:打乱|当前|照片|局面)|\b(?:given scramble|current state|scrambled state|from the photo|(?:from|after) (?:the )?setup)\b/i.test(question)) return;
  return { tool: 'verify_cube_moves', setup, algorithm: moves[0].alg, comparison: moves[1]?.alg };
}

export function moveVerificationInputHelp(lang: 'en' | 'zh', question = ''): AssistantAnswer {
  if (/[([（［]\s*[URFDLBMESurfdlbmesxyz](?:w)?(?:2|['’′])?(?=[\s'’′2,:[\])）］])/u.test(question)) {
    return { answer: {
      zh: '请核对转法中的括号、重复次数和动作符号。每串展开后可验证 1–120 步。',
      en: 'Check the delimiters, repeat counts and moves. Each expanded sequence must contain 1–120 moves.',
    }[lang], sources: [] };
  }
  return {
    answer: {
      zh: '请用反引号分别标出要验证的三阶转法，例如 `R U R′ U′`。比较时请给出两套完整转法；如果起始局面不是复原态，也请给出摆出该局面的转法。支持基本转动、宽层、中层和转体。',
      en: 'Put each complete 3×3 sequence in backticks, for example `R U R′ U′`. For a comparison, provide both sequences. If you are starting from a scrambled state, include its setup sequence. Face, wide, slice, and whole-cube turns are supported.',
    }[lang],
    sources: [],
  };
}

export async function verifyAssistantCubeMoves(call: VerifyCubeMovesCall, question: string, lang: 'en' | 'zh', signal: AbortSignal): Promise<AssistantAnswer | undefined> {
  const supplied = suppliedMoveCall(question);
  if (!supplied) return;
  const provided = [supplied.algorithm, supplied.comparison].filter(Boolean).sort();
  const algorithm = plainCubeAlg(call.algorithm);
  const comparison = call.comparison && plainCubeAlg(call.comparison);
  if (!algorithm || (call.comparison && !comparison)
    || (call.setup ? plainCubeAlg(call.setup) : '') !== (supplied.setup ?? '')) return;
  const used = [algorithm, comparison].filter(Boolean).sort();
  if (provided.length !== used.length || provided.some((value, index) => value !== used[index])) return;
  return simulateCubeMoves(supplied, lang, signal, question);
}

export function verifySuppliedCubeMoves(question: string, lang: 'en' | 'zh', signal: AbortSignal) {
  const supplied = suppliedMoveCall(question);
  return supplied && simulateCubeMoves(supplied, lang, signal, question);
}

// Verified examples for open-ended explanations. Other user-specified operands
// still go through the planner; these counts describe only these two examples.
export async function notationExampleEvidence(question:string):Promise<string|undefined> {
  if (!/交换子|对易子|commutator/i.test(question) || !/共轭|conjugat/i.test(question)) return;
  const solved=(await getCube3()).defaultPattern();
  const examples=["R U R' U'","R U R'"].map(alg=>{
    const result=solved.applyAlg(alg);
    const counts=['CORNERS','EDGES'].map(orbit=>{
      const before=solved.patternData[orbit], after=result.patternData[orbit];
      return after.pieces.filter((piece,i)=>piece!==before.pieces[i] || after.orientation[i]!==before.orientation[i]).length;
    });
    return alg+' changes '+counts[0]+' corners and '+counts[1]+' edges';
  });
  return 'A commutator [A,B] expands to A B A^-1 B^-1. A conjugate [A:B] expands to A B A^-1. With A=R and B=U, the cube engine verifies: '+examples.join('; ')+'. Use these examples if compatible with the requested operands. Explain that a commutator measures failure to commute: it is the identity if A and B commute, otherwise its support depends on A and B and can be large. A conjugate relocates the action of B under the setup A. Never assert that either construction necessarily changes few pieces or is more localized. Only add piece counts when requested.';
}
function moveAction(alg: string, suffix: string, title: string, setup?: string) {
  return { id: 'cube-move-check:' + suffix, title,
    href: '/sim?' + new URLSearchParams({ puzzle: '3', anchor: 'start', ...(setup ? { setup } : {}), alg }).toString() };
}

const forEngine = (alg: string) => canonicalize3x3WideMoves(alg).replace(/\b[mse]/g, move => move.toUpperCase());

function requestedMoveMetrics(text:string) {
  return (['htm', 'qtm'] as const).filter(metric => metric === 'htm'
    ? /\bhtm\b|面转(?:计数|度量)?|half[- ]turn metric/i.test(text)
    : /\bqtm\b|四分之一转|quarter[- ]turn metric/i.test(text));
}

const movesOnly = /(?:只|仅)(?:要|给|写|列|输出|返回|显示)?(?:一行|逆动作|逆序|逆公式|动作序列)|(?:单行|一行)(?:返回|输出)|\b(?:only (?:output |give |return |print )?(?:the )?(?:inverse|moves|one line)|(?:one|single) line only|(?:on|in) (?:a |one |a single )line|moves only)\b/i;
const noLinks = /(?:不要|不用|别|无需)(?:附|带|给)?(?:上)?链接|(?:no|without) links?/i;
const noExplanation = /(?:不要|不用|别|无需)解释|(?:no|without) explanation/i;

// Only shortcut requests whose remaining vocabulary is covered by this renderer.
// Other compound questions go to the planner with the engine-checked inverse.
function supportedInverseWording(text:string) {
  const extra=text
    .replace(/三阶|魔方|求逆|逆序|逆公式|这串公式|这段转法|给我|逆操作|逆动作|逆算法|逆转法|倒放|原动作|原公式|原序列|第一步|最后一步|转多少度|多少度|转角|角度|哪个面|哪一面|哪面|面转计数|四分之一转计数|各有几步|步数|两个数都写出来|再告诉我|告诉我|只写一行|只给一行|一行|不要链接|不要解释|模拟器|播放|链接|另外|按|转的是|转的|转|把|只|请|给|和|的|是|再|并|也|都/g,'')
    .replace(/\b(?:3[x×]3|inverse|invert|undo|moves?|algorithm|sequence|how|do|i|can|you|please|me|this|the|of|on|in|a|an|one|single|line|only|no|without|explanation|give|show|both|and|htm|qtm|counts?|original|first|last|face|angle|degrees?|describe|what|which|turns?|its|is|does|s|links?|replay|simulator)\b/gi,'')
    .replace(/[\s\p{P}]/gu,'');
  return !extra;
}

function describeEndTurn(text:string, algorithm:string, inverse:string, lang:'zh'|'en') {
  const positions=[...text.matchAll(/第一步|最后一步|\b(?:first|last) (?:moves?|turns?)\b/gi)];
  if (!positions.length) return '';
  if (positions.length!==1) return;
  const inverseTurn=/(?:逆(?:序|动作|公式)|逆算法)(?:的)?(?:第一步|最后一步)|\b(?:inverse(?:'s)? (?:first|last)|(?:first|last) (?:move|turn) of the inverse)\b/i.test(text);
  const last=/最后|last/i.test(positions[0][0]);
  const move=tokenizeMoves(inverseTurn?inverse:algorithm).moves.at(last?-1:0);
  if (!move || move.kind!=='face') return;
  const faces:Record<string,[string,string]>={U:['上','upper'],D:['底','bottom'],F:['前','front'],B:['后','back'],L:['左','left'],R:['右','right']};
  const face=faces[move.family];
  const degrees=Math.abs(move.amount)*90;
  const direction=degrees===180?'':move.amount>0?(lang==='zh'?'顺时针':' clockwise'):(lang==='zh'?'逆时针':' counterclockwise');
  return lang==='zh'?(inverseTurn?'逆动作':'原动作')+(last?'最后一步':'第一步')+' '+move.raw+'，从'+face[0]+'面正视'+direction+'转 '+degrees+'°'
    :(inverseTurn?'Inverse':'Original')+(last?' last move ':' first move ')+move.raw+' turns the '+face[1]+' face '+degrees+'°'+direction+' as viewed from that face';
}

/** Undo one complete sequence. Never invert a fragment of malformed notation. */
export async function inverseMoveAnswer(question: string, lang: 'en'|'zh', signal: AbortSignal, history:AssistantMessage[]=[], onVerifiedRemainder?:(evidence:string)=>void): Promise<AssistantAnswer|undefined> {
  // Resolve a single explicit edit against the immediately preceding inverse request.
  const edit=/^(?:请)?把原动作的?(第一步|最后一步)(?:换|改)成\s*([URFDLB][2'′]?)\s*[，,。.]?\s*(?:其他条件保持不变|其余不变)?[。.!！]?$/i.exec(question.trim());
  if (edit && history.at(-1)?.role==='assistant') {
    const original=history.at(-2);
    if (original?.role!=='user' || !movesOnly.test(original.content)) return;
    const previous=suppliedSequences(original.content);
    if (previous?.length===1) {
      const span=previous[0], moves=span.alg.split(' ');
      moves[edit[1]==='第一步'?0:moves.length-1]=normalizePrimes(edit[2]);
      return inverseMoveAnswer(original.content.slice(0,span.start)+'`'+moves.join(' ')+'`'+original.content.slice(span.end),lang,signal,[],onVerifiedRemainder);
    }
  }
  if (!/求逆|逆序|逆(?:公式|操作|动作|算法|转法)|倒放|倒着(?:做|拧)|\b(?:invert|inverse|undo|play backwards)\b/i.test(question)) return;
  if (/(?:不要|不用|不需要|别).{0,4}(?:逆序|倒放|求逆)|\b(?:without|do not|don't) (?:undo|invert|reverse)\b/i.test(question)) return;
  const spans = suppliedSequences(question);
  const call = suppliedMoveCall(question);
  if (!call || call.setup || spans?.length !== 1) return;
  // Outside the accepted span, stray notation, group delimiters or an unknown
  // uppercase move can mean that tokenization recovered only part of the input.
  const rest = question.slice(0,spans[0].start)+' '+question.slice(spans[0].end);
  const requestedMetrics = requestedMoveMetrics(rest);
  const notationRest = rest.replace(/\b(?:HTM|QTM)\b/gi, '').replace(/(?<=\w)['’]s\b/g,'');
  if (/[\[\](){}\/'′’]|\b[A-Z][A-Z0-9']*\b|\b\d+[URFDLB]/.test(notationRest.replace(/\bI (?=undo|invert|reverse)/gi,''))) return;
  const algorithm = call.algorithm;
  const inverse = invertAlg(algorithm).replace(/2'/g, '2');
  const cube = await getCube3();
  signal.throwIfAborted();
  const solved = cube.defaultPattern();
  if (!inverse || !solved.applyAlg(forEngine(algorithm)).applyAlg(forEngine(inverse)).isIdentical(solved)) return;
  const detail=describeEndTurn(rest,algorithm,inverse,lang);
  if (detail===undefined || !supportedInverseWording(rest) || (!detail && /哪个面|多少度|角度|\b(?:angle|face|degrees?)\b/i.test(rest))) {
    onVerifiedRemainder?.('The cube engine verified the inverse of '+algorithm+' as '+inverse+'. Complete the remaining tasks in the requested format.');
    return;
  }
  const counts = requestedMetrics.map(metric => metric.toUpperCase() + ' ' + countMoves(algorithm, metric) + (lang === 'zh' ? ' 步' : ' moves')).join(', ');
  const compact = [inverse, counts, detail].filter(Boolean).join(' · ');
  if (movesOnly.test(question) && (noLinks.test(question) || !/链接|播放|模拟器|\b(?:links?|simulator|replay)\b/i.test(rest))) return {answer:compact,sources:[]};
  const actions = noLinks.test(question) ? [] : [
    moveAction(algorithm,'forward',{zh:'播放原动作',en:'Play original moves'}[lang]),
    moveAction(inverse,'inverse',{zh:'从原动作的终点倒放',en:'Play the inverse from the final position'}[lang],algorithm),
  ];
  const answer = { zh: '逆序是 `'+inverse+'`。从最后一步开始逐步撤销：顺、逆时针互换，半转仍是半转。已验证原动作接上逆序后回到起点。',
    en: 'The inverse is `'+inverse+'`. Undo the last move first, reverse each quarter turn and keep each half turn. Applying both sequences restores the starting position.' }[lang];
  return {answer:noExplanation.test(question)||movesOnly.test(question)?compact:[answer, counts, detail].filter(Boolean).join(' '),actions,sources:actions.map(a=>({...a,read:false}))};
}

async function simulateCubeMoves({ setup, algorithm, comparison }: VerifyCubeMovesCall, lang: 'en' | 'zh', signal: AbortSignal, question:string): Promise<AssistantAnswer> {
  const cube = await getCube3();
  signal.throwIfAborted();
  const solved = cube.defaultPattern();
  const start = setup ? solved.applyAlg(forEngine(setup)) : solved;
  const result = start.applyAlg(forEngine(algorithm));
  const matches = result.isIdentical(comparison ? start.applyAlg(forEngine(comparison)) : solved);
  const outcome = comparison
    ? matches ? { zh: '两套转法的最终状态相同。', en: 'Both sequences produce the same final state.' }
      : { zh: '两套转法的最终状态不同。', en: 'The two sequences produce different final states.' }
    : matches ? { zh: '这套转法能把魔方还原到原朝向。', en: 'This sequence solves the cube in its original orientation.' }
      : { zh: '这套转法的最终状态和原朝向的复原态不同。', en: 'The final state differs from the solved state in the original orientation.' };
  const basis = setup
    ? { zh: '已从你提供的起始局面验证，使用固定朝向。', en: 'Verified from your supplied setup with a fixed orientation.' }
    : { zh: '已从复原态验证，使用固定朝向。', en: 'Verified from a solved starting state with a fixed orientation.' };
  const rotationOnly = !setup && !comparison && !matches && algorithm.split(' ').every(move => /^[xyz]/.test(move));
  const orientation = rotationOnly ? { zh: '方块相对中心仍是复原的，变化的是整个魔方的朝向。', en: 'The pieces are still solved relative to the centers. The whole cube is facing a different orientation.' }[lang] : '';
  const actions = [moveAction(algorithm, 'first', { zh: '在模拟器查看转法', en: 'Open sequence in simulator' }[lang], setup)];
  if (comparison) actions.push(moveAction(comparison, 'second', { zh: '在模拟器查看对照转法', en: 'Open comparison in simulator' }[lang], setup));
  const details: string[] = [];
  if (/展开|\bexpand(?:ed)?\b/i.test(question)) {
    details.push((lang==='zh'?'第一串展开':'First expansion')+' `'+algorithm+'`');
    if (comparison) details.push((lang==='zh'?'第二串展开':'Second expansion')+' `'+comparison+'`');
  }
  const firstMention = /(?:第一|前)(?:串|套|条)|\bfirst (?:sequence|algorithm)\b/i.test(question);
  const secondMention = /(?:第二|后)(?:串|套|条)|\bsecond (?:sequence|algorithm)\b/i.test(question);
  let measured = [algorithm];
  if (comparison && (secondMention || !firstMention)) {
    measured = secondMention && !firstMention ? [comparison] : [algorithm, comparison];
  }
  for (const metric of requestedMoveMetrics(question)) {
    const counts = measured.map(value => countMoves(value,metric));
    details.push(metric.toUpperCase()+' '+counts.join(' / ')+(lang==='zh'?' 步':' moves'));
  }
  return { answer: [basis[lang], outcome[lang], orientation,...details].filter(Boolean).join(' '), sources: actions.map(action => ({ ...action, read: false })), actions };
}

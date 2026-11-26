import { ALG_CATALOG } from './alg_catalog';
import type { AssistantAnswer } from './site_assistant';

const header = /^(?:计时器复盘摘要|Timer replay summary)\r?\n/;
const stageHeader = /^(?:(CFOP|ROUX|ZZ|Petrus|LBL)\s*)?(?:阶段\s*\(计时器推断\)|stages \(inferred by timer\))$/i;
const stageLine = /^- ([\p{L}\p{N} /+×-]{1,30}?) (\d+\.\d{3}) (?:秒|s)(?:, (?:起手前 |识别 |time before execution |recognition )(\d+\.\d{3}) (?:秒|s))?(?:, (?:执行 |execution )(\d+\.\d{3}) (?:秒|s))?(?:, (\d+) (?:步|turns?) \(HTM\))?(?:, (?:回放截至 |playback through )(\d+\.\d{3}) (?:秒|s))?$/iu;
const unavailable = /^(?:没有可靠的分阶段用时。|Reliable stage timings are unavailable\.)$/;

export interface ReplayF2lCases {
  recorded?: { set: 'f2l' | 'adv-f2l' | 'oll' | 'pll' | 'zbll'; id: number };
  retest?: { set: 'f2l' | 'adv-f2l'; id: number };
}

export const wholeReplayPrompt = {
  zh: '请复盘整局，列出全部可用阶段的用时与步数，并指出最值得回看的阶段。',
  en: 'Review the whole solve, list every available stage time and turn count, and identify the stage worth reviewing first.',
};
const isWholePrompt = (request: string) => Object.values(wholeReplayPrompt).some(prompt => prompt.normalize('NFKC') === request.normalize('NFKC'));

export const assistantReplayPrompt = {
  zh: '请根据以上数据指出一个最值得回放的阶段、对应的回放时间和一项针对练习。如果有合适的站内训练入口，请查找并提供。缺数据时请说明能判断到哪里。',
  en: 'Based on the measurements above, identify one stage worth replaying, its playback time, and one focused drill. Find a relevant CubeRoot training page if available. Explain what the available data can establish.',
};

export function assistantSelectedReplay(question: string) {
  const match = header.exec(question.trimStart());
  if (!match) return;
  const [measurements, ...remainder] = question.trimStart().slice(match[0].length).split(/\r?\n\r?\n/);
  const [time, ...lines] = measurements.normalize('NFKC').split(/\r?\n/).map(line=>line.trim());
  const raw = /^(?:三阶原始用时|3×3 raw time) (\d+\.\d{3}) (?:秒|s)(?: \((\+2|DNF|DNS)\))?$/.exec(time);
  if (!raw || !remainder.length) return;
  const details = new Map<string, { slot?: string; start: string; first: string; last: string; user?: string; ref?: string; alg?: string; original?: string }>();
  for (const line of lines.filter(line => line.startsWith('@ '))) {
    const match = /^@ (Cross|F[1-4]|F2L|OLL|PLL|ZBLL|LL)(?: \[(FR|FL|BR|BL)\])? · (\d+\.\d{3}) s · #(\d+)–(\d+)(?: · HTM (\d+)\/(\d+)(?: · ([^|\r\n]{1,512}))?)?(?: \| ([URFDLB2' ]{1,1024}))?$/.exec(line);
    if (!match) return;
    const [, label, slot, start, first, last, user, ref, alg, original] = match;
    details.set(label, {slot, start, first, last, user, ref, alg, original});
  }
  const notes = lines.filter(line => line.startsWith('· ')).map(line => line.slice(2));
  const focus = /^> (Cross|F[1-4]|F2L|OLL|PLL|ZBLL|LL) \/ (stepMs|recognitionMs|executionMs|turns)$/.exec(lines.find(line => line.startsWith('> ')) ?? '');
  const cases: ReplayF2lCases = {};
  for (const line of lines.filter(line => line.startsWith('@case '))) {
    const item = /^@case (F[1-4]|OLL|PLL|ZBLL|LL) (recorded|retest) (f2l|adv-f2l|oll|pll|zbll)\/([1-9]\d{0,14})$/.exec(line);
    if (item && focus?.[1] === item[1]) {
      const [,label,role,set,id] = item;
      if (/^F[1-4]$/.test(label) && (set === 'f2l' || set === 'adv-f2l')) cases[role as keyof ReplayF2lCases] = { set, id: Number(id) };
      else if (role === 'recorded' && set === 'zbll' && (label === 'ZBLL' || label === 'LL')) cases.recorded = {set, id:Number(id)};
      else if (role === 'recorded' && (set === 'oll' || set === 'pll') && label === set.toUpperCase()) cases.recorded = {set, id: Number(id)};
    }
  }
  const stageLines = lines.filter(line => !/^(?:@case |[@·>] |逐段对照\(|Stage evidence \()/.test(line) && !/^STM \d+ · TPS \d+\.\d{2}$/.test(line));
  const [label, ...rows] = stageLines;
  const request = remainder.join('\n\n').trim();
  if (!rows.length && unavailable.test(label ?? '')) return { request, rawTime: raw[1], penalty: raw[2], notes, stages: [] };
  const method = stageHeader.exec(label ?? '');
  if (!method || !rows.length || rows.length > 16) return;
  const stages = rows.map(row => stageLine.exec(row));
  if (stages.some(stage => stage === null)) return;
  return { request, rawTime: raw[1], penalty: raw[2], notes, focus, cases, method: method[1]?.toUpperCase(), stages: stages.map(stage => ({
    label: stage![1], total: stage![2], recognition: stage![3], execution: stage![4], turns: stage![5], end: stage![6], detail: details.get(stage![1]),
  })) };
}

/** Only the timer's own complete prompt can finish in a fresh browser chat. */
export function defaultReplayAnswer(question:string,lang:'zh'|'en'):AssistantAnswer|undefined {
  const replay=assistantSelectedReplay(question);
  if(replay && (isWholePrompt(replay.request) || Object.values(assistantReplayPrompt).some(prompt=>prompt.normalize('NFKC')===replay.request.normalize('NFKC'))))
    return selectedReplayAnswer(replay,lang);
}

const drills: Record<string, { zh: string; en: string }> = {
  CROSS: { zh: '用同一打乱，先规划四条十字棱的落位顺序，再只做十字并核对落位。', en: 'Reuse the scramble, plan the four cross edges, then solve just the cross and check where they landed.' },
  F2L: { zh: '用同一打乱做到十字后停下，随后只做 F2L，逐对记录从发现配对到开始插入前的停顿。', en: 'Reuse the scramble, stop after cross, then practise just F2L and note the pause between spotting each pair and starting its insertion.' },
  'ZZ F2L': { zh: '用同一打乱回到 ZZ 的 F2L 起点，保留已完成的棱块定向，只练一组配对和插入并单独计时。', en: 'Reuse the scramble and stop at the start of ZZ F2L. Preserve edge orientation, then practise and time just one pair and insertion.' },
  OLL: { zh: '看到顶层图案后先说出所辨认的 OLL 情形，再揭开答案核对，识别正确后才执行对应公式。', en: 'Identify each OLL pattern aloud, reveal the answer to check, then execute the matching algorithm.' },
  PLL: { zh: '先根据侧面贴纸排列说出 PLL 情形，再揭开答案核对，认对后才执行对应公式。', en: 'Name the PLL case from its side stickers, reveal the answer to check, then execute the matching algorithm.' },
  FB: { zh: '用同一打乱，只练 Roux 第一块。先规划一对边角，再做完第一块并核对。', en: 'Reuse the scramble and practise only the Roux first block. Plan one pair, then build and check the first block.' },
  SB: { zh: '保留第一块，只练 Roux 第二块。先找并规划第二块的第一对，再连续做完第二块。', en: 'Keep the first block solved and drill only the Roux second block. Spot and plan its first pair, then finish the second block without pausing.' },
  CMLL: { zh: '保留两块，先口头识别顶层角块的 CMLL 情形，核对后再转。', en: 'Keep both blocks intact, name the CMLL corner case aloud, then check it before turning.' },
  LSE: { zh: '保留两块和角块，只练 Roux 最后六棱。先看棱块朝向，再做这一阶段并核对。', en: 'Keep the blocks and corners intact. Practise just the Roux last six edges by inspecting edge orientation before executing and checking the stage.' },
};

/** Arithmetic on the selected attempt needs no public-page citation. Restrict
 * the shortcut to the built-in drill request and explicit stage comparisons. */
export function selectedReplayAnswer(replay: NonNullable<ReturnType<typeof assistantSelectedReplay>>, lang: 'zh' | 'en'): AssistantAnswer | undefined {
  const { request, stages, rawTime, penalty, method } = replay;
  const notes = replay.notes.length ? '\n\n' + replay.notes.join('\n\n') : '';
  if (/\b(?:table|json|translate|compare (?:two|with)|official|source citations?)\b|表格|翻译|对比另|官方|按.*格式/i.test(request)) return;
  const asksStage = /阶段|回放|播放|哪段|哪一段|\b(?:stage|phase|split|replay|rewatch|seek)\b/i.test(request);
  const practiceNotes = replay.notes.filter(line => /^(?:个人基线|本局观察|值得长期练|训练复测|样本结论|Personal baseline|Single-solve observation|Recurring practice target|Practice retest|History finding)/i.test(line));
  const completedRetest = practiceNotes.some(line => /^(?:训练复测|Practice retest)/i.test(line));
  const customQuestion = !Object.values(assistantReplayPrompt).some(prompt => prompt.normalize('NFKC') === request.normalize('NFKC'));
  if (!customQuestion && completedRetest && !replay.focus) {
    const transfer = {zh:'专项用时单独比较。下一次用新的整局复盘，检查这个局面的起手前或执行用时是否也有变化。',
      en:'Compare the drill separately. In new full solves, check whether time before execution or execution time changes in this situation.'};
    return {answer: [...replay.notes, transfer[lang]].join('\n\n'), sources: []};
  }
  if (isWholePrompt(request) && stages.length) {
    const longest = stages.reduce((best, row) => Number(row.total) > Number(best.total) ? row : best);
    const rows = stages.map(row => `${row.label} · ${row.total} ${lang === 'zh' ? '秒' : 's'}${row.turns ? ' · '+row.turns+' HTM' : ''}`);
    const conclusion = {zh:`先回看 ${longest.label}，它是用时最长的可比阶段之一（${longest.total} 秒）。`,
      en:`Review ${longest.label} first. It is among the longest measured stages at ${longest.total} s.`};
    return {answer: [{zh:`整局原始用时 ${rawTime} 秒`,en:`Whole solve: ${rawTime} s`}[lang]+(penalty ? ' ('+penalty+')' : ''), ...rows, ...(replay.notes.some(note => /^(先回看|Review .+ first)/.test(note)) ? [] : [conclusion[lang]])].join('\n') + notes, sources: []};
  }
  if (customQuestion && practiceNotes.length && /长期|基线|练前|练后|复测|反复|baseline|recurring|retest|before and after/i.test(request)) {
    return { answer: replay.notes.join('\n\n'), sources: [] };
  }
  if (!asksStage) return;
  if (!stages.length) {
    if (!isWholePrompt(request) && !/缺|不足|哪|哪些|无法|\b(?:missing|insufficient|which|where|need|can you tell)\b/i.test(request)) return;
    return { answer: {
      zh: `这局${penalty === 'DNF' || penalty === 'DNS' ? `记录为 ${penalty}。` : `原始用时为 ${rawTime} 秒${penalty === '+2' ? '，另有 +2 罚时' : ''}。`}摘要没有可靠的分段用时，无法定位拖慢的阶段或给出回放时间点。请采集各阶段结束时间，或提供带时间戳的转动记录。`,
      en: `${penalty === 'DNF' || penalty === 'DNS' ? `The attempt is recorded as ${penalty}.` : `The raw time is ${rawTime} s${penalty === '+2' ? ' with a separate +2 penalty' : ''}.`} The summary has no reliable stage timings, so it cannot identify a slow stage or a replay seek point. Collect stage-end timestamps or a timestamped move log.`,
    }[lang] + notes, sources: [] };
  }
  const defaultRequest = Object.values(assistantReplayPrompt).some(prompt => prompt.normalize('NFKC') === request.normalize('NFKC'));
  const focus = defaultRequest ? replay.focus : null;
  const byRecognition = focus?.[2] === 'recognitionMs' || /识别(?:时间|耗时|最|阶段)|减少识别|\b(?:recognition (?:time|duration|took|was slowest)|(?:reduce|improve|focus on|longest|slowest|most)\s+(?:the\s+)?recognition)\b/i.test(request);
  const firstReview = /\b(?:which|what)\b[^.!?\n]{0,100}\b(?:stage|phase|split)\b[^.!?\n]{0,120}\b(?:rewatch|replay|review|focus on)\b[^.!?\n]{0,30}\bfirst\b/i.test(request);
  const asksRetest = /复测|再测|\b(?:retest|test again)\b/i.test(request)
    || Object.values(assistantReplayPrompt).some(prompt => prompt.normalize('NFKC') === request.normalize('NFKC'));
  if (!byRecognition && !firstReview && !(asksRetest && /最该练|最值得练|\bwhich (?:stage|phase) should i practi[cs]e\b/i.test(request))
    && !/最长|最慢|最值得回放|用时(?:最多|最高)|耗时(?:最多|最高)|\b(?:longest|slowest|one stage worth replaying|stage took the most time|(?:highest|most) (?:stage |phase )?time)\b/i.test(request)) return;
  const timed = byRecognition ? stages.filter(stage => stage.recognition !== undefined) : stages;
  if (!timed.length) return { answer: {
    zh: '摘要有各阶段总用时，但没有识别时间，无法按识别耗时选出阶段。需要逐阶段的识别和执行时间。',
    en: 'The summary has stage totals but no recognition timings. To pick a stage by recognition time, record recognition and execution times for each stage.',
  }[lang], sources: [] };
  const elapsed = (stage: typeof stages[number]) => byRecognition ? stage.recognition! : stage.total;
  const focused = focus && timed.find(stage => stage.label === focus[1]);
  const stage = focused || timed.reduce((a, b) => Number(elapsed(a)) >= Number(elapsed(b)) ? a : b);
  const tied = timed.filter(item => Number(elapsed(item)) === Number(elapsed(stage))).length > 1;
  let answer = {
    zh: `按所选记录，${stage.label} 的${byRecognition ? '识别' : '阶段'}用时为 ${elapsed(stage)} 秒，在有相应计时的阶段中${tied ? '并列最长' : '最长'}。${stage.end ? `回放截至 ${stage.end} 秒。` : '该阶段缺少结束时间，无法给出具体回放点。'}`,
    en: `In the selected attempt, ${stage.label} ${byRecognition ? 'recognition' : 'stage'} took ${elapsed(stage)} s, ${tied ? 'tied for the longest' : 'the longest'} among stages with that timing. ${stage.end ? `This stage ends at ${stage.end} s in playback.` : 'The stage has no recorded end timestamp to seek to.'}`,
  }[lang];
  if (focus && focused && stage.detail) {
    const { slot, start, first, last, user, ref, alg } = stage.detail;
    const label = stage.label + (slot ? ' · ' + slot : '');
    const metric = {stepMs: {zh:'阶段总用时', en:'stage time'}, recognitionMs:{zh:'起手前用时', en:'time before execution'},
      executionMs:{zh:'执行用时', en:'execution time'}, turns:{zh:'转动步数', en:'turn count'}}[focus[2]];
    answer = {
      zh: `本局 ${rawTime} 秒。按所选${metric?.zh}回看 ${label}，${start}–${stage.end} 秒（第 ${first}–${last} 个记录动作）。这一段共 ${stage.total} 秒、${stage.turns ?? '—'} HTM，起手前 ${stage.recognition ?? '—'} 秒，执行 ${stage.execution ?? '—'} 秒。`,
      en: `Solve time ${rawTime} s. Review ${label} for ${metric?.en}, ${start}–${stage.end} s (recorded moves ${first}–${last}). Stage time ${stage.total} s, ${stage.turns ?? '—'} HTM, time before execution ${stage.recognition ?? '—'} s, execution ${stage.execution ?? '—'} s.`,
    }[lang];
    if (user && ref) answer += '\n\n' + {zh:`从同一起点单独计步，原解 ${user} 步，参考 ${ref} 步。`, en:` Comparable recorded line: ${user} turns. Reference: ${ref} turns.`}[lang] + (alg ? { zh: `参考路线 ${alg}。`, en: ` Reference line: ${alg}.` }[lang] : '');
    if (slot && user && ref && +user <= +ref) answer += {zh:'原解可以保留。',en:' Keep the recorded line. This same-slot reference saves no turns.'}[lang];
    if (slot && user && stage.turns && user !== stage.turns) answer += {zh:'整局 HTM 会跨阶段合并同面动作，所以表内步数与独立片段有差异。',en:' The isolated line counts from the start of the pair. Whole-solve HTM merges same-face turns across stage boundaries.'}[lang];
    if (slot && byRecognition) {
      const peers = stages.filter(row => row.detail?.slot && row !== stage && row.recognition).map(row => ({zh:`${row.label} ${row.recognition} 秒`,en:`${row.label} ${row.recognition} s`})[lang]);
      if (peers.length) answer += '\n\n' + { zh: `其余各对起手前用时为 ${peers.join('、')}。`, en: `Time before execution for the other pairs: ${peers.join(', ')}.` }[lang];
    }
  }
  if (penalty === '+2') answer += { zh: ' +2 只加到最终成绩，阶段用时按原始记录计算。', en: ' The +2 penalty applies to the final result. Stage times use the raw measurements.' }[lang];
  else if (penalty === 'DNF') answer += { zh: ' 这局成绩仍记为 DNF。', en: ' The result remains DNF.' }[lang];
  if (!stage.recognition || !stage.execution) answer += {
    zh: ' 摘要缺少完整的识别与执行细分，无法据此定位具体停顿或动作。',
    en: ' The summary lacks a full recognition and execution split, so it cannot pinpoint a specific pause or turn.',
  }[lang];
  const isF2lPair = /^F[1-4]$/i.test(stage.label);
  const drill = (isF2lPair && byRecognition ? {
    zh: '回放上一段收尾，先指出下一对的角块和棱块，再完成配对和入槽。起手前用时可能包括顶层调整或转体。',
    en: 'Replay the end of the preceding stage, locate both pieces, then pair and insert. Time before execution can include U adjustments or rotations.',
  } : isF2lPair ? {
    zh: `用同一打乱重做到 ${stage.label} 开始前。先找完这组的边块和角块，再完成一次配对和插入，记录从找齐到开始插入的停顿。`,
    en: `Reuse the scramble and stop just before ${stage.label}. Find that pair's edge and corner, insert it once, and time the pause between locating both pieces and beginning the insertion.`,
  } : drills[method==='ZZ' && stage.label.toUpperCase()==='F2L' ? 'ZZ F2L' : stage.label.toUpperCase()]) ?? {
    zh: '重放到这段的开始，只练这一阶段。每次从相同局面开始，单独记录这一阶段用时。',
    en: 'Replay to the start of this stage and drill just that stage. Start from the same position each time and record its time separately.',
  };
  const pairDrill = isF2lPair && focused && focus?.[2] === 'turns' ? {
    zh: '从同一局面对照原解与同槽参考，分别练习配对和入槽，检查十字和已解槽。',
    en: 'Compare the recorded and same-slot lines from the same position. Drill pairing and insertion, checking the cross and completed slots.',
  } : null;
  answer += '\n\n' + (pairDrill ?? drill)[lang];
  if (asksRetest && !completedRetest) {
    const metric = focus?.[2] === 'turns' ? {zh:'独立片段 HTM 步数',en:'isolated HTM count'}
      : focus?.[2] === 'executionMs' ? {zh:'执行用时',en:'execution time'}
      : byRecognition ? { zh: '起手前用时', en: 'time before the first turn' } : { zh: '该阶段总用时', en: 'total time for this stage' };
    answer += '\n\n' + {
      zh: `练习前后各做 5 次，从同一局面开始，用相同计时方式。记下做对的次数，再比较正确样本的${metric.zh}中位数。`,
      en: `Run five attempts before and five after the drill, using the same starting position and timing method. Record the correct count and compare median ${metric.en} across correct attempts.`,
    }[lang];
  }
  if (focused && (['OLL','PLL','ZBLL','LL'].includes(stage.label)) && replay.cases?.recorded) {
    const item = replay.cases.recorded;
    return {answer: answer + notes, sources: [], actions: [{id:item.set==='zbll' ? `replay:practice:recorded:${item.id}` : `train:case:${item.set}:${item.id}`,
      title: {zh:`本局 ${stage.label} 公式训练`, en:`Practise this ${stage.label} case`}[lang],
      href: `/alg/3x3/${item.set}/run?cases=${item.id}&mode=train`}]};
  }
  if (focused && isF2lPair && replay.cases) {
    const pairIndex = Number(stage.label.slice(1)) - 1;
    const actions = (['recorded', 'retest'] as const).flatMap(kind => {
      const item = replay.cases[kind];
      if (!item || (kind === 'retest' && !completedRetest)) return [];
      const title = kind === 'recorded'
        ? { zh: `练本局第${['一','二','三','四'][pairIndex]}对`, en: `Practise pair ${pairIndex + 1} from this solve` }
        : { zh: '重练复测公式', en: 'Repeat the retest case' };
      return [{ id: `replay:practice:${kind}:${item.id}`, title: title[lang],
        href: `/alg/3x3/${item.set}/run?cases=${item.id}&mode=train` }];
    });
    if (actions.length) return { answer: answer + notes, sources: [], actions };
  }
  const slug = isF2lPair ? 'f2l' : stage.label.toLowerCase();
  const set = (asksRetest || /入口|链接|站内|\b(?:link|trainer|training page|practice page)\b/i.test(request)) && ALG_CATALOG['3x3'].find(item => item.slug === slug);
  const title = set && (focused && (isF2lPair || slug === 'oll' || slug === 'pll')
    ? {zh:`从 ${set.zh} 中自选公式`, en:`Choose a case from ${set.en}`}[lang]
    : `3x3 ${set[lang]} ${lang === 'zh' ? '训练' : 'practice'}`);
  const action = set && title ? { id: `train:3x3:${slug}`, title, href: `/alg/3x3/${slug}/select` } : undefined;
  return { answer: answer + notes, sources: action ? [{ ...action, read: false }] : [], actions: action ? [action] : [] };
}

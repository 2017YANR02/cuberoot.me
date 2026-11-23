import { ALG_CATALOG } from './alg_catalog';
import type { AssistantAnswer } from './site_assistant';

const header = /^(?:计时器复盘摘要|Timer replay summary)\r?\n/;
const stageHeader = /^(?:(CFOP|ROUX|ZZ|Petrus|LBL)\s*)?(?:阶段\s*\(计时器推断\)|stages \(inferred by timer\))$/i;
const stageLine = /^- ([\p{L}\p{N} /+×-]{1,30}?) (\d+\.\d{3}) (?:秒|s)(?:, (?:识别 |recognition )(\d+\.\d{3}) (?:秒|s))?(?:, (?:执行 |execution )(\d+\.\d{3}) (?:秒|s))?(?:, \d+ (?:步|turns?) \(HTM\))?(?:, (?:回放截至 |playback through )(\d+\.\d{3}) (?:秒|s))?$/iu;
const unavailable = /^(?:没有可靠的分阶段用时。|Reliable stage timings are unavailable\.)$/;

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
  const stageLines = lines.filter(line => !/^STM \d+ · TPS \d+\.\d{2}$/.test(line));
  const [label, ...rows] = stageLines;
  const request = remainder.join('\n\n').trim();
  if (!rows.length && unavailable.test(label ?? '')) return { request, rawTime: raw[1], penalty: raw[2], stages: [] };
  const method = stageHeader.exec(label ?? '');
  if (!method || !rows.length || rows.length > 16) return;
  const stages = rows.map(row => stageLine.exec(row));
  if (stages.some(stage => stage === null)) return;
  return { request, rawTime: raw[1], penalty: raw[2], method: method[1]?.toUpperCase(), stages: stages.map(stage => ({
    label: stage![1], total: stage![2], recognition: stage![3], execution: stage![4], end: stage![5],
  })) };
}

/** Only the timer's own complete prompt can finish in a fresh browser chat. */
export function defaultReplayAnswer(question:string,lang:'zh'|'en'):AssistantAnswer|undefined {
  const replay=assistantSelectedReplay(question);
  if(replay && Object.values(assistantReplayPrompt).some(prompt=>prompt.normalize('NFKC')===replay.request.normalize('NFKC')))
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
  if (/\b(?:table|json|translate|compare (?:two|with)|official|source citations?)\b|表格|翻译|对比另|官方|按.*格式/i.test(request)) return;
  const asksStage = /阶段|回放|播放|哪段|哪一段|\b(?:stage|phase|split|replay|rewatch|seek)\b/i.test(request);
  if (!asksStage) return;
  if (!stages.length) {
    if (!/缺|不足|哪|哪些|无法|\b(?:missing|insufficient|which|where|need|can you tell)\b/i.test(request)) return;
    return { answer: {
      zh: `这局${penalty === 'DNF' || penalty === 'DNS' ? `记录为 ${penalty}。` : `原始用时为 ${rawTime} 秒${penalty === '+2' ? '，另有 +2 罚时' : ''}。`}摘要没有可靠的分段用时，无法定位拖慢的阶段或给出回放时间点。请采集各阶段结束时间，或提供带时间戳的转动记录。`,
      en: `${penalty === 'DNF' || penalty === 'DNS' ? `The attempt is recorded as ${penalty}.` : `The raw time is ${rawTime} s${penalty === '+2' ? ' with a separate +2 penalty' : ''}.`} The summary has no reliable stage timings, so it cannot identify a slow stage or a replay seek point. Collect stage-end timestamps or a timestamped move log.`,
    }[lang], sources: [] };
  }
  const byRecognition = /识别(?:时间|耗时|最|阶段)|减少识别|\b(?:recognition (?:time|duration|took|was slowest)|(?:reduce|improve|focus on|longest|slowest|most)\s+(?:the\s+)?recognition)\b/i.test(request);
  const firstReview = /\b(?:which|what)\b[^.!?\n]{0,100}\b(?:stage|phase|split)\b[^.!?\n]{0,120}\b(?:rewatch|replay|review|focus on)\b[^.!?\n]{0,30}\bfirst\b/i.test(request);
  if (!byRecognition && !firstReview && !/最长|最慢|最值得回放|用时(?:最多|最高)|耗时(?:最多|最高)|\b(?:longest|slowest|one stage worth replaying|stage took the most time|(?:highest|most) (?:stage |phase )?time)\b/i.test(request)) return;
  const timed = byRecognition ? stages.filter(stage => stage.recognition !== undefined) : stages;
  if (!timed.length) return { answer: {
    zh: '摘要有各阶段总用时，但没有识别时间，无法按识别耗时选出阶段。需要逐阶段的识别和执行时间。',
    en: 'The summary has stage totals but no recognition timings. To pick a stage by recognition time, record recognition and execution times for each stage.',
  }[lang], sources: [] };
  const elapsed = (stage: typeof stages[number]) => byRecognition ? stage.recognition! : stage.total;
  const stage = timed.reduce((a, b) => Number(elapsed(a)) >= Number(elapsed(b)) ? a : b);
  const tied = timed.filter(item => Number(elapsed(item)) === Number(elapsed(stage))).length > 1;
  let answer = {
    zh: `按所选记录，${stage.label} 的${byRecognition ? '识别' : '阶段'}用时为 ${elapsed(stage)} 秒，在有相应计时的阶段中${tied ? '并列最长' : '最长'}。${stage.end ? `回放截至 ${stage.end} 秒。` : '该阶段缺少结束时间，无法给出具体回放点。'}`,
    en: `In the selected attempt, ${stage.label} ${byRecognition ? 'recognition' : 'stage'} took ${elapsed(stage)} s, ${tied ? 'tied for the longest' : 'the longest'} among stages with that timing. ${stage.end ? `This stage ends at ${stage.end} s in playback.` : 'The stage has no recorded end timestamp to seek to.'}`,
  }[lang];
  if (penalty === '+2') answer += { zh: ' +2 只加到最终成绩，阶段用时按原始记录计算。', en: ' The +2 penalty applies to the final result. Stage times use the raw measurements.' }[lang];
  else if (penalty === 'DNF') answer += { zh: ' 这局成绩仍记为 DNF。', en: ' The result remains DNF.' }[lang];
  if (!stage.recognition || !stage.execution) answer += {
    zh: ' 摘要缺少完整的识别与执行细分，无法据此定位具体停顿或动作。',
    en: ' The summary lacks a full recognition and execution split, so it cannot pinpoint a specific pause or turn.',
  }[lang];
  const isF2lPair = /^F[1-4]$/i.test(stage.label);
  const drill = (isF2lPair ? {
    zh: `用同一打乱重做到 ${stage.label} 开始前。先找完这组的边块和角块，再完成一次配对和插入，记录从找齐到开始插入的停顿。`,
    en: `Reuse the scramble and stop just before ${stage.label}. Find that pair's edge and corner, insert it once, and time the pause between locating both pieces and beginning the insertion.`,
  } : drills[method==='ZZ' && stage.label.toUpperCase()==='F2L' ? 'ZZ F2L' : stage.label.toUpperCase()]) ?? {
    zh: '重放到这段的开始，只练这一阶段。每次从相同局面开始，单独记录这一阶段用时。',
    en: 'Replay to the start of this stage and drill just that stage. Start from the same position each time and record its time separately.',
  };
  answer += '\n\n' + drill[lang];
  const slug = isF2lPair ? 'f2l' : stage.label.toLowerCase();
  const set = /入口|链接|站内|\b(?:link|trainer|training page|practice page)\b/i.test(request) && ALG_CATALOG['3x3'].find(item => item.slug === slug);
  const action = set ? { id: `train:3x3:${slug}`, title: `3x3 ${set[lang]} ${lang === 'zh' ? '训练' : 'practice'}`, href: `/alg/3x3/${slug}/select` } : undefined;
  return { answer, sources: action ? [{ ...action, read: false }] : [], actions: action ? [action] : [] };
}

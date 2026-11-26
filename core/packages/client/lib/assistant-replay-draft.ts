import { MIN_TRANSFER_SOLVES, transferReading, wholeSolveCoaching } from '@cuberoot/timer-ui/reconstruct/replay-coaching';
import type { ReconstructAssistantSummary } from '@cuberoot/timer-ui/reconstruct-report';
import { wholeReplayPrompt, assistantReplayPrompt, type ReplayF2lCases } from '@cuberoot/shared/site-assistant-replay';

type Localize = (text: { zh: string; en: string }) => string;

export function formatReplayAssistantDraft(summary: ReconstructAssistantSummary, t: Localize, cases?: ReplayF2lCases): string {
  const seconds = (ms: number) => (ms / 1000).toFixed(3);
  const time = (ms: number | null) => ms !== null && Number.isFinite(ms) && ms >= 0 ? seconds(ms) : null;
  const rows = summary.stages.flatMap(stage => {
    const total = time(stage.stepMs);
    if (total === null) return [];
    const recognition = time(stage.recognitionMs);
    const execution = time(stage.executionMs);
    const end = time(stage.cumulativeMs);
    return [
      '- ' + [
        t({ zh: `${stage.label} ${total} 秒`, en: `${stage.label} ${total} s` }),
        recognition === null ? null : t({ zh: `起手前 ${recognition} 秒`, en: `time before execution ${recognition} s` }),
        execution === null ? null : t({ zh: `执行 ${execution} 秒`, en: `execution ${execution} s` }),
        stage.turns === null ? null : t({ zh: `${stage.turns} 步 (HTM)`, en: `${stage.turns} turns (HTM)` }),
        end === null ? null : t({ zh: `回放截至 ${end} 秒`, en: `playback through ${end} s` }),
      ].filter(Boolean).join(', '),
    ];
  });
  const evidence = summary.stages.flatMap(stage => {
    if (!stage.range) return [];
    const {startMs, first, last} = stage.range;
    const ref = stage.refTurns != null && stage.refUserTurns != null
      ? ` · HTM ${stage.refUserTurns}/${stage.refTurns}` : '';
    const original = stage.slot && stage.original && stage.original.length <= 1024 && /^[URFDLB2' ]+$/.test(stage.original) ? ` | ${stage.original}` : '';
    return [`@ ${stage.label}${stage.slot ? ' [' + stage.slot + ']' : ''} · ${seconds(startMs)} s · #${first}–${last}${ref}${ref && stage.refSolution ? ' · ' + stage.refSolution : ''}${original}`];
  });
  const coach = summary.evidence?.wholeSolve && wholeSolveCoaching(summary.stages,summary.timeMs,summary.evidence.freePairs ?? 0,t);
  const stageNotes = summary.stages.flatMap(stage => [
    stage.zbll && t({zh:`${stage.label} 末层 · ${stage.zbll.caseName} · ${{executed:'实录吻合',combined:'一次完成，公式待确认',opportunity:'可选 ZBLL，本局分两段执行'}[stage.zbll.disposition]}`,
      en:`${stage.label} last layer · ${stage.zbll.caseName} · ${{executed:'recorded match',combined:'one stage, algorithm unconfirmed',opportunity:'optional ZBLL, solve used two stages'}[stage.zbll.disposition]}`}),
    stage.zbll?.sharedWith?.length && t({zh:'相同执行路线也见于',en:'Same execution also listed in'})+' '+stage.zbll.sharedWith.join('/'),
    stage.alternatives?.length && t({zh:`${stage.label} 其他空槽（单对 HTM）`,en:`${stage.label} other open slots (one-pair HTM)`})+' · '+stage.alternatives.map(a=>a.slot+' '+a.turns).join(', '),
    ...(stage.transfer ?? []).map(row => row.comparison ? [stage.label, row.name,
      t(row.role === 'recorded' ? {zh:'本局专项',en:'Recorded case'} : {zh:'复测公式',en:'Retest case'}),
      transferReading(row.comparison,t),
      ...(['before','after'] as const).map(period => {
        const value = row.comparison![period];
        const entry = time(value.recognitionMs) ?? '—', execution = time(value.executionMs) ?? '—';
        const label = t(period === 'before' ? {zh:'练前',en:'Before practice'} : {zh:'练后',en:'After practice'});
        return label + t({zh:`命中 ${value.count} 局，起手前中位数 ${entry} 秒，执行中位数 ${execution} 秒`,
          en:` · ${value.count} matching solves, median entry ${entry} s, median execution ${execution} s`})
          + (value.count < MIN_TRANSFER_SOLVES ? t({zh:'（样本不足）',en:' (limited sample)'}) : '');
      })].filter(Boolean).join(' · ') : t({zh:`练后整局 · ${row.name}（${row.role==='recorded'?'专项':'复测'}）· ${row.signal==='recognitionMs'?'起手前':'执行'} · ${row.count} 局`,
      en:`Full solves after practice · ${row.name} (${row.role}) · ${row.signal==='recognitionMs'?'before execution':'execution'} · ${row.count} solves`})
      +(row.medianMs!=null ? ' · '+t({zh:'中位数',en:'median'})+' '+seconds(row.medianMs)+' s' : '')
      +(row.opportunities!=null ? ' · '+t({zh:'出现机会',en:'opportunities'})+' '+row.opportunities : '')),
    ...(stage.transfer ?? []).flatMap(row=>row.previousRounds?.slice(-1).map(({comparison:c})=>
      row.name+' · '+t({zh:`上一轮练后命中 ${c.after.count} 局，起手前中位数 ${time(c.after.recognitionMs) ?? '—'} 秒，执行中位数 ${time(c.after.executionMs) ?? '—'} 秒`,
        en:`Previous round: ${c.after.count} matching solves, median entry ${time(c.after.recognitionMs) ?? '—'} s, median execution ${time(c.after.executionMs) ?? '—'} s`})
      +(Math.min(c.before.count,c.after.count)<MIN_TRANSFER_SOLVES?t({zh:'（样本不足）',en:' (limited sample)'}):'')) ?? []),
    ...(stage.transfer ?? []).flatMap(row=>(row.goals ?? []).map(g=>{
      const goal=t({zh:{recognition:'识别',execution:'执行',transition:'衔接',routes:'路线对比'}[g.goal],en:g.goal});
      const variant=g.variant==='case'?'':t(g.variant==='reference'?{zh:'参考解',en:'reference'}:{zh:'原解',en:'recorded'});
      const device=g.deviceExecutionMs!=null && g.longestGapMs!=null && t({zh:`设备有效 ${g.deviceCount} 次，首末转动中位数 ${seconds(g.deviceExecutionMs)} 秒，最长间隔中位数 ${seconds(g.longestGapMs)} 秒`,
        en:`${g.deviceCount} device samples, median turn span ${seconds(g.deviceExecutionMs)} s, median longest gap ${seconds(g.longestGapMs)} s`});
      return [row.name, goal, variant, device, t({zh:`正确 ${g.correct}/${g.attempts}，手动中位数 ${time(g.medianMs) ?? '—'} 秒`,en:`${g.correct}/${g.attempts} correct, manual median ${time(g.medianMs) ?? '—'} s`})].filter(Boolean).join(' · ');
    })),
    stage.fullRoute && t({zh:'整局路线已验证',en:'Verified full route'})+` · ${stage.fullRoute.originalTurns}/${stage.fullRoute.turns} HTM`,
    ...(stage.clips ?? []).filter(c=>c.kind==='pause').map(c=>t({zh:'停顿',en:'Gap'})+` · ${stage.label} #${c.first}–${c.last} · ${seconds(c.ms)} s`),
  ].filter((s):s is string=>typeof s==='string'));
  const total = seconds(summary.timeMs);
  const measurements = [
    t({ zh: '计时器复盘摘要', en: 'Timer replay summary' }),
    t({ zh: `三阶原始用时 ${total} 秒`, en: `3×3 raw time ${total} s` })
      + (summary.penalty === 'ok' ? '' : ` (${summary.penalty})`),
    summary.stm !== null && summary.tps !== null && Number.isFinite(summary.stm) && Number.isFinite(summary.tps)
      ? `STM ${summary.stm} · TPS ${summary.tps.toFixed(2)}` : '',
    rows.length
      ? t({ zh: `${summary.method ?? ''} 阶段（计时器推断）`, en: `${summary.method ?? ''} stages (inferred by timer)` })
      : t({ zh: '没有可靠的分阶段用时。', en: 'Reliable stage timings are unavailable.' }),
    ...rows,
    ...(evidence.length ? [t({zh: '逐段对照（起点 · 动作编号 · 可比原解/参考 HTM · 参考路线 | 原解）', en: 'Stage evidence (start · move numbers · recorded/reference HTM · reference line | recorded line)'})] : []),
    ...evidence,
    ...(['recorded', 'retest'] as const).flatMap(kind => {
      const item = cases?.[kind];
      return item && summary.focus ? [`@case ${summary.focus.label} ${kind} ${item.set}/${item.id}`] : [];
    }),
    ...[...(coach ? [coach.priority,coach.strength,coach.timing] : []),...stageNotes].filter(Boolean).map(line=>'· '+line),
    ...(summary.notes ?? []).flatMap(note => note.split('\n').filter(Boolean).map(line => '· ' + line)),
    summary.focus ? `> ${summary.focus.label} / ${summary.focus.goal}` : '',
  ].filter(Boolean).join('\n');
  return measurements + '\n\n' + t(summary.evidence?.wholeSolve ? wholeReplayPrompt : assistantReplayPrompt);
}

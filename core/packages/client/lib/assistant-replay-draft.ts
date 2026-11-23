import type { ReconstructAssistantSummary } from '@cuberoot/timer-ui/reconstruct-report';
import { assistantReplayPrompt } from '@cuberoot/shared/site-assistant-replay';

type Localize = (text: { zh: string; en: string }) => string;

export function formatReplayAssistantDraft(summary: ReconstructAssistantSummary, t: Localize): string {
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
        recognition === null ? null : t({ zh: `识别 ${recognition} 秒`, en: `recognition ${recognition} s` }),
        execution === null ? null : t({ zh: `执行 ${execution} 秒`, en: `execution ${execution} s` }),
        stage.turns === null ? null : t({ zh: `${stage.turns} 步 (HTM)`, en: `${stage.turns} turns (HTM)` }),
        end === null ? null : t({ zh: `回放截至 ${end} 秒`, en: `playback through ${end} s` }),
      ].filter(Boolean).join(', '),
    ];
  });
  const total = seconds(summary.timeMs);
  const measurements = [
    t({ zh: '计时器复盘摘要', en: 'Timer replay summary' }),
    t({ zh: `三阶原始用时 ${total} 秒`, en: `3×3 raw time ${total} s` })
      + (summary.penalty === 'ok' ? '' : ` (${summary.penalty})`),
    Number.isFinite(summary.stm) && Number.isFinite(summary.tps)
      ? `STM ${summary.stm} · TPS ${summary.tps.toFixed(2)}` : '',
    rows.length
      ? t({ zh: `${summary.method ?? ''} 阶段（计时器推断）`, en: `${summary.method ?? ''} stages (inferred by timer)` })
      : t({ zh: '没有可靠的分阶段用时。', en: 'Reliable stage timings are unavailable.' }),
    ...rows,
  ].filter(Boolean).join('\n');
  return measurements + '\n\n' + t(assistantReplayPrompt);
}

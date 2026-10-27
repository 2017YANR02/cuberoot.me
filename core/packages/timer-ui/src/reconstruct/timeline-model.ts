import type { ReconTextLine } from '@cuberoot/shared/timer/reconstruct/recon-text';
import type { SolveMove } from '@cuberoot/shared/timer/reconstruct/stage-segments';
import { METHODS } from '@cuberoot/shared/timer/reconstruct/methods';
import type { ReconstructionType } from '@cuberoot/shared/timer/reconstruct/recon-text';
type StageKey = 'cross' | 'f2l' | 'oll' | 'pll';

interface StageSpan {
  key: string;
  color: StageKey;
  label: string;
  fromMs: number;
  toMs: number;
  ms: number;
}

/** 轨道上的一段:一步的「在看」或「在拧」。 */
interface Seg {
  key: string;
  stage: string;
  color: StageKey;
  /** 同阶段里的第几段,用来给四对 F2L 分深浅。 */
  shade: number;
  pause: boolean;
  fromMs: number;
  toMs: number;
  moves: string;
  label: string;
}

export function timelineExecutionAt(segs: readonly Seg[], at: number) {
  return segs.find(segment => !segment.pause && at >= segment.fromMs && at < segment.toMs);
}

export function timelineTooltipOffset(left: number, right: number, viewportWidth: number) {
  return right > viewportWidth - 8 ? viewportWidth - 8 - right : left < 8 ? 8 - left : 0;
}

const stageOfLine = (kind: ReconTextLine['kind']): StageKey => (
  kind === 'inspection' || kind === 'cross' ? 'cross' : kind === 'f2l' ? 'f2l' : kind === 'training' ? 'pll' : kind
);


export function reconstructionTimeline(lines: ReconTextLine[], moves: SolveMove[], method: ReconstructionType, tr: (text: {zh:string;en:string}) => string) {
  const segs = (() => {
    const out: Seg[] = [];
    const seen: Record<string, number> = {};
    for (const line of lines) {
      const color = stageOfLine(line.kind);
      const stage = line.stageKey ?? (method === 'cfop' ? color : line.key === 'tail' && method !== 'training' ? METHODS[method].stages.at(-1)!.key : line.key);
      const shade = seen[stage] ?? 0;
      seen[stage] = shade + 1;
      // 一步从「上一手落下」算起,所以起点是 fromIdx-1 那一手的时刻(第一步从 0 起)。
      const fromMs = line.fromMs ?? (line.fromIdx > 0 ? (moves[line.fromIdx - 1]?.ts ?? 0) : 0);
      const toMs = line.toMs ?? moves[line.toIdx]?.ts ?? fromMs;
      // 识别时间是分步分析表算好的,可能因为四舍五入比这一步还长 —— 钳住,
      // 否则执行段会算出负宽度盖到下一步头上。
      const recog = Math.max(0, Math.min(line.recognitionMs ?? 0, toMs - fromMs));
      const details = { moves: line.moves.join(' '), label: line.label ?? stage };
      if (recog > 0) {
        out.push({ key: `${line.key}-p`, stage, color, shade, pause: true, fromMs, toMs: fromMs + recog, ...details });
      }
      out.push({ key: line.key, stage, color, shade, pause: method === 'training' && line.kind === 'inspection', fromMs: fromMs + recog, toMs, ...details });
    }
    return out;
  })();

  const stages = (() => {
    const label: Record<StageKey, string> = {
      cross: tr({ zh: '十字', en: 'CROSS' }), f2l: 'F2L', oll: 'OLL', pll: 'PLL',
    };
    const out: StageSpan[] = [];
    for (const line of lines) {
      const color = stageOfLine(line.kind);
      const key = line.stageKey ?? (method === 'cfop' ? color : line.key === 'tail' && method !== 'training' ? METHODS[method].stages.at(-1)!.key : line.key);
      const definition = method === 'training' ? undefined : METHODS[method].stages.find(stage => stage.key === key);
      const fromMs = line.fromMs ?? (line.fromIdx > 0 ? (moves[line.fromIdx - 1]?.ts ?? 0) : 0);
      const toMs = line.toMs ?? moves[line.toIdx]?.ts ?? fromMs;
      const last = out[out.length - 1];
      if (last && last.key === key) { last.toMs = toMs; last.ms += toMs - fromMs; }
      else out.push({ key, color, label: method === 'cfop' ? label[color] : definition ? tr(definition) : line.label ?? key, fromMs, toMs, ms: toMs - fromMs });
    }
    return out;
  })();

return {segs, stages:stages.map(stage=>({...stage,timeText:(stage.ms/1000).toFixed(2)}))};
}

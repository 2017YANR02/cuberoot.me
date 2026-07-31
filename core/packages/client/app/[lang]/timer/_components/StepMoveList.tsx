'use client';

/**
 * StepMoveList — 这把是怎么拧的,按步分组写出来。
 *
 *     CROSS [1.73]                                     ⧉
 *       U R' F R' B2 L                    // Y cross
 *     F2L [11.35]
 *       第 1 对   最优
 *       U F2 R' F2 U2 R                   // BR
 *       ...
 *     OLL [2.01]   最优
 *       U2 F U R U' R' F'                 // OLL-F-
 *     PLL [3.33]
 *       U' F2 U' F2 D R2 B2 U B2 D' R2 U  // PLL-T
 *
 * 三样东西在这一块里第一次凑齐:**动作**(以前要点开表头才看得到一列)、
 * **标注**(以前只有 /recon 有)、**徽章**(以前只在表里那一行)。它们本来就是
 * 在回答同一个问题 —— 「这一步我拧了什么、拧得好不好」—— 拆在三个地方看的人得
 * 自己拼。
 *
 * 标注和动作都不是这里算的:动作来自 `recon_text.ts` 的行(切点和分步分析表同一把
 * 刀),标注来自 /recon 的识别器。这个文件只负责摆。
 *
 * 回放接上之后,这里同时是**进度显示**:正在播的那一步高亮,还没播到的压暗,
 * 点某一步的标题跳到那一步开头。
 */

import { Copy, Check } from 'lucide-react';
import { useState } from 'react';

import { tr } from '@/i18n/tr';

import type { ReconTextResult, ReconTextLine } from '../_lib/reconstruct/recon_text';
import { reconTextForClipboard } from '../_lib/reconstruct/recon_text';
import { gradeForDelta } from '../_lib/reconstruct/reference';
import type { ReferenceResult, SlotReference, StepGrade } from '../_lib/reconstruct/reference';

export interface StepMoveListProps {
  recon: ReconTextResult | null;
  /** 每阶段参考步数(十字 / OLL / PLL 的徽章从这里来)。 */
  reference: ReferenceResult | null;
  /** 每对参考步数(四个槽的徽章从这里来)。 */
  slotReference: SlotReference[] | null;
  /** 回放游标 = 已经播了几手。省略则不做高亮。 */
  currentIdx?: number | null;
  /** 点某一步跳到它开头。省略则标题不是按钮。 */
  onSeek?: (idx: number) => void;
  /** 「复盘对不对」那一行。省略则不显示。 */
  feedback?: React.ReactNode;
}

/** 分组:十字 / F2L(可能好几行)/ OLL / PLL。空组不出现。 */
interface Group {
  key: string;
  label: string;
  lines: ReconTextLine[];
}

function groupLines(lines: ReconTextLine[]): Group[] {
  const out: Group[] = [];
  for (const line of lines) {
    const key = line.kind === 'f2l' ? 'f2l' : line.kind;
    const label = key === 'cross' ? tr({ zh: '十字', en: 'CROSS' }) : key.toUpperCase();
    const last = out[out.length - 1];
    if (last && last.key === key) last.lines.push(line);
    else out.push({ key, label, lines: [line] });
  }
  return out;
}

function gradeLabel(g: StepGrade): string {
  return g === 'brilliant'
    ? tr({ zh: '妙手', en: 'Brilliant' })
    : tr({ zh: '最优', en: 'Optimal' });
}

const sec = (ms: number | null): string => (ms === null ? '–' : (ms / 1000).toFixed(2));

/** 一组的用时 = 组内各行本步用时之和(和表里「本步」那一行同一口径)。 */
function groupMs(g: Group): number | null {
  let sum = 0;
  let any = false;
  for (const l of g.lines) {
    if (l.stepMs !== null) { sum += l.stepMs; any = true; }
  }
  return any ? sum : null;
}

export default function StepMoveList({
  recon, reference, slotReference, currentIdx, onSeek, feedback,
}: StepMoveListProps) {
  const [copied, setCopied] = useState(false);

  if (!recon || recon.lines.length === 0) return null;
  const groups = groupLines(recon.lines);

  /** 这一行的徽章。槽走 slotReference,其余走 stages。 */
  const gradeFor = (line: ReconTextLine): StepGrade | null => {
    if (line.key.startsWith('slot-')) {
      const slot = line.key.slice(5);
      const sr = slotReference?.find(s => s.slot === slot) ?? null;
      return sr ? gradeForDelta(sr.delta) : null;
    }
    const st = reference?.stages.find(s => s.step === line.key) ?? null;
    return st && !st.note ? gradeForDelta(st.delta) : null;
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(reconTextForClipboard(recon));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.warn('[step-move-list] copy failed:', err);
    }
  };

  // 已播完 / 正在播 / 还没播到。currentIdx 是「已经播了几手」,所以正在播的那一步
  // 是 fromIdx < idx <= toIdx+1 的那个。
  //
  // idx = 0 是**还没开始播**,不是「停在第 0 手」—— 那时候把整张单子压暗等于告诉
  // 用户「这些都还没发生」,而他打开报告就是来读这些已经发生过的事的。所以
  // 未开播时一律不标,一按播放才开始分明暗。
  const stateOf = (line: ReconTextLine): 'done' | 'now' | 'future' | null => {
    if (!currentIdx) return null;
    if (currentIdx > line.toIdx + 1) return 'done';
    if (currentIdx > line.fromIdx) return 'now';
    return 'future';
  };

  return (
    <div className="sml">
      <div className="sml-head">
        <button
          type="button"
          className="sml-copy"
          onClick={handleCopy}
          title={tr({ zh: '复制成 /recon 的格式', en: 'Copy in /recon format' })}
          aria-label={tr({ zh: '复制成 /recon 的格式', en: 'Copy in /recon format' })}
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
        </button>
      </div>

      {groups.map(g => {
        const ms = groupMs(g);
        // 十字 / OLL / PLL 只有一行,徽章跟着组标题走 —— 「第 1 对」那种小标题
        // 只有 F2L 才有,不该为了摆徽章给它们也造一个。
        const soloGrade = g.lines.length === 1 && g.key !== 'f2l' ? gradeFor(g.lines[0]) : null;
        return (
          <section key={g.key} className="sml-group">
            <h4 className="sml-group-head">
              <span className="sml-group-name" data-stage={g.key}>{g.label}</span>
              {ms !== null && <span className="sml-group-ms">[{sec(ms)}]</span>}
              {soloGrade && <span className={`sa-grade ${soloGrade}`}>{gradeLabel(soloGrade)}</span>}
            </h4>
            {g.lines.map((line, i) => {
              const grade = g.key === 'f2l' ? gradeFor(line) : null;
              const st = stateOf(line);
              return (
                <div key={line.key} className="sml-line" data-state={st ?? undefined}>
                  {g.key === 'f2l' && (
                    <div className="sml-sub">
                      <span className="sml-sub-name">
                        {tr({ zh: `第 ${i + 1} 对`, en: `Slot ${i + 1}` })}
                      </span>
                      {grade && <span className={`sa-grade ${grade}`}>{gradeLabel(grade)}</span>}
                    </div>
                  )}
                  <div className="sml-body">
                    {onSeek ? (
                      <button
                        type="button"
                        className="sml-moves is-seek"
                        onClick={() => onSeek(line.fromIdx)}
                        title={tr({ zh: '跳到这一步开头', en: 'Jump to the start of this step' })}
                      >
                        {line.moves.join(' ')}
                      </button>
                    ) : (
                      <span className="sml-moves">{line.moves.join(' ')}</span>
                    )}
                    {line.label && <span className="sml-label">// {line.label}</span>}
                  </div>
                </div>
              );
            })}
          </section>
        );
      })}

      {feedback}
    </div>
  );
}

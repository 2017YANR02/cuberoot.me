'use client';

/**
 * StepMoveList — 这把是怎么拧的,按步分组写出来。
 *
 *     打乱                                              ⧉
 *       R D B' D2 U2 B R2 F2 D2 B' U2 B'
 *
 *       U R' F R' B2 L                    // Y cross
 *
 *       第 1 组  最优  U F2 R' F2 U2 R     // BR
 *       ...
 *       最优  U2 F U R U' R' F'           // OLL-F-
 *
 *       U' F2 U' F2 D R2 B2 U B2 D' R2 U  // PLL-T
 *
 * 阶段名和阶段用时(「十字 [4.02]」)**不在这里**(2026-08-04 用户提的):同一屏左边
 * 那根带游标的轴已经把四段的名字和用时画出来了,这里再写一遍是同一件事说两次。分组
 * 本身留着 —— 组与组之间的空白就是它,而每一行右边的标注(`// Y cross`、`第 1 组`、
 * `// OLL-F-`)本来就说得出自己是谁。
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

import CubeColorChip, {
  crossColorFromLabels,
  f2lDisplayColors,
  leadingCubeColors,
} from '@/components/CubeColorChip/CubeColorChip';
import { tr } from '@/i18n/tr';

import type { ReconTextResult, ReconTextLine } from '../_lib/reconstruct/recon_text';
import { reconTextForClipboard } from '../_lib/reconstruct/recon_text';
import { gradeForDelta } from '../_lib/reconstruct/reference';
import type { ReferenceResult, SlotReference } from '../_lib/reconstruct/reference';

export interface StepMoveListProps {
  recon: ReconTextResult | null;
  /** 每阶段参考步数(十字 / OLL / PLL 的徽章从这里来)。 */
  reference: ReferenceResult | null;
  /** 每组参考步数(四个槽的徽章从这里来)。 */
  slotReference: SlotReference[] | null;
  /** 回放游标 = 已经播了几手。省略则不做高亮。 */
  currentIdx?: number | null;
  /** 点某一步跳到它开头。省略则标题不是按钮。 */
  onSeek?: (idx: number) => void;
  /** 谱子底下的一句提醒(如「这把没录姿态」)。省略则不显示。 */
  notice?: React.ReactNode;
  /** 「复盘对不对」那一行。省略则不显示。 */
  feedback?: React.ReactNode;
}

/** 分组:十字 / F2L(可能好几行)/ OLL / PLL。空组不出现。组不再有标题,它只剩
 *  两个作用:组间的那道空白,以及「F2L 才编第 n 组」这条判断。 */
interface Group {
  key: string;
  lines: ReconTextLine[];
}

function groupLines(lines: ReconTextLine[]): Group[] {
  const out: Group[] = [];
  for (const line of lines) {
    const key = line.kind === 'f2l' ? 'f2l' : line.kind;
    const last = out[out.length - 1];
    if (last && last.key === key) last.lines.push(line);
    else out.push({ key, lines: [line] });
  }
  return out;
}

function gradeLabel(): string {
  return tr({ zh: '最优', en: 'Optimal' });
}

export default function StepMoveList({
  recon, reference, slotReference, currentIdx, onSeek, notice, feedback,
}: StepMoveListProps) {
  const [copied, setCopied] = useState(false);

  if (!recon || recon.lines.length === 0) return null;
  const groups = groupLines(recon.lines);
  const crossColor = crossColorFromLabels(recon.lines.map(line => line.label));

  /** 这一行的徽章。槽走 slotReference,其余走 stages。 */
  const gradeFor = (line: ReconTextLine): 'optimal' | null => {
    if (line.key.startsWith('slot-')) {
      const slot = line.key.slice(5);
      const sr = slotReference?.find(s => s.slot === slot) ?? null;
      return sr && gradeForDelta(sr.delta) === 'optimal' ? 'optimal' : null;
    }
    const st = reference?.stages.find(s => s.step === line.key) ?? null;
    return st && !st.note && gradeForDelta(st.delta) === 'optimal' ? 'optimal' : null;
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

      {/* 打乱先摆在最上面 —— 这一块要成为一份**照着能复现**的东西:从这个局面
          开始,往下每一步是怎么拧的。以前它孤零零挂在整页最底下(还配一张打乱图),
          读谱子的人得先滚到底再滚回来。
          `recon.scramble` 就是**这把真正的打乱**,和成绩里那条逐字相同。谱子确实
          写在「十字朝下」那个视角里(见 orient.ts),但接法不是改写打乱 —— 是把
          观察那一手(`recon.inspection`,`z2` 之类)当成谱子的第一行印出来,和人
          写复盘一模一样。2026-08-04 用户报的就是这个:印出来的打乱不是他做的那条,
          「这不行,必须是原始打乱」。复制按钮导出的是同一份。 */}
      {recon.scramble.trim() !== '' && (
        <section className="sml-group sml-scramble">
          <h4 className="sml-group-head">
            <span className="sml-group-name">{tr({ zh: '打乱', en: 'SCRAMBLE' })}</span>
          </h4>
          <div className="sml-line">
            <div className="sml-body">
              <span className="sml-moves">{recon.scramble}</span>
            </div>
          </div>
        </section>
      )}

      {/* 观察那一手。它不是注释,是谱子的第一行:少了它,上面那条原始打乱配下面
          这些动作对不上。 */}
      {recon.inspection.trim() !== '' && (
        <section className="sml-group">
          <div className="sml-line">
            <div className="sml-body">
              <span className="sml-moves">{recon.inspection}</span>
              <span className="sml-label">{'// '}{tr({ zh: '观察', en: 'inspection' })}</span>
            </div>
          </div>
        </section>
      )}

      {groups.map(g => (
          <section key={g.key} className="sml-group">
            {g.lines.map((line, i) => {
              // 徽章:F2L 一组一个。十字 / OLL / PLL 的以前挂在组标题上,标题去掉
              // 之后跟着它那一行走 —— 但只在这一组确实只有一行时,PLL 后面那条
              // 收尾行(recon_text 的 `tail`)没有参考,标了也是空的。
              const grade = g.key === 'f2l' || g.lines.length === 1 ? gradeFor(line) : null;
              const st = stateOf(line);
              return (
                <div key={line.key} className="sml-line" data-state={st ?? undefined}>
                  {/* 「第 n 对」和它的徽章跟动作同一行 —— 一对 F2L 是一件事,
                      拆两行读起来是两件,四对就白占四行。窄屏由 flex-wrap 兜。 */}
                  <div className="sml-body">
                    {g.key === 'f2l' && (
                      <span className="sml-sub-name">
                        {tr({ zh: `第 ${i + 1} 组`, en: `Slot ${i + 1}` })}
                      </span>
                    )}
                    {grade && <span className={`sa-grade ${grade}`}>{gradeLabel()}</span>}
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
                    {line.label && (() => {
                      const colors = leadingCubeColors(line.label);
                      const visibleLabel = colors
                        ? line.label.slice(colors.length).replace(/^\/?/, '').trimStart()
                        : line.label;
                      return (
                        <span className="sml-label">
                          {'// '}
                          {colors && <CubeColorChip colors={f2lDisplayColors(colors, crossColor)} className="sml-label-chip" />}
                          {visibleLabel}
                        </span>
                      );
                    })()}
                  </div>
                </div>
              );
            })}
          </section>
      ))}

      {notice}
      {feedback}
    </div>
  );
}

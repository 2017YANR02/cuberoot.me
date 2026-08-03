/**
 * ReconstructReport — the post-solve report itself, without a dialog around it.
 *
 * Split out of ReconstructModal (2026-08-02) because the report stopped being a
 * second screen: 成绩详情 now renders it inline, so «查看复盘» is no longer a
 * click you have to know about. Two callers, one report:
 *
 *   SolveModal          — inline, under the solve's own header and actions.
 *   ReconstructModal    — a dialog with nothing in it but this, for the places
 *                         that have no solve to attach to (?replay= deep links)
 *                         or no timer around them (1v1 history).
 *
 * 顺序:**先这把是怎么拧的,再这把拧得怎么样**(2026-08-03 用户提的)。
 *
 *   摘要 — 时间 / TPS / 步数 / 流畅,加上读完之后想做的那几件事。
 *   回放 + 谱子 — 三维回放和按步写出来的动作(打乱就是谱子的第一行)。默认展开:
 *     它是报告的主体。上面压着折叠起来的「参考解法」。
 *   数据 — 质量分、时间轴、分步分析表、四个总量。排在后面不是因为不重要,而是
 *     因为它们都在**归因**:不知道自己拧了什么的时候,一张 5×7 的表读不出东西。
 *   原始动作序列 — 折叠,收尾。
 *
 * 分区块而不是分标签页(研究文档原本画的是 tab):tab 把内容藏在一次点击**加**一次
 * 选择后面,而这几块常常要对着看。
 *
 * The reference lines and the score need an IDA* search (~80-110ms cold on a
 * desktop, more on a phone), so they are computed AFTER the modal paints and
 * the quality row holds its place with dashes meanwhile — opening the report
 * stays instant.
 *
 * BLD solves keep their own shape: memo/execution split, letter pairs, and no
 * CFOP staging (the walker models a 3x3 speedsolve).
 */

'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Link2, ChevronDown, ChevronRight, ThumbsUp, ThumbsDown, Info } from 'lucide-react';
import type { Solve, EventId } from '../_lib/types';
import { effectiveMs } from '../_lib/types';
import { formatMs } from '../_lib/stats';
import { sliceReconstruction, detectMemoPause } from '../_lib/reconstruct/slice';
import { computeStageAverages, computeStageSegments } from '../_lib/reconstruct/stage_segments';
import { computeStepMetrics } from '../_lib/reconstruct/step_metrics';
import type { StepMetricsResult } from '../_lib/reconstruct/step_metrics';
import { detectWastedWork } from '../_lib/reconstruct/error_detect';
import { computeF2lSlotReferences, computeStageReferences } from '../_lib/reconstruct/reference';
import type { ReferenceResult, SlotReference, StageReference } from '../_lib/reconstruct/reference';
import { computeSolveQuality } from '../_lib/reconstruct/quality';
import type { SolveQuality } from '../_lib/reconstruct/quality';
import { computeF2lSlots } from '../_lib/reconstruct/f2l_slots';
import { walkMethod } from '../_lib/reconstruct/method_walk';
import type { MethodId } from '../_lib/reconstruct/methods';
import { decodeGyroTrack } from '../_lib/bluetooth/gyro_track';
import { detectRotations } from '../_lib/reconstruct/rotation_detect';
import { buildReconText } from '../_lib/reconstruct/recon_text';
import { normalizeSolve } from '../_lib/reconstruct/orient';
import type { ReconTextResult } from '../_lib/reconstruct/recon_text';
import StepAnalysis from './StepAnalysis';
import StepMoveList from './StepMoveList';
import { encodeReplayUrl } from '../_lib/share/encode';
import { nxnSizeForEvent } from '../_lib/cube';
import { toReconEventId } from '../_shared/event-bridge';
import { buildExternalLinks } from '@/lib/recon-utils';
import { memoize3bld } from '../_lib/solver/bld_helper';
import PlaybackPanel from './PlaybackPanel';
import './reconstruct.css';
import { tr } from '@/i18n/tr';

export interface ReconstructReportProps {
  solve: Solve;
  isZh: boolean;
  /** Recent solves of the same event for personal-average comparison.
   *  When provided and contains at least 5 solves with stageSegments,
   *  per-stage cells render a ±% label vs the user's ao12 / ao100 stage
   *  averages. Excludes the current solve implicitly via id match. */
  history?: Solve[];
  /** Optional callback for the BLD auto-memo "Apply" button. When provided
   *  and the solve is a BLD-class event without a manually-set memoMs, the
   *  report shows an inline hint with the auto-detected value plus a button
   *  that calls back with that ms value. Caller is responsible for writing
   *  the value into solve.bld.memoMs. When omitted, the hint is read-only. */
  onMemoApply?: (ms: number) => void;
  /** Load this solve's scramble into the timer. Omitted where there is no timer
   *  to load it into (the report is also rendered in places that only read).
   *  Closing whatever the report sits in is the CALLER's call — a dialog wants
   *  to dismiss itself, an inline report has nothing to dismiss. */
  onUseScramble?: (scramble: string) => void;
  /** Record whether the reconstruction matched reality. `undefined` clears a
   *  previous answer. Omitted where the solve can't be written back to. */
  onReconFeedback?: (ok: boolean | undefined) => void;
  /** Drop the 日期 cell from the summary row. For containers that already show
   *  the timestamp in their own header — the solve detail page does. */
  hideDate?: boolean;
}

const BLD_AUTO_DETECT_EVENTS = new Set<EventId>(['333bld', '444bld', '555bld', '333mbld']);
// Events that get a Speffz letter-pair memo panel. Currently 3BLD only —
// 4BLD/5BLD have wings/x-centers/+centers that the 3x3 helper can't handle.
const BLD_MEMO_EVENTS = new Set<EventId>(['333bld', '333ni']);

function formatSec(ms: number, digits = 2): string {
  return (ms / 1000).toFixed(digits) + 's';
}

interface AccordionSectionProps {
  title: ReactNode;
  /** When true, this section is collapsible with a chevron header.
   *  When false, the title still renders but content is always shown. */
  collapsible: boolean;
  expanded: boolean;
  onToggle: () => void;
  className?: string;
  children: ReactNode;
}

function AccordionSection({
  title, collapsible, expanded, onToggle, className, children,
}: AccordionSectionProps) {
  const cls = `reconstruct-section${className ? ' ' + className : ''}${collapsible ? ' reconstruct-section-collapsible' : ''}`;
  if (!collapsible) {
    return (
      <div className={cls}>
        <div className="reconstruct-section-title">{title}</div>
        {children}
      </div>
    );
  }
  return (
    <div className={cls}>
      <button
        type="button"
        className="reconstruct-section-header"
        onClick={onToggle}
        aria-expanded={expanded}
      >
        {expanded
          ? <ChevronDown size={14} />
          : <ChevronRight size={14} />}
        <span className="reconstruct-section-title reconstruct-section-title-inline">
          {title}
        </span>
      </button>
      {expanded && children}
    </div>
  );
}

export default function ReconstructReport({
  solve, isZh, history, onMemoApply, onUseScramble, onReconFeedback, hideDate,
}: ReconstructReportProps) {
  const moves = solve.moves ?? [];
  const slices = useMemo(
    () => sliceReconstruction(moves, solve.timeMs, solve.bld?.memoMs),
    [moves, solve.timeMs, solve.bld?.memoMs],
  );
  const stageSegs = useMemo(
    () => computeStageSegments(solve.scramble, moves, solve.timeMs),
    [solve.scramble, moves, solve.timeMs],
  );
  // The same rotation the analysis layer applies to itself (see orient.ts),
  // made explicit here because the two things the USER looks at need it too:
  // the written reconstruction, so the last layer reads as U-moves the way the
  // cuber executed it rather than as the D-moves the cube's colour frame
  // reports; and the replay, so the cross is on the bottom the way they were
  // holding it. Same move count, same indices — only the frame differs.
  const view = useMemo(() => normalizeSolve(solve.scramble, moves), [solve.scramble, moves]);
  // Recognition/execution split (Cubeast definitions — see step_metrics.ts).
  // 3x3-shaped events only: the stage walker underneath models a 3x3.
  const stepMx = useMemo(
    () => (stageSegs ? computeStepMetrics(solve.scramble, moves, solve.timeMs) : null),
    [stageSegs, solve.scramble, moves, solve.timeMs],
  );
  // Wasted-work detection (state revisits — see error_detect.ts). Gated the
  // same way: the walker models a 3x3.
  const waste = useMemo(
    () => (stageSegs ? detectWastedWork(solve.scramble, moves) : null),
    [stageSegs, solve.scramble, moves],
  );
  const wastedIdx = useMemo(() => {
    const set = new Set<number>();
    for (const sp of waste?.spans ?? []) {
      for (let i = sp.fromIdx; i <= sp.toIdx; i++) set.add(i);
    }
    return set;
  }, [waste]);

  // F2L, one pair at a time — the column set the step table opens F2L into.
  // Derived, never stored: it is a second reading of the same move stream.
  // Declared before the analysis effect below, which prices its slots.
  const slots = useMemo(
    () => (stageSegs ? computeF2lSlots(solve.scramble, moves, solve.timeMs, stageSegs) : null),
    [stageSegs, solve.scramble, moves, solve.timeMs],
  );

  // Per-stage reference lines + the quality score. Deferred to after the first
  // paint: the cross/F2L references are IDA* searches, and a report that takes
  // 100ms to appear feels broken in a way a number that lands 100ms late does
  // not. Recomputed whenever the solve changes; nothing is persisted.
  const [analysis, setAnalysis] = useState<{
    reference: ReferenceResult | null;
    slotReference: SlotReference[] | null;
    quality: SolveQuality | null;
  } | null>(null);
  // Scoreable = the 3x3 model actually reached solved (putDownMs is null
  // otherwise), and the solve counts. That one test covers all the ways there
  // is nothing to score: a non-3x3 event whose stream the walker can't follow,
  // a mid-solve abort, a DNF.
  const scoreable = stepMx !== null && stepMx.putDownMs !== null && solve.penalty !== 'DNF';
  useEffect(() => {
    setAnalysis(null);
    if (!scoreable || !stepMx) return;
    let alive = true;
    const timer = setTimeout(() => {
      if (!alive) return;
      let reference: ReferenceResult | null = null;
      try {
        reference = computeStageReferences(solve.scramble, moves, stepMx);
      } catch (err) {
        console.warn('[reconstruct] stage reference failed:', err);
      }
      // Same deferred pass, separate search: pricing one pair at a time asks a
      // different (and more constrained) question than pricing the block — see
      // computeF2lSlotReferences. A failure here must not cost us the block.
      let slotReference: SlotReference[] | null = null;
      try {
        if (slots) slotReference = computeF2lSlotReferences(solve.scramble, moves, slots);
      } catch (err) {
        console.warn('[reconstruct] slot reference failed:', err);
      }
      setAnalysis({
        reference,
        slotReference,
        quality: computeSolveQuality(moves, stepMx, reference, waste),
      });
    }, 0);
    return () => { alive = false; clearTimeout(timer); };
  }, [scoreable, stepMx, solve.scramble, moves, waste, slots]);

  // 文字复盘。识别那一层是 cubing.js 的活(每一行两次 detectStage + 末层查表),
  // 所以和参考解法一样推到首帧之后 —— 报告该立刻出现,标注可以晚一拍。
  const [reconText, setReconText] = useState<ReconTextResult | null>(null);
  /**
   * 转体。魔方不报,只能从姿态流里推(Sprint 28)—— 所以只有**录了姿态**的那些把
   * 有;没录的把 `solve.gyro` 不存在,这里是空数组,谱子和以前逐字一样。
   * 纯几何、不联网,几十个样本的活,不必推到下一帧。
   */
  const rotations = useMemo(
    // 牌子决定记号里的轴向(`BRAND_SENSOR_BASIS`);个数和角度与它无关。
    () => (solve.gyro
      ? detectRotations(decodeGyroTrack(solve.gyro), { brand: solve.device?.model })
      : []),
    [solve.gyro, solve.device?.model],
  );
  useEffect(() => {
    setReconText(null);
    if (!stageSegs || moves.length === 0) return;
    let alive = true;
    const timer = setTimeout(() => {
      buildReconText({
        scramble: view.scramble, moves: view.moves, totalMs: solve.timeMs,
        segs: stageSegs, metrics: stepMx, slots, rotations,
        physical: { scramble: solve.scramble, moves }, viewRotation: view.rotation,
      })
        .then(r => { if (alive) setReconText(r); })
        .catch(err => console.warn('[reconstruct] recon text failed:', err));
    }, 0);
    return () => { alive = false; clearTimeout(timer); };
  }, [stageSegs, stepMx, slots, view, solve.timeMs, rotations]);

  // Personal stage averages computed from the caller-provided history.
  // We exclude the current solve so a fresh solve isn't compared against
  // itself. Both windows require at least 5 eligible samples to render
  // — below that the comparison would be too noisy to be useful.
  const stageAvgs = useMemo(() => {
    if (!history || history.length === 0) return null;
    const eligible = history.filter(s => s.id !== solve.id);
    const ao12 = computeStageAverages(eligible, 12);
    const ao100 = computeStageAverages(eligible, 100);
    if (ao12.sampleSize < 5) return null;
    return { ao12, ao100 };
  }, [history, solve.id]);

  // Which method the report is read as. Not persisted on the solve: it is a
  // property of the READER, not of the solve, and a Roux solver switching once
  // should not rewrite what a CFOP solver stored.
  const [method, setMethod] = useState<MethodId>('cfop');
  const walk = useMemo(
    () => (method === 'cfop' ? null : walkMethod(method, solve.scramble, moves, solve.timeMs)),
    [method, solve.scramble, moves, solve.timeMs],
  );

  const [copied, setCopied] = useState(false);
  // 默认展开:回放 + 分步动作现在是这份报告的主体,不是附录。折叠留给「原始动作
  // 序列」那种真的很少看的东西。
  const [playbackExpanded, setPlaybackExpanded] = useState(true);
  const [moveListExpanded, setMoveListExpanded] = useState(false);
  const [referenceExpanded, setReferenceExpanded] = useState(false);
  const playbackAvailable = moves.length > 0 && nxnSizeForEvent(solve.event) !== null;
  const canShare = moves.length > 0;

  // External alg viewers (alg.cubing.net / twizzle for non-cubes, plus
  // cubedb.net). Reuses /recon's battle-tested builder — it keys on recon
  // event ids, so bridge our EventId first. null = no single puzzle applies
  // (relays / custom), in which case we render no links.
  const externalLinks = useMemo(() => {
    if (!canShare) return null;
    const reconEvent = toReconEventId(solve.event);
    if (!reconEvent) return null;
    const alg = moves.map(m => m.m).join(' ');
    if (!alg.trim()) return null;
    return buildExternalLinks(reconEvent, solve.scramble ?? '', alg);
  }, [canShare, solve.event, solve.scramble, moves]);

  const handleCopyShare = async () => {
    try {
      const url = encodeReplayUrl(solve);
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.warn('[reconstruct] copy share link failed:', err);
    }
  };

  const eff = effectiveMs(solve);
  const dt = new Date(solve.ts);
  const memoMs = solve.bld?.memoMs;

  // Auto-detect memo pause for BLD-class solves that haven't had a memoMs
  // set manually. The hint surfaces at the top of the report; user can apply
  // (callback) or just read the value. Skipped entirely once memoMs exists.
  const autoMemoMs = useMemo<number | null>(() => {
    if (memoMs !== undefined && memoMs !== null) return null;
    if (!BLD_AUTO_DETECT_EVENTS.has(solve.event)) return null;
    if (moves.length < 2) return null;
    return detectMemoPause(moves, solve.timeMs);
  }, [memoMs, solve.event, moves, solve.timeMs]);

  // Speffz letter-pair memo (3BLD only). Computed defensively — invalid
  // scrambles (empty / non-3x3 tokens) just yield empty pairs and we hide the
  // panel. Event gate keeps the panel off for non-BLD solves entirely.
  const bldMemo = useMemo(() => {
    if (!BLD_MEMO_EVENTS.has(solve.event)) return null;
    if (!solve.scramble || !solve.scramble.trim()) return null;
    try {
      return memoize3bld(solve.scramble);
    } catch (err) {
      console.warn('[reconstruct] bld memo failed:', err);
      return null;
    }
  }, [solve.event, solve.scramble]);

  /**
   * 数据那一半:质量分、时间轴、分步分析表、废步、四个总量。
   *
   * 摘出来是因为它排在**回放和谱子后面**(2026-08-03 用户提的顺序)。以前它是报告
   * 的第一屏,道理是「这把慢在哪」该一眼看到;但那是在假设读者已经知道自己拧了
   * 什么。真实顺序是反的 —— 先认出这把是怎么拧的(回放 + 谱子),那些数字才有东西
   * 可归因;先给一张 5×7 的表,读者第一件事仍然是往下翻去找谱子。
   */
  const analysisBlock = (
    <>
      {scoreable && (
        <QualityRow quality={analysis?.quality ?? null} pending={analysis === null} />
      )}

      {/* 这里以前还有一根 SolveTimeline(带阶段名的那条)。删了:回放那根进度条
          是同一根轴、同一份切分,只是多了个游标 —— 同一件事在一页上画两遍,读者
          第一反应是去找两者的区别。留下的是回放那根,并给它补上阶段名和阶段用时
          (2026-08-03 用户提的)。 */}

      {(stageSegs || walk) && memoMs === undefined && (
        <StepAnalysis
          method={method}
          onMethodChange={setMethod}
          segs={stageSegs}
          stepMetrics={stepMx}
          slots={slots}
          reference={analysis?.reference ?? null}
          slotReference={analysis?.slotReference ?? null}
          ao12={stageAvgs?.ao12 ?? null}
          walk={walk}
          moves={moves}
          rotations={rotations}
          // 有文字复盘时,阶段条由回放那根带游标的轴负责(同一份切分),这里不再
          // 画第二根;切不出谱子的那些把留着它,否则一根都没有。
          hideBar={method === 'cfop' && !!reconText && reconText.lines.length > 0}
          isZh={isZh}
        />
      )}
      {stageSegs && memoMs === undefined && method === 'cfop' && (
        <StageMetaLine
          segs={stageSegs}
          stepMetrics={stepMx}
          inspectionMs={solve.inspectionMs ?? null}
        />
      )}

      {waste && waste.spans.length > 0 && (
        <div className="reconstruct-waste-line">
          {tr({ zh: '废步', en: 'Wasted' })} {waste.totalWastedMoves} {tr({ zh: '步', en: 'turns' })}
          {' · '}
          {tr({ zh: '多花', en: 'lost' })} {formatSec(waste.totalWastedMs)}
          {tr({
            zh: `（${waste.spans.length} 处,动作表中已标出）`,
            en: ` (${waste.spans.length} ${waste.spans.length === 1 ? 'loop' : 'loops'}, marked in the move stream)`,
          })}
        </div>
      )}

      {/* 这里以前第一张是 HTM 卡(步数 + 步/秒)。删了:顶上那排摘要里「步数」和
          「TPS」就是这两个数,同一页上写两遍。QTM 留着 —— 它数的是四分之一圈,
          和 HTM 不是同一个口径。 */}
      <div className="reconstruct-stats">
        <div className="reconstruct-stat">
          <div className="reconstruct-stat-num">{slices.qtmCount}</div>
          <div className="reconstruct-stat-label">QTM</div>
          <div className="reconstruct-stat-sub">{slices.qtps.toFixed(2)} {tr({ zh: '步/秒', en: 'tps' })}</div>
        </div>
        <div className="reconstruct-stat">
          <div className="reconstruct-stat-num">{formatSec(slices.firstMoveLatencyMs)}</div>
          <div className="reconstruct-stat-label">{tr({ zh: '首动延迟', en: 'First move'
          })}</div>
          <div className="reconstruct-stat-sub">
            {memoMs !== undefined ? tr({ zh: '记忆后', en: 'after memo'
                                    }) : tr({ zh: '从计时开始', en: 'from start'
                                        })}
          </div>
        </div>
        <div className="reconstruct-stat">
          <div className="reconstruct-stat-num">{formatSec(slices.longestPauseMs)}</div>
          <div className="reconstruct-stat-label">{tr({ zh: '最长停顿', en: 'Longest pause'
          })}</div>
          <div className="reconstruct-stat-sub">{slices.pauseCount} × &gt;0.5s</div>
        </div>
      </div>
    </>
  );

  return (
    // `.rc-report` carries the CFOP stage palette (--rc-stage-*) that the bar,
    // the dots and the timeline all read. On the report, not on whatever is
    // around it — it is rendered inside two different containers.
    <div className="rc-report">
      {/* The numbers you want before you want anything else. They were strung
          along the title and inside the panels below; a solve report should
          open with them, not make you assemble them. */}
      <dl className="rc-summary">
        <div className="rc-summary-cell">
          <dt>{tr({ zh: '时间', en: 'Time' })}</dt>
          <dd className="rc-summary-big">
            {formatMs(eff)}
            {solve.penalty !== 'ok' && <span className="rc-summary-pen">{solve.penalty}</span>}
          </dd>
        </div>
        <div className="rc-summary-cell">
          <dt>TPS</dt>
          <dd className="rc-summary-big">{slices.htps.toFixed(2)}</dd>
        </div>
        <div className="rc-summary-cell">
          <dt>{tr({ zh: '步数', en: 'Turns' })}</dt>
          <dd className="rc-summary-big">{slices.htmCount}</dd>
        </div>
        <div className="rc-summary-cell">
          <dt title={tr({
            zh: '手速能达到的最短时间 ÷ 实际用时。100% = 全程没有停顿。',
            en: 'What your hands alone would have taken ÷ what it took. 100% = never paused.',
          })}>{tr({ zh: '流畅', en: 'Fluency' })}</dt>
          <dd className="rc-summary-big">
            {analysis?.quality?.flow !== null && analysis?.quality?.flow !== undefined
              ? `${Math.round(analysis.quality.flow)}%`
              : '–'}
          </dd>
        </div>
        {!hideDate && (
          <div className="rc-summary-cell">
            <dt>{tr({ zh: '日期', en: 'Date' })}</dt>
            <dd title={dt.toLocaleString()}>{dt.toLocaleDateString()}</dd>
          </div>
        )}
        {solve.device && (
          <div className="rc-summary-cell">
            <dt>{tr({ zh: '魔方', en: 'Cube' })}</dt>
            <dd className="rc-summary-cube" title={solve.device.name}>{solve.device.name}</dd>
          </div>
        )}
      </dl>

      {/* 读完那几个数之后想做的事,一行摆完:再打一遍、把这把发出去、拿到别的
          工具里看。放在数字下面,因为它们是读完的动作,不是先于它们的选项。 */}
      <div className="rc-actions">
        {onUseScramble && (solve.scramble ?? '').trim() !== '' && (
          <button
            type="button"
            className="rc-action"
            onClick={() => onUseScramble(solve.scramble)}
          >
            {tr({ zh: '用这条打乱', en: 'Use this scramble' })}
          </button>
        )}
        <button
          type="button"
          className="rc-action rc-action--ghost"
          onClick={handleCopyShare}
          disabled={!canShare}
          title={!canShare
            ? tr({ zh: '没有动作记录，无法分享回放', en: 'No move log — share unavailable' })
            : tr({ zh: '复制分享链接', en: 'Copy share link' })}
        >
          <Link2 size={14} />
          {copied
            ? tr({ zh: '已复制', en: 'Copied' })
            : tr({ zh: '复制分享链接', en: 'Copy share link' })}
        </button>
        {externalLinks && (
          <>
            <a
              className="rc-action rc-action--ghost"
              href={externalLinks.algUrl}
              target="_blank"
              rel="noopener noreferrer"
              title={tr({ zh: `在 ${externalLinks.algSiteName} 打开`, en: `Open on ${externalLinks.algSiteName}` })}
            >
              {externalLinks.algSiteName}
            </a>
            <a
              className="rc-action rc-action--ghost"
              href={externalLinks.cubedbUrl}
              target="_blank"
              rel="noopener noreferrer"
              title={tr({ zh: '在 cubedb.net 打开', en: 'Open on cubedb.net' })}
            >
              cubedb.net
            </a>
          </>
        )}
      </div>

      {/* 打乱。有文字复盘的时候它是谱子的第一行(见 StepMoveList)—— 打乱和动作
          写在一起才是一份照着能复现的东西,分成两块就得自己拼。这里兜的是没有
          文字复盘的那些把(非三阶、切分失败):否则整份报告一个字都不提这把是从
          哪儿开始的。 */}
      {(solve.scramble ?? '').trim() !== '' && !(reconText && reconText.lines.length > 0) && (
        <div className="rc-scramble">
          <span className="rc-scramble-label">{tr({ zh: '打乱', en: 'Scramble' })}</span>
          <span className="rc-scramble-text">{solve.scramble}</span>
        </div>
      )}

      {autoMemoMs !== null && (
        <div className="reconstruct-auto-memo-hint">
          <span>
            {tr({ zh: '自动检测记忆时长', en: 'auto-detected memo' })}: {(autoMemoMs / 1000).toFixed(2)}s
          </span>
          {onMemoApply && (
            <button type="button" className="rc-action rc-action--ghost" onClick={() => onMemoApply(autoMemoMs)}>
              {tr({ zh: '应用', en: 'Apply' })}
            </button>
          )}
        </div>
      )}

      {bldMemo && (
        <div className="reconstruct-bld-memo">
          <div className="reconstruct-bld-memo-head">
            <span className="reconstruct-bld-memo-title">
              {tr({ zh: '盲拧记忆 (Speffz)', en: 'BLD memo (Speffz)' })}
            </span>
            <span className="reconstruct-bld-memo-buffers">
              {tr({ zh: '缓冲块: 角 UFR / 棱 UF', en: 'buffers: corner UFR / edge UF' })}
              {bldMemo.parity ? tr({ zh: ' · 奇偶', en: ' · parity' }) : ''}
            </span>
          </div>
          <div className="reconstruct-bld-memo-grid">
            <span className="reconstruct-bld-memo-key">{tr({ zh: '角块', en: 'Corners' })}:</span>
            <span className="reconstruct-bld-memo-val">
              {bldMemo.cornerPairs || tr({ zh: '(无)', en: '(none)' })}
            </span>
            <span className="reconstruct-bld-memo-key">{tr({ zh: '棱块', en: 'Edges' })}:</span>
            <span className="reconstruct-bld-memo-val">
              {bldMemo.edgePairs || tr({ zh: '(无)', en: '(none)' })}
            </span>
            {bldMemo.twistedCorners.length > 0 && (
              <>
                <span className="reconstruct-bld-memo-key">{tr({ zh: '角扭', en: 'Twisted' })}:</span>
                <span className="reconstruct-bld-memo-val">{bldMemo.twistedCorners.join(' ')}</span>
              </>
            )}
            {bldMemo.flippedEdges.length > 0 && (
              <>
                <span className="reconstruct-bld-memo-key">{tr({ zh: '棱翻', en: 'Flipped' })}:</span>
                <span className="reconstruct-bld-memo-val">{bldMemo.flippedEdges.join(' ')}</span>
              </>
            )}
          </div>
        </div>
      )}

      {memoMs !== undefined && (
        <div className="reconstruct-bld-bar">
          <span className="reconstruct-bld-seg memo">
            {tr({ zh: '记忆', en: 'Memo'
          })} {formatMs(memoMs)}
          </span>
          <span className="reconstruct-bld-seg exec">
            {tr({ zh: '执行', en: 'Execution'
          })} {formatMs(slices.executionMs)}
          </span>
        </div>
      )}

      {analysis?.reference && (
        <AccordionSection
          title={tr({ zh: '参考解法', en: 'Reference lines' })}
          collapsible
          expanded={referenceExpanded}
          onToggle={() => setReferenceExpanded(v => !v)}
        >
          <ReferenceList reference={analysis.reference} />
        </AccordionSection>
      )}

      {playbackAvailable && (
        <div className="reconstruct-section">
          <button
            type="button"
            className="reconstruct-playback-toggle"
            onClick={() => setPlaybackExpanded(v => !v)}
            aria-expanded={playbackExpanded}
          >
            {playbackExpanded
              ? <ChevronDown size={14} />
              : <ChevronRight size={14} />}
            <span>
              {tr({ zh: '回放与分步动作', en: 'Replay and turns per step' })}
            </span>
          </button>
          {playbackExpanded && (
            <PlaybackPanel
              event={solve.event}
              scramble={solve.scramble}
              moves={moves}
              viewRotation={view.rotation}
              totalMs={solve.timeMs}
              isZh={isZh}
              lines={reconText?.lines ?? []}
              gyro={solve.gyro ?? null}
              deviceModel={solve.device?.model ?? null}
              side={reconText ? ({ idx, seek }) => (
                <StepMoveList
                  recon={reconText}
                  reference={analysis?.reference ?? null}
                  slotReference={analysis?.slotReference ?? null}
                  currentIdx={idx}
                  onSeek={seek}
                  feedback={onReconFeedback
                    ? <ReconFeedback value={solve.reconOk} onChange={onReconFeedback} />
                    : undefined}
                />
              ) : undefined}
            />
          )}
        </div>
      )}

      {analysisBlock}

      <AccordionSection
        title={tr({ zh: `动作序列 (${moves.length})`, en: `Move stream (${moves.length})` })}
        collapsible
        expanded={moveListExpanded}
        onToggle={() => setMoveListExpanded(v => !v)}
      >
        {moves.length === 0 ? (
          <div className="reconstruct-empty">
            {tr({ zh: '此次成绩未记录蓝牙动作。', en: 'No bluetooth moves recorded for this solve.'
          })}
          </div>
        ) : (
          <ol className="reconstruct-move-list">
            {moves.map((mv, i) => {
              const prev = i > 0 ? moves[i - 1].ts : null;
              const gap = prev !== null ? mv.ts - prev : null;
              const slow = gap !== null && gap > 500;
              const wasted = wastedIdx.has(i);
              return (
                <li
                  key={i}
                  className={`reconstruct-move-row ${slow ? 'slow' : ''}${wasted ? ' wasted' : ''}`}
                  title={wasted
                    ? tr({ zh: '废步:这一段转完回到了之前的状态', en: 'wasted: this run returns to a prior state' })
                    : undefined}
                >
                  <span className="reconstruct-move-idx">{i + 1}</span>
                  <span className="reconstruct-move-token">{mv.m}</span>
                  <span className="reconstruct-move-ts">t={formatSec(mv.ts)}</span>
                  <span className="reconstruct-move-gap">
                    {gap !== null ? `Δ=+${formatSec(gap)}` : '—'}
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </AccordionSection>
    </div>
  );
}

/**
 * 「这份复盘对不对?」 —— 两个按钮,不改任何一个数字。
 *
 * 阶段切分是**推**出来的:魔方只报转了什么,不报你心里把哪一手当成 F2L 的开始。
 * 边界推错的那把,表里每个数都跟着错,而唯一知道错了的人是刚拧完的那个。这一行
 * 就是给他一个说「不对」的地方 —— 答案落在 `Solve.reconOk` 上,和那把成绩存在
 * 一起,以后要查切分 bug 时有样本可捞。
 *
 * 再按一次同一个按钮 = 收回答案(回到「没问过」),因为误点比不答更常见。
 */
function ReconFeedback({
  value, onChange,
}: {
  value: boolean | undefined;
  onChange: (v: boolean | undefined) => void;
}) {
  const hint = tr({
    zh: '阶段边界是从动作流推出来的,不是魔方报的。推错了这里说一声 —— 不影响任何数字,只是留个记号。',
    en: 'The stage boundaries are inferred from the turn stream, not reported by the cube. Say so if they are wrong — it changes no number, it just leaves a marker.',
  });
  return (
    <div className="rc-feedback">
      <span className="rc-feedback-q">{tr({ zh: '复盘对不对?', en: 'Reconstruction correct?' })}</span>
      <button
        type="button"
        className={`rc-feedback-btn${value === true ? ' is-on' : ''}`}
        aria-pressed={value === true}
        onClick={() => onChange(value === true ? undefined : true)}
        title={tr({ zh: '切分是对的', en: 'The split is right' })}
      >
        <ThumbsUp size={14} />
      </button>
      <button
        type="button"
        className={`rc-feedback-btn${value === false ? ' is-off' : ''}`}
        aria-pressed={value === false}
        onClick={() => onChange(value === false ? undefined : false)}
        title={tr({ zh: '切分不对', en: 'The split is wrong' })}
      >
        <ThumbsDown size={14} />
      </button>
      <span className="rc-feedback-info" title={hint} aria-label={hint}>
        <Info size={13} />
      </span>
    </div>
  );
}

/** 0-100 with its three components. Pending renders the same row with dashes
 *  so the report doesn't jump when the search lands. */
function QualityRow({ quality, pending }: { quality: SolveQuality | null; pending: boolean }) {
  if (!pending && !quality) return null;
  const dash = '—';
  const parts: Array<{ label: string; value: number | null; hint: string }> = quality ? [
    {
      label: tr({ zh: '效率', en: 'Efficiency' }),
      value: quality.efficiency,
      hint: quality.turnRatio !== null
        ? tr({
          zh: `比参考多 ${Math.round((quality.turnRatio - 1) * 100)}%`,
          en: `${Math.round((quality.turnRatio - 1) * 100)}% over reference`,
        })
        : tr({ zh: '无参考', en: 'no reference' }),
    },
    {
      label: tr({ zh: '无废步', en: 'Waste-free' }),
      value: quality.wasteFree,
      hint: quality.wastedMs > 0
        ? tr({ zh: `废步 ${formatSec(quality.wastedMs, 1)}`, en: `${formatSec(quality.wastedMs, 1)} undone` })
        : tr({ zh: '没有回退', en: 'nothing undone' }),
    },
  ] : [];

  return (
    <div className="reconstruct-quality">
      <div className="reconstruct-quality-total">
        <span className="reconstruct-quality-num">{quality ? quality.total : dash}</span>
        <span className="reconstruct-quality-cap">{tr({ zh: '质量', en: 'Quality' })}</span>
      </div>
      <div className="reconstruct-quality-parts">
        {parts.length === 0 ? (
          <span className="reconstruct-quality-pending">
            {tr({ zh: '正在算参考解法…', en: 'solving the reference lines…' })}
          </span>
        ) : parts.map(p => (
          <div key={p.label} className="reconstruct-quality-part">
            <span className="reconstruct-quality-part-label">{p.label}</span>
            <span className="reconstruct-quality-part-num">
              {p.value === null ? dash : Math.round(p.value)}
            </span>
            <span className="reconstruct-quality-part-hint">{p.hint}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Where a stage's reference came from — the honesty label. */
function refKindLabel(kind: NonNullable<StageReference['kind']>): string {
  switch (kind) {
    case 'optimal':      return tr({ zh: '最优', en: 'optimal' });
    case 'step-optimal': return tr({ zh: '步进最优', en: 'step-optimal' });
    case 'library-alg':  return tr({ zh: '库内最短', en: 'shortest in library' });
  }
}

type StageKey = 'cross' | 'f2l' | 'oll' | 'pll';

function stageLabel(step: StageKey): string {
  switch (step) {
    case 'cross': return tr({ zh: '十字', en: 'Cross' });
    case 'f2l':   return 'F2L';
    case 'oll':   return 'OLL';
    case 'pll':   return 'PLL';
  }
}

/** The reference line for each stage, with the move sequence — the depth layer
 *  where "6 turns were available" becomes "and here they are". */
function ReferenceList({ reference }: { reference: ReferenceResult }) {
  const rows = reference.stages.filter(s => s.refSolution || s.refTurns !== null);
  if (rows.length === 0) return null;
  return (
    <div className="reconstruct-ref-list">
      {rows.map(s => (
        <div key={s.step} className="reconstruct-ref-row">
          <span className="reconstruct-ref-stage">{stageLabel(s.step)}</span>
          <span className="reconstruct-ref-count">
            {s.userTurns ?? '—'} / {s.refTurns ?? '—'}
            {s.kind && (
              <span className="reconstruct-ref-kind">{refKindLabel(s.kind)}</span>
            )}
          </span>
          <span className="reconstruct-ref-alg">
            {s.refSolution || (s.note === 'skipped' ? tr({ zh: '跳过', en: 'skipped' }) : '—')}
          </span>
        </div>
      ))}
      {reference.refTurns !== null && reference.userTurns !== null && (
        <div className="reconstruct-ref-total">
          {tr({ zh: '合计', en: 'Total' })} {reference.userTurns} / {reference.refTurns}
          {' '}{tr({ zh: '步', en: 'turns' })}
          {reference.delta !== null && reference.delta !== 0 && (
            <span className={`reconstruct-stage-delta ${reference.delta > 0 ? 'slower' : 'faster'}`}>
              {reference.delta > 0 ? '+' : ''}{reference.delta}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * The solve-level line the step table has no column for: inspection, pickup,
 * the recognition/execution totals and put-down. Everything here is about the
 * WHOLE solve rather than one step, which is exactly why it sits outside the
 * table instead of being squeezed into a TOTAL cell.
 */
function StageMetaLine({
  segs, stepMetrics, inspectionMs,
}: {
  segs: NonNullable<ReturnType<typeof computeStageSegments>>;
  stepMetrics: StepMetricsResult | null;
  inspectionMs: number | null;
}) {
  if (!stepMetrics) return null;
  const t = (ms: number | null): string => (ms === null ? '—' : `${(ms / 1000).toFixed(2)}s`);
  const parts: string[] = [];
  if (inspectionMs !== null && inspectionMs > 0) {
    parts.push(`${tr({ zh: '观察', en: 'inspect' })} ${t(inspectionMs)}`);
  }
  if (stepMetrics.pickupMs > 0) {
    parts.push(`${tr({ zh: '拿起', en: 'pickup' })} ${t(stepMetrics.pickupMs)}`);
  }
  if (stepMetrics.putDownMs !== null && stepMetrics.putDownMs > 0) {
    parts.push(`${tr({ zh: '放下', en: 'put-down' })} ${t(stepMetrics.putDownMs)}`);
  }
  if (stepMetrics.execTps !== null) {
    parts.push(`${stepMetrics.execTps.toFixed(1)} ${tr({ zh: '步/秒(执行)', en: 'tps (exec)' })}`);
  }
  if (segs.crossSide) parts.push(segs.crossSide);
  if (parts.length === 0) return null;
  return <div className="reconstruct-stage-meta">{parts.join(' · ')}</div>;
}

'use client';

/**
 * 记忆模式 —— 公式的「看图回忆」闪卡训练,背后是间隔重复调度(lib/alg-srs.ts)。
 *
 * 与计时训练的分工:计时练的是**手速**,这里练的是**记得住**。一张卡的完整回合是
 *   看图(+ 可选打乱,拿真魔方摆出来) → 自己回忆公式 → 揭示 → 四档自评
 * 评分决定下次什么时候再见到它:忘了 = 本场稍后重来,秒答 = 隔几周。
 *
 * 本场队列由 buildSrsQueue 组:到期的排前面(过期越久越前),按额度掺进新卡,
 * 都用完了还可以按「最弱」加练。评「忘了」的卡当场塞回队列尾部附近 —— 一场之内
 * 至少再见一次,这是短期记忆能不能转成长期记忆的关键一步。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from '@/components/AppLink';
import {
  Check, Copy, Eye, Undo2, RotateCcw, Play, ChevronDown, ChevronRight, Star, SkipForward,
} from 'lucide-react';
import type { AlgCase, AlgPuzzle } from '@cuberoot/shared';
import { CaseThumb } from '@/components/CaseThumb';
import AlgPlayer from '@/components/AlgPlayer';
import { useCopy } from '@/hooks/useCopy';
import { caseKey, findCaseByKey } from '@/lib/trainer-case-key';
import { primaryCaseName } from '@/lib/alg_case_display';
import { sanitizeAlgHtml } from '@/lib/alg_html';
import { generateScramble, purifyScramble, type ScrambleKind } from '@/lib/trainer-scramble';
import { useTrainerStore } from '@/lib/trainer-store';
import { useAlgSrs, autoMarkFromSrs } from '@/lib/alg-srs-store';
import {
  buildSrsQueue, previewIntervals, srsPhase,
  type SrsGrade, type SrsQueueItem, type SrsRec,
} from '@/lib/alg-srs';
import { useTrainerMarks, markStarred } from '@/lib/trainer-marks';
import { tr } from '@/i18n/tr';

/** 四档自评。颜色沿用全站状态色:忘了=危险、犹豫=警告、记得=成功、秒答=品牌强调。 */
const GRADES: Array<{ g: SrsGrade; cls: string; zh: string; en: string; hint: { zh: string; en: string } }> = [
  { g: 0, cls: 'again', zh: '忘了', en: 'Forgot', hint: { zh: '完全想不起来', en: 'No idea' } },
  { g: 1, cls: 'hard', zh: '犹豫', en: 'Hard', hint: { zh: '想了半天才出来', en: 'Recalled slowly' } },
  { g: 2, cls: 'good', zh: '记得', en: 'Good', hint: { zh: '顺利想起来', en: 'Recalled fine' } },
  { g: 3, cls: 'easy', zh: '秒答', en: 'Easy', hint: { zh: '不用想', en: 'Instant' } },
];

/** 间隔天数 → 人话。0 = 本场稍后再来。 */
function ivLabel(days: number): string {
  if (days <= 0) return tr({ zh: '本场重来', en: 'again now' });
  if (days === 1) return tr({ zh: '1 天', en: '1d' });
  if (days < 30) return tr({ zh: `${days} 天`, en: `${days}d` });
  const mo = Math.round(days / 30);
  return tr({ zh: `${mo} 个月`, en: `${mo}mo` });
}

/** 评「忘了」后隔几张再出现;新卡评「犹豫」隔得远一点(它还没成形,急着回炉没用)。 */
const RELEARN_GAP = { again: 4, hard: 9 };

type SessionTally = Record<SrsGrade, number>;
const emptyTally = (): SessionTally => ({ 0: 0, 1: 0, 2: 0, 3: 0 });

interface UndoFrame {
  key: string;
  prev: SrsRec | undefined;
  grade: SrsGrade;
  /** 评分时插回队列的位置(撤销要把它抽掉)。 */
  requeuedAt: number | null;
  pos: number;
}

export default function MemoryTrainer({
  puzzle, set, cases, pool, scrambleKind, onExit,
}: {
  puzzle: AlgPuzzle;
  set: string;
  cases: AlgCase[];
  /** 训练池(已选 ∩ scope)。 */
  pool: string[];
  scrambleKind: ScrambleKind;
  /** 「本场结束」面板里的「回训练模式」。 */
  onExit: () => void;
}) {
  const recs = useAlgSrs(s => s.recs);
  const gradeCase = useAlgSrs(s => s.grade);
  const restoreCase = useAlgSrs(s => s.restore);
  const resetCase = useAlgSrs(s => s.reset);
  const marks = useTrainerMarks(s => s.marks);
  const applyMarks = useTrainerMarks(s => s.applyMarks);

  const newLimit = useTrainerStore(s => s.srsNewLimit);
  const sessionLimit = useTrainerStore(s => s.srsSessionLimit);
  const fillExtra = useTrainerStore(s => s.srsFillExtra);
  const autoMark = useTrainerStore(s => s.srsAutoMark);
  const showPlayer = useTrainerStore(s => s.srsShowPlayer);
  const preAuf = useTrainerStore(s => s.preAuf);
  const postAuf = useTrainerStore(s => s.postAuf);
  const pureScramble = useTrainerStore(s => s.pureScramble);
  const showThumb = useTrainerStore(s => s.showStageThumb);

  const [queue, setQueue] = useState<SrsQueueItem[]>([]);
  const [pos, setPos] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [tally, setTally] = useState<SessionTally>(emptyTally);
  const [undo, setUndo] = useState<UndoFrame | null>(null);
  const [showAlts, setShowAlts] = useState(false);
  const [playing, setPlaying] = useState(false);
  /** 本场卡片总数的初始值(队列会因重学而变长,进度分母固定用它更稳)。 */
  const [plannedTotal, setPlannedTotal] = useState(0);
  const { copied, copy } = useCopy();

  // 组队列。只在池 / 额度变化时重组 —— 评分会改 recs,但**不能**据此重排当前这场
  //(刷到一半整队洗牌,人就找不着北了)。所以 recs 读一次快照,不进依赖。
  const recsRef = useRef(recs);
  recsRef.current = recs;
  const poolSig = pool.join('|');
  const rebuild = useCallback(() => {
    const q = buildSrsQueue(pool, recsRef.current, Date.now(), {
      newLimit, sessionLimit, fillExtra,
    });
    setQueue(q);
    setPlannedTotal(q.length);
    setPos(0);
    setRevealed(false);
    setTally(emptyTally());
    setUndo(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [poolSig, newLimit, sessionLimit, fillExtra]);
  useEffect(() => { rebuild(); }, [rebuild]);

  const card = queue[pos] ?? null;
  const c = card ? findCaseByKey(cases, card.key) ?? null : null;
  const rec = card ? recs[card.key] : undefined;

  // 打乱只在换卡时生成一次(每次 render 重算会让画面上的打乱抖动)
  const [scramble, setScramble] = useState('');
  useEffect(() => {
    if (!c) { setScramble(''); return; }
    setScramble(generateScramble(c, puzzle, scrambleKind, { preAuf, postAuf }));
    setRevealed(false);
    setShowAlts(false);
    setPlaying(false);
  }, [c, puzzle, scrambleKind, preAuf, postAuf]);

  const shownScramble = pureScramble ? purifyScramble(puzzle, scramble) : scramble;
  const previews = useMemo(() => previewIntervals(rec, Date.now()), [rec]);

  // 剩余各类计数(队列里当前位置之后的)
  const remain = useMemo(() => {
    const r = { due: 0, fresh: 0, extra: 0 };
    for (let i = pos; i < queue.length; i++) {
      if (queue[i].kind === 'new') r.fresh++;
      else if (queue[i].kind === 'extra') r.extra++;
      else r.due++;
    }
    return r;
  }, [queue, pos]);

  const answer = useCallback((g: SrsGrade) => {
    if (!card) return;
    const next = gradeCase(card.key, g);
    // 标记的自动升降与计时训练共用一份(lib/alg-srs-store),可在设置里关
    if (autoMark) autoMarkFromSrs(card.key, next, g);
    setTally(t => ({ ...t, [g]: t[g] + 1 }));

    // 忘了 / 新卡犹豫 → 塞回本场队列,过几张再见一次
    let requeuedAt: number | null = null;
    const requeue = g === 0 || (g === 1 && next.iv === 0);
    if (requeue) {
      const gap = g === 0 ? RELEARN_GAP.again : RELEARN_GAP.hard;
      const at = Math.min(queue.length, pos + 1 + gap);
      setQueue(q => {
        const nq = [...q];
        nq.splice(at, 0, { key: card.key, kind: 'due' });
        return nq;
      });
      requeuedAt = at;
    }
    setUndo({ key: card.key, prev: rec, grade: g, requeuedAt, pos });
    setPos(p => p + 1);
    setRevealed(false);
  }, [card, gradeCase, autoMark, queue.length, pos, rec]);

  const doUndo = useCallback(() => {
    if (!undo) return;
    restoreCase(undo.key, undo.prev);
    if (undo.requeuedAt != null) {
      setQueue(q => {
        const nq = [...q];
        // 只抽掉当时插进去的那一张(位置可能因后续操作前移,按 key 在附近找)
        const at = nq[undo.requeuedAt!]?.key === undo.key
          ? undo.requeuedAt!
          : nq.findIndex((x, i) => i > undo.pos && x.key === undo.key);
        if (at >= 0) nq.splice(at, 1);
        return nq;
      });
    }
    setTally(t => ({ ...t, [undo.grade]: Math.max(0, t[undo.grade] - 1) }));
    setPos(undo.pos);
    setRevealed(true);
    setUndo(null);
  }, [undo, restoreCase]);

  /** 跳过:不评分、不改记忆,直接看下一张(这把手边没魔方之类)。 */
  const skip = useCallback(() => {
    if (!card) return;
    setPos(p => p + 1);
    setRevealed(false);
  }, [card]);

  const done = !card && queue.length > 0;
  const doneRef = useRef(done);
  doneRef.current = done;
  const revealedRef = useRef(revealed);
  revealedRef.current = revealed;

  // 键盘:空格/回车揭示 → 1-4 评分;U 撤销;S 跳过。输入框内不接管。
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.code === 'KeyU' && !e.repeat) { e.preventDefault(); doUndo(); return; }
      if (doneRef.current) return;
      if (e.code === 'Space' || e.code === 'Enter' || e.code === 'NumpadEnter') {
        e.preventDefault();
        if (!e.repeat && !revealedRef.current) setRevealed(true);
        return;
      }
      if (e.code === 'KeyS' && !e.repeat) { e.preventDefault(); skip(); return; }
      const digit = ['Digit1', 'Digit2', 'Digit3', 'Digit4'].indexOf(e.code);
      if (digit >= 0 && !e.repeat) {
        e.preventDefault();
        if (revealedRef.current) answer(digit as SrsGrade);
        else setRevealed(true);   // 还没揭示就按分数 = 先给他看答案,不闷头记账
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [answer, doUndo, skip]);

  if (pool.length === 0) {
    return <div className="srs-empty">{tr({ zh: '尚未选 case', en: 'No cases selected' })}</div>;
  }

  if (queue.length === 0) {
    // 池里全部都不到期、且关了加练 —— 这是好事,别当成错误页
    return (
      <div className="srs-done">
        <h2>{tr({ zh: '今天没有到期的卡片', en: 'Nothing due today' })}</h2>
        <p className="srs-done-sub">
          {tr({
            zh: '选中的公式都还在记忆里。想提前练可以在设置里打开「加练」,或者调高新卡额度学新的。',
            en: 'Everything you picked is still fresh. Turn on “extra drilling” in settings to practise ahead, or raise the new-card limit to learn more.',
          })}
        </p>
        <div className="srs-done-actions">
          <button type="button" className="srs-btn is-primary" onClick={rebuild}>
            {tr({ zh: '重新组队列', en: 'Rebuild queue' })}
          </button>
          <button type="button" className="srs-btn" onClick={onExit}>
            {tr({ zh: '回训练模式', en: 'Back to training' })}
          </button>
        </div>
      </div>
    );
  }

  if (done) {
    const total = tally[0] + tally[1] + tally[2] + tally[3];
    const kept = total - tally[0];
    return (
      <div className="srs-done">
        <h2>{tr({ zh: '本场完成', en: 'Session complete' })}</h2>
        <div className="srs-done-stats">
          <div className="srs-done-stat"><b>{total}</b><span>{tr({ zh: '张卡片', en: 'cards' })}</span></div>
          <div className="srs-done-stat">
            <b>{total > 0 ? Math.round((kept / total) * 100) : 0}%</b>
            <span>{tr({ zh: '记住', en: 'recalled' })}</span>
          </div>
          <div className="srs-done-stat is-again"><b>{tally[0]}</b><span>{tr({ zh: '忘了', en: 'forgot' })}</span></div>
          <div className="srs-done-stat is-easy"><b>{tally[3]}</b><span>{tr({ zh: '秒答', en: 'easy' })}</span></div>
        </div>
        <p className="srs-done-sub">
          {tr({
            zh: '到期的卡片已经按新间隔排好,明天再来接着刷。',
            en: 'Everything is rescheduled — come back tomorrow and keep the streak.',
          })}
        </p>
        <div className="srs-done-actions">
          <button type="button" className="srs-btn is-primary" onClick={rebuild}>
            {tr({ zh: '再来一场', en: 'Another session' })}
          </button>
          <Link href="/alg/progress" className="srs-btn" prefetch={false}>
            {tr({ zh: '看学习进度', en: 'View progress' })}
          </Link>
          <button type="button" className="srs-btn" onClick={onExit}>
            {tr({ zh: '回训练模式', en: 'Back to training' })}
          </button>
        </div>
      </div>
    );
  }

  if (!c || !card) {
    // 队列里的 case 在本集里找不到(set 改过)——跳过它,别整个页面卡死
    return (
      <div className="srs-empty">
        {tr({ zh: '这张卡片已不在本公式集里', en: 'This card is no longer in the set' })}
        <button type="button" className="srs-btn" onClick={skip} style={{ marginLeft: 12 }}>
          {tr({ zh: '跳过', en: 'Skip' })}
        </button>
      </div>
    );
  }

  const k = caseKey(c);
  const phase = srsPhase(rec);
  const entries = c.algs.flat();
  const primary = entries[0];
  const alts = entries.slice(1);
  const pct = plannedTotal > 0 ? Math.min(100, (pos / Math.max(plannedTotal, queue.length)) * 100) : 0;
  const KIND_LABEL: Record<SrsQueueItem['kind'], string> = {
    due: tr({ zh: '复习', en: 'Review' }),
    new: tr({ zh: '新学', en: 'New' }),
    extra: tr({ zh: '加练', en: 'Extra' }),
  };

  return (
    <div className="srs-root">
      {/* 本场进度:一条细条 + 右侧「还剩什么」。不加外框,与全站留白风格一致。 */}
      <div className="srs-session-head">
        <div className="srs-session-bar" role="img"
          aria-label={tr({ zh: `本场进度 ${pos}/${queue.length}`, en: `Session ${pos}/${queue.length}` })}>
          <span style={{ width: `${pct}%` }} />
        </div>
        <div className="srs-session-meta">
          <span className="srs-session-count">{pos}<i>/</i>{queue.length}</span>
          {remain.due > 0 && <span className="srs-chip is-due">{tr({ zh: '复习', en: 'Review' })} {remain.due}</span>}
          {remain.fresh > 0 && <span className="srs-chip is-new">{tr({ zh: '新学', en: 'New' })} {remain.fresh}</span>}
          {remain.extra > 0 && <span className="srs-chip is-extra">{tr({ zh: '加练', en: 'Extra' })} {remain.extra}</span>}
        </div>
      </div>

      <div className="srs-card">
        <div className="srs-card-top">
          <span className={`srs-kind is-${card.kind}`}>{KIND_LABEL[card.kind]}</span>
          <span className="srs-case-name">{primaryCaseName(puzzle, set, c)}</span>
          {markStarred(marks, k) && <Star size={13} className="srs-case-star" aria-label={tr({ zh: '星标', en: 'Starred' })} />}
          <button
            type="button"
            className="srs-mini-btn"
            onClick={() => applyMarks([k], { f: !markStarred(marks, k) })}
            title={tr({ zh: '星标(难点)', en: 'Star as tricky' })}
            aria-pressed={markStarred(marks, k)}
          >
            <Star size={13} />
          </button>
        </div>

        {showThumb && (
          <div className="srs-thumb">
            <CaseThumb
              puzzle={puzzle}
              set={set}
              sticker={c.sticker}
              alg={primary?.alg ?? c.standard ?? ''}
              setup={scramble || c.setup}
              size={210}
              local
            />
          </div>
        )}

        {shownScramble && (
          <div className="srs-scramble">
            <code>{shownScramble}</code>
            <button type="button" className="srs-mini-btn" onClick={() => copy(shownScramble)}
              title={tr({ zh: '复制打乱', en: 'Copy scramble' })}>
              {copied ? <Check size={13} /> : <Copy size={13} />}
            </button>
          </div>
        )}

        {!revealed ? (
          <div className="srs-reveal-zone">
            <button type="button" className="srs-reveal-btn" onClick={() => setRevealed(true)}>
              <Eye size={16} /> {tr({ zh: '显示公式', en: 'Show algorithm' })}
              <kbd>{tr({ zh: '空格', en: 'Space' })}</kbd>
            </button>
            <p className="srs-reveal-hint">
              {card.kind === 'new'
                ? tr({ zh: '新卡片:直接看公式,照着做两遍再评「记得」', en: 'New card — reveal it, run it twice, then grade it' })
                : tr({ zh: '先自己回忆一遍,想不起来再看', en: 'Try to recall it first, then reveal' })}
            </p>
          </div>
        ) : (
          <div className="srs-answer">
            <div className="srs-alg-main">
              {primary?.algHtml && puzzle !== 'sq1'
                ? <span dangerouslySetInnerHTML={{ __html: sanitizeAlgHtml(primary.algHtml) }} />
                : <span>{primary?.alg ?? c.standard ?? '—'}</span>}
              <button type="button" className="srs-mini-btn" onClick={() => copy(primary?.alg ?? '')}
                title={tr({ zh: '复制公式', en: 'Copy algorithm' })}>
                <Copy size={13} />
              </button>
            </div>

            <div className="srs-answer-tools">
              {alts.length > 0 && (
                <button type="button" className="srs-link-btn" onClick={() => setShowAlts(v => !v)}>
                  {showAlts ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                  {tr({ zh: `其它 ${alts.length} 条`, en: `${alts.length} more` })}
                </button>
              )}
              {(showPlayer || playing) ? null : (
                <button type="button" className="srs-link-btn" onClick={() => setPlaying(true)}>
                  <Play size={13} /> {tr({ zh: '演示', en: 'Animate' })}
                </button>
              )}
              <button type="button" className="srs-link-btn" onClick={() => resetCase(k)}
                title={tr({ zh: '把这张卡当没学过重新开始', en: 'Treat this card as brand new' })}>
                <RotateCcw size={13} /> {tr({ zh: '重置记忆', en: 'Reset card' })}
              </button>
            </div>

            {showAlts && alts.length > 0 && (
              <div className="srs-alts">
                {alts.map((e, i) => (
                  <div key={i} className="srs-alt">
                    {e.algHtml && puzzle !== 'sq1'
                      ? <span dangerouslySetInnerHTML={{ __html: sanitizeAlgHtml(e.algHtml) }} />
                      : <span>{e.alg}</span>}
                  </div>
                ))}
              </div>
            )}

            {(showPlayer || playing) && primary && (
              <div className="srs-player">
                <AlgPlayer alg={primary.alg} puzzle={puzzle} set={set} setup={c.setup} />
              </div>
            )}

            <div className="srs-grades">
              {GRADES.map(({ g, cls, zh, en, hint }) => (
                <button
                  key={g}
                  type="button"
                  className={`srs-grade is-${cls}`}
                  onClick={() => answer(g)}
                  title={tr(hint)}
                >
                  <span className="srs-grade-label">{tr({ zh, en })}</span>
                  <span className="srs-grade-iv">{ivLabel(previews[g])}</span>
                  <kbd>{g + 1}</kbd>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 这张卡的记忆档案:让人看得见「为什么现在轮到它」 */}
        <div className="srs-card-foot">
          <span className={`srs-phase is-${phase}`}>
            {phase === 'new' ? tr({ zh: '没练过', en: 'Never studied' })
              : phase === 'relearn' ? tr({ zh: '重学中', en: 'Relearning' })
              : phase === 'young' ? tr({ zh: `间隔 ${rec!.iv} 天`, en: `${rec!.iv}d interval` })
              : tr({ zh: `已巩固 ${rec!.iv} 天`, en: `mature · ${rec!.iv}d` })}
          </span>
          {rec && rec.n > 0 && (
            <>
              <span>{tr({ zh: `复习 ${rec.n} 次`, en: `${rec.n} reviews` })}</span>
              {rec.st > 0 && <span>{tr({ zh: `连对 ${rec.st}`, en: `${rec.st} in a row` })}</span>}
              {rec.l > 0 && <span className="srs-foot-lapse">{tr({ zh: `忘过 ${rec.l} 次`, en: `${rec.l} lapses` })}</span>}
            </>
          )}
          <span className="srs-foot-sp" />
          <button type="button" className="srs-link-btn" onClick={skip} title={tr({ zh: '跳过这张(S)', en: 'Skip (S)' })}>
            <SkipForward size={13} /> {tr({ zh: '跳过', en: 'Skip' })}
          </button>
          <button type="button" className="srs-link-btn" onClick={doUndo} disabled={!undo}
            title={tr({ zh: '撤销上一次评分(U)', en: 'Undo last grade (U)' })}>
            <Undo2 size={13} /> {tr({ zh: '撤销', en: 'Undo' })}
          </button>
        </div>
      </div>
    </div>
  );
}

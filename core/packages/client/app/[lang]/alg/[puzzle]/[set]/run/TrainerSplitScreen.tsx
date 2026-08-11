'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AlgCase, AlgPuzzle } from '@cuberoot/shared';
import { RotateCcw, X } from 'lucide-react';
import { CaseThumb } from '@/components/CaseThumb';
import { Spinner } from '@/components/Spinner/Spinner';
import { caseKey, findCaseByKey } from '@/lib/trainer-case-key';
import {
  cstimerStyleScramble,
  generateScramble,
  purifyScramble,
  type ScrambleKind,
  type TrainerScrambleOpts,
} from '@/lib/trainer-scramble';
import {
  advanceSplitLane,
  splitRoundDone,
  startSplitRound,
  type SplitLaneId,
  type SplitOrder,
} from '@/lib/trainer-split';
import { CaseMarkBar, ScrambleHeader } from '@/app/[lang]/alg/_trainer/trainer-components';
import { tr } from '@/i18n/tr';

interface SplitLaneProps {
  lane: SplitLaneId;
  c: AlgCase | null;
  puzzle: AlgPuzzle;
  set: string;
  scrambleKind: ScrambleKind;
  scrambleOpts: TrainerScrambleOpts;
  showThumb: boolean;
  pureScramble: boolean;
  scrambleFont: string;
  completed: number;
  roundDone: boolean;
  resolveCase: (c: AlgCase) => Promise<void>;
  onComplete: () => void;
}

function TrainerSplitLane({
  lane, c, puzzle, set, scrambleKind, scrambleOpts, showThumb, pureScramble,
  scrambleFont, completed, roundDone, resolveCase, onComplete,
}: SplitLaneProps) {
  const [scramble, setScramble] = useState('');
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const laneLabel = lane === 'a' ? 'A' : 'B';

  useEffect(() => {
    let cancelled = false;
    setScramble('');
    setFailed(false);
    if (!c) {
      setLoading(false);
      return () => { cancelled = true; };
    }

    setLoading(true);
    void (async () => {
      let base = generateScramble(c, puzzle, scrambleKind, scrambleOpts);
      if (!base) {
        await resolveCase(c);
        base = generateScramble(c, puzzle, scrambleKind, scrambleOpts);
      }
      if (!base) throw new Error('scramble unavailable');
      const prepared = scrambleKind === 'cstimer' && puzzle === '3x3'
        ? (await cstimerStyleScramble(base)) ?? base
        : base;
      if (!cancelled) setScramble(prepared);
    })()
      .catch(() => { if (!cancelled) setFailed(true); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [c, puzzle, scrambleKind, scrambleOpts, resolveCase, attempt]);

  const shownScramble = pureScramble ? purifyScramble(puzzle, scramble) : scramble;
  const laneSet = c?.srcSet ?? set;
  const ready = !!c && !!scramble && !loading && !failed;

  return (
    <section className={`trainer-split-lane is-${lane}`} aria-label={tr({ zh: `用户 ${laneLabel}`, en: `Player ${laneLabel}` })}>
      <button
        type="button"
        className="trainer-split-hit"
        onClick={onComplete}
        disabled={!ready}
        aria-label={tr({ zh: `用户 ${laneLabel}：下一题`, en: `Player ${laneLabel}: next case` })}
      />
      <div className="trainer-split-lane-head">
        <span className="trainer-split-person">{tr({ zh: `用户 ${laneLabel}`, en: `Player ${laneLabel}` })}</span>
        <span className="trainer-split-person-progress">
          {tr({ zh: `已完成 ${completed}`, en: `${completed} done` })}
        </span>
      </div>

      {!c ? (
        <div className="trainer-split-wait" role="status">
          <strong>{roundDone
            ? tr({ zh: '本轮完成', en: 'Round complete' })
            : tr({ zh: '这边已完成', en: 'This side is done' })}</strong>
          {!roundDone && <span>{tr({ zh: '等另一边完成剩余题目', en: 'Waiting for the other side to finish' })}</span>}
        </div>
      ) : (
        <>
          <div className="trainer-split-case">
            {loading ? (
              <div className="trainer-split-loading" role="status">
                <Spinner size={24} />
                <span>{tr({ zh: '正在准备打乱…', en: 'Preparing scramble…' })}</span>
              </div>
            ) : failed ? (
              <div className="trainer-split-loading is-error" role="status">
                <span>{tr({ zh: '打乱生成失败', en: 'Could not prepare the scramble' })}</span>
                <button type="button" className="trainer-split-retry" onClick={() => setAttempt(n => n + 1)}>
                  {tr({ zh: '重试', en: 'Try again' })}
                </button>
              </div>
            ) : (
              <>
                <div className="trainer-figure">
                  <CaseMarkBar k={caseKey(c)} />
                  {showThumb && scramble && (
                    <CaseThumb
                      puzzle={puzzle}
                      set={laneSet}
                      sticker={c.sticker}
                      alg={c.algs.flat()[0]?.alg ?? c.standard ?? ''}
                      setup={scramble}
                      size={160}
                      local
                    />
                  )}
                </div>
                <ScrambleHeader scramble={shownScramble} font={scrambleFont} />
              </>
            )}
          </div>
        </>
      )}
    </section>
  );
}

export default function TrainerSplitScreen({
  puzzle, set, cases, pool, order, scrambleKind, scrambleOpts, showThumb,
  pureScramble, scrambleFont, resolveCase, markPassedAsMastered, onExit,
}: {
  puzzle: AlgPuzzle;
  set: string;
  cases: AlgCase[];
  pool: string[];
  order: SplitOrder;
  scrambleKind: ScrambleKind;
  scrambleOpts: TrainerScrambleOpts;
  showThumb: boolean;
  pureScramble: boolean;
  scrambleFont: string;
  resolveCase: (c: AlgCase) => Promise<void>;
  markPassedAsMastered: (keys: Array<string | null | undefined>) => void;
  onExit: () => void;
}) {
  const signature = `${order}:${pool.join('\u0000')}`;
  const signatureRef = useRef(signature);
  const [round, setRound] = useState(() => startSplitRound(pool, order));
  const done = splitRoundDone(round);

  useEffect(() => {
    if (signatureRef.current === signature) return;
    signatureRef.current = signature;
    setRound(startSplitRound(pool, order));
  }, [signature, pool, order]);

  const completeLane = useCallback((lane: SplitLaneId) => {
    const key = round.lanes[lane].key;
    if (!key) return;
    markPassedAsMastered([key]);
    setRound(current => current.lanes[lane].key === key
      ? advanceSplitLane(current, lane)
      : current);
  }, [round.lanes, markPassedAsMastered]);

  const nextRound = useCallback(() => {
    setRound(current => startSplitRound(pool, order, Math.random, current.round + 1));
  }, [pool, order]);

  const laneCases = useMemo(() => ({
    a: round.lanes.a.key ? findCaseByKey(cases, round.lanes.a.key) ?? null : null,
    b: round.lanes.b.key ? findCaseByKey(cases, round.lanes.b.key) ?? null : null,
  }), [cases, round.lanes.a.key, round.lanes.b.key]);

  return (
    <div className="trainer-split" data-no-timer>
      <div className="trainer-split-shared">
        <div>
          <span className="trainer-split-kicker">{tr({ zh: '同屏协作', en: 'Shared-screen drill' })}</span>
          <strong>{tr({ zh: `第 ${round.round} 轮`, en: `Round ${round.round}` })}</strong>
        </div>
        <div className="trainer-split-meter" aria-label={tr({ zh: '分屏训练进度', en: 'Split drill progress' })}>
          <span className="trainer-split-meter-track" aria-hidden>
            <span style={{ width: `${round.total > 0 ? (round.completed / round.total) * 100 : 0}%` }} />
          </span>
          <span className="trainer-split-meter-count">{round.completed}/{round.total}</span>
        </div>
        <button type="button" className="trainer-split-exit" onClick={onExit}>
          <X size={15} /> {tr({ zh: '退出分屏', en: 'Exit split view' })}
        </button>
      </div>

      <div className="trainer-split-lanes">
        <TrainerSplitLane
          lane="a"
          c={laneCases.a}
          puzzle={puzzle}
          set={set}
          scrambleKind={scrambleKind}
          scrambleOpts={scrambleOpts}
          showThumb={showThumb}
          pureScramble={pureScramble}
          scrambleFont={scrambleFont}
          completed={round.lanes.a.completed}
          roundDone={done}
          resolveCase={resolveCase}
          onComplete={() => completeLane('a')}
        />
        <TrainerSplitLane
          lane="b"
          c={laneCases.b}
          puzzle={puzzle}
          set={set}
          scrambleKind={scrambleKind}
          scrambleOpts={scrambleOpts}
          showThumb={showThumb}
          pureScramble={pureScramble}
          scrambleFont={scrambleFont}
          completed={round.lanes.b.completed}
          roundDone={done}
          resolveCase={resolveCase}
          onComplete={() => completeLane('b')}
        />
      </div>

      {done && (
        <div className="trainer-split-finish" role="status">
          <span>{tr({ zh: `两人已完成全部 ${round.total} 个 case`, en: `Both players finished all ${round.total} cases` })}</span>
          <button type="button" className="trainer-split-next-round" onClick={nextRound}>
            <RotateCcw size={15} /> {tr({ zh: '开始下一轮', en: 'Start next round' })}
          </button>
        </div>
      )}
    </div>
  );
}

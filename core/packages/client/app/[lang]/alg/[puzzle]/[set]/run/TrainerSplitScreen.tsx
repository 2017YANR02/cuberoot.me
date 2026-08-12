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
  resizeSplitRound,
  splitRoundDone,
  startSplitRound,
  type SplitBatchSize,
  type SplitLaneId,
  type SplitOrder,
} from '@/lib/trainer-split';
import { CaseMarkBar, ScrambleHeader } from '@/app/[lang]/alg/_trainer/trainer-components';
import { tr } from '@/i18n/tr';

interface SplitLaneProps {
  lane: SplitLaneId;
  cases: AlgCase[];
  puzzle: AlgPuzzle;
  set: string;
  scrambleKind: ScrambleKind;
  scrambleOpts: TrainerScrambleOpts;
  showThumb: boolean;
  pureScramble: boolean;
  scrambleFont: string;
  grouped: boolean;
  completed: number;
  roundDone: boolean;
  resolveCase: (c: AlgCase) => Promise<void>;
  onComplete: () => void;
}

function TrainerSplitLane({
  lane, cases, puzzle, set, scrambleKind, scrambleOpts, showThumb, pureScramble,
  scrambleFont, grouped, completed, roundDone, resolveCase, onComplete,
}: SplitLaneProps) {
  const [scrambles, setScrambles] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const laneName = lane === 'a'
    ? { zh: '左侧分屏', en: 'Left split pane' }
    : { zh: '右侧分屏', en: 'Right split pane' };

  useEffect(() => {
    let cancelled = false;
    setScrambles([]);
    setFailed(false);
    if (cases.length === 0) {
      setLoading(false);
      return () => { cancelled = true; };
    }

    setLoading(true);
    void (async () => {
      const prepared = await Promise.all(cases.map(async c => {
        let base = generateScramble(c, puzzle, scrambleKind, scrambleOpts);
        if (!base) {
          await resolveCase(c);
          base = generateScramble(c, puzzle, scrambleKind, scrambleOpts);
        }
        if (!base) throw new Error('scramble unavailable');
        return scrambleKind === 'cstimer' && puzzle === '3x3'
          ? (await cstimerStyleScramble(base)) ?? base
          : base;
      }));
      if (!cancelled) setScrambles(prepared);
    })()
      .catch(() => { if (!cancelled) setFailed(true); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [cases, puzzle, scrambleKind, scrambleOpts, resolveCase, attempt]);

  const ready = cases.length > 0
    && scrambles.length === cases.length
    && scrambles.every(Boolean)
    && !loading
    && !failed;
  return (
    <section className={`trainer-split-lane is-${lane}`} aria-label={tr(laneName)}>
      <button
        type="button"
        className="trainer-split-hit"
        onClick={onComplete}
        disabled={!ready}
        aria-label={grouped
          ? tr({ zh: `${laneName.zh}：下一组`, en: `${laneName.en}: next group` })
          : tr({ zh: `${laneName.zh}：下一题`, en: `${laneName.en}: next case` })}
      />
      <div className="trainer-split-lane-head">
        <span className="trainer-split-person-progress">
          {tr({ zh: `已完成 ${completed}`, en: `${completed} done` })}
        </span>
      </div>

      {cases.length === 0 ? (
        <div className="trainer-split-wait" role="status">
          <strong>{roundDone
            ? tr({ zh: '本轮完成', en: 'Round complete' })
            : tr({ zh: '这边已完成', en: 'This side is done' })}</strong>
          {!roundDone && <span>{tr({ zh: '等另一边完成剩余题目', en: 'Waiting for the other side to finish' })}</span>}
        </div>
      ) : (
          <div className={`trainer-split-case-list${grouped ? ' is-multi' : ''}`}>
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
              cases.map((c, index) => {
                const scramble = scrambles[index] ?? '';
                const shownScramble = pureScramble ? purifyScramble(puzzle, scramble) : scramble;
                return (
                  <div className="trainer-split-case" key={caseKey(c)}>
                    {showThumb && (
                      <div className="trainer-figure">
                        <CaseMarkBar k={caseKey(c)} />
                        {scramble && (
                          <CaseThumb
                            puzzle={puzzle}
                            set={c.srcSet ?? set}
                            sticker={c.sticker}
                            alg={c.algs.flat()[0]?.alg ?? c.standard ?? ''}
                            setup={scramble}
                            size={grouped ? 104 : 160}
                            local
                          />
                        )}
                      </div>
                    )}
                    <div className="trainer-scramble-line">
                      {!showThumb && <CaseMarkBar k={caseKey(c)} />}
                      <ScrambleHeader scramble={shownScramble} font={scrambleFont} />
                    </div>
                  </div>
                );
              })
            )}
          </div>
      )}
    </section>
  );
}

export default function TrainerSplitScreen({
  puzzle, set, cases, pool, order, scrambleKind, scrambleOpts, showThumb,
  pureScramble, scrambleFont, multi, resolveCase, markPassedAsMastered, onExit,
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
  multi: boolean;
  resolveCase: (c: AlgCase) => Promise<void>;
  markPassedAsMastered: (keys: Array<string | null | undefined>) => void;
  onExit: () => void;
}) {
  const batchSize: SplitBatchSize = multi ? 3 : 1;
  const signature = `${order}:${pool.join('\u0000')}`;
  const signatureRef = useRef(signature);
  const [round, setRound] = useState(() => startSplitRound(pool, order, Math.random, 1, batchSize));
  const done = splitRoundDone(round);

  useEffect(() => {
    if (signatureRef.current === signature) return;
    signatureRef.current = signature;
    setRound(startSplitRound(pool, order, Math.random, 1, batchSize));
  }, [signature, pool, order, batchSize]);

  useEffect(() => {
    setRound(current => resizeSplitRound(current, batchSize));
  }, [batchSize]);

  const completeLane = useCallback((lane: SplitLaneId) => {
    const keys = round.lanes[lane].keys;
    if (keys.length === 0) return;
    markPassedAsMastered(keys);
    setRound(current => current.lanes[lane].keys.length === keys.length
      && current.lanes[lane].keys.every((key, index) => key === keys[index])
      ? advanceSplitLane(current, lane)
      : current);
  }, [round.lanes, markPassedAsMastered]);

  const nextRound = useCallback(() => {
    setRound(current => startSplitRound(pool, order, Math.random, current.round + 1, batchSize));
  }, [pool, order, batchSize]);

  const laneCasesA = useMemo(() => round.lanes.a.keys
      .map(key => findCaseByKey(cases, key))
      .filter((c): c is AlgCase => !!c),
  [cases, round.lanes.a.keys]);
  const laneCasesB = useMemo(() => round.lanes.b.keys
      .map(key => findCaseByKey(cases, key))
      .filter((c): c is AlgCase => !!c),
  [cases, round.lanes.b.keys]);

  return (
    <div className="trainer-split" data-no-timer>
      <div className="trainer-split-shared">
        <div>
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
          cases={laneCasesA}
          puzzle={puzzle}
          set={set}
          scrambleKind={scrambleKind}
          scrambleOpts={scrambleOpts}
          showThumb={showThumb}
          pureScramble={pureScramble}
          scrambleFont={scrambleFont}
          grouped={multi}
          completed={round.lanes.a.completed}
          roundDone={done}
          resolveCase={resolveCase}
          onComplete={() => completeLane('a')}
        />
        <TrainerSplitLane
          lane="b"
          cases={laneCasesB}
          puzzle={puzzle}
          set={set}
          scrambleKind={scrambleKind}
          scrambleOpts={scrambleOpts}
          showThumb={showThumb}
          pureScramble={pureScramble}
          scrambleFont={scrambleFont}
          grouped={multi}
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

'use client';

/**
 * /scramble/sub-solver — trangium Subsolver 移植:在限定步组内枚举 3x3 一个状态的
 * 全部解,按 MCC 升序排列。上游是原型页(prompt 输入、引擎只枚举「表尾整深」的解、
 * AUF 开关没接线);这里复用同作者成熟版 Batch Solver 的引擎(lib/batch-solver.ts,
 * golden 对拍锁定),解集完整,AUF 开关真实生效。
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import BoolToggle from '@/components/BoolToggle';
import { ParamSliders, type ParamSliderSpec } from '@/components/ParamSliders';
import AppLink from '@/components/AppLink';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useT } from '@/hooks/useT';
import { algSpeed, MCC_DEFAULTS } from '@/lib/mcc';
import { BATCH_PUZZLE_PRESETS, type BatchSolverInput, type BatchSolverMessage } from '@/lib/batch-solver';
import { createBatchSolverWorker } from '@/lib/batch-solver-client';
import './sub-solver.css';

const MOVE_ROWS: string[][] = [
  ['U', 'R', 'F', 'D', 'L', 'B'],
  ['u', 'r', 'f', 'd', 'l', 'b'],
  ['M', 'S', 'E'],
];

type DepthKey = 'prune' | 'search';
const DEPTH_SLIDERS: ParamSliderSpec<DepthKey>[] = [
  { key: 'prune', zh: '建表深度', en: 'Prune depth', min: 0, max: 10, step: 1 },
  { key: 'search', zh: '搜索深度', en: 'Search depth', min: 0, max: 12, step: 1 },
];
const DEPTH_DEFAULTS: Record<DepthKey, number> = { prune: 5, search: 6 };

const EXAMPLE = "R U R' U R U2 R'";
const MAX_ROWS = 200;

export default function SubSolverPage() {
  const t = useT();
  useDocumentTitle('子群求解器', 'Subsolver');

  const [moves, setMoves] = useState<Set<string>>(new Set(['U', 'R', 'F']));
  const [depths, setDepths] = useState<Record<DepthKey, number>>(DEPTH_DEFAULTS);
  const [ignoreAuf, setIgnoreAuf] = useState(true);
  const [scramble, setScramble] = useState('');

  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [solutions, setSolutions] = useState<string[]>([]);
  const [depth, setDepth] = useState(0);
  const [finished, setFinished] = useState(false);

  const workerRef = useRef<Worker | null>(null);
  const flushTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const bufRef = useRef<string[]>([]);
  const seenRef = useRef<Set<string>>(new Set());

  useEffect(() => () => {
    workerRef.current?.terminate();
    if (flushTimerRef.current !== null) clearInterval(flushTimerRef.current);
  }, []);

  const flush = () => {
    if (bufRef.current.length === 0) return;
    const fresh = bufRef.current;
    bufRef.current = [];
    setSolutions((prev) => [...prev, ...fresh]);
  };

  const stopSearch = () => {
    flush();
    if (flushTimerRef.current !== null) clearInterval(flushTimerRef.current);
    flushTimerRef.current = null;
    workerRef.current?.terminate();
    workerRef.current = null;
    setRunning(false);
  };

  const startSearch = () => {
    if (running) {
      stopSearch();
      return;
    }
    const alg = scramble.trim();
    if (/[[\]<>#,]/.test(alg)) {
      setError(t('这里只解单个状态;多分支 / 生成元 / # 语法请用批量求解器。', 'Subsolver handles a single state; for branches / generators / # syntax use the Batch Solver.'));
      return;
    }
    setError(null);
    setSolutions([]);
    setFinished(false);
    setDepth(0);
    seenRef.current = new Set();
    bufRef.current = [];
    setRunning(true);

    const worker = createBatchSolverWorker();
    workerRef.current = worker;
    worker.onmessage = (e: MessageEvent<BatchSolverMessage>) => {
      const msg = e.data;
      if (msg.type === 'stop') {
        if (msg.value !== null) setError(msg.value);
        setFinished(true);
        stopSearch();
      } else if (msg.type === 'solution') {
        // 同一解可能按不同「搜索段 + 表段」拆分被枚举两次,按文本去重
        if (!seenRef.current.has(msg.value)) {
          seenRef.current.add(msg.value);
          bufRef.current.push(msg.value);
        }
      } else if (msg.type === 'depthUpdate') {
        setDepth((d) => d + 1);
      } else if (msg.type === 'set-depth') {
        setDepth(msg.value);
      }
    };

    const input: BatchSolverInput = {
      puzzle: BATCH_PUZZLE_PRESETS['3x3x3'],
      ignore: '',
      solve: alg,
      preAdjust: '',
      postAdjust: '',
      subgroups: [{ subgroup: Array.from(moves).join(' '), prune: String(depths.prune), search: String(depths.search) }],
      sorting: [],
      esq: '',
      rankesq: '',
      showPost: false,
    };
    worker.postMessage(input);
    flushTimerRef.current = setInterval(flush, 150);
  };

  const rows = useMemo(() => {
    const scored = solutions.map((text) => {
      const v = algSpeed(text, false, ignoreAuf, MCC_DEFAULTS);
      return { text, mcc: typeof v === 'number' ? v : Infinity };
    });
    scored.sort((a, b) => a.mcc - b.mcc || (a.text > b.text ? 1 : a.text < b.text ? -1 : 0));
    return scored;
  }, [solutions, ignoreAuf]);

  const toggleMove = (m: string) => {
    setMoves((prev) => {
      const next = new Set(prev);
      if (next.has(m)) next.delete(m);
      else next.add(m);
      return next;
    });
  };

  return (
    <div className="ssv-page">
      <header className="ssv-header">
        <h1>{t('子群求解器', 'Subsolver')}</h1>
        <p className="ssv-lead">
          {t(
            '限定一组步,枚举 3x3 某个状态在这组步内的全部解,按 MCC 手速升序排列。整套公式集请用',
            'Pick a move group and enumerate every solution of a 3x3 state within it, ranked by MCC. For whole algsets use the',
          )}
          <AppLink href="/scramble/batch-solver">{t('批量求解器', 'Batch Solver')}</AppLink>
          {t('。', '.')}
        </p>
      </header>

      <div className="ssv-form">
        <div className="ssv-field">
          <span className="ssv-label">{t('步组(允许使用的步)', 'Move group (allowed moves)')}</span>
          <div className="ssv-moves">
            {MOVE_ROWS.map((row, i) => (
              <div key={i} className="ssv-move-row">
                {row.map((m) => (
                  <button
                    key={m}
                    type="button"
                    className={`ssv-move${moves.has(m) ? ' is-on' : ''}`}
                    aria-pressed={moves.has(m)}
                    onClick={() => toggleMove(m)}
                  >
                    {m}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>

        <ParamSliders specs={DEPTH_SLIDERS} values={depths} defaults={DEPTH_DEFAULTS} onChange={setDepths} className="ssv-depths" />
        <p className="ssv-hint">
          {t(
            '能找到的最长解 = 建表 + 搜索;状态数随建表深度指数增长,步组大时请用小深度。',
            'Longest findable solution = prune + search. Table size grows exponentially with prune depth — keep it small for big move groups.',
          )}
        </p>

        <div className="ssv-field">
          <div className="ssv-scramble-head">
            <label className="ssv-label" htmlFor="ssv-scramble">{t('状态(生成它的打乱)', 'State (a scramble that produces it)')}</label>
            {scramble === '' && (
              <button type="button" className="ssv-example" onClick={() => setScramble(EXAMPLE)}>
                {t('填入示例', 'Load example')}
              </button>
            )}
          </div>
          <input
            id="ssv-scramble"
            className="ssv-input"
            value={scramble}
            onChange={(e) => setScramble(e.target.value)}
            placeholder={EXAMPLE}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
          />
        </div>

        <div className="ssv-actions">
          <button type="button" className={`ssv-run${running ? ' is-running' : ''}`} onClick={startSearch}>
            {running ? t('停止', 'Stop') : t('求解', 'Solve')}
          </button>
          <BoolToggle value={ignoreAuf} onChange={setIgnoreAuf} label={t('测速忽略首尾 U', 'Ignore AUF in MCC')} />
          {running && <span className="ssv-progress">{t(`搜索深度 ${depth}`, `depth ${depth}`)}</span>}
        </div>

        {error && <p className="ssv-error">{error}</p>}
      </div>

      {(rows.length > 0 || finished) && !error && (
        <section className="ssv-results">
          <p className="ssv-count">
            {t(`${rows.length} 条解`, `${rows.length} solutions`)}
            {finished && rows.length === 0 && t(':无解 — 状态已还原,或深度不够 / 步组不含解。', ' — state already solved, or depths too small / group has no solution.')}
          </p>
          {rows.length > 0 && (
            <div className="ssv-table-wrap">
              <table className="ssv-table">
                <thead>
                  <tr>
                    <th className="ssv-td-num">MCC</th>
                    <th>{t('解', 'Solution')}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, MAX_ROWS).map((r) => (
                    <tr key={r.text}>
                      <td className="ssv-td-num">{Number.isFinite(r.mcc) ? r.mcc : '–'}</td>
                      <td className="ssv-td-alg">{r.text}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {rows.length > MAX_ROWS && (
                <p className="ssv-hint">{t(`只显示最快 ${MAX_ROWS} 条(共 ${rows.length});导出全量请用批量求解器。`, `Showing fastest ${MAX_ROWS} of ${rows.length}; use the Batch Solver to export everything.`)}</p>
              )}
            </div>
          )}
        </section>
      )}

      <p className="ssv-credit">
        {t('移植自 ', 'Ported from ')}
        <a href="https://github.com/trangium/trangium.github.io" target="_blank" rel="noreferrer">trangium/Subsolver</a>
        {t('(MIT),引擎与批量求解器同源。', ' (MIT), sharing the Batch Solver engine.')}
      </p>
    </div>
  );
}

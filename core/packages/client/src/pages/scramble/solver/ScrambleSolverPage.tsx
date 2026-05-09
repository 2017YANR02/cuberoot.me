/**
 * /scramble/solver — cubeopt-wasm 最优解
 *
 * Port of https://cstimer.net/cubeopt/ (cs0x7f/cubeopt-wasm) 的 UI 到 React。
 * Worker 协议保持上游 wasm-worker.js 不变(免改 wasm 部分,后续 upstream 升级零摩擦)。
 *
 * URL 参数:
 *   ?scramble=R+U+R'+...  — 预填打乱(支持多行用 \n 分隔)
 *   ?state=<54chars>      — 输入 facelet 状态,自动 kociemba 求出一个非最优 scramble 预填
 *
 * Worker 信息流(摘自上游协议):
 *   { cmd:'select solver', data:'cube48opt3' }   → load .mjs/.wasm,初始化 prun table 检查
 *   { cmd:'generate table' }                      → 在 wasm 内生成 prun table(几十秒~几分钟)
 *   { cmd:'upload table', data: File }           → 用本地 .dat 文件填 prun table(秒级)
 *   { cmd:'download table' }                      → 把已加载的 prun table 下载下来
 *   { cmd:'start solve', scramble, n_threads, n_group, debug } → 真正求解
 *   返回:{ code, cmd, ...} ; code -1 = log 行,-2 = progress; code 1 = no solver,2 = need init,0 = ok
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Loader2, Trash2, Upload, Download, Sparkles } from 'lucide-react';
import LangToggle from '../../../components/LangToggle';
import { faceletToCubie, validateFacelet, SOLVED_FACELET } from './facelet';
import {
  formatMoves,
  invertSequence,
  parseMoves,
  applySequence,
  isSolvedCubie,
  solvedCubie,
  type CubieCube,
} from '../../timer/scramble/kociemba/cube';
import KociembaWorker from '../../timer/scramble/kociemba/kociemba.worker.ts?worker';
import InteractiveCubeNet, { type FaceLetter } from '../../visualcube/InteractiveCubeNet';

interface SolverInfo {
  name: string;
  table_name: string;
  table_size: number;
}

const SOLVER_OPTIONS: { value: string; size: string }[] = [
  { value: 'cube48opt1', size: '30.4M' },
  { value: 'cube48opt2', size: '121M' },
  { value: 'cube48opt3', size: '243M' },
  { value: 'cube48opt4', size: '486M' },
  { value: 'cube48opt5', size: '972M' },
  { value: 'cube48opt6', size: '1.9G' },
  { value: 'cube48opt7', size: '3.8G' },
  { value: 'cube48opt8', size: '7.6G' },
  { value: 'cube48opt9', size: '15G' },
];

const SCR_LEN_OPTS = [15, 16, 17, 18, 19, 20, 25, 30];
const SCR_NUM_OPTS = [1, 5, 10, 20, 50, 100];

type ReadyState = 'no-solver' | 'need-init' | 'ready' | 'busy';

function randomMove(len: number): string {
  const moves: number[] = [];
  for (let i = 0; i < len; i++) {
    const m = Math.floor(Math.random() * 18);
    if (moves.length > 0 && Math.floor(m / 3) === Math.floor(moves[moves.length - 1] / 3)) {
      i--;
      continue;
    }
    if (moves.length > 1
      && Math.floor(m / 3) % 3 === Math.floor(moves[moves.length - 1] / 3) % 3
      && Math.floor(m / 3) === Math.floor(moves[moves.length - 2] / 3)) {
      i--;
      continue;
    }
    moves.push(m);
  }
  return moves.map(m => 'URFDLB'.charAt(Math.floor(m / 3)) + ['', '2', "'"][m % 3]).join(' ');
}

export default function ScrambleSolverPage() {
  const { i18n } = useTranslation();
  const isZh = i18n.language === 'zh';
  const t = (zh: string, en: string) => (isZh ? zh : en);

  const [searchParams] = useSearchParams();

  const [solverName, setSolverName] = useState('cube48opt3');
  const [solverInfo, setSolverInfo] = useState<SolverInfo | null>(null);
  const [readyState, setReadyState] = useState<ReadyState>('no-solver');
  const [progress, setProgress] = useState(-1);
  const [logs, setLogs] = useState('');
  const [scrambles, setScrambles] = useState('');
  const [scrLen, setScrLen] = useState(15);
  const [scrNum, setScrNum] = useState(10);
  const [nThreads, setNThreads] = useState(() =>
    typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 4 : 4,
  );
  const [nGroup, setNGroup] = useState(1);
  const [stateInfo, setStateInfo] = useState<string | null>(null);
  // 内置 net 填色编辑器 — 折叠在按钮后,点开才显示
  const [showPaint, setShowPaint] = useState(false);
  const [paintFacelet, setPaintFacelet] = useState(SOLVED_FACELET);
  const [paintColor, setPaintColor] = useState<FaceLetter>('U');
  // 用户点 Solve 时若 prun 表还没就绪,记下这个意图,等表 ready 后自动接着 solve
  const pendingSolveRef = useRef(false);
  // 生成表后自动下载到本地;下次访问可 Upload 秒级跳过几十秒生成
  const [autoDownloadTable, setAutoDownloadTable] = useState(() => {
    const v = localStorage.getItem('cubeopt.autoDownload');
    return v === null ? true : v === '1';
  });
  useEffect(() => { localStorage.setItem('cubeopt.autoDownload', autoDownloadTable ? '1' : '0'); }, [autoDownloadTable]);
  // 标记当前 ready 是 generate 刚完成 → 触发自动下载(避免 Upload 完成时也触发)
  const justGeneratedRef = useRef(false);

  const workerRef = useRef<Worker | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const logsRef = useRef<HTMLTextAreaElement | null>(null);

  const sabAvailable = useMemo(
    () => typeof window !== 'undefined' && typeof SharedArrayBuffer !== 'undefined' && window.crossOriginIsolated,
    [],
  );

  // Kociemba 子 worker(只在 ?state= 时按需开)
  const kociembaRef = useRef<Worker | null>(null);

  // URL 预填 — scramble 直接进 textarea;state → kociemba 求解 → 反向 → 填入
  useEffect(() => {
    const scrParam = searchParams.get('scramble');
    if (scrParam) {
      setScrambles(scrParam.replace(/\+/g, ' ').replace(/_/g, ' ').replace(/\\n/g, '\n').replace(/\|/g, '\n').trim());
    }
    const stateParam = searchParams.get('state');
    if (stateParam) {
      runKociembaForState(stateParam).catch((e: Error) => {
        setStateInfo(t(`从状态求解失败:${e.message}`, `Solve from state failed: ${e.message}`));
      });
    }
    return () => { kociembaRef.current?.terminate(); kociembaRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function runKociembaForState(facelet: string) {
    const errMsg = validateFacelet(facelet);
    if (errMsg) {
      setStateInfo(t(`非法状态:${errMsg}`, `Invalid state: ${errMsg}`));
      return;
    }
    setStateInfo(t('状态合法,Kociemba 求解中…', 'State valid, solving with Kociemba…'));
    const state = faceletToCubie(facelet);
    if (isSolvedCubie(state)) {
      setStateInfo(t('状态已是还原态,无需打乱。', 'State is already solved.'));
      setScrambles('');
      return;
    }
    if (!kociembaRef.current) kociembaRef.current = new KociembaWorker();
    const w = kociembaRef.current;
    const id = Date.now();
    const sol: string = await new Promise((resolve, reject) => {
      const onMsg = (ev: MessageEvent) => {
        if (ev.data?.id !== id) return;
        w.removeEventListener('message', onMsg);
        if (ev.data.ok && typeof ev.data.sol === 'string') resolve(ev.data.sol);
        else reject(new Error(ev.data.err || 'kociemba failed'));
      };
      w.addEventListener('message', onMsg);
      w.postMessage({ id, op: 'solve', state });
    });
    setScrambles(sol);
    setStateInfo(t(
      `Kociemba 求出 ${sol.split(/\s+/).length} 步打乱(非最优)。点击 Solve 求最优解。`,
      `Kociemba scramble: ${sol.split(/\s+/).length} moves (non-optimal). Click Solve for optimal.`,
    ));
  }

  // 一次性创建 worker + 选默认 solver
  useEffect(() => {
    const w = new Worker('/cubeopt/wasm-worker.js');
    workerRef.current = w;
    w.onmessage = (e) => {
      const d = e.data;
      if (d.code === -1) {
        const line = String(d.data ?? '').trim();
        setLogs((prev) => prev + line + '\n');
        const m = /handled (\d+)%,/.exec(line);
        if (m) setProgress(parseInt(m[1], 10) / 100);
        return;
      }
      if (d.code === -2) {
        setProgress(typeof d.data === 'number' ? d.data : -1);
        return;
      }

      if (d.cmd === 'select solver') {
        if (d.code === 1) {
          setReadyState('no-solver');
          setSolverInfo(null);
        } else {
          setSolverInfo({
            name: d.solver,
            table_name: d.table_name,
            table_size: Number(d.table_size),
          });
          setReadyState(d.code === 0 ? 'ready' : 'need-init');
        }
      } else if (d.cmd === 'generate table') {
        if (d.code === 0) justGeneratedRef.current = true;
        setReadyState(d.code === 0 ? 'ready' : 'need-init');
        setProgress(-1);
      } else if (d.cmd === 'upload table') {
        if (d.code !== 0) {
          alert(t('文件大小不匹配,请用对应 .dat', 'Wrong file size — use the matching .dat'));
          setReadyState('need-init');
        } else {
          setReadyState('ready');
        }
        setProgress(-1);
      } else if (d.cmd === 'start solve') {
        setReadyState('ready');
        setProgress(-1);
      } else if (d.cmd === 'download table') {
        if (d.code === 0) {
          const blob = new Blob([new Uint8Array(d.data)], { type: 'application/octet-stream' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = solverInfo?.table_name || 'cubeopt-table.dat';
          a.click();
          URL.revokeObjectURL(url);
        }
        setReadyState('ready');
      }
    };
    w.postMessage({ cmd: 'select solver', data: solverName });
    return () => {
      w.terminate();
      workerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 切换 solver
  useEffect(() => {
    if (!workerRef.current) return;
    setReadyState('busy');
    setLogs('');
    setProgress(-1);
    pendingSolveRef.current = false;  // 切 solver 取消任何 pending solve
    workerRef.current.postMessage({ cmd: 'select solver', data: solverName });
  }, [solverName]);

  // n_group 必须整除 n_threads
  useEffect(() => {
    if (nThreads % nGroup !== 0) {
      setNGroup(1);
    }
  }, [nThreads, nGroup]);

  // 自动滚动 logs 底部
  useEffect(() => {
    if (logsRef.current) logsRef.current.scrollTop = logsRef.current.scrollHeight;
  }, [logs]);

  const generateTable = () => {
    if (readyState !== 'need-init') return;
    setReadyState('busy');
    setLogs('');
    workerRef.current?.postMessage({ cmd: 'generate table' });
  };
  const downloadTable = () => {
    if (readyState !== 'ready') return;
    setReadyState('busy');
    workerRef.current?.postMessage({ cmd: 'download table' });
  };
  const onUploadClick = () => fileInputRef.current?.click();
  const onUploadFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.name !== solverInfo?.table_name) {
      alert(t(`文件名应为 ${solverInfo?.table_name}`, `Expected ${solverInfo?.table_name}`));
      e.target.value = '';
      return;
    }
    setReadyState('busy');
    setProgress(0);
    workerRef.current?.postMessage({ cmd: 'upload table', data: file });
    e.target.value = '';
  };

  const doSolveNow = () => {
    const cleaned = scrambles
      .split('\n').map(s => s.trim()).filter(s => s.length > 0).join('\n');
    if (!cleaned) { alert(t('打乱不能为空', 'No scrambles')); return; }
    setScrambles(cleaned);
    setReadyState('busy');
    setLogs('');
    workerRef.current?.postMessage({
      cmd: 'start solve',
      scramble: cleaned,
      n_threads: nThreads,
      n_group: nGroup,
      debug: 1,
    });
  };

  const startSolve = () => {
    if (readyState === 'ready') {
      doSolveNow();
      return;
    }
    if (readyState === 'need-init') {
      // prun 表还没生成 — 自动 generate-then-solve
      const cleaned = scrambles.split('\n').map(s => s.trim()).filter(Boolean).join('\n');
      if (!cleaned) { alert(t('打乱不能为空', 'No scrambles')); return; }
      pendingSolveRef.current = true;
      generateTable();
    }
  };

  // 状态走到 ready 时:
  //   1) 如果是 generate 刚结束 + 用户开了自动下载 → 触发下载
  //   2) 否则若有 pending solve(级联自 Solve 按钮) → 跑 solve
  useEffect(() => {
    if (readyState !== 'ready') return;
    if (justGeneratedRef.current && autoDownloadTable) {
      justGeneratedRef.current = false;
      // 让 React 把 state 落地后再发 download(避免 readyState 与 worker 并发)
      const id = setTimeout(() => downloadTable(), 0);
      return () => clearTimeout(id);
    }
    justGeneratedRef.current = false;
    if (pendingSolveRef.current) {
      pendingSolveRef.current = false;
      doSolveNow();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readyState]);

  const genRandom = () => {
    const out: string[] = [];
    for (let i = 0; i < scrNum; i++) out.push(randomMove(scrLen));
    setScrambles(out.join('\n'));
  };

  const inverseScrambles = () => {
    // 把 textarea 里每行 alg 反向 — 用户从 cubedb 复制的 solution 想直接当 scramble
    const lines = scrambles.split('\n').map(s => s.trim()).filter(Boolean);
    const out = lines.map(line => {
      try {
        return formatMoves(invertSequence(parseMoves(line)));
      } catch {
        return line;
      }
    });
    setScrambles(out.join('\n'));
  };

  // n_group 有效选项 = nThreads 的所有约数
  const nGroupOptions = useMemo(() => {
    const out: number[] = [];
    for (let i = 1; i <= nThreads; i++) if (nThreads % i === 0) out.push(i);
    return out;
  }, [nThreads]);

  const stateOk = (() => {
    // 只是粗校验:每行非空且全是合法 move token
    const lines = scrambles.split('\n').map(s => s.trim()).filter(Boolean);
    if (lines.length === 0) return false;
    return lines.every(line => {
      try {
        const moves = parseMoves(line);
        const cube: CubieCube = applySequence(solvedCubie(), moves);
        return !!cube;
      } catch { return false; }
    });
  })();

  return (
    <div className="cubeopt-page">
      <style>{INLINE_CSS}</style>
      <header className="cubeopt-header">
        <h1>{t('最优解 (cubeopt)', 'Optimal Solver (cubeopt)')}</h1>
        <LangToggle variant="inline" />
      </header>
      <p className="cubeopt-lead">
        {t(
          '复刻 cs0x7f/cubeopt-wasm: 给定打乱(或状态),用 cube48opt 系列 wasm 求 HTM 最少步解。',
          'A React port of cs0x7f/cubeopt-wasm. Given a scramble (or state), find the optimal HTM solution.',
        )}
      </p>

      {!sabAvailable && (
        <div className="cubeopt-warn">
          {t(
            '当前页面没有 SharedArrayBuffer/COI,wasm 多线程跑不起来。如果是首次访问,刷新页面让 service worker 注入 COOP/COEP。',
            'SharedArrayBuffer / cross-origin isolation not active — multithreaded wasm wont run. On first visit, reload after the service worker installs.',
          )}
        </div>
      )}

      {stateInfo && <div className="cubeopt-info">{stateInfo}</div>}

      <section className="cubeopt-card">
        <div className="row">
          <span className="lbl">Solver</span>
          <select className="ctl" value={solverName} disabled={readyState === 'busy'}
            onChange={(e) => setSolverName(e.target.value)}>
            {SOLVER_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>
                {o.value} ({o.size})
              </option>
            ))}
          </select>
          <span className="size-badge">{SOLVER_OPTIONS.find(o => o.value === solverName)?.size}</span>
        </div>
        <div className="row">
          <span className="lbl">{t('Prun 表', 'Prun Table')}</span>
          <span className="table-name">{solverInfo?.table_name ?? t('未就绪', 'Not Ready')}</span>
          <label className="auto-dl">
            <input type="checkbox" checked={autoDownloadTable} onChange={(e) => setAutoDownloadTable(e.target.checked)} />
            <span>{t('生成后自动下载', 'Auto-download after gen')}</span>
          </label>
          {readyState === 'need-init' && (
            <>
              <button className="btn" onClick={generateTable}>{t('生成表', 'Generate Table')}</button>
              <button className="btn" onClick={onUploadClick}><Upload size={14} /> {t('上传表', 'Upload Table')}</button>
            </>
          )}
          {readyState === 'ready' && (
            <button className="btn" onClick={downloadTable}><Download size={14} /> {t('下载表', 'Download Table')}</button>
          )}
          {readyState === 'busy' && <span className="busy-marker"><Loader2 size={14} className="spinning" /> {t('忙', 'busy')}…</span>}
          <input ref={fileInputRef} type="file" style={{ display: 'none' }} onChange={onUploadFile} />
        </div>
        {progress >= 0 && (
          <div className="progress">
            <div className="progress-bar" style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
        )}
      </section>

      <section className="cubeopt-card">
        <div className="row paint-toggle-row">
          <span className="lbl">{t('从状态', 'From state')}</span>
          <button
            className={`btn${showPaint ? ' is-active' : ''}`}
            onClick={() => setShowPaint(v => !v)}
            title={t('画一个魔方状态,自动求出对应打乱', 'Paint a cube state, auto-derive a scramble')}
          >
            {showPaint ? t('收起', 'Hide') : t('展开填色', 'Open paint')}
          </button>
          <span className="paint-hint">
            {t(
              '点击格子 → 上色 → "求 scramble" → 自动填到下面打乱框,再点 Solve 求最优。',
              'Click stickers → paint → "Derive scramble" → fills the box below, then Solve for optimal.',
            )}
          </span>
        </div>
        {showPaint && (
          <div className="paint-wrap">
            <InteractiveCubeNet
              facelet={paintFacelet}
              onChange={setPaintFacelet}
              activeColor={paintColor}
              onActiveColorChange={setPaintColor}
              pixelSize={360}
              solveLabel={{ zh: '求 scramble', en: 'Derive scramble' }}
              onSolve={(fc) => {
                runKociembaForState(fc).catch((e: Error) => {
                  setStateInfo(t(`从状态求解失败:${e.message}`, `Solve from state failed: ${e.message}`));
                });
              }}
            />
          </div>
        )}
      </section>

      <section className="cubeopt-card">
        <div className="row">
          <span className="lbl">{t('随机', 'Random')}</span>
          <select className="ctl-sm" value={scrLen} onChange={(e) => setScrLen(parseInt(e.target.value, 10))}>
            {SCR_LEN_OPTS.map(n => <option key={n} value={n}>{n} {t('步', 'moves')}</option>)}
          </select>
          <select className="ctl-sm" value={scrNum} onChange={(e) => setScrNum(parseInt(e.target.value, 10))}>
            {SCR_NUM_OPTS.map(n => <option key={n} value={n}>{n} {t('个', 'cubes')}</option>)}
          </select>
          <button className="btn" onClick={genRandom}>{t('生成', 'Random')}</button>
          <button className="btn-icon" onClick={inverseScrambles} title={t('每行反向', 'Invert each line')}>
            <Sparkles size={14} />
          </button>
          <button className="btn-icon" onClick={() => setScrambles('')} title="Clear">
            <Trash2 size={14} />
          </button>
        </div>
        <textarea
          className="scramble-area"
          rows={5}
          placeholder="R U R' U' R' F R2 U' R' U' R U R' F'"
          value={scrambles}
          onChange={(e) => setScrambles(e.target.value)}
        />
        <div className="row">
          <span className="lbl">{t('线程', 'Threads')}</span>
          <select className="ctl-sm" value={nThreads} onChange={(e) => setNThreads(parseInt(e.target.value, 10))}>
            {Array.from({ length: navigator.hardwareConcurrency || 4 }, (_, i) => i + 1).map(n => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
          <span className="lbl">{t('并发块', 'Concurrent')}</span>
          <select className="ctl-sm" value={nGroup} onChange={(e) => setNGroup(parseInt(e.target.value, 10))}>
            {nGroupOptions.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
          <button
            className="btn-primary"
            disabled={readyState === 'busy' || readyState === 'no-solver' || !stateOk}
            onClick={startSolve}
            title={readyState === 'need-init' ? t(
              '会先自动生成 prun 表(几十秒)再求解',
              'Will auto-generate the prun table (tens of seconds) then solve',
            ) : undefined}
          >
            {readyState === 'busy'
              ? <><Loader2 size={14} className="spinning" /> {t('求解中', 'Solving')}…</>
              : readyState === 'need-init'
              ? <><Sparkles size={14} /> {t('生成表+求解', 'Gen Table + Solve')}</>
              : <>Solve</>}
          </button>
        </div>
      </section>

      <section className="cubeopt-card">
        <div className="row">
          <span className="lbl">Logs</span>
          <button className="btn-icon" onClick={() => setLogs('')} title="Clear logs">
            <Trash2 size={14} />
          </button>
        </div>
        <textarea ref={logsRef} className="logs-area" rows={10} value={logs} readOnly />
      </section>

      <p className="cubeopt-foot">
        Inspired by <a href="https://github.com/cs0x7f/cubeopt-wasm" target="_blank" rel="noopener noreferrer">cs0x7f/cubeopt-wasm</a> (BSD-3),
        original demo at <a href="https://cstimer.net/cubeopt/" target="_blank" rel="noopener noreferrer">cstimer.net/cubeopt</a>.
      </p>
    </div>
  );
}

const INLINE_CSS = `
.cubeopt-page {
  max-width: 920px;
  margin: 0 auto;
  padding: 1.25rem 1rem 3rem;
  color: var(--text);
}
.cubeopt-header {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 0.25rem;
}
.cubeopt-header h1 { margin: 0; font-size: 1.6rem; font-weight: 600; }
.cubeopt-lead { color: var(--text-muted, #aaa); margin: 0 0 1rem; line-height: 1.55; }
.cubeopt-warn {
  background: #3a2912; border: 1px solid #ff8800; color: #ffcc88;
  padding: 0.5rem 0.75rem; border-radius: 6px; margin-bottom: 0.75rem;
  font-size: 0.9rem;
}
.cubeopt-info {
  background: #18242a; border: 1px solid #2b6a8a; color: #88d4ff;
  padding: 0.5rem 0.75rem; border-radius: 6px; margin-bottom: 0.75rem;
  font-size: 0.9rem;
}
.cubeopt-card {
  background: var(--panel, #1a1a1a);
  border: 1px solid var(--border, #333);
  border-radius: 8px;
  padding: 0.75rem 0.75rem 0.5rem;
  margin-bottom: 0.75rem;
}
.row {
  display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem;
  margin-bottom: 0.5rem;
}
.lbl {
  min-width: 5rem; font-size: 0.85rem; color: var(--text-muted, #999);
}
.ctl, .ctl-sm {
  background: var(--panel-sub, #2a2a2a); border: 1px solid var(--border, #444);
  color: var(--text); padding: 0.3rem 0.5rem; border-radius: 5px; font-size: 0.9rem;
}
.ctl { flex: 1; min-width: 12rem; }
.ctl-sm { min-width: 6rem; }
.size-badge {
  background: var(--panel-sub, #2a2a2a); padding: 0.3rem 0.6rem;
  border-radius: 5px; font-size: 0.85rem; color: var(--text-muted, #aaa);
  border: 1px solid var(--border, #444);
}
.table-name {
  font-family: ui-monospace, Menlo, Consolas, monospace;
  font-size: 0.85rem; color: var(--text-muted, #aaa);
  flex: 1; min-width: 8rem;
}
.btn, .btn-primary, .btn-icon {
  background: var(--panel-sub, #2a2a2a); border: 1px solid var(--border, #444);
  color: var(--text); padding: 0.35rem 0.7rem; border-radius: 5px; font-size: 0.85rem;
  cursor: pointer; display: inline-flex; align-items: center; gap: 0.35rem;
  transition: border-color 0.12s ease;
}
.btn:hover, .btn-primary:hover, .btn-icon:hover { border-color: var(--accent, #ff8800); }
.btn-primary {
  background: var(--accent, #ff8800); color: #000; border-color: var(--accent, #ff8800);
  font-weight: 600;
}
.btn-primary:disabled, .btn:disabled {
  opacity: 0.45; cursor: not-allowed;
}
.btn-icon { padding: 0.35rem 0.45rem; }
.busy-marker {
  display: inline-flex; align-items: center; gap: 0.35rem;
  color: var(--text-muted, #aaa); font-size: 0.85rem;
}
.spinning { animation: spin 1s linear infinite; }
@keyframes spin { from { transform: rotate(0); } to { transform: rotate(360deg); } }
.progress {
  height: 6px; background: var(--panel-sub, #2a2a2a); border-radius: 3px;
  margin: 0.5rem 0; overflow: hidden;
}
.progress-bar {
  height: 100%; background: var(--accent, #ff8800);
  transition: width 0.2s ease;
}
.scramble-area, .logs-area {
  width: 100%; box-sizing: border-box;
  background: var(--panel-sub, #1c1c1c); border: 1px solid var(--border, #444);
  color: var(--text); padding: 0.5rem; border-radius: 5px;
  font-family: ui-monospace, Menlo, Consolas, monospace;
  font-size: 0.85rem; resize: vertical;
}
.logs-area { white-space: pre; overflow-x: auto; }
.cubeopt-foot {
  margin-top: 1rem; color: var(--text-muted, #888); font-size: 0.8rem;
}
.cubeopt-foot a { color: var(--accent, #ff8800); }
.paint-toggle-row { gap: 0.5rem; }
.paint-toggle-row .btn.is-active { border-color: var(--accent, #ff8800); }
.paint-hint {
  flex: 1; min-width: 12rem;
  font-size: 0.8rem; color: var(--text-muted, #888);
  line-height: 1.4;
}
.paint-wrap {
  margin-top: 0.5rem; padding-top: 0.5rem;
  border-top: 1px dashed var(--border, #333);
  display: flex; justify-content: center;
}
.auto-dl {
  display: inline-flex; align-items: center; gap: 0.35rem;
  font-size: 0.8rem; color: var(--text-muted, #aaa); cursor: pointer;
  user-select: none;
}
.auto-dl input { margin: 0; cursor: pointer; }
@media (max-width: 480px) {
  .cubeopt-header h1 { font-size: 1.3rem; }
  .lbl { min-width: 4rem; }
  .ctl { min-width: 8rem; }
}
`;

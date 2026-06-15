'use client';

/**
 * /scramble/solver — cubeopt-wasm 最优解 (Next.js 16 port).
 *
 * Ported from packages/client-vite/src/pages/scramble/solver/ScrambleSolverPage.tsx.
 *
 * Changes vs the Vite original:
 *   - react-router useSearchParams → next/navigation useSearchParams (wrapped in <Suspense>).
 *   - Vite `?worker` import → `new Worker(new URL('./_kociemba/kociemba.worker.ts', import.meta.url), { type: 'module' })`.
 *   - Kociemba helpers + facelet validation copied into ./_kociemba/ and ./facelet.ts so this
 *     page doesn't depend on /timer/* (owned by a different subagent).
 *   - InteractiveCubeNet + CubingPreview vendored as ./_InteractiveCubeNet.tsx and
 *     ./_CubingPreview2D.tsx (smaller versions sufficient for 3x3 solver).
 *   - cubeopt-wasm assets live verbatim at /public/cubeopt/ (wasm-worker.js + cube48opt[1-9].{mjs,wasm}).
 *     COOP/COEP headers are set globally by next.config.ts so SharedArrayBuffer / crossOriginIsolated
 *     is active automatically — no service worker needed.
 */

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { Loader2, Trash2, Upload, Download, Sparkles, X, Eye, EyeOff, ChevronDown, ChevronRight } from 'lucide-react';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { apiUrl } from '@/lib/api-base';
import { authHeaders } from '@/lib/admin-api';
import { useAuthStore } from '@/lib/auth-store';
import CubingPreview2D from './_CubingPreview2D';
import { faceletToCubie, validateFacelet } from './facelet';
import {
  formatMoves,
  invertSequence,
  parseMoves,
  applySequence,
  isSolvedCubie,
  solvedCubie,
  type CubieCube,
} from './_kociemba/cube';
import InteractiveCubeNet, { EMPTY_FACELET, type PaintColor } from './_InteractiveCubeNet';
import i18n from "@/i18n/i18n-client";
import { useT } from "@/hooks/useT";
import SolveTabs from "../_components/SolveTabs";

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

function spawnKociembaWorker(): Worker {
  return new Worker(new URL('./_kociemba/kociemba.worker.ts', import.meta.url), { type: 'module' });
}

function ScrambleSolverPageInner() {
  const { i18n } = useTranslation();
  useDocumentTitle('求解器', 'Solver');
  const t = useT();

  const searchParams = useSearchParams();

  // mounted flag: anything reading localStorage / navigator must wait until after
  // first client render to avoid SSR/CSR hydration mismatch.
  const [mounted, setMounted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [solverName, setSolverName] = useState('cube48opt3');
  useEffect(() => {
    setMounted(true);
    if (typeof navigator === 'undefined') return;
    const mobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
      || navigator.maxTouchPoints > 1
      || (typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches);
    setIsMobile(mobile);
    if (mobile) setSolverName('cube48opt1');
  }, []);

  const [solverInfo, setSolverInfo] = useState<SolverInfo | null>(null);
  const [readyState, setReadyState] = useState<ReadyState>('no-solver');
  const [workerError, setWorkerError] = useState<string | null>(null);
  const [progress, setProgress] = useState(-1);
  const [logs, setLogs] = useState('');
  const [scrambles, setScrambles] = useState('');
  const [scrLen, setScrLen] = useState(15);
  const [scrNum, setScrNum] = useState(10);
  const [nThreads, setNThreads] = useState(4);
  useEffect(() => {
    if (typeof navigator !== 'undefined' && navigator.hardwareConcurrency) {
      setNThreads(navigator.hardwareConcurrency);
    }
  }, []);
  const [nGroup, setNGroup] = useState(1);
  const pendingSolutionsRef = useRef<string[]>([]);
  const [solveResults, setSolveResults] = useState<Map<number, string>>(new Map());
  const solveResultsRef = useRef<Map<number, string>>(new Map());
  const [stateInfo, setStateInfo] = useState<string | null>(null);
  const [paintFacelet, setPaintFacelet] = useState(EMPTY_FACELET);
  const [paintColor, setPaintColor] = useState<PaintColor>('U');
  const [paintCanvasSize, setPaintCanvasSize] = useState(360);
  useEffect(() => {
    const upd = () => setPaintCanvasSize(Math.min(360, Math.max(200, window.innerWidth - 64)));
    upd();
    window.addEventListener('resize', upd);
    return () => window.removeEventListener('resize', upd);
  }, []);
  const [showScramblePreview, setShowScramblePreview] = useState(true);
  const pendingSolveRef = useRef(false);
  const [autoDownloadTable, setAutoDownloadTable] = useState(true);
  // Optional save folder (File System Access API). When set, generated tables
  // are written straight into it instead of the browser's default Downloads.
  const saveDirRef = useRef<FileSystemDirectoryHandle | null>(null);
  const [saveDirName, setSaveDirName] = useState<string | null>(null);
  const justGeneratedRef = useRef(false);
  const [showLogs, setShowLogs] = useState(false);
  type InputMode = 'paint' | 'random' | 'paste';
  const [inputMode, setInputMode] = useState<InputMode>('paint');
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Solve source: 'local' = download/generate the prun table in-browser (current
  // behaviour), 'cloud' = POST scrambles to api.cuberoot.me which solves with the
  // server-side opt6 table (no download, login-gated). Same optimal solution.
  const [solveSource, setSolveSource] = useState<'local' | 'cloud'>('local');
  const [cloudBusy, setCloudBusy] = useState(false);
  const [cloudStatus, setCloudStatus] = useState<string | null>(null);
  const cloudAbortRef = useRef<AbortController | null>(null);
  // Live ticking elapsed of the current cloud phase (load / solve), 0.1s cadence.
  const [cloudLiveMs, setCloudLiveMs] = useState(0);
  const cloudPhaseStartRef = useRef(0);
  const cloudTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const user = useAuthStore((s) => s.user);
  const login = useAuthStore((s) => s.login);
  // Tidy the live timer if we unmount mid-solve.
  useEffect(() => () => { if (cloudTimerRef.current) clearInterval(cloudTimerRef.current); }, []);

  // Read all localStorage-backed prefs post-mount; persist on change.
  useEffect(() => {
    try {
      const sp = localStorage.getItem('cubeopt.showPreview');
      if (sp !== null) setShowScramblePreview(sp === '1');
      const ad = localStorage.getItem('cubeopt.autoDownload');
      if (ad !== null) setAutoDownloadTable(ad === '1');
      const sl = localStorage.getItem('cubeopt.showLogs');
      if (sl !== null) setShowLogs(sl === '1');
      const im = localStorage.getItem('cubeopt.inputMode');
      if (im === 'random' || im === 'paste') setInputMode(im);
      const sa = localStorage.getItem('cubeopt.showAdvanced');
      if (sa !== null) setShowAdvanced(sa === '1');
      const src = localStorage.getItem('cubeopt.solveSource');
      if (src === 'cloud' || src === 'local') setSolveSource(src);
    } catch { /* corrupt entries */ }
  }, []);
  useEffect(() => { if (mounted) try { localStorage.setItem('cubeopt.showPreview', showScramblePreview ? '1' : '0'); } catch { /* */ } }, [mounted, showScramblePreview]);
  useEffect(() => { if (mounted) try { localStorage.setItem('cubeopt.autoDownload', autoDownloadTable ? '1' : '0'); } catch { /* */ } }, [mounted, autoDownloadTable]);
  useEffect(() => { if (mounted) try { localStorage.setItem('cubeopt.showLogs', showLogs ? '1' : '0'); } catch { /* */ } }, [mounted, showLogs]);
  useEffect(() => { if (mounted) try { localStorage.setItem('cubeopt.inputMode', inputMode); } catch { /* */ } }, [mounted, inputMode]);
  useEffect(() => { if (mounted) try { localStorage.setItem('cubeopt.showAdvanced', showAdvanced ? '1' : '0'); } catch { /* */ } }, [mounted, showAdvanced]);
  useEffect(() => { if (mounted) try { localStorage.setItem('cubeopt.solveSource', solveSource); } catch { /* */ } }, [mounted, solveSource]);

  const workerRef = useRef<Worker | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const logsRef = useRef<HTMLTextAreaElement | null>(null);
  const solverInfoRef = useRef<SolverInfo | null>(null);

  // Only meaningful after mount; pre-mount we render the "warn missing" branch
  // for both server and client to keep hydration deterministic.
  const sabAvailable = mounted
    && typeof window !== 'undefined'
    && typeof SharedArrayBuffer !== 'undefined'
    && window.crossOriginIsolated;

  const kociembaRef = useRef<Worker | null>(null);
  const [kociembaBusy, setKociembaBusy] = useState(false);
  const kociembaCancelRef = useRef<(() => void) | null>(null);

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
    const state = faceletToCubie(facelet);
    if (isSolvedCubie(state)) {
      setStateInfo(t('状态已是还原态,无需打乱。', 'State is already solved.'));
      setScrambles('');
      return;
    }
    setStateInfo(t('状态合法,Kociemba 求解中(首次需 ~3s 建表)…', 'State valid, solving with Kociemba (first call needs ~3s to build tables)…'));
    setKociembaBusy(true);
    if (!kociembaRef.current) kociembaRef.current = spawnKociembaWorker();
    const w = kociembaRef.current;
    const id = Date.now();
    try {
      const sol: string = await new Promise((resolve, reject) => {
        const TIMEOUT = 30_000;
        let tid: ReturnType<typeof setTimeout> | null = null;
        const cleanup = () => {
          if (tid) clearTimeout(tid);
          w.removeEventListener('message', onMsg);
          kociembaCancelRef.current = null;
        };
        const onMsg = (ev: MessageEvent) => {
          if (ev.data?.id !== id) return;
          cleanup();
          if (ev.data.ok && typeof ev.data.sol === 'string') resolve(ev.data.sol);
          else reject(new Error(ev.data.err || 'kociemba failed'));
        };
        w.addEventListener('message', onMsg);
        kociembaCancelRef.current = () => {
          cleanup();
          w.terminate();
          kociembaRef.current = null;
          reject(new Error('cancelled'));
        };
        tid = setTimeout(() => {
          cleanup();
          w.terminate();
          kociembaRef.current = null;
          reject(new Error('timeout — 状态可能不可解'));
        }, TIMEOUT);
        w.postMessage({ id, op: 'solve', state });
      });
      setScrambles(sol);
      setStateInfo(t(
        `Kociemba 求出 ${sol.split(/\s+/).length} 步打乱(非最优)。点击 Solve 求最优解。`,
        `Kociemba scramble: ${sol.split(/\s+/).length} moves (non-optimal). Click Solve for optimal.`
      ));
    } finally {
      setKociembaBusy(false);
    }
  }

  const cancelKociemba = () => {
    kociembaCancelRef.current?.();
    setKociembaBusy(false);
    setStateInfo(t('已取消。', 'Cancelled.'));
  };

  const bindCubeoptWorker = (w: Worker) => {
    // A worker (or its emscripten pthread workers) failing to load fires here
    // with an opaque event. Without this handler the page would sit on 'busy'
    // forever (the upstream worker's select-solver promise never resolves).
    // Most common cause: COEP header missing on the worker script — see
    // next.config.ts headers().
    w.onerror = () => {
      setWorkerError(t(
        'Solver worker 加载失败(多线程 wasm 起不来)。请刷新页面重试;若反复出现请反馈。',
        'Solver worker failed to load (multithreaded wasm could not start). Reload the page; report if it persists.'
      ));
      setReadyState('no-solver');
      setProgress(-1);
    };
    w.onmessage = (e) => {
      setWorkerError(null);
      const d = e.data;
      if (d.code === -1) {
        const line = String(d.data ?? '').trim();
        setLogs((prev) => prev + line + '\n');
        const m = /handled (\d+)%,/.exec(line);
        if (m) setProgress(parseInt(m[1], 10) / 100);
        const solMatch = /^Solution found!:\s*(.+)$/i.exec(line);
        if (solMatch) {
          const alg = solMatch[1].trim().replace(/\s+/g, ' ');
          pendingSolutionsRef.current.push(alg);
          return;
        }
        const finMatch = /^Cube(\d+)\s+finished\s+in\s/i.exec(line);
        if (finMatch) {
          const idx = parseInt(finMatch[1], 10);
          const alg = pendingSolutionsRef.current.shift();
          if (alg !== undefined) {
            solveResultsRef.current.set(idx, alg);
            setSolveResults(new Map(solveResultsRef.current));
          }
        }
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
          solverInfoRef.current = null;
        } else {
          const info: SolverInfo = {
            name: d.solver,
            table_name: d.table_name,
            table_size: Number(d.table_size),
          };
          setSolverInfo(info);
          solverInfoRef.current = info;
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
        if (d.code === 0) saveTableBytes(d.data as ArrayBuffer);
        setReadyState('ready');
      } else if (d.cmd === 'download table fileapi') {
        if (d.code !== 0) {
          alert(t('写入文件失败,请重试或换默认下载', 'Failed to write file — retry or use default download'));
        }
        setReadyState('ready');
        setProgress(-1);
      }
    };
  };

  useEffect(() => {
    const w = new Worker('/cubeopt/wasm-worker.js');
    workerRef.current = w;
    bindCubeoptWorker(w);
    return () => {
      w.terminate();
      workerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cancelCubeopt = () => {
    if (!workerRef.current) return;
    workerRef.current.terminate();
    pendingSolveRef.current = false;
    justGeneratedRef.current = false;
    setProgress(-1);
    setLogs((prev) => prev + '[cancelled by user]\n');
    const w = new Worker('/cubeopt/wasm-worker.js');
    workerRef.current = w;
    bindCubeoptWorker(w);
    setReadyState('busy');
    w.postMessage({ cmd: 'select solver', data: solverName });
  };

  // Gate on `mounted` so this fires exactly once after mobile-detection has
  // settled solverName. Otherwise the desktop default (cube48opt3) posts a
  // select-solver, then the mobile override (cube48opt1) posts a second one;
  // the vendored worker's change_solver kicks off import().then() WITHOUT
  // awaiting, so two emscripten modules (≈2×17 pthread workers + two prun
  // tables) instantiate concurrently and whichever resolves last wins —
  // desyncing the loaded solver from the dropdown (and on mobile silently
  // loading a much bigger table than the shown opt1). The solver <select> is
  // disabled while busy, so a user-driven change can't race; only this mount
  // transient could, and the `mounted` gate removes it.
  useEffect(() => {
    if (!mounted || !workerRef.current) return;
    setReadyState('busy');
    setLogs('');
    setProgress(-1);
    pendingSolveRef.current = false;
    workerRef.current.postMessage({ cmd: 'select solver', data: solverName });
  }, [mounted, solverName]);

  useEffect(() => {
    if (nThreads % nGroup !== 0) {
      setNGroup(1);
    }
  }, [nThreads, nGroup]);

  useEffect(() => {
    if (logsRef.current) logsRef.current.scrollTop = logsRef.current.scrollHeight;
  }, [logs]);

  const generateTable = async () => {
    if (readyState !== 'need-init') return;
    // Let the user choose where to save the table before the (long) build kicks
    // off. Runs inside the click gesture so showDirectoryPicker keeps activation.
    const picker = (window as unknown as {
      showDirectoryPicker?: (opts?: { mode?: 'read' | 'readwrite' }) => Promise<FileSystemDirectoryHandle>;
    }).showDirectoryPicker;
    if (picker) {
      try {
        const handle = await picker({ mode: 'readwrite' });
        saveDirRef.current = handle;
        setSaveDirName(handle.name);
      } catch {
        // user dismissed the picker → fall back to default browser download
      }
    }
    setReadyState('busy');
    setLogs('');
    workerRef.current?.postMessage({ cmd: 'generate table' });
  };
  const downloadTable = async () => {
    if (readyState !== 'ready') return;
    const dir = saveDirRef.current;
    // Preferred: stream the table straight to the chosen folder in 64MB chunks
    // (worker's 'download table fileapi') — no full-size in-memory copy, which
    // matters a lot for the multi-GB tables (opt7+).
    if (dir) {
      try {
        const fh = await dir.getFileHandle(solverInfoRef.current?.table_name || 'cubeopt-table.dat', { create: true });
        setReadyState('busy');
        workerRef.current?.postMessage({ cmd: 'download table fileapi', data: fh });
        return;
      } catch {
        // permission lost / handle stale → fall back to blob download below
      }
    }
    setReadyState('busy');
    workerRef.current?.postMessage({ cmd: 'download table' });
  };

  // Blob fallback (no save folder chosen): the worker already sent a regular
  // ArrayBuffer copy of the whole table — turn it into a default download.
  const saveTableBytes = (buf: ArrayBuffer) => {
    const blob = new Blob([buf], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = solverInfoRef.current?.table_name || 'cubeopt-table.dat';
    a.click();
    URL.revokeObjectURL(url);
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
    solveResultsRef.current = new Map();
    setSolveResults(new Map());
    pendingSolutionsRef.current = [];
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
      const cleaned = scrambles.split('\n').map(s => s.trim()).filter(Boolean).join('\n');
      if (!cleaned) { alert(t('打乱不能为空', 'No scrambles')); return; }
      pendingSolveRef.current = true;
      generateTable();
    }
  };

  const CLOUD_MAX = 5;
  const HTM_TOKEN = /^[URFDLB][2']?$/;

  // Cloud solve: stream optimal solutions from api.cuberoot.me (server opt5 table).
  // Results fill the same solveResults Map the local worker writes (1-based index),
  // so the existing "Solutions" panel renders both paths identically.
  const cloudSolve = async () => {
    const lines = scrambles.split('\n').map(s => s.trim()).filter(Boolean);
    if (!lines.length) { alert(t('打乱不能为空', 'No scrambles')); return; }
    const bad = lines.find(l => l.split(/\s+/).some(tok => !HTM_TOKEN.test(tok)));
    if (bad) { alert(t('云端只支持纯面转打乱(U R F D L B,带 2 或 \'),不支持宽块/转体/中层。', 'Cloud solve only takes plain face-turn scrambles (U R F D L B with 2 or \').')); return; }
    if (lines.length > CLOUD_MAX) { alert(t(`云端一次最多 ${CLOUD_MAX} 条(本地下载表则不限)。`, `Cloud solve takes at most ${CLOUD_MAX} scrambles at once (local mode is unlimited).`)); return; }
    if (!user) { setCloudStatus(t('云端求解需登录(用右上角 WCA 登录)。', 'Cloud solve requires login (WCA, top-right).')); return; }

    setCloudBusy(true);
    setCloudStatus(t('连接云端求解…', 'Connecting…'));
    solveResultsRef.current = new Map();
    setSolveResults(new Map());
    const ac = new AbortController();
    cloudAbortRef.current = ac;
    let done = 0;
    let warm = true;           // was the table already in server memory
    let loadMs = 0;            // server-reported table load time (cold start)
    // Safety timeouts so a dead/hung stream never spins forever. Sliding
    // inactivity check: the server sends a 10s heartbeat ping while loading /
    // queued / mid-solve, so any healthy request keeps resetting lastActivity.
    // Threshold is 60s (not 45s): the heartbeat runs on the server's main event
    // loop, which can be blocked ~20s at a time by in-process warm builds, so a
    // healthy stream can still show a ~30-50s gap. nginx's read timeout for this
    // endpoint is 200s (> server's 180s solve cap), so 60s here is the binding,
    // intentional "is it actually dead" detector; 230s total is the outer bound.
    let lastActivity = Date.now();
    const noRespTimer = setInterval(() => { if (Date.now() - lastActivity > 60_000) ac.abort('no-response'); }, 5_000);
    const overallTimer = setTimeout(() => ac.abort('overall'), 230_000);
    // (Re)start the live phase timer — ticks the current phase's elapsed at 0.1s.
    const startPhaseTimer = () => {
      cloudPhaseStartRef.current = Date.now();
      setCloudLiveMs(0);
      if (cloudTimerRef.current) clearInterval(cloudTimerRef.current);
      cloudTimerRef.current = setInterval(() => setCloudLiveMs(Date.now() - cloudPhaseStartRef.current), 100);
    };
    startPhaseTimer();
    try {
      const res = await fetch(apiUrl('/v1/scramble/optimal-solve'), {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ scrambles: lines }),
        signal: ac.signal,
      });
      if (!res.ok || !res.body) {
        const e = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(e.error || `HTTP ${res.status}`);
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = '';
      for (;;) {
        const { value, done: rdone } = await reader.read();
        if (rdone) break;
        buf += dec.decode(value, { stream: true });
        let sep: number;
        while ((sep = buf.indexOf('\n\n')) >= 0) {
          const block = buf.slice(0, sep);
          buf = buf.slice(sep + 2);
          lastActivity = Date.now(); // any block (incl. heartbeat ping) = alive
          let ev = 'message';
          let data = '';
          for (const ln of block.split('\n')) {
            if (ln.startsWith('event:')) ev = ln.slice(6).trim();
            else if (ln.startsWith('data:')) data += ln.slice(5).trim();
          }
          if (!data) continue;
          const obj = JSON.parse(data) as { i?: number; htm?: number; solution?: string; error?: string; ok?: number; fail?: number; warm?: boolean; loadMs?: number; ahead?: number; phase?: string };
          if (ev === 'loading') {
            setCloudStatus(t('正在把求解表载入服务器内存(首次约 20 秒)…', 'Loading the solver table into server memory (first time ~20s)…'));
          } else if (ev === 'ready') {
            warm = obj.warm !== false;
            loadMs = typeof obj.loadMs === 'number' ? obj.loadMs : 0;
            // Transitional — the next 'queued'/'solving' event sets the real state.
            setCloudStatus(warm
              ? t('表已就绪…', 'Table ready…')
              : t(`表已载入(载表 ${Math.round(loadMs / 1000)}s)…`, `Table loaded (${Math.round(loadMs / 1000)}s)…`));
          } else if (ev === 'queued') {
            startPhaseTimer(); // ticker now shows queue-wait time
            const ahead = typeof obj.ahead === 'number' ? obj.ahead : 0;
            setCloudStatus(t(`排队中(前面 ${ahead} 个在算)…`, `Queued (${ahead} ahead)…`));
          } else if (ev === 'solving') {
            startPhaseTimer(); // ticker now shows actual solve time
            setCloudStatus(t(`求解中 ${done}/${lines.length}…`, `Solving ${done}/${lines.length}…`));
          } else if (ev === 'error') {
            if (obj.i === -1 || obj.phase === 'load') {
              setCloudStatus(t(`求解表加载失败:${obj.error ?? ''}`, `Table load failed: ${obj.error ?? ''}`));
            } else {
              done++;
              setCloudStatus(t(`第 ${(obj.i ?? 0) + 1} 条失败:${obj.error ?? ''}`, `#${(obj.i ?? 0) + 1} failed: ${obj.error ?? ''}`));
            }
          } else if (ev === 'done') {
            const solveSecs = Math.round((Date.now() - cloudPhaseStartRef.current) / 1000);
            const okN = obj.ok ?? 0;
            const failN = obj.fail ?? 0;
            const loadSecs = Math.round(loadMs / 1000);
            const zh = `云端求解完成(成功 ${okN}${failN ? `,失败 ${failN}` : ''}${warm ? `,耗时 ${solveSecs}s` : `,载表 ${loadSecs}s + 求解 ${solveSecs}s`})`;
            const en = `Done (ok ${okN}${failN ? `, failed ${failN}` : ''}${warm ? `, ${solveSecs}s` : `, load ${loadSecs}s + solve ${solveSecs}s`})`;
            setCloudStatus(t(zh, en));
          } else if (typeof obj.i === 'number' && typeof obj.solution === 'string') {
            done++;
            solveResultsRef.current.set(obj.i + 1, obj.solution);
            setSolveResults(new Map(solveResultsRef.current));
            setCloudStatus(t(`求解中 ${done}/${lines.length}…`, `Solving ${done}/${lines.length}…`));
          }
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const reason = ac.signal.reason;
      if (reason === 'no-response') setCloudStatus(t('服务器无响应,请重试。', 'No response from the server — please retry.'));
      else if (reason === 'overall') setCloudStatus(t('求解超时(可能是特别难的打乱或服务器繁忙),请重试。', 'Solve timed out (very hard scramble or server busy) — please retry.'));
      else if (ac.signal.aborted) setCloudStatus(t('已取消。', 'Cancelled.'));
      else setCloudStatus(t(`云端求解失败:${msg}`, `Cloud solve failed: ${msg}`));
    } finally {
      clearInterval(noRespTimer);
      clearTimeout(overallTimer);
      if (cloudTimerRef.current) { clearInterval(cloudTimerRef.current); cloudTimerRef.current = null; }
      setCloudBusy(false);
      cloudAbortRef.current = null;
    }
  };

  const cancelCloud = () => { cloudAbortRef.current?.abort(); };

  useEffect(() => {
    if (readyState !== 'ready') return;
    if (justGeneratedRef.current && autoDownloadTable) {
      justGeneratedRef.current = false;
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

  const nGroupOptions = useMemo(() => {
    const out: number[] = [];
    for (let i = 1; i <= nThreads; i++) if (nThreads % i === 0) out.push(i);
    return out;
  }, [nThreads]);

  const stateOk = (() => {
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

  const previewScramble = useMemo(() => {
    const first = scrambles.split('\n').map(s => s.trim()).find(Boolean);
    if (!first) return null;
    try {
      parseMoves(first);
      return first;
    } catch { return null; }
  }, [scrambles]);

  const cloudMode = solveSource === 'cloud';
  const busy = cloudMode ? cloudBusy : readyState === 'busy';
  const solveDisabled = cloudMode ? (!stateOk || !user) : (readyState === 'no-solver' || !stateOk);

  return (
    <div className="cubeopt-page">
      <style>{INLINE_CSS}</style>
      <SolveTabs puzzle="3x3" mode="solve" sub="optimal" />

      {!cloudMode && mounted && !sabAvailable && (
        <div className="cubeopt-warn">
          {t(
            '当前页面没有 SharedArrayBuffer/COI,wasm 多线程跑不起来。请刷新页面后再试,或改用云端求解(免下载表)。',
            'SharedArrayBuffer / cross-origin isolation not active — multithreaded wasm will not run. Reload the page, or switch to cloud solve (no download).'
          )}
        </div>
      )}

      {!cloudMode && workerError && (
        <div className="cubeopt-warn">{workerError}</div>
      )}

      {!cloudMode && isMobile && (
        <div className="cubeopt-info">
          <span>
            {t(
              '检测到手机端 — 已默认 cube48opt1 (30M)。手机 wasm 内存有限,opt2/3 视机型可能 OK,opt4 起容易 OOM 崩页;生成时长是桌面的 3-5 倍,期间不要切到后台。或改用云端求解(免下载表)。',
              'Mobile detected — defaulted to cube48opt1 (30M). Mobile wasm memory is tight; opt2/3 may work on flagship phones, opt4+ likely OOM. Gen takes 3-5× longer than desktop; don\'t background the tab during gen. Or switch to cloud solve (no download).'
            )}
          </span>
        </div>
      )}

      {cloudMode && mounted && !user && (
        <div className="cubeopt-info">
          <span>{t('云端求解需登录(用你的 WCA 账号)。', 'Cloud solve requires login (your WCA account).')}</span>
          <button className="btn" onClick={login}>{t('登录', 'Log in')}</button>
        </div>
      )}

      {cloudMode && cloudStatus && (
        <div className="cubeopt-info">
          {cloudBusy && <Loader2 size={14} className="spinning" />}
          <span>{cloudStatus}</span>
          {cloudBusy && <span className="cloud-timer">{Math.floor(cloudLiveMs / 1000)}s</span>}
          {cloudBusy && (
            <button className="btn-cancel-sm" onClick={cancelCloud}>
              <X size={12} /> {t('取消', 'Cancel')}
            </button>
          )}
        </div>
      )}

      <div className="cubeopt-tabs" role="tablist">
        <button role="tab" aria-selected={inputMode === 'paint'} className={`tab${inputMode === 'paint' ? ' is-active' : ''}`} onClick={() => setInputMode('paint')}>
          {t('从状态画', 'Paint state')}
        </button>
        <button role="tab" aria-selected={inputMode === 'random'} className={`tab${inputMode === 'random' ? ' is-active' : ''}`} onClick={() => setInputMode('random')}>
          {t('随机生成', 'Random')}
        </button>
        <button role="tab" aria-selected={inputMode === 'paste'} className={`tab${inputMode === 'paste' ? ' is-active' : ''}`} onClick={() => setInputMode('paste')}>
          {t('直接粘贴', 'Paste')}
        </button>
      </div>

      {inputMode === 'paint' && (
        <section className="cubeopt-card">
          <div className="paint-wrap">
            <InteractiveCubeNet
              facelet={paintFacelet}
              onChange={setPaintFacelet}
              activeColor={paintColor}
              onActiveColorChange={setPaintColor}
              pixelSize={paintCanvasSize}
              solveLabel={{ zh: '求打乱', en: 'Derive scramble'
            }}
              onSolve={(fc) => {
                if (kociembaBusy) return;
                runKociembaForState(fc).catch((e: Error) => {
                  setStateInfo(t(`从状态求解失败:${e.message}`, `Solve from state failed: ${e.message}`));
                });
              }}
            />
          </div>
        </section>
      )}

      {inputMode === 'random' && (
        <section className="cubeopt-card">
          <div className="row">
            <select className="ctl-sm" value={scrLen} onChange={(e) => setScrLen(parseInt(e.target.value, 10))}>
              {SCR_LEN_OPTS.map(n => <option key={n} value={n}>{n} {t('步', 'moves')}</option>)}
            </select>
            <select className="ctl-sm" value={scrNum} onChange={(e) => setScrNum(parseInt(e.target.value, 10))}>
              {SCR_NUM_OPTS.map(n => <option key={n} value={n}>{n} {t('个', 'cubes')}</option>)}
            </select>
            <button className="btn-primary" onClick={genRandom}>{t('生成到打乱框', 'Generate')}</button>
          </div>
        </section>
      )}

      {stateInfo && (
        <div className="cubeopt-info">
          {kociembaBusy && <Loader2 size={14} className="spinning" />}
          <span>{stateInfo}</span>
          {kociembaBusy && (
            <button className="btn-cancel-sm" onClick={cancelKociemba}>
              <X size={12} /> {t('取消', 'Cancel')}
            </button>
          )}
        </div>
      )}

      <section className="cubeopt-card">
        <div className="row">
          <span className="lbl">{t('打乱', 'Scramble')}</span>
          <button className="btn-icon" onClick={inverseScrambles} title={t('每行反向', 'Invert each line')}>
            <Sparkles size={14} />
          </button>
          <button
            className={`btn-icon${showScramblePreview ? ' is-active' : ''}`}
            onClick={() => setShowScramblePreview(v => !v)}
            title={t('显示第一行打乱产生的状态', 'Show state after the first scramble')}
          >
            {showScramblePreview ? <Eye size={14} /> : <EyeOff size={14} />}
          </button>
          <button className="btn-icon" onClick={() => setScrambles('')} title={t('清空', 'Clear')}>
            <Trash2 size={14} />
          </button>
          <span className="row-spacer" />
          {busy ? (
            <button className="btn-cancel" onClick={cloudMode ? cancelCloud : cancelCubeopt} title={cloudMode
              ? t('中止云端请求。', 'Abort the cloud request.')
              : t('终止当前任务。会重建 wasm,prun 表会丢失需重新生成或上传。',
                  'Abort current task. Wasm will be reset; prun table is lost and must be re-generated or uploaded.')}>
              <X size={14} /> {t('取消', 'Cancel')}
            </button>
          ) : cloudMode ? (
            <button
              className="btn-primary"
              disabled={solveDisabled}
              onClick={cloudSolve}
              title={t('用云服务器求 HTM 最少步解(opt6,免下载表)', 'Solve optimally on the server (opt6, no download)')}
            >
              {t('云端求解', 'Solve on server')}
            </button>
          ) : (
            <button
              className="btn-primary"
              disabled={solveDisabled}
              onClick={startSolve}
              title={readyState === 'need-init' ? t(
                '会先自动生成 prun 表(几十秒)再求最优解',
                'Will auto-generate the prun table (tens of seconds) then solve'
              ) : t('用 cubeopt 求 HTM 最少步解', 'Solve optimally with cubeopt')}
            >
              {readyState === 'need-init'
                ? <><Sparkles size={14} /> {t('生成表+求最优', 'Gen Table + Solve')}</>
                : <>Solve</>}
            </button>
          )}
        </div>
        <textarea
          className="scramble-area"
          rows={inputMode === 'paste' ? 6 : 4}
          placeholder={inputMode === 'paste'
            ? t('把 cubedb / cstimer / WCA scramble 粘到这里,每行一个,然后 Solve。',
                'Paste scrambles here (one per line), then Solve.')
            : "R U R' U' R' F R2 U' R' U' R U R' F'"}
          value={scrambles}
          onChange={(e) => setScrambles(e.target.value)}
        />
        {showScramblePreview && previewScramble && (
          <div className="scramble-preview-mini">
            <CubingPreview2D scramble={previewScramble} size={14} className="scramble-preview-svg" />
          </div>
        )}
      </section>

      {solveResults.size > 0 && (
        <section className="cubeopt-card">
          <div className="row">
            <span className="lbl">{t('解 (按输入顺序)', 'Solutions (input order)')}</span>
            <span className="paint-hint">
              {t(
                'cubeopt 是按完成顺序输出的;此处按输入序号 1..N 排好,并标注步数。',
                'cubeopt outputs in finish order; this panel re-sorts by input index 1..N with move counts.'
              )}
            </span>
            <button className="btn-icon" onClick={() => {
              const txt = Array.from(solveResults.entries()).sort((a, b) => a[0] - b[0])
                .map(([n, alg]) => `${n}. ${alg}`).join('\n');
              navigator.clipboard?.writeText(txt);
            }} title={t('复制全部', 'Copy all')}>
              <Sparkles size={14} />
            </button>
          </div>
          <ol className="solutions-list">
            {Array.from(solveResults.entries()).sort((a, b) => a[0] - b[0]).map(([n, alg]) => {
              const moveCount = alg.split(/\s+/).filter(Boolean).length;
              return (
                <li key={n}>
                  <span className="sol-idx">{n}.</span>
                  <code className="sol-alg">{alg}</code>
                  <span className="sol-count">({moveCount})</span>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      <section className="cubeopt-card cubeopt-advanced">
        <button className="advanced-toggle" onClick={() => setShowAdvanced(v => !v)}>
          {showAdvanced ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          <span>{t('高级设置', 'Advanced')}</span>
          <span className="advanced-summary">
            {cloudMode
              ? <>{t('云端 opt6', 'Cloud opt6')}{cloudBusy && <> · <Loader2 size={12} className="spinning" /> {t('忙', 'busy')}</>}</>
              : <>
                  {solverName} · {nThreads}{t('线程', 'threads')}
                  {readyState === 'ready' && <> · {t('就绪', 'ready')}</>}
                  {readyState === 'need-init' && <> · {t('表未生成', 'table not built')}</>}
                  {readyState === 'busy' && <> · <Loader2 size={12} className="spinning" /> {t('忙', 'busy')}</>}
                </>}
          </span>
        </button>
        {showAdvanced && (
          <>
            <div className="row">
              <span className="lbl">{t('求解来源', 'Solve via')}</span>
              <select className="ctl" value={solveSource} disabled={busy}
                onChange={(e) => setSolveSource(e.target.value as 'local' | 'cloud')}>
                <option value="local">{t('本地(下载表,无限制)', 'Local (download table, unlimited)')}</option>
                <option value="cloud">{t('云端(opt6,免下载,需登录)', 'Cloud (opt6, no download, login)')}</option>
              </select>
            </div>
            {cloudMode && (
              <p className="cloud-note">
                {t(
                  '云端用服务器的 opt6 表(1.9G)求最优解,解和本地各档完全一样,只是免你下载多 GB 的表。一次最多 5 条;多数几秒出解,最难的打乱(19-20 步最优)在 2 核服务器上可能要 1 分钟左右,串行排队。',
                  'The server solves with its opt6 table (1.9G). The solution is identical to every local table — this just saves you the multi-GB download. Up to 5 scrambles at once; most finish in seconds, but the hardest scrambles (19-20 move optimal) can take ~1 min on the 2-core server, processed in a serial queue.'
                )}
              </p>
            )}
            {!cloudMode && (
            <div className="row">
              <span className="lbl">Solver</span>
              <select className="ctl" value={solverName} disabled={readyState === 'busy'}
                onChange={(e) => setSolverName(e.target.value)}>
                {SOLVER_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.value} ({o.size})</option>
                ))}
              </select>
              <span className="size-badge">{SOLVER_OPTIONS.find(o => o.value === solverName)?.size}</span>
            </div>
            )}
            {!cloudMode && (<>
            <div className="row">
              <span className="lbl">{t('Prun 表', 'Prun Table')}</span>
              <span className="table-name">{solverInfo?.table_name ?? t('未就绪', 'Not Ready')}</span>
              <label className="auto-dl">
                <input type="checkbox" checked={autoDownloadTable} onChange={(e) => setAutoDownloadTable(e.target.checked)} />
                <span>{t('生成后自动下载', 'Auto-download after gen')}</span>
              </label>
              {saveDirName && (
                <span className="save-dir">
                  {t('保存到', 'Save to')}: <code>{saveDirName}</code>
                </span>
              )}
              {readyState === 'need-init' && (
                <>
                  <button className="btn" onClick={generateTable}>{t('生成表', 'Generate Table')}</button>
                  <button className="btn" onClick={onUploadClick}><Upload size={14} /> {t('上传表', 'Upload Table')}</button>
                </>
              )}
              {readyState === 'ready' && (
                <button className="btn" onClick={downloadTable}><Download size={14} /> {t('下载表', 'Download Table')}</button>
              )}
              <input ref={fileInputRef} type="file" style={{ display: 'none' }} onChange={onUploadFile} />
            </div>
            {progress >= 0 && (
              <div className="progress">
                <div className="progress-bar" style={{ width: `${Math.round(progress * 100)}%` }} />
              </div>
            )}
            <div className="row">
              <span className="lbl">{t('线程', 'Threads')}</span>
              <select className="ctl-sm" value={nThreads} onChange={(e) => setNThreads(parseInt(e.target.value, 10))}>
                {Array.from({ length: typeof navigator !== 'undefined' ? (navigator.hardwareConcurrency || 4) : 4 }, (_, i) => i + 1).map(n => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
              <span className="lbl">{t('并发块', 'Concurrent')}</span>
              <select className="ctl-sm" value={nGroup} onChange={(e) => setNGroup(parseInt(e.target.value, 10))}>
                {nGroupOptions.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            </>)}
          </>
        )}
      </section>

      <section className="cubeopt-card">
        <div className="row">
          <span className="lbl">Logs</span>
          <button className="btn" onClick={() => setShowLogs(v => !v)}>
            {showLogs ? t('收起', 'Hide') : t('展开 raw 输出', 'Show raw output')}
            {logs ? ` (${logs.split('\n').length - 1})` : ''}
          </button>
          {showLogs && (
            <button className="btn-icon" onClick={() => setLogs('')} title="Clear logs">
              <Trash2 size={14} />
            </button>
          )}
        </div>
        {showLogs && (
          <textarea ref={logsRef} className="logs-area" rows={10} value={logs} readOnly />
        )}
      </section>

      <p className="cubeopt-foot">
        Inspired by <a href="https://github.com/cs0x7f/cubeopt-wasm" target="_blank" rel="noopener noreferrer">cs0x7f/cubeopt-wasm</a> (BSD-3),
        original demo at <a href="https://cstimer.net/cubeopt/" target="_blank" rel="noopener noreferrer">cstimer.net/cubeopt</a>.
      </p>
    </div>
  );
}

export default function ScrambleSolverPage() {
  return (
    <Suspense fallback={<div style={{ padding: 16 }}>Loading…</div>}>
      <ScrambleSolverPageInner />
    </Suspense>
  );
}

const INLINE_CSS = `
.cubeopt-page {
  max-width: 920px;
  margin: 0 auto;
  padding: 1.25rem 1rem 3rem;
  color: var(--text);
  overflow-x: hidden;
}
.cubeopt-header {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 0.25rem;
}
.cubeopt-header h1 { margin: 0; font-size: 1.6rem; font-weight: 600; }
.cubeopt-tabs {
  display: flex; gap: 0.25rem;
  margin: 0.75rem 0;
  border-bottom: 1px solid var(--border, #333);
}
.cubeopt-tabs .tab {
  background: transparent; border: none; color: var(--text-muted, #aaa);
  padding: 0.45rem 0.9rem; font-size: 0.9rem; cursor: pointer;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  transition: color 0.12s ease, border-color 0.12s ease;
}
.cubeopt-tabs .tab:hover { color: var(--text); }
.cubeopt-tabs .tab.is-active {
  color: var(--accent, #ff8800);
  border-bottom-color: var(--accent, #ff8800);
}
.row-spacer { flex: 1; }
.advanced-toggle {
  display: flex; align-items: center; gap: 0.4rem;
  width: 100%; background: transparent; border: none; color: var(--text);
  padding: 0.25rem 0; font-size: 0.9rem; cursor: pointer; text-align: left;
}
.advanced-toggle:hover { color: var(--accent, #ff8800); }
.advanced-summary {
  margin-left: auto; color: var(--text-muted, #888); font-size: 0.8rem;
  display: inline-flex; align-items: center; gap: 0.3rem;
}
.cubeopt-advanced { padding-bottom: 0.25rem; }
.scramble-preview-mini {
  margin-top: 0.5rem;
  display: inline-block;
  padding: 0.4rem;
  background: var(--panel-sub, #181818);
  border-radius: 5px;
  border: 1px dashed var(--border, #333);
}
.cubeopt-warn {
  background: #3a2912; border: 1px solid #ff8800; color: #ffcc88;
  padding: 0.5rem 0.75rem; border-radius: 6px; margin-bottom: 0.75rem;
  font-size: 0.9rem;
}
.cubeopt-info {
  background: #18242a; border: 1px solid #2b6a8a; color: #88d4ff;
  padding: 0.5rem 0.75rem; border-radius: 6px; margin-bottom: 0.75rem;
  font-size: 0.9rem;
  display: flex; align-items: center; gap: 0.5rem;
}
.cubeopt-info > span { flex: 1; }
.btn-cancel, .btn-cancel-sm {
  display: inline-flex; align-items: center; gap: 0.3rem;
  background: #4a1f1f; border: 1px solid #8a3a3a; color: #ffaaaa;
  border-radius: 5px; cursor: pointer;
  font-weight: 600;
}
.btn-cancel { padding: 0.35rem 0.8rem; font-size: 0.85rem; }
.btn-cancel-sm { padding: 0.2rem 0.5rem; font-size: 0.75rem; }
.btn-cancel:hover, .btn-cancel-sm:hover { background: #5a2a2a; border-color: #c14747; }
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
  max-width: 100%; box-sizing: border-box;
}
.ctl { flex: 1; min-width: 0; }
.ctl-sm { min-width: 0; flex: 1 1 6rem; }
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
.btn-icon.is-active { border-color: var(--accent, #ff8800); color: var(--accent, #ff8800); }
.scramble-preview-svg { flex-shrink: 0; }
.solutions-list {
  list-style: none; margin: 0.25rem 0 0; padding: 0;
  display: flex; flex-direction: column; gap: 0.2rem;
}
.solutions-list li {
  display: flex; align-items: baseline; gap: 0.5rem;
  padding: 0.3rem 0.5rem;
  background: var(--panel-sub, #181818);
  border-radius: 4px;
}
.sol-idx {
  font-variant-numeric: tabular-nums;
  color: var(--text-muted, #888);
  min-width: 1.8rem; text-align: right;
  font-size: 0.8rem;
}
.sol-alg {
  font-family: ui-monospace, Menlo, Consolas, monospace;
  font-size: 0.85rem;
  flex: 1; min-width: 0;
  word-break: break-all;
}
.sol-count {
  font-variant-numeric: tabular-nums;
  color: var(--accent, #ff8800);
  font-size: 0.78rem;
}
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
.cloud-note {
  margin: 0 0 0.5rem; padding: 0.5rem 0.6rem;
  background: var(--panel-sub, #181818); border: 1px dashed var(--border, #333);
  border-radius: 5px; color: var(--text-muted, #aaa);
  font-size: 0.8rem; line-height: 1.5;
}
.cloud-timer {
  flex: 0 0 auto;
  font-family: var(--font-mono, ui-monospace, monospace);
  font-variant-numeric: tabular-nums;
  font-size: 0.85rem; font-weight: 600;
  color: var(--accent, #ff8800);
}
.cubeopt-foot {
  margin-top: 1rem; color: var(--text-muted, #888); font-size: 0.8rem;
}
.cubeopt-foot a { color: var(--accent, #ff8800); }
.paint-hint {
  flex: 1; min-width: 12rem;
  font-size: 0.8rem; color: var(--text-muted, #888);
  line-height: 1.4;
}
.paint-wrap {
  display: flex; justify-content: center;
}
.auto-dl {
  display: inline-flex; align-items: center; gap: 0.35rem;
  font-size: 0.8rem; color: var(--text-muted, #aaa); cursor: pointer;
  user-select: none;
}
.auto-dl input { margin: 0; cursor: pointer; }
.save-dir {
  display: inline-flex; align-items: center; gap: 0.3rem;
  font-size: 0.8rem; color: var(--text-muted, #aaa);
}
.save-dir code {
  font-size: 0.78rem; color: var(--text, #ddd);
  max-width: 12rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
@media (max-width: 480px) {
  .cubeopt-page { padding: 0.75rem 0.5rem 2rem; }
  .cubeopt-header h1 { font-size: 1.2rem; flex: 1; min-width: 0; }
  .lbl { min-width: 3.5rem; font-size: 0.78rem; }
  .ctl, .ctl-sm { font-size: 0.8rem; padding: 0.25rem 0.35rem; }
  .size-badge, .table-name, .auto-dl { font-size: 0.75rem; }
  .auto-dl span { white-space: nowrap; }
  .btn, .btn-primary, .btn-cancel { font-size: 0.78rem; padding: 0.3rem 0.5rem; }
  .row { gap: 0.35rem; }
  .paint-hint { font-size: 0.72rem; line-height: 1.3; }
}
`;

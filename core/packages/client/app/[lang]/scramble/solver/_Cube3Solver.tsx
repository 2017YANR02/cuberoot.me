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

import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQueryState, parseAsStringEnum } from 'nuqs';
import { Loader2, Download, X, HelpCircle } from 'lucide-react';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { streamApiUrl } from '@/lib/api-base';
import { persistItem } from '@/lib/safe-storage';
import { authHeaders } from '@/lib/admin-api';
import { useAuthStore } from '@/lib/auth-store';
import { faceletToCubie, validateFacelet, cubieToFacelet } from './facelet';
import {
  formatMoves,
  invertSequence,
  parseMoves,
  applySequence,
  isSolvedCubie,
  solvedCubie,
} from './_kociemba/cube';
import InteractiveCubeNet, { EMPTY_FACELET, type PaintColor } from './_InteractiveCubeNet';
import Interactive3DCube from './_Interactive3DCube';
import { useT } from "@/hooks/useT";
import BoolToggle from '@/components/BoolToggle';
import { ListSelect } from '@/components/ListSelect';
import PillToggle from '@/components/PillToggle/PillToggle';
import { InfoTooltip } from '@/components/InfoTooltip/InfoTooltip';
import { ClearButton } from '@/components/ClearButton';
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

type ReadyState = 'no-solver' | 'need-init' | 'ready' | 'busy';

function spawnKociembaWorker(): Worker {
  return new Worker(new URL('./_kociemba/kociemba.worker.ts', import.meta.url), { type: 'module' });
}

// Annotate a maneuver with its HTM length, e.g. "(21h)"; the '*' flags a
// proven-optimal result — "(21h*)". Every cubeopt/cloud solution is optimal, so
// those get the star; the fast Kociemba scramble/solution lands in the editable
// textarea and is left unannotated (annotating it would corrupt the scramble).
function htmTag(alg: string, optimal = true): string {
  const n = alg.trim().split(/\s+/).filter(Boolean).length;
  return `(${n}h${optimal ? '*' : ''})`;
}

export default function Cube3Solver() {
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
    // Real mobile only. A Windows/desktop touchscreen reports maxTouchPoints>1 AND
    // a coarse pointer, but it ALSO exposes a fine pointer + a large screen — it
    // must NOT be treated as mobile (which would force opt1 + the scary OOM
    // warning). Require a phone/tablet UA, OR a coarse-only pointer on a small
    // screen. (2026-06-15 — fixes false "手机端" on desktop touch monitors.)
    const uaMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    // iPadOS 13+ reports a desktop "Macintosh" UA and large iPads exceed the
    // small-screen gate below — detect them by Mac UA + touch (Macs have no
    // touchscreen, so maxTouchPoints>1 + Mac UA reliably means an iPad). They
    // share phones' tight wasm memory, so treat as mobile (opt1 + warning).
    const iPadOS = /Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1;
    const mm = typeof window !== 'undefined' ? window.matchMedia?.bind(window) : undefined;
    const coarseOnly = !!mm?.('(pointer: coarse)').matches && !mm?.('(pointer: fine)').matches;
    const minEdge = Math.min(window.screen?.width ?? 9999, window.screen?.height ?? 9999);
    const mobile = uaMobile || iPadOS || (coarseOnly && minEdge <= 820);
    setIsMobile(mobile);
    if (mobile) setSolverName('cube48opt1');
  }, []);

  // COEP self-heal: soft-navigating into this page lands WITHOUT the
  // Cross-Origin-Embedder-Policy header (Next doesn't re-fetch the document on a
  // client-side navigation), so crossOriginIsolated is false, SharedArrayBuffer
  // is unavailable, and the multithreaded cubeopt wasm worker throws deep inside
  // an emscripten pthread (NOT on the main thread, so onerror never fires) and
  // the page sticks on "忙" forever. One hard reload re-fetches the document WITH
  // the COEP header (next.config headers()), restoring isolation. sessionStorage
  // guards against a reload loop if the header is genuinely absent. (2026-06-15)
  useEffect(() => {
    if (!mounted || typeof window === 'undefined') return;
    try {
      if (window.crossOriginIsolated) { sessionStorage.removeItem('cubeopt.coiReload'); return; }
      if (sessionStorage.getItem('cubeopt.coiReload')) return;
      sessionStorage.setItem('cubeopt.coiReload', '1');
    } catch {
      // Sandboxed iframe / locked-down privacy mode: without a persistable guard
      // a reload could loop, so bail and let the warning + cloud fallback show.
      return;
    }
    window.location.reload();
  }, [mounted]);

  const [solverInfo, setSolverInfo] = useState<SolverInfo | null>(null);
  const [readyState, setReadyState] = useState<ReadyState>('no-solver');
  const [workerError, setWorkerError] = useState<string | null>(null);
  const [progress, setProgress] = useState(-1);
  const [logs, setLogs] = useState('');
  const [scrambles, setScrambles] = useState('');
  const [nThreads, setNThreads] = useState(4);
  useEffect(() => {
    if (typeof navigator !== 'undefined' && navigator.hardwareConcurrency) {
      setNThreads(navigator.hardwareConcurrency);
    }
  }, []);
  const [nGroup, setNGroup] = useState(1);
  const pendingSolutionsRef = useRef<string[]>([]);
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
  const pendingSolveRef = useRef(false);
  // Explicit scramble to solve once the table finishes generating (need-init path),
  // so a paint-triggered optimal solve doesn't read stale textarea state.
  const pendingSolveScrambleRef = useRef<string | undefined>(undefined);
  // When true, the current optimal solve was triggered by 求打乱 (optimal): on
  // completion, invert its optimal solution back into the scramble box so the box
  // shows the *optimal* scramble (fewest moves reaching the painted state).
  const optimalScrambleRef = useRef(false);
  const [autoDownloadTable, setAutoDownloadTable] = useState(true);
  // Optional save folder (File System Access API). When set, generated tables
  // are written straight into it instead of the browser's default Downloads.
  const saveDirRef = useRef<FileSystemDirectoryHandle | null>(null);
  const [saveDirName, setSaveDirName] = useState<string | null>(null);
  const justGeneratedRef = useRef(false);
  // Input method in URL (?view): 'net' = paint the 2D unfolded cross,
  // 'cube' = paint the rotatable 3D cube, 'scramble' = type one or more scramble
  // formulas (one per line — shares the `scrambles` state with the batch solve
  // pipeline below), 'recon' = type a single reconstruction (the inverse of the
  // scramble). All four feed the same cube state (paintFacelet).
  const [viewMode, setViewMode] = useQueryState(
    'view',
    parseAsStringEnum<'net' | 'cube' | 'scramble' | 'recon'>(['net', 'cube', 'scramble', 'recon']).withDefault('net'),
  );
  const [reconInput, setReconInput] = useState('');
  // Paint-row secondary action: false → fast Kociemba solution (求解法),
  // true → optimal solve of the painted state via cubeopt/cloud (最优求解).
  const [paintOptimal, setPaintOptimal] = useState(false);

  const badTokenMsg = (tok: string) => t(
    `无法识别「${tok}」— 只支持面转 U R F D L B(可加 2 或 '),不支持宽块/转体/中层。`,
    `Unrecognized "${tok}" — only face turns U R F D L B (with optional 2 or ') are supported; no wide moves, rotations, or slices.`
  );

  // 'scramble' tab: one scramble per line (the raw `scrambles` textarea state,
  // also read directly by doSolveNow/cloudSolve for batch solving). Validates
  // every line; the canvas preview mirrors the first line via the effect below.
  const scrambleLines = useMemo(() => scrambles.split('\n').map(s => s.trim()).filter(Boolean), [scrambles]);
  const scrambleState = useMemo<{ err: string | null; moves: number; facelet: string | null }>(() => {
    for (let i = 0; i < scrambleLines.length; i++) {
      try {
        parseMoves(scrambleLines[i]);
      } catch (e) {
        const tok = (e as Error).message.replace(/^Bad move token:\s*/, '');
        return { moves: 0, facelet: null, err: scrambleLines.length > 1 ? t(`第 ${i + 1} 行:`, `Line ${i + 1}: `) + badTokenMsg(tok) : badTokenMsg(tok) };
      }
    }
    if (!scrambleLines[0]) return { err: null, moves: 0, facelet: null };
    const firstMoves = parseMoves(scrambleLines[0]);
    return { err: null, moves: firstMoves.length, facelet: cubieToFacelet(applySequence(solvedCubie(), firstMoves)) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrambleLines, t]);

  // 'recon' tab: a single reconstruction (solution) — the scramble is its inverse.
  const reconState = useMemo<{ facelet: string | null; err: string | null; moves: number }>(() => {
    const raw = reconInput.trim();
    if (!raw) return { facelet: null, err: null, moves: 0 };
    let moves: number[];
    try {
      moves = parseMoves(raw);
    } catch (e) {
      return { facelet: null, moves: 0, err: badTokenMsg((e as Error).message.replace(/^Bad move token:\s*/, '')) };
    }
    return { facelet: cubieToFacelet(applySequence(solvedCubie(), invertSequence(moves))), err: null, moves: moves.length };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reconInput, t]);

  // Keep the shared cube state in sync with a valid typed reconstruction, so
  // switching to a paint tab shows exactly what was typed (scramble mode syncs
  // via the pre-existing "mirror first scramble line" effect further below).
  useEffect(() => {
    if (viewMode === 'recon' && reconState.facelet) setPaintFacelet(reconState.facelet);
  }, [viewMode, reconState.facelet]);
  // Solve source in URL (?via): 'local' = download/generate the prun table
  // in-browser, 'cloud' = POST scrambles to api.cuberoot.me which solves with the
  // server-side opt6 table (no download, login-gated). Same optimal solution.
  const [solveSource, setSolveSource] = useQueryState(
    'via',
    parseAsStringEnum<'local' | 'cloud'>(['local', 'cloud']).withDefault('cloud'),
  );
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
      const ad = localStorage.getItem('cubeopt.autoDownload');
      if (ad !== null) setAutoDownloadTable(ad === '1');
    } catch { /* corrupt entries */ }
  }, []);
  useEffect(() => { if (mounted) persistItem('cubeopt.autoDownload', autoDownloadTable ? '1' : '0'); }, [mounted, autoDownloadTable]);

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

  async function runKociembaForState(facelet: string, mode: 'scramble' | 'solution' = 'scramble'): Promise<string | null> {
    const errMsg = validateFacelet(facelet);
    if (errMsg) {
      setStateInfo(t(`非法状态:${errMsg}`, `Invalid state: ${errMsg}`));
      return null;
    }
    const state = faceletToCubie(facelet);
    if (isSolvedCubie(state)) {
      setStateInfo(t('状态已是还原态,无需打乱。', 'State is already solved.'));
      setScrambles('');
      return null;
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
      const out = mode === 'solution' ? formatMoves(invertSequence(parseMoves(sol))) : sol;
      setScrambles(out);
      // The derived maneuver + its step count now live in the Logs box, so clear
      // the transient "solving…" line instead of showing a redundant result line.
      setStateInfo(null);
      return out;
    } finally {
      setKociembaBusy(false);
    }
  }

  const cancelKociemba = () => {
    kociembaCancelRef.current?.();
    setKociembaBusy(false);
    setStateInfo(t('已取消。', 'Cancelled.'));
  };

  const appendLog = (line: string) => setLogs((prev) => prev + line + '\n');

  // Single canonical Logs-box line format, shared by every path (fast Kociemba,
  // local cubeopt, cloud) so the box reads identically regardless of solve
  // source or the 最优 toggle: `打乱:… (Nh[*])` for a scramble, `求解:… (Nh[*])`
  // for a solution. `optimal` decides the trailing `*`.
  const logResultLine = (kind: 'scramble' | 'solution', alg: string, optimal: boolean) => {
    const tag = htmTag(alg, optimal);
    appendLog(kind === 'scramble'
      ? t(`打乱:${alg} ${tag}`, `Scramble: ${alg} ${tag}`)
      : t(`求解:${alg} ${tag}`, `Solution: ${alg} ${tag}`));
  };

  // Shared by both paint views (2D net + 3D cube): derive a scramble from the
  // painted state. Fast (Kociemba, non-optimal) by default; when the 最优 toggle
  // is on, derive the *optimal* scramble instead (via the optimal solver).
  const handlePaintSolve = async (fc: string) => {
    if (paintOptimal) { void handlePaintDeriveOptimalScramble(fc); return; }
    if (kociembaBusy) return;
    try {
      const out = await runKociembaForState(fc, 'scramble');
      if (out) logResultLine('scramble', out, false);
    } catch (e) {
      setStateInfo(t(`从状态求解失败:${(e as Error).message}`, `Solve from state failed: ${(e as Error).message}`));
    }
  };

  // Optimal 求打乱: derive a scramble (Kociemba, into the box), solve it optimally
  // (cubeopt/cloud), then invert the optimal solution back into the box — that
  // inverse is the fewest-move scramble reaching the painted state.
  const handlePaintDeriveOptimalScramble = async (fc: string) => {
    const optBusy = solveSource === 'cloud' ? cloudBusy : readyState === 'busy';
    if (kociembaBusy || optBusy) return;
    let scr: string | null;
    try {
      scr = await runKociembaForState(fc, 'scramble');
    } catch (e) {
      setStateInfo(t(`从状态求解失败:${(e as Error).message}`, `Solve from state failed: ${(e as Error).message}`));
      return;
    }
    if (!scr) return; // invalid or already solved — stateInfo already set
    optimalScrambleRef.current = true;
    if (solveSource === 'cloud') await cloudSolve([scr]);
    else startSolve(scr);
  };

  // Same as above but yields the solution (moves that solve the painted state)
  // instead of the scramble that produces it — the two are inverses of each other.
  const handlePaintDeriveSolution = async (fc: string) => {
    if (kociembaBusy) return;
    try {
      const out = await runKociembaForState(fc, 'solution');
      if (out) logResultLine('solution', out, false);
    } catch (e) {
      setStateInfo(t(`从状态求解失败:${(e as Error).message}`, `Solve from state failed: ${(e as Error).message}`));
    }
  };

  // Optimal variant of the above: derive a scramble reaching the painted state
  // (Kociemba, into the box) then hand it to the optimal solver (cubeopt/cloud).
  // The optimal solution lands in the solutions panel / logs like any other solve.
  const handlePaintSolveOptimal = async (fc: string) => {
    const optBusy = solveSource === 'cloud' ? cloudBusy : readyState === 'busy';
    if (kociembaBusy || optBusy) return;
    let scr: string | null;
    try {
      scr = await runKociembaForState(fc, 'scramble');
    } catch (e) {
      setStateInfo(t(`从状态求解失败:${(e as Error).message}`, `Solve from state failed: ${(e as Error).message}`));
      return;
    }
    if (!scr) return; // invalid or already solved — stateInfo already set
    optimalScrambleRef.current = false; // this path shows the solution, not a scramble
    if (solveSource === 'cloud') await cloudSolve([scr]);
    else startSolve(scr);
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
        const m = /handled (\d+)%,/.exec(line);
        if (m) { setProgress(parseInt(m[1], 10) / 100); return; } // drives the bar, not the log
        const solMatch = /^Solution found!:\s*(.+)$/i.exec(line);
        if (solMatch) {
          // Captured silently; emitted below as a clean localized line once the
          // cube finishes (so the Logs box format matches the cloud/fast paths).
          pendingSolutionsRef.current.push(solMatch[1].trim().replace(/\s+/g, ' '));
          return;
        }
        const finMatch = /^Cube(\d+)\s+finished\s+in\s/i.exec(line);
        if (finMatch) {
          const idx = parseInt(finMatch[1], 10);
          const alg = pendingSolutionsRef.current.shift();
          if (alg !== undefined) {
            // 求打乱(最优): show the optimal *scramble* (inverse of the solution).
            if (optimalScrambleRef.current && idx === 1) {
              optimalScrambleRef.current = false;
              const optScr = formatMoves(invertSequence(parseMoves(alg)));
              setScrambles(optScr);
              const n = optScr.trim().split(/\s+/).filter(Boolean).length;
              logResultLine('scramble', optScr, true);
              setStateInfo(t(`已求出 ${n} 步最优打乱。`, `Optimal scramble: ${n} moves.`));
            } else {
              logResultLine('solution', alg, true);
            }
          }
          return; // suppress the raw "CubeN finished in…" telemetry line
        }
        setLogs((prev) => prev + line + '\n'); // anything else (errors/status) stays visible
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

  const doSolveNow = (explicit?: string) => {
    const cleaned = (explicit ?? scrambles)
      .split('\n').map(s => s.trim()).filter(s => s.length > 0).join('\n');
    if (!cleaned) { alert(t('打乱不能为空', 'No scrambles')); return; }
    setScrambles(cleaned);
    setReadyState('busy');
    setLogs('');
    pendingSolutionsRef.current = [];
    workerRef.current?.postMessage({
      cmd: 'start solve',
      scramble: cleaned,
      n_threads: nThreads,
      n_group: nGroup,
      debug: 1,
    });
  };

  const startSolve = (explicit?: string) => {
    if (readyState === 'ready') {
      doSolveNow(explicit);
      return;
    }
    if (readyState === 'need-init') {
      const cleaned = (explicit ?? scrambles).split('\n').map(s => s.trim()).filter(Boolean).join('\n');
      if (!cleaned) { alert(t('打乱不能为空', 'No scrambles')); return; }
      pendingSolveScrambleRef.current = explicit;
      pendingSolveRef.current = true;
      generateTable();
    }
  };

  const CLOUD_MAX = 5;
  const HTM_TOKEN = /^[URFDLB][2']?$/;

  // Cloud solve: stream optimal solutions from api.cuberoot.me (server opt5 table).
  // Each solution is written to the Logs box in the same `求解:… (Nh*)` format as
  // the local worker + fast Kociemba paths, so all solve sources read identically.
  const cloudSolve = async (explicitLines?: string[]) => {
    const lines = (Array.isArray(explicitLines) ? explicitLines : scrambles.split('\n').map(s => s.trim()))
      .filter(Boolean);
    if (!lines.length) { alert(t('打乱不能为空', 'No scrambles')); return; }
    const bad = lines.find(l => l.split(/\s+/).some(tok => !HTM_TOKEN.test(tok)));
    if (bad) { alert(t('云端只支持纯面转打乱(U R F D L B,带 2 或 \'),不支持宽块/转体/中层。', 'Cloud solve only takes plain face-turn scrambles (U R F D L B with 2 or \').')); return; }
    if (lines.length > CLOUD_MAX) { alert(t(`云端一次最多 ${CLOUD_MAX} 条(本地下载表则不限)。`, `Cloud solve takes at most ${CLOUD_MAX} scrambles at once (local mode is unlimited).`)); return; }
    if (!user) { setCloudStatus(t('云端求解需登录(用右上角 WCA 登录)。', 'Cloud solve requires login (WCA, top-right).')); return; }

    setCloudBusy(true);
    setCloudStatus(t('连接云端求解…', 'Connecting…'));
    setLogs('');
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
      // streamApiUrl (not apiUrl): SSE must bypass the Next dev proxy, which
      // buffers the whole stream and would trip the no-response timeout in dev.
      const res = await fetch(streamApiUrl('/v1/scramble/optimal-solve'), {
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
              setLogs((prev) => prev + `#${(obj.i ?? 0) + 1} failed: ${obj.error ?? ''}\n`);
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
            const sol = obj.solution;
            done++;
            // 求打乱(最优): show the optimal *scramble* (inverse of the solution).
            if (optimalScrambleRef.current && obj.i === 0) {
              optimalScrambleRef.current = false;
              const optScr = formatMoves(invertSequence(parseMoves(sol)));
              setScrambles(optScr);
              const n = optScr.trim().split(/\s+/).filter(Boolean).length;
              logResultLine('scramble', optScr, true);
              setStateInfo(t(`已求出 ${n} 步最优打乱。`, `Optimal scramble: ${n} moves.`));
            } else {
              logResultLine('solution', sol, true);
            }
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
      const explicit = pendingSolveScrambleRef.current;
      pendingSolveScrambleRef.current = undefined;
      doSolveNow(explicit);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readyState]);

  const nGroupOptions = useMemo(() => {
    const out: number[] = [];
    for (let i = 1; i <= nThreads; i++) if (nThreads % i === 0) out.push(i);
    return out;
  }, [nThreads]);

  // Mirror the first scramble line onto the painted canvas: applying it to a
  // solved cube IS the state being solved, so the top net doubles as a live
  // preview. Painting diverges the canvas freely; 求打乱 writes back a scramble
  // whose state equals what's painted (worker inverts the solution), so the
  // round-trip causes no visual jump. Empty / partial lines leave the canvas.
  useEffect(() => {
    const first = scrambles.split('\n').map(s => s.trim()).find(Boolean);
    if (!first) return;
    try {
      setPaintFacelet(cubieToFacelet(applySequence(solvedCubie(), parseMoves(first))));
    } catch { /* partial or invalid maneuver — keep the current canvas */ }
  }, [scrambles]);

  const cloudMode = solveSource === 'cloud';
  const busy = cloudMode ? cloudBusy : readyState === 'busy';

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

      <section className="cubeopt-card">
        <div className="paint-view-toggle">
          <ListSelect
            clearable={false}
            value={viewMode}
            onChange={(v) => setViewMode(v as 'net' | 'cube' | 'scramble' | 'recon')}
            allLabel=""
            items={[
              { value: 'net', label: t('平面', '2D') },
              { value: 'cube', label: t('立体', '3D') },
              { value: 'scramble', label: t('打乱', 'Scramble') },
              { value: 'recon', label: t('复盘', 'Reconstruction') },
            ]}
          />
        </div>
        <div className="paint-wrap">
          {viewMode === 'cube' ? (
            <Interactive3DCube
              facelet={paintFacelet}
              onChange={setPaintFacelet}
              activeColor={paintColor}
              onActiveColorChange={setPaintColor}
              pixelSize={paintCanvasSize}
              onSolve={handlePaintSolve}
              solveLabel={{ zh: '求打乱', en: 'Scramble' }}
              plainSolve
              onSecondaryAction={paintOptimal ? handlePaintSolveOptimal : handlePaintDeriveSolution}
              secondaryActionLabel={{ zh: '求解法', en: 'Solve' }}
              secondaryActionTitle={paintOptimal
                ? { zh: '求最优解(cubeopt/云端):先从画的状态反推打乱,再求最少步解', en: 'Optimal solve (cubeopt/cloud): derive a scramble from the painted state, then find the fewest-move solution' }
                : { zh: '从上面画的状态求出把它解开的步骤(打乱的逆)', en: 'Derive the moves that solve the painted state (inverse of the scramble)' }}
              secondaryBusy={paintOptimal && (solveSource === 'cloud' ? cloudBusy : readyState === 'busy')}
              optimalToggle={{ value: paintOptimal, onChange: setPaintOptimal }}
            />
          ) : viewMode === 'net' ? (
            <InteractiveCubeNet
              facelet={paintFacelet}
              onChange={setPaintFacelet}
              activeColor={paintColor}
              onActiveColorChange={setPaintColor}
              pixelSize={paintCanvasSize}
              onSolve={handlePaintSolve}
              solveLabel={{ zh: '求打乱', en: 'Scramble' }}
              plainSolve
              onSecondaryAction={paintOptimal ? handlePaintSolveOptimal : handlePaintDeriveSolution}
              secondaryActionLabel={{ zh: '求解法', en: 'Solve' }}
              secondaryActionTitle={paintOptimal
                ? { zh: '求最优解(cubeopt/云端):先从画的状态反推打乱,再求最少步解', en: 'Optimal solve (cubeopt/cloud): derive a scramble from the painted state, then find the fewest-move solution' }
                : { zh: '从上面画的状态求出把它解开的步骤(打乱的逆)', en: 'Derive the moves that solve the painted state (inverse of the scramble)' }}
              secondaryBusy={paintOptimal && (solveSource === 'cloud' ? cloudBusy : readyState === 'busy')}
              optimalToggle={{ value: paintOptimal, onChange: setPaintOptimal }}
            />
          ) : viewMode === 'scramble' ? (
            <div className="move-input">
              <textarea
                className="move-input-area"
                rows={4}
                spellCheck={false}
                value={scrambles}
                onChange={(e) => setScrambles(e.target.value)}
                placeholder={t('每行一个打乱', 'One scramble per line')}
              />
              {scrambleState.err ? (
                <div className="move-input-err">{scrambleState.err}</div>
              ) : scrambleLines.length > 1 ? (
                <div className="move-input-hint">
                  {t(`${scrambleLines.length} 条打乱 · 已同步到方块(预览第 1 条)`, `${scrambleLines.length} scrambles · synced to the cube (previewing #1)`)}
                </div>
              ) : scrambleState.moves > 0 ? (
                <div className="move-input-hint">
                  {t(`${scrambleState.moves} 步打乱 · 已同步到方块`, `${scrambleState.moves}-move scramble · synced to the cube`)}
                </div>
              ) : null}
              <div className="move-input-actions">
                <BoolToggle value={paintOptimal} onChange={setPaintOptimal} label={t('最优', 'Optimal')} />
                {scrambleLines.length > 1 ? (
                  <button
                    className="btn"
                    disabled={!paintOptimal || !!scrambleState.err || busy}
                    onClick={() => { if (cloudMode) void cloudSolve(); else startSolve(); }}
                    title={!paintOptimal
                      ? t('多条打乱仅支持「最优」批量求解(cubeopt/云端)', 'Multiple scrambles require Optimal (cubeopt/cloud) batch solving')
                      : t('批量求最优解(cubeopt/云端)', 'Batch optimal solve (cubeopt/cloud)')}
                  >
                    {t('求解法', 'Solve')}
                  </button>
                ) : (<>
                  <button
                    className="btn"
                    disabled={!scrambleState.facelet || kociembaBusy || busy}
                    onClick={() => scrambleState.facelet && handlePaintSolve(scrambleState.facelet)}
                    title={t('求出到达该状态的打乱(最优开启时求最少步打乱)', 'Derive the scramble reaching this state (fewest-move when Optimal is on)')}
                  >
                    {t('求打乱', 'Scramble')}
                  </button>
                  <button
                    className="btn"
                    disabled={!scrambleState.facelet || kociembaBusy || busy}
                    onClick={() => {
                      if (!scrambleState.facelet) return;
                      (paintOptimal ? handlePaintSolveOptimal : handlePaintDeriveSolution)(scrambleState.facelet);
                    }}
                    title={paintOptimal
                      ? t('求最优解(cubeopt/云端)', 'Optimal solve (cubeopt/cloud)')
                      : t('求出把它解开的步骤(打乱的逆)', 'Derive the moves that solve this state (inverse of the scramble)')}
                  >
                    {t('求解法', 'Solve')}
                  </button>
                </>)}
              </div>
            </div>
          ) : (
            <div className="move-input">
              <textarea
                className="move-input-area"
                rows={3}
                spellCheck={false}
                value={reconInput}
                onChange={(e) => setReconInput(e.target.value)}
                placeholder={t('输入一个复盘(解法,即打乱的逆)', 'Type a reconstruction (the solution — inverse of the scramble)')}
              />
              {reconState.err ? (
                <div className="move-input-err">{reconState.err}</div>
              ) : reconState.moves > 0 ? (
                <div className="move-input-hint">
                  {t(`${reconState.moves} 步复盘 → 打乱取逆 · 已同步到方块`, `${reconState.moves}-move reconstruction → scramble is its inverse · synced to the cube`)}
                </div>
              ) : null}
              <div className="move-input-actions">
                <BoolToggle value={paintOptimal} onChange={setPaintOptimal} label={t('最优', 'Optimal')} />
                <button
                  className="btn"
                  disabled={!reconState.facelet || kociembaBusy || busy}
                  onClick={() => reconState.facelet && handlePaintSolve(reconState.facelet)}
                  title={t('求出到达该状态的打乱(最优开启时求最少步打乱)', 'Derive the scramble reaching this state (fewest-move when Optimal is on)')}
                >
                  {t('求打乱', 'Scramble')}
                </button>
                <button
                  className="btn"
                  disabled={!reconState.facelet || kociembaBusy || busy}
                  onClick={() => {
                    if (!reconState.facelet) return;
                    (paintOptimal ? handlePaintSolveOptimal : handlePaintDeriveSolution)(reconState.facelet);
                  }}
                  title={paintOptimal
                    ? t('求最优解(cubeopt/云端)', 'Optimal solve (cubeopt/cloud)')
                    : t('求出把它解开的步骤(打乱的逆)', 'Derive the moves that solve this state (inverse of the scramble)')}
                >
                  {t('求解法', 'Solve')}
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {(stateInfo || (cloudMode && cloudStatus)) && (
        <div className="cubeopt-info cubeopt-info-stack">
          {stateInfo && (
            <div className="ci-line">
              {kociembaBusy && <Loader2 size={14} className="spinning" />}
              <span className="ci-msg">{stateInfo}</span>
              {kociembaBusy && (
                <ClearButton variant="standalone" onClick={cancelKociemba}
                  ariaLabel={t('取消', 'Cancel')} title={t('取消', 'Cancel')} />
              )}
            </div>
          )}
          {cloudMode && cloudStatus && (
            <div className="ci-line">
              {cloudBusy && <Loader2 size={14} className="spinning" />}
              <span className="ci-msg">{cloudStatus}</span>
              {cloudBusy && <span className="cloud-timer">{Math.floor(cloudLiveMs / 1000)}s</span>}
              {cloudBusy && (
                <ClearButton variant="standalone" onClick={cancelCloud}
                  ariaLabel={t('取消', 'Cancel')} title={t('取消', 'Cancel')} />
              )}
            </div>
          )}
        </div>
      )}

      {paintOptimal && (
      <section className="cubeopt-card cubeopt-advanced">
        <>
            <div className="row">
              <PillToggle
                value={cloudMode}
                onChange={(v) => setSolveSource(v ? 'cloud' : 'local')}
                onLabel={t('云端', 'Cloud')}
                offLabel={t('本地', 'Local')}
                ariaLabel={t('求解来源', 'Solve via')}
                disabled={busy}
              />
              <InfoTooltip
                icon={HelpCircle}
                content={cloudMode ? t(
                  '云端用服务器的 opt6 表(1.9G)求最优解,解和本地各档完全一样,只是免你下载多 GB 的表。一次最多 5 条;多数几秒出解,最难的打乱(19-20 步最优)在 2 核服务器上可能要 1 分钟左右,串行排队。每个 IP 每 5 分钟最多 30 次,管理员不限。',
                  'The server solves with its opt6 table (1.9G). The solution is identical to every local table — this just saves you the multi-GB download. Up to 5 scrambles at once; most finish in seconds, but the hardest scrambles (19-20 move optimal) can take ~1 min on the 2-core server, processed in a serial queue. Each IP gets up to 30 requests per 5 min; admins are exempt.'
                ) : t(
                  '本地在浏览器里生成或下载一份求解表(30M~15G,存到本机,视下面 Solver 档位而定),不用登录、条数不限;下次打开可直接上传复用,免重新生成。同时求解:几个打乱一起攻,每个能分到的线程数=线程数÷此值;设为 1 最快但一次只出一个解,调大可同时出多个解但单个会变慢。',
                  'Local generates or downloads a solver table in your browser (30M~15G depending on the Solver tier below), stored on your machine — no login, no scramble-count limit; re-upload it next time to skip regenerating. Parallel solves: scrambles are attacked together, each getting (threads ÷ this value) threads — 1 is fastest per cube; raising it solves several at once but each one is slower.'
                )}
              />
              {!cloudMode && (<>
                <span className="lbl">Solver</span>
                <select className="ctl" value={solverName} disabled={readyState === 'busy'}
                  onChange={(e) => setSolverName(e.target.value)}>
                  {SOLVER_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.value} ({o.size})</option>
                  ))}
                </select>
                <BoolToggle
                  className="auto-dl"
                  value={autoDownloadTable}
                  onChange={setAutoDownloadTable}
                  label={t('自动下载', 'Auto-download')}
                />
                {saveDirName && (
                  <span className="save-dir">
                    {t('保存到', 'Save to')}: <code>{saveDirName}</code>
                  </span>
                )}
                {readyState === 'need-init' && (
                  <>
                    <button className="btn" onClick={generateTable}>{t('生成表', 'Generate Table')}</button>
                    <button className="btn" onClick={onUploadClick}>{t('上传表', 'Upload Table')}</button>
                  </>
                )}
                {readyState === 'ready' && (
                  <button className="btn" onClick={downloadTable}><Download size={14} /> {t('下载表', 'Download Table')}</button>
                )}
                <input ref={fileInputRef} type="file" style={{ display: 'none' }} onChange={onUploadFile} />
                <span className="lbl">{t('线程', 'Threads')}</span>
                <select className="ctl-sm" value={nThreads} onChange={(e) => setNThreads(parseInt(e.target.value, 10))}>
                  {Array.from({ length: typeof navigator !== 'undefined' ? (navigator.hardwareConcurrency || 4) : 4 }, (_, i) => i + 1).map(n => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
                <span className="lbl">{t('同时求解', 'Parallel solves')}</span>
                <select className="ctl-sm" value={nGroup} onChange={(e) => setNGroup(parseInt(e.target.value, 10))}>
                  {nGroupOptions.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </>)}
              {!cloudMode && busy && (
                <button className="btn-cancel" onClick={cancelCubeopt} title={
                  t('终止当前任务。会重建 wasm,prun 表会丢失需重新生成或上传。',
                    'Abort current task. Wasm will be reset; prun table is lost and must be re-generated or uploaded.')}>
                  <X size={14} /> {t('取消', 'Cancel')}
                </button>
              )}
            </div>
            {!cloudMode && progress >= 0 && (
              <div className="progress">
                <div className="progress-bar" style={{ width: `${Math.round(progress * 100)}%` }} />
              </div>
            )}
          </>
      </section>
      )}

      <section className="cubeopt-card">
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
  /* overflow-x: hidden 会把 overflow-y 隐式改算成 auto(CSS 组合规则),
     裁掉往上弹的 event-btn tooltip(第一排图标离容器顶部太近);clip 无此副作用。 */
  overflow-x: clip;
}
.cubeopt-header {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 0.25rem;
}
.cubeopt-header h1 { margin: 0; font-size: 1.6rem; font-weight: 600; }
.row-spacer { flex: 1; }
.cubeopt-advanced { padding-bottom: 0.25rem; }
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
.cubeopt-info-stack { flex-direction: column; align-items: stretch; gap: 0.4rem; }
.cubeopt-info-stack .ci-line { display: flex; align-items: center; gap: 0.5rem; }
.cubeopt-info-stack .ci-msg { flex: 1; }
.btn-cancel {
  display: inline-flex; align-items: center; gap: 0.3rem;
  background: #4a1f1f; border: 1px solid #8a3a3a; color: #ffaaaa;
  border-radius: 5px; cursor: pointer;
  font-weight: 600;
  padding: 0.35rem 0.8rem; font-size: 0.85rem;
}
.btn-cancel:hover { background: #5a2a2a; border-color: #c14747; }
.cubeopt-card {
  margin-bottom: 0.75rem;
}
.row {
  display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem;
  margin-bottom: 0.5rem;
}
.lbl {
  width: fit-content; font-size: 0.85rem; color: var(--text-muted, #999);
}
.ctl, .ctl-sm {
  background: var(--panel-sub, #2a2a2a); border: 1px solid var(--border, #444);
  color: var(--text); padding: 0.3rem 0.5rem; border-radius: 5px; font-size: 0.9rem;
  max-width: 100%; box-sizing: border-box;
}
.ctl { flex: 0 1 auto; width: fit-content; min-width: 0; }
.ctl-sm { flex: 0 1 auto; min-width: 4.5rem; }
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
.logs-area {
  width: 100%; box-sizing: border-box;
  background: var(--panel-sub, #1c1c1c); border: 1px solid var(--border, #444);
  color: var(--text); padding: 0.5rem; border-radius: 5px;
  font-family: ui-monospace, Menlo, Consolas, monospace;
  font-size: 0.85rem; resize: vertical;
}
.logs-area { white-space: pre; overflow-x: auto; }
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
.paint-wrap {
  display: flex; justify-content: center;
}
.paint-view-toggle {
  width: fit-content; max-width: 100%; margin: 0 auto 0.75rem;
}
/* 视图切换器:下拉贴合内容(默认 min-width:220px 是给带国旗/搜索的长列表的,这里 4 个短项不需要) */
.paint-view-toggle .list-select-popup {
  min-width: 0; width: max-content; right: auto;
}
.move-input {
  display: flex; flex-direction: column; gap: 0.6rem;
  width: 100%; max-width: 34rem;
}
.move-input-area {
  width: 100%; box-sizing: border-box; min-height: 4.5rem;
  background: var(--panel-sub, #1c1c1c); border: 1px solid var(--border, #444);
  color: var(--text); padding: 0.5rem 0.6rem; border-radius: 5px;
  font-family: var(--font-mono, ui-monospace, Menlo, Consolas, monospace);
  font-size: 0.95rem; line-height: 1.5; resize: vertical;
}
.move-input-area:focus { outline: none; border-color: var(--accent, #ff8800); }
.move-input-hint { font-size: 0.8rem; color: var(--text-muted, #888); line-height: 1.4; }
.move-input-err { font-size: 0.82rem; color: #ff8866; line-height: 1.4; }
.move-input-actions {
  display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem;
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
  .lbl { font-size: 0.78rem; }
  .ctl, .ctl-sm { font-size: 0.8rem; padding: 0.25rem 0.35rem; }
  .auto-dl { font-size: 0.75rem; }
  .auto-dl span { white-space: nowrap; }
  .btn, .btn-primary, .btn-cancel { font-size: 0.78rem; padding: 0.3rem 0.5rem; }
  .row { gap: 0.35rem; }
}
`;

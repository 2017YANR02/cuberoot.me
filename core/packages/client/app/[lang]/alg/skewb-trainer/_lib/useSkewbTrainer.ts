'use client';

// Master state hook for the SkewbSkills trainer. Mirrors the global state in
// annikastein/SkewbPage `skewbskillsscripts.js`:
//   - changescrlen        (FLT scramble queue: firstLayerList copy, optional shuffle)
//   - changescrlenAlg     (AlgT case pool: union of selected categories + ids, shuffled)
//   - changescrlenOL      (OLT: fresh single scramble each generate)
//   - ScramblePlusColour* (pop from END, refill when empty)
//   - timer / checkPB     (centiseconds; per-case PB keyed by displayed alg scramble, AlgT only)

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CATEGORIES, ALL_ALGS, type SkewbAlgCase, type SkewbGroup } from './algs';
import {
  firstLayerList,
  shuffle,
  buildAlgScramble,
  buildOneLookScramble,
} from './scramble';

export type SkewbMode = 'flt' | 'alg' | 'ol';
export type AlgSelectView = 'category' | 'id';

export interface FltSettings {
  length: number; // 1..7
  shuffle: boolean;
  anyColour: boolean;
  showImg: boolean;
}

export interface OlSettings {
  extra: number; // 1..7
  showImg: boolean;
}

// The 6 WCA skewb colours (matches SKEWB_DEFAULT_COLORS / source ShowScramble).
// FLT swatch picks one of these (anyColour) or always white.
const FLT_COLOURS = ['#FFFFFF', '#FFFF00', '#00FF00', '#FF0000', '#0000FF', '#FF8000']; // w y g r b o
const WHITE = '#FFFFFF';

const PI_KEYS = CATEGORIES.filter((c) => c.group === 'pi').map((c) => c.key);
const PEANUT_KEYS = CATEGORIES.filter((c) => c.group === 'peanut').map((c) => c.key);
const L_KEYS = CATEGORIES.filter((c) => c.group === 'l').map((c) => c.key);
const ALL_CAT_KEYS = CATEGORIES.map((c) => c.key);

const clamp17 = (n: number) => Math.max(1, Math.min(7, n));

function fmtTime(cs: number): string {
  // cs = total centiseconds. m:ss.cc
  const min = Math.floor(cs / 6000);
  const sec = Math.floor((cs % 6000) / 100);
  const hund = cs % 100;
  const pad = (v: number) => (v < 10 ? `0${v}` : `${v}`);
  return `${min}:${pad(sec)}.${pad(hund)}`;
}

export interface UseSkewbTrainer {
  mode: SkewbMode;
  setMode: (m: SkewbMode) => void;

  // FLT
  flt: FltSettings;
  setFltLength: (n: number) => void;
  setFltShuffle: (v: boolean) => void;
  setFltAnyColour: (v: boolean) => void;
  setFltShowImg: (v: boolean) => void;
  fltScramble: string;
  fltColour: string; // hex of the starting-colour swatch

  // AlgT
  algView: AlgSelectView;
  setAlgView: (v: AlgSelectView) => void;
  selectedCategories: Set<string>;
  selectedIds: Set<string>;
  toggleCategory: (key: string) => void;
  toggleId: (id: string) => void;
  toggleAll: () => void;
  togglePi: () => void;
  togglePeanut: () => void;
  toggleL: () => void;
  algShowImg: boolean;
  setAlgShowImg: (v: boolean) => void;
  algScramble: string;
  currentCase: SkewbAlgCase | null;
  hasAlgSelection: boolean;

  // OLT
  ol: OlSettings;
  setOlExtra: (n: number) => void;
  setOlShowImg: (v: boolean) => void;
  olScramble: string;

  // shared
  generate: () => void;
  // timer
  timeCs: number;
  timeText: string;
  timerState: 'idle' | 'running';
  toggleTimer: () => void;
  resetTimer: () => void;
  isPB: boolean;
  pbText: string | null; // best for current alg case, formatted (AlgT only)
}

export function useSkewbTrainer(): UseSkewbTrainer {
  const [mode, setModeState] = useState<SkewbMode>('flt');

  // ── FLT ──
  const [flt, setFlt] = useState<FltSettings>({
    length: 4,
    shuffle: true,
    anyColour: true,
    showImg: true,
  });
  const [fltScramble, setFltScramble] = useState('');
  const [fltColour, setFltColour] = useState(WHITE);
  // working queue (firstLayerList copy); pop from END.
  const fltQueueRef = useRef<string[]>([]);

  // ── AlgT ──
  const [algView, setAlgView] = useState<AlgSelectView>('category');
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(
    () => new Set(ALL_CAT_KEYS),
  );
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [algShowImg, setAlgShowImg] = useState(true);
  const [algScramble, setAlgScramble] = useState('');
  const [currentCase, setCurrentCase] = useState<SkewbAlgCase | null>(null);
  const algQueueRef = useRef<SkewbAlgCase[]>([]);

  // ── OLT ──
  const [ol, setOl] = useState<OlSettings>({ extra: 3, showImg: true });
  const [olScramble, setOlScramble] = useState('');

  // ── timer ──
  const [timeCs, setTimeCs] = useState(0);
  const [timerState, setTimerState] = useState<'idle' | 'running'>('idle');
  const [isPB, setIsPB] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const baseRef = useRef<number>(0); // performance.now() at start
  // per-case PB map: key = displayed alg scramble string -> best centiseconds
  const pbMapRef = useRef<Map<string, number>>(new Map());
  const [pbText, setPbText] = useState<string | null>(null);

  // ── effective AlgT case pool: union of selected categories + selected ids,
  //    deduped by id, in a stable order (categories first, then extra ids). ──
  const effectivePool = useMemo<SkewbAlgCase[]>(() => {
    const seen = new Set<string>();
    const pool: SkewbAlgCase[] = [];
    for (const cat of CATEGORIES) {
      if (!selectedCategories.has(cat.key)) continue;
      for (const c of cat.cases) {
        if (!seen.has(c.id)) {
          seen.add(c.id);
          pool.push(c);
        }
      }
    }
    for (const c of ALL_ALGS) {
      if (selectedIds.has(c.id) && !seen.has(c.id)) {
        seen.add(c.id);
        pool.push(c);
      }
    }
    return pool;
  }, [selectedCategories, selectedIds]);

  const hasAlgSelection = effectivePool.length > 0;

  // Invalidate the AlgT working queue whenever the selection changes.
  useEffect(() => {
    algQueueRef.current = [];
  }, [effectivePool]);

  // Invalidate the FLT queue when length/shuffle changes.
  useEffect(() => {
    fltQueueRef.current = [];
  }, [flt.length, flt.shuffle]);

  // ── mode setter (mirrors switching the visible panel) ──
  const setMode = useCallback((m: SkewbMode) => {
    setModeState(m);
  }, []);

  // ── FLT setters ──
  const setFltLength = useCallback((n: number) => {
    setFlt((s) => ({ ...s, length: clamp17(n) }));
  }, []);
  const setFltShuffle = useCallback((v: boolean) => setFlt((s) => ({ ...s, shuffle: v })), []);
  const setFltAnyColour = useCallback((v: boolean) => setFlt((s) => ({ ...s, anyColour: v })), []);
  const setFltShowImg = useCallback((v: boolean) => setFlt((s) => ({ ...s, showImg: v })), []);

  // ── OLT setters ──
  const setOlExtra = useCallback((n: number) => setOl((s) => ({ ...s, extra: clamp17(n) })), []);
  const setOlShowImg = useCallback((v: boolean) => setOl((s) => ({ ...s, showImg: v })), []);

  // ── AlgT selection actions ──
  const toggleCategory = useCallback((key: string) => {
    setSelectedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const toggleId = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Generic group toggle: if every key in the group is selected, clear them all;
  // otherwise select them all (mirrors the source toggle buttons).
  const toggleGroup = useCallback((keys: string[]) => {
    setSelectedCategories((prev) => {
      const allOn = keys.every((k) => prev.has(k));
      const next = new Set(prev);
      if (allOn) keys.forEach((k) => next.delete(k));
      else keys.forEach((k) => next.add(k));
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    // Toggle All also clears any id-grid selections so "All / none" is unambiguous.
    setSelectedCategories((prev) => {
      const allOn = ALL_CAT_KEYS.every((k) => prev.has(k));
      return allOn ? new Set<string>() : new Set(ALL_CAT_KEYS);
    });
    setSelectedIds(new Set());
  }, []);

  const togglePi = useCallback(() => toggleGroup(PI_KEYS), [toggleGroup]);
  const togglePeanut = useCallback(() => toggleGroup(PEANUT_KEYS), [toggleGroup]);
  const toggleL = useCallback(() => toggleGroup(L_KEYS), [toggleGroup]);

  // ── generators (mode-aware) ──

  const generateFlt = useCallback(() => {
    if (fltQueueRef.current.length === 0) {
      const list = firstLayerList(flt.length).slice(0);
      if (flt.shuffle) shuffle(list);
      fltQueueRef.current = list;
    }
    const q = fltQueueRef.current;
    const scr = q[q.length - 1] ?? '';
    q.pop();
    setFltScramble(scr);
    if (flt.anyColour) {
      setFltColour(FLT_COLOURS[Math.floor(Math.random() * 6)]);
    } else {
      setFltColour(WHITE);
    }
  }, [flt.length, flt.shuffle, flt.anyColour]);

  const generateAlg = useCallback(() => {
    if (effectivePool.length === 0) return;
    if (algQueueRef.current.length === 0) {
      const pool = effectivePool.slice(0);
      shuffle(pool);
      algQueueRef.current = pool;
    }
    const q = algQueueRef.current;
    const theCase = q[q.length - 1];
    q.pop();
    if (!theCase) return;
    const scr = buildAlgScramble(theCase.setup);
    setAlgScramble(scr);
    setCurrentCase(theCase);
  }, [effectivePool]);

  const generateOl = useCallback(() => {
    // changescrlenOL: random L2L setup + random first-layer of `extra` moves.
    const setup = ALL_ALGS[Math.floor(Math.random() * ALL_ALGS.length)].setup;
    const scr = buildOneLookScramble(setup, ol.extra);
    setOlScramble(scr);
  }, [ol.extra]);

  const generate = useCallback(() => {
    if (mode === 'flt') generateFlt();
    else if (mode === 'alg') generateAlg();
    else generateOl();
  }, [mode, generateFlt, generateAlg, generateOl]);

  // ── timer ──
  const stopTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    // final read from wall clock (rAF-free, drift-free centiseconds)
    const finalCs = Math.floor((performance.now() - baseRef.current) / 10);
    setTimeCs(finalCs);
    setTimerState('idle');
    // checkPB: AlgT mode only, keyed by the displayed alg scramble string.
    if (mode === 'alg' && algScramble) {
      const map = pbMapRef.current;
      const prev = map.get(algScramble);
      if (prev === undefined || finalCs <= prev) {
        map.set(algScramble, finalCs);
        setIsPB(true);
        setPbText(fmtTime(finalCs));
      } else {
        setIsPB(false);
        setPbText(fmtTime(prev));
      }
    }
  }, [mode, algScramble]);

  const startTimer = useCallback(() => {
    setIsPB(false);
    setTimeCs(0);
    baseRef.current = performance.now();
    setTimerState('running');
    intervalRef.current = setInterval(() => {
      setTimeCs(Math.floor((performance.now() - baseRef.current) / 10));
    }, 10);
  }, []);

  const toggleTimer = useCallback(() => {
    if (timerState === 'running') stopTimer();
    else startTimer();
  }, [timerState, stopTimer, startTimer]);

  const resetTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setTimeCs(0);
    setTimerState('idle');
    setIsPB(false);
    setPbText(null);
  }, []);

  // Reset PB banner + timer display when the displayed case changes (new scramble).
  useEffect(() => {
    setIsPB(false);
    setPbText(null);
  }, [algScramble, fltScramble, olScramble]);

  // cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return {
    mode,
    setMode,

    flt,
    setFltLength,
    setFltShuffle,
    setFltAnyColour,
    setFltShowImg,
    fltScramble,
    fltColour,

    algView,
    setAlgView,
    selectedCategories,
    selectedIds,
    toggleCategory,
    toggleId,
    toggleAll,
    togglePi,
    togglePeanut,
    toggleL,
    algShowImg,
    setAlgShowImg,
    algScramble,
    currentCase,
    hasAlgSelection,

    ol,
    setOlExtra,
    setOlShowImg,
    olScramble,

    generate,
    timeCs,
    timeText: fmtTime(timeCs),
    timerState,
    toggleTimer,
    resetTimer,
    isPB,
    pbText,
  };
}

export type SkewbGroupT = SkewbGroup;

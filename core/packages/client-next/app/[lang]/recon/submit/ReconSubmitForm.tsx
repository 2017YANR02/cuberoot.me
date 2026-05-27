'use client';
/**
 * /recon/submit — submit/edit a reconstruction.
 *
 * Full port of packages/client/src/pages/recon/ReconSubmitPage.tsx to Next.js.
 * Auto-fill (avg / single / record), duplicate check, WCIF round options,
 * BLD exec/memo derivation, scramble↔URL roundtrip, danger-zone delete,
 * collapsible sections, virtual keyboard, TwistyPlayer live preview.
 *
 * Intentionally deferred (Vite-only for now):
 *   - <AlgInput> with autoSpace + finger-trick contenteditable mode
 *     (we use a plain <textarea> instead — same data shape, simpler input)
 *   - <ReconAutofill> popup (Tab → cubedb-style comment + alg suggestions;
 *     depends on ~1.3k lines of cubing math deps)
 */

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams, useParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import type { ReconSolve } from '@cuberoot/shared';
import {
  getRecon, addRecon, updateRecon, deleteRecon,
  checkDuplicate, listRecons, resolveShortUrl,
} from '@/lib/recon-api';
import { Flag } from '@/components/Flag';
import { ClearButton } from '@/components/ClearButton';
import { CompPicker } from '@/components/CompPicker';
import { WcaPersonPicker } from '@/components/WcaPersonPicker';
import { EventSelect } from '@/components/EventSelect';
import { EventIcon } from '@/components/EventIcon/EventIcon';
import { RecordBadge } from '@/components/RecordBadge';
import { RecordSelect } from '@/components/RecordSelect';
import TwistySection from '@/components/TwistySection';
import CubeKeyboardSection from '@/components/CubeKeyboardSection';
import SolutionView from '@/components/SolutionView';
import { useAuthStore } from '@/lib/auth-store';
import { useIsMobile } from '@/hooks/useIsMobile';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import LangToggle from '@/components/LangToggle';
import { displayCuberName } from '@/lib/name-utils';
import { compNameZh, loadFlagData, flagDataVersion, personFlagIso2 } from '@/lib/country-flags';
import { localizeCompName } from '@/lib/comp-localize';
import { fetchCompRounds, type RoundFormat } from '@/lib/comp-wcif';
import { toWcaEventId, eventDisplayName } from '@/lib/wca-events';
import {
  parseTimeInput, formatTimeInput, computeWcaAverage,
  attemptsPerRound, localizeRound, isBldEvent,
} from '@/lib/recon-utils';
import { computeAllStats } from '@/lib/recon-stats';
import { fetchAttempts, fetchCubingAttempts, fetchResultRow } from '@/lib/wca-results-api';
import {
  cleanForPlayer, extractAlgFromText, syncPlayerToMoveCount, normalizeSolutionSlashes,
} from '@/lib/recon-alg-utils';
import { buildNormalizedSolution, hasWideMoveInCrossSection } from '@/lib/recon-norm-cross-extract';
import { encodeUrlAlg, decodeUrlAlg } from '@/lib/cubedb-url';
import { randomScrambleForEvent } from '@/lib/scramble-random';
import type { Comp } from '@/lib/comp-search';
import type { WcaPersonLite } from '@/lib/wca-api';
import { ArrowLeft, ArrowRightLeft, ChevronDown, ChevronRight, Home, Loader2, LogIn, LogOut, Shuffle } from 'lucide-react';
import '../recon.css';
import './recon_submit.css';

// ── Constants ──

const EVENTS = ['3x3', '2x2', '4x4', '5x5', '6x6', '7x7', '3bld', '4bld', '5bld', 'oh', 'sq1', 'pyra', 'mega', 'clock', 'skewb', 'fmc', 'mbld'];
const METHODS = ['CFOP', 'Roux', 'ZZ', 'Petrus', 'LBL', 'Mehta', 'ZB', 'Other'];
const ROUNDS_FALLBACK = ['1', '2', '3', 'f'];

const SOLVE_NUM_CAP_BY_FORMAT: Record<RoundFormat, number> = {
  '1': 1, '2': 2, '3': 3, '5': 5, 'a': 5, 'm': 3, 'h': 30,
};

/** N 轮赛 → round 选项数组。N=1→只有 Final,N=4→R1+R2+R3+F。 */
function roundsForCount(n: number): string[] {
  if (n <= 0) return ROUNDS_FALLBACK;
  if (n === 1) return ['f'];
  const arr: string[] = [];
  for (let i = 1; i < n; i++) arr.push(String(i));
  arr.push('f');
  return arr;
}

function toDateInput(val: string | null | undefined): string {
  if (!val) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val;
  if (val.length >= 10 && val[4] === '-') return val.slice(0, 10);
  const d = new Date(val);
  if (isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

/** Collapsible section — GitHub settings style */
function CollapsibleSection({ title, defaultOpen = false, children }: {
  title: string; defaultOpen?: boolean; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="submit-section">
      <button type="button" className="submit-section-header" aria-expanded={open} onClick={() => setOpen(o => !o)}>
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <span className="submit-section-title">{title}</span>
      </button>
      {open && <div className="submit-section-body">{children}</div>}
    </div>
  );
}

export default function ReconSubmitForm({ editId }: { editId?: string } = {}) {
  const router = useRouter();
  const params = useParams<{ lang?: string }>();
  const searchParams = useSearchParams();
  const { t, i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  useDocumentTitle('提交复盘', 'Submit Reconstruction');

  const langPrefix = params?.lang === 'zh' || params?.lang === 'en' ? `/${params.lang}` : (isZh ? '/zh' : '/en');

  const isEditing = !!editId;
  const fromId = !isEditing ? searchParams?.get('from') : null;
  const fromSolveNum = !isEditing ? searchParams?.get('solveNum') : null;
  const suggestTime = !isEditing ? searchParams?.get('suggestTime') : null;
  const suggestScramble = !isEditing ? searchParams?.get('suggestScramble') : null;
  const lockIdentity = isEditing || !!fromId;

  const authUser = useAuthStore(s => s.user);
  const login = useAuthStore(s => s.login);
  const logout = useAuthStore(s => s.logout);

  const [saving, setSaving] = useState(false);
  const [loadingEdit, setLoadingEdit] = useState(isEditing || !!fromId);
  const [flagVer, setFlagVer] = useState(flagDataVersion());

  useEffect(() => {
    loadFlagData().then(v => { if (v !== flagVer) setFlagVer(v); });
  }, [flagVer]);

  const solutionRef = useRef<HTMLTextAreaElement>(null);

  const [form, setForm] = useState<Partial<ReconSolve>>({
    official: true,
    event: '3x3',
    method: 'CFOP',
    person: '',
    personId: '',
    personCountry: '',
    comp: '',
    compWcaId: '',
    country: '',
    round: '',
    rawTime: undefined,
    average: undefined,
    solution: '',
    wcaScramble: '',
    optimalScramble: '',
    caption: '',
    note: '',
    videoUrl: '',
    cube: '',
    reconer: authUser?.name ?? '',
    reconerId: authUser?.wcaId ?? '',
    regionalSingleRecord: '',
    regionalAverageRecord: '',
    aoType: '',
  });

  const [timeInput, setTimeInput] = useState('');
  const [avgInput, setAvgInput] = useState('');
  const [execInput, setExecInput] = useState('');
  const [dupWarning, setDupWarning] = useState('');
  const [avgUserTouched, setAvgUserTouched] = useState(false);
  const [avgAutoSource, setAvgAutoSource] = useState<string | null>(null);
  const [avgLoading, setAvgLoading] = useState(false);
  const [timeUserTouched, setTimeUserTouched] = useState(false);
  const [timeAutoSource, setTimeAutoSource] = useState<string | null>(null);
  const [timeLoading, setTimeLoading] = useState(false);
  const [singleRecordUserTouched, setSingleRecordUserTouched] = useState(false);
  const [averageRecordUserTouched, setAverageRecordUserTouched] = useState(false);
  const [recordLoading, setRecordLoading] = useState(false);
  const [recordAutoSource, setRecordAutoSource] = useState<string | null>(null);
  const loadedAvgKeySnapshot = useRef<string | null>(null);
  const loadedTimeKeySnapshot = useRef<string | null>(null);
  const loadedRecordKeySnapshot = useRef<string | null>(null);
  const avgAutoFilledRef = useRef(false);
  const timeAutoFilledRef = useRef(false);
  const [compRounds, setCompRounds] = useState<Record<string, RoundFormat[]> | null>(null);
  const isMobile = useIsMobile();

  const setField = useCallback(<K extends keyof ReconSolve>(key: K, value: ReconSolve[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
  }, []);

  /** textarea 自适应高度 */
  const autoResize = useCallback((el: HTMLTextAreaElement) => {
    el.style.height = 'auto';
    void el.offsetHeight;
    const borderY = el.offsetHeight - el.clientHeight;
    el.style.height = (el.scrollHeight + borderY) + 'px';
  }, []);

  // ── Edit-mode load ──
  useEffect(() => {
    if (!isEditing || !editId) return;
    setLoadingEdit(true);
    getRecon(Number(editId)).then(solve => {
      const normalized = {
        ...solve,
        date: toDateInput(solve.date),
        reconDate: toDateInput(solve.reconDate),
      };
      setForm(normalized);
      const baseKey = `${solve.personId ?? ''}|${solve.event ?? ''}|${solve.comp ?? ''}|${solve.compWcaId ?? ''}|${solve.round ?? ''}`;
      loadedAvgKeySnapshot.current = baseKey;
      loadedTimeKeySnapshot.current = `${baseKey}|${solve.solveNum ?? ''}`;
      loadedRecordKeySnapshot.current = `${baseKey}|${solve.solveNum ?? ''}`;
      if (solve.rawTime != null) setTimeInput(formatTimeInput(solve.rawTime));
      if (solve.average != null) setAvgInput(formatTimeInput(solve.average));
      if (solve.execTime != null) setExecInput(formatTimeInput(solve.execTime));
      if (solutionRef.current && solve.solution) {
        solutionRef.current.value = solve.solution;
        autoResize(solutionRef.current);
      }
      setLoadingEdit(false);
    }).catch(() => setLoadingEdit(false));
  }, [editId, isEditing, autoResize]);

  // ── ?from= prefill ──
  useEffect(() => {
    if (isEditing || !fromId) return;
    setLoadingEdit(true);
    getRecon(Number(fromId)).then(src => {
      const targetSolveNum = fromSolveNum ? Number(fromSolveNum) : undefined;
      setForm(prev => ({
        ...prev,
        official: src.official,
        event: src.event,
        method: src.method,
        person: src.person,
        personId: src.personId,
        personCountry: src.personCountry,
        comp: src.comp,
        compWcaId: src.compWcaId,
        country: src.country,
        round: src.round,
        groupId: src.groupId,
        date: toDateInput(src.date),
        average: src.average,
        regionalAverageRecord: src.regionalAverageRecord,
        reconer: authUser?.name ?? src.reconer,
        reconerId: authUser?.wcaId ?? src.reconerId,
        reconDate: toDateInput(src.reconDate),
        solveNum: targetSolveNum ?? prev.solveNum,
        cube: src.cube,
        videoUrl: src.videoUrl,
      }));
      const fromBaseKey = `${src.personId ?? ''}|${src.event ?? ''}|${src.comp ?? ''}|${src.compWcaId ?? ''}|${src.round ?? ''}`;
      loadedAvgKeySnapshot.current = fromBaseKey;
      loadedTimeKeySnapshot.current = `${fromBaseKey}|${targetSolveNum ?? src.solveNum ?? ''}`;
      loadedRecordKeySnapshot.current = `${fromBaseKey}|${targetSolveNum ?? src.solveNum ?? ''}`;
      if (src.average != null) setAvgInput(formatTimeInput(src.average));
      if (suggestTime) {
        const n = parseFloat(suggestTime);
        if (!isNaN(n) && n > 0) {
          const formatted = formatTimeInput(n);
          setTimeInput(formatted);
          setForm(prev => ({ ...prev, value: formatted }));
        }
      }
      if (suggestScramble) {
        setForm(prev => ({ ...prev, wcaScramble: suggestScramble }));
      }
      setLoadingEdit(false);
    }).catch(() => setLoadingEdit(false));
  }, [fromId, fromSolveNum, isEditing, authUser, suggestTime, suggestScramble]);

  // ── URL-driven scramble/optimal/alg decode (mount only, create mode) ──
  useEffect(() => {
    if (isEditing || fromId) return;
    const scramble = decodeUrlAlg(searchParams?.get('scramble') || '');
    const optimal = decodeUrlAlg(searchParams?.get('optimal') || '');
    const solution = decodeUrlAlg(searchParams?.get('alg') || '');
    if (!scramble && !optimal && !solution) return;
    setForm(prev => ({
      ...prev,
      wcaScramble: scramble || prev.wcaScramble || '',
      optimalScramble: optimal || prev.optimalScramble || '',
      solution: solution || prev.solution || '',
    }));
    if (solutionRef.current && solution) {
      solutionRef.current.value = solution;
      autoResize(solutionRef.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Scramble/solution → URL (debounced) ──
  useEffect(() => {
    if (isEditing || fromId) return;
    if (typeof window === 'undefined') return;
    const timer = setTimeout(() => {
      const scr = encodeUrlAlg((form.wcaScramble || '').trim());
      const opt = encodeUrlAlg((form.optimalScramble || '').trim());
      const sol = encodeUrlAlg(form.solution || '');
      // Manual history.replaceState — preserves order: existing params -> scramble -> optimal -> alg
      const url = new URL(window.location.href);
      const next = new URLSearchParams();
      for (const [k, v] of url.searchParams) {
        if (k === 'scramble' || k === 'optimal' || k === 'alg') continue;
        next.append(k, v);
      }
      if (scr) next.set('scramble', scr);
      if (opt) next.set('optimal', opt);
      if (sol) next.set('alg', sol);
      const qs = next.toString();
      const newHref = url.pathname + (qs ? '?' + qs : '') + url.hash;
      if (newHref !== url.pathname + url.search + url.hash) {
        window.history.replaceState(window.history.state, '', newHref);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [form.wcaScramble, form.optimalScramble, form.solution, isEditing, fromId]);

  // ── CompPicker handlers ──
  const applyPickedComp = useCallback((c: Comp) => {
    const zh = isZh ? compNameZh(c.name) : '';
    setForm(prev => ({
      ...prev,
      comp: zh || c.name,
      compWcaId: c.id,
      country: (c.country || '').toLowerCase(),
      date: c.start_date,
    }));
  }, [isZh]);

  const clearPickedComp = useCallback(() => {
    setForm(prev => ({ ...prev, comp: '', compWcaId: '', country: '', date: '' }));
  }, []);

  // ── Live solution stats ──
  const stats = useMemo(() => {
    if (!form.solution) return null;
    const isBld = isBldEvent(form.event ?? '');
    const time = (isBld ? form.execTime : form.rawTime) ?? 0;
    return computeAllStats(form.solution, time);
  }, [form.solution, form.rawTime, form.execTime, form.event]);

  // ── Time / avg parse ──
  useEffect(() => {
    const parsed = parseTimeInput(timeInput);
    if (!isNaN(parsed)) setField('rawTime', parsed);
  }, [timeInput, setField]);

  useEffect(() => {
    const parsed = parseTimeInput(avgInput);
    if (!isNaN(parsed)) setField('average', parsed);
  }, [avgInput, setField]);

  // ── BLD exec parse ──
  useEffect(() => {
    if (!isBldEvent(form.event ?? '')) return;
    if (execInput.trim() === '') {
      setField('execTime', undefined);
      return;
    }
    const parsed = parseTimeInput(execInput);
    if (!isNaN(parsed)) setField('execTime', parsed);
  }, [execInput, form.event, setField]);

  // ── BLD memo = raw − exec ──
  useEffect(() => {
    if (!isBldEvent(form.event ?? '')) return;
    const raw = form.rawTime;
    const exec = form.execTime;
    if (raw == null || exec == null) {
      setField('memoTime', undefined);
      return;
    }
    const memo = raw - exec;
    setField('memoTime', memo >= 0 ? Number(memo.toFixed(3)) : undefined);
  }, [form.rawTime, form.execTime, form.event, setField]);

  // ── Clear BLD fields when switching to non-BLD ──
  useEffect(() => {
    if (isBldEvent(form.event ?? '')) return;
    if (execInput !== '') setExecInput('');
    if (form.execTime != null) setField('execTime', undefined);
    if (form.memoTime != null) setField('memoTime', undefined);
  }, [form.event, execInput, form.execTime, form.memoTime, setField]);

  // ── Comp change → fetch WCIF rounds ──
  useEffect(() => {
    if (!form.compWcaId) { setCompRounds(null); return; }
    let cancelled = false;
    fetchCompRounds(form.compWcaId).then(rounds => {
      if (!cancelled) setCompRounds(rounds);
    });
    return () => { cancelled = true; };
  }, [form.compWcaId]);

  const eventRoundFormats = useMemo<RoundFormat[] | null>(() => {
    if (!compRounds || !form.event) return null;
    const wcaId = toWcaEventId(form.event);
    const arr = compRounds[wcaId];
    return (arr && arr.length > 0) ? arr : null;
  }, [compRounds, form.event]);

  const roundOptions = useMemo(() => {
    if (!eventRoundFormats) return ROUNDS_FALLBACK;
    return roundsForCount(eventRoundFormats.length);
  }, [eventRoundFormats]);

  useEffect(() => {
    if (!form.round) return;
    if (!roundOptions.includes(form.round)) {
      setField('round', roundOptions[roundOptions.length - 1]);
    }
  }, [roundOptions, form.round, setField]);

  const solveNumOptions = useMemo(() => {
    let max = form.event ? attemptsPerRound(form.event) : 5;
    if (eventRoundFormats && form.round) {
      const idx = form.round === 'f' ? eventRoundFormats.length - 1 : Number(form.round) - 1;
      const fmt = eventRoundFormats[idx];
      if (fmt) max = SOLVE_NUM_CAP_BY_FORMAT[fmt];
    }
    return Array.from({ length: max }, (_, i) => i + 1);
  }, [form.event, form.round, eventRoundFormats]);

  useEffect(() => {
    if (form.solveNum != null && !solveNumOptions.includes(form.solveNum)) {
      setField('solveNum', undefined);
    }
  }, [solveNumOptions, form.solveNum, setField]);

  // ── Avg auto-fetch ──
  useEffect(() => {
    if (avgUserTouched) return;
    if (!form.personId || !form.event || !form.round) return;
    if (!form.comp && !form.compWcaId) return;

    const currentKey = `${form.personId}|${form.event}|${form.comp ?? ''}|${form.compWcaId ?? ''}|${form.round}`;
    if (loadedAvgKeySnapshot.current === currentKey) return;
    loadedAvgKeySnapshot.current = null;

    let cancelled = false;
    const timer = setTimeout(async () => {
      setAvgLoading(true);
      let foundAvg: number | null = null;
      let foundSource: string | null = null;
      try {
        if (form.comp) {
          try {
            const all = await listRecons(form.personId);
            if (cancelled) return;
            const sibling = all.find(s =>
              s.event === form.event &&
              s.comp === form.comp &&
              s.round === form.round &&
              (!isEditing || s.id !== Number(editId)) &&
              s.average != null
            );
            if (sibling && sibling.average != null) {
              foundAvg = sibling.average;
              foundSource = isZh ? `自动:同轮 #${sibling.solveNum ?? '?'}` : `auto: same round #${sibling.solveNum ?? '?'}`;
            }
          } catch { /* fall through */ }
        }
        if (foundAvg == null && form.compWcaId) {
          try {
            const att = await fetchAttempts(form.compWcaId, form.event!, form.round!, form.personId!);
            if (cancelled) return;
            if (att) {
              const a = computeWcaAverage(att, form.event!);
              if (a != null) {
                foundAvg = a;
                foundSource = isZh ? '自动:WCA' : 'auto: WCA';
              }
            }
          } catch { /* fall through */ }
        }
        if (foundAvg == null && form.compWcaId) {
          try {
            const att = await fetchCubingAttempts(form.compWcaId, form.event!, form.round!, form.personId!);
            if (cancelled) return;
            if (att) {
              const a = computeWcaAverage(att, form.event!);
              if (a != null) {
                foundAvg = a;
                foundSource = isZh ? '自动:cubing.com' : 'auto: cubing.com';
              }
            }
          } catch { /* fall through */ }
        }
        if (cancelled) return;
        if (foundAvg != null) {
          setAvgInput(formatTimeInput(foundAvg));
          setAvgAutoSource(foundSource);
          avgAutoFilledRef.current = true;
        } else {
          if (avgAutoFilledRef.current) setAvgInput('');
          setAvgAutoSource(null);
          avgAutoFilledRef.current = false;
        }
      } finally {
        if (!cancelled) setAvgLoading(false);
      }
    }, 300);
    return () => { cancelled = true; clearTimeout(timer); setAvgLoading(false); };
  }, [form.personId, form.event, form.comp, form.compWcaId, form.round, avgUserTouched, isEditing, editId, isZh]);

  // ── Single-time auto-fetch ──
  useEffect(() => {
    if (timeUserTouched) return;
    if (!form.personId || !form.event || !form.round || form.solveNum == null) return;
    if (!form.comp && !form.compWcaId) return;

    const currentKey = `${form.personId}|${form.event}|${form.comp ?? ''}|${form.compWcaId ?? ''}|${form.round}|${form.solveNum}`;
    if (loadedTimeKeySnapshot.current === currentKey) return;
    loadedTimeKeySnapshot.current = null;

    let cancelled = false;
    const timer = setTimeout(async () => {
      setTimeLoading(true);
      let foundTime: number | null = null;
      let foundSource: string | null = null;
      const idx = (form.solveNum ?? 1) - 1;
      try {
        if (form.comp) {
          try {
            const all = await listRecons(form.personId);
            if (cancelled) return;
            const sibling = all.find(s =>
              s.event === form.event &&
              s.comp === form.comp &&
              s.round === form.round &&
              s.solveNum === form.solveNum &&
              (!isEditing || s.id !== Number(editId)) &&
              s.rawTime != null
            );
            if (sibling && sibling.rawTime != null) {
              foundTime = sibling.rawTime;
              foundSource = isZh ? '自动:已录' : 'auto: existing';
            }
          } catch { /* fall through */ }
        }
        if (foundTime == null && form.compWcaId) {
          try {
            let attempts = await fetchAttempts(form.compWcaId, form.event!, form.round!, form.personId!);
            let label = 'WCA';
            if (!attempts) {
              attempts = await fetchCubingAttempts(form.compWcaId, form.event!, form.round!, form.personId!);
              label = 'cubing.com';
            }
            if (cancelled) return;
            if (attempts) {
              const v = attempts[idx];
              if (v != null && v >= 0) {
                foundTime = v;
                foundSource = isZh ? `自动:${label}` : `auto: ${label}`;
              }
            }
          } catch { /* fall through */ }
        }
        if (cancelled) return;
        if (foundTime != null) {
          setTimeInput(formatTimeInput(foundTime));
          setField('value', formatTimeInput(foundTime));
          setTimeAutoSource(foundSource);
          timeAutoFilledRef.current = true;
        } else {
          if (timeAutoFilledRef.current) {
            setTimeInput('');
            setField('value', '');
          }
          setTimeAutoSource(null);
          timeAutoFilledRef.current = false;
        }
      } finally {
        if (!cancelled) setTimeLoading(false);
      }
    }, 300);
    return () => { cancelled = true; clearTimeout(timer); setTimeLoading(false); };
  }, [form.personId, form.event, form.comp, form.compWcaId, form.round, form.solveNum, timeUserTouched, isEditing, editId, isZh, setField]);

  // ── Record marker auto-fetch (WCA only) ──
  useEffect(() => {
    if (singleRecordUserTouched && averageRecordUserTouched) return;
    if (!form.personId || !form.event || !form.round) return;
    if (!form.compWcaId) return;

    const currentKey = `${form.personId}|${form.event}|${form.comp ?? ''}|${form.compWcaId ?? ''}|${form.round}|${form.solveNum ?? ''}`;
    if (loadedRecordKeySnapshot.current === currentKey) return;
    loadedRecordKeySnapshot.current = null;

    let cancelled = false;
    const timer = setTimeout(async () => {
      setRecordLoading(true);
      try {
        const row = await fetchResultRow(form.compWcaId!, form.event!, form.round!, form.personId!);
        if (cancelled) return;
        if (!row) {
          if (!averageRecordUserTouched) setField('regionalAverageRecord', '');
          if (!singleRecordUserTouched) setField('regionalSingleRecord', '');
          setRecordAutoSource(null);
          return;
        }
        let avgFilled: string | null = null;
        let singleFilled: string | null = null;
        if (!averageRecordUserTouched) {
          const v = row.averageRecord ?? '';
          setField('regionalAverageRecord', v);
          if (v) avgFilled = v;
        }
        if (!singleRecordUserTouched) {
          const idx = form.solveNum != null ? form.solveNum - 1 : -1;
          const v = (idx === row.bestIndex && row.singleRecord) ? row.singleRecord : '';
          setField('regionalSingleRecord', v);
          if (v) singleFilled = v;
        }
        setRecordAutoSource((avgFilled || singleFilled) ? (isZh ? '自动:WCA' : 'auto: WCA') : null);
      } finally {
        if (!cancelled) setRecordLoading(false);
      }
    }, 300);
    return () => { cancelled = true; clearTimeout(timer); setRecordLoading(false); };
  }, [form.personId, form.event, form.comp, form.compWcaId, form.round, form.solveNum, singleRecordUserTouched, averageRecordUserTouched, setField, isZh]);

  // ── Duplicate detection ──
  useEffect(() => {
    if (!form.comp || !form.event || !form.round || form.solveNum == null) {
      setDupWarning('');
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const result = await checkDuplicate({
          comp: form.comp!,
          event: form.event!,
          round: form.round!,
          solveNum: String(form.solveNum!),
          personId: form.personId,
          person: form.person,
          excludeId: isEditing && editId ? Number(editId) : undefined,
        });
        if (result.exists) setDupWarning(`⚠️ Duplicate found (#${result.id})`);
        else setDupWarning('');
      } catch { setDupWarning(''); }
    }, 500);
    return () => clearTimeout(timer);
  }, [form.comp, form.event, form.round, form.solveNum, form.personId, form.person, isEditing, editId]);

  // ── Person picker handlers ──
  const handleSolverPick = useCallback((p: WcaPersonLite | null) => {
    if (!p) {
      setField('person', '');
      setField('personId', '');
      setField('personCountry', '');
    } else {
      setField('person', p.name);
      setField('personId', p.id);
      setField('personCountry', p.country_iso2 ?? '');
    }
  }, [setField]);

  const clearSolver = useCallback(() => handleSolverPick(null), [handleSolverPick]);

  // ── Reconer ──
  const [reconerCountry, setReconerCountry] = useState<string>('');

  useEffect(() => {
    if (!form.reconerId) {
      setReconerCountry(authUser?.country ?? '');
      return;
    }
    if (authUser && form.reconerId === authUser.wcaId) {
      setReconerCountry(authUser.country);
      return;
    }
    setReconerCountry(personFlagIso2(form.reconerId));
  }, [form.reconerId, authUser, flagVer]);

  const handleReconerPick = useCallback((p: WcaPersonLite | null) => {
    if (!p) {
      setField('reconer', '');
      setField('reconerId', '');
      setReconerCountry('');
    } else {
      setField('reconer', p.name);
      setField('reconerId', p.id);
      setReconerCountry(p.country_iso2 ?? '');
    }
  }, [setField]);

  const clearReconer = useCallback(() => handleReconerPick(null), [handleReconerPick]);

  // ── Auto-fill reconer from auth user (once on login) ──
  useEffect(() => {
    if (!authUser) return;
    setForm(p => ({
      ...p,
      reconer: p.reconer || authUser.name,
      reconerId: p.reconerId || authUser.wcaId,
    }));
  }, [authUser]);

  // ── Puzzle id ──
  const puzzle = useMemo(() => {
    if (!form.event) return '3x3x3';
    const ev = form.event;
    if (ev.includes('3x3') || ev.includes('3bld') || ev === 'fmc' || ev === 'oh') return '3x3x3';
    if (ev.includes('2x2')) return '2x2x2';
    if (ev.includes('4x4') || ev.includes('4bld')) return '4x4x4';
    if (ev.includes('5x5') || ev.includes('5bld')) return '5x5x5';
    if (ev.includes('6x6')) return '6x6x6';
    if (ev.includes('7x7')) return '7x7x7';
    if (ev === 'mega') return 'megaminx';
    if (ev === 'pyra') return 'pyraminx';
    if (ev === 'skewb') return 'skewb';
    if (ev === 'sq1') return 'square1';
    if (ev === 'clock') return 'clock';
    return '3x3x3';
  }, [form.event]);

  // ── Normalized cross toggle ──
  const [normalized, setNormalized] = useState(false);
  const canNormalize = useMemo(
    () => hasWideMoveInCrossSection(form.solution || ''),
    [form.solution],
  );
  useEffect(() => { if (!canNormalize && normalized) setNormalized(false); }, [canNormalize, normalized]);

  const displaySolution = useMemo(() => {
    const orig = form.solution || '';
    if (!normalized || !canNormalize) return orig;
    return buildNormalizedSolution(orig) ?? orig;
  }, [form.solution, normalized, canNormalize]);

  // ── Debounced player inputs ──
  const [debouncedScramble, setDebouncedScramble] = useState(form.wcaScramble || form.optimalScramble || '');
  const [debouncedSolution, setDebouncedSolution] = useState(displaySolution);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedScramble(form.wcaScramble || form.optimalScramble || '');
      setDebouncedSolution(displaySolution);
    }, 500);
    return () => clearTimeout(timer);
  }, [form.wcaScramble, form.optimalScramble, displaySolution]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const playerRef = useRef<any>(null);

  const handleCursorSync = useCallback((el: HTMLTextAreaElement) => {
    if (!playerRef.current) return;
    const offset = el.selectionStart;
    const fullText = el.value;
    const textBefore = fullText.substring(0, offset);
    const algBefore = extractAlgFromText(textBefore);
    const moves = algBefore.trim().split(/\s+/).filter(s => s.length > 0);
    syncPlayerToMoveCount(playerRef.current, moves.length);
  }, [playerRef]);

  useEffect(() => {
    if (solutionRef.current) handleCursorSync(solutionRef.current);
  }, [debouncedSolution, handleCursorSync]);

  // ── Submit ──
  const handleSubmit = async () => {
    if (!form.event || !form.person) {
      alert(t('recon.fillRequired'));
      return;
    }
    setSaving(true);
    try {
      const data: Partial<ReconSolve> = {
        ...form,
        date: toDateInput(form.date),
        reconDate: toDateInput(form.reconDate),
      };
      if (stats) {
        data.stm = stats.stm;
        data.tps = stats.tps;
        data.oll = stats.ollFull;
        data.pll = stats.pllFull;
        data.ollShort = stats.ollShort;
        data.pllShort = stats.pllShort;
        data.freePair = stats.freePair;
        data.yRot = stats.yRot;
        data.regrip = stats.regrip;
        data.lockup = stats.lockup;
        data.crossType = stats.crossType;
        data.crossStm = stats.crossStm;
        data.f2l = stats.f2l;
        data.ll = stats.ll;
        data.sMove = stats.sMove;
        data.crossColor = stats.crossColor;
      }
      if (isEditing && editId) {
        await updateRecon(Number(editId), data);
        router.push(`${langPrefix}/recon/${editId}`);
      } else {
        const created = await addRecon(data);
        router.push(`${langPrefix}/recon/${created.id}`);
      }
    } catch (err) {
      alert(`Error: ${(err as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  // ── Login gate ──
  if (!authUser) {
    return (
      <div className="recon-page">
        <div className="recon-page-header">
          <div>
            <Link href={`${langPrefix}/recon`} className="recon-back-link">
              <ArrowLeft size={14} /> {isZh ? '返回列表' : 'Back to list'}
            </Link>
            <h1>{isZh ? '提交复盘' : 'Submit Reconstruction'}</h1>
          </div>
          <LangToggle />
        </div>
        <div style={{ padding: 24, textAlign: 'center' }}>
          <p style={{ marginBottom: 16 }}>
            {isZh ? '提交复盘需要登录 WCA 账号。' : 'Submitting reconstructions requires a WCA account.'}
          </p>
          <button type="button" className="recon-btn" onClick={() => login()}>
            <LogIn size={14} /> {isZh ? '登录 WCA' : 'Sign in with WCA'}
          </button>
        </div>
      </div>
    );
  }

  if (loadingEdit) return <div className="recon-page"><div className="recon-loading">{t('common.loading')}</div></div>;

  // ── Person/reconer pill helpers ──
  const solverLite: WcaPersonLite | null = form.personId
    ? { id: form.personId, name: form.person ?? form.personId, country_iso2: form.personCountry ?? '' }
    : null;

  return (
    <div className="recon-page submit-page">
      <div className="submit-header">
        <div className="detail-header">
          <div className="detail-header-nav">
            <LangToggle />
            <button type="button" className="recon-btn recon-btn--ghost" onClick={() => logout()} title={authUser.wcaId}>
              <LogOut size={14} /> {displayCuberName(authUser.name, isZh)}
            </button>
          </div>
          <h1>{isEditing ? t('recon.editRecon') : t('recon.addRecon')}</h1>
        </div>
        {dupWarning && <div className="submit-warning">{dupWarning}</div>}
      </div>

      <div className="submit-layout">
        {!isMobile && (
          <div className="submit-player-pane">
            {form.event && form.event !== 'sq1' && (
              <TwistySection
                puzzle={puzzle}
                scramble={debouncedScramble}
                alg={cleanForPlayer(debouncedSolution)}
                playerRef={playerRef}
                fillPane
              />
            )}
          </div>
        )}

        <div className="submit-form-pane">
          <div className="submit-form">
            {/* === Competition info — default open === */}
            <CollapsibleSection
              title={isZh ? '比赛信息' : 'Competition'}
              defaultOpen
            >
              {/* Hero row: solver / event / time */}
              <div className="submit-hero">
                <div className={`submit-field ${form.personId ? 'submit-field-shrink' : ''}`}>
                  <span className="submit-label">{t('recon.solver')} *</span>
                  {solverLite ? (
                    <div className={`submit-solver-pill${lockIdentity ? ' submit-solver-pill--locked' : ''}`}>
                      <Flag iso2={solverLite.country_iso2} />
                      <span className="submit-solver-name">{displayCuberName(solverLite.name, isZh)}</span>
                      {!lockIdentity && <ClearButton onClick={clearSolver} isZh={isZh} preserveFocus />}
                    </div>
                  ) : (
                    <WcaPersonPicker
                      value={null}
                      onChange={handleSolverPick}
                      isZh={isZh}
                      placeholder={isZh ? '搜选手名 / WCA ID' : 'Search name / WCA ID'}
                    />
                  )}
                </div>
                <label className="submit-field">
                  <span className="submit-label">{t('recon.event')} *</span>
                  {lockIdentity ? (
                    <div className="submit-readonly-text">
                      {form.event ? <><EventIcon event={form.event} /> {eventDisplayName(form.event, isZh)}</> : ''}
                    </div>
                  ) : (
                    <EventSelect events={EVENTS} value={form.event ?? ''} onChange={(v) => setField('event', v)} />
                  )}
                </label>
                <label className="submit-field">
                  <span className="submit-label">{t('recon.time')}</span>
                  <input
                    type="text"
                    value={timeInput}
                    onChange={e => {
                      setTimeInput(e.target.value);
                      setTimeUserTouched(true);
                      setTimeAutoSource(null);
                      timeAutoFilledRef.current = false;
                    }}
                    readOnly={!!timeAutoSource}
                    className={timeAutoSource ? 'submit-input-locked' : undefined}
                    title={timeAutoSource ? (isZh ? '自动填充值不可编辑;改 选手/比赛/项目/轮次/第几把 以重新获取' : 'auto-filled, read-only; change person/comp/event/round/# to refetch') : undefined}
                  />
                </label>
                {isBldEvent(form.event ?? '') && (
                  <>
                    <label className="submit-field">
                      <span className="submit-label">{t('recon.memo')}</span>
                      <input
                        type="text"
                        value={form.memoTime != null ? formatTimeInput(form.memoTime) : ''}
                        readOnly
                        className="submit-input-locked"
                        title={isZh ? '自动派生 = 成绩 − 操作' : 'auto-derived = result − exec'}
                      />
                    </label>
                    <label className="submit-field">
                      <span className="submit-label">{t('recon.exec')}</span>
                      <input
                        type="text"
                        value={execInput}
                        onChange={e => setExecInput(e.target.value)}
                      />
                    </label>
                  </>
                )}
              </div>

              <div className="submit-row">
                <label className="submit-field submit-field-narrow">
                  <span className="submit-label">WCA</span>
                  {lockIdentity ? (
                    <div className="submit-readonly-text">{form.official ? 'WCA' : t('recon.badge.nonWca')}</div>
                  ) : (
                    <select value={form.official ? '1' : '0'} onChange={e => setField('official', e.target.value === '1')}>
                      <option value="1">WCA</option>
                      <option value="0">{t('recon.badge.nonWca')}</option>
                    </select>
                  )}
                </label>
                <div className={`submit-field ${form.compWcaId ? 'submit-field-shrink' : ''}`}>
                  <span className="submit-label">{t('recon.competition')}</span>
                  {form.compWcaId ? (
                    <div className={`submit-comp-pill${lockIdentity ? ' submit-comp-pill--locked' : ''}`}>
                      <Flag iso2={form.country || ''} />
                      <span className="submit-comp-name">{localizeCompName(form.compWcaId || '', form.comp || '', isZh)}</span>
                      {!lockIdentity && <ClearButton onClick={clearPickedComp} isZh={isZh} preserveFocus />}
                    </div>
                  ) : lockIdentity ? (
                    <div className="submit-readonly-text">{form.comp || ''}</div>
                  ) : (
                    <CompPicker
                      value={form.comp || ''}
                      onChange={(v) => setField('comp', v)}
                      onUrlPaste={(id) => setField('comp', id)}
                      onPick={applyPickedComp}
                      isZh={isZh}
                      disableSuggestions={!form.official}
                      presets={!form.official ? [
                        { icon: <Home size={14} />, label: isZh ? '家' : 'Home', value: isZh ? '家' : 'Home' },
                      ] : undefined}
                    />
                  )}
                </div>
              </div>

              <div className="submit-row">
                <label className="submit-field">
                  <span className="submit-label">{t('recon.round')}</span>
                  {lockIdentity ? (
                    <div className="submit-readonly-text">{form.round ? localizeRound(form.round, t) : ''}</div>
                  ) : (
                    <select value={form.round || ''} onChange={e => setField('round', e.target.value)}>
                      <option value="">{isZh ? '请选择' : 'Select…'}</option>
                      {roundOptions.map(r => <option key={r} value={r}>{localizeRound(r, t)}</option>)}
                    </select>
                  )}
                </label>
                <label className="submit-field">
                  <span className="submit-label">#</span>
                  {lockIdentity ? (
                    <div className="submit-readonly-text">{form.solveNum ?? ''}</div>
                  ) : (
                    <select
                      value={form.solveNum ?? ''}
                      onChange={e => setField('solveNum', e.target.value === '' ? undefined : Number(e.target.value))}
                    >
                      <option value="">{isZh ? '请选择' : 'Select…'}</option>
                      {solveNumOptions.map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                  )}
                </label>
                <label className="submit-field">
                  <span className="submit-label">{t('recon.group')}</span>
                  <input type="text" value={form.groupId || ''} onChange={e => setField('groupId', e.target.value)}
                    placeholder="A/B/C" maxLength={1} />
                </label>
                <label className="submit-field">
                  <span className="submit-label">{t('recon.date')}</span>
                  <input type="text" value={form.date || ''} onChange={e => setField('date', e.target.value)}
                    placeholder="yyyy-mm-dd" pattern="\d{4}-\d{2}-\d{2}" />
                </label>
              </div>

              <div className="submit-row">
                <label className="submit-field">
                  <span className="submit-label">{t('recon.average')}</span>
                  <input
                    type="text"
                    value={avgInput}
                    onChange={e => {
                      setAvgInput(e.target.value);
                      setAvgUserTouched(true);
                      setAvgAutoSource(null);
                      avgAutoFilledRef.current = false;
                    }}
                    readOnly={lockIdentity || !!avgAutoSource}
                    className={(lockIdentity || avgAutoSource) ? 'submit-input-locked' : undefined}
                    title={lockIdentity ? (isZh ? '身份字段不可改;如需修改请重建' : 'identity field, locked')
                      : avgAutoSource ? (isZh ? '自动填充值不可编辑;改选手/比赛/项目/轮次以重新获取' : 'auto-filled, read-only; change person/comp/event/round to refetch')
                      : undefined}
                  />
                  {avgLoading
                    ? <span className="submit-hint submit-hint-loading"><Loader2 size={12} /> {isZh ? '自动获取中…' : 'fetching…'}</span>
                    : avgAutoSource ? <span className="submit-hint">{avgAutoSource}</span> : null}
                </label>
                <label className="submit-field">
                  <span className="submit-label">{t('recon.single')}</span>
                  <input
                    type="text"
                    value={form.value ?? ''}
                    onChange={e => {
                      setField('value', e.target.value);
                      setTimeUserTouched(true);
                      setTimeAutoSource(null);
                      timeAutoFilledRef.current = false;
                    }}
                    readOnly={lockIdentity || !!timeAutoSource}
                    className={(lockIdentity || timeAutoSource) ? 'submit-input-locked' : undefined}
                    title={lockIdentity ? (isZh ? '身份字段不可改;如需修改请重建' : 'identity field, locked')
                      : timeAutoSource ? (isZh ? '自动填充值不可编辑;改 选手/比赛/项目/轮次/第几把 以重新获取' : 'auto-filled, read-only; change person/comp/event/round/# to refetch') : undefined}
                  />
                  {timeLoading
                    ? <span className="submit-hint submit-hint-loading"><Loader2 size={12} /> {isZh ? '自动获取中…' : 'fetching…'}</span>
                    : timeAutoSource ? <span className="submit-hint">{timeAutoSource}</span> : null}
                </label>
                <label className="submit-field">
                  <span className="submit-label">{t('recon.badge.singleRecord')}</span>
                  {lockIdentity ? (
                    <div className="submit-readonly-text">
                      {form.regionalSingleRecord
                        ? <RecordBadge record={form.regionalSingleRecord} variant="inline" iso2={form.personCountry} />
                        : '—'}
                    </div>
                  ) : (
                    <RecordSelect
                      value={form.regionalSingleRecord || ''}
                      onChange={(v) => { setField('regionalSingleRecord', v); setSingleRecordUserTouched(true); }}
                      personIso2={form.personCountry}
                    />
                  )}
                  {recordLoading
                    ? <span className="submit-hint submit-hint-loading"><Loader2 size={12} /> {isZh ? '自动获取中…' : 'fetching…'}</span>
                    : (!singleRecordUserTouched && form.regionalSingleRecord && recordAutoSource) ? <span className="submit-hint">{recordAutoSource}</span> : null}
                </label>
                <label className="submit-field">
                  <span className="submit-label">{t('recon.badge.averageRecord')}</span>
                  {lockIdentity ? (
                    <div className="submit-readonly-text">
                      {form.regionalAverageRecord
                        ? <RecordBadge record={form.regionalAverageRecord} variant="inline" iso2={form.personCountry} />
                        : '—'}
                    </div>
                  ) : (
                    <RecordSelect
                      value={form.regionalAverageRecord || ''}
                      onChange={(v) => { setField('regionalAverageRecord', v); setAverageRecordUserTouched(true); }}
                      personIso2={form.personCountry}
                    />
                  )}
                  {recordLoading
                    ? <span className="submit-hint submit-hint-loading"><Loader2 size={12} /> {isZh ? '自动获取中…' : 'fetching…'}</span>
                    : (!averageRecordUserTouched && form.regionalAverageRecord && recordAutoSource) ? <span className="submit-hint">{recordAutoSource}</span> : null}
                </label>
              </div>
            </CollapsibleSection>

            {/* WCA scramble */}
            <label className="submit-field submit-block">
              <span className="submit-label submit-label-with-action">
                <span>{t('recon.wcaScramble')}</span>
                {(() => {
                  const ev = form.event ?? '';
                  const supported = randomScrambleForEvent(ev) !== null;
                  return (
                    <button
                      type="button"
                      className="submit-label-btn"
                      disabled={!supported}
                      onClick={() => {
                        const s = randomScrambleForEvent(ev);
                        if (s) setField('wcaScramble', s);
                      }}
                      title={supported
                        ? (isZh ? '生成随机 WCA 打乱' : 'Generate random WCA scramble')
                        : (isZh ? '该项目暂不支持随机生成' : 'Not supported for this event')}
                      aria-label={isZh ? '生成随机打乱' : 'Generate random scramble'}
                    >
                      <Shuffle size={12} />
                    </button>
                  );
                })()}
              </span>
              <textarea
                rows={1}
                value={form.wcaScramble || ''}
                onChange={e => {
                  setField('wcaScramble', e.target.value);
                  autoResize(e.target);
                }}
                onInput={e => autoResize(e.target as HTMLTextAreaElement)}
                ref={el => { if (el) autoResize(el); }}
                style={{ overflow: 'hidden', resize: 'none' }}
              />
            </label>

            {/* Optimal scramble */}
            <label className="submit-field submit-block">
              <span className="submit-label">{t('recon.optimalScramble')}</span>
              <textarea
                rows={1}
                value={form.optimalScramble || ''}
                onChange={e => {
                  setField('optimalScramble', e.target.value);
                  autoResize(e.target);
                }}
                onInput={e => autoResize(e.target as HTMLTextAreaElement)}
                ref={el => { if (el) autoResize(el); }}
                style={{ overflow: 'hidden', resize: 'none' }}
              />
            </label>

            {/* Mobile: inline player between scramble and solution */}
            {isMobile && form.event && form.event !== 'sq1' && (
              <div className="submit-inline-player">
                <TwistySection
                  puzzle={puzzle}
                  scramble={debouncedScramble}
                  alg={cleanForPlayer(debouncedSolution)}
                  playerRef={playerRef}
                  fillPane
                />
              </div>
            )}

            {/* Solution */}
            <div className="submit-field submit-block">
              <span className="submit-label submit-label-row">
                <span>
                  {t('recon.solution')} *
                  {stats && stats.stm > 0 && (
                    <span className="submit-label-stats">
                      {' ('}{stats.stm} STM
                      {stats.tps > 0 && `, ${stats.tps} TPS`}
                      {')'}
                    </span>
                  )}
                </span>
                {canNormalize && (
                  <button
                    type="button"
                    className={`recon-cross-toggle${normalized ? ' active' : ''}`}
                    onClick={(e) => { e.preventDefault(); setNormalized(v => !v); }}
                    title={normalized ? t('recon.showOriginal') : t('recon.normalizeCross')}
                    tabIndex={-1}
                  >
                    <ArrowRightLeft size={12} />
                  </button>
                )}
              </span>
              {normalized ? (
                <SolutionView
                  text={displaySolution}
                  playerRef={playerRef}
                  crossNormalized={true}
                />
              ) : (
                <textarea
                  ref={solutionRef}
                  defaultValue={form.solution || ''}
                  className="submit-solution-textarea"
                  rows={6}
                  spellCheck={false}
                  inputMode={isMobile ? 'none' : undefined}
                  style={{ overflow: 'hidden', resize: 'none', fontFamily: 'monospace' }}
                  onInput={e => {
                    const el = e.target as HTMLTextAreaElement;
                    setField('solution', el.value);
                    autoResize(el);
                    handleCursorSync(el);
                  }}
                  onClick={e => handleCursorSync(e.target as HTMLTextAreaElement)}
                  onKeyUp={e => handleCursorSync(e.target as HTMLTextAreaElement)}
                  onBlur={() => {
                    const el = solutionRef.current;
                    if (!el) return;
                    const next = normalizeSolutionSlashes(el.value);
                    if (next !== el.value) {
                      el.value = next;
                      setField('solution', next);
                      autoResize(el);
                    }
                  }}
                  placeholder={isZh ? 'cross / F2L / OLL / PLL 每段一行,// 后面写注释' : 'cross / F2L / OLL / PLL one stage per line; // for comments'}
                />
              )}
            </div>

            {/* Virtual keyboard (mobile force-on, desktop toggleable) */}
            {!normalized && (
              <CubeKeyboardSection
                target={solutionRef}
                onInput={() => {
                  if (solutionRef.current) {
                    setField('solution', solutionRef.current.value);
                    autoResize(solutionRef.current);
                    handleCursorSync(solutionRef.current);
                  }
                }}
              />
            )}

            {/* === Metadata — default collapsed === */}
            <CollapsibleSection title={isZh ? '元数据' : 'Metadata'}>
              <div className="submit-row">
                <label className="submit-field submit-field-wide">
                  <span className="submit-label">{t('recon.videoUrl')}</span>
                  <textarea
                    value={form.videoUrl || ''}
                    onChange={e => setField('videoUrl', e.target.value)}
                    onBlur={async () => {
                      const cur = form.videoUrl || '';
                      if (!/b23\.tv/i.test(cur)) return;
                      const lines = cur.split('\n');
                      let changed = false;
                      const resolved = await Promise.all(lines.map(async line => {
                        const trimmed = line.trim();
                        const m = trimmed.match(/https?:\/\/b23\.tv\/\S+/i);
                        if (!m) return line;
                        try {
                          const res = await resolveShortUrl(m[0]);
                          if (res.url) {
                            changed = true;
                            return line.replace(m[0], res.url.split('?')[0]);
                          }
                        } catch { /* keep short link on failure */ }
                        return line;
                      }));
                      if (changed) setField('videoUrl', resolved.join('\n'));
                    }}
                    placeholder="https://www.youtube.com/watch?v=...&#10;https://www.bilibili.com/video/BV..."
                    rows={2}
                  />
                </label>
              </div>

              <div className="submit-row">
                <label className="submit-field">
                  <span className="submit-label">{t('recon.method')}</span>
                  <input
                    type="text"
                    list="recon-method-options"
                    value={form.method || ''}
                    onChange={e => setField('method', e.target.value)}
                  />
                  <datalist id="recon-method-options">
                    {METHODS.map(m => <option key={m} value={m} />)}
                  </datalist>
                </label>
                <label className="submit-field">
                  <span className="submit-label">{t('recon.cube')}</span>
                  <input type="text" value={form.cube || ''} onChange={e => setField('cube', e.target.value)} />
                </label>
                <label className="submit-field submit-field-wide">
                  <span className="submit-label">{t('recon.note')}</span>
                  <textarea
                    value={form.note || ''}
                    onChange={e => { setField('note', e.target.value); autoResize(e.target); }}
                    ref={el => { if (el) autoResize(el); }}
                    rows={1}
                    style={{ overflow: 'hidden', resize: 'none' }}
                  />
                </label>
              </div>

              <div className="submit-row">
                <div className={`submit-field ${(form.reconer || form.reconerId) ? 'submit-field-shrink' : ''}`}>
                  <span className="submit-label">{t('recon.reconstructor')}</span>
                  {(form.reconer || form.reconerId) ? (
                    <div className="submit-solver-pill">
                      <Flag iso2={reconerCountry || ''} />
                      <span className="submit-solver-name">{displayCuberName(form.reconer || '', isZh)}</span>
                      <ClearButton onClick={clearReconer} isZh={isZh} preserveFocus />
                    </div>
                  ) : (
                    <WcaPersonPicker
                      value={null}
                      onChange={handleReconerPick}
                      isZh={isZh}
                      placeholder={isZh ? '搜选手名 / WCA ID' : 'Search name / WCA ID'}
                    />
                  )}
                </div>
                <label className="submit-field">
                  <span className="submit-label">{t('recon.reconDate')}</span>
                  <input type="text" value={form.reconDate || ''} onChange={e => setField('reconDate', e.target.value)}
                    placeholder="yyyy-mm-dd" pattern="\d{4}-\d{2}-\d{2}" />
                </label>
              </div>
            </CollapsibleSection>

            {/* Submit buttons */}
            <div className="submit-actions">
              <button className="submit-btn submit-btn-primary" onClick={handleSubmit} disabled={saving}>
                {saving
                  ? t('recon.submitting')
                  : isEditing
                    ? t('recon.saveChanges')
                    : t('recon.submitRecon')}
              </button>
              <Link href={isEditing ? `${langPrefix}/recon/${editId}` : `${langPrefix}/recon`} className="submit-btn submit-btn-cancel">
                {t('recon.cancel')}
              </Link>
            </div>

            {/* Danger Zone */}
            {isEditing && editId && (
              <div className="submit-danger-zone">
                <div className="submit-danger-zone-header">{t('recon.dangerZone')}</div>
                <div className="submit-danger-zone-body">
                  <button
                    type="button"
                    className="submit-btn submit-btn-danger"
                    onClick={async () => {
                      if (!confirm(t('recon.confirmDelete'))) return;
                      try {
                        await deleteRecon(Number(editId));
                        router.push(`${langPrefix}/recon`);
                      } catch (err) {
                        alert(`Delete failed: ${(err as Error).message}`);
                      }
                    }}
                  >
                    {t('recon.delete')}
                  </button>
                  <span className="submit-danger-zone-hint">{t('recon.deleteIrreversible')}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

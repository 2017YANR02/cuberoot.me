'use client';
/**
 * /recon/submit — submit/edit a reconstruction.
 *
 * Full port of packages/client-vite/src/pages/recon/ReconSubmitPage.tsx to Next.js.
 * Auto-fill (avg / single / record), duplicate check, WCIF round options,
 * BLD exec/memo derivation, scramble↔URL roundtrip, danger-zone delete,
 * collapsible sections, virtual keyboard, TwistyPlayer live preview,
 * <AlgInput> autoSpace input + <ReconAutofill> Tab suggestions.
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
import { CountryInput } from '@/components/CountryInput/CountryInput';
import { WcaPersonPicker } from '@/components/WcaPersonPicker';
import { EventSelect } from '@/components/EventSelect';
import { RecordSelect } from '@/components/RecordSelect';
import TwistySection from '@/components/TwistySection';
import Sq1ReconPlayer from '@/components/Sq1ReconPlayer';
import CuberReconPlayer from '@/components/CuberReconPlayer';
import CubeKeyboardSection from '@/components/CubeKeyboardSection';
import AlgInput from '@/components/AlgInput';
import SolutionView from '@/components/SolutionView';
import ReconAutofill from '@/components/ReconAutofill';
import ReconReuseModal from './ReconReuseModal';
import ScramblePicker from './ScramblePicker';
import { useAuthStore } from '@/lib/auth-store';
import { useIsMobile } from '@/hooks/useIsMobile';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { displayCuberName } from '@/lib/name-utils';
import { compNameZh, loadFlagData, flagDataVersion, personFlagIso2 } from '@/lib/country-flags';
import { localizeCompName } from '@/lib/comp-localize';
import { fetchCompRounds, type RoundFormat } from '@/lib/comp-wcif';
import { toWcaEventId } from '@/lib/wca-events';
import {
  parseTimeInput, formatTimeInput, computeWcaAverage,
  attemptsPerRound, localizeRound, isBldEvent,
} from '@/lib/recon-utils';
import { computeAllStats } from '@/lib/recon-stats';
import { revalidateRecon } from '../revalidate-action';
import { fetchAttempts, fetchCubingAttempts, fetchResultRow, fetchCubingPrRanks, fetchScrambles, fetchScrambleGroups } from '@/lib/wca-results-api';
import { fetchPb, type PbByEvent } from '@/lib/wca-pb';
import {
  cleanForPlayer, extractAlgFromText, syncPlayerToMoveCount, normalizeSolutionSlashes,
  findIllegalNotationChars,
} from '@/lib/recon-alg-utils';
import { buildNormalizedSolution, hasWideMoveInCrossSection } from '@/lib/recon-norm-cross-extract';
import { encodeUrlAlg, decodeUrlAlg } from '@/lib/cubedb-url';
import { simPuzzleForReconEvent, buildSimQuery } from '@/lib/sim-recon-link';
import { parseSq1Tokens, formatScrambleForEvent } from '@/lib/sq1-svg';
import type { Comp } from '@/lib/comp-search';
import type { WcaPersonLite } from '@/lib/wca-api';
import { ArrowLeft, ArrowRightLeft, Box, ChevronDown, ChevronRight, History, Home, Loader2, LogIn, UserPlus, ListPlus } from 'lucide-react';
import '../recon.css';
import './recon_submit.css';
import { tr } from '@/i18n/tr';

// ── Constants ──

const EVENTS = ['3x3', '2x2', '4x4', '5x5', '6x6', '7x7', '3bld', '4bld', '5bld', 'oh', 'sq1', 'pyra', 'mega', 'clock', 'skewb', 'fmc', 'mbld'];
const METHODS = ['CFOP', 'Roux', 'ZZ', 'Petrus', 'LBL', 'Mehta', 'ZB', 'Other'];
const ROUNDS_FALLBACK = ['1', '2', '3', 'f'];
// 打乱未公示(拿不到真实分组)时的兜底分组选项:A~Z。
const ALPHA_GROUPS = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i));

const SOLVE_NUM_CAP_BY_FORMAT: Record<RoundFormat, number> = {
  '1': 1, '2': 2, '3': 3, '5': 5, 'a': 5, 'm': 3, 'h': 30,
};

// 复用以前的填写:从一条已有复盘里抽出的元数据字段。刻意排除每把都变的
// 成绩(rawTime)/单次(value)/单次纪录/WCA 打乱/最优打乱/解法,以及「第几把」
// —— 带上 # 会触发表单的自动获取,用那条数据回填那几项,违背保持空白的本意。
const REUSE_KEYS: (keyof ReconSolve)[] = [
  'official', 'event', 'method',
  'person', 'personId', 'personCountry', 'coPersons',
  'comp', 'compWcaId', 'country', 'city',
  'round', 'groupId', 'date',
  'average', 'aoType', 'regionalAverageRecord',
  'cube', 'videoUrl', 'note', 'caption',
  'reconer', 'reconerId', 'reconDate',
];
// 其中带可见高亮标记的字段(纯值 / 自动获取字段不标)
const REUSE_MARK_KEYS = [
  'person', 'event', 'official', 'comp', 'coPersons',
  'round', 'groupId', 'date',
  'videoUrl', 'method', 'cube', 'note',
  'reconer', 'reconDate',
];
// 选择器回填时不覆盖的字段:复盘者 / 复盘日期归属当前用户(表单已自动带入),
// 不应被挑中的那条(可能是别人复盘的)冒名顶替。
const REUSE_SKIP_ON_PICK = new Set<string>(['reconer', 'reconerId', 'reconDate']);
const hasMetaVal = (v: unknown) =>
  v != null && v !== '' && !(Array.isArray(v) && v.length === 0);
// 从一条已有复盘里抽出可复用的元数据(日期字段归一化为 yyyy-mm-dd)
function buildReuseMeta(src: Partial<ReconSolve>): Partial<ReconSolve> {
  const meta: Record<string, unknown> = {};
  for (const k of REUSE_KEYS) {
    const v = (src as Record<string, unknown>)[k];
    if (v != null) meta[k] = v;
  }
  if (typeof meta.date === 'string') meta.date = toDateInput(meta.date);
  if (typeof meta.reconDate === 'string') meta.reconDate = toDateInput(meta.reconDate);
  return meta as Partial<ReconSolve>;
}

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

  const langPrefix = params?.lang === 'zh' || params?.lang === 'en' ? `/${params.lang}` : ((i18n.language.startsWith('zh') ? '/zh' : '/en'));

  const isEditing = !!editId;
  const fromId = !isEditing ? searchParams?.get('from') : null;
  const fromSolveNum = !isEditing ? searchParams?.get('solveNum') : null;
  const suggestTime = !isEditing ? searchParams?.get('suggestTime') : null;
  const suggestScramble = !isEditing ? searchParams?.get('suggestScramble') : null;

  const authUser = useAuthStore(s => s.user);
  const login = useAuthStore(s => s.login);

  const [saving, setSaving] = useState(false);
  const [loadingEdit, setLoadingEdit] = useState(isEditing || !!fromId);
  const [flagVer, setFlagVer] = useState(flagDataVersion());

  // auth-store reads localStorage synchronously, so the server renders the
  // logged-out login gate while the hydrated client renders the form → DOM
  // mismatch. Gate on mount so the first client render matches the server
  // (login gate), then swap to real auth state. Same pattern as WcaAuth.tsx.
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

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
    coPersons: [],
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
  // 单次 (form.value) auto-fill is independent of 成绩 (timeInput): the user
  // may type a precise headline time, which must not block the official single.
  const [singleUserTouched, setSingleUserTouched] = useState(false);
  const [singleAutoSource, setSingleAutoSource] = useState<string | null>(null);
  const [singleRecordUserTouched, setSingleRecordUserTouched] = useState(false);
  const [averageRecordUserTouched, setAverageRecordUserTouched] = useState(false);
  const [recordLoading, setRecordLoading] = useState(false);
  const [recordAutoSource, setRecordAutoSource] = useState<string | null>(null);
  const loadedAvgKeySnapshot = useRef<string | null>(null);
  const loadedTimeKeySnapshot = useRef<string | null>(null);
  const loadedRecordKeySnapshot = useRef<string | null>(null);
  const avgAutoFilledRef = useRef(false);
  const timeAutoFilledRef = useRef(false);
  const singleAutoFilledRef = useRef(false);
  // WCA official scramble auto-fill (by comp / event / round / group / #).
  const [scrambleUserTouched, setScrambleUserTouched] = useState(false);
  const [scrambleAutoSource, setScrambleAutoSource] = useState<string | null>(null);
  const [scrambleLoading, setScrambleLoading] = useState(false);
  const loadedScrambleKeySnapshot = useRef<string | null>(null);
  const scrambleAutoFilledRef = useRef(false);
  const wcaScrambleRef = useRef<HTMLTextAreaElement>(null);
  const [compRounds, setCompRounds] = useState<Record<string, RoundFormat[]> | null>(null);
  // WCA scramble groups (A/B/C…) for the current comp/event/round.
  // null = 未解析(等加载 / 非 WCA 赛);[] = 无打乱数据;否则是分组列表。
  const [groupOptions, setGroupOptions] = useState<string[] | null>(null);
  const isMobile = useIsMobile();

  // 复用以前的填写:reuseOpen = 选择器弹窗开关;
  // reusedFields = 当前被「复用」带入、尚未编辑的字段 key(用于高亮标记)。
  const [reuseOpen, setReuseOpen] = useState(false);
  const [reusedFields, setReusedFields] = useState<Set<string>>(() => new Set());
  // 「从已有打乱选择」弹窗:null 关闭,否则标记打开的是哪个框。
  const [scramblePickerFor, setScramblePickerFor] = useState<null | 'wca' | 'optimal'>(null);

  const pruneReused = useCallback((keys: string | string[]) => {
    setReusedFields(prev => {
      if (prev.size === 0) return prev;
      const arr = Array.isArray(keys) ? keys : [keys];
      let changed = false;
      const next = new Set(prev);
      for (const k of arr) if (next.delete(k)) changed = true;
      return changed ? next : prev;
    });
  }, []);

  const setField = useCallback(<K extends keyof ReconSolve>(key: K, value: ReconSolve[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
    pruneReused(key as string);
  }, [pruneReused]);

  const reusedCls = (key: string) => (reusedFields.has(key) ? ' submit-field--reused' : '');

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
      loadedScrambleKeySnapshot.current = `${solve.compWcaId ?? ''}|${solve.event ?? ''}|${solve.round ?? ''}|${solve.groupId ?? ''}|${solve.solveNum ?? ''}`;
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
        coPersons: src.coPersons,
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

  // ── URL-driven event (handoff from /sim, mount only, create mode) ──
  useEffect(() => {
    if (isEditing || fromId) return;
    const ev = searchParams?.get('event');
    if (ev && EVENTS.includes(ev)) {
      setForm(prev => prev.event === ev ? prev : { ...prev, event: ev });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── WCA 成绩 prefill(选手页详细成绩「点击去复盘」带入,mount only, create 模式)──
  // 只填身份字段(选手/比赛/项目/轮次/第几把);单次/平均/纪录交给下面的自动获取逻辑
  // (按 person+comp+event+round+solveNum 抓 WCA/已录,per-event 正确)。
  useEffect(() => {
    if (isEditing || fromId) return;
    const personId = searchParams?.get('personId');
    if (!personId) return;
    const ev = searchParams?.get('event') || '';
    const round = searchParams?.get('round') || '';
    const solveNumRaw = searchParams?.get('solveNum');
    const sn = solveNumRaw ? Number(solveNumRaw) : NaN;
    const dateRaw = searchParams?.get('date') || '';
    setForm(prev => ({
      ...prev,
      official: searchParams?.get('official') === '1' ? true : prev.official,
      event: EVENTS.includes(ev) ? ev : prev.event,
      person: searchParams?.get('person') || prev.person,
      personId,
      personCountry: searchParams?.get('personCountry') || prev.personCountry,
      comp: searchParams?.get('comp') || prev.comp,
      compWcaId: searchParams?.get('compWcaId') || prev.compWcaId,
      country: searchParams?.get('country') || prev.country,
      round: round || prev.round,
      solveNum: !isNaN(sn) ? sn : prev.solveNum,
      date: dateRaw ? toDateInput(dateRaw) : prev.date,
      reconer: authUser?.name ?? prev.reconer,
      reconerId: authUser?.wcaId ?? prev.reconerId,
    }));
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
        // EXEMPT from nuqs: this writes a user-shareable cubedb-style deep link
        // whose exact shape is a contract — params are encodeUrlAlg-serialized
        // (space→_, '→-, asymmetric in // comments) and existing params are kept
        // verbatim first, then scramble→optimal→alg. nuqs's parseAsString would
        // percent-encode instead, changing the link format; and this write is
        // hard-gated off in edit / ?from= prefill modes (an always-on
        // useQueryStates hook can't reproduce that suppression).
        // eslint-disable-next-line no-restricted-syntax, no-restricted-globals
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
    pruneReused(['comp', 'date']);
  }, [isZh, pruneReused]);

  const clearPickedComp = useCallback(() => {
    setForm(prev => ({ ...prev, comp: '', compWcaId: '', country: '', date: '' }));
    pruneReused(['comp', 'date']);
  }, [pruneReused]);

  // ── 复用以前的填写 ──
  // 从选择器挑中的一条复盘回填元数据:抽出可复用字段,跳过复盘者 / 复盘日期
  // (归当前用户,表单已带入),设平均输入并高亮带入字段。
  const applyReuse = useCallback((solve: Partial<ReconSolve>) => {
    const meta = buildReuseMeta(solve) as Record<string, unknown>;
    const applied: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(meta)) {
      if (!REUSE_SKIP_ON_PICK.has(k)) applied[k] = v;
    }
    setForm(prev => ({ ...prev, ...applied }));
    if (applied.average != null) setAvgInput(formatTimeInput(applied.average as number));
    const marks = new Set<string>();
    for (const k of REUSE_MARK_KEYS) {
      if (!REUSE_SKIP_ON_PICK.has(k) && hasMetaVal(applied[k])) marks.add(k);
    }
    setReusedFields(marks);
    setReuseOpen(false);
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

  // ── Comp / event / round change → resolve scramble groups ──
  // 多分组 → 下拉强制选择(边框变红提醒);单分组 → 自动填入。
  useEffect(() => {
    if (!form.compWcaId || !form.event || !form.round) { setGroupOptions(null); return; }
    let cancelled = false;
    setGroupOptions(null);
    fetchScrambleGroups(form.compWcaId, form.event, form.round).then(groups => {
      if (cancelled) return;
      const list = groups ?? [];
      setGroupOptions(list);
      setForm(prev => {
        if (list.length === 1 && prev.groupId !== list[0]) return { ...prev, groupId: list[0] };
        if (list.length > 1 && prev.groupId && !list.includes(prev.groupId)) return { ...prev, groupId: '' };
        return prev;
      });
    });
    return () => { cancelled = true; };
  }, [form.compWcaId, form.event, form.round]);

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
              foundSource = (isZh ? `自动:同轮 #${sibling.solveNum ?? '?'}` : `auto: same round #${sibling.solveNum ?? '?'}`);
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
                foundSource = tr({ zh: '自动:WCA', en: 'auto: WCA'
                });
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
                foundSource = tr({ zh: '自动:cubing.com', en: 'auto: cubing.com'
                });
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

  // ── Single-time auto-fetch (fills 成绩 + 单次 independently) ──
  useEffect(() => {
    if (timeUserTouched && singleUserTouched) return;
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
              foundSource = tr({ zh: '自动:已录', en: 'auto: existing'
            });
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
                foundSource = (isZh ? `自动:${label}` : `auto: ${label}`);
              }
            }
          } catch { /* fall through */ }
        }
        if (cancelled) return;
        if (foundTime != null) {
          const formatted = formatTimeInput(foundTime);
          if (!timeUserTouched) {
            setTimeInput(formatted);
            setTimeAutoSource(foundSource);
            timeAutoFilledRef.current = true;
          }
          if (!singleUserTouched) {
            setField('value', formatted);
            setSingleAutoSource(foundSource);
            singleAutoFilledRef.current = true;
          }
        } else {
          if (!timeUserTouched) {
            if (timeAutoFilledRef.current) setTimeInput('');
            setTimeAutoSource(null);
            timeAutoFilledRef.current = false;
          }
          if (!singleUserTouched) {
            if (singleAutoFilledRef.current) setField('value', '');
            setSingleAutoSource(null);
            singleAutoFilledRef.current = false;
          }
        }
      } finally {
        if (!cancelled) setTimeLoading(false);
      }
    }, 300);
    return () => { cancelled = true; clearTimeout(timer); setTimeLoading(false); };
  }, [form.personId, form.event, form.comp, form.compWcaId, form.round, form.solveNum, timeUserTouched, singleUserTouched, isEditing, editId, isZh, setField]);

  // ── WCA official scramble auto-fill (by comp / event / round / group / #) ──
  // Pulls the exact scramble the player got — same data as /scramble/gen. Only
  // for official WCA comps (compWcaId set); blocked once the user types their
  // own. 多分组的轮次必须先选分组,否则不自动给打乱(避免误填到错的组)。
  useEffect(() => {
    if (scrambleUserTouched) return;
    if (!form.compWcaId || !form.event || !form.round || form.solveNum == null) return;

    // 分组尚未解析 → 等加载;多分组且未选 → 留空等用户选(清掉自动/URL 带入的猜测打乱;
    // 此处已过 scrambleUserTouched 守卫,wcaScramble 必非用户手输,可安全清空)。
    if (groupOptions === null) return;
    if (groupOptions.length > 1 && !form.groupId) {
      setForm(prev => prev.wcaScramble ? { ...prev, wcaScramble: '' } : prev);
      setScrambleAutoSource(null);
      scrambleAutoFilledRef.current = false;
      loadedScrambleKeySnapshot.current = null;
      return;
    }

    const currentKey = `${form.compWcaId}|${form.event}|${form.round}|${form.groupId ?? ''}|${form.solveNum}`;
    if (loadedScrambleKeySnapshot.current === currentKey) return;
    loadedScrambleKeySnapshot.current = null;

    let cancelled = false;
    const timer = setTimeout(async () => {
      setScrambleLoading(true);
      try {
        const arr = await fetchScrambles(form.compWcaId!, form.event!, form.round!, form.groupId || undefined);
        if (cancelled) return;
        const idx = form.solveNum! - 1;
        const raw = arr && idx >= 0 && idx < arr.length ? arr[idx] : null;
        // SQ1 → compact `1/06/33/…` shorthand (matches /sim & /scramble/gen);
        // other events pass through. parseSq1Tokens round-trips the compact form.
        const scr = raw ? formatScrambleForEvent(form.event!, raw) : null;
        if (scr) {
          setField('wcaScramble', scr);
          setScrambleAutoSource(tr({ zh: '自动:WCA', en: 'auto: WCA'
        }));
          scrambleAutoFilledRef.current = true;
        } else {
          if (scrambleAutoFilledRef.current) setField('wcaScramble', '');
          setScrambleAutoSource(null);
          scrambleAutoFilledRef.current = false;
        }
      } finally {
        if (!cancelled) setScrambleLoading(false);
      }
    }, 300);
    return () => { cancelled = true; clearTimeout(timer); setScrambleLoading(false); };
  }, [form.compWcaId, form.event, form.round, form.groupId, form.solveNum, groupOptions, scrambleUserTouched, setField, isZh]);

  // Resize the WCA scramble textarea when its value changes programmatically.
  useEffect(() => {
    if (wcaScrambleRef.current) autoResize(wcaScrambleRef.current);
  }, [form.wcaScramble, autoResize]);

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
        // WCA's regional_record field only carries WR/CR/NR. PR (personal
        // record) isn't stored there. Get the exact PR rank (PR / PR2 / PR3 …)
        // from cubing.com live data — same `pS`/`pA` the /comp page uses; fall
        // back to the WCA personal-best API for a rank-1 PR when cubing.com
        // lacks the comp. Official records take priority over PR.
        const idx = form.solveNum != null ? form.solveNum - 1 : -1;
        const isBestSolve = idx === row.bestIndex && row.bestIndex >= 0;
        const bestSec = isBestSolve ? row.attempts[row.bestIndex] : null;
        const bestCs = bestSec != null && bestSec > 0 ? Math.round(bestSec * 100) : null;
        const avgSec = computeWcaAverage(row.attempts, form.event!);
        const avgCs = avgSec != null ? Math.round(avgSec * 100) : null;

        const needPr = (!averageRecordUserTouched && !row.averageRecord)
          || (!singleRecordUserTouched && !row.singleRecord);
        let ranks: { pS: number | null; pA: number | null } | null = null;
        let pbEvent: PbByEvent[string] | undefined;
        if (needPr) {
          ranks = await fetchCubingPrRanks(form.compWcaId!, form.event!, form.round!, form.personId!, bestCs, avgCs);
          if (cancelled) return;
          if (!ranks) {
            pbEvent = (await fetchPb(form.personId!))?.[toWcaEventId(form.event!)];
            if (cancelled) return;
          }
        }
        const prTag = (rank: number | null | undefined): string =>
          rank == null ? '' : (rank <= 1 ? 'PR' : `PR${rank}`);

        let avgFilled: string | null = null;
        let singleFilled: string | null = null;
        if (!averageRecordUserTouched) {
          let v = row.averageRecord ?? '';
          if (!v) {
            if (ranks?.pA != null) v = prTag(ranks.pA);
            else if (pbEvent?.average?.best != null && avgCs != null && avgCs <= pbEvent.average.best) v = 'PR';
          }
          setField('regionalAverageRecord', v);
          if (v) avgFilled = v;
        }
        if (!singleRecordUserTouched) {
          let v = (isBestSolve && row.singleRecord) ? row.singleRecord : '';
          if (!v && isBestSolve) {
            if (ranks?.pS != null) v = prTag(ranks.pS);
            else if (pbEvent?.single?.best != null && bestCs != null && bestCs <= pbEvent.single.best) v = 'PR';
          }
          setField('regionalSingleRecord', v);
          if (v) singleFilled = v;
        }
        setRecordAutoSource((avgFilled || singleFilled) ? tr({ zh: '自动:WCA', en: 'auto: WCA'
                }) : null);
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

  // ── Co-solvers (共同完成者) ──
  const [addingCo, setAddingCo] = useState(false);
  const addCoPerson = useCallback((p: WcaPersonLite | null) => {
    if (!p) return;
    setForm(prev => {
      const list = prev.coPersons ?? [];
      // 跳过已是主选手 / 已添加过的
      if (p.id && (p.id === prev.personId || list.some(c => c.id === p.id))) return prev;
      return { ...prev, coPersons: [...list, { name: p.name, id: p.id, country: p.country_iso2 ?? '' }] };
    });
    setAddingCo(false);
    pruneReused('coPersons');
  }, [pruneReused]);
  const removeCoPerson = useCallback((idx: number) => {
    setForm(prev => ({ ...prev, coPersons: (prev.coPersons ?? []).filter((_, i) => i !== idx) }));
    pruneReused('coPersons');
  }, [pruneReused]);

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

  // NxN puzzles can render with either engine (cuber / cubing.js); everything
  // else is fixed (SQ1 → cuber-only Sq1ReconPlayer, twisty/clock → cubing.js).
  const isNxnPuzzle = /^[2-7]x[2-7]x[2-7]$/.test(puzzle);
  const nxnOrder = isNxnPuzzle ? parseInt(puzzle, 10) : 3;

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

  // Render engine for NxN previews — cuber (the /sim look, back view forced) vs
  // cubing.js. User-selectable; persisted. Other puzzles ignore it.
  const [reconEngine, setReconEngine] = useState<'cuber' | 'cubing'>(() => {
    if (typeof window === 'undefined') return 'cuber';
    try { return localStorage.getItem('recon.player.engine') === 'cubing' ? 'cubing' : 'cuber'; }
    catch { return 'cuber'; }
  });
  const pickEngine = useCallback((e: 'cuber' | 'cubing') => {
    setReconEngine(e);
    try { localStorage.setItem('recon.player.engine', e); } catch { /* private */ }
  }, []);

  const handleCursorSync = useCallback((el: HTMLTextAreaElement) => {
    const player = playerRef.current;
    if (!player) return;
    const offset = el.selectionStart;
    const textBefore = el.value.substring(0, offset);
    // SQ1 uses the cuber-engine player (Sq1ReconPlayer): count tuple/slice
    // tokens directly — extractAlgFromText/cleanForPlayer would strip the
    // `(t,b)` parens SQ1 notation depends on.
    if (player.__kind === 'sq1') {
      player.jumpToMoveCount?.(parseSq1Tokens(textBefore).length);
      return;
    }
    const algBefore = extractAlgFromText(textBefore);
    const moves = algBefore.trim().split(/\s+/).filter(s => s.length > 0);
    // The cuber NxN player scrubs by whitespace move count (same as below);
    // cubing.js goes through its own timeline mapping.
    if (player.__kind === 'nxn-cuber') {
      player.jumpToMoveCount?.(moves.length);
      return;
    }
    syncPlayerToMoveCount(player, moves.length);
  }, [playerRef]);

  // Shared player render — used in both the desktop pane and the mobile inline
  // slot. Picks the engine per puzzle and forces the back view on everywhere.
  const renderReconPlayer = () => {
    if (!form.event) return null;
    const engineToggle = isNxnPuzzle ? (
      <div className="submit-engine-toggle" role="radiogroup" aria-label={tr({ zh: '渲染引擎', en: 'Render engine' })}>
        <button
          type="button" role="radio" aria-checked={reconEngine === 'cuber'}
          className={`submit-engine-opt${reconEngine === 'cuber' ? ' active' : ''}`}
          onClick={() => pickEngine('cuber')}
        >{tr({ zh: '立体', en: 'Solid' })}</button>
        <button
          type="button" role="radio" aria-checked={reconEngine === 'cubing'}
          className={`submit-engine-opt${reconEngine === 'cubing' ? ' active' : ''}`}
          onClick={() => pickEngine('cubing')}
        >cubing.js</button>
      </div>
    ) : null;
    let player: React.ReactNode;
    if (form.event === 'sq1') {
      player = (
        <Sq1ReconPlayer scramble={debouncedScramble} alg={debouncedSolution} playerRef={playerRef} fillPane backView />
      );
    } else if (isNxnPuzzle && reconEngine === 'cuber') {
      player = (
        <CuberReconPlayer
          scramble={debouncedScramble}
          alg={cleanForPlayer(debouncedSolution)}
          order={nxnOrder}
          playerRef={playerRef}
          fillPane
        />
      );
    } else {
      player = (
        <TwistySection
          puzzle={puzzle}
          scramble={debouncedScramble}
          alg={cleanForPlayer(debouncedSolution)}
          playerRef={playerRef}
          fillPane
          backView
        />
      );
    }
    return <>{engineToggle}{player}</>;
  };

  useEffect(() => {
    if (solutionRef.current) handleCursorSync(solutionRef.current);
  }, [debouncedSolution, handleCursorSync]);

  // ── Submit ──
  // 校验解法 / 打乱里的非法字符(注释 `//` 之外只允许 ASCII)。合法返回 null,
  // 否则返回带原因 + 逐行定位的多行提示文本(给 alert 用)。
  const validateNotationFields = (): string | null => {
    const fields: { value: string; label: { zh: string; en: string } }[] = [
      { value: form.solution || '', label: { zh: '解法', en: 'Solution' } },
      { value: form.wcaScramble || '', label: { zh: 'WCA 打乱', en: 'WCA scramble' } },
      { value: form.optimalScramble || '', label: { zh: '最优打乱', en: 'Optimal scramble' } },
    ];
    const problems: string[] = [];
    for (const f of fields) {
      for (const v of findIllegalNotationChars(f.value)) {
        problems.push(tr({
          zh: `${f.label.zh} 第 ${v.line} 行有非法字符「${v.chars}」:${v.snippet}`,
          en: `${f.label.en} line ${v.line} has illegal character(s) "${v.chars}": ${v.snippet}`,
        }));
      }
    }
    if (problems.length === 0) return null;
    const head = tr({
      zh: '解法和打乱里只能用英文字母和符号(WCA 记号)。中文等任何文字说明请写在「//」之后当注释,否则播放器会把它当成转动、导致复盘无法播放。请修改下列位置后重试:',
      en: 'Only English letters and symbols (WCA notation) are allowed in the solution and scramble. Put Chinese or any other text after "//" as a comment, otherwise the player treats it as a move and the reconstruction cannot play. Please fix the following and retry:',
    });
    return `${head}\n\n${problems.join('\n')}`;
  };

  const handleSubmit = async () => {
    if (!form.event || !form.person) {
      alert(t('recon.fillRequired'));
      return;
    }
    // 记号区(解法 / 打乱,`//` 注释之外)只能用英文字母和符号。中文等文字会被播放器
    // 当成转动 → 复盘无法播放。命中则拦下并指明具体行,让用户改完(把文字移到 `//` 后)重试。
    const notationError = validateNotationFields();
    if (notationError) {
      alert(notationError);
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
        // Bust the detail page's 24h ISR/Data cache (server) so it doesn't show
        // stale fields, then router.refresh() drops the client Router Cache.
        await revalidateRecon(editId);
        router.push(`${langPrefix}/recon/${editId}`);
        router.refresh();
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

  // Hand off the current scramble + solution to /sim (matching puzzle). Null
  // when the event has no sim equivalent (clock) — button then hidden.
  const simPuzzleParam = simPuzzleForReconEvent(form.event || '');
  const simHref = simPuzzleParam
    ? `${langPrefix}/sim?${buildSimQuery(simPuzzleParam, form.wcaScramble || form.optimalScramble || '', form.solution || '')}`
    : null;

  // Pre-mount: render a neutral loading shell on both SSR and the first client
  // render so they match (auth state isn't known until localStorage is read).
  if (!mounted) {
    return <div className="recon-page"><div className="recon-loading">{t('common.loading')}</div></div>;
  }

  // ── Login gate ──
  if (!authUser) {
    return (
      <div className="recon-page">
        <div className="recon-page-header">
          <div>
            <Link href={`${langPrefix}/recon`} className="recon-back-link">
              <ArrowLeft size={14} /> {tr({ zh: '返回列表', en: 'Back to list' })}
            </Link>
            <h1>{tr({ zh: '提交复盘', en: 'Submit Reconstruction'
            })}</h1>
          </div>
          {simHref && (
            <Link
              href={simHref}
              className="submit-open-sim"
              title={tr({ zh: '把当前打乱 / 解法带到模拟器里玩', en: 'Play this scramble / solution in the simulator'
            })}
            >
              <Box size={14} /> {tr({ zh: '去模拟器', en: 'Open in Sim'
            })}
            </Link>
          )}
        </div>
        <div style={{ padding: 24, textAlign: 'center' }}>
          <p style={{ marginBottom: 16 }}>
            {tr({ zh: '提交复盘需要登录 WCA 账号。', en: 'Submitting reconstructions requires a WCA account.'
            })}
          </p>
          <button type="button" className="recon-btn" onClick={() => login()}>
            <LogIn size={14} /> {tr({ zh: '登录 WCA', en: 'Sign in with WCA'
            })}
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

  // Strava 模型:身份(选手/项目/WCA/比赛)与值(轮次/成绩/单次/纪录)在所有模式
  // (新建/编辑/克隆)都可自由编辑,不再读改读重建。安全性由既有机制兜底:重复检测
  // 带 excludeId;自动获取的 loaded*KeySnapshot 仅在「当前 key == 挂载时的快照」时
  // 抑制刷新——一旦用户改了 比赛/项目/轮次/第几把,key 与快照不同 → 自动获取重新触发;
  // 各字段的 *UserTouched 标记保证手动编辑优先于自动填充。

  return (
    <div className="recon-page submit-page">
      <div className="submit-header">
        <div className="submit-header-top">
          <div className="detail-header">
            <h1>{isEditing ? t('recon.editRecon') : t('recon.addRecon')}</h1>
          </div>
          {simHref && (
            <Link
              href={simHref}
              className="submit-open-sim"
              title={tr({ zh: '把当前打乱 / 解法带到模拟器里玩', en: 'Play this scramble / solution in the simulator'
            })}
            >
              <Box size={14} /> {tr({ zh: '去模拟器', en: 'Open in Sim'
            })}
            </Link>
          )}
        </div>
        {dupWarning && <div className="submit-warning">{dupWarning}</div>}
      </div>

      <div className="submit-layout">
        {!isMobile && (
          <div className="submit-player-pane">
            {renderReconPlayer()}
          </div>
        )}

        <div className="submit-form-pane">
          <div className="submit-form">
            {!isEditing && !fromId && authUser && (
              <button type="button" className="submit-reuse-btn" onClick={() => setReuseOpen(true)}>
                <History size={14} />
                {tr({ zh: '复用以前的填写', en: 'Reuse a previous entry'
                })}
              </button>
            )}
            {reuseOpen && authUser && (
              <ReconReuseModal
                wcaId={authUser.wcaId}
                isZh={isZh}
                onClose={() => setReuseOpen(false)}
                onPick={applyReuse}
              />
            )}
            {scramblePickerFor && (
              <ScramblePicker
                isZh={isZh}
                event={form.event}
                onClose={() => setScramblePickerFor(null)}
                onPick={scramble => {
                  if (scramblePickerFor === 'wca') {
                    setScrambleUserTouched(true);
                    setScrambleAutoSource(null);
                    scrambleAutoFilledRef.current = false;
                    setField('wcaScramble', scramble);
                  } else {
                    setField('optimalScramble', scramble);
                  }
                  setScramblePickerFor(null);
                }}
              />
            )}
            {/* === Competition info — default open === */}
            <CollapsibleSection
              title={tr({ zh: '比赛信息', en: 'Competition'
            })}
              defaultOpen
            >
              {/* Hero row: solver / event / time */}
              <div className="submit-hero">
                <div className={`submit-field ${form.personId ? 'submit-field-shrink' : ''}${reusedCls('person')}`}>
                  <span className="submit-label">{t('recon.solver')} *</span>
                  {solverLite ? (
                    <div className="submit-solver-pill">
                      <Flag iso2={solverLite.country_iso2} />
                      <span className="submit-solver-name">{displayCuberName(solverLite.name, isZh)}</span>
                      <ClearButton onClick={clearSolver} isZh={isZh} variant="standalone" preserveFocus />
                    </div>
                  ) : (
                    <WcaPersonPicker
                      value={null}
                      onChange={handleSolverPick}
                      isZh={isZh}
                      placeholder={tr({ zh: '搜选手名 / WCA ID', en: 'Search name / WCA ID'
                    })}
                    />
                  )}
                </div>
                <label className={`submit-field${reusedCls('event')}`}>
                  <span className="submit-label">{t('recon.event')} *</span>
                  <EventSelect events={EVENTS} value={form.event ?? ''} onChange={(v) => setField('event', v)} />
                </label>
                <label className="submit-field">
                  <span className="submit-label">{tr({ zh: '成绩(千分位)', en: 'Time (0.001s)' })}</span>
                  <input
                    type="text"
                    value={timeInput}
                    onChange={e => {
                      setTimeInput(e.target.value);
                      setTimeUserTouched(true);
                      setTimeAutoSource(null);
                      timeAutoFilledRef.current = false;
                    }}
                    title={tr({ zh: '精确到千分位的成绩;自动填充后仍可手动改', en: 'Result to the thousandth; still editable after auto-fill'
                    })}
                  />
                  {timeAutoSource ? <span className="submit-hint">{timeAutoSource}</span> : null}
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
                        title={tr({ zh: '自动派生 = 成绩 − 操作', en: 'auto-derived = result − exec'
                        })}
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

              {solverLite && (
                <div className="submit-row">
                  <div className={`submit-field${reusedCls('coPersons')}`}>
                    <span className="submit-label">{tr({ zh: '共同完成者', en: 'Co-solvers' })}</span>
                    <div className="submit-cosolvers">
                      {(form.coPersons ?? []).map((c, i) => (
                        <div key={`${c.id || c.name}-${i}`} className="submit-solver-pill submit-cosolver-pill">
                          <Flag iso2={c.country || ''} />
                          <span className="submit-solver-name">{displayCuberName(c.name, isZh)}</span>
                          <ClearButton onClick={() => removeCoPerson(i)} isZh={isZh} variant="standalone" preserveFocus />
                        </div>
                      ))}
                      {addingCo ? (
                        <WcaPersonPicker
                          value={null}
                          onChange={addCoPerson}
                          isZh={isZh}
                          placeholder={tr({ zh: '搜选手名 / WCA ID', en: 'Search name / WCA ID'
                        })}
                          className="submit-cosolver-picker"
                        />
                      ) : (
                        <button type="button" className="submit-add-cosolver" onClick={() => setAddingCo(true)}>
                          <UserPlus size={14} /> {tr({ zh: '添加选手', en: 'Add solver'
                        })}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className="submit-row">
                <label className={`submit-field submit-field-narrow${reusedCls('official')}`}>
                  <span className="submit-label">WCA</span>
                  <select value={form.official ? '1' : '0'} onChange={e => setField('official', e.target.value === '1')}>
                    <option value="1">WCA</option>
                    <option value="0">{t('recon.badge.nonWca')}</option>
                  </select>
                </label>
                <div className={`submit-field ${form.compWcaId ? 'submit-field-shrink' : ''}${reusedCls('comp')}`}>
                  <span className="submit-label">{t('recon.competition')}</span>
                  {form.compWcaId ? (
                    <div className="submit-comp-pill">
                      <Flag iso2={form.country || ''} />
                      <span className="submit-comp-name">{localizeCompName(form.compWcaId || '', form.comp || '', isZh)}</span>
                      <ClearButton onClick={clearPickedComp} isZh={isZh} variant="standalone" preserveFocus />
                    </div>
                  ) : (
                    <CompPicker
                      value={form.comp || ''}
                      onChange={(v) => setField('comp', v)}
                      onUrlPaste={(id) => setField('comp', id)}
                      onPick={applyPickedComp}
                      isZh={isZh}
                      hideFuture
                      disableSuggestions={!form.official}
                      presets={!form.official ? [
                        { icon: <Home size={14} />, label: tr({ zh: '家', en: 'Home' }), value: tr({ zh: '家', en: 'Home' }) },
                      ] : undefined}
                    />
                  )}
                </div>
              </div>

              {/* 非 WCA 比赛:补国家(选完显示国旗) + 城市,WCA 比赛由所选比赛自动带出 */}
              {!form.official && (
                <div className="submit-row">
                  <label className="submit-field">
                    <span className="submit-label">{tr({ zh: '国家 / 地区', en: 'Country'
                    })}</span>
                    <CountryInput
                      value={form.country || ''}
                      onChange={(iso2) => setField('country', iso2.toLowerCase())}
                      placeholder=""
                    />
                  </label>
                  <label className="submit-field">
                    <span className="submit-label">{tr({ zh: '城市', en: 'City' })}</span>
                    <input
                      type="text"
                      value={form.city || ''}
                      onChange={(e) => setField('city', e.target.value)}
                      maxLength={100}
                    />
                  </label>
                </div>
              )}

              <div className="submit-row">
                <label className={`submit-field${reusedCls('round')}`}>
                  <span className="submit-label">{t('recon.round')}</span>
                  <select value={form.round || ''} onChange={e => setField('round', e.target.value)}>
                      <option value="">{tr({ zh: '请选择', en: 'Select…'
                    })}</option>
                      {roundOptions.map(r => <option key={r} value={r}>{localizeRound(r, t)}</option>)}
                  </select>
                </label>
                <label className="submit-field">
                  <span className="submit-label">#</span>
                  {/* 下拉给常用第几把,也允许手填任意正整数 */}
                  <input
                    type="text"
                    inputMode="numeric"
                    list="recon-solvenum-options"
                    placeholder={tr({ zh: '选择或输入', en: 'Pick or type' })}
                    value={form.solveNum ?? ''}
                    onChange={e => {
                      const raw = e.target.value.trim();
                      if (raw === '') { setField('solveNum', undefined); return; }
                      if (!/^\d+$/.test(raw)) return;   // 只收数字
                      const n = Number(raw);
                      if (n >= 1) setField('solveNum', n); // 必须正整数
                    }}
                  />
                  <datalist id="recon-solvenum-options">
                    {solveNumOptions.map(n => <option key={n} value={n} />)}
                  </datalist>
                </label>
                <label className={`submit-field${reusedCls('groupId')}`}>
                  <span className="submit-label">{t('recon.group')}</span>
                  {(() => {
                    // 已公示 → 用真实分组(多分组强制选);未公示 / 非 WCA → 兜底 A~Z。
                    const published = !!groupOptions && groupOptions.length > 0;
                    const base = published ? groupOptions! : ALPHA_GROUPS;
                    // 现有值(编辑/复用带入的非标准分组)不在列表里时也要可选,避免静默丢失。
                    const opts = form.groupId && !base.includes(form.groupId) ? [form.groupId, ...base] : base;
                    const needPick = published && groupOptions!.length > 1 && !form.groupId;
                    // 单一公示分组已自动填入、无需占位;其余情形给「请选择」占位。
                    const withPlaceholder = !(published && groupOptions!.length === 1);
                    return (
                      <>
                        <select
                          value={form.groupId || ''}
                          onChange={e => setField('groupId', e.target.value)}
                          className={needPick ? 'submit-input-invalid' : undefined}
                        >
                          {withPlaceholder && <option value="">{tr({ zh: '请选择', en: 'Select…' })}</option>}
                          {opts.map(g => <option key={g} value={g}>{g}</option>)}
                        </select>
                        {needPick &&
                          <span className="submit-hint submit-hint-warn">{tr({ zh: '请先选择分组', en: 'Select a group first' })}</span>}
                      </>
                    );
                  })()}
                </label>
                <label className={`submit-field${reusedCls('date')}`}>
                  <span className="submit-label">{t('recon.date')}</span>
                  <input type="text" value={form.date || ''} onChange={e => setField('date', e.target.value)}
                    placeholder="yyyy-mm-dd" pattern="\d{4}-\d{2}-\d{2}" />
                </label>
              </div>

              <div className="submit-row">
                <label className="submit-field">
                  <span className="submit-label">{t('recon.single')}</span>
                  <input
                    type="text"
                    value={form.value ?? ''}
                    onChange={e => {
                      setField('value', e.target.value);
                      setSingleUserTouched(true);
                      setSingleAutoSource(null);
                      singleAutoFilledRef.current = false;
                    }}
                    readOnly={!!singleAutoSource}
                    className={singleAutoSource ? 'submit-input-locked' : undefined}
                    title={singleAutoSource ? tr({ zh: '自动填充值不可编辑;改 选手/比赛/项目/轮次/第几把 以重新获取', en: 'auto-filled, read-only; change person/comp/event/round/# to refetch'
                                        }) : undefined}
                  />
                  {timeLoading
                    ? <span className="submit-hint submit-hint-loading"><Loader2 size={12} /> {tr({ zh: '自动获取中…', en: 'fetching…'
                    })}</span>
                    : singleAutoSource ? <span className="submit-hint">{singleAutoSource}</span> : null}
                </label>
                <label className="submit-field">
                  <span className="submit-label">{t('recon.badge.singleRecord')}</span>
                  <RecordSelect
                    value={form.regionalSingleRecord || ''}
                    onChange={(v) => { setField('regionalSingleRecord', v); setSingleRecordUserTouched(true); }}
                    personIso2={form.personCountry}
                  />
                  {recordLoading
                    ? <span className="submit-hint submit-hint-loading"><Loader2 size={12} /> {tr({ zh: '自动获取中…', en: 'fetching…'
                    })}</span>
                    : (!singleRecordUserTouched && form.regionalSingleRecord && recordAutoSource) ? <span className="submit-hint">{recordAutoSource}</span> : null}
                </label>
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
                    readOnly={!!avgAutoSource}
                    className={avgAutoSource ? 'submit-input-locked' : undefined}
                    title={avgAutoSource ? tr({ zh: '自动填充值不可编辑;改选手/比赛/项目/轮次以重新获取', en: 'auto-filled, read-only; change person/comp/event/round to refetch'
                                        })
                      : undefined}
                  />
                  {avgLoading
                    ? <span className="submit-hint submit-hint-loading"><Loader2 size={12} /> {tr({ zh: '自动获取中…', en: 'fetching…'
                    })}</span>
                    : avgAutoSource ? <span className="submit-hint">{avgAutoSource}</span> : null}
                </label>
                <label className="submit-field">
                  <span className="submit-label">{t('recon.badge.averageRecord')}</span>
                  <RecordSelect
                    value={form.regionalAverageRecord || ''}
                    onChange={(v) => { setField('regionalAverageRecord', v); setAverageRecordUserTouched(true); }}
                    personIso2={form.personCountry}
                  />
                  {recordLoading
                    ? <span className="submit-hint submit-hint-loading"><Loader2 size={12} /> {tr({ zh: '自动获取中…', en: 'fetching…'
                    })}</span>
                    : (!averageRecordUserTouched && form.regionalAverageRecord && recordAutoSource) ? <span className="submit-hint">{recordAutoSource}</span> : null}
                </label>
              </div>
            </CollapsibleSection>

            {/* WCA scramble */}
            <label className="submit-field submit-block">
              <span className="submit-label submit-label-row">
                {t('recon.wcaScramble')}
                <button
                  type="button"
                  className="scramble-pick-btn"
                  onClick={e => { e.preventDefault(); e.stopPropagation(); setScramblePickerFor('wca'); }}
                >
                  <ListPlus size={13} /> {tr({ zh: '选已有', en: 'Pick existing' })}
                </button>
              </span>
              <textarea
                rows={1}
                ref={wcaScrambleRef}
                value={form.wcaScramble || ''}
                readOnly={!!scrambleAutoSource}
                className={scrambleAutoSource ? 'submit-input-locked' : undefined}
                title={scrambleAutoSource
                  ? tr({ zh: '自动填充值不可编辑;改 比赛/项目/轮次/分组/第几把 以重新获取', en: 'auto-filled, read-only; change comp/event/round/group/# to refetch'
                                    })
                  : undefined}
                onChange={e => {
                  setScrambleUserTouched(true);
                  setScrambleAutoSource(null);
                  scrambleAutoFilledRef.current = false;
                  setField('wcaScramble', e.target.value);
                  autoResize(e.target);
                }}
                onInput={e => autoResize(e.target as HTMLTextAreaElement)}
                style={{ overflow: 'hidden', resize: 'none' }}
              />
              {scrambleLoading
                ? <span className="submit-hint submit-hint-loading"><Loader2 size={12} /> {tr({ zh: '自动获取中…', en: 'fetching…'
                })}</span>
                : scrambleAutoSource ? <span className="submit-hint">{scrambleAutoSource}</span> : null}
            </label>

            {/* Optimal scramble */}
            <label className="submit-field submit-block">
              <span className="submit-label submit-label-row">
                {t('recon.optimalScramble')}
                <button
                  type="button"
                  className="scramble-pick-btn"
                  onClick={e => { e.preventDefault(); e.stopPropagation(); setScramblePickerFor('optimal'); }}
                >
                  <ListPlus size={13} /> {tr({ zh: '选已有', en: 'Pick existing' })}
                </button>
              </span>
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
            {isMobile && form.event && (
              <div className="submit-inline-player">
                {renderReconPlayer()}
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
                <AlgInput
                  // Underlying textarea: AlgInput exposes it via elementRef (markable=false).
                  // Cast is safe because we always render textarea here.
                  elementRef={solutionRef as React.RefObject<HTMLTextAreaElement | HTMLDivElement | null>}
                  initialText={form.solution || ''}
                  className="submit-solution-textarea"
                  rows={6}
                  spellCheck={false}
                  autoSpace
                  autoResize
                  style={{ overflow: 'hidden', resize: 'none', fontFamily: 'monospace' }}
                  onChange={(text) => {
                    setField('solution', text);
                    if (solutionRef.current) handleCursorSync(solutionRef.current);
                  }}
                  onCaretChange={() => {
                    if (solutionRef.current) handleCursorSync(solutionRef.current);
                  }}
                  onClick={() => {
                    if (solutionRef.current) handleCursorSync(solutionRef.current);
                  }}
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
                  placeholder={tr({ zh: 'cross / F2L / OLL / PLL 每段一行,// 后面写注释', en: 'cross / F2L / OLL / PLL one stage per line; // for comments'
                })}
                />
              )}
              {!normalized && (
                <ReconAutofill
                  textareaRef={solutionRef}
                  value={form.solution || ''}
                  setValue={(next) => {
                    setField('solution', next);
                    if (solutionRef.current) {
                      solutionRef.current.value = next;
                      autoResize(solutionRef.current);
                      handleCursorSync(solutionRef.current);
                    }
                  }}
                  scramble={form.wcaScramble || form.optimalScramble || ''}
                  isMobile={isMobile}
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
            <CollapsibleSection title={tr({ zh: '元数据', en: 'Metadata'
            })}>
              <div className="submit-row">
                <label className={`submit-field submit-field-wide${reusedCls('videoUrl')}`}>
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
                <label className={`submit-field${reusedCls('method')}`}>
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
                <label className={`submit-field${reusedCls('cube')}`}>
                  <span className="submit-label">{t('recon.cube')}</span>
                  <input type="text" value={form.cube || ''} onChange={e => setField('cube', e.target.value)} />
                </label>
                <label className={`submit-field submit-field-wide${reusedCls('note')}`}>
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
                <div className={`submit-field ${(form.reconer || form.reconerId) ? 'submit-field-shrink' : ''}${reusedCls('reconer')}`}>
                  <span className="submit-label">{t('recon.reconstructor')}</span>
                  {(form.reconer || form.reconerId) ? (
                    <div className="submit-solver-pill">
                      <Flag iso2={reconerCountry || ''} />
                      <span className="submit-solver-name">{displayCuberName(form.reconer || '', isZh)}</span>
                      <ClearButton onClick={clearReconer} isZh={isZh} variant="standalone" preserveFocus />
                    </div>
                  ) : (
                    <WcaPersonPicker
                      value={null}
                      onChange={handleReconerPick}
                      isZh={isZh}
                      placeholder={tr({ zh: '搜选手名 / WCA ID', en: 'Search name / WCA ID'
                    })}
                    />
                  )}
                </div>
                <label className={`submit-field${reusedCls('reconDate')}`}>
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

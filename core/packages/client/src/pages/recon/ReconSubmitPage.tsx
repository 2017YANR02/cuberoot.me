/**
 * 复盘提交/编辑页——迁移自 recon/submit/recon_submit_page.js（2432 行）
 * NOTE: 表单字段、实时统计、重复检测、虚拟键盘
 */
import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { ReconSolve } from '@cuberoot/shared';
import { WcaPersonPicker, type WcaPerson } from '@cuberoot/shared';
import { getRecon, addRecon, updateRecon, deleteRecon, checkDuplicate, searchSolvers, listRecons } from '../../utils/recon_api';
import { Flag } from '../../utils/flag';
import { computeAllStats } from '../../utils/recon_stats';
import { parseTimeInput, formatTimeInput, computeWcaAverage, attemptsPerRound, localizeRound } from '../../utils/recon_utils';
import { fetchAttempts, fetchCubingAttempts, fetchResultRow } from '../../utils/wca_results_api';
import { RecordSelect } from '../../components/RecordSelect';
import { EventSelect } from '../../components/EventSelect';
import { CompPicker } from '../../components/CompPicker';
import type { Comp } from '../../utils/comp_search';
import { compNameZh, loadFlagData, flagDataVersion } from '../../utils/country_flags';
import { localizeCompName } from '../../utils/comp_localize';
import { fetchCompRounds, type RoundFormat } from '../../utils/comp_wcif';
import { toWcaEventId } from '../../utils/wca_events';
import { displayCuberName } from '../../utils/name_utils';
import { useAuthStore } from '../../stores/auth_store';
import LangToggle from '../../components/LangToggle';
import '../../recon.css';
import './recon_submit.css';
import CubeVirtualKeyboard from './components/CubeVirtualKeyboard';
import TwistySection from './components/TwistySection';
import SolutionView from './components/SolutionView';
import { cleanForPlayer, extractAlgFromText, syncPlayerToMoveCount } from '../../utils/recon_alg_utils';
import { buildNormalizedSolution, hasWideMoveInCrossSection } from '../../utils/recon_norm_cross_extract';
import { ArrowRightLeft, ChevronDown, ChevronRight, Keyboard, Loader2 } from 'lucide-react';

/** 折叠区段 — GitHub 设置式 */
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

// ── 常量 ──

const EVENTS = ['3x3', '2x2', '4x4', '5x5', '6x6', '7x7', '3bld', '4bld', '5bld', 'oh', 'sq1', 'pyra', 'mega', 'clock', 'skewb', 'fmc', 'mbld'];
const METHODS = ['CFOP', 'Roux', 'ZZ', 'Petrus', 'LBL', 'Mehta', 'ZB', 'Other'];
const ROUNDS_FALLBACK = ['1', '2', '3', 'f'];

// NOTE: 不同 round.format 的 # 上限 — Bo1/Bo2/Bo3/Bo5/Ao5/Mo3 按 expected_solve_count;H2H bracket 数量未知,留 30 给录入者覆盖
const SOLVE_NUM_CAP_BY_FORMAT: Record<RoundFormat, number> = {
  '1': 1, '2': 2, '3': 3, '5': 5, 'a': 5, 'm': 3, 'h': 30,
};

/** N 轮赛 → round 选项数组。N=1→只有 Final,N=4→R1+R2+R3+F。WCA 里最后一轮永远叫 Final。 */
function roundsForCount(n: number): string[] {
  if (n <= 0) return ROUNDS_FALLBACK;
  if (n === 1) return ['f'];
  const arr: string[] = [];
  for (let i = 1; i < n; i++) arr.push(String(i));
  arr.push('f');
  return arr;
}

/**
 * 将任意日期字符串转为 yyyy-mm-dd 格式（<input type="date"> 要求）
 * NOTE: 服务端 validateRow 也要求 yyyy-mm-dd，不能传 ISO 字符串
 */
function toDateInput(val: string | null | undefined): string {
  if (!val) return '';
  // NOTE: 已经是 yyyy-mm-dd 格式
  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val;
  // NOTE: ISO 字符串（如 2026-02-05T16:00:00.000Z）——取前10位即可
  if (val.length >= 10 && val[4] === '-') return val.slice(0, 10);
  // NOTE: 其他格式尝试解析
  const d = new Date(val);
  if (isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

function useIsMobile(): boolean {
  const [m, setM] = useState(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    const handler = (e: MediaQueryListEvent) => setM(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return m;
}

export default function ReconSubmitPage() {
  const { editId } = useParams<{ editId: string }>();
  const isEditing = !!editId;
  const [searchParams] = useSearchParams();
  // NOTE: ?from=<id>&solveNum=<n>&suggestTime=<秒> — 从同轮次缺失 chip 跳转过来时预填共享字段 + 推荐成绩
  const fromId = !isEditing ? searchParams.get('from') : null;
  const fromSolveNum = !isEditing ? searchParams.get('solveNum') : null;
  const suggestTime = !isEditing ? searchParams.get('suggestTime') : null;
  const suggestScramble = !isEditing ? searchParams.get('suggestScramble') : null;
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const isZh = i18n.language === 'zh';
  const [saving, setSaving] = useState(false);
  const [loadingEdit, setLoadingEdit] = useState(isEditing || !!fromId);
  const [flagVer, setFlagVer] = useState(flagDataVersion());
  // NOTE: 当前登录用户——用作 reconer 默认值（OAuth name 是 "English (中文)" 全格式，符合 displayCuberName 规范）
  const authUser = useAuthStore(s => s.user);

  useEffect(() => {
    loadFlagData().then(v => { if (v !== flagVer) setFlagVer(v); });
  }, [flagVer]);
  // NOTE: solution textarea ref——虚拟键盘通过 ref 直接操作 DOM
  const solutionRef = useRef<HTMLTextAreaElement>(null);

  // NOTE: 表单字段——与 ReconSolve 字段对齐
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

  // NOTE: 搜索状态由 WcaPersonPicker 内部管理；form.personId 为空时显示 picker，已选时显示 pill
  const [timeInput, setTimeInput] = useState('');
  const [avgInput, setAvgInput] = useState('');
  const [dupWarning, setDupWarning] = useState('');
  // NOTE: avg 自动填充 — 用户一旦手动改过就再也不覆盖；avgAutoSource 是字段下方的来源 hint
  const [avgUserTouched, setAvgUserTouched] = useState(false);
  const [avgAutoSource, setAvgAutoSource] = useState<string | null>(null);
  const [avgLoading, setAvgLoading] = useState(false);
  // NOTE: time(单次)自动填充 — 同一套机制,但 keys 多一个 solveNum
  const [timeUserTouched, setTimeUserTouched] = useState(false);
  const [timeAutoSource, setTimeAutoSource] = useState<string | null>(null);
  const [timeLoading, setTimeLoading] = useState(false);
  // NOTE: record marker 自动填充 — 单次/平均纪录,机制同 avg/time;只走 WCA API(cubing.com 不返 record)
  const [singleRecordUserTouched, setSingleRecordUserTouched] = useState(false);
  const [averageRecordUserTouched, setAverageRecordUserTouched] = useState(false);
  const [recordLoading, setRecordLoading] = useState(false);
  const [recordAutoSource, setRecordAutoSource] = useState<string | null>(null);
  // NOTE: edit/from 加载时的 keys 快照 — 首次 effect 跑时如果当前 keys 跟快照一致就跳过,
  //       避免覆盖加载值;用户一改 keys → 快照失效,后续每次 keys 变都重 fetch
  const loadedAvgKeySnapshot = useRef<string | null>(null);
  const loadedTimeKeySnapshot = useRef<string | null>(null);
  const loadedRecordKeySnapshot = useRef<string | null>(null);
  // NOTE: 跟踪"当前 input 值是否来自自动填" — fetch 三档全没数据时只清自动填的值,不清手输/加载值
  const avgAutoFilledRef = useRef(false);
  const timeAutoFilledRef = useRef(false);
  // NOTE: 比赛事件→轮次数 映射(从 WCIF 拉),决定 round 下拉的选项;拉不到 fallback 4 项
  const [compRounds, setCompRounds] = useState<Record<string, RoundFormat[]> | null>(null);
  // NOTE: 桌面端用户可 toggle;移动端强制显示键盘(toggle 按钮也藏掉)
  const isMobile = useIsMobile();
  const [showKeyboard, setShowKeyboard] = useState(false);

  // NOTE: 编辑模式加载数据
  useEffect(() => {
    if (!isEditing) return;
    setLoadingEdit(true);
    getRecon(Number(editId)).then(solve => {
      // NOTE: 日期字段统一转成 yyyy-mm-dd，服务端 ISO 字符串会导致 <input type="date"> 无法拼配且 validateRow 报错
      const normalized = {
        ...solve,
        date: toDateInput(solve.date),
        reconDate: toDateInput(solve.reconDate),
      };
      setForm(normalized);
      // NOTE: 记录加载时 keys,首次 auto-fill effect 跑时跟快照对齐就跳过(不覆盖加载值)
      const baseKey = `${solve.personId ?? ''}|${solve.event ?? ''}|${solve.comp ?? ''}|${solve.compWcaId ?? ''}|${solve.round ?? ''}`;
      loadedAvgKeySnapshot.current = baseKey;
      loadedTimeKeySnapshot.current = `${baseKey}|${solve.solveNum ?? ''}`;
      loadedRecordKeySnapshot.current = `${baseKey}|${solve.solveNum ?? ''}`;
      if (solve.rawTime != null) setTimeInput(formatTimeInput(solve.rawTime));
      if (solve.average != null) setAvgInput(formatTimeInput(solve.average));
      // NOTE: 同步 textarea DOM——defaultValue 只在 mount 时生效，编辑模式 API 返回后需手动同步
      if (solutionRef.current && solve.solution) {
        solutionRef.current.value = solve.solution;
        autoResize(solutionRef.current);
      }
      setLoadingEdit(false);
    }).catch(() => setLoadingEdit(false));
  }, [editId, isEditing]);

  // NOTE: ?from=<id> 预填模式 — 从同轮次缺失 chip 跳来，复制共享字段，留空把数相关
  useEffect(() => {
    if (isEditing || !fromId) return;
    setLoadingEdit(true);
    getRecon(Number(fromId)).then(src => {
      const targetSolveNum = fromSolveNum ? Number(fromSolveNum) : undefined;
      // NOTE: 整轮共享字段；不复制 rawTime/solution/wcaScramble/optimalScramble/cube/note/videoUrl/regionalSingleRecord/caption + stats
      // NOTE: 已登录就直接用 auth.name/wcaId（"English (中文)" 全格式），未登录才落回 src 历史值
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
        // NOTE: 同选手同轮次大概率用同一个魔方+同一个视频(整轮录在一起),沿用
        cube: src.cube,
        videoUrl: src.videoUrl,
      }));
      // NOTE: 记录加载时 keys,首次 auto-fill effect 跑时跟快照对齐就跳过
      const fromBaseKey = `${src.personId ?? ''}|${src.event ?? ''}|${src.comp ?? ''}|${src.compWcaId ?? ''}|${src.round ?? ''}`;
      loadedAvgKeySnapshot.current = fromBaseKey;
      // NOTE: time 快照用 targetSolveNum (跳来时实际 solveNum,不是 src.solveNum)
      loadedTimeKeySnapshot.current = `${fromBaseKey}|${targetSolveNum ?? src.solveNum ?? ''}`;
      loadedRecordKeySnapshot.current = `${fromBaseKey}|${targetSolveNum ?? src.solveNum ?? ''}`;
      if (src.average != null) setAvgInput(formatTimeInput(src.average));
      // NOTE: ?suggestTime= — 来自 SameRoundNav 的 WCA / 粘贴解析
      // 同步 form.value(下方"单次"展示字段),与 WCA 自动填一致
      if (suggestTime) {
        const n = parseFloat(suggestTime);
        if (!isNaN(n) && n > 0) {
          const formatted = formatTimeInput(n);
          setTimeInput(formatted);
          setForm(prev => ({ ...prev, value: formatted }));
        }
      }
      // NOTE: ?suggestScramble= — 来自 WCA scrambles API
      if (suggestScramble) {
        setForm(prev => ({ ...prev, wcaScramble: suggestScramble }));
      }
      setLoadingEdit(false);
    }).catch(() => setLoadingEdit(false));
  }, [fromId, fromSolveNum, isEditing, authUser, suggestTime, suggestScramble]);

  // NOTE: 更新表单字段
  const setField = useCallback(<K extends keyof ReconSolve>(key: K, value: ReconSolve[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
  }, []);

  // NOTE: CompPicker 选中比赛 — 一次性回填 name / id / country / date
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

  // NOTE: 清除已选比赛 pill — 同时清掉自动回填的字段
  const clearPickedComp = useCallback(() => {
    setForm(prev => ({
      ...prev,
      comp: '',
      compWcaId: '',
      country: '',
      date: '',
    }));
  }, []);

  /** textarea 自适应高度——先收缩到最小再擑开到 scrollHeight */
  const autoResize = useCallback((el: HTMLTextAreaElement) => {
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  }, []);

  // NOTE: 实时解法统计
  const stats = useMemo(() => {
    if (!form.solution) return null;
    const time = form.rawTime ?? 0;
    return computeAllStats(form.solution, time);
  }, [form.solution, form.rawTime]);

  // NOTE: 成绩解析
  useEffect(() => {
    const parsed = parseTimeInput(timeInput);
    if (!isNaN(parsed)) setField('rawTime', parsed);
  }, [timeInput, setField]);

  useEffect(() => {
    const parsed = parseTimeInput(avgInput);
    if (!isNaN(parsed)) setField('average', parsed);
  }, [avgInput, setField]);

  // NOTE: 比赛切换 → 拉 WCIF 轮次结构(localStorage 缓存 24h,实际很少 fetch)
  useEffect(() => {
    if (!form.compWcaId) { setCompRounds(null); return; }
    let cancelled = false;
    fetchCompRounds(form.compWcaId).then(rounds => {
      if (!cancelled) setCompRounds(rounds);
    });
    return () => { cancelled = true; };
  }, [form.compWcaId]);

  // NOTE: 当前 event 在该比赛的 round.format 数组(WCIF 拉到时存在;没拉到/event 不存在 → null)
  const eventRoundFormats = useMemo<RoundFormat[] | null>(() => {
    if (!compRounds || !form.event) return null;
    const wcaId = toWcaEventId(form.event);
    const arr = compRounds[wcaId];
    return (arr && arr.length > 0) ? arr : null;
  }, [compRounds, form.event]);

  // NOTE: 当前 event 在该比赛的轮次选项 — 拉不到/没有该 event 时 fallback 4 项
  const roundOptions = useMemo(() => {
    if (!eventRoundFormats) return ROUNDS_FALLBACK;
    return roundsForCount(eventRoundFormats.length);
  }, [eventRoundFormats]);

  // NOTE: 当前 form.round 不在新选项里时 reset 到最后一项(单轮赛场景:用户从 4 轮赛切到短时赛,'2' 不再有效 → 设 'f')
  useEffect(() => {
    if (!form.round) return;
    if (!roundOptions.includes(form.round)) {
      setField('round', roundOptions[roundOptions.length - 1]);
    }
  }, [roundOptions, form.round, setField]);

  // NOTE: # (solveNum) 上限由当前 round 的 format 决定 — H2H ('h') 取 30,其他按 expected_solve_count(1/2/3/5)
  //       拉不到 WCIF / round 不在选项里 → fallback 到 attemptsPerRound(event) 的 1/3/5
  const solveNumOptions = useMemo(() => {
    let max = form.event ? attemptsPerRound(form.event) : 5;
    if (eventRoundFormats && form.round) {
      // round 字符串 'f'=最后一轮, '1'/'2'/...=对应 0-index round
      const idx = form.round === 'f' ? eventRoundFormats.length - 1 : Number(form.round) - 1;
      const fmt = eventRoundFormats[idx];
      if (fmt) max = SOLVE_NUM_CAP_BY_FORMAT[fmt];
    }
    return Array.from({ length: max }, (_, i) => i + 1);
  }, [form.event, form.round, eventRoundFormats]);

  // NOTE: 切换 event 后,如果 form.solveNum 超出新选项范围,清空(让用户重选)
  useEffect(() => {
    if (form.solveNum != null && !solveNumOptions.includes(form.solveNum)) {
      setField('solveNum', undefined);
    }
  }, [solveNumOptions, form.solveNum, setField]);

  // NOTE: 平均成绩自动填充 — (选手, 项目, 比赛, 轮次) 唯一确定一个 avg。
  // 三档 fallback: DB 同轮 sibling.average → WCA API → cubing.com API(后两档自己算 Ao5/Mo3)。
  // 跳过条件:
  //  - 用户手动改过(avgUserTouched)
  //  - edit/from 加载完成后首次 effect: 当前 keys 跟快照一致(不覆盖加载值);用户一改 keys 快照失效。
  // 三档全没数据时主动清空 avg(此前可能是别的 key 组合 auto-fill 留下的)。
  useEffect(() => {
    if (avgUserTouched) return;
    if (!form.personId || !form.event || !form.round) return;
    if (!form.comp && !form.compWcaId) return;

    const currentKey = `${form.personId}|${form.event}|${form.comp ?? ''}|${form.compWcaId ?? ''}|${form.round}`;
    if (loadedAvgKeySnapshot.current === currentKey) return;
    // NOTE: 首次跟快照不一致 → 进入 fetch 流程,且把快照失效(后续每次 keys 变都重 fetch)
    loadedAvgKeySnapshot.current = null;

    let cancelled = false;
    const timer = setTimeout(async () => {
      setAvgLoading(true);
      let foundAvg: number | null = null;
      let foundSource: string | null = null;
      try {
        // 1) DB sibling (只有 comp 字段是字符串匹配,所以非 WCA 比赛也能命中)
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

        // 2) WCA API
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

        // 3) cubing.com fallback
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
          // 三档全没 → 仅清自动填留下的值;手输/加载值保留(避免编辑模式覆盖原值)
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

  // NOTE: 单次成绩自动填充 — (选手, 项目, 比赛, 轮次, 第几把) 唯一确定一个 single time。
  //       三档 fallback 同 avg;DNF/DNS 不自动填(用户需手输 - 但目前 UI 不支持)
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
        // 1) DB sibling - 同 5 keys 的已录 solve
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

        // 2) WCA / 3) cubing - 取整轮 attempts 的第 idx 项
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
              if (v != null && v >= 0) {  // DNF=-1 / DNS=-2 跳过
                foundTime = v;
                foundSource = isZh ? `自动:${label}` : `auto: ${label}`;
              }
            }
          } catch { /* fall through */ }
        }

        if (cancelled) return;
        if (foundTime != null) {
          setTimeInput(formatTimeInput(foundTime));
          // NOTE: 同步 form.value(下方"单次"WCA 风格展示字段)— WCA 自动填的没惩罚,直接用截断后的字符串
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
  }, [form.personId, form.event, form.comp, form.compWcaId, form.round, form.solveNum, timeUserTouched, isEditing, editId, isZh]);

  // NOTE: 纪录字段自动填充 — 平均纪录直接用 WCA row.regional_average_record;
  //       单次纪录仅当 form.solveNum-1 == row 整轮 best_index 时填(WCA marker 标在该轮最快那把)。
  //       只走 WCA API(cubing.com 不返 record marker);用户手动改任一字段后该字段不再被覆盖。
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

  // NOTE: 重复检测
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
          excludeId: isEditing ? Number(editId) : undefined,
        });
        if (result.exists) {
          setDupWarning(`⚠️ Duplicate found (#${result.id})`);
        } else {
          setDupWarning('');
        }
      } catch { setDupWarning(''); }
    }, 500);
    return () => clearTimeout(timer);
  }, [form.comp, form.event, form.round, form.solveNum, form.personId, form.person, isEditing, editId]);

  // NOTE: WcaPersonPicker 选中回调
  const handleSolverPick = useCallback((person: WcaPerson) => {
    setField('person', person.name);
    setField('personId', person.wcaId);
    setField('personCountry', person.iso2 ?? '');
  }, [setField]);

  const clearSolver = useCallback(() => {
    setField('person', '');
    setField('personId', '');
    setField('personCountry', '');
  }, [setField]);

  // NOTE: 复盘者国家——前端展示用，DB 不存。来源：登录时取 authUser.country / 选完 picker 取 iso2
  const [reconerCountry, setReconerCountry] = useState<string>(authUser?.country ?? '');

  // NOTE: reconerId 与 authUser 匹配时回填 country（编辑模式 / 从 ?from= 跳来时）
  useEffect(() => {
    if (form.reconerId && authUser && form.reconerId === authUser.wcaId) {
      setReconerCountry(authUser.country);
    }
  }, [form.reconerId, authUser]);

  const handleReconerPick = useCallback((person: WcaPerson) => {
    setField('reconer', person.name);
    setField('reconerId', person.wcaId);
    setReconerCountry(person.iso2 ?? '');
  }, [setField]);

  const clearReconer = useCallback(() => {
    setField('reconer', '');
    setField('reconerId', '');
    setReconerCountry('');
  }, [setField]);

  // NOTE: 适配 searchSolvers (后端 WCA 代理) 到 WcaPersonPicker 的 searchFn 接口
  const solverSearchFn = useCallback(async (query: string): Promise<WcaPerson[]> => {
    try {
      const rows = await searchSolvers(query);
      return rows.map(r => ({ wcaId: r.wcaId, name: r.name, iso2: r.iso2, avatarUrl: '' }));
    } catch {
      return [];
    }
  }, []);

  // NOTE: 推断魔方类型
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

  // NOTE: 标准化 cross 显示切换（仅视图层；form.solution 永远是原文）
  const [normalized, setNormalized] = useState(false);
  const canNormalize = useMemo(
    () => hasWideMoveInCrossSection(form.solution || ''),
    [form.solution],
  );
  // canNormalize 变 false 时自动退出标准化视图(避免卡死)
  useEffect(() => { if (!canNormalize && normalized) setNormalized(false); }, [canNormalize, normalized]);

  const displaySolution = useMemo(() => {
    const orig = form.solution || '';
    if (!normalized || !canNormalize) return orig;
    return buildNormalizedSolution(orig) ?? orig;
  }, [form.solution, normalized, canNormalize]);

  // NOTE: 防抖延迟更新动画（避免打字时频繁销毁重建 Ctor）
  const [debouncedScramble, setDebouncedScramble] = useState(form.wcaScramble || form.optimalScramble || '');
  const [debouncedSolution, setDebouncedSolution] = useState(displaySolution);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedScramble(form.wcaScramble || form.optimalScramble || '');
      setDebouncedSolution(displaySolution);
    }, 500);
    return () => clearTimeout(timer);
  }, [form.wcaScramble, form.optimalScramble, displaySolution]);

  // NOTE: 获取 TwistyPlayer 实例以实现光标跟随
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

  // NOTE: 提交
  const handleSubmit = async () => {
    if (!form.event || !form.person) {
      alert(t('recon.fillRequired'));
      return;
    }
    setSaving(true);
    try {
      // NOTE: 合并统计结果到表单，日期再次确保为 yyyy-mm-dd
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

      if (isEditing) {
        await updateRecon(Number(editId), data);
        navigate(`/recon/${editId}`);
      } else {
        const created = await addRecon(data);
        navigate(`/recon/${created.id}`);
      }
    } catch (err) {
      alert(`Error: ${(err as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  if (loadingEdit) return <div className="recon-page"><div className="recon-loading">{t('common.loading')}</div></div>;

  return (
    <div className="recon-page submit-page">
      <div className="submit-header">
        <div className="detail-header">
          <div className="detail-header-nav">
            <LangToggle />
          </div>
          <h1>{isEditing ? t('recon.editRecon') : t('recon.addRecon')}</h1>
        </div>
        {dupWarning && <div className="submit-warning">{dupWarning}</div>}
      </div>

      <div className="submit-layout">
        {/* 左栏：动画 */}
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

        {/* 右栏：表单 */}
        <div className="submit-form-pane">
      <div className="submit-form">
        {/* === Hero 行：选手 / 项目 / 成绩 — 必填 3 项,大字号 === */}
        <div className="submit-hero">
          <div className={`submit-field ${form.personId ? 'submit-field-shrink' : ''}`}>
            <span className="submit-label">{t('recon.solver')} *</span>
            {form.personId ? (
              <div className="submit-solver-pill">
                <Flag iso2={form.personCountry || ''} />
                <span className="submit-solver-name">{displayCuberName(form.person || '', isZh)}</span>
                <button type="button" className="submit-solver-clear" onClick={clearSolver} aria-label="clear">✕</button>
              </div>
            ) : (
              <WcaPersonPicker
                mode="inline"
                onSelect={handleSolverPick}
                searchFn={solverSearchFn}
                placeholder=""
                autoConfirmExact
              />
            )}
          </div>
          <label className="submit-field">
            <span className="submit-label">{t('recon.event')} *</span>
            <EventSelect events={EVENTS} value={form.event ?? ''} onChange={(v) => setField('event', v)} />
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
        </div>

        {/* 实时统计 */}
        {stats && (
          <div className="submit-stats-preview">
            <span>
              {stats.stm} STM
              {form.rawTime != null && stats.tps > 0 && (
                <> / {Number(form.rawTime).toFixed(2)} = {stats.tps} TPS</>
              )}
            </span>
            {stats.crossStm > 0 && <span>Cross: {stats.crossStm}</span>}
            {stats.f2l > 0 && <span>F2L: {stats.f2l}</span>}
            {stats.ll > 0 && <span>LL: {stats.ll}</span>}
            {stats.ollFull && <span>{stats.ollFull}</span>}
            {stats.pllFull && <span>{stats.pllFull}</span>}
          </div>
        )}

        {/* 打乱 */}
        <label className="submit-field submit-block">
          <span className="submit-label">{t('recon.scramble')}</span>
          <textarea
            rows={1}
            value={form.wcaScramble || ''}
            onChange={e => {
              setField('wcaScramble', e.target.value);
              autoResize(e.target);
            }}
            onInput={e => autoResize(e.target as HTMLTextAreaElement)}
            ref={el => { if (el) autoResize(el); }}
            placeholder={t('recon.wcaScramble')}
            style={{ overflow: 'hidden', resize: 'none' }}
          />
        </label>

        {/* 解法 — 用 div 而非 label,避免点击 SolutionView 时冒泡到 label 激活第一个 form control(toggle 按钮) */}
        <div className="submit-field submit-block">
          <span className="submit-label submit-label-row">
            <span>{t('recon.solution')} *</span>
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
              ref={el => {
                (solutionRef as React.MutableRefObject<HTMLTextAreaElement | null>).current = el;
                if (el) autoResize(el);
              }}
              rows={1}
              defaultValue={form.solution || ''}
              onInput={e => {
                const el = e.target as HTMLTextAreaElement;
                setField('solution', el.value);
                autoResize(el);
                handleCursorSync(el);
              }}
              onClick={e => handleCursorSync(e.target as HTMLTextAreaElement)}
              onKeyUp={e => handleCursorSync(e.target as HTMLTextAreaElement)}
              placeholder={`// Cross (5)\nD R2 D' F D F'\n// F2L 1 (8)\nU R U' R' U' F' U F\n...`}
              className="submit-solution-textarea"
              style={{ overflow: 'hidden', resize: 'none' }}
            />
          )}
        </div>

        {/* NOTE: 虚拟键盘 — 标准化视图(只读)不显示;桌面端 toggle,移动端强制显示 */}
        {!normalized && (
          <>
            {!isMobile && (
              <button
                type="button"
                className={`submit-keyboard-toggle${showKeyboard ? ' active' : ''}`}
                onClick={() => setShowKeyboard(s => !s)}
                aria-label={isZh
                  ? (showKeyboard ? '隐藏虚拟键盘' : '显示虚拟键盘')
                  : (showKeyboard ? 'Hide keyboard' : 'Show keyboard')}
                title={isZh
                  ? (showKeyboard ? '隐藏虚拟键盘' : '显示虚拟键盘')
                  : (showKeyboard ? 'Hide keyboard' : 'Show keyboard')}
              >
                <Keyboard size={14} />
              </button>
            )}
            {(isMobile || showKeyboard) && (
              <CubeVirtualKeyboard
                textareaRef={solutionRef}
                onInput={() => {
                  if (solutionRef.current) {
                    setField('solution', solutionRef.current.value);
                    autoResize(solutionRef.current);
                    handleCursorSync(solutionRef.current);
                  }
                }}
              />
            )}
          </>
        )}

        {/* === 比赛信息 — 默认展开 === */}
        <CollapsibleSection
          title={isZh ? '比赛信息' : 'Competition'}
          defaultOpen
        >
          <div className="submit-row">
            <label className="submit-field submit-field-narrow">
              <span className="submit-label">WCA</span>
              <select value={form.official ? '1' : '0'} onChange={e => setField('official', e.target.value === '1')}>
                <option value="1">WCA</option>
                <option value="0">{t('recon.badge.nonWca')}</option>
              </select>
            </label>
            <div className={`submit-field ${form.compWcaId ? 'submit-field-shrink' : ''}`}>
              <span className="submit-label">{t('recon.competition')}</span>
              {form.compWcaId ? (
                <div className="submit-comp-pill">
                  <Flag iso2={form.country || ''} />
                  <span className="submit-comp-name">{localizeCompName(form.compWcaId || '', form.comp || '', isZh)}</span>
                  <button type="button" className="submit-comp-clear" onClick={clearPickedComp} aria-label="clear">✕</button>
                </div>
              ) : (
                <CompPicker
                  value={form.comp || ''}
                  onChange={(v) => setField('comp', v)}
                  onPick={applyPickedComp}
                  isZh={isZh}
                />
              )}
            </div>
          </div>

          <div className="submit-row">
            <label className="submit-field">
              <span className="submit-label">{t('recon.round')}</span>
              <select value={form.round || ''} onChange={e => setField('round', e.target.value)}>
                <option value="">{isZh ? '请选择' : 'Select…'}</option>
                {roundOptions.map(r => <option key={r} value={r}>{localizeRound(r, t)}</option>)}
              </select>
            </label>
            <label className="submit-field">
              <span className="submit-label">#</span>
              <select
                value={form.solveNum ?? ''}
                onChange={e => setField('solveNum', e.target.value === '' ? undefined : Number(e.target.value))}
              >
                <option value="">{isZh ? '请选择' : 'Select…'}</option>
                {solveNumOptions.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
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
                placeholder="Avg"
                readOnly={!!avgAutoSource}
                className={avgAutoSource ? 'submit-input-locked' : undefined}
                title={avgAutoSource ? (isZh ? '自动填充值不可编辑;改选手/比赛/项目/轮次以重新获取' : 'auto-filled, read-only; change person/comp/event/round to refetch') : undefined}
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
                readOnly={!!timeAutoSource}
                className={timeAutoSource ? 'submit-input-locked' : undefined}
                title={timeAutoSource ? (isZh ? '自动填充值不可编辑;改 选手/比赛/项目/轮次/第几把 以重新获取' : 'auto-filled, read-only; change person/comp/event/round/# to refetch') : undefined}
              />
              {timeLoading
                ? <span className="submit-hint submit-hint-loading"><Loader2 size={12} /> {isZh ? '自动获取中…' : 'fetching…'}</span>
                : timeAutoSource ? <span className="submit-hint">{timeAutoSource}</span> : null}
            </label>
            <label className="submit-field">
              <span className="submit-label">{t('recon.badge.singleRecord')}</span>
              <RecordSelect
                value={form.regionalSingleRecord || ''}
                onChange={(v) => { setField('regionalSingleRecord', v); setSingleRecordUserTouched(true); }}
                personIso2={form.personCountry}
              />
              {recordLoading
                ? <span className="submit-hint submit-hint-loading"><Loader2 size={12} /> {isZh ? '自动获取中…' : 'fetching…'}</span>
                : (!singleRecordUserTouched && form.regionalSingleRecord && recordAutoSource) ? <span className="submit-hint">{recordAutoSource}</span> : null}
            </label>
            <label className="submit-field">
              <span className="submit-label">{t('recon.badge.averageRecord')}</span>
              <RecordSelect
                value={form.regionalAverageRecord || ''}
                onChange={(v) => { setField('regionalAverageRecord', v); setAverageRecordUserTouched(true); }}
                personIso2={form.personCountry}
              />
              {recordLoading
                ? <span className="submit-hint submit-hint-loading"><Loader2 size={12} /> {isZh ? '自动获取中…' : 'fetching…'}</span>
                : (!averageRecordUserTouched && form.regionalAverageRecord && recordAutoSource) ? <span className="submit-hint">{recordAutoSource}</span> : null}
            </label>
          </div>
        </CollapsibleSection>

        {/* === 元数据 — 默认折叠 === */}
        <CollapsibleSection title={isZh ? '元数据' : 'Metadata'}>
          <div className="submit-row">
            <label className="submit-field submit-field-wide">
              <span className="submit-label">{t('recon.videoUrl')}</span>
              <textarea
                value={form.videoUrl || ''}
                onChange={e => setField('videoUrl', e.target.value)}
                placeholder="https://www.youtube.com/watch?v=...&#10;https://www.bilibili.com/video/BV..."
                rows={2}
              />
            </label>
          </div>

          <div className="submit-row">
            <label className="submit-field">
              <span className="submit-label">{t('recon.method')}</span>
              <select value={form.method} onChange={e => setField('method', e.target.value)}>
                {METHODS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
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
                  <button type="button" className="submit-solver-clear" onClick={clearReconer} aria-label="clear">✕</button>
                </div>
              ) : (
                <WcaPersonPicker
                  mode="inline"
                  onSelect={handleReconerPick}
                  searchFn={solverSearchFn}
                  placeholder=""
                  autoConfirmExact
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

        {/* 提交按钮 */}
        <div className="submit-actions">
          <button className="submit-btn submit-btn-primary" onClick={handleSubmit} disabled={saving}>
            {saving
              ? t('recon.submitting')
              : isEditing
                ? t('recon.saveChanges')
                : t('recon.submitRecon')}
          </button>
          <Link to={isEditing ? `/recon/${editId}` : '/recon'} className="submit-btn submit-btn-cancel">
            {t('recon.cancel')}
          </Link>
        </div>

        {/* Danger Zone — 编辑模式下的删除操作（GitHub 规范）*/}
        {isEditing && (
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
                    navigate('/recon');
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
      </div>{/* submit-form */}
        </div>{/* submit-form-pane */}
      </div>{/* submit-layout */}
    </div>
  );
}

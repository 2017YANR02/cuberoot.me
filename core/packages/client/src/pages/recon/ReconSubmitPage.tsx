/**
 * 复盘提交/编辑页——迁移自 recon/submit/recon_submit_page.js（2432 行）
 * NOTE: 表单字段、实时统计、重复检测、虚拟键盘
 */
import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { ReconSolve } from '@cuberoot/shared';
import { WcaPersonPicker, type WcaPerson } from '@cuberoot/shared';
import { getRecon, addRecon, updateRecon, checkDuplicate, searchSolvers } from '../../utils/recon_api';
import { Flag } from '../../utils/flag';
import { computeAllStats } from '../../utils/recon_stats';
import { parseTimeInput, formatTime } from '../../utils/recon_utils';
import { RecordSelect } from '../../components/RecordSelect';
import { EventSelect } from '../../components/EventSelect';
import { displayCuberName } from '../../utils/name_utils';
import LangToggle from '../../components/LangToggle';
import '../../recon.css';
import './recon_submit.css';
import CubeVirtualKeyboard from './components/CubeVirtualKeyboard';
import TwistySection from './components/TwistySection';
import { cleanForPlayer, extractAlgFromText, syncPlayerToMoveCount } from '../../utils/recon_alg_utils';

// ── 常量 ──

const EVENTS = ['3x3', '2x2', '4x4', '5x5', '6x6', '7x7', '3bld', '4bld', '5bld', 'oh', 'sq1', 'pyra', 'mega', 'clock', 'skewb', 'fmc', 'mbld'];
const METHODS = ['CFOP', 'Roux', 'ZZ', 'Petrus', 'LBL', 'Mehta', 'ZB', 'Other'];
const ROUNDS = ['1', '2', '3', 'f'];

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

export default function ReconSubmitPage() {
  const { editId } = useParams<{ editId: string }>();
  const isEditing = !!editId;
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const isZh = i18n.language === 'zh';
  const [saving, setSaving] = useState(false);
  const [loadingEdit, setLoadingEdit] = useState(isEditing);
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
    round: 'f',
    solveNum: 1,
    rawTime: undefined,
    average: undefined,
    solution: '',
    wcaScramble: '',
    optimalScramble: '',
    caption: '',
    note: '',
    videoUrl: '',
    cube: '',
    reconer: '',
    reconerId: '',
    regionalSingleRecord: '',
    regionalAverageRecord: '',
    aoType: '',
  });

  // NOTE: 搜索状态由 WcaPersonPicker 内部管理；form.personId 为空时显示 picker，已选时显示 pill
  const [timeInput, setTimeInput] = useState('');
  const [avgInput, setAvgInput] = useState('');
  const [dupWarning, setDupWarning] = useState('');

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
      if (solve.rawTime != null) setTimeInput(formatTime(solve.rawTime));
      if (solve.average != null) setAvgInput(formatTime(solve.average));
      // NOTE: 同步 textarea DOM——defaultValue 只在 mount 时生效，编辑模式 API 返回后需手动同步
      if (solutionRef.current && solve.solution) {
        solutionRef.current.value = solve.solution;
        autoResize(solutionRef.current);
      }
      setLoadingEdit(false);
    }).catch(() => setLoadingEdit(false));
  }, [editId, isEditing]);

  // NOTE: 更新表单字段
  const setField = useCallback(<K extends keyof ReconSolve>(key: K, value: ReconSolve[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
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

  // NOTE: 防抖延迟更新动画（避免打字时频繁销毁重建 Ctor）
  const [debouncedScramble, setDebouncedScramble] = useState(form.wcaScramble || form.optimalScramble || '');
  const [debouncedSolution, setDebouncedSolution] = useState(form.solution || '');

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedScramble(form.wcaScramble || form.optimalScramble || '');
      setDebouncedSolution(form.solution || '');
    }, 500);
    return () => clearTimeout(timer);
  }, [form.wcaScramble, form.optimalScramble, form.solution]);

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
      } else {
        await addRecon(data);
      }
      navigate('/recon');
    } catch (err) {
      alert(`Error: ${(err as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  if (loadingEdit) return <div className="recon-page"><div className="recon-loading">{t('common.loading')}</div></div>;

  return (
    <div className="recon-page">
      <div className="detail-header">
        <div className="detail-header-nav">
          <LangToggle />
        </div>
        <h1>{isEditing ? t('recon.editRecon') : t('recon.addRecon')}</h1>
      </div>

      {dupWarning && <div className="submit-warning">{dupWarning}</div>}

      <div className="submit-form">
        {/* 第一行：类型 + 项目 + 方法 */}
        <div className="submit-row">
          <label className="submit-field">
            <span className="submit-label">WCA</span>
            <select value={form.official ? '1' : '0'} onChange={e => setField('official', e.target.value === '1')}>
              <option value="1">WCA</option>
              <option value="0">{t('recon.badge.nonWca')}</option>
            </select>
          </label>
          <label className="submit-field">
            <span className="submit-label">{t('recon.event')} *</span>
            <EventSelect events={EVENTS} value={form.event} onChange={(v) => setField('event', v)} />
          </label>
          <label className="submit-field">
            <span className="submit-label">{t('recon.method')}</span>
            <select value={form.method} onChange={e => setField('method', e.target.value)}>
              {METHODS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </label>
        </div>

        {/* 第二行：选手 */}
        <div className="submit-row">
          <div className="submit-field submit-field-wide">
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
                placeholder={t('recon.searchSolver')}
                autoConfirmExact
              />
            )}
          </div>
        </div>

        {/* 第三行：比赛 + 轮次 + 第 N 把 */}
        <div className="submit-row">
          <label className="submit-field submit-field-wide">
            <span className="submit-label">{t('recon.competition')}</span>
            <input type="text" value={form.comp || ''} onChange={e => setField('comp', e.target.value)}
              placeholder={t('recon.compName')} />
          </label>
          <label className="submit-field">
            <span className="submit-label">{t('recon.round')}</span>
            <select value={form.round} onChange={e => setField('round', e.target.value)}>
              {ROUNDS.map(r => <option key={r} value={r}>{
                r === 'f' ? t('recon.roundOption.final')
                  : t('recon.roundOption.numbered', { n: r })
              }</option>)}
            </select>
          </label>
          <label className="submit-field">
            <span className="submit-label">#</span>
            <input type="number" min={1} max={5} value={form.solveNum ?? ''} onChange={e => setField('solveNum', Number(e.target.value) || undefined)} />
          </label>
        </div>

        {/* 第三行续：WCA ID / 国家 / 分组 */}
        <div className="submit-row">
          <label className="submit-field">
            <span className="submit-label">Comp WCA ID</span>
            <input type="text" value={form.compWcaId || ''} onChange={e => setField('compWcaId', e.target.value)}
              placeholder="e.g. WC2025" />
          </label>
          <label className="submit-field">
            <span className="submit-label">{t('recon.country')}</span>
            <div className="submit-country-input">
              <input type="text" value={form.country || ''} onChange={e => setField('country', e.target.value)}
                placeholder="ISO2 (cn/us)" maxLength={2} />
              {form.country && form.country.length === 2 && (
                <Flag iso2={form.country} className="submit-country-flag" />
              )}
            </div>
          </label>
          <label className="submit-field">
            <span className="submit-label">{t('recon.group')}</span>
            <input type="text" value={form.groupId || ''} onChange={e => setField('groupId', e.target.value)}
              placeholder="A/B/C" maxLength={1} />
          </label>
        </div>

        {/* 第四行：成绩 + 平均 + 日期 */}
        <div className="submit-row">
          <label className="submit-field">
            <span className="submit-label">{t('recon.time')}</span>
            <input type="text" value={timeInput} onChange={e => setTimeInput(e.target.value)}
              placeholder="12.34 / 1:12.34" />
          </label>
          <label className="submit-field">
            <span className="submit-label">{t('recon.average')}</span>
            <input type="text" value={avgInput} onChange={e => setAvgInput(e.target.value)}
              placeholder="Avg" />
          </label>
          <label className="submit-field">
            <span className="submit-label">{t('recon.date')}</span>
            <input type="text" value={form.date || ''} onChange={e => setField('date', e.target.value)}
              placeholder="yyyy-mm-dd" pattern="\d{4}-\d{2}-\d{2}" />
          </label>
        </div>

        {/* 纪录标记 */}
        <div className="submit-row">
          <label className="submit-field">
            <span className="submit-label">{t('recon.badge.singleRecord')}</span>
            <RecordSelect value={form.regionalSingleRecord || ''} onChange={(v) => setField('regionalSingleRecord', v)} />
          </label>
          <label className="submit-field">
            <span className="submit-label">{t('recon.badge.averageRecord')}</span>
            <RecordSelect value={form.regionalAverageRecord || ''} onChange={(v) => setField('regionalAverageRecord', v)} />
          </label>
        </div>

        {/* 打乱 */}
        <label className="submit-field submit-block">
          <span className="submit-label">{t('recon.scramble')}</span>
          <textarea
            rows={2}
            value={form.wcaScramble || ''}
            onChange={e => setField('wcaScramble', e.target.value)}
            placeholder={t('recon.wcaScramble')}
          />
        </label>

        {/* 动画预览 */}
        {form.event && form.event !== 'sq1' && (
          <div className="submit-field submit-block">
            <TwistySection
              puzzle={puzzle}
              scramble={debouncedScramble}
              alg={cleanForPlayer(debouncedSolution)}
              playerRef={playerRef}
            />
          </div>
        )}

        {/* 解法 */}
        <label className="submit-field submit-block">
          <span className="submit-label">{t('recon.solution')} *</span>
          <textarea
            ref={solutionRef}
            rows={4}
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
            style={{ overflow: 'hidden' }}
          />
        </label>
        {/* NOTE: 虚拟键盘——紧贴在 solution textarea 下方 */}
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

        {/* 实时统计 */}
        {stats && (
          <div className="submit-stats-preview">
            <span>STM: {stats.stm}</span>
            <span>TPS: {stats.tps}</span>
            {stats.crossStm > 0 && <span>Cross: {stats.crossStm}</span>}
            {stats.f2l > 0 && <span>F2L: {stats.f2l}</span>}
            {stats.ll > 0 && <span>LL: {stats.ll}</span>}
            {stats.ollFull && <span>{stats.ollFull}</span>}
            {stats.pllFull && <span>{stats.pllFull}</span>}
          </div>
        )}

        {/* 附加信息 */}
        <div className="submit-row">
          <label className="submit-field submit-field-wide">
            <span className="submit-label">{t('recon.videoUrl')}</span>
            <input type="text" value={form.videoUrl || ''} onChange={e => setField('videoUrl', e.target.value)}
              placeholder="https://www.youtube.com/watch?v=..." />
          </label>
        </div>

        <div className="submit-row">
          <label className="submit-field">
            <span className="submit-label">{t('recon.cube')}</span>
            <input type="text" value={form.cube || ''} onChange={e => setField('cube', e.target.value)} />
          </label>
          <label className="submit-field submit-field-wide">
            <span className="submit-label">{t('recon.note')}</span>
            <input type="text" value={form.note || ''} onChange={e => setField('note', e.target.value)} />
          </label>
        </div>

        {/* 复盘者信息 */}
        <div className="submit-row">
          <label className="submit-field">
            <span className="submit-label">{t('recon.reconstructor')}</span>
            <input type="text" value={form.reconer || ''} onChange={e => setField('reconer', e.target.value)}
              placeholder={t('recon.reconName')} />
          </label>
          <label className="submit-field">
            <span className="submit-label">{t('recon.reconWcaId')}</span>
            <input type="text" value={form.reconerId || ''} onChange={e => setField('reconerId', e.target.value)}
              placeholder="2019XXXX01" />
          </label>
          <label className="submit-field">
            <span className="submit-label">{t('recon.reconDate')}</span>
            <input type="text" value={form.reconDate || ''} onChange={e => setField('reconDate', e.target.value)}
              placeholder="yyyy-mm-dd" pattern="\d{4}-\d{2}-\d{2}" />
          </label>
        </div>

        {/* 提交按钮 */}
        <div className="submit-actions">
          <button className="submit-btn submit-btn-primary" onClick={handleSubmit} disabled={saving}>
            {saving
              ? t('recon.submitting')
              : isEditing
                ? t('recon.saveChanges')
                : t('recon.submitRecon')}
          </button>
          <Link to="/recon" className="submit-btn submit-btn-cancel">
            {t('recon.cancel')}
          </Link>
        </div>
      </div>
    </div>
  );
}

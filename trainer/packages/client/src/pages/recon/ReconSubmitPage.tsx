/**
 * 复盘提交/编辑页——迁移自 recon/submit/recon_submit_page.js（2432 行）
 * NOTE: 简化版，保留核心功能：表单字段、实时统计、重复检测
 * 虚拟键盘将在后续版本实现
 */
import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import type { ReconSolve } from '@cuberoot/shared';
import { getRecon, addRecon, updateRecon, checkDuplicate, searchSolvers } from '../../utils/recon_api';
import { computeAllStats } from '../../utils/recon_stats';
import { parseTimeInput, formatTime, getEventDisplayName, t, RECORD_OPTIONS } from '../../utils/recon_utils';
import '../../recon.css';
import './recon_submit.css';

// ── 常量 ──

const EVENTS = ['3x3', '2x2', '4x4', '5x5', '6x6', '7x7', '3bld', '4bld', '5bld', 'oh', 'sq1', 'pyra', 'mega', 'clock', 'skewb', 'fmc', 'mbld'];
const METHODS = ['CFOP', 'Roux', 'ZZ', 'Petrus', 'LBL', 'Mehta', 'ZB', 'Other'];
const ROUNDS = ['1', '2', '3', 'sf', 'cf', 'f'];

export default function ReconSubmitPage() {
  const { editId } = useParams<{ editId: string }>();
  const isEditing = !!editId;
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [loadingEdit, setLoadingEdit] = useState(isEditing);

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

  // NOTE: 搜索相关状态
  const [solverQuery, setSolverQuery] = useState('');
  const [solverResults, setSolverResults] = useState<{ name: string; iso2: string; wcaId: string }[]>([]);
  const [timeInput, setTimeInput] = useState('');
  const [avgInput, setAvgInput] = useState('');
  const [dupWarning, setDupWarning] = useState('');

  // NOTE: 编辑模式加载数据
  useEffect(() => {
    if (!isEditing) return;
    setLoadingEdit(true);
    getRecon(Number(editId)).then(solve => {
      setForm(solve);
      if (solve.rawTime != null) setTimeInput(formatTime(solve.rawTime));
      if (solve.average != null) setAvgInput(formatTime(solve.average));
      setLoadingEdit(false);
    }).catch(() => setLoadingEdit(false));
  }, [editId, isEditing]);

  // NOTE: 更新表单字段
  const setField = useCallback(<K extends keyof ReconSolve>(key: K, value: ReconSolve[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
  }, []);

  // NOTE: 实时解法统计
  const stats = useMemo(() => {
    if (!form.solution) return null;
    const time = form.rawTime ?? 0;
    return computeAllStats(form.solution, time);
  }, [form.solution, form.rawTime]);

  // NOTE: 选手搜索
  useEffect(() => {
    if (solverQuery.length < 2) { setSolverResults([]); return; }
    const timer = setTimeout(async () => {
      try {
        const results = await searchSolvers(solverQuery);
        setSolverResults(results);
      } catch { setSolverResults([]); }
    }, 300);
    return () => clearTimeout(timer);
  }, [solverQuery]);

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
          setDupWarning(t(
            `⚠️ 已存在相同复盘 (#${result.id})`,
            `⚠️ Duplicate found (#${result.id})`,
          ));
        } else {
          setDupWarning('');
        }
      } catch { setDupWarning(''); }
    }, 500);
    return () => clearTimeout(timer);
  }, [form.comp, form.event, form.round, form.solveNum, form.personId, form.person, isEditing, editId]);

  // NOTE: 选择选手
  const selectSolver = (solver: { name: string; iso2: string; wcaId: string }) => {
    setField('person', solver.name);
    setField('personId', solver.wcaId);
    setField('personCountry', solver.iso2);
    setSolverQuery('');
    setSolverResults([]);
  };

  // NOTE: 提交
  const handleSubmit = async () => {
    if (!form.event || !form.person) {
      alert(t('请填写必填字段', 'Please fill required fields'));
      return;
    }
    setSaving(true);
    try {
      // NOTE: 合并统计结果到表单
      const data: Partial<ReconSolve> = { ...form };
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

  if (loadingEdit) return <div className="recon-page"><div className="recon-loading">Loading...</div></div>;

  return (
    <div className="recon-page">
      <div className="detail-header">
        <Link to="/recon" className="detail-back">← {t('返回', 'Back')}</Link>
        <h1>{isEditing ? t('编辑复盘', 'Edit Reconstruction') : t('添加复盘', 'Add Reconstruction')}</h1>
      </div>

      {dupWarning && <div className="submit-warning">{dupWarning}</div>}

      <div className="submit-form">
        {/* 第一行：类型 + 项目 + 方法 */}
        <div className="submit-row">
          <label className="submit-field">
            <span className="submit-label">WCA</span>
            <select value={form.official ? '1' : '0'} onChange={e => setField('official', e.target.value === '1')}>
              <option value="1">✅ WCA</option>
              <option value="0">❌ Non-WCA</option>
            </select>
          </label>
          <label className="submit-field">
            <span className="submit-label">{t('项目', 'Event')} *</span>
            <select value={form.event} onChange={e => setField('event', e.target.value)}>
              {EVENTS.map(ev => (
                <option key={ev} value={ev}>{getEventDisplayName(ev)}</option>
              ))}
            </select>
          </label>
          <label className="submit-field">
            <span className="submit-label">{t('方法', 'Method')}</span>
            <select value={form.method} onChange={e => setField('method', e.target.value)}>
              {METHODS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </label>
        </div>

        {/* 第二行：选手 */}
        <div className="submit-row">
          <div className="submit-field submit-field-wide">
            <span className="submit-label">{t('选手', 'Solver')} *</span>
            <input
              type="text"
              value={solverQuery || form.person || ''}
              onChange={(e) => {
                setSolverQuery(e.target.value);
                if (!e.target.value) setField('person', '');
              }}
              placeholder={t('搜索选手姓名或 WCA ID...', 'Search solver name or WCA ID...')}
            />
            {solverResults.length > 0 && (
              <ul className="submit-dropdown">
                {solverResults.map(s => (
                  <li key={s.wcaId} onClick={() => selectSolver(s)}>
                    {s.name} ({s.wcaId}) {s.iso2}
                  </li>
                ))}
              </ul>
            )}
            {form.personId && (
              <span className="submit-hint">{form.personId} · {form.personCountry}</span>
            )}
          </div>
        </div>

        {/* 第三行：比赛 + 轮次 + 第 N 把 */}
        <div className="submit-row">
          <label className="submit-field submit-field-wide">
            <span className="submit-label">{t('比赛', 'Competition')}</span>
            <input type="text" value={form.comp || ''} onChange={e => setField('comp', e.target.value)}
              placeholder={t('比赛名称', 'Competition name')} />
          </label>
          <label className="submit-field">
            <span className="submit-label">{t('轮次', 'Round')}</span>
            <select value={form.round} onChange={e => setField('round', e.target.value)}>
              {ROUNDS.map(r => <option key={r} value={r}>{r === 'f' ? 'Final' : r === 'sf' ? 'Semi' : r === 'cf' ? 'Combined' : `Round ${r}`}</option>)}
            </select>
          </label>
          <label className="submit-field">
            <span className="submit-label">#</span>
            <input type="number" min={1} max={5} value={form.solveNum ?? ''} onChange={e => setField('solveNum', Number(e.target.value) || undefined)} />
          </label>
        </div>

        {/* 第四行：成绩 + 平均 */}
        <div className="submit-row">
          <label className="submit-field">
            <span className="submit-label">{t('成绩', 'Time')}</span>
            <input type="text" value={timeInput} onChange={e => setTimeInput(e.target.value)}
              placeholder="12.34 / 1:12.34" />
          </label>
          <label className="submit-field">
            <span className="submit-label">{t('平均', 'Average')}</span>
            <input type="text" value={avgInput} onChange={e => setAvgInput(e.target.value)}
              placeholder="Avg" />
          </label>
          <label className="submit-field">
            <span className="submit-label">{t('日期', 'Date')}</span>
            <input type="date" value={form.date || ''} onChange={e => setField('date', e.target.value)} />
          </label>
        </div>

        {/* 纪录标记 */}
        <div className="submit-row">
          <label className="submit-field">
            <span className="submit-label">Single Record</span>
            <select value={form.regionalSingleRecord || ''} onChange={e => setField('regionalSingleRecord', e.target.value)}>
              <option value="">-</option>
              {RECORD_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </label>
          <label className="submit-field">
            <span className="submit-label">Average Record</span>
            <select value={form.regionalAverageRecord || ''} onChange={e => setField('regionalAverageRecord', e.target.value)}>
              <option value="">-</option>
              {RECORD_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </label>
        </div>

        {/* 打乱 */}
        <label className="submit-field submit-block">
          <span className="submit-label">{t('打乱', 'Scramble')}</span>
          <textarea
            rows={2}
            value={form.wcaScramble || ''}
            onChange={e => setField('wcaScramble', e.target.value)}
            placeholder={t('WCA 官方打乱', 'WCA scramble')}
          />
        </label>

        {/* 解法 */}
        <label className="submit-field submit-block">
          <span className="submit-label">{t('解法', 'Solution')} *</span>
          <textarea
            rows={12}
            value={form.solution || ''}
            onChange={e => setField('solution', e.target.value)}
            placeholder={`// Cross (5)\nD R2 D' F D F'\n// F2L 1 (8)\nU R U' R' U' F' U F\n...`}
            className="submit-solution-textarea"
          />
        </label>

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
            <span className="submit-label">{t('视频链接', 'Video URL')}</span>
            <input type="text" value={form.videoUrl || ''} onChange={e => setField('videoUrl', e.target.value)}
              placeholder="https://www.youtube.com/watch?v=..." />
          </label>
        </div>

        <div className="submit-row">
          <label className="submit-field">
            <span className="submit-label">{t('魔方型号', 'Cube')}</span>
            <input type="text" value={form.cube || ''} onChange={e => setField('cube', e.target.value)} />
          </label>
          <label className="submit-field submit-field-wide">
            <span className="submit-label">{t('备注', 'Note')}</span>
            <input type="text" value={form.note || ''} onChange={e => setField('note', e.target.value)} />
          </label>
        </div>

        {/* 提交按钮 */}
        <div className="submit-actions">
          <button className="submit-btn submit-btn-primary" onClick={handleSubmit} disabled={saving}>
            {saving
              ? t('提交中...', 'Submitting...')
              : isEditing
                ? t('保存修改', 'Save Changes')
                : t('提交复盘', 'Submit Reconstruction')}
          </button>
          <Link to="/recon" className="submit-btn submit-btn-cancel">
            {t('取消', 'Cancel')}
          </Link>
        </div>
      </div>
    </div>
  );
}

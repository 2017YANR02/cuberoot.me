'use client';

/**
 * /scramble/mcc — Movecount Coefficient(MCC)公式测速。
 *
 * Port of trangium.github.io/MovecountCoefficient(MIT,算法引擎见 lib/mcc.ts,
 * 与上游 golden 对拍锁定)。UI 重设计:即时计算 + 结果表排序取代上游的
 * Calculate / Calculate & Sort 按钮;STM 列常显;统计行常显。
 */
import { useMemo, useState } from 'react';
import { useQueryState, parseAsBoolean, parseAsStringEnum } from 'nuqs';
import { ChevronDown } from 'lucide-react';
import BoolToggle from '@/components/BoolToggle';
import PillToggle from '@/components/PillToggle/PillToggle';
import SortArrow from '@/components/SortArrow';
import { ClearButton } from '@/components/ClearButton';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useT } from '@/hooks/useT';
import { tr } from '@/i18n/tr';
import {
  algSpeed, getESQ, getSTM, normalizeLine,
  MCC_DEFAULTS, ESQ_DEFAULTS, type EsqParams, type MccParams,
} from '@/lib/mcc';
import './mcc.css';

type Metric = 'mcc' | 'esq';
type SortKey = 'input' | 'stm' | 'metric';
type SortDir = 'asc' | 'desc';

const EXAMPLE = [
  "R U R' U' R' F R2 U' R' U' R U R' F'",
  "R U R' F' R U R' U' R' F R2 U' R'",
  "R' U L' U2 R U' R' U2 R L",
  'M2 U M2 U2 M2 U M2',
  "M2 U M U2 M' U M2",
  "x R' U R' D2 R U' R' D2 R2 x'",
  "R2 U R' U R' U' R U' R2 U' D R' U R D'",
].join('\n');

interface SliderSpec<K extends string> {
  key: K;
  zh: string;
  en: string;
  min: number;
  max: number;
  step: number;
}

const MCC_SLIDERS: SliderSpec<keyof MccParams>[] = [
  { key: 'wristMult', zh: '手腕转系数', en: 'Wrist turn ×', min: 0, max: 1, step: 0.05 },
  { key: 'pushMult', zh: '推转系数', en: 'Push turn ×', min: 1, max: 3, step: 0.05 },
  { key: 'ringMult', zh: '无名指拨系数', en: 'Ring turn ×', min: 1, max: 3, step: 0.05 },
  { key: 'destabilize', zh: '失稳惩罚', en: 'Destabilize penalty', min: 0, max: 2, step: 0.05 },
  { key: 'addRegrip', zh: '软换手惩罚', en: 'Soft regrip penalty', min: 0, max: 4, step: 0.05 },
  { key: 'double', zh: '180° 转系数', en: 'Half turn ×', min: 1, max: 2, step: 0.05 },
  { key: 'sesliceMult', zh: 'S/E 中层系数', en: 'S/E slice ×', min: 1, max: 2, step: 0.05 },
  { key: 'overWorkMult', zh: '过劳惩罚', en: 'Overwork penalty', min: 0, max: 5, step: 0.05 },
  { key: 'moveblock', zh: '前步阻挡惩罚', en: 'Move block penalty', min: 0, max: 3, step: 0.05 },
  { key: 'rotation', zh: 'y/z 转身代价', en: 'y/z rotation', min: 1, max: 7, step: 0.1 },
];

const ESQ_SLIDERS: SliderSpec<keyof EsqParams>[] = [
  { key: 'wristQuarter', zh: '手腕 90°', en: 'Wrist quarter', min: 0, max: 5, step: 0.1 },
  { key: 'flickQuarter', zh: '手指 90°', en: 'Flick quarter', min: 0, max: 5, step: 0.1 },
  { key: 'wristHalf', zh: '手腕 180°', en: 'Wrist half', min: 0, max: 5, step: 0.1 },
  { key: 'flickHalf', zh: '手指 180°', en: 'Flick half', min: 0, max: 5, step: 0.1 },
];

interface Row {
  /** 输入里的行号(1 起,含空行,便于与左侧对照) */
  line: number;
  alg: string;
  stm: number;
  /** 数值 = 正常;字符串 = 未知步名 */
  value: number | string;
}

/** 显示用:去浮点尾巴,最多 2 位小数。 */
const fmt = (n: number) => String(Math.round(n * 100) / 100);

const UNKNOWN_PREFIX = 'Unknown move: ';

export default function MccPage() {
  const t = useT();
  useDocumentTitle('MCC 公式测速', 'Movecount Coefficient');

  const [input, setInput] = useState('');
  const [metric, setMetric] = useQueryState('metric', parseAsStringEnum<Metric>(['mcc', 'esq']).withDefault('mcc'));
  const [ignoreUnknown, setIgnoreUnknown] = useQueryState('skipUnknown', parseAsBoolean.withDefault(false));
  const [ignoreAuf, setIgnoreAuf] = useQueryState('noAuf', parseAsBoolean.withDefault(true));
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [mccParams, setMccParams] = useState<MccParams>(MCC_DEFAULTS);
  const [esqParams, setEsqParams] = useState<EsqParams>(ESQ_DEFAULTS);
  const [sortKey, setSortKey] = useState<SortKey>('input');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const rows = useMemo<Row[]>(() => {
    // 上游把 \t 当换行(方便从表格粘贴);这里解析时等价处理,不改写输入框
    const lines = input.split(/\r?\n|\t/);
    const out: Row[] = [];
    for (let i = 0; i < lines.length; i++) {
      const alg = lines[i].trim();
      if (!alg) continue;
      const norm = normalizeLine(alg);
      const value = metric === 'mcc'
        ? algSpeed(norm, ignoreUnknown, ignoreAuf, mccParams)
        : getESQ(norm, ignoreAuf, esqParams);
      out.push({
        line: i + 1,
        alg,
        stm: getSTM(alg, ignoreAuf),
        value: typeof value === 'string' ? value.slice(UNKNOWN_PREFIX.length) : value,
      });
    }
    return out;
  }, [input, metric, ignoreUnknown, ignoreAuf, mccParams, esqParams]);

  const sorted = useMemo(() => {
    if (sortKey === 'input') return rows;
    const num = (r: Row) => {
      if (sortKey === 'stm') return r.stm;
      return typeof r.value === 'number' ? r.value : Infinity; // 错误行沉底,同上游 customParseFloat
    };
    return [...rows].sort((a, b) => (sortDir === 'asc' ? num(a) - num(b) : num(b) - num(a)));
  }, [rows, sortKey, sortDir]);

  const stats = useMemo(() => {
    const vals = rows.filter((r): r is Row & { value: number } => typeof r.value === 'number');
    if (vals.length === 0) return null;
    return {
      n: rows.length,
      meanMetric: vals.reduce((s, r) => s + r.value, 0) / vals.length,
      meanStm: vals.reduce((s, r) => s + r.stm, 0) / vals.length,
    };
  }, [rows]);

  const toggleSort = (key: Exclude<SortKey, 'input'>) => {
    if (sortKey !== key) {
      setSortKey(key);
      setSortDir('asc'); // 升序在前 = 最快的公式排最上,对应上游 Calculate & Sort
    } else if (sortDir === 'asc') {
      setSortDir('desc');
    } else {
      setSortKey('input');
    }
  };

  const metricName = metric === 'mcc' ? 'MCC' : tr({ zh: '增强 SQTM', en: 'Enhanced SQTM' });
  const isDefaultParams = metric === 'mcc'
    ? MCC_SLIDERS.every((s) => mccParams[s.key] === MCC_DEFAULTS[s.key])
    : ESQ_SLIDERS.every((s) => esqParams[s.key] === ESQ_DEFAULTS[s.key]);

  return (
    <div className="mcc-page">
      <header className="mcc-header">
        <h1>{t('MCC 公式测速', 'Movecount Coefficient')}</h1>
        <p className="mcc-lead">
          {t(
            '衡量 3x3 公式的手速潜力:模拟最优手法下的换手、过劳、失稳等代价,数值越低越快。',
            'Estimates how fast a 3x3 alg can be executed: models regrips, finger overwork and instability under optimal fingertricks — lower is faster.',
          )}
        </p>
      </header>

      <div className="mcc-controls">
        <PillToggle
          value={metric === 'esq'}
          onChange={(v) => { void setMetric(v ? 'esq' : 'mcc'); }}
          offLabel="MCC"
          onLabel={tr({ zh: '增强 SQTM', en: 'Enhanced SQTM' })}
          ariaLabel={tr({ zh: '输出指标', en: 'Output metric' })}
        />
        <BoolToggle
          value={ignoreAuf}
          onChange={(v) => { void setIgnoreAuf(v); }}
          label={t('忽略首尾 U 步', 'Ignore leading & trailing U moves')}
        />
        {metric === 'mcc' && (
          <BoolToggle
            value={ignoreUnknown}
            onChange={(v) => { void setIgnoreUnknown(v); }}
            label={t('跳过未知步', 'Skip unknown moves')}
          />
        )}
        <button
          type="button"
          className={`mcc-advanced-toggle${showAdvanced ? ' is-open' : ''}`}
          onClick={() => setShowAdvanced((v) => !v)}
          aria-expanded={showAdvanced}
        >
          {t('高级参数', 'Advanced options')}
          <ChevronDown size={15} className="mcc-advanced-chevron" aria-hidden="true" />
        </button>
      </div>

      {showAdvanced && (
        <div className="mcc-advanced">
          {metric === 'mcc'
            ? MCC_SLIDERS.map((s) => (
              <label key={s.key} className="mcc-slider">
                <span className="mcc-slider-label">{tr(s)}</span>
                <input
                  type="range"
                  min={s.min}
                  max={s.max}
                  step={s.step}
                  value={mccParams[s.key]}
                  onChange={(e) => setMccParams((p) => ({ ...p, [s.key]: Number(e.target.value) }))}
                />
                <span className="mcc-slider-value">{fmt(mccParams[s.key])}</span>
              </label>
            ))
            : ESQ_SLIDERS.map((s) => (
              <label key={s.key} className="mcc-slider">
                <span className="mcc-slider-label">{tr(s)}</span>
                <input
                  type="range"
                  min={s.min}
                  max={s.max}
                  step={s.step}
                  value={esqParams[s.key]}
                  onChange={(e) => setEsqParams((p) => ({ ...p, [s.key]: Number(e.target.value) }))}
                />
                <span className="mcc-slider-value">{fmt(esqParams[s.key])}</span>
              </label>
            ))}
          {!isDefaultParams && (
            <button
              type="button"
              className="mcc-reset"
              onClick={() => (metric === 'mcc' ? setMccParams(MCC_DEFAULTS) : setEsqParams(ESQ_DEFAULTS))}
            >
              {t('恢复默认', 'Reset to defaults')}
            </button>
          )}
        </div>
      )}

      <div className="mcc-body">
        <section className="mcc-input-col">
          <div className="mcc-col-head">
            <h2>{t('公式(每行一条)', 'Algs (one per line)')}</h2>
            {input !== '' && <ClearButton variant="standalone" onClick={() => setInput('')} />}
            {input === '' && (
              <button type="button" className="mcc-example" onClick={() => setInput(EXAMPLE)}>
                {t('填入示例', 'Load example')}
              </button>
            )}
          </div>
          <textarea
            className="mcc-textarea"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={Math.max(14, Math.min(40, input.split('\n').length + 2))}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            placeholder={"R U R' U' R' F R2 U' R' U' R U R' F'\nR U R' F' R U R' U' R' F R2 U' R'\n…"}
          />
          <p className="mcc-hint">
            {t(
              "支持 RUFDLB / rufdlb 宽层 / MES 中层 / xyz 转身;宽层用小写(r),不认 Rw。",
              'Supports RUFDLB, lowercase wide (r), MES slices and xyz rotations; wide moves must be lowercase — Rw is not recognized.',
            )}
          </p>
        </section>

        <section className="mcc-result-col">
          {stats && (
            <p className="mcc-stats">
              {t(`${stats.n} 条`, `${stats.n} algs`)}
              <span className="mcc-stats-sep" />
              {t(`平均 ${metricName} ${stats.meanMetric.toFixed(2)}`, `mean ${metricName} ${stats.meanMetric.toFixed(2)}`)}
              <span className="mcc-stats-sep" />
              {t(`平均 STM ${stats.meanStm.toFixed(2)}`, `mean STM ${stats.meanStm.toFixed(2)}`)}
            </p>
          )}
          {rows.length === 0 ? (
            <p className="mcc-empty">{t('输入公式后即时计算。', 'Results appear as you type.')}</p>
          ) : (
            <div className="mcc-table-wrap">
              <table className="mcc-table">
                <thead>
                  <tr>
                    <th className="mcc-th-line">#</th>
                    <th className="mcc-th-alg">{t('公式', 'Alg')}</th>
                    <th className="mcc-th-num">
                      <button type="button" className="mcc-th-sort" onClick={() => toggleSort('stm')}>
                        STM<SortArrow active={sortKey === 'stm'} dir={sortDir} />
                      </button>
                    </th>
                    <th className="mcc-th-num">
                      <button type="button" className="mcc-th-sort" onClick={() => toggleSort('metric')}>
                        {metricName}<SortArrow active={sortKey === 'metric'} dir={sortDir} />
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((r) => (
                    <tr key={r.line}>
                      <td className="mcc-td-line">{r.line}</td>
                      <td className="mcc-td-alg">{r.alg}</td>
                      <td className="mcc-td-num">{r.stm}</td>
                      <td className="mcc-td-num">
                        {typeof r.value === 'number'
                          ? fmt(r.value)
                          : <span className="mcc-unknown">{t(`未知步 ${r.value}`, `unknown move ${r.value}`)}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      <p className="mcc-credit">
        {t('算法移植自 ', 'Algorithm ported from ')}
        <a href="https://github.com/trangium/trangium.github.io" target="_blank" rel="noreferrer">trangium/MovecountCoefficient</a>
        {t('(MIT);指标介绍见 ', ' (MIT); background: ')}
        <a href="https://www.speedsolving.com/threads/movecount-coefficient-calculator-online-tool-to-evaluate-the-speed-of-3x3-algorithms.79025/" target="_blank" rel="noreferrer">speedsolving.com</a>
      </p>
    </div>
  );
}

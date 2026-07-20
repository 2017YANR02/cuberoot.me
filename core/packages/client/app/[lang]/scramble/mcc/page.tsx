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
import { ESQ_SLIDERS, MCC_SLIDERS, ParamSliders } from '@/components/ParamSliders';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useT } from '@/hooks/useT';
import { tr } from '@/i18n/tr';
import {
  algSpeed, getESQ, getSTM, normalizeLine,
  MCC_DEFAULTS, ESQ_DEFAULTS, type EsqParams, type MccParams,
} from '@/lib/mcc';
import ScoringGuide from './_ScoringGuide';
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
  // 默认按当前指标升序 = 最快的公式排最前(对应上游的 Calculate & Sort)
  const [sortKey, setSortKey] = useState<SortKey>('metric');
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
        metric === 'mcc'
          ? <ParamSliders className="mcc-advanced" specs={MCC_SLIDERS} values={mccParams} defaults={MCC_DEFAULTS} onChange={setMccParams} />
          : <ParamSliders className="mcc-advanced" specs={ESQ_SLIDERS} values={esqParams} defaults={ESQ_DEFAULTS} onChange={setEsqParams} />
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

      <ScoringGuide metric={metric} mccParams={mccParams} esqParams={esqParams} />

      <p className="mcc-credit">
        {t('算法移植自 ', 'Algorithm ported from ')}
        <a href="https://github.com/trangium/trangium.github.io" target="_blank" rel="noreferrer">trangium/MovecountCoefficient</a>
        {t('(MIT);指标介绍见 ', ' (MIT); background: ')}
        <a href="https://www.speedsolving.com/threads/movecount-coefficient-calculator-online-tool-to-evaluate-the-speed-of-3x3-algorithms.79025/" target="_blank" rel="noreferrer">speedsolving.com</a>
      </p>
    </div>
  );
}

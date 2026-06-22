'use client';

// name_stats 专属可视化:词数 / 字符长度 双 tab。
// 分布复用 /scramble 的 DiscreteHistogram(竖向渐变柱 + PDF/CDF + %/计数 切换),
// 点柱子 → 下方展示该组的国旗占比 + 选手名(站内链接)。字符长度尾部过长时折叠成 "N+"。
import React, { useMemo, useState, useEffect } from 'react';
import Link from '@/components/AppLink';
import { parseAsStringEnum, useQueryState } from 'nuqs';
import { Flag } from '@/components/Flag';
import { countryToIso2, personFlagIso2, loadFlagData, flagDataVersion } from '@/lib/country-flags';
import { tr } from '@/i18n/tr';
import DiscreteHistogram from '@/app/[lang]/scramble/stats/_components/DiscreteHistogram';
import PillToggle from '@/components/PillToggle/PillToggle';
import StackedBar, { type StackedSeg } from '@/components/StackedBar/StackedBar';
import { type NameMode, NAME_MODES, nameByMode, nameModeOptions, FormerNames } from './nameMode';
import './name-stats.css';

interface Country { c: string; n: number; p: number; }
interface PersonItem { n: string; id: string; former?: string[]; }
interface People { total: number; items: PersonItem[]; }
type Row = [number, number, Country[], People];
interface Panel { id: string; labelEn: string; labelZh: string; sections: { rows: Row[] }[]; }
export interface NameStatsData { panels?: Panel[]; }

function fmtPct(p: number): string {
  return p >= 9.95 ? `${Math.round(p)}%` : `${p.toFixed(1)}%`;
}

function PersonLink({ p, mode }: { p: PersonItem; mode: NameMode }) {
  const iso2 = personFlagIso2(p.id);
  return (
    <span className="ns-person-wrap">
      <Link className="ns-person" href={`/wca/persons/${p.id}`} prefetch={false}>
        {iso2 && <Flag iso2={iso2} spanClassName="country-flag" imgClassName="country-flag-ct" />}
        {nameByMode(p.n, mode)}
      </Link>
      {/* 含曾用名:现名后跟弱化的曾用名标签,拆开避免一串连读 */}
      {mode === 'aka' && <FormerNames former={p.former} />}
    </span>
  );
}

function NamesBlock({ people, mode }: { people: People; mode: NameMode }) {
  const { total, items } = people;
  const more = total - items.length;
  const inner = (
    <div className="ns-names">
      {items.map((p, i) => (
        <React.Fragment key={i}>
          <PersonLink p={p} mode={mode} />
          {(i < items.length - 1 || more > 0) && <span className="ns-sep">, </span>}
        </React.Fragment>
      ))}
      {more > 0 && <span className="ns-more">+{more}</span>}
    </div>
  );
  if (total <= 12) return inner;
  const label = tr({ zh: `${total} 位选手`, en: `${total} competitors` });
  return (
    <details className="ns-names-details">
      <summary>{label}</summary>
      {inner}
    </details>
  );
}

// 选中柱子后展示该组详情:左侧大号键 + 人数,右侧国家占比堆叠比例条(复用 StackedBar),下方选手名。
function BinDetail({ row, unit, isZh, mode }: { row: Row; unit: string; isZh: boolean; mode: NameMode }) {
  const [key, count, countries, people] = row;
  const sumN = countries.reduce((s, co) => s + co.n, 0);
  const others = Math.max(0, count - sumN);
  const n = countries.length;
  // 段宽 ∝ 人数;暖→冷渐变(最大占比 = 品牌橙,趋小转绿),与 /scramble/gen 同款观感
  const segs: StackedSeg[] = countries.map((co, i) => {
    const iso2 = countryToIso2(co.c);
    const f = n > 1 ? i / (n - 1) : 0;
    const frac = count > 0 ? co.n / count : 0;
    return {
      key: co.c || i,
      weight: co.n,
      color: `color-mix(in srgb, var(--accent) ${Math.round((1 - f) * 100)}%, var(--signal-success))`,
      title: `${co.c} · ${fmtPct(co.p)} (${co.n.toLocaleString()})`,
      label: (
        <>
          {iso2
            ? <Flag iso2={iso2} spanClassName="country-flag" imgClassName="country-flag-ct" />
            : <span className="ns-seg-name">{co.c}</span>}
          {frac >= 0.1 && <span className="ns-seg-pct">{fmtPct(co.p)}</span>}
        </>
      ),
    };
  });
  if (others > 0) {
    const op = (others / count) * 100;
    segs.push({
      key: '__other__',
      weight: others,
      color: 'color-mix(in srgb, var(--muted-foreground) 38%, transparent)',
      title: `${tr({ zh: '其他', en: 'Others' })} · ${fmtPct(op)}`,
      label: <span className="ns-seg-name">{tr({ zh: '其他', en: 'Others' })}</span>,
    });
  }
  return (
    <div className="ns-detail">
      <div className="ns-bar-row">
        <div className="ns-bar-head">
          <span className="ns-key">{String(key)}{unit && <span className="ns-unit">{unit}</span>}</span>
          <span className="ns-count">{count.toLocaleString()}{isZh && <span className="ns-count-unit">人</span>}</span>
        </div>
        <StackedBar
          segments={segs}
          total={count}
          minLabelFrac={0.04}
          className="ns-bar"
          ariaLabel={tr({ zh: '各国选手占比', en: 'Country breakdown' })}
        />
      </div>
      <NamesBlock people={people} mode={mode} />
    </div>
  );
}

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="ns-stat-cell">
      <div className="ns-stat-label">{label}</div>
      <div className="ns-stat-value">{value}</div>
    </div>
  );
}

interface Hist {
  counts: Record<string, number>;
  detail: Map<number, Row>;
  clickable: number[];
  span: number;
}

// 每个 key 一根柱,完全展开(不折叠尾部);DiscreteHistogram 会补齐 min..max 间的空档为 0。
function buildHist(rows: Row[]): Hist | null {
  if (rows.length === 0) return null;
  const sorted = [...rows].sort((a, b) => a[0] - b[0]);
  const counts: Record<string, number> = {};
  const detail = new Map<number, Row>();
  for (const r of sorted) {
    counts[String(r[0])] = r[1];
    detail.set(r[0], r);
  }
  const clickable = sorted.map(r => r[0]);
  const lo = clickable[0];
  const hi = clickable[clickable.length - 1];
  return { counts, detail, clickable, span: hi - lo + 1 };
}

function modeBin(counts: Record<string, number>): number | null {
  let best: number | null = null;
  let bestN = -1;
  for (const k of Object.keys(counts)) {
    const n = counts[k];
    if (n > bestN) { bestN = n; best = Number(k); }
  }
  return best;
}

function fullStats(rows: Row[]) {
  const sorted = [...rows].sort((a, b) => a[0] - b[0]);
  const total = sorted.reduce((s, r) => s + r[1], 0);
  if (total === 0) return null;
  let sum = 0;
  for (const [k, c] of sorted) sum += k * c;
  const pct = (p: number) => {
    const target = total * p;
    let cum = 0;
    for (const [k, c] of sorted) { cum += c; if (cum >= target) return k; }
    return sorted[sorted.length - 1][0];
  };
  return { mean: sum / total, median: pct(0.5), p10: pct(0.1), p90: pct(0.9), p99: pct(0.99) };
}

export default function NameStatsView({ data, isZh, queryKey = 'type', nameMode: nameModeProp, onNameModeChange }: { data: NameStatsData; isZh: boolean; queryKey?: string; nameMode?: NameMode; onNameModeChange?: (m: NameMode) => void }) {
  const panels = useMemo(() => data.panels ?? [], [data]);
  // 指标 tab(词数 / 字符长度);名字口径四态(英文名 / 全名 / 本地名 / 含曾用名)
  const [tab, setTab] = useQueryState(
    queryKey,
    parseAsStringEnum(['parts', 'length']).withDefault('parts').withOptions({ history: 'push' }),
  );
  // 名字口径:外部受控(与名录共用同一 URL 状态)优先,否则内部 nuqs 自管
  const [internalNameMode, setInternalNameMode] = useQueryState(
    `${queryKey}_name`,
    parseAsStringEnum<NameMode>([...NAME_MODES]).withDefault('latin').withOptions({ history: 'push' }),
  );
  const nameMode: NameMode = nameModeProp ?? internalNameMode;
  const setNameMode = (m: NameMode) => { if (onNameModeChange) onNameModeChange(m); else setInternalNameMode(m); };
  const [yMode, setYMode] = useState<'percent' | 'count'>('percent');
  const [selectedBin, setSelectedBin] = useState<number | null>(null);

  // 国旗数据加载(模块级缓存,加载完触发重渲染)
  const [, setFlagVer] = useState(() => flagDataVersion());
  useEffect(() => { loadFlagData().then(v => setFlagVer(v)); }, []);

  // 基础指标 = 无名字口径后缀的面板(词数 / 字符长度);_full / _local / _aka 变体由口径切换取用
  const baseMetrics = useMemo(() => panels.filter(p => !/_(full|local|aka)$/.test(p.id)), [panels]);
  const hasModes = useMemo(() => panels.some(p => /_(full|local|aka)$/.test(p.id)), [panels]);
  const suffix = nameMode === 'full' ? '_full' : nameMode === 'local' ? '_local' : nameMode === 'aka' ? '_aka' : '';
  const active = panels.find(p => p.id === `${tab}${suffix}`) ?? panels.find(p => p.id === tab) ?? panels[0];
  const rows = useMemo(() => (active?.sections[0]?.rows ?? []) as Row[], [active]);

  const hist = useMemo(() => buildHist(rows), [rows]);
  const st = useMemo(() => fullStats(rows), [rows]);

  // 切 tab / 口径时清空选中,等下个 effect 按新数据选众数桶
  useEffect(() => { setSelectedBin(null); }, [tab, nameMode]);
  useEffect(() => {
    if (!hist) return;
    setSelectedBin(prev => {
      if (prev != null && hist.clickable.includes(prev)) return prev;
      const m = modeBin(hist.counts);
      return m != null ? m : (hist.clickable[0] ?? null);
    });
  }, [hist]);

  if (!active) return null;
  const unit = tab === 'length' ? tr({ zh: '字', en: '' }) : tr({ zh: '词', en: '' });
  const modeOptions = nameModeOptions();
  // 指标二选一(词数 / 字符长度)→ PillToggle;标签取面板自身的本地化名
  const partsP = baseMetrics.find(p => p.id === 'parts');
  const lengthP = baseMetrics.find(p => p.id === 'length');

  const detailRow = selectedBin != null ? hist?.detail.get(selectedBin) : undefined;
  // bin 不多(词数,≤12 格)时柱顶显示 计数+百分比;字符长度格多则关闭避免重叠
  const showBarLabels = !!hist && hist.span <= 12;

  return (
    <div className="ns-view">
      <div className="ns-tabs">
        <PillToggle
          value={tab === 'length'}
          onChange={v => setTab(v ? 'length' : 'parts')}
          offLabel={tr({ zh: partsP?.labelZh ?? '词数', en: partsP?.labelEn ?? 'Word count' })}
          onLabel={tr({ zh: lengthP?.labelZh ?? '字符长度', en: lengthP?.labelEn ?? 'Length' })}
          ariaLabel={tr({ zh: '指标:词数或字符长度', en: 'Metric: word count or character length' })}
        />
        {hasModes && (
          <select
            className="ns-name-select"
            value={nameMode}
            onChange={e => setNameMode(e.target.value as NameMode)}
            aria-label={tr({ zh: '姓名口径', en: 'Name form' })}
            title={modeOptions.find(m => m.id === nameMode)?.title}
          >
            {modeOptions.map(m => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>
        )}
      </div>

      {hist ? (
        <div className="ns-dist">
          <p className="ns-hint">
            {tr({ zh: '点击柱子查看该组选手;点击纵轴切换 百分比 / 数量', en: 'Click a bar to see that group’s competitors; click the y-axis to toggle percent / count' })}
          </p>
          <div className="ns-dist-card">
            <DiscreteHistogram
              series={[{ name: '', fillColors: ['var(--accent)'], counts: hist.counts }]}
              isZh={isZh}
              yMode={yMode}
              hideLegendColors
              showBarLabels={showBarLabels}
              gapAware
              clickableBins={hist.clickable}
              selectedBin={selectedBin}
              onBarClick={setSelectedBin}
              onYAxisClick={() => setYMode(m => (m === 'percent' ? 'count' : 'percent'))}
              yAxisTitle={tr({ zh: '点击切换 百分比 / 数量', en: 'Click to toggle percent / count' })}
            />
          </div>

          {st && (
            <div className="ns-dist-card">
              <div className="ns-panel-title">{tr({ zh: '摘要统计', en: 'Summary stats' })}</div>
              <div className="ns-stat-grid">
                <StatCell label={tr({ zh: '均值', en: 'mean' })} value={st.mean.toFixed(2)} />
                <StatCell label={tr({ zh: '中位数', en: 'median' })} value={String(st.median)} />
                <StatCell label="p10" value={String(st.p10)} />
                <StatCell label="p90" value={String(st.p90)} />
                <StatCell label="p99" value={String(st.p99)} />
              </div>
            </div>
          )}

          {detailRow && (
            <div className="ns-dist-card">
              <BinDetail row={detailRow} unit={unit} isZh={isZh} mode={nameMode} />
            </div>
          )}
        </div>
      ) : (
        <div className="ns-empty">{tr({ zh: '暂无数据', en: 'No data' })}</div>
      )}
    </div>
  );
}

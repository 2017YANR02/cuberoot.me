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

// 选中柱子后展示该组详情:大号键 + 人数 + 国旗占比 chips + 选手名。
function BinDetail({ row, cap, unit, isZh, mode }: { row: Row; cap: number | null; unit: string; isZh: boolean; mode: NameMode }) {
  const [key, count, countries, people] = row;
  const keyLabel = cap != null && key === cap ? `${cap}+` : String(key);
  return (
    <div className="ns-detail">
      <div className="ns-detail-head">
        <span className="ns-key">{keyLabel}{unit && <span className="ns-unit">{unit}</span>}</span>
        <span className="ns-count">{count.toLocaleString()}{isZh && <span className="ns-count-unit">人</span>}</span>
      </div>
      {countries.length > 0 && (
        <div className="ns-countries">
          {countries.map((co, i) => {
            const iso2 = countryToIso2(co.c);
            return (
              <span className="ns-country" key={i} title={co.c}>
                {iso2
                  ? <Flag iso2={iso2} spanClassName="country-flag" imgClassName="country-flag-ct" />
                  : <span className="ns-country-name">{co.c}</span>}
                <span className="ns-country-pct">{fmtPct(co.p)}</span>
              </span>
            );
          })}
        </div>
      )}
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

// 把尾部小计数行合并成单个 "N+" 桶:计数求和、国旗按可见 top-N 累加、选手名拼接取样。
function mergeRows(capKey: number, tail: Row[]): Row {
  let count = 0;
  const cmap = new Map<string, number>();
  let ptotal = 0;
  const items: PersonItem[] = [];
  for (const [, c, countries, people] of tail) {
    count += c;
    for (const co of countries) cmap.set(co.c, (cmap.get(co.c) ?? 0) + co.n);
    ptotal += people.total;
    items.push(...people.items);
  }
  const countries: Country[] = [...cmap.entries()]
    .map(([c, n]) => ({ c, n, p: count > 0 ? (n / count) * 100 : 0 }))
    .sort((a, b) => b.n - a.n)
    .slice(0, 8);
  return [capKey, count, countries, { total: ptotal, items: items.slice(0, 40) }];
}

interface Hist {
  counts: Record<string, number>;
  detail: Map<number, Row>;
  cap: number | null;
  clickable: number[];
  span: number;
}

function buildHist(rows: Row[]): Hist | null {
  if (rows.length === 0) return null;
  const sorted = [...rows].sort((a, b) => a[0] - b[0]);
  const minK = sorted[0][0];
  const maxK = sorted[sorted.length - 1][0];
  const total = sorted.reduce((s, r) => s + r[1], 0);
  // 跨度 > 22 个整数 bin(字符长度长尾)→ 折叠 98% 分位之后的尾部到单个 "N+" 桶,
  // 否则几十个近乎为 0 的窄柱不可读。词数(1..10)永远不触发。
  let cap: number | null = null;
  if (maxK - minK > 22) {
    let cum = 0;
    for (const [k, c] of sorted) { cum += c; if (cum / total >= 0.98) { cap = k; break; } }
    if (cap == null || cap >= maxK) cap = null;
  }
  const counts: Record<string, number> = {};
  const detail = new Map<number, Row>();
  const tail: Row[] = [];
  for (const r of sorted) {
    if (cap != null && r[0] >= cap) { tail.push(r); continue; }
    counts[String(r[0])] = r[1];
    detail.set(r[0], r);
  }
  if (cap != null && tail.length > 0) {
    const merged = mergeRows(cap, tail);
    counts[String(cap)] = merged[1];
    detail.set(cap, merged);
  }
  const clickable = Object.keys(counts).map(Number).filter(k => (counts[String(k)] ?? 0) > 0).sort((a, b) => a - b);
  const lo = clickable.length ? clickable[0] : 0;
  const hi = clickable.length ? clickable[clickable.length - 1] : 0;
  return { counts, detail, cap, clickable, span: hi - lo + 1 };
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

export default function NameStatsView({ data, isZh, queryKey = 'type' }: { data: NameStatsData; isZh: boolean; queryKey?: string }) {
  const panels = useMemo(() => data.panels ?? [], [data]);
  // 指标 tab(词数 / 字符长度);名字口径四态(英文名 / 全名 / 本地名 / 含曾用名)
  const [tab, setTab] = useQueryState(
    queryKey,
    parseAsStringEnum(['parts', 'length']).withDefault('parts').withOptions({ history: 'push' }),
  );
  const [nameMode, setNameMode] = useQueryState(
    `${queryKey}_name`,
    parseAsStringEnum<NameMode>([...NAME_MODES]).withDefault('latin').withOptions({ history: 'push' }),
  );
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

  const detailRow = selectedBin != null ? hist?.detail.get(selectedBin) : undefined;
  // 折叠时把 cap 那一格标成 "N+";词数不折叠 → 无 formatBin
  const formatBin = hist?.cap != null
    ? (v: number) => (v === hist.cap ? `${hist.cap}+` : String(v))
    : undefined;
  // bin 不多(词数,≤12 格)时柱顶显示 计数+百分比;字符长度格多则关闭避免重叠
  const showBarLabels = !!hist && hist.span <= 12;

  return (
    <div className="ns-view">
      <div className="ns-tabs">
        {baseMetrics.map(p => (
          <button
            key={p.id}
            className={`ns-tab${p.id === tab ? ' active' : ''}`}
            onClick={() => setTab(p.id as 'parts' | 'length')}
          >
            {isZh ? p.labelZh : p.labelEn}
          </button>
        ))}
        {hasModes && (
          <div className="ns-name-modes" role="group">
            {modeOptions.map(m => (
              <button
                key={m.id}
                type="button"
                className={`ns-tab${nameMode === m.id ? ' active' : ''}`}
                onClick={() => setNameMode(m.id)}
                title={m.title}
              >
                {m.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {hist ? (
        <div className="ns-dist">
          <p className="ns-hint">
            {tr({ zh: '点击柱子查看该组的国家分布与选手', en: 'Click a bar to see that group’s countries and competitors' })}
          </p>
          <div className="ns-dist-card">
            <DiscreteHistogram
              series={[{ name: '', fillColors: ['var(--accent)'], counts: hist.counts }]}
              isZh={isZh}
              yMode={yMode}
              hideLegendColors
              formatBin={formatBin}
              showBarLabels={showBarLabels}
              clickableBins={hist.clickable}
              selectedBin={selectedBin}
              onBarClick={setSelectedBin}
              onYModeToggle={() => setYMode(m => (m === 'percent' ? 'count' : 'percent'))}
              modeControl="switch"
              yModeLabels={{ off: tr({ zh: '百分比', en: '%' }), on: tr({ zh: '数量', en: 'count' }) }}
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
              <BinDetail row={detailRow} cap={hist.cap} unit={unit} isZh={isZh} mode={nameMode} />
            </div>
          )}
        </div>
      ) : (
        <div className="ns-empty">{tr({ zh: '暂无数据', en: 'No data' })}</div>
      )}
    </div>
  );
}

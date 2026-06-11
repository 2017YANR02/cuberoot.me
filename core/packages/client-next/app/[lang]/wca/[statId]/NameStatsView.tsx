'use client';

// name_stats 专属可视化:词数 / 字符长度 双 tab,每组一行 = 大号键 + 占比条 + 国旗占比 chips
// + 带国旗的选手名(站内链接,人多折叠)。替代通用表格渲染。
import React, { useMemo, useState, useEffect } from 'react';
import Link from '@/components/AppLink';
import { parseAsStringEnum, useQueryState } from 'nuqs';
import { Flag } from '@/components/Flag';
import { countryToIso2, personFlagIso2, loadFlagData, flagDataVersion } from '@/lib/country-flags';
import { translatePersonLink, stripChineseParens } from '@/lib/wca-translations';
import i18n from '@/i18n/i18n-client';
import { tr } from '@/i18n/tr';
import './name-stats.css';

interface Country { c: string; n: number; p: number; }
interface PersonItem { n: string; id: string; }
interface People { total: number; items: PersonItem[]; }
type Row = [number, number, Country[], People];
interface Panel { id: string; labelEn: string; labelZh: string; sections: { rows: Row[] }[]; }
export interface NameStatsData { panels?: Panel[]; }

function fmtPct(p: number): string {
  return p >= 9.95 ? `${Math.round(p)}%` : `${p.toFixed(1)}%`;
}

function personName(n: string, isZh: boolean): string {
  if (isZh) { const zh = translatePersonLink(n); return zh || stripChineseParens(n); }
  return stripChineseParens(n);
}

function PersonLink({ p, isZh }: { p: PersonItem; isZh: boolean }) {
  const iso2 = personFlagIso2(p.id);
  return (
    <Link className="ns-person" href={`/wca/persons/${p.id}`} prefetch={false}>
      {iso2 && <Flag iso2={iso2} spanClassName="country-flag" imgClassName="country-flag-ct" />}
      {personName(p.n, isZh)}
    </Link>
  );
}

function NamesBlock({ people, isZh }: { people: People; isZh: boolean }) {
  const { total, items } = people;
  const more = total - items.length;
  const inner = (
    <div className="ns-names">
      {items.map((p, i) => (
        <React.Fragment key={i}>
          <PersonLink p={p} isZh={isZh} />
          {(i < items.length - 1 || more > 0) && <span className="ns-sep">, </span>}
        </React.Fragment>
      ))}
      {more > 0 && <span className="ns-more">+{more}</span>}
    </div>
  );
  if (total <= 12) return inner;
  const label = i18n.language === 'zh-Hant' ? `${total} 位選手` : isZh ? `${total} 位选手` : `${total} competitors`;
  return (
    <details className="ns-names-details">
      <summary>{label}</summary>
      {inner}
    </details>
  );
}

function GroupRow({ row, max, unit, isZh }: { row: Row; max: number; unit: string; isZh: boolean }) {
  const [key, count, countries, people] = row;
  const width = max > 0 ? (Math.sqrt(count) / Math.sqrt(max)) * 100 : 0;
  return (
    <div className="ns-row">
      <div className="ns-main">
        <div className="ns-key">{key}{unit && <span className="ns-unit">{unit}</span>}</div>
        <div className="ns-bar"><div className="ns-bar-fill" style={{ width: `${width}%` }} /></div>
        <div className="ns-count">
          {count.toLocaleString()}{isZh && <span className="ns-count-unit">人</span>}
        </div>
      </div>
      <div className="ns-sub">
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
        <NamesBlock people={people} isZh={isZh} />
      </div>
    </div>
  );
}

export default function NameStatsView({ data, isZh }: { data: NameStatsData; isZh: boolean }) {
  const panels = useMemo(() => data.panels ?? [], [data]);
  const [tab, setTab] = useQueryState(
    'type',
    parseAsStringEnum(['parts', 'length']).withDefault('parts').withOptions({ history: 'push' }),
  );

  // 国旗数据加载(模块级缓存,加载完触发重渲染)
  const [, setFlagVer] = useState(() => flagDataVersion());
  useEffect(() => { loadFlagData().then(v => setFlagVer(v)); }, []);

  const active = panels.find(p => p.id === tab) ?? panels[0];
  const rows = useMemo(() => (active?.sections[0]?.rows ?? []) as Row[], [active]);
  const max = useMemo(() => rows.reduce((m, r) => Math.max(m, r[1]), 0), [rows]);

  if (!active) return null;
  const unit = active.id === 'length' ? tr({ zh: '字', en: '' }) : tr({ zh: '词', en: '',
      zhHant: "詞"
});

  return (
    <div className="ns-view">
      <div className="ns-tabs">
        {panels.map(p => (
          <button
            key={p.id}
            className={`ns-tab${p.id === active.id ? ' active' : ''}`}
            onClick={() => setTab(p.id as 'parts' | 'length')}
          >
            {isZh ? p.labelZh : p.labelEn}
          </button>
        ))}
      </div>
      <div className="ns-list">
        {rows.map((r, i) => <GroupRow key={i} row={r} max={max} unit={unit} isZh={isZh} />)}
      </div>
    </div>
  );
}

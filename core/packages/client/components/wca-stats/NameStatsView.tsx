'use client';

// name_stats 专属可视化:词数 / 字符长度 双 tab,每组一行 = 大号键 + 占比条 + 国旗占比 chips
// + 带国旗的选手名(站内链接,人多折叠)。替代通用表格渲染。
import React, { useMemo, useState, useEffect } from 'react';
import Link from '@/components/AppLink';
import { parseAsStringEnum, useQueryState } from 'nuqs';
import { Flag } from '@/components/Flag';
import { countryToIso2, personFlagIso2, loadFlagData, flagDataVersion } from '@/lib/country-flags';
import { tr } from '@/i18n/tr';
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

function GroupRow({ row, max, unit, isZh, mode }: { row: Row; max: number; unit: string; isZh: boolean; mode: NameMode }) {
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
        <NamesBlock people={people} mode={mode} />
      </div>
    </div>
  );
}

export default function NameStatsView({ data, isZh, queryKey = 'type' }: { data: NameStatsData; isZh: boolean; queryKey?: string }) {
  const panels = useMemo(() => data.panels ?? [], [data]);
  // 指标 tab(词数 / 字符长度);名字口径三态(英文名 / 全名 / 本地名,对应 ''/_full/_local 后缀面板)
  const [tab, setTab] = useQueryState(
    queryKey,
    parseAsStringEnum(['parts', 'length']).withDefault('parts').withOptions({ history: 'push' }),
  );
  const [nameMode, setNameMode] = useQueryState(
    `${queryKey}_name`,
    parseAsStringEnum<NameMode>([...NAME_MODES]).withDefault('latin').withOptions({ history: 'push' }),
  );

  // 国旗数据加载(模块级缓存,加载完触发重渲染)
  const [, setFlagVer] = useState(() => flagDataVersion());
  useEffect(() => { loadFlagData().then(v => setFlagVer(v)); }, []);

  // 基础指标 = 无名字口径后缀的面板(词数 / 字符长度);_full / _local / _aka 变体由口径切换取用
  const baseMetrics = useMemo(() => panels.filter(p => !/_(full|local|aka)$/.test(p.id)), [panels]);
  const hasModes = useMemo(() => panels.some(p => /_(full|local|aka)$/.test(p.id)), [panels]);
  const suffix = nameMode === 'full' ? '_full' : nameMode === 'local' ? '_local' : nameMode === 'aka' ? '_aka' : '';
  const active = panels.find(p => p.id === `${tab}${suffix}`) ?? panels.find(p => p.id === tab) ?? panels[0];
  const rows = useMemo(() => (active?.sections[0]?.rows ?? []) as Row[], [active]);
  const max = useMemo(() => rows.reduce((m, r) => Math.max(m, r[1]), 0), [rows]);

  if (!active) return null;
  const unit = tab === 'length' ? tr({ zh: '字', en: '' }) : tr({ zh: '词', en: '' });

  const modeOptions = nameModeOptions();

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
      <div className="ns-list">
        {rows.map((r, i) => <GroupRow key={i} row={r} max={max} unit={unit} isZh={isZh} mode={nameMode} />)}
      </div>
    </div>
  );
}

'use client';

// 盲拧速查表 —— BLDDB 导航栏 Nightmare 菜单那十一项的本站版。
//
// 两种形态,数据形状不同,所以是两个渲染器:
//   ① 全缓冲角 / 全缓冲棱:每个 case 一条**推荐解**(*NightmareSelected.json),按缓冲分组,
//      角 1008 条 / 棱 1760 条。查一条走 /alg/3bld/lookup(那边给全部写法),这里是背表用的。
//   ② 另外九张:上游手写的静态速查表(data/nightmare/*.json),行数组直接铺成表格 ——
//      2e2e / 2c2c / 全两棱翻 / 全四棱翻 / 全两角翻 / 全三角翻 / 奇偶 / 奇偶带翻 / 五循环。
//      这九张的表头文案是上游数据里写死的中文,不是漏翻。
//
// 与穷举全集(37MB,只在 iframe 版 /blddb)的区别:那个是「任意 case 都能查到一条」,
// 这里是「每个 case 挑一条背」,加起来 235KB。

import { useEffect, useMemo, useState, type JSX } from 'react';
import { useQueryState, parseAsStringEnum } from 'nuqs';
import { Check } from 'lucide-react';
import Link from '@/components/AppLink';
import { Spinner } from '@/components/Spinner/Spinner';
import { EventIcon } from '@/components/EventIcon/EventIcon';
import { useCopy } from '@/hooks/useCopy';
import { tr } from '@/i18n/tr';
import {
  SELECTED_TYPES,
  TABLE_NAMES,
  codeFromChichu,
  loadNightmareSelected,
  loadNightmareTable,
  positionsOf,
  type NightmareSelected,
  type SelectedType,
  type TableName,
} from '../_lib/blddb';
import { useBldConfigHydrated, useBldConfigStore } from '../_store/bld-config-store';
import type { SchemeId } from '../_lib/scheme-presets';
import '../3bld.css';

/** 页面上的十一项 —— 前两项是推荐解网格,其余是静态表。 */
type Sheet = SelectedType | TableName;
const SHEETS: Sheet[] = [...SELECTED_TYPES, ...TABLE_NAMES];

const SHEET_LABEL: Record<Sheet, { zh: string; en: string }> = {
  corner: { zh: '全缓冲角', en: 'Corner (all buffers)' },
  edge: { zh: '全缓冲棱', en: 'Edge (all buffers)' },
  '2e2e': { zh: '双棱双棱', en: '2e2e' },
  '2c2c': { zh: '双角双角', en: '2c2c' },
  '2flips': { zh: '两棱翻', en: 'Two edge flips' },
  '4flips': { zh: '四棱翻', en: 'Four edge flips' },
  '2twists': { zh: '两角翻', en: 'Two corner twists' },
  '3twists': { zh: '三角翻', en: 'Three corner twists' },
  parity: { zh: '奇偶', en: 'Parity' },
  ltct: { zh: '奇偶带翻', en: 'LTCT' },
  '5style': { zh: '五循环(UR)', en: '5-style (UR)' },
};

const isSelected = (s: Sheet): s is SelectedType => (SELECTED_TYPES as readonly string[]).includes(s);

/** 一条公式:点一下复制。表里成百上千条,不给每条都塞个按钮。 */
function AlgCell({ alg }: { alg: string }): JSX.Element {
  const { copied, copy } = useCopy();
  return (
    <button type="button" className="bld-tb-alg" onClick={() => copy(alg)} title={tr({ zh: '复制', en: 'Copy' })}>
      {alg}
      {copied && <Check size={12} />}
    </button>
  );
}

/** 推荐解网格:一个缓冲一段,段内按编码排。 */
function SelectedGrid({ type, scheme }: { type: SelectedType; scheme: SchemeId }): JSX.Element {
  const [data, setData] = useState<NightmareSelected | null>(null);
  const [failed, setFailed] = useState(false);
  const [buffer, setBuffer] = useQueryState('buffer', { defaultValue: '' });

  useEffect(() => {
    let alive = true;
    setData(null);
    setFailed(false);
    loadNightmareSelected(type)
      .then((d) => { if (alive) setData(d); })
      .catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, [type]);

  const groups = useMemo(() => {
    if (!data) return [];
    const byBuffer = new Map<string, { code: string; alg: string }[]>();
    for (const key of Object.keys(data)) {
      const list = byBuffer.get(key[0]) ?? [];
      list.push({ code: key, alg: data[key] });
      byBuffer.set(key[0], list);
    }
    // 缓冲按「哪个用的人多」排 —— 就是它自己 case 数的多少,不用另外硬编码一张顺序表。
    return [...byBuffer.entries()]
      .sort((a, b) => b[1].length - a[1].length)
      .map(([letter, items]) => ({
        letter,
        // 缓冲那一位在两套编码里都是同一块,拿位置名当标题最不会认错。
        position: positionsOf(letter, type)[0],
        items: items.sort((x, y) => x.code.localeCompare(y.code)),
      }));
  }, [data, type]);

  if (failed) {
    return <p className="bld-db-empty">{tr({ zh: '速查表没拉下来,刷新再试。', en: 'Could not load the sheet — try reloading.' })}</p>;
  }
  if (!data) {
    return <div className="bld-db-empty"><Spinner size={18} label={tr({ zh: '加载中', en: 'Loading' })} /></div>;
  }

  const active = groups.find((g) => g.letter === buffer) ?? groups[0];

  return (
    <>
      <div className="bld-tb-buffers">
        <span className="bld-db-group-label">{tr({ zh: '缓冲', en: 'Buffer' })}</span>
        {groups.map((g) => (
          <button
            key={g.letter}
            type="button"
            className={`bld-seg-btn${g.letter === active?.letter ? ' is-on' : ''}`}
            onClick={() => void setBuffer(g.letter)}
          >
            {g.position}
          </button>
        ))}
      </div>
      {active && (
        <div className="bld-tb-pairs">
          {active.items.map(({ code, alg }) => (
            <div className="bld-tb-pair" key={code}>
              <span className="bld-tb-code">{codeFromChichu(code, type, scheme)}</span>
              <AlgCell alg={alg} />
            </div>
          ))}
        </div>
      )}
    </>
  );
}

/**
 * 静态速查表。行数组原样铺:第一行是表头,整行空白 = 分节,整列空白 = 列间隔。
 * 各表列数和含义都不一样(有的是矩阵,有的是编码/公式成对),所以只做通用渲染,不揣摩语义。
 */
function StaticTable({ name }: { name: TableName }): JSX.Element {
  const [rows, setRows] = useState<string[][] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    setRows(null);
    setFailed(false);
    loadNightmareTable(name)
      .then((d) => { if (alive) setRows(d); })
      .catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, [name]);

  const sections = useMemo(() => {
    if (!rows) return [];
    const out: string[][][] = [];
    let cur: string[][] = [];
    for (const row of rows) {
      if (row.every((c) => c === '')) {
        if (cur.length) out.push(cur);
        cur = [];
      } else cur.push(row);
    }
    if (cur.length) out.push(cur);
    return out;
  }, [rows]);

  // 整列空白是上游用来做列间隔的,渲染成窄的无边框列。
  const gapCols = useMemo(() => {
    if (!rows) return new Set<number>();
    const width = Math.max(...rows.map((r) => r.length));
    const gaps = new Set<number>();
    for (let c = 0; c < width; c++) {
      if (rows.every((r) => (r[c] ?? '') === '')) gaps.add(c);
    }
    return gaps;
  }, [rows]);

  if (failed) {
    return <p className="bld-db-empty">{tr({ zh: '速查表没拉下来,刷新再试。', en: 'Could not load the sheet — try reloading.' })}</p>;
  }
  if (!rows) {
    return <div className="bld-db-empty"><Spinner size={18} label={tr({ zh: '加载中', en: 'Loading' })} /></div>;
  }

  return (
    <>
      {sections.map((section, si) => (
        <div className="sticky-scroll bld-tb-scroll" key={si}>
          <table className="bld-tb-table">
            <thead className="sticky-thead">
              <tr>
                {section[0].map((cell, ci) => (
                  <th key={ci} className={gapCols.has(ci) ? 'is-gap' : undefined}>{cell}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {section.slice(1).map((row, ri) => (
                <tr key={ri}>
                  {row.map((cell, ci) => (
                    <td key={ci} className={gapCols.has(ci) ? 'is-gap' : undefined}>
                      {/* 带空格的多半是公式,给个复制;编码之类原样显示。 */}
                      {cell.includes(' ') ? <AlgCell alg={cell} /> : cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </>
  );
}

export default function BlddbTablesPage(): JSX.Element {
  const hydrated = useBldConfigHydrated();
  const scheme = useBldConfigStore((s) => s.config.scheme);
  const [sheet, setSheet] = useQueryState(
    'sheet',
    parseAsStringEnum<Sheet>(SHEETS).withDefault('corner'),
  );

  return (
    <div className="bld-trainer-root">
      <div className="bld-topbar">
        <h1>
          <EventIcon event="333bf" /> {tr({ zh: '盲拧速查表', en: 'BLD Cheat Sheets' })}
        </h1>
        <Link href="/alg/3bld/lookup" className="bld-hub-secondary" prefetch={false}>
          {tr({ zh: '公式查询', en: 'Lookup' })}
        </Link>
        <span className="bld-spacer" />
        <Link href="/blddb" className="bld-hub-secondary" prefetch={false}>
          {tr({ zh: 'BLDDB 完整库', en: 'Full BLDDB' })}
        </Link>
      </div>

      <p className="bld-input-summary">
        {tr({
          zh: '整表背用的:每个 case 一条推荐解。前两张是全缓冲的角和棱,其余是双棱双棱、多角翻、多棱翻这些成组的表。要一个 case 的全部写法和换位子,去公式查询。',
          en: 'For learning a whole set: one recommended algorithm per case. The first two cover corners and edges from every buffer; the rest are the grouped sheets (2e2e, multi-twist, multi-flip and so on). For every writing of a single case plus its commutator, use the lookup.',
        })}
      </p>

      <div className="bld-comm-toolbar">
        <label className="bld-db-type">
          <span>{tr({ zh: '表', en: 'Sheet' })}</span>
          <select
            className="bld-db-slot-select"
            value={sheet}
            onChange={(e) => void setSheet(e.target.value as Sheet)}
            aria-label={tr({ zh: '速查表', en: 'Cheat sheet' })}
          >
            {SHEETS.map((s) => (
              <option key={s} value={s}>{tr(SHEET_LABEL[s])}</option>
            ))}
          </select>
        </label>
      </div>

      {isSelected(sheet)
        ? hydrated && <SelectedGrid type={sheet} scheme={scheme} />
        : <StaticTable name={sheet} />}
    </div>
  );
}

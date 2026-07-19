'use client';

// Pure cell / markdown rendering + row helpers for the WCA stat renderer.
// Extracted verbatim from WcaStatView.tsx — no component state, no hooks.
import React from 'react';
import Link from '@/components/AppLink';
import {
  extractWcaId, extractCompId, personFlagIso2, compFlagIso2,
} from '@/lib/country-flags';
import { localizeCompName } from '@/lib/comp-localize';
import { Flag } from '@/components/Flag';
import { translateCellText, translatePersonLink, stripChineseParens } from '@/lib/wca-translations';
import { rewriteWcaCompUrl, prefetchComp } from '@/lib/comp-link';
import { EventIcon } from '@/components/EventIcon/EventIcon';
import { isWcaEvent, eventDisplayName } from '@/lib/wca-events';
import type { StatHeader, StatPanel, MetricPanel } from './WcaStatView.types';

export function getAllPanelsFromMetric(mp: MetricPanel): StatPanel[] {
  if (mp.panels) return mp.panels;
  if (mp.sourcePanels) return mp.sourcePanels.flatMap(sp => sp.panels);
  return [];
}

const LAZY_THRESHOLD = 12;

function renderSolves(items: string[]): React.ReactNode {
  if (items.length <= LAZY_THRESHOLD) {
    return (
      <div className="solve-list">
        <div className="solve-row">
          {items.map((s, i) => <span key={i}>{s}</span>)}
        </div>
      </div>
    );
  }
  const rows: string[][] = [];
  for (let i = 0; i < items.length; i += 10) {
    rows.push(items.slice(i, i + 10));
  }
  return (
    <div className="solve-list">
      {rows.map((row, ri) => (
        <div key={ri} className="solve-row">
          {row.map((s, si) => <span key={si}>{s}</span>)}
        </div>
      ))}
    </div>
  );
}

// 行内 *斜体* markdown（如 name_stats 的 "India *(28.81 %)*"）。
// 只处理单星号；**粗体** 由 renderCell 整串匹配，[链接]() 由 renderSegment 处理。
function renderInline(text: string, keyBase: string): React.ReactNode {
  if (!text.includes('*')) return text;
  const re = /\*([^*]+)\*/g;
  const parts: React.ReactNode[] = [];
  let last = 0, i = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    parts.push(<em key={`${keyBase}-em-${i++}`}>{m[1]}</em>);
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  if (parts.length === 0) return text;
  return parts.length === 1 ? parts[0] : <React.Fragment key={keyBase}>{parts}</React.Fragment>;
}

// 渲染一段含 [文本](链接) 的 markdown 为带国旗 / 本地化的链接节点。
// 从 renderCell 内提取到模块级,供普通单元格与 people 列表复用。
function renderLinkedSegment(segment: string, segIdx: number, columnKey: string | undefined, isZh: boolean | undefined, withFlag = true): React.ReactNode {
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = linkRegex.exec(segment)) !== null) {
    if (match.index > lastIndex) {
      parts.push(renderInline(segment.slice(lastIndex, match.index), `${segIdx}-${lastIndex}`));
    }
    const url = match[2];
    const wcaId = extractWcaId(url);
    const compId = extractCompId(url);
    const iso2 = wcaId ? personFlagIso2(wcaId) : compId ? compFlagIso2(compId) : '';
    if (iso2 && withFlag) {
      parts.push(<Flag key={`flag-${segIdx}-${match.index}`} iso2={iso2} spanClassName="country-flag" imgClassName="country-flag-ct" />);
      parts.push(' ');
    }
    let displayText = match[1];
    // '1st'/'2nd'/'3rd' 是领奖台式人名列(best_round / round_top3_sum),同 person 列一样剥括号 + 中译
    if (columnKey === 'person' || columnKey === 'name' || columnKey === '1st' || columnKey === '2nd' || columnKey === '3rd') {
      if (isZh) {
        const zhName = translatePersonLink(displayText);
        displayText = zhName || stripChineseParens(displayText);
      } else {
        displayText = stripChineseParens(displayText);
      }
    }
    if (compId) {
      displayText = localizeCompName(compId, displayText, !!isZh);
    }
    // 人名 → 站内选手页(/wca/persons/<wcaId>,AppLink 补 lang);比赛 → 站内 comp 页;
    // 大排名表人名众多,人名内链关 prefetch 防预取风暴。
    const internalHref = compId ? rewriteWcaCompUrl(url) : wcaId ? `/wca/persons/${wcaId}` : null;
    const prefetch = compId ? () => prefetchComp(compId) : undefined;
    parts.push(
      compId && internalHref
        ? <Link key={`${segIdx}-${match.index}`} href={internalHref} onMouseEnter={prefetch} onFocus={prefetch} onTouchStart={prefetch}>{displayText}</Link>
        : internalHref
          ? <Link key={`${segIdx}-${match.index}`} href={internalHref} prefetch={false}>{displayText}</Link>
          : <a key={`${segIdx}-${match.index}`} href={url} target="_blank" rel="noopener noreferrer">{displayText}</a>
    );
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < segment.length) {
    parts.push(renderInline(segment.slice(lastIndex), `${segIdx}-end`));
  }
  return parts.length === 1 ? parts[0] : <React.Fragment key={segIdx}>{parts}</React.Fragment>;
}

export function renderCell(value: unknown, columnKey?: string, isZh?: boolean): React.ReactNode {
  if (value && typeof value === 'object' && (value as Record<string, unknown>)._type === 'solves') {
    const cell = value as { _type: 'solves'; csv: string };
    const items = cell.csv.split(',');
    if (items.length <= LAZY_THRESHOLD) {
      return renderSolves(items);
    }
    return (
      <details className="solve-details">
        <summary>{items.length} solves</summary>
        {renderSolves(items)}
      </details>
    );
  }

  if (Array.isArray(value)) {
    const items = value.map(String);
    if (items.length <= LAZY_THRESHOLD) {
      return renderSolves(items);
    }
    return (
      <details className="solve-details">
        <summary>{items.length} solves</summary>
        {renderSolves(items)}
      </details>
    );
  }

  const str = String(value);

  if (columnKey === 'details' && typeof value === 'string' && value.trim()) {
    const items = value.trim().split(/\s+/);
    if (items.length > 1) return renderSolves(items);
  }

  if (columnKey === 'event' && !str.includes('[') && isWcaEvent(str.trim())) {
    return <EventIcon event={str.trim()} className="wca-stats-event-icon" title={eventDisplayName(str.trim(), !!isZh)} />;
  }

  if (columnKey && !str.includes('[')) {
    const translated = translateCellText(str.trim(), columnKey, isZh);
    if (translated) return <>{translated}</>;
  }

  const boldMatch = /^\*\*(.+)\*\*$/.exec(str);
  if (boldMatch) {
    return <strong>{boldMatch[1]}</strong>;
  }

  const brParts = str.split(/<br\s*\/?>/i);
  const hasBr = brParts.length > 1;

  if (!hasBr) return renderLinkedSegment(str, 0, columnKey, isZh);

  const result: React.ReactNode[] = [];
  brParts.forEach((part, i) => {
    if (i > 0) result.push(<br key={`br-${i}`} />);
    result.push(renderLinkedSegment(part, i, columnKey, isZh));
  });
  return <>{result}</>;
}

export function shouldHideCountryCol(colKey: string, header: StatHeader[]): boolean {
  if (colKey !== 'country' && colKey !== 'country_id') return false;
  return header.some(h => h.key === 'person' || h.key === 'name');
}

export function parseTimeValue(s: string): number {
  if (!s || s === 'DNF' || s === 'DNS') return NaN;
  const m = s.match(/^(\d+):(\d+\.\d+)$/);
  if (m) return parseInt(m[1], 10) * 60 + parseFloat(m[2]);
  const v = parseFloat(s);
  return isNaN(v) ? NaN : v;
}

export function extractSolvesCell(row: unknown[]): { _type: 'solves'; csv: string } | null {
  for (const cell of row) {
    if (cell && typeof cell === 'object' && (cell as Record<string, unknown>)._type === 'solves') {
      return cell as { _type: 'solves'; csv: string };
    }
  }
  return null;
}

export function extractTextFromMdLink(s: string): string {
  const m = String(s).match(/^\[([^\]]+)\]\([^)]+\)$/);
  return m ? m[1] : String(s);
}

export function dedupRows(rows: unknown[][], header: StatHeader[]): unknown[][] {
  let daysIdx = -1, startCompIdx = -1;
  header.forEach((h, i) => {
    if (h.key === 'days') daysIdx = i;
    if (h.key === 'start_comp') startCompIdx = i;
  });
  if (daysIdx === -1 && startCompIdx === -1) return rows;

  const result: unknown[][] = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (daysIdx >= 0 && String(row[daysIdx] ?? '').trim() === '0') continue;
    if (startCompIdx >= 0 && i > 0) {
      const prev = String(rows[i - 1]?.[startCompIdx] ?? '').trim();
      const cur = String(row[startCompIdx] ?? '').trim();
      if (cur && cur === prev) continue;
    }
    result.push(row);
  }
  return result;
}

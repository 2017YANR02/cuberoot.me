'use client';

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type ReactNode,
} from 'react';
import type { AlgSticker } from '@cuberoot/shared';
import { Check, Copy } from 'lucide-react';
import { parseAsString, parseAsStringEnum, useQueryState } from 'nuqs';
import AlgPlayer from '@/components/AlgPlayer';
import AppLink from '@/components/AppLink';
import { CaseThumb } from '@/components/CaseThumb';
import { CompactSelect } from '@/components/CompactSelect';
import PillToggle from '@/components/PillToggle/PillToggle';
import { SearchInput } from '@/components/SearchInput';
import '@/components/sticky-table.css';
import { tr } from '@/i18n/tr';
import { useCopy } from '@/hooks/useCopy';
import { persistItem } from '@/lib/safe-storage';
import {
  normalizeSq1PblAuxiliary,
  parseSq1PblAuxiliaryInput,
  validateSq1PblAuxiliary,
  type Sq1PblAuxiliary,
  type Sq1PblFinderDefaults,
  type Sq1PblPll,
  type Sq1PblSearchInput,
  type Sq1PblSearchMode,
  type Sq1PblSearchResult,
  type Sq1PblSolution,
} from '@/lib/sq1-pbl';
import {
  formatSq1PblNumericValue,
  loadSq1PblFinderDefaults,
  loadSq1PblManifest,
  loadSq1PblSheet,
  type Sq1PblCell,
  type Sq1PblHyperlink,
  type Sq1PblJsonObject,
  type Sq1PblJsonValue,
  type Sq1PblManifest,
  type Sq1PblNote,
  type Sq1PblPane,
  type Sq1PblPicture,
  type Sq1PblSheet,
  type Sq1PblSheetRef,
} from '@/lib/sq1-pbl-data';
import styles from './Sq1PblWorkspace.module.css';

type WorkspaceView = 'document' | 'finder';

interface CellPoint {
  row: number;
  column: number;
}

interface CellRange {
  start: CellPoint;
  end: CellPoint;
}

interface MergeAnchor {
  rowSpan: number;
  colSpan: number;
}

interface InternalCellTarget {
  sheet: Sq1PblSheetRef;
  ref: string;
}

type WorkerMessage =
  | { id: number; type: 'progress'; completed: number; total: number }
  | { id: number; type: 'result'; result: Sq1PblSearchResult }
  | { id: number; type: 'error'; error: string };

const PBL_STICKER: AlgSticker = { kind: 'raw', tag: 'sq1-pbl', attrs: {} };
const AUXILIARY_STORAGE_KEY = 'sq1:pbl:auxiliary:v1';
const MAX_AUXILIARY_IMPORT_BYTES = 2 * 1024 * 1024;
const WORKBOOK_ROW_HEADER_WIDTH = 46;
const WORKBOOK_COLUMN_HEADER_HEIGHT = 30;

function parseAuxiliaryPayload(value: unknown): Sq1PblAuxiliary[] | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const algorithms = (value as { auxiliaryAlgorithms?: unknown }).auxiliaryAlgorithms;
  if (!Array.isArray(algorithms)) return null;
  const parsed: Sq1PblAuxiliary[] = [];
  for (const item of algorithms) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
    const { name, sequence } = item as { name?: unknown; sequence?: unknown };
    if (typeof name !== 'string' || typeof sequence !== 'string') return null;
    const normalized = normalizeSq1PblAuxiliary(name, sequence);
    if (!normalized.ok) return null;
    parsed.push(normalized.value);
  }
  return validateSq1PblAuxiliary(parsed).length ? null : parsed;
}

function normalizeSearch(value: string): string {
  return value.normalize('NFKC').trim().toLocaleLowerCase();
}

function columnNumber(label: string): number {
  let value = 0;
  for (const character of label) value = value * 26 + character.charCodeAt(0) - 64;
  return value;
}

function columnLabel(value: number): string {
  let remaining = value;
  let label = '';
  while (remaining > 0) {
    remaining -= 1;
    label = String.fromCharCode(65 + (remaining % 26)) + label;
    remaining = Math.floor(remaining / 26);
  }
  return label || 'A';
}

function cellRef(row: number, column: number): string {
  return `${columnLabel(column)}${row}`;
}

function parseCellRef(value: string): CellPoint | null {
  const match = value.replaceAll('$', '').toUpperCase().match(/^([A-Z]+)(\d+)$/);
  if (!match) return null;
  return { row: Number(match[2]), column: columnNumber(match[1]) };
}

function parseRange(value: string): CellRange | null {
  const [rawStart, rawEnd = rawStart] = value.split(':');
  const start = parseCellRef(rawStart);
  const end = parseCellRef(rawEnd);
  if (!start || !end) return null;
  return {
    start: {
      row: Math.min(start.row, end.row),
      column: Math.min(start.column, end.column),
    },
    end: {
      row: Math.max(start.row, end.row),
      column: Math.max(start.column, end.column),
    },
  };
}

function refsInRange(value: string): string[] {
  const range = parseRange(value);
  if (!range) return [];
  const refs: string[] = [];
  for (let row = range.start.row; row <= range.end.row; row += 1) {
    for (let column = range.start.column; column <= range.end.column; column += 1) {
      refs.push(cellRef(row, column));
    }
  }
  return refs;
}

function sheetSize(dimension: string, cells: readonly Sq1PblCell[]): CellPoint {
  const range = parseRange(dimension);
  let row = range?.end.row ?? 1;
  let column = range?.end.column ?? 1;
  for (const cell of cells) {
    const point = parseCellRef(cell.ref);
    if (!point) continue;
    row = Math.max(row, point.row);
    column = Math.max(column, point.column);
  }
  return { row, column };
}

function mapRanges<T extends { ref: string }>(items: readonly T[]): Map<string, T[]> {
  const result = new Map<string, T[]>();
  for (const item of items) {
    for (const ref of refsInRange(item.ref)) {
      const current = result.get(ref) ?? [];
      current.push(item);
      result.set(ref, current);
    }
  }
  return result;
}

function buildMerges(merges: readonly string[]): { anchors: Map<string, MergeAnchor>; covered: Set<string> } {
  const anchors = new Map<string, MergeAnchor>();
  const covered = new Set<string>();
  for (const merge of merges) {
    const range = parseRange(merge);
    if (!range) continue;
    const anchor = cellRef(range.start.row, range.start.column);
    anchors.set(anchor, {
      rowSpan: range.end.row - range.start.row + 1,
      colSpan: range.end.column - range.start.column + 1,
    });
    for (let row = range.start.row; row <= range.end.row; row += 1) {
      for (let column = range.start.column; column <= range.end.column; column += 1) {
        const ref = cellRef(row, column);
        if (ref !== anchor) covered.add(ref);
      }
    }
  }
  return { anchors, covered };
}

function safeExternalHref(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return ['http:', 'https:', 'mailto:'].includes(url.protocol) ? value : null;
  } catch {
    return null;
  }
}

function asJsonObject(value: Sq1PblJsonValue | undefined): Sq1PblJsonObject | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
}

function nodeAttrs(node: Sq1PblJsonObject | null): Sq1PblJsonObject | null {
  return node ? asJsonObject(node.attrs) : null;
}

function nodeChildren(node: Sq1PblJsonObject | null): Sq1PblJsonObject[] {
  if (!node || !Array.isArray(node.children)) return [];
  return node.children.flatMap(child => {
    const parsed = asJsonObject(child);
    return parsed ? [parsed] : [];
  });
}

function nodeChild(node: Sq1PblJsonObject | null, tag: string): Sq1PblJsonObject | null {
  return nodeChildren(node).find(child => child.tag === tag) ?? null;
}

function nodeAttribute(node: Sq1PblJsonObject | null, name: string): string | undefined {
  const value = nodeAttrs(node)?.[name];
  return typeof value === 'string' ? value : undefined;
}

function stylePart(style: Sq1PblJsonObject | undefined, name: string): Sq1PblJsonObject | null {
  if (!style) return null;
  const direct = asJsonObject(style[name]);
  if (direct) return direct;
  return nodeChild(style, name) ?? asJsonObject(asJsonObject(style.base)?.[name]);
}

function styleNumberFormat(style: Sq1PblJsonObject | undefined): string | undefined {
  if (!style) return undefined;
  const direct = style.numFmt;
  if (typeof direct === 'string') return direct;
  const inherited = asJsonObject(style.base)?.numFmt;
  return typeof inherited === 'string' ? inherited : undefined;
}

function xmlEnabled(node: Sq1PblJsonObject | null): boolean {
  if (!node) return false;
  const value = nodeAttribute(node, 'val');
  return value !== '0' && value !== 'false';
}

function safeWorkbookColor(node: Sq1PblJsonObject | null): string | undefined {
  const rgb = nodeAttribute(node, 'rgb');
  if (!rgb || !/^[0-9A-F]{6}([0-9A-F]{2})?$/i.test(rgb)) return undefined;
  const hex = rgb.length === 8 ? rgb.slice(2) : rgb;
  const alpha = rgb.length === 8 ? Number.parseInt(rgb.slice(0, 2), 16) / 255 : 1;
  let channels = [0, 2, 4].map(offset => Number.parseInt(hex.slice(offset, offset + 2), 16));
  const tint = Number(nodeAttribute(node, 'tint'));
  if (Number.isFinite(tint) && tint >= -1 && tint <= 1 && tint !== 0) {
    channels = channels.map(channel => Math.round(tint > 0
      ? channel + (255 - channel) * tint
      : channel * (1 + tint)));
  }
  return `rgb(${channels.join(' ')} / ${Math.round(alpha * 1000) / 1000})`;
}

function workbookBorder(node: Sq1PblJsonObject | null): string | undefined {
  const style = nodeAttribute(node, 'style');
  if (!style || style === 'none') return undefined;
  const width = ['medium', 'mediumDashed', 'mediumDashDot', 'mediumDashDotDot'].includes(style)
    ? 2
    : style === 'thick' ? 3 : 1;
  const line = style === 'double'
    ? 'double'
    : style.includes('dash') || style.includes('Dash') ? 'dashed'
      : style.includes('dot') || style.includes('Dot') ? 'dotted' : 'solid';
  const color = safeWorkbookColor(nodeChild(node, 'color')) ?? 'currentColor';
  return `${width}px ${line} ${color}`;
}

function workbookCellStyle(style: Sq1PblJsonObject | undefined): CSSProperties {
  if (!style) return {};
  const font = stylePart(style, 'font');
  const fill = stylePart(style, 'fill');
  const border = stylePart(style, 'border');
  const alignment = stylePart(style, 'alignment');
  const horizontal = nodeAttribute(alignment, 'horizontal');
  const vertical = nodeAttribute(alignment, 'vertical');
  const wrapText = nodeAttribute(alignment, 'wrapText');
  const textAlign = horizontal && ['left', 'center', 'right', 'justify'].includes(horizontal)
    ? horizontal as CSSProperties['textAlign']
    : undefined;
  const verticalAlign = vertical === 'center' ? 'middle'
    : vertical && ['top', 'bottom'].includes(vertical) ? vertical as CSSProperties['verticalAlign'] : undefined;
  const decoration = xmlEnabled(nodeChild(font, 'u')) ? 'underline'
    : xmlEnabled(nodeChild(font, 'strike')) ? 'line-through' : undefined;
  const patternFill = nodeChild(fill, 'patternFill');
  const backgroundColor = nodeAttribute(patternFill, 'patternType') === 'solid'
    ? safeWorkbookColor(nodeChild(patternFill, 'fgColor'))
    : undefined;
  return {
    color: safeWorkbookColor(nodeChild(font, 'color')),
    backgroundColor,
    fontWeight: xmlEnabled(nodeChild(font, 'b')) ? 700 : undefined,
    fontStyle: xmlEnabled(nodeChild(font, 'i')) ? 'italic' : undefined,
    textDecoration: decoration,
    textAlign,
    verticalAlign,
    whiteSpace: wrapText === undefined ? undefined : xmlAttributeEnabled(wrapText) ? 'pre-wrap' : 'pre',
    overflowWrap: wrapText === undefined || xmlAttributeEnabled(wrapText) ? undefined : 'normal',
    borderTop: workbookBorder(nodeChild(border, 'top')),
    borderRight: workbookBorder(nodeChild(border, 'right')),
    borderBottom: workbookBorder(nodeChild(border, 'bottom')),
    borderLeft: workbookBorder(nodeChild(border, 'left')),
  };
}

function excelColumnWidth(column: Record<string, string> | undefined): number {
  const width = Number(column?.width);
  return Number.isFinite(width) ? Math.min(720, Math.max(24, Math.round(width * 7 + 5))) : 72;
}

function excelRowHeight(row: Record<string, string> | undefined): number | undefined {
  const height = Number(row?.ht);
  return Number.isFinite(height) ? Math.min(720, Math.max(18, Math.round(height * 96 / 72))) : undefined;
}

function xmlAttributeEnabled(value: string | undefined): boolean {
  return value === '1' || value === 'true';
}

function frozenSplits(pane: Sq1PblPane | null): { rows: number; columns: number } {
  if (!pane?.state?.includes('frozen')) return { rows: 0, columns: 0 };
  const rows = Number(pane.ySplit);
  const columns = Number(pane.xSplit);
  return {
    rows: Number.isFinite(rows) ? Math.max(0, Math.floor(rows)) : 0,
    columns: Number.isFinite(columns) ? Math.max(0, Math.floor(columns)) : 0,
  };
}

function resolveInternalLocation(
  location: string,
  currentSheet: Sq1PblSheetRef,
  manifest: Sq1PblManifest,
): InternalCellTarget | null {
  const cleaned = location.trim().replace(/^#/, '');
  const cellOnly = cleaned.match(/^(\$?[A-Z]+\$?\d+)(?::\$?[A-Z]+\$?\d+)?$/i);
  if (cellOnly) return { sheet: currentSheet, ref: cellOnly[1].replaceAll('$', '').toUpperCase() };
  const qualified = cleaned.match(/^(?:'((?:[^']|'')+)'|([^!]+))!(\$?[A-Z]+\$?\d+)(?::\$?[A-Z]+\$?\d+)?$/i);
  if (!qualified) return null;
  const rawName = (qualified[1]?.replaceAll("''", "'") ?? qualified[2]).trim();
  const targetSheet = manifest.sheets.find(item => item.name === rawName)
    ?? manifest.sheets.find(item => item.name.trim() === rawName);
  return targetSheet
    ? { sheet: targetSheet, ref: qualified[3].replaceAll('$', '').toUpperCase() }
    : null;
}

function internalCellHref(target: InternalCellTarget): string {
  const params = new URLSearchParams({ view: 'document', sheet: target.sheet.slug, cell: target.ref });
  return `/alg/sq1/pbl?${params.toString()}#sq1-pbl-cell-${target.sheet.slug}-${target.ref}`;
}

function sourceLocationHref(location: string, manifest: Sq1PblManifest): string | null {
  const source = safeExternalHref(manifest.source.documentUrl ?? manifest.source.url);
  if (!source) return null;
  try {
    const url = new URL(source);
    url.hash = location.replace(/^#/, '');
    return url.toString();
  } catch {
    return null;
  }
}

function externalHyperlinkHref(link: Sq1PblHyperlink): string | null {
  const href = safeExternalHref(link.target);
  if (!href) return null;
  if (!link.location) return href;
  try {
    const url = new URL(href);
    url.hash = link.location.replace(/^#/, '');
    return url.toString();
  } catch {
    return href;
  }
}

function richTextContent(value: unknown): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(richTextContent).join('');
  if (!value || typeof value !== 'object') return '';
  const record = value as Record<string, unknown>;
  if (typeof record.text === 'string') return record.text;
  for (const key of ['runs', 'children', 'content']) {
    const content = richTextContent(record[key]);
    if (content) return content;
  }
  return '';
}

function rawCellValue(cell: Sq1PblCell | undefined): string | number | boolean | null | undefined {
  return cell?.formula ? (cell.cached ?? cell.value) : cell?.value;
}

function numericCellValue(cell: Sq1PblCell | undefined): number | null {
  const raw = rawCellValue(cell);
  if (cell?.type !== 'n' || (typeof raw !== 'number' && typeof raw !== 'string')) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function displayCellValue(cell: Sq1PblCell | undefined, style: Sq1PblJsonObject | undefined): string {
  if (!cell) return '';
  const value = rawCellValue(cell);
  if (value === undefined || value === null) return richTextContent(cell.richText);
  const numeric = numericCellValue(cell);
  if (numeric !== null) {
    const formatted = formatSq1PblNumericValue(numeric, styleNumberFormat(style));
    if (formatted !== null) return formatted;
  }
  return String(value);
}

function richTextRunStyle(properties: Sq1PblJsonObject | null): CSSProperties {
  const size = Number(nodeAttribute(nodeChild(properties, 'sz'), 'val'));
  const decorations = [
    xmlEnabled(nodeChild(properties, 'u')) ? 'underline' : '',
    xmlEnabled(nodeChild(properties, 'strike')) ? 'line-through' : '',
  ].filter(Boolean).join(' ');
  return {
    color: safeWorkbookColor(nodeChild(properties, 'color')),
    fontWeight: xmlEnabled(nodeChild(properties, 'b')) ? 700 : undefined,
    fontStyle: xmlEnabled(nodeChild(properties, 'i')) ? 'italic' : undefined,
    textDecoration: decorations || undefined,
    fontSize: Number.isFinite(size) ? `${Math.min(72, Math.max(6, size))}pt` : undefined,
  };
}

function RichTextRuns({ value }: { value: Sq1PblJsonObject }) {
  const runs = nodeChildren(value).filter(child => child.tag === 'r');
  if (!runs.length) return <>{richTextContent(value)}</>;
  return <>{runs.map((run, index) => {
    const text = nodeChild(run, 't')?.text;
    return (
      <span style={richTextRunStyle(nodeChild(run, 'rPr'))} key={index}>
        {typeof text === 'string' ? text : ''}
      </span>
    );
  })}</>;
}

function nodeText(node: Sq1PblJsonObject | null): string {
  const value = node?.text;
  return typeof value === 'string' ? value : '';
}

function refsInSqref(value: string | undefined): string[] {
  return value ? value.trim().split(/\s+/).flatMap(refsInRange) : [];
}

function conditionalRuleMatches(
  rule: Sq1PblJsonObject,
  cell: Sq1PblCell | undefined,
  cells: ReadonlyMap<string, Sq1PblCell>,
): boolean {
  const type = nodeAttribute(rule, 'type');
  const raw = rawCellValue(cell);
  const text = raw === undefined || raw === null ? richTextContent(cell?.richText) : String(raw);
  if (type === 'containsText') {
    const needle = nodeAttribute(rule, 'text') ?? '';
    return Boolean(needle) && text.toLocaleLowerCase().includes(needle.toLocaleLowerCase());
  }
  if (type === 'notContainsBlanks') return text.trim().length > 0;
  const formula = nodeText(nodeChild(rule, 'formula')).trim();
  if (type === 'cellIs' && nodeAttribute(rule, 'operator') === 'equal') {
    const expected = formula.replace(/^"|"$/g, '').replaceAll('""', '"');
    return text.toLocaleLowerCase() === expected.toLocaleLowerCase();
  }
  if (type === 'expression') {
    const expression = formula.replace(/^"|"$/g, '').trim();
    const booleanReference = expression.match(/^\$?([A-Z]+)\$?(\d+)\s*=\s*(TRUE|FALSE)$/i);
    if (booleanReference) {
      const referenced = rawCellValue(cells.get(`${booleanReference[1].toUpperCase()}${booleanReference[2]}`));
      return Boolean(referenced) === (booleanReference[3].toUpperCase() === 'TRUE');
    }
    // The source contains one lossy COUNTIF marker without arguments; applying it to
    // populated cells preserves its visible differential style without inventing a formula.
    if (expression.toUpperCase() === 'COUNTIF') return text.trim().length > 0;
  }
  return false;
}

function workbookColorChannels(node: Sq1PblJsonObject | null): [number, number, number] | null {
  const rgb = nodeAttribute(node, 'rgb');
  if (!rgb || !/^[0-9A-F]{6}([0-9A-F]{2})?$/i.test(rgb)) return null;
  const hex = rgb.length === 8 ? rgb.slice(2) : rgb;
  return [0, 2, 4].map(offset => Number.parseInt(hex.slice(offset, offset + 2), 16)) as [number, number, number];
}

function percentile(sorted: readonly number[], value: number): number {
  if (!sorted.length) return 0;
  const position = Math.min(1, Math.max(0, value / 100)) * (sorted.length - 1);
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  const fraction = position - lower;
  return sorted[lower] + (sorted[upper] - sorted[lower]) * fraction;
}

function colorScaleStyles(
  rule: Sq1PblJsonObject,
  refs: readonly string[],
  cells: ReadonlyMap<string, Sq1PblCell>,
): Map<string, CSSProperties> {
  const result = new Map<string, CSSProperties>();
  const scale = nodeChild(rule, 'colorScale');
  if (!scale) return result;
  const numeric = refs.flatMap(ref => {
    const value = numericCellValue(cells.get(ref));
    return value === null ? [] : [value];
  }).sort((a, b) => a - b);
  if (!numeric.length) return result;
  const valueNodes = nodeChildren(scale).filter(child => child.tag === 'cfvo');
  const colors = nodeChildren(scale)
    .filter(child => child.tag === 'color')
    .map(workbookColorChannels)
    .filter((color): color is [number, number, number] => Boolean(color));
  if (colors.length < 2 || colors.length !== valueNodes.length) return result;
  const stops = valueNodes.map(node => {
    const type = nodeAttribute(node, 'type');
    if (type === 'min') return numeric[0];
    if (type === 'max') return numeric.at(-1) ?? numeric[0];
    if (type === 'percentile') return percentile(numeric, Number(nodeAttribute(node, 'val')));
    const parsed = Number(nodeAttribute(node, 'val'));
    return Number.isFinite(parsed) ? parsed : numeric[0];
  });
  refs.forEach(ref => {
    const value = numericCellValue(cells.get(ref));
    if (value === null) return;
    let segment = stops.findIndex(stop => value <= stop);
    if (segment <= 0) segment = 1;
    if (segment >= stops.length) segment = stops.length - 1;
    const start = stops[segment - 1];
    const end = stops[segment];
    const ratio = end === start ? 1 : Math.min(1, Math.max(0, (value - start) / (end - start)));
    const color = colors[segment - 1].map((channel, index) => (
      Math.round(channel + (colors[segment][index] - channel) * ratio)
    ));
    result.set(ref, { backgroundColor: `rgb(${color.join(' ')})` });
  });
  return result;
}

function buildConditionalStyles(
  sheet: Sq1PblSheet,
  cells: ReadonlyMap<string, Sq1PblCell>,
): Map<string, CSSProperties> {
  const result = new Map<string, CSSProperties>();
  const definitions = sheet.conditionalFormatting.flatMap(formatting => {
    const refs = refsInSqref(nodeAttribute(formatting, 'sqref'));
    return nodeChildren(formatting)
      .filter(child => child.tag === 'cfRule')
      .map(rule => ({ refs, rule, priority: Number(nodeAttribute(rule, 'priority')) || Number.MAX_SAFE_INTEGER }));
  }).sort((left, right) => right.priority - left.priority);
  definitions.forEach(({ refs, rule }) => {
    if (nodeAttribute(rule, 'type') === 'colorScale') {
      colorScaleStyles(rule, refs, cells).forEach((style, ref) => {
        result.set(ref, { ...result.get(ref), ...style });
      });
      return;
    }
    const dxfId = nodeAttribute(rule, 'dxfId');
    const differential = dxfId ? sheet.styles.differential[dxfId] : undefined;
    if (!differential) return;
    const style = workbookCellStyle(differential);
    refs.forEach(ref => {
      if (conditionalRuleMatches(rule, cells.get(ref), cells)) {
        result.set(ref, { ...result.get(ref), ...style });
      }
    });
  });
  return result;
}

function pictureAlt(picture: Sq1PblPicture): string {
  return picture.image.descr
    || picture.image.title
    || tr({ zh: 'PBL 文档中的图片', en: 'Image from the PBL document' });
}

function CellDetails({
  cell,
  notes,
  links,
  currentSheet,
  manifest,
}: {
  cell?: Sq1PblCell;
  notes: readonly Sq1PblNote[];
  links: readonly Sq1PblHyperlink[];
  currentSheet: Sq1PblSheetRef;
  manifest: Sq1PblManifest;
}) {
  const details: ReactNode[] = [];
  if (cell?.formula) {
    const formulaText = cell.formula.text ?? cell.formula.template ?? '';
    const isSharedTemplate = !cell.formula.text && Boolean(cell.formula.template);
    details.push(
      <details className={styles.cellDetail} key="formula">
        <summary aria-label={tr({ zh: '查看单元格公式', en: 'View cell formula' })}>fx</summary>
        {isSharedTemplate ? (
          <>
            <strong>{tr({ zh: '共享公式模板（不是当前单元格换算后的公式）', en: 'Shared formula template (not the translated formula for this cell)' })}</strong>
            <code>={formulaText}</code>
            {(cell.formula.sharedMaster || cell.formula.sharedRange) && (
              <span>
                {tr({
                  zh: `主单元格：${cell.formula.sharedMaster ?? '—'}；共享范围：${cell.formula.sharedRange ?? '—'}`,
                  en: `Master: ${cell.formula.sharedMaster ?? '—'}; shared range: ${cell.formula.sharedRange ?? '—'}`,
                })}
              </span>
            )}
          </>
        ) : (
          <>
            <code>={formulaText}</code>
            {(cell.formula.sharedMaster || cell.formula.sharedRange) && (
              <span>
                {tr({
                  zh: `共享主单元格：${cell.formula.sharedMaster ?? '—'}；共享范围：${cell.formula.sharedRange ?? '—'}`,
                  en: `Shared master: ${cell.formula.sharedMaster ?? '—'}; shared range: ${cell.formula.sharedRange ?? '—'}`,
                })}
              </span>
            )}
          </>
        )}
      </details>,
    );
  }
  notes.forEach((note, index) => {
    details.push(
      <details className={styles.cellDetail} key={`note-${index}`}>
        <summary aria-label={tr({ zh: '查看单元格批注', en: 'View cell note' })}>
          {tr({ zh: '注', en: 'N' })}
        </summary>
        {note.author && <strong>{note.author}</strong>}
        <span>{note.text}</span>
      </details>,
    );
  });
  links.forEach((link, index) => {
    const href = externalHyperlinkHref(link);
    if (href) {
      details.push(
        <a
          className={styles.cellLink}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          title={link.tooltip || link.display}
          aria-label={link.display || tr({ zh: `打开单元格链接 ${index + 1}`, en: `Open cell link ${index + 1}` })}
          key={`link-${index}`}
        >
          ↗
        </a>,
      );
    } else if (link.location) {
      const target = resolveInternalLocation(link.location, currentSheet, manifest);
      const sourceHref = sourceLocationHref(link.location, manifest);
      details.push(
        target ? (
          <AppLink
            className={styles.internalLocation}
            href={internalCellHref(target)}
            prefetch={false}
            title={link.tooltip}
            key={`location-${index}`}
          >
            {link.display || link.location}
          </AppLink>
        ) : sourceHref ? (
          <a
            className={styles.internalLocation}
            href={sourceHref}
            target="_blank"
            rel="noopener noreferrer"
            title={link.tooltip}
            key={`location-${index}`}
          >
            {link.display || link.location}
          </a>
        ) : (
          <span className={styles.internalLocation} title={link.tooltip} key={`location-${index}`}>
            {link.display || link.location}
          </span>
        ),
      );
    }
  });
  return details.length ? <div className={styles.cellDetails}>{details}</div> : null;
}

function WorkbookTable({
  sheet,
  manifest,
  targetCell,
}: {
  sheet: Sq1PblSheet;
  manifest: Sq1PblManifest;
  targetCell: string;
}) {
  const model = useMemo(() => {
    const size = sheetSize(sheet.dimension, sheet.cells);
    const cells = new Map(sheet.cells.map(cell => [cell.ref, cell]));
    const notes = mapRanges(sheet.notes);
    const links = mapRanges(sheet.hyperlinks);
    const styleRanges = mapRanges(sheet.styleRanges);
    const conditionalStyles = buildConditionalStyles(sheet, cells);
    const merges = buildMerges(sheet.merges);
    const mediaByHash = new Map(manifest.media.map(item => [item.sha256, item.url]));
    const pictures = new Map<string, Sq1PblPicture[]>();
    for (const picture of sheet.pictures) {
      const row = (picture.from?.row ?? 0) + 1;
      const column = (picture.from?.col ?? 0) + 1;
      const ref = cellRef(Math.max(1, row), Math.max(1, column));
      const current = pictures.get(ref) ?? [];
      current.push({
        ...picture,
        image: {
          ...picture.image,
          url: picture.image.url || mediaByHash.get(picture.image.sha256),
        },
      });
      pictures.set(ref, current);
    }
    const rowDefinitions = new Map<number, Record<string, string>>();
    for (const row of sheet.rows) {
      const index = Number(row.r);
      if (Number.isInteger(index) && index > 0) rowDefinitions.set(index, row);
    }
    const columnDefinitions = Array.from(
      { length: size.column },
      (): Record<string, string> | undefined => undefined,
    );
    for (const column of sheet.columns) {
      const start = Number(column.min);
      const end = Number(column.max);
      if (!Number.isInteger(start) || !Number.isInteger(end)) continue;
      for (let index = Math.max(1, start); index <= Math.min(size.column, end); index += 1) {
        columnDefinitions[index - 1] = column;
      }
    }
    const columnMetrics = columnDefinitions.map(column => ({
      width: excelColumnWidth(column),
      hidden: xmlAttributeEnabled(column?.hidden),
      style: column?.style,
    }));
    const rowMetrics = Array.from({ length: size.row }, (_, offset) => {
      const row = rowDefinitions.get(offset + 1);
      return {
        height: excelRowHeight(row),
        hidden: xmlAttributeEnabled(row?.hidden),
        style: row?.s,
      };
    });
    const columnLeft: number[] = [];
    let left = WORKBOOK_ROW_HEADER_WIDTH;
    columnMetrics.forEach((column, offset) => {
      columnLeft[offset] = left;
      if (!column.hidden) left += column.width;
    });
    const rowTop: number[] = [];
    let top = WORKBOOK_COLUMN_HEADER_HEIGHT;
    rowMetrics.forEach((row, offset) => {
      rowTop[offset] = top;
      if (!row.hidden) top += row.height ?? WORKBOOK_COLUMN_HEADER_HEIGHT;
    });
    const currentSheet = manifest.sheets.find(item => item.slug === sheet.slug)
      ?? manifest.sheets.find(item => item.index === sheet.index)
      ?? {
        index: sheet.index,
        name: sheet.name,
        slug: sheet.slug,
        state: sheet.state,
        dimension: sheet.dimension,
        dataUrl: '',
      };
    return {
      size,
      cells,
      notes,
      links,
      styleRanges,
      conditionalStyles,
      merges,
      pictures,
      columnMetrics,
      rowMetrics,
      columnLeft,
      rowTop,
      currentSheet,
      totalWidth: left,
      frozen: frozenSplits(sheet.pane),
    };
  }, [manifest, sheet]);

  const columns = Array.from({ length: model.size.column }, (_, index) => index + 1);
  const rows = Array.from({ length: model.size.row }, (_, index) => index + 1);

  return (
    <div
      className={`sticky-scroll ${styles.tableScroll}`}
      tabIndex={0}
      aria-label={tr({ zh: `${sheet.name} 工作表滚动区域`, en: `${sheet.name} worksheet scroll area` })}
    >
      <table
        className={`sticky-thead ${styles.workbookTable}`}
        style={{ width: Math.max(model.totalWidth, WORKBOOK_ROW_HEADER_WIDTH), minWidth: '100%', tableLayout: 'fixed' }}
      >
        <caption className={styles.srOnly}>
          {tr({ zh: `${sheet.name} 完整工作表`, en: `Complete ${sheet.name} worksheet` })}
        </caption>
        <colgroup>
          <col style={{ width: WORKBOOK_ROW_HEADER_WIDTH }} />
          {model.columnMetrics.map((column, offset) => (
            <col
              key={offset}
              style={{ width: column.width, visibility: column.hidden ? 'collapse' : undefined }}
            />
          ))}
        </colgroup>
        <thead>
          <tr>
            <th className={styles.cornerCell} aria-label={tr({ zh: '行列坐标', en: 'Row and column coordinates' })} />
            {columns.map(column => {
              const frozen = column <= model.frozen.columns;
              return (
                <th
                  scope="col"
                  key={column}
                  style={frozen ? { position: 'sticky', left: model.columnLeft[column - 1], zIndex: 7 } : undefined}
                >
                  {columnLabel(column)}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map(row => {
            const rowMetric = model.rowMetrics[row - 1] ?? { height: undefined, hidden: false, style: undefined };
            const frozenRow = row <= model.frozen.rows;
            return (
              <tr key={row} hidden={rowMetric.hidden} style={{ height: rowMetric.height }}>
                <th
                  className={styles.rowHeader}
                  scope="row"
                  style={frozenRow ? { top: model.rowTop[row - 1], zIndex: 6 } : undefined}
                >
                  {row}
                </th>
                {columns.map(column => {
                const ref = cellRef(row, column);
                if (model.merges.covered.has(ref)) return null;
                const cell = model.cells.get(ref);
                const links = model.links.get(ref) ?? [];
                const notes = model.notes.get(ref) ?? [];
                const pictures = model.pictures.get(ref) ?? [];
                const merge = model.merges.anchors.get(ref);
                const rangeStyle = model.styleRanges.get(ref)?.at(-1)?.style;
                const styleKey = cell?.style ?? rangeStyle ?? rowMetric.style ?? model.columnMetrics[column - 1]?.style;
                const styleDefinition = styleKey ? sheet.styles.cell[styleKey] : undefined;
                const value = displayCellValue(cell, styleDefinition);
                const primaryLink = links.find(link => externalHyperlinkHref(link));
                const primaryHref = primaryLink ? externalHyperlinkHref(primaryLink) : null;
                const presentation = {
                  ...workbookCellStyle(styleDefinition),
                  ...model.conditionalStyles.get(ref),
                };
                const frozenColumn = column <= model.frozen.columns;
                const frozenStyle: CSSProperties = {};
                if (frozenRow || frozenColumn) {
                  frozenStyle.position = 'sticky';
                  frozenStyle.zIndex = frozenRow && frozenColumn ? 4 : 3;
                  frozenStyle.backgroundColor = presentation.backgroundColor ?? 'var(--background)';
                  if (frozenRow) frozenStyle.top = model.rowTop[row - 1];
                  if (frozenColumn) frozenStyle.left = model.columnLeft[column - 1];
                }
                const isTarget = targetCell === ref;
                return (
                  <td
                    id={`sq1-pbl-cell-${sheet.slug}-${ref}`}
                    key={ref}
                    rowSpan={merge?.rowSpan}
                    colSpan={merge?.colSpan}
                    className={isTarget ? styles.targetCell : undefined}
                    tabIndex={isTarget ? -1 : undefined}
                    data-cell-ref={ref}
                    data-style={styleKey}
                    style={{ ...presentation, ...frozenStyle }}
                  >
                    <span className={styles.cellMain}>
                      {primaryHref && (cell?.richText || value) ? (
                        <a href={primaryHref} target="_blank" rel="noopener noreferrer">
                          {cell?.richText ? <RichTextRuns value={cell.richText} /> : value}
                        </a>
                      ) : cell?.richText ? <RichTextRuns value={cell.richText} /> : value}
                    </span>
                    {cell?.computedImage && (
                      <img
                        className={styles.computedCellImage}
                        src={cell.computedImage.url}
                        alt={tr({
                          zh: `${sheet.name} 工作表 ${ref} 单元格中的计算图片`,
                          en: `Computed image in cell ${ref} of the ${sheet.name} worksheet`,
                        })}
                        width={cell.computedImage.pixels?.[0]}
                        height={cell.computedImage.pixels?.[1]}
                        loading="lazy"
                        decoding="async"
                      />
                    )}
                    <CellDetails
                      cell={cell}
                      notes={notes}
                      links={links.filter(link => link !== primaryLink)}
                      currentSheet={model.currentSheet}
                      manifest={manifest}
                    />
                    {pictures.map((picture, index) => (
                      <figure className={styles.cellPicture} key={`${picture.image.sha256}-${index}`}>
                        {picture.image.url ? (
                          <img
                            src={picture.image.url}
                            alt={pictureAlt(picture)}
                            width={picture.image.pixels?.[0]}
                            height={picture.image.pixels?.[1]}
                            loading="lazy"
                          />
                        ) : (
                          <span role="img" aria-label={pictureAlt(picture)}>{pictureAlt(picture)}</span>
                        )}
                      </figure>
                    ))}
                  </td>
                );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function MetadataPayload({ label, value }: { label: string; value: Sq1PblJsonValue }) {
  return (
    <details className={styles.metadataItem}>
      <summary>{label}</summary>
      <pre className={styles.metadataPayload}>{JSON.stringify(value, null, 2)}</pre>
    </details>
  );
}

function SheetMetadata({ sheet }: { sheet: Sq1PblSheet }) {
  const items: Array<{ label: string; value: Sq1PblJsonValue }> = [];
  if (sheet.pane) items.push({ label: tr({ zh: '冻结窗格', en: 'Frozen pane' }), value: sheet.pane });
  items.push({
    label: tr({ zh: `数据验证（${sheet.validations.length}）`, en: `Data validations (${sheet.validations.length})` }),
    value: sheet.validations,
  });
  items.push({
    label: tr({ zh: `条件格式（${sheet.conditionalFormatting.length}）`, en: `Conditional formatting (${sheet.conditionalFormatting.length})` }),
    value: {
      rules: sheet.conditionalFormatting,
      differentialStyles: sheet.styles.differential,
    },
  });
  if (sheet.autoFilter) items.push({ label: tr({ zh: '自动筛选', en: 'Auto filter' }), value: sheet.autoFilter });
  items.push({
    label: tr({ zh: `表对象（${sheet.tables.length}）`, en: `Table objects (${sheet.tables.length})` }),
    value: sheet.tables,
  });
  items.push({
    label: tr({ zh: '非图片绘图锚点', en: 'Non-picture drawing anchors' }),
    value: sheet.nonPictureDrawingAnchors,
  });
  return (
    <details className={styles.sheetMetadata}>
      <summary>{tr({ zh: '查看工作表结构与规则', en: 'View sheet structure and rules' })}</summary>
      <div className={styles.metadataItems}>
        {items.map(item => <MetadataPayload label={item.label} value={item.value} key={item.label} />)}
      </div>
    </details>
  );
}

function DocumentExplorer() {
  const [manifest, setManifest] = useState<Sq1PblManifest | null>(null);
  const [sheet, setSheet] = useState<Sq1PblSheet | null>(null);
  const [manifestError, setManifestError] = useState(false);
  const [sheetError, setSheetError] = useState(false);
  const [loadingSheet, setLoadingSheet] = useState(false);
  const [sheetSearch, setSheetSearch] = useQueryState(
    'q',
    parseAsString.withDefault('').withOptions({ history: 'replace', scroll: false }),
  );
  const [sheetSlug, setSheetSlug] = useQueryState(
    'sheet',
    parseAsString.withDefault('').withOptions({ history: 'push', scroll: false }),
  );
  const [targetCell, setTargetCell] = useQueryState(
    'cell',
    parseAsString.withDefault('').withOptions({ history: 'replace', scroll: false }),
  );

  useEffect(() => {
    const controller = new AbortController();
    setManifestError(false);
    loadSq1PblManifest(controller.signal)
      .then(setManifest)
      .catch(error => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setManifestError(true);
      });
    return () => controller.abort();
  }, []);

  const selectedRef = useMemo(() => {
    if (!manifest) return null;
    return manifest.sheets.find(item => item.slug === sheetSlug) ?? manifest.sheets[0] ?? null;
  }, [manifest, sheetSlug]);

  useEffect(() => {
    if (!selectedRef) return;
    if (sheetSlug !== selectedRef.slug) void setSheetSlug(selectedRef.slug);
  }, [selectedRef, setSheetSlug, sheetSlug]);

  useEffect(() => {
    if (!selectedRef) return;
    const controller = new AbortController();
    setSheet(null);
    setSheetError(false);
    setLoadingSheet(true);
    loadSq1PblSheet(selectedRef, controller.signal)
      .then(setSheet)
      .catch(error => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setSheetError(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingSheet(false);
      });
    return () => controller.abort();
  }, [selectedRef]);

  const normalizedTargetCell = useMemo(() => {
    const point = parseCellRef(targetCell);
    return point ? cellRef(point.row, point.column) : '';
  }, [targetCell]);

  useEffect(() => {
    if (!sheet || !normalizedTargetCell) return;
    const frame = requestAnimationFrame(() => {
      const target = document.getElementById(`sq1-pbl-cell-${sheet.slug}-${normalizedTargetCell}`);
      if (!(target instanceof HTMLElement)) return;
      target.focus({ preventScroll: true });
      target.scrollIntoView({ block: 'center', inline: 'center' });
    });
    return () => cancelAnimationFrame(frame);
  }, [normalizedTargetCell, sheet]);

  const filteredSheets = useMemo(() => {
    if (!manifest) return [];
    const query = normalizeSearch(sheetSearch);
    return query
      ? manifest.sheets.filter(item => normalizeSearch(item.name).includes(query))
      : manifest.sheets;
  }, [manifest, sheetSearch]);

  if (manifestError) {
    return <p className={styles.error} role="alert">{tr({ zh: 'PBL 文档加载失败，请稍后重试。', en: 'The PBL document could not be loaded. Please try again later.' })}</p>;
  }
  if (!manifest) {
    return <p className={styles.status} role="status">{tr({ zh: '正在加载 PBL 文档索引…', en: 'Loading the PBL document index…' })}</p>;
  }

  return (
    <section className={styles.documentSection} aria-labelledby="sq1-pbl-document-heading">
      <div className={styles.sectionHeadingRow}>
        <div>
          <h2 id="sq1-pbl-document-heading">{tr({ zh: 'Daniel 的 PBL 文档', en: 'Daniel’s PBL document' })}</h2>
          <p className={styles.sourceLine}>
            {tr({ zh: `共 ${manifest.sheets.length} 张工作表，正文保留作者原文。`, en: `${manifest.sheets.length} sheets; document content is preserved in the author’s original language.` })}
            {manifest.source.url && (
              <>{' '}<a href={manifest.source.url} target="_blank" rel="noopener noreferrer">{tr({ zh: '查看原表', en: 'Open source sheet' })}</a></>
            )}
            {' '}<AppLink href="/about" prefetch={false}>{tr({ zh: '来源与致谢', en: 'Sources and credits' })}</AppLink>
          </p>
        </div>
      </div>

      <div className={styles.documentToolbar}>
        <label className={styles.searchField}>
          <span>{tr({ zh: '搜索工作表', en: 'Search sheets' })}</span>
          <SearchInput
            type="search"
            value={sheetSearch}
            onChange={value => void setSheetSearch(value)}
            placeholder={tr({ zh: '名称', en: 'Name' })}
            className={styles.inputWithClear}
            inputClassName={styles.searchInput}
          />
        </label>
        <div className={styles.sheetPicker}>
          <span className={styles.controlLabel}>{tr({ zh: '工作表', en: 'Sheet' })}</span>
          <CompactSelect
            variant="plain"
            value={selectedRef?.slug}
            label={selectedRef?.name ?? tr({ zh: '选择工作表', en: 'Choose a sheet' })}
            ariaLabel={tr({ zh: '选择 PBL 工作表', en: 'Choose a PBL sheet' })}
            items={filteredSheets.map(item => ({
              value: item.slug,
              label: item.state === 'visible'
                ? item.name
                : tr({ zh: `${item.name}（隐藏源表）`, en: `${item.name} (hidden source sheet)` }),
            }))}
            onChange={value => {
              void setTargetCell('');
              void setSheetSlug(value);
            }}
          />
          <span className={styles.matchCount} aria-live="polite">
            {tr({ zh: `${filteredSheets.length} 张匹配`, en: `${filteredSheets.length} matches` })}
          </span>
        </div>
      </div>

      {filteredSheets.length === 0 && (
        <p className={styles.status}>{tr({ zh: '没有匹配的工作表。', en: 'No sheets match that search.' })}</p>
      )}
      {selectedRef && (
        <div className={styles.sheetHeading}>
          <h3>{selectedRef.name}</h3>
          <span>{selectedRef.dimension}</span>
          {selectedRef.state !== 'visible' && <span>{tr({ zh: '上游隐藏源表', en: 'Hidden upstream source sheet' })}</span>}
        </div>
      )}
      {loadingSheet && <p className={styles.status} role="status">{tr({ zh: '正在加载工作表…', en: 'Loading sheet…' })}</p>}
      {sheetError && <p className={styles.error} role="alert">{tr({ zh: '这张工作表加载失败，请重新选择后再试。', en: 'This sheet could not be loaded. Choose it again to retry.' })}</p>}
      {sheet && <SheetMetadata sheet={sheet} />}
      {sheet && <WorkbookTable sheet={sheet} manifest={manifest} targetCell={normalizedTargetCell} />}
    </section>
  );
}

function pllKey(pll: Sq1PblPll): string {
  return `${pll.parity ? 'parity' : 'standard'}:${pll.name}`;
}

function auxiliaryProblemText(reason: string): string {
  switch (reason) {
    case 'missing-separator': return tr({ zh: '请输入“名称@公式”。', en: 'Enter “name@algorithm”.' });
    case 'empty-name': return tr({ zh: '辅助公式名称不能为空。', en: 'The auxiliary name cannot be empty.' });
    case 'empty-sequence': return tr({ zh: '辅助公式不能为空。', en: 'The auxiliary algorithm cannot be empty.' });
    case 'invalid-notation': return tr({ zh: '辅助公式含有无效的 SQ1 记号。', en: 'The auxiliary algorithm contains invalid Square-1 notation.' });
    case 'unsliceable': return tr({ zh: '辅助公式中有无法切层的状态。', en: 'The auxiliary algorithm reaches an unsliceable state.' });
    case 'duplicate-name': return tr({ zh: '这个辅助公式名称已经存在。', en: 'That auxiliary name already exists.' });
    case 'duplicate-sequence': return tr({ zh: '这条辅助公式已经存在。', en: 'That auxiliary algorithm already exists.' });
    default: return tr({ zh: '辅助公式无效。', en: 'The auxiliary algorithm is invalid.' });
  }
}

function FinderWorkspace() {
  const [defaults, setDefaults] = useState<Sq1PblFinderDefaults | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [topKey, setTopKey] = useState('');
  const [bottomKey, setBottomKey] = useState('');
  const [auxiliary, setAuxiliary] = useState<Sq1PblAuxiliary[]>([]);
  const [auxiliarySearch, setAuxiliarySearch] = useQueryState(
    'aux',
    parseAsString.withDefault('').withOptions({ history: 'replace', scroll: false }),
  );
  const [selectedAuxiliary, setSelectedAuxiliary] = useState('');
  const [newAuxiliary, setNewAuxiliary] = useState('');
  const [inputError, setInputError] = useState('');
  const [auxiliaryReady, setAuxiliaryReady] = useState(false);
  const [manageStatus, setManageStatus] = useState<'imported' | 'restored' | ''>('');
  const [mode, setMode] = useState<Sq1PblSearchMode>('legacy');
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ completed: 0, total: 0 });
  const [runError, setRunError] = useState(false);
  const [result, setResult] = useState<Sq1PblSearchResult | null>(null);
  const [selectedSolution, setSelectedSolution] = useState<Sq1PblSolution | null>(null);
  const [cancelled, setCancelled] = useState(false);
  const workerRef = useRef<Worker | null>(null);
  const requestRef = useRef(0);
  const { copied: solutionCopied, copy: copySolution } = useCopy();

  useEffect(() => {
    const controller = new AbortController();
    setLoadError(false);
    loadSq1PblFinderDefaults(controller.signal)
      .then(data => {
        let nextAuxiliary = data.auxiliaryAlgorithms;
        try {
          const stored = localStorage.getItem(AUXILIARY_STORAGE_KEY);
          const parsed = stored ? parseAuxiliaryPayload(JSON.parse(stored)) : null;
          if (parsed) nextAuxiliary = parsed;
        } catch {
          // Ignore unavailable or malformed browser storage and retain defaults.
        }
        setDefaults(data);
        setTopKey('');
        setBottomKey('');
        setAuxiliary(nextAuxiliary);
        setSelectedAuxiliary(nextAuxiliary[0]?.name ?? '');
        setAuxiliaryReady(true);
      })
      .catch(error => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setLoadError(true);
      });
    return () => controller.abort();
  }, []);

  useEffect(() => () => {
    requestRef.current += 1;
    workerRef.current?.terminate();
    workerRef.current = null;
  }, []);

  useEffect(() => {
    if (!auxiliaryReady) return;
    persistItem(AUXILIARY_STORAGE_KEY, JSON.stringify({
      schemaVersion: 1,
      auxiliaryAlgorithms: auxiliary,
    }));
  }, [auxiliary, auxiliaryReady]);

  const allPlls = defaults ? [...defaults.plls.standard, ...defaults.plls.parity] : [];
  const top = allPlls.find(item => pllKey(item) === topKey) ?? null;
  const bottom = allPlls.find(item => pllKey(item) === bottomKey) ?? null;
  const query = normalizeSearch(auxiliarySearch);
  const filteredAuxiliary = query
    ? auxiliary.filter(item => normalizeSearch(`${item.name} ${item.sequence}`).includes(query))
    : auxiliary;
  const auxiliaryExportHref = useMemo(() => (
    `data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify({
      schemaVersion: 1,
      auxiliaryAlgorithms: auxiliary,
    }, null, 2))}`
  ), [auxiliary]);

  const clearResult = () => {
    requestRef.current += 1;
    workerRef.current?.terminate();
    workerRef.current = null;
    setRunning(false);
    setProgress({ completed: 0, total: 0 });
    setResult(null);
    setSelectedSolution(null);
    setRunError(false);
    setCancelled(false);
  };

  const cancelFinder = () => {
    requestRef.current += 1;
    workerRef.current?.terminate();
    workerRef.current = null;
    setRunning(false);
    setProgress({ completed: 0, total: 0 });
    setCancelled(true);
  };

  const updateTop = (value: string) => {
    setTopKey(value);
    clearResult();
  };

  const updateBottom = (value: string) => {
    setBottomKey(value);
    clearResult();
  };

  const addAuxiliary = () => {
    setInputError('');
    const parsed = parseSq1PblAuxiliaryInput(newAuxiliary);
    if (!parsed.ok) {
      setInputError(auxiliaryProblemText(parsed.reason));
      return;
    }
    const next = [...auxiliary, parsed.value];
    const problem = validateSq1PblAuxiliary(next).find(item => item.index === next.length - 1);
    if (problem) {
      setInputError(auxiliaryProblemText(problem.reason));
      return;
    }
    setAuxiliary(next);
    setSelectedAuxiliary(parsed.value.name);
    setNewAuxiliary('');
    setManageStatus('');
    clearResult();
  };

  const removeAuxiliary = () => {
    if (!selectedAuxiliary) return;
    const next = auxiliary.filter(item => item.name !== selectedAuxiliary);
    setAuxiliary(next);
    setSelectedAuxiliary(next[0]?.name ?? '');
    setManageStatus('');
    clearResult();
  };

  const restoreAuxiliary = () => {
    const next = [...defaults!.auxiliaryAlgorithms];
    setAuxiliary(next);
    setSelectedAuxiliary(next[0]?.name ?? '');
    setInputError('');
    clearResult();
    setManageStatus('restored');
  };

  const importAuxiliary = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;
    try {
      if (file.size > MAX_AUXILIARY_IMPORT_BYTES) throw new Error('too-large');
      const parsed = parseAuxiliaryPayload(JSON.parse(await file.text()));
      if (!parsed) throw new Error('invalid');
      setAuxiliary(parsed);
      setSelectedAuxiliary(parsed[0]?.name ?? '');
      setInputError('');
      clearResult();
      setManageStatus('imported');
    } catch {
      setManageStatus('');
      setInputError(tr({
        zh: 'JSON 无效或超过 2 MB：需要 auxiliaryAlgorithms 数组，且每项包含有效的 name 与 sequence。',
        en: 'The JSON is invalid or exceeds 2 MB: auxiliaryAlgorithms must contain valid name and sequence entries.',
      }));
    }
  };

  const runFinder = () => {
    if (!top || !bottom || auxiliary.length === 0) return;
    clearResult();
    const problems = validateSq1PblAuxiliary(auxiliary);
    if (problems.length) {
      setInputError(auxiliaryProblemText(problems[0].reason));
      return;
    }
    setInputError('');
    setRunning(true);
    const id = requestRef.current + 1;
    requestRef.current = id;
    let worker: Worker;
    try {
      worker = new Worker(new URL('../lib/sq1-pbl.worker.ts', import.meta.url), { type: 'module' });
    } catch {
      if (requestRef.current === id) {
        setRunning(false);
        setRunError(true);
      }
      return;
    }
    workerRef.current = worker;
    worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
      const message = event.data;
      if (message.id !== id || requestRef.current !== id) return;
      if (message.type === 'progress') {
        setProgress({ completed: message.completed, total: message.total });
        return;
      }
      setRunning(false);
      worker.terminate();
      if (workerRef.current === worker) workerRef.current = null;
      if (message.type === 'result') {
        setResult(message.result);
        setSelectedSolution(message.result.solutions[0] ?? null);
      } else {
        setRunError(true);
      }
    };
    worker.onerror = () => {
      if (requestRef.current !== id) return;
      setRunning(false);
      setRunError(true);
      worker.terminate();
      if (workerRef.current === worker) workerRef.current = null;
    };
    const input: Sq1PblSearchInput = { top, bottom, auxiliary, mode };
    try {
      worker.postMessage({ id, input });
    } catch {
      worker.terminate();
      if (workerRef.current === worker) workerRef.current = null;
      if (requestRef.current === id) {
        setRunning(false);
        setRunError(true);
      }
    }
  };

  if (loadError) {
    return <p className={styles.error} role="alert">{tr({ zh: 'PBL Finder 默认数据加载失败，请稍后重试。', en: 'The PBL Finder defaults could not be loaded. Please try again later.' })}</p>;
  }
  if (!defaults) {
    return <p className={styles.status} role="status">{tr({ zh: '正在加载 PBL Finder…', en: 'Loading the PBL Finder…' })}</p>;
  }

  const pllItems = allPlls.map(item => ({
    value: pllKey(item),
    label: item.parity
      ? tr({ zh: `${item.name}（奇偶）`, en: `${item.name} (parity)` })
      : item.name,
  }));

  return (
    <section className={styles.finderSection} aria-labelledby="sq1-pbl-finder-heading">
      <div className={styles.sectionHeadingRow}>
        <div>
          <h2 id="sq1-pbl-finder-heading">{tr({ zh: 'PBL 公式查找器', en: 'PBL algorithm finder' })}</h2>
          <p className={styles.sourceLine}>
            {tr({ zh: '按原工具行为进行 clean-room 重写；默认使用旧版兼容搜索，严格模式会额外检查中层状态。', en: 'A clean-room behavioral reimplementation of the original tool; legacy-compatible search is the default, while strict mode also checks the middle layer.' })}
            {' '}<AppLink href="/about" prefetch={false}>{tr({ zh: '来源与致谢', en: 'Sources and credits' })}</AppLink>
          </p>
        </div>
        <label className={styles.modeControl}>
          <span>{tr({ zh: '搜索口径', en: 'Search mode' })}</span>
          <PillToggle
            value={mode === 'legacy'}
            offLabel={tr({ zh: '严格', en: 'Strict' })}
            onLabel={tr({ zh: '旧版兼容', en: 'Legacy' })}
            ariaLabel={tr({ zh: '切换严格或旧版兼容搜索', en: 'Toggle strict or legacy-compatible search' })}
            onChange={legacy => {
              setMode(legacy ? 'legacy' : 'strict');
              clearResult();
            }}
          />
        </label>
      </div>

      <div className={styles.pllSelectors}>
        <div className={styles.pickerField}>
          <span>{tr({ zh: '上层 PLL', en: 'Top PLL' })}</span>
          <CompactSelect
            variant="plain"
            value={topKey}
            label={top?.name ?? tr({ zh: '请选择', en: 'Choose' })}
            items={pllItems}
            onChange={updateTop}
            ariaLabel={tr({ zh: '选择上层 PLL', en: 'Choose the top PLL' })}
          />
        </div>
        <div className={styles.pickerField}>
          <span>{tr({ zh: '下层 PLL', en: 'Bottom PLL' })}</span>
          <CompactSelect
            variant="plain"
            value={bottomKey}
            label={bottom?.name ?? tr({ zh: '请选择', en: 'Choose' })}
            items={pllItems}
            onChange={updateBottom}
            ariaLabel={tr({ zh: '选择下层 PLL', en: 'Choose the bottom PLL' })}
          />
        </div>
      </div>

      <div className={styles.auxiliarySection}>
        <div className={styles.auxiliaryHeading}>
          <h3>{tr({ zh: '辅助公式', en: 'Auxiliary algorithms' })}</h3>
          <span>{tr({ zh: `${auxiliary.length} 条`, en: `${auxiliary.length} algorithms` })}</span>
        </div>
        <label className={styles.searchField}>
          <span>{tr({ zh: '筛选辅助公式', en: 'Filter auxiliary algorithms' })}</span>
          <SearchInput
            type="search"
            value={auxiliarySearch}
            onChange={value => void setAuxiliarySearch(value)}
            placeholder={tr({ zh: '名称或记号', en: 'Name or notation' })}
            className={styles.inputWithClear}
            inputClassName={styles.searchInput}
          />
        </label>
        <label className={styles.auxiliaryListLabel}>
          <span className={styles.srOnly}>{tr({ zh: '辅助公式列表', en: 'Auxiliary algorithm list' })}</span>
          <select
            className={styles.auxiliaryList}
            size={8}
            value={selectedAuxiliary}
            onChange={event => setSelectedAuxiliary(event.target.value)}
          >
            {filteredAuxiliary.map(item => (
              <option value={item.name} key={item.name}>{item.name}: {item.sequence}</option>
            ))}
          </select>
        </label>
        <div className={styles.auxiliaryEdit}>
          <label>
            <span>{tr({ zh: '新增辅助公式', en: 'New auxiliary algorithm' })}</span>
            <input
              className={styles.auxiliaryInput}
              value={newAuxiliary}
              onChange={event => setNewAuxiliary(event.target.value)}
              onKeyDown={event => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  addAuxiliary();
                }
              }}
              placeholder={tr({ zh: '名称@公式', en: 'name@algorithm' })}
            />
          </label>
          <div className={styles.editButtons}>
            <button type="button" className={styles.button} onClick={addAuxiliary} disabled={!newAuxiliary.trim()}>{tr({ zh: '添加', en: 'Add' })}</button>
            <button type="button" className={styles.button} onClick={removeAuxiliary} disabled={!selectedAuxiliary}>{tr({ zh: '移除所选', en: 'Remove selected' })}</button>
          </div>
        </div>
        <div className={styles.finderDataActions}>
          <button type="button" className={styles.button} onClick={restoreAuxiliary}>{tr({ zh: '还原默认', en: 'Restore defaults' })}</button>
          <label className={`${styles.button} ${styles.fileButton}`}>
            {tr({ zh: '导入 JSON', en: 'Import JSON' })}
            <input className={styles.fileInput} type="file" accept="application/json,.json" onChange={importAuxiliary} />
          </label>
          <a
            className={styles.button}
            href={auxiliaryExportHref}
            download="sq1-pbl-auxiliary.json"
          >
            {tr({ zh: '导出 JSON', en: 'Export JSON' })}
          </a>
        </div>
        {manageStatus && (
          <p className={styles.manageStatus} role="status">
            {manageStatus === 'imported'
              ? tr({ zh: '辅助公式已导入并保存在此浏览器。', en: 'Auxiliary algorithms imported and saved in this browser.' })
              : tr({ zh: '已还原默认辅助公式。', en: 'Default auxiliary algorithms restored.' })}
          </p>
        )}
        {inputError && <p className={styles.error} role="alert">{inputError}</p>}
      </div>

      <div className={styles.findAction}>
        <button
          type="button"
          className={styles.primaryButton}
          onClick={runFinder}
          disabled={running || !top || !bottom || auxiliary.length === 0}
        >
          {running ? tr({ zh: '正在查找…', en: 'Finding…' }) : tr({ zh: '查找公式', en: 'Find algorithms' })}
        </button>
        {running && <button type="button" className={styles.button} onClick={cancelFinder}>{tr({ zh: '取消', en: 'Cancel' })}</button>}
        {running && (
          <label className={styles.progressLabel}>
            <span>{tr({ zh: '搜索进度', en: 'Search progress' })}</span>
            <progress value={progress.completed} max={progress.total || 1} />
            <span>{progress.total ? `${Math.floor(progress.completed / progress.total * 100)}%` : '0%'}</span>
          </label>
        )}
      </div>

      {cancelled && <p className={styles.status} role="status">{tr({ zh: '搜索已取消。', en: 'Search cancelled.' })}</p>}

      {runError && <p className={styles.error} role="alert">{tr({ zh: '查找失败，请检查辅助公式后重试。', en: 'The search failed. Check the auxiliary algorithms and try again.' })}</p>}
      {result && (
        <section className={styles.outputSection} aria-labelledby="sq1-pbl-output-heading">
          <div className={styles.outputHeading}>
            <h3 id="sq1-pbl-output-heading">{result.target}</h3>
            <span>{tr({ zh: `${result.solutions.length} 条结果`, en: `${result.solutions.length} results` })}</span>
          </div>
          {result.solutions.length === 0 ? (
            <p className={styles.status}>{tr({ zh: '当前辅助公式表中没有找到解。', en: 'No solution was found with the current auxiliary list.' })}</p>
          ) : (
            <div className={styles.resultList}>
              {result.solutions.map((solution, index) => (
                <button
                  type="button"
                  className={`${styles.resultRow}${selectedSolution === solution ? ` ${styles.resultRowActive}` : ''}`}
                  onClick={() => setSelectedSolution(solution)}
                  aria-pressed={selectedSolution === solution}
                  key={`${solution.algorithm}-${solution.auxiliary.join('-')}-${index}`}
                >
                  <span className={styles.resultOrdinal}>{index + 1}</span>
                  <code>{solution.algorithm}</code>
                  <span>{solution.stm} STM</span>
                  <span>{solution.ftm} FTM</span>
                  <span>{solution.auxiliary.join(' + ')}</span>
                </button>
              ))}
            </div>
          )}
          {selectedSolution && (
            <div className={styles.selectedPreview}>
              <div className={styles.caseThumb}>
                <CaseThumb
                  puzzle="sq1"
                  set="pbl"
                  sticker={PBL_STICKER}
                  alg={selectedSolution.algorithm}
                  setup={result.setup}
                  size={150}
                  alt={tr({ zh: `${result.target} PBL 情况`, en: `${result.target} PBL case` })}
                />
              </div>
              <div className={styles.playerPane}>
                <AlgPlayer
                  puzzle="sq1"
                  set="pbl"
                  alg={selectedSolution.algorithm}
                  setup={result.setup}
                  size={270}
                />
              </div>
              <div className={styles.selectedDetails}>
                <h4>{tr({ zh: '所选公式', en: 'Selected algorithm' })}</h4>
                <div className={styles.selectedAlgorithmRow}>
                  <code>{selectedSolution.algorithm}</code>
                  <button
                    type="button"
                    className={styles.copyButton}
                    onClick={() => copySolution(selectedSolution.algorithm)}
                    title={solutionCopied
                      ? tr({ zh: '已复制', en: 'Copied' })
                      : tr({ zh: '复制公式', en: 'Copy algorithm' })}
                    aria-label={solutionCopied
                      ? tr({ zh: '公式已复制', en: 'Algorithm copied' })
                      : tr({ zh: '复制所选公式', en: 'Copy selected algorithm' })}
                  >
                    {solutionCopied ? <Check size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}
                  </button>
                  <span className={styles.srOnly} aria-live="polite">
                    {solutionCopied ? tr({ zh: '公式已复制', en: 'Algorithm copied' }) : ''}
                  </span>
                </div>
                <p>{tr({ zh: `辅助公式：${selectedSolution.auxiliary.join(' + ')}`, en: `Auxiliary algorithms: ${selectedSolution.auxiliary.join(' + ')}` })}</p>
              </div>
            </div>
          )}
        </section>
      )}
    </section>
  );
}

export default function Sq1PblWorkspace() {
  const [view, setView] = useQueryState(
    'view',
    parseAsStringEnum<WorkspaceView>(['document', 'finder'])
      .withDefault('document')
      .withOptions({ history: 'push', scroll: false }),
  );

  return (
    <div className={styles.workspace}>
      <div className={styles.workspaceMode}>
        <PillToggle
          value={view === 'finder'}
          offLabel={tr({ zh: 'PBL 文档', en: 'PBL document' })}
          onLabel={tr({ zh: '公式查找', en: 'Algorithm finder' })}
          ariaLabel={tr({ zh: '切换 PBL 文档或公式查找器', en: 'Switch between the PBL document and algorithm finder' })}
          onChange={finder => void setView(finder ? 'finder' : 'document')}
        />
      </div>
      {view === 'document' ? <DocumentExplorer /> : <FinderWorkspace />}
    </div>
  );
}

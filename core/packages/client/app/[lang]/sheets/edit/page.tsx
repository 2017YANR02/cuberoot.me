'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { parseAsString, useQueryState } from 'nuqs';
import { AlignCenter, AlignLeft, AlignRight, Bold, CheckSquare, ChevronLeft, ClipboardPaste, Copy, Download, FileDown, Grid2x2, Italic, Link2, Merge, PaintBucket, Palette, Plus, Printer, Redo2, Scissors, Search, Share2, Strikethrough, Trash2, Undo2, WrapText } from 'lucide-react';
import { HocuspocusProvider } from '@hocuspocus/provider';
import * as Y from 'yjs';
import AppLink from '@/components/AppLink';
import { CollaborativeSharePanel } from '@/components/collaboration/CollaborativeSharePanel';
import WcaAuth from '@/components/WcaAuth';
import { T, tr } from '@/i18n/tr';
import { usePanelClamp } from '@/hooks/usePanelClamp';
import { websocketApiUrl } from '@/lib/api-base';
import { getSessionToken, getWcaToken, useAuthUser } from '@/lib/auth-store';
import { fetchDocument, updateDocumentTitle, type DocumentDetails } from '@/lib/document-api';
import { buildSpreadsheetPdf, exportSpreadsheetCsv, exportSpreadsheetPdf, exportSpreadsheetXlsx } from '@/lib/spreadsheet-export';
import { calculateSpreadsheetFormulas, rewriteFormulasForSheetRename, rewriteFormulasForStructure } from '@/lib/spreadsheet-formulas';
import {
  cellAddress, columnLabel, containingMerge, formatSpreadsheetCellValue, normalizedRange,
  parseCellAddress, parseClipboardTable, parseSerializedRange, rangeAddresses,
  rangesIntersect, serializeRange, shiftAddressRecord, shiftSerializedRanges,
  sortSpreadsheetRangeRows, type CellFontFamily, type CellNumberFormat,
  type CellRange, type CellStyle, type CellValidation, type ConditionalFormatRule, type SpreadsheetSheet,
} from '@/lib/spreadsheet-model';
import { repairSpreadsheetSheets } from '@/lib/spreadsheet-yjs';
import './spreadsheet.css';

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';
type SheetMap = Y.Map<unknown>;
type EditorSession = { ydoc: Y.Doc; provider: HocuspocusProvider; undo: Y.UndoManager };
const ROW_HEIGHT = 25;
const HEADER_HEIGHT = 26;
const ROW_HEADER_WIDTH = 46;
const DEFAULT_COLUMN_WIDTH = 100;

function mapValue<T>(sheet: SheetMap, key: string): T { return sheet.get(key) as T; }
function cellsMap(sheet: SheetMap): Y.Map<string> { return mapValue(sheet, 'cells'); }
function stylesMap(sheet: SheetMap): Y.Map<CellStyle> { return mapValue(sheet, 'styles'); }
function widthsMap(sheet: SheetMap): Y.Map<number> { return mapValue(sheet, 'widths'); }
function optionalMap<T>(sheet: SheetMap, key: string): Y.Map<T> | null { const value = sheet.get(key); return value instanceof Y.Map ? value as Y.Map<T> : null; }
function ensureMap<T>(sheet: SheetMap, key: string): Y.Map<T> { const existing = optionalMap<T>(sheet, key); if (existing) return existing; const value = new Y.Map<T>(); sheet.set(key, value); return value; }
function replaceMap<T>(map: Y.Map<T>, values: Record<string, T>) { map.clear(); for (const [key, value] of Object.entries(values)) map.set(key, value); }
function mergeKeys(sheet: SheetMap): string[] { return Array.from(optionalMap<boolean>(sheet, 'merges')?.keys() || []); }
function shiftColumnWidths(widths: Record<string, number>, index: number, mode: 'insert' | 'delete', limit: number): Record<string, number> {
  const output: Record<string, number> = {};
  for (const [key, value] of Object.entries(widths)) {
    const column = Number(key); if (!Number.isInteger(column)) continue;
    if (mode === 'delete' && column === index) continue;
    const next = mode === 'insert' ? column >= index ? column + 1 : column : column > index ? column - 1 : column;
    if (next >= 0 && next < limit) output[String(next)] = value;
  }
  return output;
}

function snapshot(sheet: SheetMap): SpreadsheetSheet {
  return {
    id: String(sheet.get('id')),
    name: String(sheet.get('name')),
    rowCount: Number(sheet.get('rowCount')) || 100,
    columnCount: Number(sheet.get('columnCount')) || 26,
    cells: cellsMap(sheet).toJSON(), styles: stylesMap(sheet).toJSON(), widths: widthsMap(sheet).toJSON(),
    notes: optionalMap<string>(sheet, 'notes')?.toJSON() || {}, links: optionalMap<string>(sheet, 'links')?.toJSON() || {},
    validations: optionalMap<CellValidation>(sheet, 'validations')?.toJSON() || {}, merges: mergeKeys(sheet),
    conditionalRules: Object.values(optionalMap<ConditionalFormatRule>(sheet, 'conditionalRules')?.toJSON() || {}),
    frozenRows: Number(sheet.get('frozenRows')) || 0, frozenColumns: Number(sheet.get('frozenColumns')) || 0,
  };
}

function newSheet(name: string): SheetMap {
  const sheet = new Y.Map<unknown>();
  sheet.set('id', crypto.randomUUID()); sheet.set('name', name); sheet.set('rowCount', 100); sheet.set('columnCount', 26);
  sheet.set('cells', new Y.Map<string>()); sheet.set('styles', new Y.Map<CellStyle>()); sheet.set('widths', new Y.Map<number>());
  sheet.set('notes', new Y.Map<string>()); sheet.set('links', new Y.Map<string>()); sheet.set('validations', new Y.Map<CellValidation>());
  sheet.set('merges', new Y.Map<boolean>()); sheet.set('conditionalRules', new Y.Map<ConditionalFormatRule>());
  sheet.set('frozenRows', 0); sheet.set('frozenColumns', 0);
  return sheet;
}

function ToolbarButton({ active, disabled, label, onClick, children }: { active?: boolean; disabled?: boolean; label: string; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" className={`sheet-tool${active ? ' is-active' : ''}`} aria-label={label} title={label} aria-pressed={active} disabled={disabled} onClick={onClick}>{children}</button>;
}

function SheetMenu({ label, open, hiddenOnMobile, onToggle, children }: {
  label: string; open: boolean; hiddenOnMobile?: boolean; onToggle: () => void; children: React.ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  usePanelClamp(open, panelRef);
  return <div className={`sheet-menu${hiddenOnMobile ? ' is-secondary' : ''}`}>
    <button type="button" className="sheet-menu-trigger" aria-expanded={open} onClick={onToggle}>{label}</button>
    {open && <div ref={panelRef} className="sheet-menu-panel">{children}</div>}
  </div>;
}

function SheetMenuItem({ disabled, onClick, children }: { disabled?: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" className="sheet-menu-item" disabled={disabled} onClick={onClick}>{children}</button>;
}

function SheetMenuLink({ href, children }: { href: string; children: React.ReactNode }) {
  return <AppLink href={href} prefetch={false} className="sheet-menu-item">{children}</AppLink>;
}

interface ClipboardPayload {
  cells: string[][];
  values: string[][];
  styles: CellStyle[][];
  notes: Array<Array<string | undefined>>;
  links: Array<Array<string | undefined>>;
  validations: Array<Array<CellValidation | undefined>>;
}

function SpreadsheetGrid({ session, readOnly, activeSheetId, onActiveSheet, onError, onFormulaError, onExport, onPrint }: {
  session: EditorSession; readOnly: boolean; activeSheetId: string; onActiveSheet: (id: string) => void;
  onError: (message: string) => void; onFormulaError: (message: string) => void;
  onExport: (format: 'xlsx' | 'csv' | 'pdf') => void; onPrint: () => void;
}) {
  const user = useAuthUser();
  const [version, setVersion] = useState(0);
  const [selection, setSelection] = useState<CellRange>({ start: { row: 0, column: 0 }, end: { row: 0, column: 0 } });
  const [dragging, setDragging] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(600);
  const [zoom, setZoom] = useState(100);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [showGridlines, setShowGridlines] = useState(true);
  const [showFormulaBar, setShowFormulaBar] = useState(true);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [filter, setFilter] = useState<{ range: CellRange; column: number; query: string } | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const menuBarRef = useRef<HTMLDivElement>(null);
  const clipboardRef = useRef<ClipboardPayload | null>(null);
  const ySheets = session.ydoc.getArray<SheetMap>('sheets');
  useEffect(() => {
    const update = () => setVersion((value) => value + 1);
    ySheets.observeDeep(update);
    return () => ySheets.unobserveDeep(update);
  }, [ySheets]);
  const sheets = useMemo(() => ySheets.toArray(), [version, ySheets]);
  const snapshots = useMemo(() => sheets.map(snapshot), [sheets]);
  const activeIndex = Math.max(0, sheets.findIndex((sheet) => String(sheet.get('id')) === activeSheetId));
  const active = sheets[activeIndex];
  const data = snapshots[activeIndex];
  useEffect(() => { if (sheets.length && !activeSheetId) onActiveSheet(String(sheets[0].get('id'))); }, [activeSheetId, onActiveSheet, sheets]);

  const calculated = useMemo(() => calculateSpreadsheetFormulas(snapshots), [snapshots]);
  useEffect(() => { onFormulaError(calculated.error); }, [calculated.error, onFormulaError]);

  const focus = selection.end;
  const focusAddress = cellAddress(focus.row, focus.column);
  const focusRaw = data?.cells[focusAddress] || '';
  const selectedStyle = data?.styles[focusAddress] || {};
  useEffect(() => { if (!editing) setDraft(focusRaw); }, [editing, focusRaw]);
  useEffect(() => {
    session.provider.awareness?.setLocalStateField('user', { name: user?.name || user?.wcaId || tr({ zh: '协作者', en: 'Collaborator' }), color: 'var(--primary)' });
    session.provider.awareness?.setLocalStateField('spreadsheet', { sheetId: data?.id, range: normalizedRange(selection) });
  }, [data?.id, selection, session.provider, user?.name, user?.wcaId]);
  useEffect(() => {
    const resize = () => setViewportHeight(gridRef.current?.clientHeight || 600);
    resize(); window.addEventListener('resize', resize); return () => window.removeEventListener('resize', resize);
  }, []);
  useEffect(() => {
    const up = () => setDragging(false); window.addEventListener('pointerup', up); return () => window.removeEventListener('pointerup', up);
  }, []);
  useEffect(() => {
    if (!openMenu) return;
    const close = (event: PointerEvent) => { if (!menuBarRef.current?.contains(event.target as Node)) setOpenMenu(null); };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpenMenu(null); };
    window.addEventListener('pointerdown', close); window.addEventListener('keydown', escape);
    return () => { window.removeEventListener('pointerdown', close); window.removeEventListener('keydown', escape); };
  }, [openMenu]);
  useEffect(() => { setFilter(null); }, [data?.id]);
  if (!active || !data) return <p className="sheet-loading"><T zh="正在准备表格…" en="Preparing spreadsheet…" /></p>;

  const rowOrder = Array.from({ length: data.rowCount }, (_, row) => row).filter((row) => {
    if (!filter) return true;
    const area = normalizedRange(filter.range);
    if (row < area.start.row || row > area.end.row || row === area.start.row) return true;
    const address = cellAddress(row, filter.column);
    const raw = data.cells[address] || '';
    const value = raw.startsWith('=') ? calculated.values[data.id]?.[address] : raw;
    return String(value ?? '').toLocaleLowerCase().includes(filter.query.toLocaleLowerCase());
  });
  const rowDisplayIndex = new Map(rowOrder.map((row, index) => [row, index]));

  const commit = (raw = draft, point = focus) => {
    if (readOnly) return;
    const address = cellAddress(point.row, point.column);
    session.ydoc.transact(() => raw ? cellsMap(active).set(address, raw.slice(0, 50_000)) : cellsMap(active).delete(address));
    setEditing(false);
  };
  const move = (rowDelta: number, columnDelta: number, extend = false) => {
    const currentDisplayRow = rowDisplayIndex.get(focus.row) ?? 0;
    const nextDisplayRow = Math.min(rowOrder.length - 1, Math.max(0, currentDisplayRow + rowDelta));
    const next = { row: rowOrder[nextDisplayRow] ?? focus.row, column: Math.min(data.columnCount - 1, Math.max(0, focus.column + columnDelta)) };
    setSelection((current) => extend ? { ...current, end: next } : { start: next, end: next });
  };
  const paste = (text: string) => {
    if (readOnly) return;
    const table = parseClipboardTable(text);
    session.ydoc.transact(() => table.forEach((rowValues, rowOffset) => rowValues.forEach((value, columnOffset) => {
      const row = focus.row + rowOffset; const column = focus.column + columnOffset;
      if (row >= data.rowCount || column >= data.columnCount) return;
      const address = cellAddress(row, column); if (value) cellsMap(active).set(address, value.slice(0, 50_000)); else cellsMap(active).delete(address);
    })));
    setSelection({ start: focus, end: { row: Math.min(data.rowCount - 1, focus.row + table.length - 1), column: Math.min(data.columnCount - 1, focus.column + Math.max(0, ...table.map((row) => row.length - 1))) } });
  };
  const copySelection = async (cut = false) => {
    const selected = normalizedRange(selection);
    const payload: ClipboardPayload = { cells: [], values: [], styles: [], notes: [], links: [], validations: [] };
    for (let row = selected.start.row; row <= selected.end.row; row += 1) {
      const rawRow: string[] = []; const valueRow: string[] = []; const styleRow: CellStyle[] = [];
      const noteRow: Array<string | undefined> = []; const linkRow: Array<string | undefined> = []; const validationRow: Array<CellValidation | undefined> = [];
      for (let column = selected.start.column; column <= selected.end.column; column += 1) {
        const address = cellAddress(row, column); const raw = data.cells[address] || ''; const style = data.styles[address] || {};
        rawRow.push(raw); styleRow.push(style);
        const calculatedValue = calculated.values[data.id]?.[address];
        valueRow.push(raw.startsWith('=') ? calculatedValue === null || calculatedValue === undefined ? '' : String(calculatedValue) : raw);
        noteRow.push(data.notes?.[address]); linkRow.push(data.links?.[address]); validationRow.push(data.validations?.[address]);
      }
      payload.cells.push(rawRow); payload.values.push(valueRow); payload.styles.push(styleRow);
      payload.notes.push(noteRow); payload.links.push(linkRow); payload.validations.push(validationRow);
    }
    clipboardRef.current = payload;
    try { await navigator.clipboard.writeText(payload.values.map((row) => row.join('\t')).join('\n')); }
    catch { onError(tr({ zh: '浏览器未允许访问剪贴板，请使用 Ctrl/Cmd+C。', en: 'Clipboard access was denied. Use Ctrl/Cmd+C.' })); }
    if (cut && !readOnly) {
      session.ydoc.transact(() => rangeAddresses(selection).forEach((address) => {
        cellsMap(active).delete(address); stylesMap(active).delete(address);
        optionalMap<string>(active, 'notes')?.delete(address); optionalMap<string>(active, 'links')?.delete(address);
        optionalMap<CellValidation>(active, 'validations')?.delete(address);
      }));
    }
  };
  const pastePayload = async (mode: 'all' | 'values' | 'format') => {
    if (readOnly) return;
    let payload = clipboardRef.current;
    if (!payload && mode !== 'format') {
      try {
        const cells = parseClipboardTable(await navigator.clipboard.readText());
        payload = {
          cells, values: cells, styles: cells.map((row) => row.map(() => ({}))),
          notes: cells.map((row) => row.map(() => undefined)), links: cells.map((row) => row.map(() => undefined)),
          validations: cells.map((row) => row.map(() => undefined)),
        };
      } catch {
        onError(tr({ zh: '浏览器未允许读取剪贴板，请使用 Ctrl/Cmd+V。', en: 'Clipboard access was denied. Use Ctrl/Cmd+V.' }));
        return;
      }
    }
    if (!payload) return;
    const source = mode === 'values' ? payload.values : payload.cells;
    session.ydoc.transact(() => source.forEach((rowValues, rowOffset) => rowValues.forEach((value, columnOffset) => {
      const row = focus.row + rowOffset; const column = focus.column + columnOffset;
      if (row >= data.rowCount || column >= data.columnCount) return;
      const address = cellAddress(row, column);
      if (mode !== 'format') {
        if (value) cellsMap(active).set(address, value.slice(0, 50_000)); else cellsMap(active).delete(address);
      }
      if (mode !== 'values') {
        const style = payload?.styles[rowOffset]?.[columnOffset] || {};
        if (Object.keys(style).length) stylesMap(active).set(address, style); else stylesMap(active).delete(address);
      }
      if (mode === 'all') {
        const note = payload?.notes[rowOffset]?.[columnOffset]; const link = payload?.links[rowOffset]?.[columnOffset];
        const validation = payload?.validations[rowOffset]?.[columnOffset];
        if (note) ensureMap<string>(active, 'notes').set(address, note); else optionalMap<string>(active, 'notes')?.delete(address);
        if (link) ensureMap<string>(active, 'links').set(address, link); else optionalMap<string>(active, 'links')?.delete(address);
        if (validation) ensureMap<CellValidation>(active, 'validations').set(address, validation); else optionalMap<CellValidation>(active, 'validations')?.delete(address);
      }
    })));
    setSelection({ start: focus, end: {
      row: Math.min(data.rowCount - 1, focus.row + source.length - 1),
      column: Math.min(data.columnCount - 1, focus.column + Math.max(0, ...source.map((row) => row.length - 1))),
    } });
  };
  const patchStyle = (patch: Partial<CellStyle>) => {
    if (readOnly) return;
    session.ydoc.transact(() => rangeAddresses(selection).forEach((address) => {
      const current = stylesMap(active).get(address) || {};
      const next = { ...current, ...patch };
      for (const [key, value] of Object.entries(next)) {
        if (value === false || value === undefined || value === '') delete next[key as keyof CellStyle];
      }
      if (Object.keys(next).length === 0) stylesMap(active).delete(address); else stylesMap(active).set(address, next);
    }));
  };
  const deleteSelection = () => { if (!readOnly) session.ydoc.transact(() => rangeAddresses(selection).forEach((address) => cellsMap(active).delete(address))); };
  const clearFormatting = () => { if (!readOnly) session.ydoc.transact(() => rangeAddresses(selection).forEach((address) => stylesMap(active).delete(address))); };
  const findAndReplace = () => {
    const query = window.prompt(tr({ zh: '查找内容', en: 'Find' }), '');
    if (!query) return;
    const replacement = window.prompt(tr({ zh: '替换为（取消则只查找）', en: 'Replace with (cancel to find only)' }), '');
    const matches = Object.entries(data.cells).filter(([, value]) => value.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
    if (!matches.length) { onError(tr({ zh: '没有找到匹配内容。', en: 'No matches found.' })); return; }
    if (replacement === null || readOnly) {
      const point = parseCellAddress(matches[0][0]);
      if (point) setSelection({ start: point, end: point });
      onError('');
      return;
    }
    const pattern = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    session.ydoc.transact(() => matches.forEach(([address, value]) => cellsMap(active).set(address, value.replace(pattern, replacement).slice(0, 50_000))));
    onError(tr({ zh: `已替换 ${matches.length} 个单元格。`, en: `Replaced ${matches.length} cells.` }));
  };
  const keyboard = (event: React.KeyboardEvent) => {
    if (editing) return;
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'c') { event.preventDefault(); void copySelection(); return; }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'x') { event.preventDefault(); void copySelection(true); return; }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'h') { event.preventDefault(); findAndReplace(); return; }
    if ((event.ctrlKey || event.metaKey) && event.key === '\\' && !readOnly) { event.preventDefault(); clearFormatting(); return; }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); event.shiftKey ? session.undo.redo() : session.undo.undo(); return; }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') { event.preventDefault(); session.undo.redo(); return; }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'b' && !readOnly) { event.preventDefault(); patchStyle({ bold: !selectedStyle.bold }); return; }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'i' && !readOnly) { event.preventDefault(); patchStyle({ italic: !selectedStyle.italic }); return; }
    if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); deleteSelection(); return; }
    const directions: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1], Tab: [0, event.shiftKey ? -1 : 1], Enter: [event.shiftKey ? -1 : 1, 0] };
    if (directions[event.key]) { event.preventDefault(); move(...directions[event.key], event.shiftKey && event.key.startsWith('Arrow')); return; }
    if (!readOnly && event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) { setDraft(event.key); setEditing(true); }
  };
  const addSheet = () => {
    if (readOnly || ySheets.length >= 50) return;
    let suffix = ySheets.length + 1;
    let name = tr({ zh: `工作表 ${suffix}`, en: `Sheet ${suffix}` });
    while (snapshots.some((sheet) => sheet.name.toLocaleLowerCase() === name.toLocaleLowerCase())) {
      suffix += 1;
      name = tr({ zh: `工作表 ${suffix}`, en: `Sheet ${suffix}` });
    }
    session.ydoc.transact(() => ySheets.push([newSheet(name)]));
    onActiveSheet(String(ySheets.get(ySheets.length - 1).get('id')));
  };
  const renameSheet = (sheetId: string) => {
    if (readOnly) return;
    const target = sheets.find((sheet) => String(sheet.get('id')) === sheetId);
    if (!target) return;
    const oldName = String(target.get('name'));
    const name = window.prompt(tr({ zh: '工作表名称', en: 'Sheet name' }), oldName)?.replace(/[\\/?*\[\]:]/g, '').trim().slice(0, 100);
    if (!name || name === oldName) return;
    if (snapshots.some((sheet) => sheet.id !== sheetId && sheet.name.toLocaleLowerCase() === name.toLocaleLowerCase())) {
      onError(tr({ zh: '工作表名称不能重复。', en: 'Sheet names must be unique.' }));
      return;
    }
    let formulaPatches: Record<string, Record<string, string>>;
    try { formulaPatches = rewriteFormulasForSheetRename(snapshots, oldName, name); }
    catch (cause) { onError(cause instanceof Error ? cause.message : tr({ zh: '工作表重命名失败。', en: 'Could not rename sheet.' })); return; }
    session.ydoc.transact(() => {
      for (const sheet of sheets) {
        const patches = formulaPatches[String(sheet.get('id'))];
        if (!patches) continue;
        for (const [address, formula] of Object.entries(patches)) cellsMap(sheet).set(address, formula);
      }
      target.set('name', name);
    });
    onActiveSheet(sheetId);
  };
  const removeSheet = () => {
    if (readOnly || ySheets.length <= 1 || !window.confirm(tr({ zh: `删除“${data.name}”？此操作可通过撤销恢复。`, en: `Delete “${data.name}”? You can restore it with Undo.` }))) return;
    session.ydoc.transact(() => ySheets.delete(activeIndex, 1)); onActiveSheet(String(ySheets.get(Math.max(0, activeIndex - 1)).get('id')));
  };
  const changeDimension = (axis: 'row' | 'column', delta: 1 | -1) => {
    if (readOnly) return;
    const key = axis === 'row' ? 'rowCount' : 'columnCount'; const current = Number(active.get(key));
    const minimum = axis === 'row' ? 20 : 10; const maximum = axis === 'row' ? 10_000 : 200;
    const next = Math.min(maximum, Math.max(minimum, current + delta * (axis === 'row' ? 20 : 5)));
    session.ydoc.transact(() => active.set(key, next));
  };
  const runMenu = (action: () => void) => { setOpenMenu(null); action(); };
  const applyNumberFormat = (numberFormat: CellNumberFormat) => patchStyle({ numberFormat: numberFormat === 'general' ? undefined : numberFormat });
  const adjustDecimals = (delta: 1 | -1) => {
    const format = selectedStyle.numberFormat || 'number';
    const fallback = format === 'currency' ? 2 : format === 'percent' ? 0 : 2;
    patchStyle({ numberFormat: format, decimals: Math.min(10, Math.max(0, (selectedStyle.decimals ?? fallback) + delta)) });
  };
  const sortSelection = (direction: 'asc' | 'desc') => {
    if (readOnly) return;
    try {
      const sorted = sortSpreadsheetRangeRows(data.cells, data.styles, selection, direction, tr({ zh: 'zh-CN', en: 'en-US' }));
      session.ydoc.transact(() => rangeAddresses(selection).forEach((address) => {
        if (sorted.cells[address]) cellsMap(active).set(address, sorted.cells[address]); else cellsMap(active).delete(address);
        if (sorted.styles[address]) stylesMap(active).set(address, sorted.styles[address]); else stylesMap(active).delete(address);
      }));
      onError('');
    } catch {
      onError(tr({ zh: '所选范围含公式，暂不能排序。请只选择普通数据。', en: 'The selected range contains formulas. Select plain data before sorting.' }));
    }
  };
  const trimSelection = () => {
    if (readOnly) return;
    session.ydoc.transact(() => rangeAddresses(selection).forEach((address) => {
      const raw = cellsMap(active).get(address);
      if (!raw || raw.startsWith('=')) return;
      const trimmed = raw.trim(); if (trimmed) cellsMap(active).set(address, trimmed); else cellsMap(active).delete(address);
    }));
  };
  const editStructure = (axis: 'row' | 'column', index: number, mode: 'insert' | 'delete') => {
    if (readOnly) return;
    const countKey = axis === 'row' ? 'rowCount' : 'columnCount';
    const currentCount = Number(active.get(countKey));
    const minimum = axis === 'row' ? 20 : 10; const maximum = axis === 'row' ? 10_000 : 200;
    if ((mode === 'delete' && currentCount <= minimum) || (mode === 'insert' && currentCount >= maximum)) {
      onError(tr({ zh: '已经达到工作表尺寸限制。', en: 'The worksheet size limit has been reached.' })); return;
    }
    const nextCount = currentCount + (mode === 'insert' ? 1 : -1);
    try {
      const formulaPatches = rewriteFormulasForStructure(snapshots, data.id, axis, index, mode);
      session.ydoc.transact(() => {
        for (const sheet of sheets) {
          const sheetId = String(sheet.get('id'));
          const isTarget = sheetId === data.id;
          const existingCells = cellsMap(sheet).toJSON();
          const nextCells = isTarget ? shiftAddressRecord(existingCells, axis, index, mode, nextCount) : { ...existingCells };
          for (const [address, value] of Object.entries(nextCells)) if (value.startsWith('=')) delete nextCells[address];
          Object.assign(nextCells, formulaPatches[sheetId] || {});
          replaceMap(cellsMap(sheet), nextCells);
          if (!isTarget) continue;
          replaceMap(stylesMap(sheet), shiftAddressRecord(stylesMap(sheet).toJSON(), axis, index, mode, nextCount));
          replaceMap(ensureMap<string>(sheet, 'notes'), shiftAddressRecord(optionalMap<string>(sheet, 'notes')?.toJSON() || {}, axis, index, mode, nextCount));
          replaceMap(ensureMap<string>(sheet, 'links'), shiftAddressRecord(optionalMap<string>(sheet, 'links')?.toJSON() || {}, axis, index, mode, nextCount));
          replaceMap(ensureMap<CellValidation>(sheet, 'validations'), shiftAddressRecord(optionalMap<CellValidation>(sheet, 'validations')?.toJSON() || {}, axis, index, mode, nextCount));
          const shiftedMerges = shiftSerializedRanges(mergeKeys(sheet), axis, index, mode, nextCount);
          replaceMap(ensureMap<boolean>(sheet, 'merges'), Object.fromEntries(shiftedMerges.map((key) => [key, true])));
          const rules = optionalMap<ConditionalFormatRule>(sheet, 'conditionalRules')?.toJSON() || {};
          const shiftedRules: Record<string, ConditionalFormatRule> = {};
          for (const rule of Object.values(rules)) {
            const [rangeValue] = shiftSerializedRanges([rule.range], axis, index, mode, nextCount);
            if (rangeValue) shiftedRules[rule.id] = { ...rule, range: rangeValue };
          }
          replaceMap(ensureMap<ConditionalFormatRule>(sheet, 'conditionalRules'), shiftedRules);
          if (axis === 'column') replaceMap(widthsMap(sheet), shiftColumnWidths(widthsMap(sheet).toJSON(), index, mode, nextCount));
          sheet.set(countKey, nextCount);
        }
      });
      const nextPoint = axis === 'row'
        ? { row: Math.min(nextCount - 1, index), column: focus.column }
        : { row: focus.row, column: Math.min(nextCount - 1, index) };
      setSelection({ start: nextPoint, end: nextPoint }); setFilter(null); onError('');
    } catch (cause) { onError(cause instanceof Error ? cause.message : tr({ zh: '无法修改工作表结构。', en: 'Could not change the worksheet structure.' })); }
  };
  const mergeSelection = () => {
    if (readOnly) return;
    const selected = normalizedRange(selection); const key = serializeRange(selected);
    const existing = data.merges || [];
    const current = containingMerge(existing, focus);
    if (current) { session.ydoc.transact(() => ensureMap<boolean>(active, 'merges').delete(serializeRange(current))); return; }
    if (selected.start.row === selected.end.row && selected.start.column === selected.end.column) return;
    if (existing.some((value) => { const parsed = parseSerializedRange(value); return parsed ? rangesIntersect(selected, parsed) : false; })) {
      onError(tr({ zh: '所选范围与现有合并单元格重叠。', en: 'The selection overlaps an existing merged cell.' })); return;
    }
    const addresses = rangeAddresses(selected);
    const discarded = addresses.slice(1).some((address) => Boolean(data.cells[address]));
    if (discarded && !window.confirm(tr({ zh: '合并后只保留左上角内容，继续吗？', en: 'Only the top-left value is kept when merging. Continue?' }))) return;
    session.ydoc.transact(() => {
      ensureMap<boolean>(active, 'merges').set(key, true);
      addresses.slice(1).forEach((address) => {
        cellsMap(active).delete(address); stylesMap(active).delete(address);
        ensureMap<string>(active, 'notes').delete(address); ensureMap<string>(active, 'links').delete(address);
        ensureMap<CellValidation>(active, 'validations').delete(address);
      });
    });
    setSelection(selected);
  };
  const insertNote = () => {
    if (readOnly) return; const current = data.notes?.[focusAddress] || '';
    const note = window.prompt(tr({ zh: '单元格备注', en: 'Cell note' }), current);
    if (note === null) return;
    session.ydoc.transact(() => note.trim() ? ensureMap<string>(active, 'notes').set(focusAddress, note.trim().slice(0, 5_000)) : ensureMap<string>(active, 'notes').delete(focusAddress));
  };
  const insertLink = () => {
    if (readOnly) return; const url = window.prompt(tr({ zh: '链接地址', en: 'Link URL' }), data.links?.[focusAddress] || 'https://');
    if (url === null) return; const cleaned = url.trim();
    if (cleaned && !/^(https?:\/\/|mailto:)/i.test(cleaned)) { onError(tr({ zh: '链接必须以 http://、https:// 或 mailto: 开头。', en: 'Links must begin with http://, https://, or mailto:.' })); return; }
    session.ydoc.transact(() => {
      if (cleaned) ensureMap<string>(active, 'links').set(focusAddress, cleaned.slice(0, 2_000)); else ensureMap<string>(active, 'links').delete(focusAddress);
      if (cleaned && !cellsMap(active).get(focusAddress)) cellsMap(active).set(focusAddress, cleaned);
    });
  };
  const applyValidation = (type: 'checkbox' | 'dropdown' | 'clear') => {
    if (readOnly) return;
    let validation: CellValidation | null = null;
    if (type === 'checkbox') validation = { type: 'checkbox' };
    if (type === 'dropdown') {
      const value = window.prompt(tr({ zh: '下拉选项（用英文逗号分隔）', en: 'Dropdown options (comma-separated)' }), '');
      if (value === null) return; const options = value.split(',').map((item) => item.trim()).filter(Boolean).slice(0, 50);
      if (!options.length) { onError(tr({ zh: '请至少输入一个选项。', en: 'Enter at least one option.' })); return; }
      validation = { type: 'dropdown', options };
    }
    session.ydoc.transact(() => rangeAddresses(selection).forEach((address) => {
      if (validation) ensureMap<CellValidation>(active, 'validations').set(address, validation);
      else ensureMap<CellValidation>(active, 'validations').delete(address);
      if (type === 'checkbox' && !cellsMap(active).get(address)) cellsMap(active).set(address, 'false');
    }));
  };
  const createFilter = () => {
    const selected = normalizedRange(selection);
    const area = selected.start.row === selected.end.row
      ? { start: { row: 0, column: selected.start.column }, end: { row: data.rowCount - 1, column: selected.end.column } }
      : selected;
    const query = window.prompt(tr({ zh: `筛选 ${columnLabel(focus.column)} 列包含`, en: `Show rows where column ${columnLabel(focus.column)} contains` }), filter?.query || '');
    if (query === null) return; setFilter(query ? { range: area, column: focus.column, query } : null);
  };
  const splitTextToColumns = () => {
    if (readOnly) return; const delimiter = window.prompt(tr({ zh: '分隔符', en: 'Separator' }), ','); if (!delimiter) return;
    const selected = normalizedRange(selection);
    session.ydoc.transact(() => {
      for (let row = selected.start.row; row <= selected.end.row; row += 1) {
        const raw = data.cells[cellAddress(row, selected.start.column)] || ''; if (!raw || raw.startsWith('=')) continue;
        raw.split(delimiter).forEach((value, offset) => {
          const column = selected.start.column + offset; if (column >= data.columnCount) return;
          const address = cellAddress(row, column); const trimmed = value.trim();
          if (trimmed) cellsMap(active).set(address, trimmed); else cellsMap(active).delete(address);
        });
      }
    });
  };
  const removeDuplicates = () => {
    if (readOnly) return; const selected = normalizedRange(selection); const addresses = rangeAddresses(selected);
    if (addresses.some((address) => (data.cells[address] || '').startsWith('='))) { onError(tr({ zh: '所选范围含公式，不能移除重复项。', en: 'Formulas are not supported when removing duplicates.' })); return; }
    const rows = Array.from({ length: selected.end.row - selected.start.row + 1 }, (_, offset) => selected.start.row + offset);
    const uniqueRows: number[] = []; const seen = new Set<string>();
    for (const row of rows) {
      const key = Array.from({ length: selected.end.column - selected.start.column + 1 }, (_, offset) => data.cells[cellAddress(row, selected.start.column + offset)] || '').join('\u0000');
      if (!seen.has(key)) { seen.add(key); uniqueRows.push(row); }
    }
    session.ydoc.transact(() => {
      addresses.forEach((address) => { cellsMap(active).delete(address); stylesMap(active).delete(address); });
      uniqueRows.forEach((sourceRow, offset) => {
        for (let column = selected.start.column; column <= selected.end.column; column += 1) {
          const source = cellAddress(sourceRow, column); const destination = cellAddress(selected.start.row + offset, column);
          if (data.cells[source]) cellsMap(active).set(destination, data.cells[source]);
          if (data.styles[source]) stylesMap(active).set(destination, data.styles[source]);
        }
      });
    });
    onError(tr({ zh: `已移除 ${rows.length - uniqueRows.length} 个重复行。`, en: `Removed ${rows.length - uniqueRows.length} duplicate rows.` }));
  };
  const applyAlternatingColors = () => {
    if (readOnly) return; const selected = normalizedRange(selection);
    session.ydoc.transact(() => {
      for (let row = selected.start.row; row <= selected.end.row; row += 1) {
        for (let column = selected.start.column; column <= selected.end.column; column += 1) {
          const address = cellAddress(row, column); const current = stylesMap(active).get(address) || {};
          const next = { ...current, fill: (row - selected.start.row) % 2 ? 'var(--muted)' : undefined };
          if (!next.fill) delete next.fill;
          if (Object.keys(next).length) stylesMap(active).set(address, next); else stylesMap(active).delete(address);
        }
      }
    });
  };
  const addConditionalRule = () => {
    if (readOnly) return;
    const operator = window.prompt(tr({ zh: '条件：输入 >、< 或 contains', en: 'Condition: enter >, <, or contains' }), '>'); if (!operator) return;
    const value = window.prompt(tr({ zh: '比较值', en: 'Comparison value' }), ''); if (value === null) return;
    const type = operator === '>' ? 'greaterThan' : operator === '<' ? 'lessThan' : operator.toLocaleLowerCase() === 'contains' ? 'contains' : null;
    if (!type) { onError(tr({ zh: '条件只能是 >、< 或 contains。', en: 'The condition must be >, <, or contains.' })); return; }
    const id = crypto.randomUUID(); const rule: ConditionalFormatRule = { id, range: serializeRange(selection), type, value, fill: 'color-mix(in srgb, var(--signal-success) 22%, var(--background))' };
    session.ydoc.transact(() => ensureMap<ConditionalFormatRule>(active, 'conditionalRules').set(id, rule));
  };
  const clearConditionalRules = () => {
    if (readOnly) return;
    const selected = normalizedRange(selection); const rules = optionalMap<ConditionalFormatRule>(active, 'conditionalRules');
    if (!rules) return;
    session.ydoc.transact(() => rules.forEach((rule, id) => {
      const ruleRange = parseSerializedRange(rule.range);
      if (ruleRange && rangesIntersect(selected, ruleRange)) rules.delete(id);
    }));
  };
  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen(); else void document.documentElement.requestFullscreen();
  };
  const scale = zoom / 100;
  const rowHeight = Math.max(20, Math.round(ROW_HEIGHT * scale));
  const headerHeight = Math.max(22, Math.round(HEADER_HEIGHT * scale));
  const rowHeaderWidth = Math.max(38, Math.round(ROW_HEADER_WIDTH * scale));
  const widths = Array.from({ length: data.columnCount }, (_, index) => Math.round(Math.min(400, Math.max(48, data.widths[String(index)] || DEFAULT_COLUMN_WIDTH)) * scale));
  const offsets: number[] = [rowHeaderWidth]; widths.forEach((width, index) => { offsets[index + 1] = offsets[index] + width; });
  const totalWidth = offsets[data.columnCount];
  const firstDisplayRow = Math.max(0, Math.floor((scrollTop - headerHeight) / rowHeight) - 2);
  const lastDisplayRow = Math.min(rowOrder.length - 1, firstDisplayRow + Math.ceil(viewportHeight / rowHeight) + 5);
  const visibleRows = Array.from(new Set([
    ...rowOrder.slice(firstDisplayRow, lastDisplayRow + 1),
    ...Array.from({ length: data.frozenRows || 0 }, (_, row) => row),
  ])).filter((row) => rowDisplayIndex.has(row));
  const range = normalizedRange(selection);
  const currentMerge = containingMerge(data.merges, focus);
  const awareness = session.provider.awareness;
  const remoteSelections = Array.from(awareness?.getStates().entries() || [])
    .filter(([clientId, state]) => clientId !== awareness?.clientID && state.spreadsheet?.sheetId === data.id)
    .map(([, state]) => state.spreadsheet.range as CellRange).filter(Boolean);
  const selectionValues = rangeAddresses(selection).map((address) => {
    const raw = data.cells[address] || '';
    const value = raw.startsWith('=') ? calculated.values[data.id]?.[address] : raw;
    const text = value === null || value === undefined ? '' : String(value).trim();
    return { raw, numeric: typeof value === 'number' ? value : text ? Number(text) : Number.NaN };
  });
  const nonEmptyCount = selectionValues.filter(({ raw }) => raw !== '').length;
  const numericValues = selectionValues.map(({ numeric }) => numeric).filter(Number.isFinite);
  const selectionSum = numericValues.reduce((sum, value) => sum + value, 0);
  const conditionalFill = (row: number, column: number, display: string) => {
    for (const rule of data.conditionalRules || []) {
      const ruleRange = parseSerializedRange(rule.range); if (!ruleRange) continue;
      if (row < ruleRange.start.row || row > ruleRange.end.row || column < ruleRange.start.column || column > ruleRange.end.column) continue;
      const numeric = Number(display); const compared = Number(rule.value);
      if ((rule.type === 'greaterThan' && Number.isFinite(numeric) && numeric > compared)
        || (rule.type === 'lessThan' && Number.isFinite(numeric) && numeric < compared)
        || (rule.type === 'contains' && display.toLocaleLowerCase().includes(rule.value.toLocaleLowerCase()))) return rule.fill;
    }
    return undefined;
  };

  return <div className="sheet-editor-area">
    <div ref={menuBarRef} className="sheet-menu-bar">
      <SheetMenu label={tr({ zh: '文件', en: 'File' })} open={openMenu === 'file'} onToggle={() => setOpenMenu(openMenu === 'file' ? null : 'file')}>
        <SheetMenuLink href="/sheets"><T zh="打开表格列表" en="Open spreadsheet list" /></SheetMenuLink>
        <span className="sheet-menu-divider" />
        <SheetMenuItem onClick={() => runMenu(onPrint)}><T zh="打印" en="Print" /></SheetMenuItem>
        <span className="sheet-menu-divider" />
        <SheetMenuItem onClick={() => runMenu(() => onExport('xlsx'))}><T zh="导出 Excel" en="Export Excel" /></SheetMenuItem>
        <SheetMenuItem onClick={() => runMenu(() => onExport('csv'))}><T zh="导出 CSV" en="Export CSV" /></SheetMenuItem>
        <SheetMenuItem onClick={() => runMenu(() => onExport('pdf'))}><T zh="导出 PDF" en="Export PDF" /></SheetMenuItem>
      </SheetMenu>
      <SheetMenu label={tr({ zh: '编辑', en: 'Edit' })} open={openMenu === 'edit'} onToggle={() => setOpenMenu(openMenu === 'edit' ? null : 'edit')}>
        <SheetMenuItem disabled={readOnly} onClick={() => runMenu(() => session.undo.undo())}><T zh="撤销 Ctrl+Z" en="Undo Ctrl+Z" /></SheetMenuItem>
        <SheetMenuItem disabled={readOnly} onClick={() => runMenu(() => session.undo.redo())}><T zh="重做 Ctrl+Y" en="Redo Ctrl+Y" /></SheetMenuItem>
        <span className="sheet-menu-divider" />
        <SheetMenuItem disabled={readOnly} onClick={() => runMenu(() => { void copySelection(true); })}><T zh="剪切 Ctrl+X" en="Cut Ctrl+X" /></SheetMenuItem>
        <SheetMenuItem onClick={() => runMenu(() => { void copySelection(); })}><T zh="复制 Ctrl+C" en="Copy Ctrl+C" /></SheetMenuItem>
        <SheetMenuItem disabled={readOnly} onClick={() => runMenu(() => { void pastePayload('all'); })}><T zh="粘贴 Ctrl+V" en="Paste Ctrl+V" /></SheetMenuItem>
        <SheetMenuItem disabled={readOnly || !clipboardRef.current} onClick={() => runMenu(() => { void pastePayload('values'); })}><T zh="仅粘贴值" en="Paste values only" /></SheetMenuItem>
        <SheetMenuItem disabled={readOnly || !clipboardRef.current} onClick={() => runMenu(() => { void pastePayload('format'); })}><T zh="仅粘贴格式" en="Paste format only" /></SheetMenuItem>
        <span className="sheet-menu-divider" />
        <SheetMenuItem disabled={readOnly} onClick={() => runMenu(deleteSelection)}><T zh="清除所选内容" en="Clear selection" /></SheetMenuItem>
        <SheetMenuItem onClick={() => runMenu(findAndReplace)}><T zh="查找和替换 Ctrl+H" en="Find and replace Ctrl+H" /></SheetMenuItem>
      </SheetMenu>
      <SheetMenu label={tr({ zh: '查看', en: 'View' })} open={openMenu === 'view'} onToggle={() => setOpenMenu(openMenu === 'view' ? null : 'view')}>
        <SheetMenuItem onClick={() => runMenu(() => setShowFormulaBar((value) => !value))}>{showFormulaBar ? '✓ ' : ''}<T zh="公式栏" en="Formula bar" /></SheetMenuItem>
        <SheetMenuItem onClick={() => runMenu(() => setShowGridlines((value) => !value))}>{showGridlines ? '✓ ' : ''}<T zh="网格线" en="Gridlines" /></SheetMenuItem>
        <span className="sheet-menu-divider" />
        <SheetMenuItem disabled={readOnly} onClick={() => runMenu(() => session.ydoc.transact(() => active.set('frozenRows', data.frozenRows ? 0 : 1)))}>{data.frozenRows ? '✓ ' : ''}<T zh="冻结首行" en="Freeze first row" /></SheetMenuItem>
        <SheetMenuItem disabled={readOnly} onClick={() => runMenu(() => session.ydoc.transact(() => active.set('frozenColumns', data.frozenColumns ? 0 : 1)))}>{data.frozenColumns ? '✓ ' : ''}<T zh="冻结首列" en="Freeze first column" /></SheetMenuItem>
        <span className="sheet-menu-divider" />
        {[75, 90, 100, 110, 125].map((value) => <SheetMenuItem key={value} onClick={() => runMenu(() => setZoom(value))}>{value === zoom ? '✓ ' : ''}{value}%</SheetMenuItem>)}
        <SheetMenuItem onClick={() => runMenu(toggleFullscreen)}><T zh="全屏" en="Full screen" /></SheetMenuItem>
      </SheetMenu>
      <SheetMenu label={tr({ zh: '插入', en: 'Insert' })} open={openMenu === 'insert'} onToggle={() => setOpenMenu(openMenu === 'insert' ? null : 'insert')}>
        <SheetMenuItem disabled={readOnly} onClick={() => runMenu(() => editStructure('row', range.start.row, 'insert'))}><T zh="在上方插入行" en="Insert row above" /></SheetMenuItem>
        <SheetMenuItem disabled={readOnly} onClick={() => runMenu(() => editStructure('row', range.end.row + 1, 'insert'))}><T zh="在下方插入行" en="Insert row below" /></SheetMenuItem>
        <SheetMenuItem disabled={readOnly} onClick={() => runMenu(() => editStructure('column', range.start.column, 'insert'))}><T zh="在左侧插入列" en="Insert column left" /></SheetMenuItem>
        <SheetMenuItem disabled={readOnly} onClick={() => runMenu(() => editStructure('column', range.end.column + 1, 'insert'))}><T zh="在右侧插入列" en="Insert column right" /></SheetMenuItem>
        <span className="sheet-menu-divider" />
        <SheetMenuItem disabled={readOnly || ySheets.length >= 50} onClick={() => runMenu(addSheet)}><T zh="新工作表" en="New sheet" /></SheetMenuItem>
        <span className="sheet-menu-divider" />
        <SheetMenuItem disabled={readOnly} onClick={() => runMenu(() => applyValidation('checkbox'))}><T zh="复选框" en="Checkbox" /></SheetMenuItem>
        <SheetMenuItem disabled={readOnly} onClick={() => runMenu(() => applyValidation('dropdown'))}><T zh="下拉菜单" en="Dropdown" /></SheetMenuItem>
        <SheetMenuItem disabled={readOnly} onClick={() => runMenu(insertLink)}><T zh="链接" en="Link" /></SheetMenuItem>
        <SheetMenuItem disabled={readOnly} onClick={() => runMenu(insertNote)}><T zh="备注" en="Note" /></SheetMenuItem>
      </SheetMenu>
      <SheetMenu label={tr({ zh: '格式', en: 'Format' })} open={openMenu === 'format'} onToggle={() => setOpenMenu(openMenu === 'format' ? null : 'format')}>
        <SheetMenuItem disabled={readOnly} onClick={() => runMenu(() => patchStyle({ bold: !selectedStyle.bold }))}><T zh="粗体" en="Bold" /></SheetMenuItem>
        <SheetMenuItem disabled={readOnly} onClick={() => runMenu(() => patchStyle({ italic: !selectedStyle.italic }))}><T zh="斜体" en="Italic" /></SheetMenuItem>
        <SheetMenuItem disabled={readOnly} onClick={() => runMenu(() => patchStyle({ strikethrough: !selectedStyle.strikethrough }))}><T zh="删除线" en="Strikethrough" /></SheetMenuItem>
        <span className="sheet-menu-divider" />
        <SheetMenuItem disabled={readOnly} onClick={() => runMenu(() => applyNumberFormat('general'))}><T zh="自动格式" en="Automatic format" /></SheetMenuItem>
        <SheetMenuItem disabled={readOnly} onClick={() => runMenu(() => applyNumberFormat('currency'))}><T zh="货币" en="Currency" /></SheetMenuItem>
        <SheetMenuItem disabled={readOnly} onClick={() => runMenu(() => applyNumberFormat('percent'))}><T zh="百分比" en="Percent" /></SheetMenuItem>
        <span className="sheet-menu-divider" />
        <SheetMenuItem disabled={readOnly} onClick={() => runMenu(() => patchStyle({ align: 'left' }))}><T zh="左对齐" en="Align left" /></SheetMenuItem>
        <SheetMenuItem disabled={readOnly} onClick={() => runMenu(() => patchStyle({ align: 'center' }))}><T zh="水平居中" en="Align center" /></SheetMenuItem>
        <SheetMenuItem disabled={readOnly} onClick={() => runMenu(() => patchStyle({ align: 'right' }))}><T zh="右对齐" en="Align right" /></SheetMenuItem>
        <SheetMenuItem disabled={readOnly} onClick={() => runMenu(() => patchStyle({ verticalAlign: 'top' }))}><T zh="顶部对齐" en="Align top" /></SheetMenuItem>
        <SheetMenuItem disabled={readOnly} onClick={() => runMenu(() => patchStyle({ verticalAlign: 'middle' }))}><T zh="垂直居中" en="Align middle" /></SheetMenuItem>
        <SheetMenuItem disabled={readOnly} onClick={() => runMenu(() => patchStyle({ verticalAlign: 'bottom' }))}><T zh="底部对齐" en="Align bottom" /></SheetMenuItem>
        <SheetMenuItem disabled={readOnly} onClick={() => runMenu(() => patchStyle({ wrap: selectedStyle.wrap === 'wrap' ? 'overflow' : 'wrap' }))}>{selectedStyle.wrap === 'wrap' ? '✓ ' : ''}<T zh="自动换行" en="Wrap text" /></SheetMenuItem>
        <SheetMenuItem disabled={readOnly} onClick={() => runMenu(() => patchStyle({ rotation: selectedStyle.rotation === 45 ? 0 : 45 }))}><T zh="文字旋转 45°" en="Rotate text 45°" /></SheetMenuItem>
        <SheetMenuItem disabled={readOnly} onClick={() => runMenu(() => patchStyle({ border: !selectedStyle.border }))}>{selectedStyle.border ? '✓ ' : ''}<T zh="所有边框" en="All borders" /></SheetMenuItem>
        <SheetMenuItem disabled={readOnly} onClick={() => runMenu(mergeSelection)}>{currentMerge ? <T zh="取消合并单元格" en="Unmerge cells" /> : <T zh="合并单元格" en="Merge cells" />}</SheetMenuItem>
        <span className="sheet-menu-divider" />
        <SheetMenuItem disabled={readOnly} onClick={() => runMenu(applyAlternatingColors)}><T zh="交替颜色" en="Alternating colors" /></SheetMenuItem>
        <SheetMenuItem disabled={readOnly} onClick={() => runMenu(addConditionalRule)}><T zh="条件格式" en="Conditional formatting" /></SheetMenuItem>
        <SheetMenuItem disabled={readOnly || !data.conditionalRules?.length} onClick={() => runMenu(clearConditionalRules)}><T zh="清除所选范围的条件格式" en="Clear conditional formatting in selection" /></SheetMenuItem>
        <SheetMenuItem disabled={readOnly} onClick={() => runMenu(clearFormatting)}><T zh={'清除格式 Ctrl+\\'} en={'Clear formatting Ctrl+\\'} /></SheetMenuItem>
      </SheetMenu>
      <SheetMenu label={tr({ zh: '数据', en: 'Data' })} open={openMenu === 'data'} onToggle={() => setOpenMenu(openMenu === 'data' ? null : 'data')}>
        <SheetMenuItem disabled={readOnly} onClick={() => runMenu(() => sortSelection('asc'))}><T zh="按首列升序排列范围" en="Sort range by first column A–Z" /></SheetMenuItem>
        <SheetMenuItem disabled={readOnly} onClick={() => runMenu(() => sortSelection('desc'))}><T zh="按首列降序排列范围" en="Sort range by first column Z–A" /></SheetMenuItem>
        <SheetMenuItem onClick={() => runMenu(createFilter)}>{filter ? <T zh="修改筛选条件" en="Edit filter" /> : <T zh="创建筛选器" en="Create filter" />}</SheetMenuItem>
        <SheetMenuItem disabled={!filter} onClick={() => runMenu(() => setFilter(null))}><T zh="移除筛选器" en="Remove filter" /></SheetMenuItem>
        <span className="sheet-menu-divider" />
        <SheetMenuItem disabled={readOnly} onClick={() => runMenu(() => editStructure('row', focus.row, 'delete'))}><T zh="删除当前行" en="Delete current row" /></SheetMenuItem>
        <SheetMenuItem disabled={readOnly} onClick={() => runMenu(() => editStructure('column', focus.column, 'delete'))}><T zh="删除当前列" en="Delete current column" /></SheetMenuItem>
        <SheetMenuItem disabled={readOnly} onClick={() => runMenu(() => applyValidation('dropdown'))}><T zh="数据验证" en="Data validation" /></SheetMenuItem>
        <SheetMenuItem disabled={readOnly} onClick={() => runMenu(() => applyValidation('clear'))}><T zh="清除数据验证" en="Clear data validation" /></SheetMenuItem>
        <SheetMenuItem disabled={readOnly} onClick={() => runMenu(removeDuplicates)}><T zh="移除重复项" en="Remove duplicates" /></SheetMenuItem>
        <SheetMenuItem disabled={readOnly} onClick={() => runMenu(trimSelection)}><T zh="清除首尾空格" en="Trim whitespace" /></SheetMenuItem>
        <SheetMenuItem disabled={readOnly} onClick={() => runMenu(splitTextToColumns)}><T zh="将文本分列" en="Split text to columns" /></SheetMenuItem>
      </SheetMenu>
      <SheetMenu label={tr({ zh: '工具', en: 'Tools' })} open={openMenu === 'tools'} onToggle={() => setOpenMenu(openMenu === 'tools' ? null : 'tools')}>
        <SheetMenuItem onClick={() => runMenu(() => window.alert(tr({ zh: `所选范围：${nonEmptyCount} 个非空单元格，${numericValues.length} 个数值，合计 ${selectionSum}`, en: `Selection: ${nonEmptyCount} non-empty cells, ${numericValues.length} numbers, sum ${selectionSum}` })))}><T zh="所选范围统计" en="Selection summary" /></SheetMenuItem>
      </SheetMenu>
      <SheetMenu label={tr({ zh: '帮助', en: 'Help' })} open={openMenu === 'help'} onToggle={() => setOpenMenu(openMenu === 'help' ? null : 'help')}>
        <SheetMenuItem onClick={() => runMenu(() => window.alert(tr({ zh: '方向键移动；Shift+方向键扩选；Enter 下移；Tab 右移；Ctrl/Cmd+C/X/V 复制剪切粘贴；Ctrl/Cmd+B 粗体；Ctrl/Cmd+I 斜体；Ctrl/Cmd+H 查找替换；Delete 清空。', en: 'Arrow keys move; Shift+Arrow extends; Enter moves down; Tab moves right; Ctrl/Cmd+C/X/V copies, cuts, and pastes; Ctrl/Cmd+B bolds; Ctrl/Cmd+I italicizes; Ctrl/Cmd+H finds and replaces; Delete clears.' })))}><T zh="键盘快捷键" en="Keyboard shortcuts" /></SheetMenuItem>
      </SheetMenu>
    </div>
    <div className="sheet-toolbar">
      <ToolbarButton label={tr({ zh: '撤销', en: 'Undo' })} disabled={readOnly} onClick={() => session.undo.undo()}><Undo2 size={17} /></ToolbarButton>
      <ToolbarButton label={tr({ zh: '重做', en: 'Redo' })} disabled={readOnly} onClick={() => session.undo.redo()}><Redo2 size={17} /></ToolbarButton>
      <ToolbarButton label={tr({ zh: '剪切', en: 'Cut' })} disabled={readOnly} onClick={() => { void copySelection(true); }}><Scissors size={16} /></ToolbarButton>
      <ToolbarButton label={tr({ zh: '复制', en: 'Copy' })} onClick={() => { void copySelection(); }}><Copy size={16} /></ToolbarButton>
      <ToolbarButton label={tr({ zh: '粘贴', en: 'Paste' })} disabled={readOnly} onClick={() => { void pastePayload('all'); }}><ClipboardPaste size={16} /></ToolbarButton>
      <ToolbarButton label={tr({ zh: '查找和替换', en: 'Find and replace' })} onClick={findAndReplace}><Search size={16} /></ToolbarButton>
      <ToolbarButton label={tr({ zh: '打印', en: 'Print' })} onClick={onPrint}><Printer size={17} /></ToolbarButton><span className="sheet-tool-separator" />
      <select className="sheet-tool-select is-zoom" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} aria-label={tr({ zh: '缩放', en: 'Zoom' })}>{[75, 90, 100, 110, 125].map((value) => <option key={value} value={value}>{value}%</option>)}</select>
      <span className="sheet-tool-separator" />
      <ToolbarButton label={tr({ zh: '货币格式', en: 'Currency format' })} active={selectedStyle.numberFormat === 'currency'} disabled={readOnly} onClick={() => applyNumberFormat('currency')}><span className="sheet-symbol">¥</span></ToolbarButton>
      <ToolbarButton label={tr({ zh: '百分比格式', en: 'Percent format' })} active={selectedStyle.numberFormat === 'percent'} disabled={readOnly} onClick={() => applyNumberFormat('percent')}><span className="sheet-symbol">%</span></ToolbarButton>
      <ToolbarButton label={tr({ zh: '减少小数位', en: 'Decrease decimal places' })} disabled={readOnly} onClick={() => adjustDecimals(-1)}><span className="sheet-decimal-symbol">.0←</span></ToolbarButton>
      <ToolbarButton label={tr({ zh: '增加小数位', en: 'Increase decimal places' })} disabled={readOnly} onClick={() => adjustDecimals(1)}><span className="sheet-decimal-symbol">.00→</span></ToolbarButton>
      <select className="sheet-tool-select is-number" value={selectedStyle.numberFormat || 'general'} disabled={readOnly} onChange={(event) => applyNumberFormat(event.target.value as CellNumberFormat)} aria-label={tr({ zh: '数字格式', en: 'Number format' })}><option value="general"><T zh="自动" en="Automatic" /></option><option value="number"><T zh="数字" en="Number" /></option><option value="currency"><T zh="货币" en="Currency" /></option><option value="percent"><T zh="百分比" en="Percent" /></option></select>
      <span className="sheet-tool-separator" />
      <select className="sheet-tool-select is-font" value={selectedStyle.fontFamily || 'sans'} disabled={readOnly} onChange={(event) => patchStyle({ fontFamily: event.target.value as CellFontFamily })} aria-label={tr({ zh: '字体', en: 'Font' })}><option value="sans"><T zh="默认" en="Default" /></option><option value="serif"><T zh="衬线" en="Serif" /></option><option value="mono"><T zh="等宽" en="Monospace" /></option></select>
      <ToolbarButton label={tr({ zh: '减小字号', en: 'Decrease font size' })} disabled={readOnly} onClick={() => patchStyle({ fontSize: Math.max(6, (selectedStyle.fontSize || 12) - 1) })}><span className="sheet-symbol">−</span></ToolbarButton>
      <input className="sheet-font-size-input" type="number" min="6" max="48" value={selectedStyle.fontSize || 12} disabled={readOnly} onChange={(event) => patchStyle({ fontSize: Math.min(48, Math.max(6, Number(event.target.value) || 12)) })} aria-label={tr({ zh: '字号', en: 'Font size' })} />
      <ToolbarButton label={tr({ zh: '增大字号', en: 'Increase font size' })} disabled={readOnly} onClick={() => patchStyle({ fontSize: Math.min(48, (selectedStyle.fontSize || 12) + 1) })}><Plus size={15} /></ToolbarButton>
      <ToolbarButton label={tr({ zh: '粗体', en: 'Bold' })} active={selectedStyle.bold} disabled={readOnly} onClick={() => patchStyle({ bold: !selectedStyle.bold })}><Bold size={17} /></ToolbarButton>
      <ToolbarButton label={tr({ zh: '斜体', en: 'Italic' })} active={selectedStyle.italic} disabled={readOnly} onClick={() => patchStyle({ italic: !selectedStyle.italic })}><Italic size={17} /></ToolbarButton>
      <ToolbarButton label={tr({ zh: '删除线', en: 'Strikethrough' })} active={selectedStyle.strikethrough} disabled={readOnly} onClick={() => patchStyle({ strikethrough: !selectedStyle.strikethrough })}><Strikethrough size={17} /></ToolbarButton>
      <label className="sheet-color-label" title={tr({ zh: '文字颜色', en: 'Text color' })}><Palette size={16} /><input className="sheet-color-input" type="color" value={selectedStyle.color || '#111111'} disabled={readOnly} onChange={(event) => patchStyle({ color: event.target.value })} /><span className="sr-only"><T zh="文字颜色" en="Text color" /></span></label>
      <label className="sheet-color-label" title={tr({ zh: '填充颜色', en: 'Fill color' })}><PaintBucket size={16} /><input className="sheet-color-input" type="color" value={selectedStyle.fill || '#ffffff'} disabled={readOnly} onChange={(event) => patchStyle({ fill: event.target.value })} /><span className="sr-only"><T zh="填充颜色" en="Fill color" /></span></label>
      <span className="sheet-tool-separator" />
      <ToolbarButton label={tr({ zh: '左对齐', en: 'Align left' })} active={selectedStyle.align === 'left'} disabled={readOnly} onClick={() => patchStyle({ align: 'left' })}><AlignLeft size={17} /></ToolbarButton>
      <ToolbarButton label={tr({ zh: '居中', en: 'Align center' })} active={selectedStyle.align === 'center'} disabled={readOnly} onClick={() => patchStyle({ align: 'center' })}><AlignCenter size={17} /></ToolbarButton>
      <ToolbarButton label={tr({ zh: '右对齐', en: 'Align right' })} active={selectedStyle.align === 'right'} disabled={readOnly} onClick={() => patchStyle({ align: 'right' })}><AlignRight size={17} /></ToolbarButton>
      <ToolbarButton label={tr({ zh: '自动换行', en: 'Wrap text' })} active={selectedStyle.wrap === 'wrap'} disabled={readOnly} onClick={() => patchStyle({ wrap: selectedStyle.wrap === 'wrap' ? 'overflow' : 'wrap' })}><WrapText size={17} /></ToolbarButton>
      <ToolbarButton label={tr({ zh: '所有边框', en: 'All borders' })} active={selectedStyle.border} disabled={readOnly} onClick={() => patchStyle({ border: !selectedStyle.border })}><Grid2x2 size={17} /></ToolbarButton>
      <ToolbarButton label={tr({ zh: currentMerge ? '取消合并单元格' : '合并单元格', en: currentMerge ? 'Unmerge cells' : 'Merge cells' })} active={Boolean(currentMerge)} disabled={readOnly} onClick={mergeSelection}><Merge size={17} /></ToolbarButton>
      <ToolbarButton label={tr({ zh: '复选框', en: 'Checkbox' })} disabled={readOnly} onClick={() => applyValidation('checkbox')}><CheckSquare size={17} /></ToolbarButton>
      <ToolbarButton label={tr({ zh: '链接', en: 'Link' })} disabled={readOnly} onClick={insertLink}><Link2 size={17} /></ToolbarButton>
      {readOnly && <span className="sheet-readonly"><T zh="只读" en="Read only" /></span>}
    </div>
    {showFormulaBar && <div className="sheet-formula-row"><span className="sheet-name-box">{focusAddress}</span><span className="sheet-fx">fx</span><input className="sheet-formula-input" value={editing ? draft : focusRaw} readOnly={readOnly} onFocus={() => { setDraft(focusRaw); setEditing(true); }} onChange={(event) => setDraft(event.target.value)} onBlur={() => commit()} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); commit(); move(1, 0); } if (event.key === 'Escape') { setDraft(focusRaw); setEditing(false); } }} aria-label={tr({ zh: '公式栏', en: 'Formula bar' })} /></div>}
    <div ref={gridRef} className={`sheet-grid-scroll${showGridlines ? '' : ' is-gridless'}`} role="grid" aria-rowcount={rowOrder.length} aria-colcount={data.columnCount} tabIndex={0} onKeyDown={keyboard} onPaste={(event) => { if (!editing) { event.preventDefault(); paste(event.clipboardData.getData('text/plain')); } }} onScroll={(event) => { setScrollTop(event.currentTarget.scrollTop); setScrollLeft(event.currentTarget.scrollLeft); }}>
      <div className="sheet-grid-canvas" style={{ width: totalWidth, height: headerHeight + rowOrder.length * rowHeight, fontSize: `${zoom}%` }}>
        <div className="sheet-corner" aria-hidden="true" style={{ width: rowHeaderWidth, height: headerHeight }} />
        <div className="sheet-column-heads" role="row">{widths.map((width, column) => <div className={`sheet-column-head${column < (data.frozenColumns || 0) ? ' is-frozen' : ''}`} role="columnheader" aria-colindex={column + 1} key={column} style={{ left: offsets[column] + (column < (data.frozenColumns || 0) ? scrollLeft : 0), width, top: -headerHeight, height: headerHeight }}><span>{columnLabel(column)}</span><button type="button" className="sheet-column-resize" aria-label={tr({ zh: `调整 ${columnLabel(column)} 列宽`, en: `Resize column ${columnLabel(column)}` })} onPointerDown={(event) => {
          if (readOnly) return; event.preventDefault(); const startX = event.clientX; const startWidth = width;
          const movePointer = (moveEvent: PointerEvent) => widthsMap(active).set(String(column), Math.min(400, Math.max(48, (startWidth + moveEvent.clientX - startX) / scale)));
          const stop = () => { window.removeEventListener('pointermove', movePointer); window.removeEventListener('pointerup', stop); };
          window.addEventListener('pointermove', movePointer); window.addEventListener('pointerup', stop);
        }} /></div>)}</div>
        {visibleRows.map((row) => {
          const displayIndex = rowDisplayIndex.get(row) || 0; const frozenRow = row < (data.frozenRows || 0);
          return <div className={`sheet-grid-row${frozenRow ? ' is-frozen' : ''}`} role="row" aria-rowindex={displayIndex + 1} key={row} style={{ top: headerHeight + displayIndex * rowHeight + (frozenRow ? scrollTop : 0), width: totalWidth, height: rowHeight }}>
          <div className="sheet-row-head" role="rowheader" style={{ width: rowHeaderWidth, height: rowHeight }}>{row + 1}</div>
          {widths.map((width, column) => {
            const address = cellAddress(row, column); const style = data.styles[address] || {}; const raw = data.cells[address] || '';
            const display = formatSpreadsheetCellValue(raw, calculated.values[data.id]?.[address], style, tr({ zh: 'zh-CN', en: 'en-US' }));
            const merge = containingMerge(data.merges, { row, column });
            if (merge && (merge.start.row !== row || merge.start.column !== column)) return null;
            const mergedWidth = merge ? widths.slice(merge.start.column, merge.end.column + 1).reduce((sum, value) => sum + value, 0) : width;
            const mergedHeight = merge ? (merge.end.row - merge.start.row + 1) * rowHeight : rowHeight;
            const selected = row >= range.start.row && row <= range.end.row && column >= range.start.column && column <= range.end.column;
            const remote = remoteSelections.some((item) => { const n = normalizedRange(item); return row >= n.start.row && row <= n.end.row && column >= n.start.column && column <= n.end.column; });
            const isEditing = editing && row === focus.row && column === focus.column;
            const validation = data.validations?.[address]; const link = data.links?.[address];
            const frozenColumn = column < (data.frozenColumns || 0);
            return <div key={column} title={data.notes?.[address]} className={`sheet-cell${selected ? ' is-selected' : ''}${remote ? ' is-remote' : ''}${style.border ? ' has-border' : ''}${style.wrap === 'wrap' ? ' is-wrapped' : ''}${data.notes?.[address] ? ' has-note' : ''}${frozenColumn ? ' is-frozen' : ''}`} role="gridcell" aria-colindex={column + 1} aria-selected={selected} style={{ left: offsets[column] + (frozenColumn ? scrollLeft : 0), width: mergedWidth, height: mergedHeight, lineHeight: `${Math.max(14, rowHeight - 7)}px`, fontWeight: style.bold ? 700 : undefined, fontStyle: style.italic ? 'italic' : undefined, textDecoration: style.strikethrough ? 'line-through' : undefined, fontFamily: style.fontFamily === 'serif' ? 'Georgia, serif' : style.fontFamily === 'mono' ? 'var(--font-mono, monospace)' : undefined, fontSize: `${(style.fontSize || 12) * scale}px`, textAlign: style.align, alignItems: style.verticalAlign === 'top' ? 'flex-start' : style.verticalAlign === 'bottom' ? 'flex-end' : 'center', justifyContent: style.align === 'center' ? 'center' : style.align === 'right' ? 'flex-end' : 'flex-start', backgroundColor: conditionalFill(row, column, display) || style.fill, color: style.color }} onPointerDown={(event) => { if (event.button !== 0) return; setDragging(true); setEditing(false); setSelection(merge || { start: { row, column }, end: { row, column } }); }} onPointerEnter={() => { if (dragging) setSelection((current) => ({ ...current, end: merge?.end || { row, column } })); }} onDoubleClick={() => { if (!readOnly) { setDraft(raw); setEditing(true); } }}>
              {isEditing ? <input className="sheet-cell-input" autoFocus value={draft} onChange={(event) => setDraft(event.target.value)} onBlur={() => commit()} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); commit(); move(1, 0); } if (event.key === 'Escape') { setDraft(raw); setEditing(false); } }} />
                : validation?.type === 'checkbox'
                  ? <>{/* allow-checkbox: spreadsheet cell data entry */}<input className="sheet-cell-checkbox" type="checkbox" checked={raw.toLocaleLowerCase() === 'true'} disabled={readOnly} onPointerDown={(event) => event.stopPropagation()} onChange={(event) => commit(event.target.checked ? 'true' : 'false', { row, column })} /></>
                  : validation?.type === 'dropdown'
                    ? <select className="sheet-cell-dropdown" value={raw} disabled={readOnly} onPointerDown={(event) => event.stopPropagation()} onChange={(event) => commit(event.target.value, { row, column })}><option value="" />{validation.options.map((option) => <option key={option} value={option}>{option}</option>)}</select>
                    : link ? <a className="sheet-cell-link" href={link} target="_blank" rel="noreferrer" onPointerDown={(event) => event.stopPropagation()}><span style={{ transform: style.rotation ? `rotate(${style.rotation}deg)` : undefined }}>{display}</span></a>
                      : <span className="sheet-cell-value" style={{ transform: style.rotation ? `rotate(${style.rotation}deg)` : undefined }}>{display}</span>}
            </div>;
          })}
        </div>;})}
      </div>
    </div>
    <div className="sheet-bottom-bar"><button type="button" className="sheet-tab-add" onClick={addSheet} disabled={readOnly || ySheets.length >= 50} aria-label={tr({ zh: '新增工作表', en: 'Add sheet' })}><Plus size={17} /></button><div className="sheet-tabs">{snapshots.map((item) => <button type="button" key={item.id} className={`sheet-tab${item.id === data.id ? ' is-active' : ''}`} onClick={() => onActiveSheet(item.id)} onDoubleClick={() => renameSheet(item.id)}>{item.name}</button>)}</div><button type="button" className="sheet-dimension" onClick={() => changeDimension('row', 1)} disabled={readOnly}><T zh="加 20 行" en="Add 20 rows" /></button><button type="button" className="sheet-dimension" onClick={() => changeDimension('column', 1)} disabled={readOnly}><T zh="加 5 列" en="Add 5 columns" /></button><button type="button" className="sheet-tab-delete" onClick={removeSheet} disabled={readOnly || ySheets.length <= 1} aria-label={tr({ zh: '删除当前工作表', en: 'Delete current sheet' })}><Trash2 size={15} /></button><span className="sheet-selection-summary"><T zh={`计数 ${nonEmptyCount}　合计 ${selectionSum}`} en={`Count ${nonEmptyCount}  Sum ${selectionSum}`} /></span></div>
  </div>;
}

export default function SpreadsheetEditorPage() {
  const [id] = useQueryState('id', parseAsString.withDefault(''));
  const user = useAuthUser();
  const [details, setDetails] = useState<DocumentDetails | null>(null);
  const [session, setSession] = useState<EditorSession | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [peopleOnline, setPeopleOnline] = useState<string[]>([]);
  const [title, setTitle] = useState('');
  const [activeSheetId, setActiveSheetId] = useState('');
  const [shareOpen, setShareOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const [formulaError, setFormulaError] = useState('');
  const load = useCallback(async () => {
    if (!id || !user) return;
    try {
      const next = await fetchDocument(id);
      if (next.document.kind !== 'spreadsheet') throw new Error(tr({ zh: '这不是协作表格。', en: 'This resource is not a spreadsheet.' }));
      setDetails(next); setTitle(next.document.title); setError('');
    } catch (cause) { setError((cause as Error).message); }
  }, [id, user]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!id || !details || !user) return;
    const ydoc = new Y.Doc();
    const provider = new HocuspocusProvider({
      url: websocketApiUrl('/v1/documents/realtime'), name: `document.${id}`, document: ydoc, token: getSessionToken() || getWcaToken(),
      onStatus: ({ status: next }) => setStatus(next),
      onSynced: ({ state }) => {
        if (state && details.document.role !== 'viewer') repairSpreadsheetSheets(ydoc);
      },
      onAuthenticationFailed: ({ reason }) => setError(reason || tr({ zh: '表格认证失败', en: 'Spreadsheet authentication failed' })),
      onAwarenessChange: ({ states }) => setPeopleOnline(states.map((state) => typeof state.user === 'object' && state.user && typeof state.user.name === 'string' ? state.user.name : '').filter((name, index, all) => name && all.indexOf(name) === index)),
    });
    const undo = new Y.UndoManager(ydoc.getArray('sheets'));
    setSession({ ydoc, provider, undo });
    return () => { undo.destroy(); provider.destroy(); ydoc.destroy(); setSession(null); setPeopleOnline([]); };
  }, [details?.document.role, id, user]);
  const saveTitle = async () => {
    const cleaned = title.trim(); if (!details?.canManage || !cleaned || cleaned === details.document.title) { if (!cleaned && details) setTitle(details.document.title); return; }
    try { await updateDocumentTitle(details.document.id, cleaned); setDetails({ ...details, document: { ...details.document, title: cleaned } }); }
    catch (cause) { setError((cause as Error).message); }
  };
  const exportFile = async (format: 'xlsx' | 'csv' | 'pdf') => {
    if (!session) return;
    setExporting(true); setError(''); setExportOpen(false);
    try {
      const sheets = session.ydoc.getArray<SheetMap>('sheets').toArray().map(snapshot);
      const active = sheets.find((sheet) => sheet.id === activeSheetId) || sheets[0];
      if (format === 'xlsx') await exportSpreadsheetXlsx(title, sheets);
      else if (format === 'csv') await exportSpreadsheetCsv(title, active, sheets);
      else await exportSpreadsheetPdf(title, active, sheets);
    } catch (cause) { setError(cause instanceof Error ? cause.message : tr({ zh: '导出失败', en: 'Export failed' })); }
    finally { setExporting(false); }
  };
  const printFile = async () => {
    if (!session) return;
    const preview = window.open('', '_blank');
    setExporting(true); setError('');
    try {
      const sheets = session.ydoc.getArray<SheetMap>('sheets').toArray().map(snapshot);
      const active = sheets.find((sheet) => sheet.id === activeSheetId) || sheets[0];
      const blob = await buildSpreadsheetPdf(title, active, sheets);
      const url = URL.createObjectURL(blob);
      if (preview) preview.location.href = url;
      else {
        const link = document.createElement('a'); link.href = url; link.download = `${title || 'spreadsheet'}.pdf`; link.click();
      }
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (cause) {
      preview?.close();
      setError(cause instanceof Error ? cause.message : tr({ zh: '打印预览失败', en: 'Print preview failed' }));
    } finally { setExporting(false); }
  };
  if (!id) return <main className="sheet-workspace"><p className="docs-error"><T zh="缺少表格 ID。" en="Missing spreadsheet ID." /></p></main>;
  return <main className="sheet-workspace">
    <header className="sheet-topbar"><AppLink href="/sheets" prefetch={false} className="sheet-back" aria-label={tr({ zh: '返回表格列表', en: 'Back to spreadsheets' })}><ChevronLeft size={20} /></AppLink><input className="sheet-title-input" value={title} readOnly={!details?.canManage} onChange={(event) => setTitle(event.target.value)} onBlur={() => void saveTitle()} onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); }} aria-label={tr({ zh: '表格标题', en: 'Spreadsheet title' })} /><div className={`sheet-sync is-${status}`}><span />{status === 'connected' ? <T zh="已同步" en="Synced" /> : status === 'connecting' ? <T zh="连接中" en="Connecting" /> : <T zh="离线，等待重连" en="Offline, retrying" />}</div>{peopleOnline.length > 0 && <span className="sheet-presence" title={peopleOnline.join(', ')}>{peopleOnline.length}<T zh=" 人在线" en=" online" /></span>}<div className="sheet-export-wrap"><button type="button" className="sheet-action" onClick={() => setExportOpen((open) => !open)} disabled={exporting}><Download size={16} /><T zh="导出" en="Export" /></button>{exportOpen && <div className="sheet-export-menu"><button type="button" className="sheet-export-option" onClick={() => void exportFile('xlsx')}><Download size={15} />Excel (.xlsx)</button><button type="button" className="sheet-export-option" onClick={() => void exportFile('csv')}><Download size={15} />CSV</button><button type="button" className="sheet-export-option" onClick={() => void exportFile('pdf')}><FileDown size={15} />PDF</button></div>}</div>{details?.canManage && <button type="button" className="sheet-action" onClick={() => setShareOpen(true)}><Share2 size={16} /><T zh="共享" en="Share" /></button>}<WcaAuth /></header>
    {(error || formulaError) && <p className="sheet-page-error" role="alert">{error || formulaError}</p>}
    {!user && !details && <div className="sheet-auth-needed"><T zh="请先登录，再打开共享给你的表格。" en="Sign in to open a spreadsheet shared with you." /></div>}
    {user && !details && !error && <p className="sheet-loading"><T zh="正在加载表格…" en="Loading spreadsheet…" /></p>}
    {details && session && <SpreadsheetGrid session={session} readOnly={details.document.role === 'viewer'} activeSheetId={activeSheetId} onActiveSheet={setActiveSheetId} onError={setError} onFormulaError={setFormulaError} onExport={(format) => { void exportFile(format); }} onPrint={() => { void printFile(); }} />}
    {shareOpen && details && <CollaborativeSharePanel id={id} kind="spreadsheet" details={details} reload={load} close={() => setShareOpen(false)} />}
  </main>;
}

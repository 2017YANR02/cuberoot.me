'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { parseAsString, useQueryState } from 'nuqs';
import { AlignCenter, AlignLeft, AlignRight, Bold, ChevronLeft, Download, FileDown, Italic, Plus, Redo2, Share2, Trash2, Undo2 } from 'lucide-react';
import { HocuspocusProvider } from '@hocuspocus/provider';
import * as Y from 'yjs';
import AppLink from '@/components/AppLink';
import { CollaborativeSharePanel } from '@/components/collaboration/CollaborativeSharePanel';
import WcaAuth from '@/components/WcaAuth';
import { T, tr } from '@/i18n/tr';
import { websocketApiUrl } from '@/lib/api-base';
import { getSessionToken, getWcaToken, useAuthUser } from '@/lib/auth-store';
import { fetchDocument, updateDocumentTitle, type DocumentDetails } from '@/lib/document-api';
import { exportSpreadsheetCsv, exportSpreadsheetPdf, exportSpreadsheetXlsx } from '@/lib/spreadsheet-export';
import { calculateSpreadsheetFormulas, rewriteFormulasForSheetRename } from '@/lib/spreadsheet-formulas';
import {
  cellAddress, columnLabel, formatCalculatedValue, normalizedRange,
  parseClipboardTable, rangeAddresses, rangeToTsv,
  type CellRange, type CellStyle, type SpreadsheetSheet,
} from '@/lib/spreadsheet-model';
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

function snapshot(sheet: SheetMap): SpreadsheetSheet {
  return {
    id: String(sheet.get('id')),
    name: String(sheet.get('name')),
    rowCount: Number(sheet.get('rowCount')) || 100,
    columnCount: Number(sheet.get('columnCount')) || 26,
    cells: cellsMap(sheet).toJSON(), styles: stylesMap(sheet).toJSON(), widths: widthsMap(sheet).toJSON(),
  };
}

function newSheet(name: string): SheetMap {
  const sheet = new Y.Map<unknown>();
  sheet.set('id', crypto.randomUUID()); sheet.set('name', name); sheet.set('rowCount', 100); sheet.set('columnCount', 26);
  sheet.set('cells', new Y.Map<string>()); sheet.set('styles', new Y.Map<CellStyle>()); sheet.set('widths', new Y.Map<number>());
  return sheet;
}

function ToolbarButton({ active, disabled, label, onClick, children }: { active?: boolean; disabled?: boolean; label: string; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" className={`sheet-tool${active ? ' is-active' : ''}`} aria-label={label} title={label} aria-pressed={active} disabled={disabled} onClick={onClick}>{children}</button>;
}

function SpreadsheetGrid({ session, readOnly, activeSheetId, onActiveSheet, onError }: {
  session: EditorSession; readOnly: boolean; activeSheetId: string; onActiveSheet: (id: string) => void; onError: (message: string) => void;
}) {
  const user = useAuthUser();
  const [version, setVersion] = useState(0);
  const [selection, setSelection] = useState<CellRange>({ start: { row: 0, column: 0 }, end: { row: 0, column: 0 } });
  const [dragging, setDragging] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(600);
  const gridRef = useRef<HTMLDivElement>(null);
  const ySheets = session.ydoc.getArray<SheetMap>('sheets');
  useEffect(() => {
    const update = () => setVersion((value) => value + 1);
    ySheets.observeDeep(update);
    if (ySheets.length === 0 && !readOnly) session.ydoc.transact(() => ySheets.push([newSheet('Sheet 1')]));
    return () => ySheets.unobserveDeep(update);
  }, [readOnly, session.ydoc, ySheets]);
  const sheets = useMemo(() => ySheets.toArray(), [version, ySheets]);
  const snapshots = useMemo(() => sheets.map(snapshot), [sheets]);
  const activeIndex = Math.max(0, sheets.findIndex((sheet) => String(sheet.get('id')) === activeSheetId));
  const active = sheets[activeIndex];
  const data = snapshots[activeIndex];
  useEffect(() => { if (sheets.length && !activeSheetId) onActiveSheet(String(sheets[0].get('id'))); }, [activeSheetId, onActiveSheet, sheets]);

  const calculated = useMemo(() => calculateSpreadsheetFormulas(snapshots), [snapshots]);
  useEffect(() => {
    if (calculated.error) onError(calculated.error);
  }, [calculated.error, onError]);

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
  if (!active || !data) return <p className="sheet-loading"><T zh="正在准备表格…" en="Preparing spreadsheet…" /></p>;

  const commit = (raw = draft, point = focus) => {
    if (readOnly) return;
    const address = cellAddress(point.row, point.column);
    session.ydoc.transact(() => raw ? cellsMap(active).set(address, raw.slice(0, 50_000)) : cellsMap(active).delete(address));
    setEditing(false);
  };
  const move = (rowDelta: number, columnDelta: number, extend = false) => {
    const next = { row: Math.min(data.rowCount - 1, Math.max(0, focus.row + rowDelta)), column: Math.min(data.columnCount - 1, Math.max(0, focus.column + columnDelta)) };
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
  const patchStyle = (patch: Partial<CellStyle>) => {
    if (readOnly) return;
    session.ydoc.transact(() => rangeAddresses(selection).forEach((address) => {
      const current = stylesMap(active).get(address) || {};
      const next = { ...current, ...patch };
      if (!next.bold && !next.italic && !next.align && !next.fill && !next.color) stylesMap(active).delete(address); else stylesMap(active).set(address, next);
    }));
  };
  const deleteSelection = () => { if (!readOnly) session.ydoc.transact(() => rangeAddresses(selection).forEach((address) => cellsMap(active).delete(address))); };
  const keyboard = (event: React.KeyboardEvent) => {
    if (editing) return;
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'c') { event.preventDefault(); void navigator.clipboard.writeText(rangeToTsv(data.cells, selection)); return; }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); event.shiftKey ? session.undo.redo() : session.undo.undo(); return; }
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
  const widths = Array.from({ length: data.columnCount }, (_, index) => Math.min(400, Math.max(48, data.widths[String(index)] || DEFAULT_COLUMN_WIDTH)));
  const offsets: number[] = [ROW_HEADER_WIDTH]; widths.forEach((width, index) => { offsets[index + 1] = offsets[index] + width; });
  const totalWidth = offsets[data.columnCount];
  const firstRow = Math.max(0, Math.floor((scrollTop - HEADER_HEIGHT) / ROW_HEIGHT) - 2);
  const lastRow = Math.min(data.rowCount - 1, firstRow + Math.ceil(viewportHeight / ROW_HEIGHT) + 5);
  const visibleRows = Array.from({ length: lastRow - firstRow + 1 }, (_, index) => firstRow + index);
  const range = normalizedRange(selection);
  const awareness = session.provider.awareness;
  const remoteSelections = Array.from(awareness?.getStates().entries() || [])
    .filter(([clientId, state]) => clientId !== awareness?.clientID && state.spreadsheet?.sheetId === data.id)
    .map(([, state]) => state.spreadsheet.range as CellRange).filter(Boolean);

  return <div className="sheet-editor-area">
    <div className="sheet-toolbar">
      <ToolbarButton label={tr({ zh: '撤销', en: 'Undo' })} disabled={readOnly} onClick={() => session.undo.undo()}><Undo2 size={17} /></ToolbarButton>
      <ToolbarButton label={tr({ zh: '重做', en: 'Redo' })} disabled={readOnly} onClick={() => session.undo.redo()}><Redo2 size={17} /></ToolbarButton><span className="sheet-tool-separator" />
      <ToolbarButton label={tr({ zh: '粗体', en: 'Bold' })} active={selectedStyle.bold} disabled={readOnly} onClick={() => patchStyle({ bold: !selectedStyle.bold })}><Bold size={17} /></ToolbarButton>
      <ToolbarButton label={tr({ zh: '斜体', en: 'Italic' })} active={selectedStyle.italic} disabled={readOnly} onClick={() => patchStyle({ italic: !selectedStyle.italic })}><Italic size={17} /></ToolbarButton>
      <ToolbarButton label={tr({ zh: '左对齐', en: 'Align left' })} active={selectedStyle.align === 'left'} disabled={readOnly} onClick={() => patchStyle({ align: 'left' })}><AlignLeft size={17} /></ToolbarButton>
      <ToolbarButton label={tr({ zh: '居中', en: 'Align center' })} active={selectedStyle.align === 'center'} disabled={readOnly} onClick={() => patchStyle({ align: 'center' })}><AlignCenter size={17} /></ToolbarButton>
      <ToolbarButton label={tr({ zh: '右对齐', en: 'Align right' })} active={selectedStyle.align === 'right'} disabled={readOnly} onClick={() => patchStyle({ align: 'right' })}><AlignRight size={17} /></ToolbarButton>
      <label className="sheet-color-label"><T zh="填充" en="Fill" /><input type="color" value={selectedStyle.fill || '#ffffff'} disabled={readOnly} onChange={(event) => patchStyle({ fill: event.target.value })} /></label>
      <label className="sheet-color-label"><T zh="文字" en="Text" /><input type="color" value={selectedStyle.color || '#111111'} disabled={readOnly} onChange={(event) => patchStyle({ color: event.target.value })} /></label>
      {readOnly && <span className="sheet-readonly"><T zh="只读" en="Read only" /></span>}
    </div>
    <div className="sheet-formula-row"><span className="sheet-name-box">{focusAddress}</span><span className="sheet-fx">fx</span><input value={editing ? draft : focusRaw} readOnly={readOnly} onFocus={() => { setDraft(focusRaw); setEditing(true); }} onChange={(event) => setDraft(event.target.value)} onBlur={() => commit()} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); commit(); move(1, 0); } if (event.key === 'Escape') { setDraft(focusRaw); setEditing(false); } }} aria-label={tr({ zh: '公式栏', en: 'Formula bar' })} /></div>
    <div ref={gridRef} className="sheet-grid-scroll" role="grid" aria-rowcount={data.rowCount} aria-colcount={data.columnCount} tabIndex={0} onKeyDown={keyboard} onPaste={(event) => { if (!editing) { event.preventDefault(); paste(event.clipboardData.getData('text/plain')); } }} onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}>
      <div className="sheet-grid-canvas" style={{ width: totalWidth, height: HEADER_HEIGHT + data.rowCount * ROW_HEIGHT }}>
        <div className="sheet-corner" aria-hidden="true" />
        <div className="sheet-column-heads" role="row">{widths.map((width, column) => <div className="sheet-column-head" role="columnheader" aria-colindex={column + 1} key={column} style={{ left: offsets[column], width }}><span>{columnLabel(column)}</span><button type="button" className="sheet-column-resize" aria-label={tr({ zh: `调整 ${columnLabel(column)} 列宽`, en: `Resize column ${columnLabel(column)}` })} onPointerDown={(event) => {
          if (readOnly) return; event.preventDefault(); const startX = event.clientX; const startWidth = width;
          const movePointer = (moveEvent: PointerEvent) => widthsMap(active).set(String(column), Math.min(400, Math.max(48, startWidth + moveEvent.clientX - startX)));
          const stop = () => { window.removeEventListener('pointermove', movePointer); window.removeEventListener('pointerup', stop); };
          window.addEventListener('pointermove', movePointer); window.addEventListener('pointerup', stop);
        }} /></div>)}</div>
        {visibleRows.map((row) => <div className="sheet-grid-row" role="row" aria-rowindex={row + 1} key={row} style={{ top: HEADER_HEIGHT + row * ROW_HEIGHT, width: totalWidth }}>
          <div className="sheet-row-head" role="rowheader">{row + 1}</div>
          {widths.map((width, column) => {
            const address = cellAddress(row, column); const style = data.styles[address] || {}; const raw = data.cells[address] || '';
            const display = raw.startsWith('=') ? formatCalculatedValue(calculated.values[data.id]?.[address]) : raw;
            const selected = row >= range.start.row && row <= range.end.row && column >= range.start.column && column <= range.end.column;
            const remote = remoteSelections.some((item) => { const n = normalizedRange(item); return row >= n.start.row && row <= n.end.row && column >= n.start.column && column <= n.end.column; });
            const isEditing = editing && row === focus.row && column === focus.column;
            return <div key={column} className={`sheet-cell${selected ? ' is-selected' : ''}${remote ? ' is-remote' : ''}`} role="gridcell" aria-colindex={column + 1} aria-selected={selected} style={{ left: offsets[column], width, fontWeight: style.bold ? 700 : undefined, fontStyle: style.italic ? 'italic' : undefined, textAlign: style.align, backgroundColor: style.fill, color: style.color }} onPointerDown={(event) => { if (event.button !== 0) return; setDragging(true); setEditing(false); setSelection({ start: { row, column }, end: { row, column } }); }} onPointerEnter={() => { if (dragging) setSelection((current) => ({ ...current, end: { row, column } })); }} onDoubleClick={() => { if (!readOnly) { setDraft(raw); setEditing(true); } }}>
              {isEditing ? <input autoFocus value={draft} onChange={(event) => setDraft(event.target.value)} onBlur={() => commit()} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); commit(); move(1, 0); } if (event.key === 'Escape') { setDraft(raw); setEditing(false); } }} /> : display}
            </div>;
          })}
        </div>)}
      </div>
    </div>
    <div className="sheet-bottom-bar"><button type="button" className="sheet-tab-add" onClick={addSheet} disabled={readOnly || ySheets.length >= 50} aria-label={tr({ zh: '新增工作表', en: 'Add sheet' })}><Plus size={17} /></button><div className="sheet-tabs">{snapshots.map((item) => <button type="button" key={item.id} className={`sheet-tab${item.id === data.id ? ' is-active' : ''}`} onClick={() => onActiveSheet(item.id)} onDoubleClick={() => renameSheet(item.id)}>{item.name}</button>)}</div><button type="button" className="sheet-dimension" onClick={() => changeDimension('row', 1)} disabled={readOnly}><T zh="加 20 行" en="Add 20 rows" /></button><button type="button" className="sheet-dimension" onClick={() => changeDimension('column', 1)} disabled={readOnly}><T zh="加 5 列" en="Add 5 columns" /></button><button type="button" className="sheet-tab-delete" onClick={removeSheet} disabled={readOnly || ySheets.length <= 1} aria-label={tr({ zh: '删除当前工作表', en: 'Delete current sheet' })}><Trash2 size={15} /></button></div>
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
  if (!id) return <main className="sheet-workspace"><p className="docs-error"><T zh="缺少表格 ID。" en="Missing spreadsheet ID." /></p></main>;
  return <main className="sheet-workspace">
    <header className="sheet-topbar"><AppLink href="/sheets" prefetch={false} className="sheet-back" aria-label={tr({ zh: '返回表格列表', en: 'Back to spreadsheets' })}><ChevronLeft size={20} /></AppLink><input className="sheet-title-input" value={title} readOnly={!details?.canManage} onChange={(event) => setTitle(event.target.value)} onBlur={() => void saveTitle()} onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); }} aria-label={tr({ zh: '表格标题', en: 'Spreadsheet title' })} /><div className={`sheet-sync is-${status}`}><span />{status === 'connected' ? <T zh="已同步" en="Synced" /> : status === 'connecting' ? <T zh="连接中" en="Connecting" /> : <T zh="离线，等待重连" en="Offline, retrying" />}</div>{peopleOnline.length > 0 && <span className="sheet-presence" title={peopleOnline.join(', ')}>{peopleOnline.length}<T zh=" 人在线" en=" online" /></span>}<div className="sheet-export-wrap"><button type="button" className="sheet-action" onClick={() => setExportOpen((open) => !open)} disabled={exporting}><Download size={16} /><T zh="导出" en="Export" /></button>{exportOpen && <div className="sheet-export-menu"><button type="button" onClick={() => void exportFile('xlsx')}><Download size={15} />Excel (.xlsx)</button><button type="button" onClick={() => void exportFile('csv')}><Download size={15} />CSV</button><button type="button" onClick={() => void exportFile('pdf')}><FileDown size={15} />PDF</button></div>}</div>{details?.canManage && <button type="button" className="sheet-action" onClick={() => setShareOpen(true)}><Share2 size={16} /><T zh="共享" en="Share" /></button>}<WcaAuth /></header>
    {error && <p className="sheet-page-error" role="alert">{error}</p>}
    {!user && !details && <div className="sheet-auth-needed"><T zh="请先登录，再打开共享给你的表格。" en="Sign in to open a spreadsheet shared with you." /></div>}
    {user && !details && !error && <p className="sheet-loading"><T zh="正在加载表格…" en="Loading spreadsheet…" /></p>}
    {details && session && <SpreadsheetGrid session={session} readOnly={details.document.role === 'viewer'} activeSheetId={activeSheetId} onActiveSheet={setActiveSheetId} onError={setError} />}
    {shareOpen && details && <CollaborativeSharePanel id={id} kind="spreadsheet" details={details} reload={load} close={() => setShareOpen(false)} />}
  </main>;
}

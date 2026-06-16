// Cloud library state + orchestration for /paint. The document itself lives in
// usePaint (store.ts); this tracks which cloud drawing is open, the library list,
// and the save indicator, and drives the API (cloud-api.ts).
//
// Save model (Figma-style "always saved"): the active drawing autosaves on edit
// (debounced). A fresh unsaved canvas creates a row on its first non-empty save;
// thereafter edits PUT-update that row. Opening another drawing / "New" rebinds.
'use client';

import { create } from 'zustand';
import { usePaint } from './store';
import { DEFAULT_PAPER } from './paper';
import { toThumbnail } from './export';
import type { PaintDoc } from './types';
import {
  listDrawings,
  getDrawing,
  createDrawing,
  updateDrawing,
  deleteDrawing,
  type DrawingMeta,
} from './cloud-api';

export type SaveState = 'idle' | 'saving' | 'saved' | 'error';

interface CloudState {
  drawings: DrawingMeta[];
  activeId: number | null;
  title: string;
  saveState: SaveState;
  loading: boolean; // initial library load in flight
  loaded: boolean; // first load attempt finished (success or fail)
  error: string | null; // last library-level error (load), for the gate/panel
}

export const usePaintCloud = create<CloudState>(() => ({
  drawings: [],
  activeId: null,
  title: 'Untitled',
  saveState: 'idle',
  loading: false,
  loaded: false,
  error: null,
}));

const set = usePaintCloud.setState;
const get = usePaintCloud.getState;

function currentDoc(): PaintDoc {
  const st = usePaint.getState();
  return { shapes: st.shapes, order: st.order, paper: st.paper };
}

function isEmptyDoc(doc: PaintDoc): boolean {
  return !doc.order.some((id) => doc.shapes[id]);
}

// --- autosave (debounced, single-flight to avoid duplicate creates) ----------
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let inFlight = false;
let dirtyAgain = false;
// While true, doc-change subscriptions are ignored. Set around resetDocument so
// opening/creating a drawing (which replaces the doc) does not trigger a redundant
// autosave of the doc we just loaded. zustand fires subscribers synchronously
// inside set(), so toggling around the call is enough.
let suppress = false;

function applyDoc(doc: PaintDoc): void {
  suppress = true;
  usePaint.getState().resetDocument(doc);
  suppress = false;
}

export function scheduleAutosave(): void {
  if (suppress) return;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => void runSave(), 1400);
}

async function runSave(): Promise<void> {
  if (inFlight) {
    dirtyAgain = true;
    return;
  }
  const doc = currentDoc();
  // Nothing to persist for a brand-new empty canvas (no row yet, no content).
  if (get().activeId == null && isEmptyDoc(doc)) return;

  inFlight = true;
  set({ saveState: 'saving' });
  try {
    const thumb = await toThumbnail(doc);
    const id = get().activeId;
    if (id == null) {
      const res = await createDrawing(get().title || 'Untitled', doc, thumb);
      const meta: DrawingMeta = {
        id: res.id,
        title: res.title,
        thumbnail: thumb,
        byteSize: 0,
        createdAt: res.createdAt,
        updatedAt: res.updatedAt,
      };
      set((s) => ({ activeId: res.id, title: res.title, drawings: [meta, ...s.drawings] }));
    } else {
      const res = await updateDrawing(id, { doc, thumbnail: thumb });
      set((s) => ({
        drawings: bumpMeta(s.drawings, id, { thumbnail: thumb, updatedAt: res.updatedAt }),
      }));
    }
    set({ saveState: 'saved' });
  } catch {
    set({ saveState: 'error' });
  } finally {
    inFlight = false;
    if (dirtyAgain) {
      dirtyAgain = false;
      scheduleAutosave();
    }
  }
}

/** Force an immediate save (e.g. on blur / before unload). */
export function flushSave(): void {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  void runSave();
}

function bumpMeta(
  list: DrawingMeta[],
  id: number,
  patch: Partial<DrawingMeta>,
): DrawingMeta[] {
  const idx = list.findIndex((d) => d.id === id);
  if (idx < 0) return list;
  const updated = { ...list[idx], ...patch };
  const rest = list.filter((d) => d.id !== id);
  return [updated, ...rest];
}

// --- library / open / new / rename / delete ----------------------------------

/** Initial load: fetch the library and open the most-recent drawing (or a fresh one). */
export async function loadLibrary(): Promise<void> {
  set({ loading: true, error: null });
  try {
    const drawings = await listDrawings();
    set({ drawings, loaded: true, loading: false });
    if (get().activeId == null) {
      if (drawings.length > 0) await openDrawing(drawings[0].id);
      else newDrawing();
    }
  } catch (e) {
    set({
      loading: false,
      loaded: true,
      error: e instanceof Error ? e.message : 'load failed',
    });
  }
}

export async function openDrawing(id: number): Promise<void> {
  const full = await getDrawing(id);
  applyDoc(full.doc);
  set({ activeId: full.id, title: full.title, saveState: 'saved' });
}

export function newDrawing(): void {
  applyDoc({ shapes: {}, order: [], paper: DEFAULT_PAPER });
  set({ activeId: null, title: 'Untitled', saveState: 'idle' });
}

export async function renameDrawing(id: number, title: string): Promise<void> {
  const clean = title.trim().slice(0, 120) || 'Untitled';
  await updateDrawing(id, { title: clean });
  set((s) => ({
    drawings: s.drawings.map((d) => (d.id === id ? { ...d, title: clean } : d)),
    title: id === s.activeId ? clean : s.title,
  }));
}

export async function removeDrawing(id: number): Promise<void> {
  await deleteDrawing(id);
  const wasActive = get().activeId === id;
  set((s) => ({ drawings: s.drawings.filter((d) => d.id !== id) }));
  if (wasActive) newDrawing();
}

/** Rename the active (possibly-unsaved) drawing's title; persists if it has a row. */
export async function setActiveTitle(title: string): Promise<void> {
  const clean = title.trim().slice(0, 120) || 'Untitled';
  set({ title: clean });
  const id = get().activeId;
  if (id != null) await renameDrawing(id, clean);
}

/** Reset everything (e.g. on logout). */
export function resetCloud(): void {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = null;
  inFlight = false;
  dirtyAgain = false;
  set({ drawings: [], activeId: null, title: 'Untitled', saveState: 'idle', loading: false, loaded: false, error: null });
}

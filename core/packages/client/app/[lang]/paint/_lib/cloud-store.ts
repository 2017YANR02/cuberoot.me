// Cloud library state + orchestration for /paint. The document itself lives in
// usePaint (store.ts); this tracks which cloud drawing is open, the library list,
// and the save indicator, and drives the API (cloud-api.ts).
//
// Save model (Figma-style "always saved"): the active drawing autosaves on edit
// (debounced). A fresh unsaved canvas creates a row on its first non-empty save;
// thereafter edits PUT-update that row. Opening another drawing / "New" rebinds.
'use client';

import { create } from 'zustand';
import { getSessionToken } from '@/lib/auth-store';
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
type DrawingBinding = { id: number | null; revision: number; title: string };
type SaveSnapshot = { doc: PaintDoc; title: string; revision: number };
let activeBinding: DrawingBinding = { id: null, revision: 0, title: 'Untitled' };
const pendingSaves = new Map<DrawingBinding, SaveSnapshot>();
let inFlight: Promise<void> | null = null;
let session = '';
let sessionVersion = 0;
let openVersion = 0;
let libraryVersion = 0;
let libraryRevision = 0;
const libraryEdits = new Map<number, number>();
const renames = new Map<number, Promise<void>>();
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
  activeBinding.revision++;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(flushSave, 1400);
}

function queueSave(): void {
  if (!session || getSessionToken() !== session) return;
  const doc = currentDoc();
  // Nothing to persist for a brand-new empty canvas (no row yet, no content).
  if (activeBinding.id == null && isEmptyDoc(doc)) return;
  pendingSaves.set(activeBinding, {
    doc, title: get().title || 'Untitled', revision: activeBinding.revision,
  });
  void runSaveQueue();
}

function runSaveQueue(): Promise<void> {
  if (inFlight) return inFlight;
  const version = sessionVersion;
  const isCurrentSession = () => version === sessionVersion && getSessionToken() === session;
  // Defer the body so inFlight is installed before synchronous subscribers run.
  const pending = Promise.resolve().then(async () => {
    while (pendingSaves.size && isCurrentSession()) {
      const [binding, snapshot] = pendingSaves.entries().next().value!;
      pendingSaves.delete(binding);
      if (activeBinding === binding) set({ saveState: 'saving' });
      try {
        const { doc, title, revision } = snapshot;
        const thumb = await toThumbnail(doc);
        if (!isCurrentSession()) return;
        // The binding belongs to the captured document, even after switching drawings.
        if (binding.id == null) {
          const res = await createDrawing(title, doc, thumb);
          if (!isCurrentSession()) return;
          binding.id = res.id;
          libraryEdits.set(res.id, ++libraryRevision);
          const meta: DrawingMeta = {
            id: res.id, title: res.title, thumbnail: thumb, byteSize: 0,
            createdAt: res.createdAt, updatedAt: res.updatedAt,
          };
          set(s => ({
            ...(activeBinding === binding ? { activeId: res.id } : {}),
            drawings: [meta, ...s.drawings.filter(d => d.id !== res.id)],
          }));
          // A title can change while the first create is awaiting its response.
          if (binding.title !== title) await renameDrawing(res.id, binding.title);
        } else {
          const res = await updateDrawing(binding.id, { doc, thumbnail: thumb });
          if (!isCurrentSession()) return;
          libraryEdits.set(binding.id, ++libraryRevision);
          set(s => ({ drawings: bumpMeta(s.drawings, binding.id!, { thumbnail: thumb, updatedAt: res.updatedAt }) }));
        }
        if (isCurrentSession() && activeBinding === binding && binding.revision === revision) set({ saveState: 'saved' });
      } catch {
        if (isCurrentSession() && activeBinding === binding) set({ saveState: 'error' });
      }
    }
  }).finally(() => {
    if (inFlight === pending) {
      inFlight = null;
      if (pendingSaves.size && isCurrentSession()) void runSaveQueue();
    }
  });
  inFlight = pending;
  return pending;
}

/** Force an immediate save (e.g. on blur / before unload). */
export function flushSave(): void {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  queueSave();
}

function flushPendingSave(): void {
  if (saveTimer) flushSave();
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
  const token = getSessionToken();
  if (session !== token) {
    resetCloud();
    session = token;
    applyDoc({ shapes: {}, order: [], paper: DEFAULT_PAPER });
  }
  const version = ++libraryVersion;
  const revision = libraryRevision;
  const selection = openVersion;
  const isCurrent = () => version === libraryVersion && session === token && getSessionToken() === token;
  set({ loading: true, error: null });
  try {
    const drawings = await listDrawings();
    if (!isCurrent()) return;
    // A list started before a create/update/delete must not undo its local result.
    set(s => ({
      drawings: [
        ...s.drawings.filter(row => (libraryEdits.get(row.id) ?? 0) > revision),
        ...drawings.filter(row => (libraryEdits.get(row.id) ?? 0) <= revision),
      ],
      loaded: true, loading: false,
    }));
    if (selection === openVersion && get().activeId == null && isEmptyDoc(currentDoc())) {
      if (drawings.length > 0) await openDrawing(drawings[0].id);
      else newDrawing();
    }
  } catch (e) {
    if (!isCurrent()) return;
    set({
      loading: false,
      loaded: true,
      error: e instanceof Error ? e.message : 'load failed',
    });
  }
}

export async function openDrawing(id: number): Promise<void> {
  const version = ++openVersion;
  const owner = sessionVersion;
  flushPendingSave();
  // Reopening a drawing must read after its queued writes finish.
  await inFlight;
  if (version !== openVersion || owner !== sessionVersion || getSessionToken() !== session) return;
  const full = await getDrawing(id);
  if (version !== openVersion || owner !== sessionVersion || getSessionToken() !== session) return;
  flushPendingSave();
  activeBinding = { id: full.id, revision: 0, title: full.title };
  applyDoc(full.doc);
  set({ activeId: full.id, title: full.title, saveState: 'saved' });
}

export function newDrawing(): void {
  openVersion++;
  flushPendingSave();
  activeBinding = { id: null, revision: 0, title: 'Untitled' };
  applyDoc({ shapes: {}, order: [], paper: DEFAULT_PAPER });
  set({ activeId: null, title: 'Untitled', saveState: 'idle' });
}

export async function renameDrawing(id: number, title: string): Promise<void> {
  const clean = title.trim().slice(0, 120) || 'Untitled';
  const owner = sessionVersion;
  if (activeBinding.id === id) activeBinding.title = clean;
  const pending = (renames.get(id) ?? Promise.resolve()).catch(() => {}).then(async () => {
    if (owner !== sessionVersion || getSessionToken() !== session) return;
    await updateDrawing(id, { title: clean });
    if (owner !== sessionVersion || getSessionToken() !== session || renames.get(id) !== pending) return;
    libraryEdits.set(id, ++libraryRevision);
    set((s) => ({
      drawings: s.drawings.map((d) => (d.id === id ? { ...d, title: clean } : d)),
      title: id === s.activeId ? clean : s.title,
    }));
  }).finally(() => { if (renames.get(id) === pending) renames.delete(id); });
  renames.set(id, pending);
  await pending;
}

export async function removeDrawing(id: number): Promise<void> {
  const owner = sessionVersion;
  await renames.get(id);
  if (owner !== sessionVersion || getSessionToken() !== session) return;
  await deleteDrawing(id);
  if (owner !== sessionVersion || getSessionToken() !== session) return;
  libraryEdits.set(id, ++libraryRevision);
  const wasActive = get().activeId === id;
  for (const binding of pendingSaves.keys()) if (binding.id === id) pendingSaves.delete(binding);
  if (wasActive && saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
  set((s) => ({ drawings: s.drawings.filter((d) => d.id !== id) }));
  if (wasActive) newDrawing();
}

/** Rename the active (possibly-unsaved) drawing's title; persists if it has a row. */
export async function setActiveTitle(title: string): Promise<void> {
  const clean = title.trim().slice(0, 120) || 'Untitled';
  activeBinding.title = clean;
  set({ title: clean });
  const id = get().activeId;
  if (id != null) await renameDrawing(id, clean);
}

/** Reset everything (e.g. on logout). */
export function resetCloud(): void {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = null;
  sessionVersion++;
  openVersion++;
  libraryVersion++;
  session = '';
  inFlight = null;
  pendingSaves.clear();
  renames.clear();
  libraryEdits.clear();
  libraryRevision = 0;
  activeBinding = { id: null, revision: 0, title: 'Untitled' };
  set({ drawings: [], activeId: null, title: 'Untitled', saveState: 'idle', loading: false, loaded: false, error: null });
}

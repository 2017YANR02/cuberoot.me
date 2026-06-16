// usePaint — the single zustand store.
//
// Slices:
//  - document (undoable): shapes, order
//  - appState (NOT undoable): selection, tool, camera, ephemeral preview,
//    marquee, snapLines, editing
//  - history: snapshot stack of the document slice only.
//
// Undo model: structuredClone snapshots. Mutating actions take a `commit`
// flag; drags pass commit=false on every move and commit=true (or call
// commit()) on pointer-up so one drag = one history entry. Tool/camera/
// selection changes are never pushed.

import { create } from 'zustand';
import type { Bounds, Camera, PaintDoc, Shape, ToolId } from './types';
import { getShapeBounds, setIdSeed, genId, SHAPE_UTILS } from './registry';
import { unionBounds, aabbOfRotated } from './geometry';
import { loadDoc, saveDoc, DOC_KEY } from './export';

export interface SnapLines {
  x?: number[];
  y?: number[];
}

export interface PaintState {
  // --- document slice (undoable) ---
  shapes: Record<string, Shape>;
  order: string[];

  // --- app state slice (not undoable) ---
  selection: string[];
  tool: ToolId;
  camera: Camera;
  ephemeral: Shape | null;
  marquee: Bounds | null;
  snapLines: SnapLines | null;
  editing: string | null;

  // --- history (internal) ---
  _past: PaintDoc[];
  _future: PaintDoc[];
  _pending: boolean; // a drag is mid-flight; commit() will push

  // === actions ===
  setTool(tool: ToolId): void;
  setCamera(camera: Camera): void;
  panBy(dxScreen: number, dyScreen: number): void;
  zoomAt(pointScreen: { x: number; y: number }, factor: number): void;
  zoomTo(zoom: number): void;
  zoomToFit(viewportW: number, viewportH: number, pad?: number): void;

  addShape(shape: Shape, commit?: boolean): void;
  addShapes(shapes: Shape[], commit?: boolean): void;
  updateShape(id: string, patch: Partial<Shape>, commit?: boolean): void;
  updateShapes(
    ids: string[],
    patch: Partial<Shape> | ((s: Shape) => Partial<Shape>),
    commit?: boolean
  ): void;
  removeShapes(ids: string[]): void;
  removeSelected(): void;

  setSelection(ids: string[]): void;
  addToSelection(id: string): void;
  toggleSelection(id: string): void;
  clearSelection(): void;
  selectAll(): void;

  setEphemeral(shape: Shape | null): void;
  setMarquee(b: Bounds | null): void;
  setSnapLines(s: SnapLines | null): void;
  setEditing(id: string | null): void;

  reorder(id: string, dir: 'front' | 'back' | 'forward' | 'backward'): void;
  moveShapeTo(id: string, index: number): void;
  align(edge: 'left' | 'centerX' | 'right' | 'top' | 'centerY' | 'bottom'): void;
  distribute(axis: 'x' | 'y'): void;
  group(): void;
  ungroup(): void;
  duplicateSelected(): void;
  copy(): void;
  paste(): void;
  nudge(dx: number, dy: number): void;

  beginHistory(): void;
  commit(): void;
  undo(): void;
  redo(): void;

  loadDocument(doc: PaintDoc): void;
  clearDocument(): void;
}

const HISTORY_LIMIT = 100;

function snapshot(s: { shapes: Record<string, Shape>; order: string[] }): PaintDoc {
  return structuredClone({ shapes: s.shapes, order: s.order });
}

let clipboard: Shape[] = [];
let saveTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleSave(doc: PaintDoc) {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => saveDoc(doc, DOC_KEY), 400);
}

function initialDoc(): PaintDoc {
  if (typeof window === 'undefined') return { shapes: {}, order: [] };
  const loaded = loadDoc(DOC_KEY);
  if (loaded) {
    // seed id counter past any numeric ids to avoid collisions.
    let max = 0;
    for (const id of loaded.order) {
      const m = id.match(/(\d+)$/);
      if (m) max = Math.max(max, parseInt(m[1], 36) || 0);
    }
    setIdSeed(max + 1);
    return loaded;
  }
  return { shapes: {}, order: [] };
}

export const usePaint = create<PaintState>((set, get) => {
  const init = initialDoc();

  // Push current document onto past, clear future, persist. Call AFTER mutating.
  const pushHistory = (prev: PaintDoc) => {
    set((st) => {
      const past = [...st._past, prev];
      if (past.length > HISTORY_LIMIT) past.shift();
      return { _past: past, _future: [] };
    });
    scheduleSave(snapshot(get()));
  };

  return {
    shapes: init.shapes,
    order: init.order,
    selection: [],
    tool: 'select',
    camera: { x: 0, y: 0, zoom: 1 },
    ephemeral: null,
    marquee: null,
    snapLines: null,
    editing: null,
    _past: [],
    _future: [],
    _pending: false,

    setTool: (tool) => set({ tool, editing: null }),
    setCamera: (camera) => set({ camera }),

    panBy: (dxScreen, dyScreen) =>
      set((st) => ({
        camera: {
          ...st.camera,
          x: st.camera.x - dxScreen / st.camera.zoom,
          y: st.camera.y - dyScreen / st.camera.zoom,
        },
      })),

    zoomAt: (pointScreen, factor) =>
      set((st) => {
        const z0 = st.camera.zoom;
        const z1 = Math.min(64, Math.max(0.02, z0 * factor));
        // scene point under the cursor stays fixed.
        const sceneX = st.camera.x + pointScreen.x / z0;
        const sceneY = st.camera.y + pointScreen.y / z0;
        return {
          camera: {
            zoom: z1,
            x: sceneX - pointScreen.x / z1,
            y: sceneY - pointScreen.y / z1,
          },
        };
      }),

    zoomTo: (zoom) =>
      set((st) => ({
        camera: { ...st.camera, zoom: Math.min(64, Math.max(0.02, zoom)) },
      })),

    zoomToFit: (viewportW, viewportH, pad = 40) =>
      set((st) => {
        const boxes = st.order
          .map((id) => st.shapes[id])
          .filter((s): s is Shape => !!s && !s.hidden)
          .map((s) =>
            aabbOfRotated(getShapeBounds(s), s.rotation)
          );
        const bb = unionBounds(boxes);
        if (!bb || bb.width === 0 || bb.height === 0) {
          return { camera: { x: -viewportW / 2, y: -viewportH / 2, zoom: 1 } };
        }
        const zoom = Math.min(
          (viewportW - pad * 2) / bb.width,
          (viewportH - pad * 2) / bb.height,
          8
        );
        const z = Math.max(0.02, zoom);
        const cx = bb.x + bb.width / 2;
        const cy = bb.y + bb.height / 2;
        return {
          camera: { zoom: z, x: cx - viewportW / 2 / z, y: cy - viewportH / 2 / z },
        };
      }),

    addShape: (shape, commit = true) => {
      const prev = snapshot(get());
      set((st) => ({
        shapes: { ...st.shapes, [shape.id]: shape },
        order: [...st.order, shape.id],
      }));
      if (commit) pushHistory(prev);
    },

    addShapes: (shapesArr, commit = true) => {
      if (!shapesArr.length) return;
      const prev = snapshot(get());
      set((st) => {
        const shapes = { ...st.shapes };
        const order = [...st.order];
        for (const s of shapesArr) {
          shapes[s.id] = s;
          order.push(s.id);
        }
        return { shapes, order };
      });
      if (commit) pushHistory(prev);
    },

    updateShape: (id, patch, commit = false) => {
      const prev = snapshot(get());
      set((st) => {
        const s = st.shapes[id];
        if (!s) return {};
        return { shapes: { ...st.shapes, [id]: { ...s, ...patch } as Shape } };
      });
      if (commit) pushHistory(prev);
    },

    updateShapes: (ids, patch, commit = false) => {
      const prev = snapshot(get());
      set((st) => {
        const shapes = { ...st.shapes };
        for (const id of ids) {
          const s = shapes[id];
          if (!s) continue;
          const p = typeof patch === 'function' ? patch(s) : patch;
          shapes[id] = { ...s, ...p } as Shape;
        }
        return { shapes };
      });
      if (commit) pushHistory(prev);
    },

    removeShapes: (ids) => {
      if (!ids.length) return;
      const prev = snapshot(get());
      const idSet = new Set(ids);
      set((st) => {
        const shapes = { ...st.shapes };
        for (const id of ids) delete shapes[id];
        return {
          shapes,
          order: st.order.filter((o) => !idSet.has(o)),
          selection: st.selection.filter((o) => !idSet.has(o)),
        };
      });
      pushHistory(prev);
    },

    removeSelected: () => {
      const { selection } = get();
      if (selection.length) get().removeShapes(selection);
    },

    setSelection: (ids) => set({ selection: [...ids] }),
    addToSelection: (id) =>
      set((st) =>
        st.selection.includes(id)
          ? {}
          : { selection: [...st.selection, id] }
      ),
    toggleSelection: (id) =>
      set((st) => ({
        selection: st.selection.includes(id)
          ? st.selection.filter((s) => s !== id)
          : [...st.selection, id],
      })),
    clearSelection: () => set({ selection: [] }),
    selectAll: () => set((st) => ({ selection: [...st.order] })),

    setEphemeral: (shape) => set({ ephemeral: shape }),
    setMarquee: (b) => set({ marquee: b }),
    setSnapLines: (s) => set({ snapLines: s }),
    setEditing: (id) => set({ editing: id }),

    reorder: (id, dir) => {
      const prev = snapshot(get());
      set((st) => {
        const order = [...st.order];
        const i = order.indexOf(id);
        if (i < 0) return {};
        order.splice(i, 1);
        if (dir === 'front') order.push(id);
        else if (dir === 'back') order.unshift(id);
        else if (dir === 'forward')
          order.splice(Math.min(order.length, i + 1), 0, id);
        else order.splice(Math.max(0, i - 1), 0, id);
        return { order };
      });
      pushHistory(prev);
    },

    moveShapeTo: (id, index) => {
      const prev = snapshot(get());
      set((st) => {
        const from = st.order.indexOf(id);
        if (from < 0) return {};
        const order = [...st.order];
        order.splice(from, 1);
        // `index` is the destination slot in the array AFTER `id` was removed.
        const to = Math.max(0, Math.min(order.length, index));
        order.splice(to, 0, id);
        if (order.every((o, i) => o === st.order[i])) return {};
        return { order };
      });
      pushHistory(prev);
    },

    align: (edge) => {
      const { selection, shapes } = get();
      if (selection.length < 2) return;
      const prev = snapshot(get());
      const boxes = selection
        .map((id) => shapes[id])
        .filter((s): s is Shape => !!s)
        .map((s) => ({ id: s.id, b: getShapeBounds(s) }));
      const bb = unionBounds(boxes.map((x) => x.b));
      if (!bb) return;
      set((st) => {
        const next = { ...st.shapes };
        for (const { id, b } of boxes) {
          const s = next[id];
          if (!s) continue;
          let nx = s.x;
          let ny = s.y;
          if (edge === 'left') nx = s.x + (bb.x - b.x);
          else if (edge === 'right') nx = s.x + (bb.x + bb.width - (b.x + b.width));
          else if (edge === 'centerX')
            nx = s.x + (bb.x + bb.width / 2 - (b.x + b.width / 2));
          else if (edge === 'top') ny = s.y + (bb.y - b.y);
          else if (edge === 'bottom')
            ny = s.y + (bb.y + bb.height - (b.y + b.height));
          else if (edge === 'centerY')
            ny = s.y + (bb.y + bb.height / 2 - (b.y + b.height / 2));
          next[id] = { ...s, x: nx, y: ny } as Shape;
        }
        return { shapes: next };
      });
      pushHistory(prev);
    },

    distribute: (axis) => {
      const { selection, shapes } = get();
      if (selection.length < 3) return;
      const prev = snapshot(get());
      const items = selection
        .map((id) => shapes[id])
        .filter((s): s is Shape => !!s)
        .map((s) => ({ s, b: getShapeBounds(s) }));
      items.sort((a, b) => (axis === 'x' ? a.b.x - b.b.x : a.b.y - b.b.y));
      const first = items[0].b;
      const last = items[items.length - 1].b;
      const startC = axis === 'x' ? first.x + first.width / 2 : first.y + first.height / 2;
      const endC = axis === 'x' ? last.x + last.width / 2 : last.y + last.height / 2;
      const step = (endC - startC) / (items.length - 1);
      set((st) => {
        const next = { ...st.shapes };
        items.forEach(({ s, b }, i) => {
          const c = startC + step * i;
          const cur = next[s.id];
          if (!cur) return;
          if (axis === 'x') next[s.id] = { ...cur, x: c - b.width / 2 } as Shape;
          else next[s.id] = { ...cur, y: c - b.height / 2 } as Shape;
        });
        return { shapes: next };
      });
      pushHistory(prev);
    },

    group: () => {
      const { selection, shapes, order } = get();
      if (selection.length < 2) return;
      const prev = snapshot(get());
      const members = selection
        .map((id) => shapes[id])
        .filter((s): s is Shape => !!s);
      const bb = unionBounds(members.map((s) => getShapeBounds(s)));
      if (!bb) return;
      const gid = genId('grp');
      // children ordered by current z-order.
      const childIds = order.filter((id) => selection.includes(id));
      const group: Shape = {
        id: gid,
        type: 'group',
        x: bb.x,
        y: bb.y,
        width: bb.width,
        height: bb.height,
        rotation: 0,
        fill: 'none',
        stroke: 'none',
        strokeWidth: 0,
        opacity: 1,
        children: childIds,
      };
      const childSet = new Set(childIds);
      set((st) => {
        // place group where the topmost child was: count survivors below it.
        const topIdx = Math.max(...childIds.map((id) => st.order.indexOf(id)));
        const insertAt = st.order
          .slice(0, topIdx + 1)
          .filter((id) => !childSet.has(id)).length;
        const newOrder = st.order.filter((id) => !childSet.has(id));
        newOrder.splice(insertAt, 0, gid);
        return {
          shapes: { ...st.shapes, [gid]: group },
          order: newOrder,
          selection: [gid],
        };
      });
      pushHistory(prev);
    },

    ungroup: () => {
      const { selection, shapes } = get();
      const groups = selection
        .map((id) => shapes[id])
        .filter((s): s is Shape => !!s && s.type === 'group');
      if (!groups.length) return;
      const prev = snapshot(get());
      const freed: string[] = [];
      set((st) => {
        const order = [...st.order];
        const nextShapes = { ...st.shapes };
        for (const g of groups) {
          if (g.type !== 'group') continue;
          const gi = order.indexOf(g.id);
          order.splice(gi, 1, ...g.children);
          delete nextShapes[g.id];
          freed.push(...g.children);
        }
        return { shapes: nextShapes, order, selection: freed };
      });
      pushHistory(prev);
    },

    duplicateSelected: () => {
      const { selection, shapes } = get();
      if (!selection.length) return;
      const prev = snapshot(get());
      const clones: Shape[] = [];
      for (const id of selection) {
        const s = shapes[id];
        if (!s) continue;
        clones.push({
          ...structuredClone(s),
          id: genId(s.type),
          x: s.x + 16,
          y: s.y + 16,
        } as Shape);
      }
      set((st) => {
        const next = { ...st.shapes };
        const order = [...st.order];
        for (const c of clones) {
          next[c.id] = c;
          order.push(c.id);
        }
        return { shapes: next, order, selection: clones.map((c) => c.id) };
      });
      pushHistory(prev);
    },

    copy: () => {
      const { selection, shapes } = get();
      clipboard = selection
        .map((id) => shapes[id])
        .filter((s): s is Shape => !!s)
        .map((s) => structuredClone(s));
    },

    paste: () => {
      if (!clipboard.length) return;
      const prev = snapshot(get());
      const clones = clipboard.map(
        (s) =>
          ({
            ...structuredClone(s),
            id: genId(s.type),
            x: s.x + 16,
            y: s.y + 16,
          }) as Shape
      );
      set((st) => {
        const next = { ...st.shapes };
        const order = [...st.order];
        for (const c of clones) {
          next[c.id] = c;
          order.push(c.id);
        }
        return { shapes: next, order, selection: clones.map((c) => c.id) };
      });
      pushHistory(prev);
    },

    nudge: (dx, dy) => {
      const { selection } = get();
      if (!selection.length) return;
      const prev = snapshot(get());
      set((st) => {
        const next = { ...st.shapes };
        for (const id of selection) {
          const s = next[id];
          if (!s || s.locked) continue;
          next[id] = { ...s, x: s.x + dx, y: s.y + dy } as Shape;
        }
        return { shapes: next };
      });
      pushHistory(prev);
    },

    beginHistory: () => {
      // Snapshot the document at the start of a drag; commit() pushes it after.
      pendingSnapshot = snapshot(get());
      set({ _pending: true });
    },

    commit: () => {
      if (pendingSnapshot) {
        pushHistory(pendingSnapshot);
        pendingSnapshot = null;
      }
      set({ _pending: false });
    },

    undo: () => {
      set((st) => {
        if (!st._past.length) return {};
        const past = [...st._past];
        const prevDoc = past.pop()!;
        const cur = snapshot(st);
        return {
          shapes: prevDoc.shapes,
          order: prevDoc.order,
          _past: past,
          _future: [...st._future, cur],
          selection: st.selection.filter((id) => prevDoc.shapes[id]),
          ephemeral: null,
          marquee: null,
          snapLines: null,
        };
      });
      scheduleSave(snapshot(get()));
    },

    redo: () => {
      set((st) => {
        if (!st._future.length) return {};
        const future = [...st._future];
        const nextDoc = future.pop()!;
        const cur = snapshot(st);
        return {
          shapes: nextDoc.shapes,
          order: nextDoc.order,
          _future: future,
          _past: [...st._past, cur],
          selection: st.selection.filter((id) => nextDoc.shapes[id]),
          ephemeral: null,
          marquee: null,
          snapLines: null,
        };
      });
      scheduleSave(snapshot(get()));
    },

    loadDocument: (doc) => {
      const prev = snapshot(get());
      set({
        shapes: structuredClone(doc.shapes),
        order: [...doc.order],
        selection: [],
        ephemeral: null,
        marquee: null,
        snapLines: null,
        editing: null,
      });
      pushHistory(prev);
    },

    clearDocument: () => {
      const prev = snapshot(get());
      set({
        shapes: {},
        order: [],
        selection: [],
        ephemeral: null,
        marquee: null,
        snapLines: null,
        editing: null,
      });
      pushHistory(prev);
    },
  };
});

// Module-level staging for begin/commit drag history (kept off the React state
// so transient drag frames don't allocate snapshots).
let pendingSnapshot: PaintDoc | null = null;

// --- selector helpers (stable references for components) ---
export const selectShapes = (s: PaintState) => s.shapes;
export const selectOrder = (s: PaintState) => s.order;
export const selectSelection = (s: PaintState) => s.selection;
export const selectTool = (s: PaintState) => s.tool;
export const selectCamera = (s: PaintState) => s.camera;
export const selectEphemeral = (s: PaintState) => s.ephemeral;

export function getSelectedShapes(s: PaintState): Shape[] {
  return s.selection.map((id) => s.shapes[id]).filter((x): x is Shape => !!x);
}

export function getSelectionBounds(s: PaintState): Bounds | null {
  const boxes = getSelectedShapes(s).map((sh) =>
    aabbOfRotated(getShapeBounds(sh), sh.rotation)
  );
  return unionBounds(boxes);
}

export { SHAPE_UTILS };

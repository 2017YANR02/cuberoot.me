import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PaintDoc } from '@/app/[lang]/paint/_lib/types';
import type * as CloudApi from '@/app/[lang]/paint/_lib/cloud-api';

const mocks = vi.hoisted(() => ({
  token: 'owner-a',
  doc: { shapes: {}, order: [], paper: 'paper' } as PaintDoc,
  list: vi.fn<typeof CloudApi.listDrawings>(),
  read: vi.fn<typeof CloudApi.getDrawing>(),
  create: vi.fn<typeof CloudApi.createDrawing>(),
  update: vi.fn<typeof CloudApi.updateDrawing>(),
  remove: vi.fn<typeof CloudApi.deleteDrawing>(),
  thumbnail: vi.fn<(doc: PaintDoc) => Promise<string | null>>(),
}));
vi.mock('@/lib/auth-store', () => ({ getSessionToken: () => mocks.token }));
vi.mock('@/app/[lang]/paint/_lib/store', () => ({
  usePaint: { getState: () => ({ ...mocks.doc, resetDocument: (doc: PaintDoc) => { mocks.doc = doc; } }) },
}));
vi.mock('@/app/[lang]/paint/_lib/export', () => ({ toThumbnail: mocks.thumbnail }));
vi.mock('@/app/[lang]/paint/_lib/cloud-api', () => ({
  listDrawings: mocks.list, getDrawing: mocks.read, createDrawing: mocks.create,
  updateDrawing: mocks.update, deleteDrawing: mocks.remove,
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(yes => { resolve = yes; });
  return { promise, resolve };
}
function doc(name: string): PaintDoc {
  return { shapes: { [name]: { id: name, type: 'rect', x: 0, y: 0, width: 10, height: 10,
    rotation: 0, fill: '', stroke: '', strokeWidth: 1, opacity: 1, rx: 0 } }, order: [name], paper: 'paper' };
}
function drawing(id: number): CloudApi.DrawingFull {
  return { id, title: `Drawing ${id}`, thumbnail: null, byteSize: 0, createdAt: 1, updatedAt: 1, doc: doc(`drawing-${id}`) };
}

describe('paint cloud request ownership', () => {
  let cloud: typeof import('@/app/[lang]/paint/_lib/cloud-store');
  const settle = () => vi.advanceTimersByTimeAsync(0);
  const edit = (name: string) => { mocks.doc = doc(name); cloud.scheduleAutosave(); };
  beforeEach(async () => {
    vi.resetModules();
    vi.useFakeTimers();
    mocks.token = 'owner-a';
    mocks.list.mockReset().mockResolvedValue([]);
    mocks.read.mockReset().mockImplementation(async id => drawing(id));
    let next = 100;
    mocks.create.mockReset().mockImplementation(async title => ({ id: next++, title, createdAt: 1, updatedAt: 1 }));
    mocks.update.mockReset().mockResolvedValue({ ok: true, updatedAt: 2 });
    mocks.remove.mockReset().mockResolvedValue();
    mocks.thumbnail.mockReset().mockResolvedValue('thumbnail');
    cloud = await import('@/app/[lang]/paint/_lib/cloud-store');
    await cloud.loadLibrary();
  });
  afterEach(() => { cloud.resetCloud(); vi.useRealTimers(); });

  it('keeps the captured drawing ID while a thumbnail is pending and the user creates a new canvas', async () => {
    await cloud.openDrawing(1);
    const thumbnail = deferred<string>();
    mocks.thumbnail.mockReturnValueOnce(thumbnail.promise);
    edit('edited-a');
    cloud.flushSave();
    await settle();
    cloud.newDrawing();
    edit('edited-b');
    cloud.flushSave();
    thumbnail.resolve('a-thumbnail');
    await settle();
    expect(mocks.update.mock.calls).toEqual([[1, { doc: doc('edited-a'), thumbnail: 'a-thumbnail' }]]);
    expect(mocks.create.mock.calls[0][1]).toEqual(doc('edited-b'));
    expect(cloud.usePaintCloud.getState().activeId).toBe(100);
  });

  it('does not reselect an old newly-created drawing when its response arrives after New', async () => {
    const creating = deferred<Awaited<ReturnType<typeof CloudApi.createDrawing>>>();
    mocks.create.mockReturnValueOnce(creating.promise);
    edit('first');
    cloud.flushSave();
    await settle();
    cloud.newDrawing();
    creating.resolve({ id: 7, title: 'Untitled', createdAt: 1, updatedAt: 1 });
    await settle();
    expect(cloud.usePaintCloud.getState().activeId).toBeNull();
    expect(mocks.doc.order).toEqual([]);
    expect(cloud.usePaintCloud.getState().drawings.map(row => row.id)).toEqual([7]);
  });

  it('saves the last edits to the old drawing before servicing the new drawing', async () => {
    await cloud.openDrawing(1);
    const saving = deferred<Awaited<ReturnType<typeof CloudApi.updateDrawing>>>();
    mocks.update.mockReturnValueOnce(saving.promise);
    edit('a-first');
    cloud.flushSave();
    await settle();
    edit('a-last');
    cloud.newDrawing();
    edit('b-first');
    cloud.flushSave();
    saving.resolve({ ok: true, updatedAt: 2 });
    await settle();
    expect(mocks.update.mock.calls.map(([id, patch]) => [id, patch.doc?.order])).toEqual([[1, ['a-first']], [1, ['a-last']]]);
    expect(mocks.create.mock.calls.map(([, saved]) => saved.order)).toEqual([['b-first']]);
  });

  it('does not mark edits made during a save as already saved', async () => {
    await cloud.openDrawing(1);
    const saving = deferred<Awaited<ReturnType<typeof CloudApi.updateDrawing>>>();
    mocks.update.mockReturnValueOnce(saving.promise);
    edit('first');
    cloud.flushSave();
    await settle();
    edit('later');
    saving.resolve({ ok: true, updatedAt: 2 });
    await settle();
    expect(cloud.usePaintCloud.getState().saveState).toBe('saving');
    await vi.advanceTimersByTimeAsync(1400);
    expect(mocks.update.mock.calls[1][1].doc).toEqual(doc('later'));
    expect(cloud.usePaintCloud.getState().saveState).toBe('saved');
  });

  it('uses the most recent selection when open responses arrive in reverse order', async () => {
    const first = deferred<CloudApi.DrawingFull>();
    const second = deferred<CloudApi.DrawingFull>();
    mocks.read.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const a = cloud.openDrawing(1);
    await settle();
    const b = cloud.openDrawing(2);
    await settle();
    second.resolve(drawing(2));
    await b;
    first.resolve(drawing(1));
    await a;
    expect(cloud.usePaintCloud.getState().activeId).toBe(2);
    expect(mocks.doc.order).toEqual(['drawing-2']);
  });

  it('does not issue an old account write after thumbnail generation finishes', async () => {
    const thumbnail = deferred<string>();
    mocks.thumbnail.mockReturnValueOnce(thumbnail.promise);
    edit('private-a');
    cloud.flushSave();
    await settle();
    mocks.token = 'owner-b';
    await cloud.loadLibrary();
    thumbnail.resolve('old thumbnail');
    await settle();
    expect(mocks.create).not.toHaveBeenCalled();
    expect(cloud.usePaintCloud.getState().drawings).toEqual([]);
    expect(mocks.doc.order).toEqual([]);
  });

  it('ignores a previous account create response without releasing the new account save', async () => {
    const old = deferred<Awaited<ReturnType<typeof CloudApi.createDrawing>>>();
    const current = deferred<Awaited<ReturnType<typeof CloudApi.createDrawing>>>();
    mocks.create.mockReturnValueOnce(old.promise).mockReturnValueOnce(current.promise);
    edit('private-a');
    cloud.flushSave();
    await settle();
    mocks.token = 'owner-b';
    await cloud.loadLibrary();
    edit('private-b');
    cloud.flushSave();
    await settle();
    old.resolve({ id: 1, title: 'A', createdAt: 1, updatedAt: 1 });
    await settle();
    cloud.flushSave();
    await settle();
    expect(mocks.create).toHaveBeenCalledTimes(2);
    current.resolve({ id: 2, title: 'B', createdAt: 1, updatedAt: 1 });
    await settle();
    expect(cloud.usePaintCloud.getState().activeId).toBe(2);
    expect(cloud.usePaintCloud.getState().drawings.map(row => row.id)).toEqual([2]);
  });

  it('serializes title writes so an older request cannot overwrite the latest title', async () => {
    await cloud.openDrawing(1);
    const first = deferred<Awaited<ReturnType<typeof CloudApi.updateDrawing>>>();
    mocks.update.mockReturnValueOnce(first.promise);
    const a = cloud.setActiveTitle('First');
    await settle();
    const b = cloud.setActiveTitle('Last');
    await settle();
    expect(mocks.update).toHaveBeenCalledTimes(1);
    first.resolve({ ok: true, updatedAt: 2 });
    await Promise.all([a, b]);
    expect(mocks.update.mock.calls.map(([, patch]) => patch.title)).toEqual(['First', 'Last']);
    expect(cloud.usePaintCloud.getState().title).toBe('Last');
  });

  it('preserves a create completed after a library snapshot request started', async () => {
    const list = deferred<CloudApi.DrawingMeta[]>();
    mocks.list.mockReturnValueOnce(list.promise);
    const loading = cloud.loadLibrary();
    edit('created-after-list-started');
    cloud.flushSave();
    await settle();
    list.resolve([]);
    await loading;
    expect(cloud.usePaintCloud.getState().drawings.map(row => row.id)).toEqual([100]);
  });

  it('saves title changes made while the initial create is pending', async () => {
    const creating = deferred<Awaited<ReturnType<typeof CloudApi.createDrawing>>>();
    mocks.create.mockReturnValueOnce(creating.promise);
    edit('first');
    cloud.flushSave();
    await settle();
    await cloud.setActiveTitle('Latest title');
    creating.resolve({ id: 7, title: 'Untitled', createdAt: 1, updatedAt: 1 });
    await settle();
    expect(mocks.update.mock.calls).toEqual([[7, { title: 'Latest title' }]]);
    expect(cloud.usePaintCloud.getState().title).toBe('Latest title');
  });
});

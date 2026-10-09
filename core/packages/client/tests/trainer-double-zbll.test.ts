import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AlgCase } from '@cuberoot/shared/alg';
vi.mock('@/lib/double-zbll', () => ({ doubleZbllSupports: () => true, doubleZbllScramble: (top: string, bottom: string) => `${top}/${bottom}` }));
const saved = new Map<string, string>();
Object.assign(globalThis, {
  window: { location: { pathname: '/' }, addEventListener() {} },
  localStorage: { getItem: (key: string) => saved.get(key) ?? null, setItem: (key: string, value: string) => saved.set(key, value), removeItem: (key: string) => saved.delete(key), get length() { return saved.size; }, key: (i: number) => [...saved.keys()][i] ?? null },
});
const { useTrainerStore: store, completedRecapCount, TimerState } = await import('@/lib/trainer-store');
const cases = ['A', 'B', 'C', 'D', 'E'].map(name => ({ subgroup: 'T', name, setup: "R U R'", standard: "R U R'", algs: [], sticker: { kind: 'pll' } }) as unknown as AlgCase);
const current = () => { const { hist } = store.getState(); return hist.list[hist.idx]; };
function boot(count: number) {
  const st = store.getState(); st.loadSession('3x3', 'zbll', cases.slice(0, count));
  st.setSelected(cases.slice(0, count).map(c => `T|${c.name}`)); st.setMode('recap'); st.setRecapOrder('seq'); st.setDoubleZbll(true);
}
beforeEach(() => { saved.clear(); store.setState({ doubleZbll: false, scope: null, timerState: TimerState.NOT_RUNNING, mode: 'recap', multiScramble: false, showRecapRoundEnd: true }); });
describe('Double ZBLL trainer', () => {
  it('consumes both layers once, preserves previews and accounts for the odd tail', () => {
    boot(5);
    expect(current().scramble).toBe('T|A/T|B');
    expect(completedRecapCount(current().recap, false)).toBe(0);
    const preview = store.getState().peek;
    expect(preview?.scramble).toBe('T|C/T|D');
    store.getState().setPreAuf(false);
    expect(store.getState().peek).toEqual(preview);
    store.getState().nextScramble(); expect(current()).toEqual(preview);
    expect(completedRecapCount(current().recap, false)).toBe(2);
    store.getState().nextScramble(); expect(current().scramble).toBe('T|E/T|E');
    expect(current().recap).toEqual({ pos: 5, total: 5, count: 1 });
    expect(completedRecapCount(current().recap, false)).toBe(4);
    store.getState().nextScramble(); expect(store.getState().recapRoundDone).toBe(true);
    expect(completedRecapCount(current().recap, true)).toBe(5);
  });
  it('supports one selected case and rejects incompatible modes', async () => {
    boot(1); expect(current().scramble).toBe('T|A/T|A');
    store.getState().setMode('memo'); expect(store.getState().mode).toBe('recap');
    store.getState().setScrambleKind('inv'); expect(store.getState().scrambleKind).toBe('htm');
    expect((await store.getState().createRoom()).ok).toBe(false);
  });
  it('replaces both layers and previews when selection or scope changes', () => {
    boot(5);
    store.getState().setSelected(['T|D', 'T|E']);
    expect(current().scramble).toBe('T|D/T|E');
    expect(current().recap).toEqual({ pos: 2, total: 2, count: 2 });
    expect(store.getState().hist.list).toHaveLength(1);
    expect(store.getState().peek?.scramble).toBe('T|D/T|E');
    store.getState().setSelected(cases.map(c => `T|${c.name}`));
    expect(current().scramble).toBe('T|A/T|B');
    store.getState().setScope(['T|A', 'T|B', 'T|E']);
    expect(current().recap).toEqual({ pos: 2, total: 3, count: 2 });
    expect(store.getState().peek?.scramble).toBe('T|E/T|E');
    store.getState().setSelected([]);
    expect(store.getState().currentScramble).toBeNull();
    expect(store.getState().hist.list).toHaveLength(0);
  });
  it('stores paired times separately and restores each mode’s history', () => {
    boot(2);
    vi.useFakeTimers();
    store.getState().startTimer(1000); store.getState().stopTimer(9000);
    expect(store.getState().solves[0].bottomKey).toBe('T|B');
    expect(JSON.parse(saved.get('trainer:3x3/zbll:double')!).solves[0].ms).toBe(8000);
    store.setState({ timerState: TimerState.NOT_RUNNING }); store.getState().setDoubleZbll(false);
    expect(store.getState().solves).toHaveLength(0);
    store.getState().setDoubleZbll(true); expect(store.getState().solves[0].ms).toBe(8000);
    vi.clearAllTimers(); vi.useRealTimers();
  });
});

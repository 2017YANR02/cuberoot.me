import { describe, it, expect, beforeEach } from 'vitest';

// 回归:开关之间的联动契约。
// 「三条一屏」开启 ⇒ 自动关掉「打乱图」(一屏摆三张图放不下,手机尤甚);
// 关回单条不自动开回来,开着三条时手动勾回图也不许被覆盖。

function makeLocalStorage() {
  const map = new Map<string, string>();
  return {
    get length() { return map.size; },
    key(i: number) { return [...map.keys()][i] ?? null; },
    getItem(k: string) { return map.has(k) ? (map.get(k) as string) : null; },
    setItem(k: string, v: string) { map.set(k, v); },
    removeItem(k: string) { map.delete(k); },
    clear() { map.clear(); },
  };
}

const g = globalThis as unknown as { window?: unknown; localStorage?: ReturnType<typeof makeLocalStorage> };
g.window = { addEventListener() {} };
g.localStorage = makeLocalStorage();

const { useTrainerStore } = await import('@/lib/trainer-store');

const st = () => useTrainerStore.getState();

describe('trainer-store 开关联动', () => {
  beforeEach(() => {
    g.localStorage = makeLocalStorage();
    st().setMultiScramble(false);
    st().setShowStageThumb(true);
    st().setRandomInitialD(true);
    st().setRandomFinalAuf(true);
    st().setRandomFinalY(true);
    st().setShowRecapRoundEnd(true);
  });

  it('开三条一屏时自动取消打乱图', () => {
    expect(st().showStageThumb).toBe(true);
    st().setMultiScramble(true);
    expect(st().multiScramble).toBe(true);
    expect(st().showStageThumb).toBe(false);
  });

  it('关回单条不自动把打乱图开回来', () => {
    st().setMultiScramble(true);
    st().setMultiScramble(false);
    expect(st().showStageThumb).toBe(false);
  });

  it('开着三条时手动勾回打乱图,不被覆盖', () => {
    st().setMultiScramble(true);
    st().setShowStageThumb(true);
    expect(st().showStageThumb).toBe(true);
    expect(st().multiScramble).toBe(true);
  });

  // 钉朝向 = 「这个形状只出这个方向」,post-AUF = 「随机换方向」,同时开着自相矛盾。
  // UI 把开关一并收起来,所以状态也必须跟着关 —— 否则收起来的是个还在生效的开关。
  it('钉了朝向就自动关掉 post-AUF', () => {
    st().setPostAuf(true);
    st().setOriSel('2d6', [1]);
    expect(st().postAuf).toBe(false);
  });

  it('全放开后 post-AUF 不自动开回来(同「三条 → 打乱图」那条)', () => {
    st().setPostAuf(true);
    st().setOriSel('2d6', [1]);
    st().resetOriSel();
    expect(st().oriSel).toEqual({});
    expect(st().postAuf).toBe(false);
  });

  it('公式集特化的随机 D / AUF / y 偏好会一起持久化', () => {
    st().setRandomInitialD(false);
    st().setRandomFinalAuf(false);
    st().setRandomFinalY(false);

    const saved = JSON.parse(g.localStorage!.getItem('trainer:prefs') ?? '{}');
    expect(saved.randomInitialD).toBe(false);
    expect(saved.randomFinalAuf).toBe(false);
    expect(saved.randomFinalY).toBe(false);
  });

  it('新偏好默认开启 F2L AUF / y 和本轮结束提示', () => {
    g.localStorage = makeLocalStorage();
    st().hydratePrefs();

    expect(st().randomFinalAuf).toBe(true);
    expect(st().randomFinalY).toBe(true);
    expect(st().showRecapRoundEnd).toBe(true);
  });

  it('本轮结束提示偏好会持久化', () => {
    st().setShowRecapRoundEnd(false);

    const saved = JSON.parse(g.localStorage!.getItem('trainer:prefs') ?? '{}');
    expect(saved.showRecapRoundEnd).toBe(false);
  });

  it('旧偏好没有公式集特化字段时回落到默认开启', () => {
    g.localStorage!.setItem('trainer:prefs', JSON.stringify({ timing: true }));
    st().setRandomInitialD(false);
    st().setRandomFinalAuf(false);
    st().setRandomFinalY(false);
    // 上面两个 setter 会覆盖存储,重新放回旧版快照再补水。
    g.localStorage!.setItem('trainer:prefs', JSON.stringify({ timing: true }));
    st().hydratePrefs();

    expect(st().randomInitialD).toBe(true);
    expect(st().randomFinalAuf).toBe(true);
    expect(st().randomFinalY).toBe(true);
    expect(st().showRecapRoundEnd).toBe(true);
  });
});

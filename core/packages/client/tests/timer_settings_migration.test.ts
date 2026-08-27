/**
 * 设置的一次性迁移 —— 改 `DEFAULTS` 对老用户是**无效**的,这里把这件事钉死。
 * =========================================================================
 *
 * `load()` 只要跑过任何一条迁移就会 `save()` 整个对象,于是每个动过设置的用户存档里
 * 都躺着一份**当时的默认值**。所以后来改 `DEFAULTS` 只对「从没存过设置」的人生效 ——
 * 这正是 2026-08-03「录姿态改成默认开」当天没有到达任何老用户的原因:他们的
 * `recordGyro` 仍是那个没人选过的 `false`,复盘于是继续按时间猜中层和转体。
 *
 * 这类 bug 不会在别处炸:类型对、typecheck 过、新装的浏览器上一切正常,只有老用户
 * 看得见。所以它得有自己的测试。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const KEY = 'cuberoot-timer.settings.v1';

/** node 环境没有 localStorage / window,给一个够用的内存版。 */
function installStorage(seed: Record<string, string> = {}): Map<string, string> {
  const mem = new Map(Object.entries(seed));
  const storage = {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => { mem.set(k, v); },
    removeItem: (k: string) => { mem.delete(k); },
    key: (i: number) => [...mem.keys()][i] ?? null,
    get length() { return mem.size; },
  };
  vi.stubGlobal('localStorage', storage);
  vi.stubGlobal('window', { localStorage: storage });
  return mem;
}

/** 设置模块在 import 时就 `load()`,所以每个用例都要重新加载它。 */
async function freshSettings() {
  vi.resetModules();
  return import('@/app/[lang]/timer/_lib/settings');
}

describe('录姿态:老存档里的 false 要翻过来', () => {
  beforeEach(() => { vi.unstubAllGlobals(); });

  it('存档里显式关着 → 迁移后开着,并且落盘', async () => {
    // 老用户的存档:`recordGyro` 是当年的默认值被 `save()` 一起写下去的。
    const mem = installStorage({ [KEY]: JSON.stringify({ recordGyro: false, scrambleClickMigrated: true }) });
    const { getSettings } = await freshSettings();
    expect(getSettings().recordGyro).toBe(true);
    // 落盘了才是一次性的 —— 否则下次加载又翻一遍,用户关不掉。
    const saved = JSON.parse(mem.get(KEY) as string);
    expect(saved.recordGyro).toBe(true);
    expect(saved.recordGyroMigrated).toBe(true);
  });

  it('翻过之后用户再关掉,不会被翻回来 —— 那时的 false 才是他的意思', async () => {
    installStorage({ [KEY]: JSON.stringify({ recordGyro: false, recordGyroMigrated: true }) });
    const { getSettings } = await freshSettings();
    expect(getSettings().recordGyro).toBe(false);
  });

  it('从没存过设置的浏览器:走默认值,不写盘', async () => {
    const mem = installStorage();
    const { getSettings } = await freshSettings();
    expect(getSettings().recordGyro).toBe(true);
    expect(mem.has(KEY)).toBe(false);
  });

  it('迁移只写一次盘,不是每条各写一遍', async () => {
    const mem = installStorage({ [KEY]: JSON.stringify({ scrambleClickAction: 'next' }) });
    const writes: string[] = [];
    const inner = mem.set.bind(mem);
    mem.set = (k: string, v: string) => { writes.push(k); return inner(k, v); };
    const { getSettings } = await freshSettings();
    // 两条迁移(scrambleClick + recordGyro)同时命中,但只落一次盘。
    expect(writes.filter(k => k === KEY)).toHaveLength(1);
    expect(getSettings().scrambleClickAction).toBe('copy');
    expect(getSettings().recordGyro).toBe(true);
  });

  it('坏掉的 JSON 不炸,退回默认值', async () => {
    installStorage({ [KEY]: '{not json' });
    const { getSettings } = await freshSettings();
    expect(getSettings().recordGyro).toBe(true);
  });
});

describe('智能魔方自动预备:老存档里的 off 要翻过来', () => {
  beforeEach(() => { vi.unstubAllGlobals(); });

  it('老存档升级为打乱正确即预备,并且落盘标记', async () => {
    const mem = installStorage({
      [KEY]: JSON.stringify({
        bluetoothAutoReady: 'off',
        scrambleClickMigrated: true,
        recordGyroMigrated: true,
      }),
    });

    const { getSettings } = await freshSettings();
    expect(getSettings().bluetoothAutoReady).toBe('scrambled');
    const saved = JSON.parse(mem.get(KEY) as string);
    expect(saved.bluetoothAutoReady).toBe('scrambled');
    expect(saved.bluetoothAutoReadyMigrated).toBe(true);
  });

  it('迁移后用户手动关闭,刷新后仍然保持关闭', async () => {
    installStorage();
    let settings = await freshSettings();
    settings.updateSettings({ bluetoothAutoReady: 'off' });

    settings = await freshSettings();
    expect(settings.getSettings().bluetoothAutoReady).toBe('off');
  });

  it('保留老用户选过的其他预备方式', async () => {
    installStorage({
      [KEY]: JSON.stringify({
        bluetoothAutoReady: 'still',
        scrambleClickMigrated: true,
        recordGyroMigrated: true,
      }),
    });

    const { getSettings } = await freshSettings();
    expect(getSettings().bluetoothAutoReady).toBe('still');
  });
});

describe('计时器每次进入的打乱默认值', () => {
  beforeEach(() => { vi.unstubAllGlobals(); });

  it('忽略上次保存的打乱来源和难度开关', async () => {
    installStorage({
      [KEY]: JSON.stringify({
        scrambleSource: 'manual',
        wcaDifficultyOn: true,
        scrambleClickMigrated: true,
        recordGyroMigrated: true,
      }),
    });

    const { getSettings } = await freshSettings();
    expect(getSettings().scrambleSource).toBe('wca');
    expect(getSettings().wcaDifficultyOn).toBe(false);
  });

  it('本次打开期间可以手动改,刷新后再次重置', async () => {
    installStorage();
    let settings = await freshSettings();
    settings.updateSettings({ scrambleSource: 'random', wcaDifficultyOn: true });
    expect(settings.getSettings().scrambleSource).toBe('random');
    expect(settings.getSettings().wcaDifficultyOn).toBe(true);

    settings = await freshSettings();
    expect(settings.getSettings().scrambleSource).toBe('wca');
    expect(settings.getSettings().wcaDifficultyOn).toBe(false);
  });
});

describe('已删除的观察启动方式', () => {
  beforeEach(() => { vi.unstubAllGlobals(); });

  it('从老存档中移除松开启动字段', async () => {
    const mem = installStorage({
      [KEY]: JSON.stringify({
        inspectionTrigger: 'up',
        scrambleClickMigrated: true,
        recordGyroMigrated: true,
      }),
    });

    const { getSettings } = await freshSettings();
    expect(getSettings()).not.toHaveProperty('inspectionTrigger');
    expect(JSON.parse(mem.get(KEY) as string)).not.toHaveProperty('inspectionTrigger');
  });
});

describe('滚动统计列设置迁移', () => {
  beforeEach(() => { vi.unstubAllGlobals(); });

  it('把旧 ao 数字窗口迁成统一的统计 key，并清掉旧字段', async () => {
    const mem = installStorage({
      [KEY]: JSON.stringify({
        statsAoWindows: [100, 5],
        scrambleClickMigrated: true,
        recordGyroMigrated: true,
      }),
    });
    const { getSettings } = await freshSettings();
    expect(getSettings().statsRollingColumns).toEqual(['ao5', 'ao100']);

    const saved = JSON.parse(mem.get(KEY) as string);
    expect(saved.statsRollingColumns).toEqual(['ao5', 'ao100']);
    expect(saved).not.toHaveProperty('statsAoWindows');
  });

  it('保留用户已选择的 mo3 和自定义 ao', async () => {
    installStorage({
      [KEY]: JSON.stringify({
        statsRollingColumns: ['ao100', 'mo3'],
        scrambleClickMigrated: true,
        recordGyroMigrated: true,
      }),
    });
    const { getSettings } = await freshSettings();
    expect(getSettings().statsRollingColumns).toEqual(['mo3', 'ao100']);
  });

  it('旧存档只剩一列时保留该列并自动补齐第二列', async () => {
    const mem = installStorage({
      [KEY]: JSON.stringify({
        statsRollingColumns: ['ao100'],
        scrambleClickMigrated: true,
        recordGyroMigrated: true,
      }),
    });
    const { getSettings } = await freshSettings();
    expect(getSettings().statsRollingColumns).toEqual(['ao5', 'ao100']);
    expect(JSON.parse(mem.get(KEY) as string).statsRollingColumns).toEqual(['ao5', 'ao100']);
  });

  it('运行期间也不允许把统计列清空或缩成一列', async () => {
    const mem = installStorage();
    const { getSettings, updateSettings } = await freshSettings();

    updateSettings({ statsRollingColumns: [] });
    expect(getSettings().statsRollingColumns).toEqual(['ao5', 'ao12']);

    updateSettings({ statsRollingColumns: ['ao100'] });
    expect(getSettings().statsRollingColumns).toEqual(['ao5', 'ao100']);
    expect(JSON.parse(mem.get(KEY) as string).statsRollingColumns).toEqual(['ao5', 'ao100']);
  });
});

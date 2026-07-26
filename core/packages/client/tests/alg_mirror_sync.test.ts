/**
 * server 端镜像同步(`server/src/utils/alg_mirror.ts`)的库层行为。
 *
 * 纯重写规则在 `alg_mirror_rewrite.test.ts` 里钉过了,这里只管「读哪几行、写哪几行」:
 * 自镜像走不走伙伴查询、链断了会不会把孤儿留下、没变的行会不会被白写一遍。
 *
 * 库用假的 —— 这个模块只发两种 SQL(按 id 取一行 / 按 id 改 algs),假一个够了。server 包本身
 * 没有测试集(见 server-cache-headers.test.ts 的注释),跨包引源码是这个仓库既有的做法。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { AlgEntry } from '@cuberoot/shared';

interface Row {
  id: number;
  puzzle: string;
  set_slug: string;
  algs: AlgEntry[][];
  mirror_case_id: number | null;
}

const db: { rows: Row[]; log: string[] } = { rows: [], log: [] };

vi.mock('../../server/src/db/connection.js', () => ({
  query: async (text: string, params: unknown[] = []) => {
    if (text.startsWith('SELECT')) {
      const [id, puzzle, set] = params as [number, string, string];
      db.log.push(`select ${id}`);
      return db.rows.filter(r => r.id === id && r.puzzle === puzzle && r.set_slug === set);
    }
    if (text.startsWith('UPDATE')) {
      const [algs, id] = params as [AlgEntry[][], number];
      db.log.push(`update ${id}`);
      const row = db.rows.find(r => r.id === id);
      if (row) row.algs = algs;
      return [];
    }
    throw new Error(`假库不认识这条 SQL:${text}`);
  },
}));

const { syncMirrorForCase, mirrorAlgSyncEnabled } = await import('../../server/src/utils/alg_mirror.js');

const views = (fr: string[], fl: string[] = [], bl: string[] = [], br: string[] = []): AlgEntry[][] =>
  [fr, fl, bl, br].map(v => v.map(alg => ({ alg })));

const row = (id: number, algs: AlgEntry[][], mirror: number | null, set = 'f2l'): Row =>
  ({ id, puzzle: '3x3', set_slug: set, algs, mirror_case_id: mirror });

const texts = (id: number) => db.rows.find(r => r.id === id)!.algs.map(v => v.map(e => e.alg));

beforeEach(() => { db.rows = []; db.log = []; });

describe('生效范围', () => {
  it('只认 f2l / zbls', () => {
    expect(mirrorAlgSyncEnabled('3x3', 'f2l')).toBe(true);
    expect(mirrorAlgSyncEnabled('3x3', 'zbls')).toBe(true);
    // cls 有伙伴但只存一个视角,镜像公式没格子放
    expect(mirrorAlgSyncEnabled('3x3', 'cls')).toBe(false);
    expect(mirrorAlgSyncEnabled('3x3', 'oll')).toBe(false);
  });

  it('不在名单里的 set 一条 SQL 都不发', async () => {
    db.rows = [row(1, views(["U R U' R'"]), 2, 'oll')];
    await syncMirrorForCase('3x3', 'oll', 1);
    expect(db.log).toEqual([]);
  });
});

describe('一对 case', () => {
  it('写伙伴的 FL / BR,写自己的 BL', async () => {
    db.rows = [row(1, views(["U R U' R'"]), 2), row(2, views([]), 1)];
    const { updated, notes } = await syncMirrorForCase('3x3', 'f2l', 1);
    expect(notes).toEqual([]);
    expect(updated.sort()).toEqual([1, 2]);
    expect(texts(2)).toEqual([[], ["U' L' U L"], [], ["U' R' U R"]]);
    expect(texts(1)).toEqual([["U R U' R'"], [], ["U L U' L'"], []]);
  });

  it('从伙伴那边发起,结果一模一样(对称)', async () => {
    db.rows = [row(1, views(["U R U' R'"]), 2), row(2, views([]), 1)];
    await syncMirrorForCase('3x3', 'f2l', 2);
    expect(texts(2)[1]).toEqual(["U' L' U L"]);
  });

  it('已经同步过 → 一行都不写', async () => {
    db.rows = [row(1, views(["U R U' R'"]), 2), row(2, views([]), 1)];
    await syncMirrorForCase('3x3', 'f2l', 1);
    db.log = [];
    const { updated } = await syncMirrorForCase('3x3', 'f2l', 1);
    expect(updated).toEqual([]);
    expect(db.log.filter(l => l.startsWith('update'))).toEqual([]);
  });

  it('源那条被删掉 → 伙伴那边的生成条跟着消失', async () => {
    db.rows = [row(1, views(["U R U' R'"]), 2), row(2, views([]), 1)];
    await syncMirrorForCase('3x3', 'f2l', 1);
    expect(texts(2)[1]).toHaveLength(1);

    db.rows[0].algs = views([]);            // 管理员把 FR 那条删了
    await syncMirrorForCase('3x3', 'f2l', 1);
    expect(texts(2)).toEqual([[], [], [], []]);
  });
});

describe('自镜像', () => {
  it('链指向自己 → 三份落回自己,且不去查第二行', async () => {
    db.rows = [row(7, views(["U R U' R'"]), 7)];
    const { updated } = await syncMirrorForCase('3x3', 'f2l', 7);
    expect(updated).toEqual([7]);
    expect(texts(7)).toEqual([["U R U' R'"], ["U' L' U L"], ["U L U' L'"], ["U' R' U R"]]);
    expect(db.log.filter(l => l.startsWith('select'))).toEqual(['select 7']);
  });
});

describe('链不完整', () => {
  it('没建链(NULL)→ 什么都不生成,且把残留的生成条剥掉', async () => {
    const dirty = views(["U R U' R'"]);
    dirty[1].push({ alg: "U' L' U L", gen: 'lr', src: { id: 9, ori: 0, i: 0 } });
    db.rows = [row(1, dirty, null)];
    const { updated } = await syncMirrorForCase('3x3', 'f2l', 1);
    expect(updated).toEqual([1]);
    expect(texts(1)).toEqual([["U R U' R'"], [], [], []]);
  });

  it('链指向不存在的 id → 当没建链处理,并留下一条说明', async () => {
    db.rows = [row(1, views(["U R U' R'"]), 999)];
    const { notes } = await syncMirrorForCase('3x3', 'f2l', 1);
    expect(notes[0]).toContain('999');
    expect(texts(1)).toEqual([["U R U' R'"], [], [], []]);
  });

  it('case 本身不存在 → 静默收工', async () => {
    const { updated, notes } = await syncMirrorForCase('3x3', 'f2l', 42);
    expect(updated).toEqual([]);
    expect(notes).toEqual([]);
  });
});

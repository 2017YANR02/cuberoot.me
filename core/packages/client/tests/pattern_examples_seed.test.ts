/**
 * pattern_examples 种子行守卫 —— /scramble/pattern/search 的「示例」按钮现在存在 DB 里
 * (管理员可自行增删改),但迁移 0091 自带的 4 条是随代码走的。q 是一串 55 字符的密文,
 * 打错一位不会报错,只会静默变成一个搜不出东西的死按钮 —— 所以在这里按语义解回来核对。
 *
 * 同时钉住 client 的 encodeQ/decodeQ 与 server Q_RE 的格式约定不漂移。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import {
  DEFAULT_Q, Q_RE, decodeQ, encodeQ, miniCells, defaultPatterns, defaultAssign,
} from '@/app/[lang]/scramble/pattern/search/_q';
import { GRAY, isEmptyPattern } from '@/app/[lang]/scramble/pattern/search/_pattern_core';

const MIGRATION = join(
  dirname(fileURLToPath(import.meta.url)),
  '..', '..', 'server', 'migrations', '0091_pattern_examples.sql',
);
const ROUTE = join(
  dirname(fileURLToPath(import.meta.url)),
  '..', '..', 'server', 'src', 'routes', 'pattern_examples.ts',
);

/** 迁移里 INSERT ... VALUES 的每一行:(position, '中文名', 'English', 'q', bool) */
function seededRows() {
  const sql = readFileSync(MIGRATION, 'utf8');
  const rows = [...sql.matchAll(/\(\s*(\d+),\s*'([^']+)',\s*'([^']+)',\s*'([^']+)',\s*(TRUE|FALSE)\s*\)/g)];
  return rows.map((m) => ({
    position: Number(m[1]),
    nameZh: m[2],
    nameEn: m[3],
    q: m[4],
    continuous: m[5] === 'TRUE',
  }));
}

// 每条种子的语义:图案 1 的 9 格 + 分配到全六面,其余 4 个图案留空
const EXPECTED: Record<string, number[]> = {
  Checkerboard: [0, 1, 0, 1, 0, 1, 0, 1, 0],
  'Six spots': [0, 0, 0, 0, 1, 0, 0, 0, 0],
  Crosses: [1, 0, 1, 0, 0, 0, 1, 0, 1],
  Stripes: [0, 1, 2, 0, 1, 2, 0, 1, 2],
};

describe('pattern_examples 迁移种子', () => {
  const rows = seededRows();

  it('恰好 4 条,position 连续,中英名都有', () => {
    expect(rows.length).toBe(4);
    expect(rows.map((r) => r.position)).toEqual([0, 1, 2, 3]);
    for (const r of rows) {
      expect(r.nameZh.length).toBeGreaterThan(0);
      expect(r.nameEn.length).toBeGreaterThan(0);
    }
  });

  it('每条 q 都合法、非空,且解回预期图案 + 全六面分配', () => {
    for (const r of rows) {
      expect(Q_RE.test(r.q), `${r.nameEn} q malformed`).toBe(true);
      expect(r.q).not.toBe(DEFAULT_Q);

      const d = decodeQ(r.q);
      expect(d, `${r.nameEn} decode failed`).not.toBeNull();
      const { patterns, assign } = d!;

      expect(patterns[0], `${r.nameEn} pattern`).toEqual(EXPECTED[r.nameEn]);
      expect(assign[0]).toEqual([true, true, true, true, true, true]);
      // 其余 4 个图案空且未分配 —— 否则会多出面约束,结果集完全不同
      for (let j = 1; j < 5; j++) {
        expect(isEmptyPattern(patterns[j])).toBe(true);
        expect(assign[j].some(Boolean)).toBe(false);
      }
      // 按钮上的缩略图取的就是图案 1
      expect(miniCells(r.q)).toEqual(EXPECTED[r.nameEn]);
    }
  });

  it('server 的 Q_RE 与 client 同源', () => {
    const src = readFileSync(ROUTE, 'utf8');
    const m = /const Q_RE = (\/.+\/);/.exec(src);
    expect(m, 'Q_RE not found in route').not.toBeNull();
    expect(m![1]).toBe(Q_RE.toString());
  });
});

describe('q 编解码往返', () => {
  it('encode∘decode = id,DEFAULT_Q 是全灰空态', () => {
    const d = decodeQ(DEFAULT_Q)!;
    expect(d.patterns.every(isEmptyPattern)).toBe(true);
    expect(encodeQ(defaultPatterns(), defaultAssign())).toBe(DEFAULT_Q);

    const patterns = defaultPatterns();
    patterns[0] = [0, 1, 2, 3, 4, GRAY, 0, 1, 2];
    patterns[3] = [4, 4, 4, 4, 4, 4, 4, 4, 4];
    const assign = defaultAssign();
    assign[0] = [true, false, true, false, true, false];  // U F L → 0b010101 = 0x15
    assign[3] = [false, true, false, true, false, true];  // R D B → 0b101010 = 0x2a
    const q = encodeQ(patterns, assign);
    expect(q.slice(46, 48)).toBe('15');
    expect(q.slice(52, 54)).toBe('2a');
    const back = decodeQ(q)!;
    expect(back.patterns).toEqual(patterns);
    expect(back.assign).toEqual(assign);
  });

  it('坏输入一律 null(长度 / 越界色类 / 大写 hex)', () => {
    expect(decodeQ(null)).toBeNull();
    expect(decodeQ('')).toBeNull();
    expect(decodeQ(`${'5'.repeat(44)}-0000000000`)).toBeNull();
    expect(decodeQ(`${'6'.repeat(45)}-0000000000`)).toBeNull();
    expect(decodeQ(`${'5'.repeat(45)}-3F00000000`)).toBeNull();
  });
});

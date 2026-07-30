// 批量出图的两块地基:ZIP 写盘 + 那一栏文本怎么切。
//
// ZIP 不拿自己的 reader 自证 —— 测试里另写一个「从 EOCD 倒着找中央目录」的读法
// (真解压工具就是这么读的),CRC 用 node 的 zlib.crc32 当独立判据。压缩方法固定为
// stored,所以数据段应当与原始字节逐字节相同。
import { describe, it, expect } from 'vitest';
import { crc32 as nodeCrc32 } from 'node:zlib';
import { makeZip, safeFileName, type ZipEntry } from '@/lib/zip';
import { batchFileName, parseBatchList } from '@/lib/puzzle-image/batch';

const EOCD_SIG = 0x06054b50;
const CENTRAL_SIG = 0x02014b50;
const LOCAL_SIG = 0x04034b50;

interface ReadEntry { name: string; data: Uint8Array; crc: number }

/** 独立读法:尾部找 EOCD → 中央目录 → 各条的本地头。 */
function readZip(zip: Uint8Array): ReadEntry[] {
  const dv = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  let eocd = -1;
  for (let i = zip.length - 22; i >= 0; i--) {
    if (dv.getUint32(i, true) === EOCD_SIG) { eocd = i; break; }
  }
  expect(eocd).toBeGreaterThanOrEqual(0);
  const count = dv.getUint16(eocd + 10, true);
  let at = dv.getUint32(eocd + 16, true);
  const dec = new TextDecoder();
  const out: ReadEntry[] = [];
  for (let i = 0; i < count; i++) {
    expect(dv.getUint32(at, true)).toBe(CENTRAL_SIG);
    expect(dv.getUint16(at + 10, true)).toBe(0);        // stored
    expect(dv.getUint16(at + 8, true) & 0x0800).toBe(0x0800); // UTF-8 名字标志
    const crc = dv.getUint32(at + 16, true);
    const size = dv.getUint32(at + 24, true);
    const nameLen = dv.getUint16(at + 28, true);
    const local = dv.getUint32(at + 42, true);
    const name = dec.decode(zip.subarray(at + 46, at + 46 + nameLen));

    expect(dv.getUint32(local, true)).toBe(LOCAL_SIG);
    const lNameLen = dv.getUint16(local + 26, true);
    const lExtra = dv.getUint16(local + 28, true);
    const start = local + 30 + lNameLen + lExtra;
    out.push({ name, data: zip.subarray(start, start + size), crc });
    at += 46 + nameLen + dv.getUint16(at + 30, true) + dv.getUint16(at + 32, true);
  }
  return out;
}

const bytes = (s: string) => new TextEncoder().encode(s);
const FIXED = new Date(2026, 6, 29, 12, 34, 56);

describe('makeZip', () => {
  it('条目读得回来,数据逐字节相同,CRC 与 zlib 一致', () => {
    const entries: ZipEntry[] = [
      { name: 'a.svg', data: bytes('<svg/>') },
      { name: '01-Sune.png', data: new Uint8Array([0, 1, 2, 250, 255]) },
      { name: '中文 名字.svg', data: bytes('魔方') },
    ];
    const read = readZip(makeZip(entries, FIXED));
    expect(read.map((e) => e.name)).toEqual(['a.svg', '01-Sune.png', '中文 名字.svg']);
    entries.forEach((e, i) => {
      expect(Buffer.from(read[i].data).equals(Buffer.from(e.data))).toBe(true);
      expect(read[i].crc).toBe(nodeCrc32(Buffer.from(e.data)) >>> 0);
    });
  });

  it('空档案也是合法档案', () => {
    const zip = makeZip([], FIXED);
    expect(zip.length).toBe(22);
    expect(readZip(zip)).toEqual([]);
  });

  it('同一批 + 同一时间 → 逐字节可复现', () => {
    const e = [{ name: 'x.svg', data: bytes('<svg/>') }];
    expect(Buffer.from(makeZip(e, FIXED)).equals(Buffer.from(makeZip(e, FIXED)))).toBe(true);
  });
});

describe('safeFileName', () => {
  it('剥掉文件系统保留字符,保留公式里合法的撇号', () => {
    expect(safeFileName("R U R' U'")).toBe("R U R' U'");
    expect(safeFileName('a/b\\c:d*e?f"g<h>i|j')).toBe('a b c d e f g h i j');
    expect(safeFileName('  ..name..  ')).toBe('name');
    expect(safeFileName('')).toBe('image');
    expect(safeFileName('///', 'fallback')).toBe('fallback');
  });
});

describe('parseBatchList', () => {
  it('一行一条;名字用 = 或制表符分隔,# 是注释', () => {
    const { items, dropped } = parseBatchList([
      '# 注释行',
      '',
      "Sune = R U R' U R U2 R'",
      "T perm\tR U R' U' R' F R2 U' R' U' R U R' F'",
      "R U R' U'",
    ].join('\n'), 100);
    expect(dropped).toBe(0);
    expect(items).toEqual([
      { index: 1, name: 'Sune', alg: "R U R' U R U2 R'" },
      { index: 2, name: 'T perm', alg: "R U R' U' R' F R2 U' R' U' R U R' F'" },
      { index: 3, name: '', alg: "R U R' U'" },
    ]);
  });

  it('冒号不当分隔符 —— [R: U D] 是合法换位记号,切开就废了', () => {
    const { items } = parseBatchList('[R: U D]', 10);
    expect(items).toEqual([{ index: 1, name: '', alg: '[R: U D]' }]);
  });

  it('只写了名字没写公式 → 当成公式(直接粘一列公式的常见情形)', () => {
    expect(parseBatchList('R U =', 10).items).toEqual([{ index: 1, name: '', alg: 'R U' }]);
  });

  it('超上限的丢掉并报数,不静默截断', () => {
    const { items, dropped } = parseBatchList(Array.from({ length: 12 }, (_, i) => `U${i}`).join('\n'), 5);
    expect(items).toHaveLength(5);
    expect(dropped).toBe(7);
    expect(items[4]).toEqual({ index: 5, name: '', alg: 'U4' });
  });

  it('空文本 / 全注释 → 空列表', () => {
    expect(parseBatchList('', 10)).toEqual({ items: [], dropped: 0 });
    expect(parseBatchList('#a\n\n  \n# b', 10)).toEqual({ items: [], dropped: 0 });
  });
});

describe('batchFileName', () => {
  const item = { index: 7, name: 'Sune', alg: "R U R' U R U2 R'" };

  it('序号按总数补零,免得 10 排在 2 前面', () => {
    expect(batchFileName('{i}-{name}', item, 120, 'png')).toBe('007-Sune.png');
    expect(batchFileName('{i}-{name}', item, 9, 'png')).toBe('7-Sune.png');
  });

  it('没写名字就用公式;{alg} 可单独取用', () => {
    expect(batchFileName('{name}', { ...item, name: '' }, 9, 'svg')).toBe("R U R' U R U2 R'.svg");
    expect(batchFileName('{i} {alg}', item, 9, 'svg')).toBe("7 R U R' U R U2 R'.svg");
  });

  it('模板为空走默认;清洗后仍为空则回退到序号', () => {
    expect(batchFileName('', item, 9, 'png')).toBe('7-Sune.png');
    expect(batchFileName('///', item, 9, 'png')).toBe('image-7.png');
  });
});

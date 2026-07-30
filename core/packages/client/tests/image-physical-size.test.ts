// 物理尺寸:让导出的图自带「2.4 厘米」,拖进文档就是那么大。
//
// 两条路各有各的坑,所以两边都锁死:
//   SVG —— 换单位的前提是 viewBox 在场,缺了必须补;根节点的内联 style 会盖过属性,
//          不一起改就等于没改。
//   PNG —— 位图只有 pHYs(每米像素数)。这里拿 zlib 现造一张真 PNG 再解回来验,
//          CRC 用 node 自带的 zlib.crc32 当独立判据,不拿自己的实现自证。
import { describe, it, expect } from 'vitest';
import { deflateSync, crc32 as nodeCrc32 } from 'node:zlib';
import {
  applySvgPhysicalSize, isPrintUnit, printSizeMm, withPngPhysicalSize,
} from '@/lib/puzzle-image/physical-size';
import { crc32 } from '@/lib/crc32';
import { readSpecFromParams, specToParams } from '@/lib/puzzle-image/codec';
import { DEFAULTS } from '@/lib/puzzle-image/defaults';
import { exportSvgText } from '@/lib/puzzle-image/image-export';

const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(nodeCrc32(body) >>> 0);
  return Buffer.concat([len, body, crc]);
}

/** 真 PNG(w×h,8-bit RGB,一整块 IDAT)。 */
function makePng(w: number, h: number, extra: Buffer[] = []): Uint8Array<ArrayBuffer> {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 2;   // colour type: truecolour
  const raw = Buffer.alloc(h * (1 + w * 3)); // 每行一个 filter byte,像素全 0
  const out = Buffer.concat([
    PNG_SIG, chunk('IHDR', ihdr), ...extra,
    chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
  ]);
  return new Uint8Array(out);
}

/** 走一遍块表,返回 [类型, 数据] 序列。 */
function readChunks(png: Uint8Array): Array<{ type: string; data: Uint8Array }> {
  const dv = new DataView(png.buffer, png.byteOffset, png.byteLength);
  const out: Array<{ type: string; data: Uint8Array }> = [];
  let off = 8;
  while (off + 12 <= png.length) {
    const len = dv.getUint32(off);
    const type = String.fromCharCode(...png.subarray(off + 4, off + 8));
    out.push({ type, data: png.subarray(off + 8, off + 8 + len) });
    // 每块自带 CRC:顺手校验,篡改过的文件当场露馅。
    const stored = dv.getUint32(off + 8 + len);
    expect(nodeCrc32(Buffer.from(png.subarray(off + 4, off + 8 + len))) >>> 0).toBe(stored);
    off += 12 + len;
    if (type === 'IEND') break;
  }
  return out;
}

describe('crc32 —— 与 node zlib 同一个变体', () => {
  it('对得上 zlib.crc32', () => {
    for (const s of ['', 'a', 'IHDR', '魔方', 'The quick brown fox']) {
      const b = Buffer.from(s, 'utf8');
      expect(crc32(new Uint8Array(b))).toBe(nodeCrc32(b) >>> 0);
    }
  });
});

describe('applySvgPhysicalSize', () => {
  const WITH_VB = '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 100 100"><g/></svg>';

  it('宽高换成物理长度,viewBox 原样(不动坐标系就不变形)', () => {
    const out = applySvgPhysicalSize(WITH_VB, 2.4, 'cm');
    expect(out).toContain('width="2.4cm"');
    expect(out).toContain('height="2.4cm"');
    expect(out).toContain('viewBox="0 0 100 100"');
    expect(out).not.toContain('"256"');
    expect(out).toContain('<g/>');
  });

  it('没有 viewBox 就按原像素宽高补一个 —— 否则换单位等于换坐标系', () => {
    const noVb = '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="80"></svg>';
    const out = applySvgPhysicalSize(noVb, 30, 'mm');
    expect(out).toContain('viewBox="0 0 120 80"');
    expect(out).toContain('width="30mm"');
  });

  it('内联 style 里的宽高一并改 —— CSS 优先级高于属性,漏了就白写', () => {
    // cube_unfolded_svg 的真实形状。
    const styled = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 12 9" '
      + 'preserveAspectRatio="xMidYMid meet" style="width:100%;height:100%"><rect/></svg>';
    const out = applySvgPhysicalSize(styled, 5, 'cm');
    expect(out).toContain('style="width:5cm;height:5cm"');
    expect(out).toContain('width="5cm" height="5cm"');
    expect(out).not.toContain('100%');
  });

  it('本来没有 style 就不平白加一个', () => {
    expect(applySvgPhysicalSize(WITH_VB, 3, 'cm')).not.toContain('style=');
  });

  it('尺寸 ≤ 0 / 无 root / 既无 viewBox 又无宽高 → 原样返回', () => {
    expect(applySvgPhysicalSize(WITH_VB, 0, 'cm')).toBe(WITH_VB);
    expect(applySvgPhysicalSize(WITH_VB, NaN, 'cm')).toBe(WITH_VB);
    expect(applySvgPhysicalSize('<div/>', 2, 'cm')).toBe('<div/>');
    const bare = '<svg xmlns="http://www.w3.org/2000/svg"><g/></svg>';
    expect(applySvgPhysicalSize(bare, 2, 'cm')).toBe(bare);
  });

  it('单位换算 / 校验', () => {
    expect(printSizeMm(2.4, 'cm')).toBeCloseTo(24);
    expect(printSizeMm(24, 'mm')).toBe(24);
    expect(isPrintUnit('cm')).toBe(true);
    expect(isPrintUnit('in')).toBe(false);
    expect(isPrintUnit(undefined)).toBe(false);
  });
});

describe('withPngPhysicalSize', () => {
  it('IHDR 之后插入 pHYs,每米像素数按物理宽算', () => {
    const png = makePng(240, 240);
    const out = withPngPhysicalSize(png, 24); // 240px 摊到 24mm
    const types = readChunks(out).map((c) => c.type);
    expect(types).toEqual(['IHDR', 'pHYs', 'IDAT', 'IEND']);

    const phys = readChunks(out).find((c) => c.type === 'pHYs')!;
    const dv = new DataView(phys.data.buffer, phys.data.byteOffset, phys.data.byteLength);
    // 240 像素 / 0.024 米 = 10000 像素每米(= 254 DPI)。
    expect(dv.getUint32(0)).toBe(10000);
    expect(dv.getUint32(4)).toBe(10000);
    expect(phys.data[8]).toBe(1); // 单位 = 米
  });

  it('已有 pHYs 就替换,不留两块(重复块非法)', () => {
    const stale = Buffer.alloc(9);
    stale.writeUInt32BE(1, 0);
    stale.writeUInt32BE(1, 4);
    stale[8] = 1;
    const png = makePng(96, 96, [chunk('pHYs', stale)]);
    const out = withPngPhysicalSize(png, 24);
    const types = readChunks(out).map((c) => c.type);
    expect(types.filter((t) => t === 'pHYs')).toHaveLength(1);
    expect(types).toEqual(['IHDR', 'pHYs', 'IDAT', 'IEND']);
  });

  it('像素数据一字节没动', () => {
    const png = makePng(64, 64);
    const before = readChunks(png).find((c) => c.type === 'IDAT')!.data;
    const after = readChunks(withPngPhysicalSize(png, 10)).find((c) => c.type === 'IDAT')!.data;
    expect(Buffer.from(after).equals(Buffer.from(before))).toBe(true);
  });

  it('不是 PNG / 尺寸非法 → 原样返回', () => {
    const notPng = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(withPngPhysicalSize(notPng, 24)).toBe(notPng);
    const png = makePng(8, 8);
    expect(withPngPhysicalSize(png, 0)).toBe(png);
    expect(withPngPhysicalSize(png, -3)).toBe(png);
  });
});

describe('物理尺寸 —— URL 与导出的接线', () => {
  const spec = (p: Partial<typeof DEFAULTS>) => ({ ...DEFAULTS, ...p });

  it('psz / pun 来回跑,小数不被 parseInt 截断', () => {
    const p = specToParams(spec({ printSize: 2.4, printUnit: 'mm' }), '');
    expect(p.get('psz')).toBe('2.4');
    expect(p.get('pun')).toBe('mm');
    const back = readSpecFromParams(p, '');
    expect(back.printSize).toBe(2.4);
    expect(back.printUnit).toBe('mm');
  });

  it('0 = 不写(默认单位也不写),老链接一个字节不变', () => {
    const p = specToParams(spec({ printSize: 0, printUnit: 'mm' }), '');
    expect(p.get('psz')).toBeNull();
    expect(p.get('pun')).toBeNull();
    expect(specToParams(spec({ printSize: 3, printUnit: 'cm' }), '').get('pun')).toBeNull();
  });

  it('单位名不认识 / psz 是垃圾 → 回默认,不抛', () => {
    expect(readSpecFromParams('psz=2&pun=furlong', '').printUnit).toBe('cm');
    expect(readSpecFromParams('psz=abc', '').printSize).toBe(0);
    expect(readSpecFromParams('psz=-5', '').printSize).toBe(0);
    expect(readSpecFromParams('psz=9999', '').printSize).toBe(100);
  });

  it('导出文本:开了才套单位,关了原样', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 9 9"/>';
    expect(exportSvgText(svg, null)).toBe(svg);
    expect(exportSvgText(svg, { size: 2.4, unit: 'cm' })).toContain('width="2.4cm"');
  });
});

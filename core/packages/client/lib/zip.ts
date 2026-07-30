/**
 * Minimal ZIP writer — stored (uncompressed) entries only.
 *
 * Why not a dependency: the only thing the site zips is a batch of already-compressed
 * PNGs plus a handful of small SVGs, where deflate buys almost nothing, and a
 * store-only writer is ~80 lines of well-specified header layout (APPNOTE 6.3.4,
 * §4.3.7 local header / §4.3.12 central directory / §4.3.16 end-of-central-directory).
 *
 * Names are written UTF-8 with the language-encoding flag (bit 11) set, so CJK
 * filenames survive on Windows Explorer, macOS Archive Utility and 7-Zip alike.
 */

import { crc32 } from '@/lib/crc32';

export interface ZipEntry {
  /** Path inside the archive. Forward slashes; no leading slash. */
  name: string;
  data: Uint8Array;
}

/** `Uint8Array<ArrayBuffer>` (not the `ArrayBufferLike` default) so the result is a `BlobPart`. */
type Bytes = Uint8Array<ArrayBuffer>;

/** MS-DOS packed date/time (APPNOTE §4.4.6). Seconds have 2s resolution — that is the format. */
function dosStamp(d: Date): { time: number; date: number } {
  const year = Math.max(1980, d.getFullYear());
  return {
    time: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1),
    date: ((year - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  };
}

const LOCAL_SIG = 0x04034b50;
const CENTRAL_SIG = 0x02014b50;
const EOCD_SIG = 0x06054b50;
const FLAG_UTF8 = 0x0800;
const VERSION = 20; // 2.0 — the floor for a stored entry

export function makeZip(entries: ZipEntry[], now: Date = new Date()): Bytes {
  const { time, date } = dosStamp(now);
  const enc = new TextEncoder();
  const prepared = entries.map((e) => ({
    name: enc.encode(e.name),
    data: e.data,
    crc: crc32(e.data),
  }));

  const localSize = prepared.reduce((n, e) => n + 30 + e.name.length + e.data.length, 0);
  const centralSize = prepared.reduce((n, e) => n + 46 + e.name.length, 0);
  const out = new Uint8Array(localSize + centralSize + 22);
  const dv = new DataView(out.buffer);
  let at = 0;
  const offsets: number[] = [];

  for (const e of prepared) {
    offsets.push(at);
    dv.setUint32(at, LOCAL_SIG, true);
    dv.setUint16(at + 4, VERSION, true);
    dv.setUint16(at + 6, FLAG_UTF8, true);
    dv.setUint16(at + 8, 0, true); // method: stored
    dv.setUint16(at + 10, time, true);
    dv.setUint16(at + 12, date, true);
    dv.setUint32(at + 14, e.crc, true);
    dv.setUint32(at + 18, e.data.length, true);
    dv.setUint32(at + 22, e.data.length, true);
    dv.setUint16(at + 26, e.name.length, true);
    dv.setUint16(at + 28, 0, true); // no extra field
    at += 30;
    out.set(e.name, at); at += e.name.length;
    out.set(e.data, at); at += e.data.length;
  }

  const centralStart = at;
  prepared.forEach((e, i) => {
    dv.setUint32(at, CENTRAL_SIG, true);
    dv.setUint16(at + 4, VERSION, true);
    dv.setUint16(at + 6, VERSION, true);
    dv.setUint16(at + 8, FLAG_UTF8, true);
    dv.setUint16(at + 10, 0, true);
    dv.setUint16(at + 12, time, true);
    dv.setUint16(at + 14, date, true);
    dv.setUint32(at + 16, e.crc, true);
    dv.setUint32(at + 20, e.data.length, true);
    dv.setUint32(at + 24, e.data.length, true);
    dv.setUint16(at + 28, e.name.length, true);
    dv.setUint16(at + 30, 0, true); // extra
    dv.setUint16(at + 32, 0, true); // comment
    dv.setUint16(at + 34, 0, true); // disk number start
    dv.setUint16(at + 36, 0, true); // internal attrs
    dv.setUint32(at + 38, 0, true); // external attrs
    dv.setUint32(at + 42, offsets[i], true);
    at += 46;
    out.set(e.name, at); at += e.name.length;
  });

  dv.setUint32(at, EOCD_SIG, true);
  dv.setUint16(at + 4, 0, true);
  dv.setUint16(at + 6, 0, true);
  dv.setUint16(at + 8, prepared.length, true);
  dv.setUint16(at + 10, prepared.length, true);
  dv.setUint32(at + 12, centralSize, true);
  dv.setUint32(at + 16, centralStart, true);
  dv.setUint16(at + 20, 0, true); // no archive comment

  return out;
}

/**
 * Make a filename safe for every filesystem in an archive: strip the reserved
 * Windows characters, collapse runs of separators, trim dots/spaces (Explorer
 * silently mangles trailing ones), and never return empty.
 */
export function safeFileName(raw: string, fallback = 'image'): string {
  const cleaned = raw
    // eslint-disable-next-line no-control-regex
    .replace(/[\\/:*?"<>|\x00-\x1f]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[\s.]+|[\s.]+$/g, '');
  return cleaned || fallback;
}
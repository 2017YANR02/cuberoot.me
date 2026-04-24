// Binary format for nemesizer data files.
// Shared between stats-build (writer, Node) and client (reader, browser).
// All numbers are little-endian.

export const NEMESIZER_EVENTS = [
  '333', '222', '444', '555', '666', '777',
  '333bf', '333fm', '333oh',
  'minx', 'pyram', 'clock', 'skewb', 'sq1',
  '444bf', '555bf', '333mbf',
] as const;
export type EventId = typeof NEMESIZER_EVENTS[number];
export const EVENT_INDEX: Record<string, number> = Object.fromEntries(
  NEMESIZER_EVENTS.map((ev, i) => [ev, i]),
);

export const KIND_SINGLE = 0;
export const KIND_AVERAGE = 1;

export const FORMAT_VERSION = 1;

export const MAGIC_PERSONS = 0x504d454e;  // "NEMP" little-endian
export const MAGIC_RANKS   = 0x524d454e;  // "NEMR"
export const MAGIC_COUNTS  = 0x434d454e;  // "NEMC"

// ── persons.bin ────────────────────────────────────────────────────────────
// Header: magic(u32) version(u32) count(u32) continentCount(u32) [continentName utf8, u16-prefixed] * continentCount
// Then records: wcaId(10 bytes) countryIso2(2) continentIdx(u8) _(u8) nameLen(u16) name(utf8)
export interface PersonRecord {
  wcaId: string;           // 10 chars
  countryIso2: string;     // 2 chars
  continentIdx: number;    // index into continents array
  name: string;
}

export interface PersonsFile {
  continents: string[];
  persons: PersonRecord[];
}

export function encodePersons(data: PersonsFile): Uint8Array {
  const enc = new TextEncoder();
  const parts: Uint8Array[] = [];
  const header = new ArrayBuffer(16);
  const hdv = new DataView(header);
  hdv.setUint32(0, MAGIC_PERSONS, true);
  hdv.setUint32(4, FORMAT_VERSION, true);
  hdv.setUint32(8, data.persons.length, true);
  hdv.setUint32(12, data.continents.length, true);
  parts.push(new Uint8Array(header));
  for (const c of data.continents) {
    const b = enc.encode(c);
    const lenBuf = new ArrayBuffer(2);
    new DataView(lenBuf).setUint16(0, b.length, true);
    parts.push(new Uint8Array(lenBuf));
    parts.push(b);
  }
  for (const p of data.persons) {
    const nameBytes = enc.encode(p.name);
    const rec = new ArrayBuffer(16 + nameBytes.length);
    const view = new Uint8Array(rec);
    const rdv = new DataView(rec);
    writeFixedAscii(view, 0, 10, p.wcaId);
    writeFixedAscii(view, 10, 2, p.countryIso2);
    rdv.setUint8(12, p.continentIdx);
    rdv.setUint8(13, 0);
    rdv.setUint16(14, nameBytes.length, true);
    view.set(nameBytes, 16);
    parts.push(view);
  }
  return concatBytes(parts);
}

export function decodePersons(buf: Uint8Array): PersonsFile {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  if (dv.getUint32(0, true) !== MAGIC_PERSONS) throw new Error('bad persons magic');
  if (dv.getUint32(4, true) !== FORMAT_VERSION) throw new Error('bad persons version');
  const count = dv.getUint32(8, true);
  const continentCount = dv.getUint32(12, true);
  const dec = new TextDecoder('utf-8');
  let off = 16;
  const continents: string[] = [];
  for (let i = 0; i < continentCount; i++) {
    const len = dv.getUint16(off, true);
    off += 2;
    continents.push(dec.decode(buf.subarray(off, off + len)));
    off += len;
  }
  const persons: PersonRecord[] = new Array(count);
  for (let i = 0; i < count; i++) {
    const wcaId = readFixedAscii(buf, off, 10);
    const countryIso2 = readFixedAscii(buf, off + 10, 2);
    const continentIdx = buf[off + 12];
    const nameLen = dv.getUint16(off + 14, true);
    const name = dec.decode(buf.subarray(off + 16, off + 16 + nameLen));
    persons[i] = { wcaId, countryIso2, continentIdx, name };
    off += 16 + nameLen;
  }
  return { continents, persons };
}

// ── ranks.bin ──────────────────────────────────────────────────────────────
// Header: magic(u32) version(u32) count(u32)
// Record (16 bytes): personIdx(u32) eventIdx(u8) kind(u8) _(u16) worldRank(u32) best(u32)
export const RANK_RECORD_SIZE = 16;

export interface RankRecord {
  personIdx: number;
  eventIdx: number;
  kind: number;      // 0 single, 1 average
  worldRank: number;
  best: number;      // centiseconds, or movecount for FMC, or score for MBLD
}

export function encodeRanks(records: RankRecord[]): Uint8Array {
  const buf = new ArrayBuffer(12 + records.length * RANK_RECORD_SIZE);
  const dv = new DataView(buf);
  dv.setUint32(0, MAGIC_RANKS, true);
  dv.setUint32(4, FORMAT_VERSION, true);
  dv.setUint32(8, records.length, true);
  let off = 12;
  for (const r of records) {
    dv.setUint32(off + 0, r.personIdx, true);
    dv.setUint8(off + 4, r.eventIdx);
    dv.setUint8(off + 5, r.kind);
    dv.setUint16(off + 6, 0, true);
    dv.setUint32(off + 8, r.worldRank, true);
    dv.setUint32(off + 12, r.best, true);
    off += RANK_RECORD_SIZE;
  }
  return new Uint8Array(buf);
}

export interface DecodedRanks {
  count: number;
  personIdx: Uint32Array;
  eventIdx: Uint8Array;
  kind: Uint8Array;
  worldRank: Uint32Array;
  best: Uint32Array;
}

export function decodeRanks(buf: Uint8Array): DecodedRanks {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  if (dv.getUint32(0, true) !== MAGIC_RANKS) throw new Error('bad ranks magic');
  if (dv.getUint32(4, true) !== FORMAT_VERSION) throw new Error('bad ranks version');
  const count = dv.getUint32(8, true);
  const personIdx = new Uint32Array(count);
  const eventIdx = new Uint8Array(count);
  const kind = new Uint8Array(count);
  const worldRank = new Uint32Array(count);
  const best = new Uint32Array(count);
  let off = 12;
  for (let i = 0; i < count; i++) {
    personIdx[i] = dv.getUint32(off + 0, true);
    eventIdx[i] = buf[off + 4];
    kind[i] = buf[off + 5];
    worldRank[i] = dv.getUint32(off + 8, true);
    best[i] = dv.getUint32(off + 12, true);
    off += RANK_RECORD_SIZE;
  }
  return { count, personIdx, eventIdx, kind, worldRank, best };
}

// ── counts.bin ─────────────────────────────────────────────────────────────
// Header: magic(u32) version(u32) count(u32)
// Record (8 bytes): nemesisCount(u32) nemesizedCount(u32)
export interface DecodedCounts {
  count: number;
  nemesisCount: Uint32Array;
  nemesizedCount: Uint32Array;
}

export function encodeCounts(nemesisCount: Uint32Array, nemesizedCount: Uint32Array): Uint8Array {
  if (nemesisCount.length !== nemesizedCount.length) throw new Error('count length mismatch');
  const count = nemesisCount.length;
  const buf = new ArrayBuffer(12 + count * 8);
  const dv = new DataView(buf);
  dv.setUint32(0, MAGIC_COUNTS, true);
  dv.setUint32(4, FORMAT_VERSION, true);
  dv.setUint32(8, count, true);
  let off = 12;
  for (let i = 0; i < count; i++) {
    dv.setUint32(off, nemesisCount[i], true);
    dv.setUint32(off + 4, nemesizedCount[i], true);
    off += 8;
  }
  return new Uint8Array(buf);
}

export function decodeCounts(buf: Uint8Array): DecodedCounts {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  if (dv.getUint32(0, true) !== MAGIC_COUNTS) throw new Error('bad counts magic');
  if (dv.getUint32(4, true) !== FORMAT_VERSION) throw new Error('bad counts version');
  const count = dv.getUint32(8, true);
  const nemesisCount = new Uint32Array(count);
  const nemesizedCount = new Uint32Array(count);
  let off = 12;
  for (let i = 0; i < count; i++) {
    nemesisCount[i] = dv.getUint32(off, true);
    nemesizedCount[i] = dv.getUint32(off + 4, true);
    off += 8;
  }
  return { count, nemesisCount, nemesizedCount };
}

// ── meta.json ──────────────────────────────────────────────────────────────
export interface NemesizerMeta {
  generatedAt: string;
  exportDate: string;
  personCount: number;
  rankCount: number;
  events: { id: string; nameEn: string; nameZh: string }[];
  countries: { iso2: string; nameEn: string; nameZh: string; continentIdx: number }[];
  hasAverage: Record<string, boolean>;  // event id -> has average kind
}

// ── helpers ────────────────────────────────────────────────────────────────
function writeFixedAscii(buf: Uint8Array, off: number, len: number, s: string): void {
  for (let i = 0; i < len; i++) {
    buf[off + i] = i < s.length ? s.charCodeAt(i) & 0xff : 0;
  }
}

function readFixedAscii(buf: Uint8Array, off: number, len: number): string {
  let end = len;
  while (end > 0 && buf[off + end - 1] === 0) end--;
  let s = '';
  for (let i = 0; i < end; i++) s += String.fromCharCode(buf[off + i]);
  return s;
}

function concatBytes(parts: Uint8Array[]): Uint8Array {
  let total = 0;
  for (const p of parts) total += p.length;
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.length;
  }
  return out;
}

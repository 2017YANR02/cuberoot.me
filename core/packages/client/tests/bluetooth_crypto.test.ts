/**
 * Drift guard for `_lib/bluetooth/gan_crypto.ts`.
 *
 * `gan_v2.ts`, `gan_v3.ts`, `gan_v4.ts`, `qiyi.ts` and the new `moyu32.ts`
 * used to carry four separate copies of the same AES-128 + frame codec. They
 * now share one module, and the ONLY thing standing between a refactor and a
 * silently-undecodable cube is this file — we own no smart cube and cannot
 * test on hardware.
 *
 * Every expected value below was produced by running **csTimer's own crypto**
 * (`src/js/lib/sha256.js`'s `$.aes128`, plus `getKeyV2` / `encode` /
 * `decode` lifted verbatim out of `src/js/hardware/gancube.js`, and the
 * LZString-compressed `KEYS` blobs from `gancube.js`, `moyu32cube.js` and
 * `qiyicube.js`) in a Node vm sandbox. They are therefore an ORACLE, not a
 * transcription of our own output: any divergence means we drifted from
 * csTimer, which is the standard we are held to.
 *
 * They are locked with `toBe()` on purpose. If you change the algorithm, you
 * must change these constants by hand — that is the review signal.
 */

import { describe, it, expect } from 'vitest';
import {
  aesDecryptBlock,
  aesEcbDecrypt,
  aesEcbEncrypt,
  aesEncryptBlock,
  decryptFrame,
  deriveKeyFromMac,
  encryptFrame,
  expandKey,
  readBits,
  toBitReader,
} from '@/app/[lang]/timer/_lib/bluetooth/gan_crypto';
import { MOYU32_IV_BASE, MOYU32_KEY_BASE } from '@/app/[lang]/timer/_lib/bluetooth/moyu32';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/\s+/g, '');
  const out = new Uint8Array(clean.length >> 1);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.substr(i * 2, 2), 16);
  return out;
}

function bytesToHex(b: Uint8Array): string {
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
}

/** "AA:BB:…" -> forward-order bytes, same shape `macStringToBytes` produces. */
function macBytes(mac: string): Uint8Array {
  return new Uint8Array(mac.split(':').map((p) => parseInt(p, 16)));
}

/* ------------------------------------------------------------------ */
/*  Base key / IV constants                                            */
/* ------------------------------------------------------------------ */

// csTimer `gancube.js` KEYS[2] / KEYS[3], LZString-decompressed. Shared by
// GAN gen2 (normal), gen3 and gen4.
const GAN_KEY_BASE = hexToBytes('01024228319116072005185442111253');
const GAN_IV_BASE = hexToBytes('11033228210176272095781432120243');
// csTimer `gancube.js` KEYS[4] / KEYS[5] — the AiCube clone pair.
const AICUBE_KEY_BASE = hexToBytes('05120245020129561278127681010803');
const AICUBE_IV_BASE = hexToBytes('01442806862122285105083182022106');
// csTimer `qiyicube.js` KEYS[0] — one fixed factory key, no MAC salt.
const QIYI_KEY = hexToBytes('57b1f9abcd5ae8a79cb98ce7578c5108');

describe('AES-128 block cipher', () => {
  it('reproduces the FIPS-197 Appendix C.1 known-answer vector', () => {
    // The published AES-128 KAT. csTimer's `$.aes128` produces the same
    // ciphertext, so this simultaneously pins us to the standard and to it.
    const key = hexToBytes('000102030405060708090a0b0c0d0e0f');
    const pt = hexToBytes('00112233445566778899aabbccddeeff');
    const w = expandKey(key);
    expect(bytesToHex(aesEncryptBlock(pt, w))).toBe('69c4e0d86a7b0430d8cdb78070b4c55a');
    expect(bytesToHex(aesDecryptBlock(hexToBytes('69c4e0d86a7b0430d8cdb78070b4c55a'), w)))
      .toBe('00112233445566778899aabbccddeeff');
  });

  it('does not mutate its input block', () => {
    const key = hexToBytes('000102030405060708090a0b0c0d0e0f');
    const pt = hexToBytes('00112233445566778899aabbccddeeff');
    const before = bytesToHex(pt);
    aesEncryptBlock(pt, expandKey(key));
    expect(bytesToHex(pt)).toBe(before);
  });

  it('reads only the first 16 bytes of an over-long block', () => {
    // csTimer hands its 20-element frame array straight to `decrypt()`, whose
    // loops all stop at 16. Anything we do must match that, or the two-pass
    // rolling window in decryptFrame diverges.
    const key = hexToBytes('000102030405060708090a0b0c0d0e0f');
    const w = expandKey(key);
    const short = hexToBytes('00112233445566778899aabbccddeeff');
    const long = hexToBytes('00112233445566778899aabbccddeeffdeadbeef');
    expect(bytesToHex(aesEncryptBlock(long, w))).toBe(bytesToHex(aesEncryptBlock(short, w)));
  });
});

describe('deriveKeyFromMac', () => {
  it('matches csTimer getKeyV2 for the GAN base + a known MAC', () => {
    const mac = macBytes('AB:12:34:56:78:9A');
    expect(bytesToHex(deriveKeyFromMac(GAN_KEY_BASE, mac)))
      .toBe('9b7a985c433d16072005185442111253');
    expect(bytesToHex(deriveKeyFromMac(GAN_IV_BASE, mac)))
      .toBe('ab7b885c33ac76272095781432120243');
  });

  it('matches csTimer getKeyV2(ver=1) for the AiCube base', () => {
    const mac = macBytes('CF:30:16:00:12:34');
    expect(bytesToHex(deriveKeyFromMac(AICUBE_KEY_BASE, mac)))
      .toBe('3924025b32d029561278127681010803');
    expect(bytesToHex(deriveKeyFromMac(AICUBE_IV_BASE, mac)))
      .toBe('3556281cb6f022285105083182022106');
  });

  it('is modulo 255, not 256 — 0xFF + 0x00 wraps to 0x00', () => {
    // GAN's quirk, and the single most common way a third-party port breaks.
    // Two wraps in one vector: byte 0 (0xFF + 0x00) and byte 5 (0xFE + 0x01).
    const base = hexToBytes('ff0100807ffe0102030405060708090a');
    const derived = deriveKeyFromMac(base, macBytes('01:02:03:04:05:00'));
    expect(bytesToHex(derived)).toBe('0006048381000102030405060708090a');
    expect(derived[0]).toBe(0x00); // (0xFF + 0x00) % 255
    expect(derived[5]).toBe(0x00); // (0xFE + 0x01) % 255
  });

  it('leaves bytes 6..15 of the base untouched', () => {
    const derived = deriveKeyFromMac(GAN_KEY_BASE, macBytes('FF:FF:FF:FF:FF:FF'));
    expect(bytesToHex(derived.subarray(6))).toBe(bytesToHex(GAN_KEY_BASE.subarray(6)));
  });

  it('a zero MAC is the identity', () => {
    expect(bytesToHex(deriveKeyFromMac(GAN_KEY_BASE, new Uint8Array(6))))
      .toBe(bytesToHex(GAN_KEY_BASE));
  });
});

describe('GAN rolling-window frame codec', () => {
  const mac = macBytes('AB:12:34:56:78:9A');
  const key = deriveKeyFromMac(GAN_KEY_BASE, mac);
  const iv = deriveKeyFromMac(GAN_IV_BASE, mac);
  const w = expandKey(key);

  it('encrypts a 20-byte frame exactly as csTimer encode() does', () => {
    // Plaintext = the v3 hardware-info opcode frame, padded to 20 bytes.
    const pt = hexToBytes('6804000000000000000000000000000000000000');
    expect(bytesToHex(encryptFrame(pt, w, iv)))
      .toBe('e169ea4337231069f4ddbbb7b8aa35758007e4ff');
  });

  it('decrypts that ciphertext back with the same key/IV', () => {
    const ct = hexToBytes('e169ea4337231069f4ddbbb7b8aa35758007e4ff');
    expect(bytesToHex(decryptFrame(ct, w, iv)))
      .toBe('6804000000000000000000000000000000000000');
  });

  it('takes the single-block path for exactly-16-byte frames (v3 commands)', () => {
    // csTimer's `ret.length > 16` guard: a 16-byte command gets ONE pass.
    const pt = hexToBytes('68010000000000000000000000000000');
    const ct = encryptFrame(pt, w, iv);
    expect(bytesToHex(ct)).toBe('7ad434868a8c2f9fbcfcd178eb07f911');
    expect(bytesToHex(decryptFrame(ct, w, iv))).toBe(bytesToHex(pt));
  });

  it('round-trips arbitrary 20-byte payloads', () => {
    // Deterministic pseudo-random payloads — no seedless randomness in CI.
    for (let seed = 1; seed <= 8; seed++) {
      const pt = new Uint8Array(20);
      let s = seed * 2654435761;
      for (let i = 0; i < 20; i++) {
        s = (s * 1103515245 + 12345) >>> 0;
        pt[i] = (s >>> 16) & 0xff;
      }
      const back = decryptFrame(encryptFrame(pt, w, iv), w, iv);
      expect(bytesToHex(back)).toBe(bytesToHex(pt));
    }
  });

  it('does not mutate the caller buffer', () => {
    const pt = hexToBytes('6804000000000000000000000000000000000000');
    const before = bytesToHex(pt);
    encryptFrame(pt, w, iv);
    decryptFrame(pt, w, iv);
    expect(bytesToHex(pt)).toBe(before);
  });

  it('a wrong MAC decrypts to something other than the plaintext', () => {
    // The failure mode a user actually hits: one wrong MAC byte and every
    // frame becomes noise. Locking this makes sure the MAC is really wired in.
    const badMac = macBytes('AB:12:34:56:78:9B');
    const badW = expandKey(deriveKeyFromMac(GAN_KEY_BASE, badMac));
    const badIv = deriveKeyFromMac(GAN_IV_BASE, badMac);
    const ct = hexToBytes('e169ea4337231069f4ddbbb7b8aa35758007e4ff');
    expect(bytesToHex(decryptFrame(ct, badW, badIv)))
      .not.toBe('6804000000000000000000000000000000000000');
  });
});

describe('MoYu32 key schedule', () => {
  it('uses the base key/IV csTimer ships LZString-compressed in moyu32cube.js', () => {
    // KEYS[0] / KEYS[1] of `moyu32cube.js`, decompressed with csTimer's own
    // `lib/lzstring.js`. Identical to the "Root key" / "Root IV" hex in
    // lukeburong/weilong-v10-ai-protocol, which is an independent confirmation.
    expect(bytesToHex(MOYU32_KEY_BASE)).toBe('15773a5c670e2d1f17672a139b675257');
    expect(bytesToHex(MOYU32_IV_BASE)).toBe('11232625862a2c3b55067f317e672157');
  });

  it('derives + encrypts a request frame exactly as csTimer does', () => {
    // MAC CF:30:16:00:AB:CD is the vendor default a `WCU_MY32_ABCD` name
    // implies, so this is the realistic first-connect path.
    const mac = macBytes('CF:30:16:00:AB:CD');
    const key = deriveKeyFromMac(MOYU32_KEY_BASE, mac);
    const iv = deriveKeyFromMac(MOYU32_IV_BASE, mac);
    expect(bytesToHex(key)).toBe('e2233a7297dd2d1f17672a139b675257');
    expect(bytesToHex(iv)).toBe('dece263bb6f92c3b55067f317e672157');

    const w = expandKey(key);
    const a1 = hexToBytes('a100000000000000000000000000000000000000');
    expect(bytesToHex(encryptFrame(a1, w, iv)))
      .toBe('491cb42be0b739d6797f35a4c9165fb50882663c');
    expect(bytesToHex(decryptFrame(hexToBytes('491cb42be0b739d6797f35a4c9165fb50882663c'), w, iv)))
      .toBe(bytesToHex(a1));
  });
});

describe('QiYi AES-ECB', () => {
  it('matches csTimer for the fixed factory key', () => {
    const w = expandKey(QIYI_KEY);
    const pt = hexToBytes('fe10020000000102030405060708090a');
    const ct = aesEcbEncrypt(pt, w);
    expect(bytesToHex(ct)).toBe('0f2a23eb3bb3ab86b6b677ac9a3b4768');
    expect(bytesToHex(aesEcbDecrypt(ct, w))).toBe(bytesToHex(pt));
  });

  it('encrypts each 16-byte block independently (that is what ECB means)', () => {
    const w = expandKey(QIYI_KEY);
    const block = hexToBytes('fe10020000000102030405060708090a');
    const twice = new Uint8Array(32);
    twice.set(block, 0);
    twice.set(block, 16);
    const ct = aesEcbEncrypt(twice, w);
    expect(bytesToHex(ct.subarray(0, 16))).toBe('0f2a23eb3bb3ab86b6b677ac9a3b4768');
    expect(bytesToHex(ct.subarray(16))).toBe('0f2a23eb3bb3ab86b6b677ac9a3b4768');
  });
});

describe('bit readers', () => {
  it('toBitReader reads big-endian bit ranges like csTimer parseInt(slice, 2)', () => {
    const bit = toBitReader(hexToBytes('a5f00f12'));
    expect(bit(0, 8)).toBe(0xa5);
    expect(bit(0, 4)).toBe(0xa);
    expect(bit(4, 8)).toBe(0x5);
    expect(bit(8, 24)).toBe(0xf00f);
    expect(bit(12, 20)).toBe(0x00);
  });

  it('readBits agrees with toBitReader over every aligned and unaligned range', () => {
    const buf = hexToBytes('a5f00f12deadbeef');
    const bit = toBitReader(buf);
    for (let off = 0; off < 48; off++) {
      for (const n of [1, 3, 5, 8, 12, 16]) {
        expect(readBits(buf, off, n)).toBe(bit(off, off + n));
      }
    }
  });

  it('readBits returns 0 rather than reading past the buffer', () => {
    // A truncated notification must not decode into a nonsense move.
    const buf = hexToBytes('a5f0');
    expect(readBits(buf, 8, 16)).toBe(0);
    expect(readBits(buf, -1, 4)).toBe(0);
    expect(readBits(buf, 0, 0)).toBe(0);
  });

  it('readBits handles a full 16-bit word at the very end of the buffer', () => {
    const buf = hexToBytes('0000ffff');
    expect(readBits(buf, 16, 16)).toBe(0xffff);
  });
});

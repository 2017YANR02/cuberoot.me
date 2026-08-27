/**
 * Cube MAC-address discovery for Web Bluetooth.
 *
 * GAN / MoYu / QiYi smart cubes derive their per-cube AES key from the
 * Bluetooth MAC. Native apps read it from `BluetoothDevice.getAddress()`, but
 * the Web Bluetooth spec deliberately hides the MAC (the `device.id` is a
 * randomized per-origin token). So in the browser we recover it via, in order:
 *
 *   1. BLE advertisement manufacturer data (`watchAdvertisements`), the same
 *      trick cstimer uses — needs the device to have been requested with
 *      `optionalManufacturerData` and the browser to support the (still
 *      experimental on some Chromes) advertisement API.
 *   2. A MAC embedded in the device name ("GAN-…-XXYYZZ").
 *   3. A value the user typed in a previous session (persisted per device).
 *   4. A manual prompt (handled by the hook / UI layer, not here).
 *
 * Brands disagree on BOTH halves of this, so both are parameterised (see
 * `MacAdvSpec`): the CIC list to ask Chrome for, and how to read six bytes
 * out of the manufacturer payload. Faithful to cstimer's `gancube.js`,
 * `moyu32cube.js`, `qiyicube.js` / `qiyitimer.js` and `bluetooth.js`.
 */

import { persistItem } from '@/lib/safe-storage';

/**
 * Company Identifier Codes GAN cubes may advertise under. cstimer fills the
 * full range [0x0001, 0xFF01] stepping by 0x0100 (256 values), because GAN's
 * CIC has changed across firmware batches.
 */
export const GAN_CIC_LIST: number[] = Array.from({ length: 256 }, (_v, i) => (i << 8) | 0x01);

/**
 * Company Identifier Codes MoYu32 (WCU_MY32_*) cubes advertise under:
 * 0x0100 .. 0xFF00, i.e. `(i + 1) << 8` for i in 0..254.
 *
 * cstimer's `moyu32cube.js` explains why the list looks like this: once the
 * cube is bound in the WCU app its CIC becomes the two high bytes of the
 * 32-bit account ID (little-endian), so it is effectively arbitrary. 0x0000
 * is deliberately EXCLUDED — Chromium's `WTF::HashMap` rejects 0 as a key and
 * asking for it breaks `device.gatt.connect()` outright. Consequence: unbound
 * cubes, and cubes bound to an account ID below 65536, have no auto-MAC and
 * fall through to the manual prompt.
 */
export const MOYU32_CIC_LIST: number[] = Array.from({ length: 255 }, (_v, i) => (i + 1) << 8);

/** The single CIC QiYi uses for both the smart cube and the smart timer. */
export const QIYI_CIC_LIST: number[] = [0x0504];

/**
 * How to pull six MAC bytes out of a manufacturer-data payload.
 *
 *   'last6-reversed'  — GAN and MoYu32. cstimer reads
 *                       `dv[byteLength - 1 - i]` for i in 0..5.
 *   'first6-reversed' — QiYi (cube and timer). cstimer reads `dv[5 - i]`,
 *                       i.e. `qiyitimer.js:200-203` / `qiyicube.js:96-98`.
 *
 * Both end up little-endian relative to their window; they differ only in
 * WHICH six bytes of the payload carry the address.
 */
export type MacPayloadLayout = 'last6-reversed' | 'first6-reversed';

/** A brand's advertisement fingerprint: where to look, and how to read it. */
export interface MacAdvSpec {
  /** Label used only in comments / debugging. */
  brand: string;
  /** CICs to match against `manufacturerData`, in order. */
  cics: readonly number[];
  /** Payload layout for this brand. */
  layout: MacPayloadLayout;
  /**
   * Truncate the payload to this many bytes before applying the layout.
   * cstimer's GAN path slices the manufacturer data to 9 bytes
   * (`gancube.js:168`) before taking the last six; its MoYu32 and QiYi paths
   * do not slice at all. For a 9-byte payload the two agree, but a longer
   * payload would read a different window, so keep the distinction.
   */
  maxPayloadBytes?: number;
}

export const GAN_MAC_ADV: MacAdvSpec = {
  brand: 'gan',
  cics: GAN_CIC_LIST,
  layout: 'last6-reversed',
  maxPayloadBytes: 9,
};

export const MOYU32_MAC_ADV: MacAdvSpec = {
  brand: 'moyu32',
  cics: MOYU32_CIC_LIST,
  layout: 'last6-reversed',
};

export const QIYI_MAC_ADV: MacAdvSpec = {
  brand: 'qiyi',
  cics: QIYI_CIC_LIST,
  layout: 'first6-reversed',
};

/** Every spec we know, in the order the hook tries them by default. */
export const ALL_MAC_ADV_SPECS: readonly MacAdvSpec[] = [GAN_MAC_ADV, MOYU32_MAC_ADV, QIYI_MAC_ADV];

/**
 * Reorder the spec list so the brand the device NAME points at is tried
 * first. This only matters for the Bluefy code path, where the browser hands
 * us a bare `DataView` with no CIC attached and we therefore cannot tell the
 * brands apart from the data alone.
 */
export function macAdvSpecsForDevice(name: string | null | undefined): readonly MacAdvSpec[] {
  const n = (name ?? '').trim();
  if (/^WCU/i.test(n)) return [MOYU32_MAC_ADV, GAN_MAC_ADV, QIYI_MAC_ADV];
  if (/^(QY-QYSC|XMD-Tornado|QY-Timer)/i.test(n)) return [QIYI_MAC_ADV, GAN_MAC_ADV, MOYU32_MAC_ADV];
  return ALL_MAC_ADV_SPECS;
}

const MAC_RE = /^([0-9a-f]{2}[:-]){5}[0-9a-f]{2}$/i;

/** Validate + normalize to upper-case colon-separated "XX:XX:XX:XX:XX:XX". */
export function normalizeMac(mac: string | null | undefined): string | null {
  if (!mac) return null;
  const trimmed = mac.trim();
  if (!MAC_RE.test(trimmed)) return null;
  return trimmed.replace(/-/g, ':').toUpperCase();
}

/** "AA:BB:CC:DD:EE:FF" -> Uint8Array([0xAA, ...]). Returns zeros on bad input. */
export function macStringToBytes(mac: string | null | undefined): Uint8Array {
  const out = new Uint8Array(6);
  const norm = normalizeMac(mac);
  if (!norm) return out;
  const parts = norm.split(':');
  for (let i = 0; i < 6; i++) out[i] = parseInt(parts[i], 16);
  return out;
}

/**
 * Read six MAC bytes out of a `len`-byte payload accessed through `getByte`,
 * per `spec`. Returns "XX:XX:XX:XX:XX:XX" or null when the payload is short.
 */
function macFromPayload(
  getByte: (k: number) => number,
  len: number,
  spec: MacAdvSpec,
): string | null {
  const n = spec.maxPayloadBytes === undefined ? len : Math.min(len, spec.maxPayloadBytes);
  if (n < 6) return null;
  const parts: string[] = [];
  for (let i = 0; i < 6; i++) {
    // 'last6-reversed': dv[n-1], dv[n-2], … dv[n-6]  (GAN, MoYu32)
    // 'first6-reversed': dv[5],  dv[4],   … dv[0]    (QiYi cube + timer)
    const idx = spec.layout === 'last6-reversed' ? n - 1 - i : 5 - i;
    parts.push((getByte(idx) & 0xff).toString(16).padStart(2, '0'));
  }
  return parts.join(':').toUpperCase();
}

/**
 * Pull the cube MAC out of an `advertisementreceived` event's manufacturer
 * data. Handles both the Chrome `Map<companyId, DataView>` shape and Bluefy's
 * bare `DataView` (which keeps the 2-byte company-id prefix).
 *
 * `specs` is tried in order; the first CIC hit wins. On the Bluefy path there
 * is no CIC to match on, so `specs[0]`'s layout is used — which is why
 * `macAdvSpecsForDevice` puts the name-implied brand first.
 */
export function extractMacFromManufacturerData(
  mfData: BluetoothManufacturerData | DataView,
  specs: readonly MacAdvSpec[] = ALL_MAC_ADV_SPECS,
): string | null {
  if (specs.length === 0) return null;
  if (mfData instanceof DataView) {
    // Bluefy: [companyId(2)] [payload…] — skip the 2-byte prefix.
    const payloadStart = 2;
    const len = Math.max(0, mfData.byteLength - payloadStart);
    return macFromPayload((k) => mfData.getUint8(payloadStart + k), len, specs[0]);
  }
  for (const spec of specs) {
    for (const id of spec.cics) {
      if (!mfData.has(id)) continue;
      const dv = mfData.get(id);
      if (!dv) continue;
      const mac = macFromPayload((k) => dv.getUint8(k), dv.byteLength, spec);
      if (mac) return mac;
    }
  }
  return null;
}

/** Options for `watchAdvertisementsMac`. */
export interface MacWatchOptions {
  /**
   * CICs to accept. Together with `layout` this forms an ad-hoc single spec,
   * overriding `specs`. Provided because a caller that already knows the
   * brand shouldn't have to build a `MacAdvSpec`.
   */
  cics?: readonly number[];
  /** Payload layout to pair with `cics`. Defaults to GAN's. */
  layout?: MacPayloadLayout;
  /** Full spec list to try in order. Defaults to `macAdvSpecsForDevice`. */
  specs?: readonly MacAdvSpec[];
  /** Give up after this long. cstimer waits 10s. */
  timeoutMs?: number;
  /** Observe each advertisement without exposing its manufacturer payload. */
  onAdvertisement?: (observation: MacAdvertisementObservation) => void;
}

/** User-safe progress for diagnosing how many advertisements MAC recovery needs. */
export interface MacAdvertisementObservation {
  /** 1-based position among advertisement events delivered to this page. */
  eventNumber: number;
  /** Time since `watchAdvertisementsMac` started listening. */
  elapsedMs: number;
  /** This event carried enough recognized manufacturer data to recover a MAC. */
  complete: boolean;
}

/**
 * Best-effort MAC via BLE advertisements. Resolves the MAC string, or null if
 * the API is unsupported, times out, or carries no recognizable manufacturer
 * data. Never rejects — the caller treats null as "fall through to next
 * source". Default 10s timeout matches cstimer.
 */
export function watchAdvertisementsMac(
  device: BluetoothDevice,
  opts: MacWatchOptions = {},
): Promise<string | null> {
  const specs: readonly MacAdvSpec[] = opts.cics
    ? [{ brand: 'custom', cics: opts.cics, layout: opts.layout ?? 'last6-reversed' }]
    : (opts.specs ?? macAdvSpecsForDevice(device.name));
  const timeoutMs = opts.timeoutMs ?? 10000;
  if (typeof device.watchAdvertisements !== 'function') return Promise.resolve(null);
  return new Promise<string | null>((resolve) => {
    const abort = new AbortController();
    const startedAt = performance.now();
    let eventNumber = 0;
    let done = false;
    const finish = (mac: string | null): void => {
      if (done) return;
      done = true;
      device.removeEventListener('advertisementreceived', onAdv);
      try { abort.abort(); } catch { /* ignore */ }
      clearTimeout(timer);
      resolve(mac);
    };
    const onAdv = (ev: BluetoothAdvertisingEvent): void => {
      // Bluefy can deliver an initial advertisement without the selected
      // cube's manufacturer payload, followed shortly by a complete one. An
      // empty first event is not evidence that this device has no MAC: keep
      // listening until a recognizable payload arrives or the timeout fires.
      eventNumber += 1;
      const mac = extractMacFromManufacturerData(ev.manufacturerData, specs);
      opts.onAdvertisement?.({
        eventNumber,
        elapsedMs: Math.max(0, Math.round(performance.now() - startedAt)),
        complete: mac !== null,
      });
      if (mac) finish(mac);
    };
    const timer = setTimeout(() => finish(null), timeoutMs);
    device.addEventListener('advertisementreceived', onAdv);
    try {
      const p = device.watchAdvertisements({ signal: abort.signal });
      // Some browsers reject when the API is gated behind a flag.
      void Promise.resolve(p).catch(() => finish(null));
    } catch {
      finish(null);
    }
  });
}

/**
 * Parse a MAC embedded in the BLE device name. GAN names sometimes end in the
 * full 6-byte MAC ("…-AABBCCDDEEFF") or just the last 3 bytes ("…-DDEEFF"), in
 * which case we prepend GAN's OUI. Returns "XX:XX:…" or null.
 */
export function parseMacFromName(name: string | null | undefined): string | null {
  if (!name) return null;
  // Only trust a FULL 6-byte MAC embedded in the name. We deliberately do NOT
  // fabricate one from a 3-byte suffix + a guessed OUI: GAN uses several OUIs
  // across batches, so a guess derives a wrong key and fails silently — better
  // to fall through to advertisements / the manual prompt.
  const m12 = /([0-9A-Fa-f]{12})$/.exec(name);
  if (m12) return normalizeMac(m12[1].match(/.{2}/g)!.join(':'));
  return null;
}

/* ------------------------------------------------------------------ */
/*  Persisted manual MACs (keyed by device name)                       */
/* ------------------------------------------------------------------ */

const STORE_KEY = 'cuberoot.timer.ganMacMap';

function readMap(): Record<string, string> {
  if (typeof localStorage === 'undefined') return {};
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY) || '{}') as Record<string, string>;
  } catch {
    return {};
  }
}

export function savedMac(deviceName: string | null | undefined): string | null {
  if (!deviceName) return null;
  return normalizeMac(readMap()[deviceName]);
}

export function saveMac(deviceName: string | null | undefined, mac: string): void {
  if (typeof localStorage === 'undefined' || !deviceName) return;
  const norm = normalizeMac(mac);
  if (!norm) return;
  const map = readMap();
  if (map[deviceName] === norm) return;
  map[deviceName] = norm;
  persistItem(STORE_KEY, JSON.stringify(map));
}

/** Forget a stored MAC (used after a wrong-MAC re-prompt). */
export function clearMac(deviceName: string | null | undefined): void {
  if (typeof localStorage === 'undefined' || !deviceName) return;
  const map = readMap();
  if (!(deviceName in map)) return;
  delete map[deviceName];
  persistItem(STORE_KEY, JSON.stringify(map));
}

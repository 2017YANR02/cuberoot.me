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
 * This module is faithful to cstimer's `gancube.js` / `bluetooth.js`:
 *   - the GAN company-identifier-code (CIC) list,
 *   - the "last 6 manufacturer-data bytes, reversed" MAC layout.
 */

/**
 * Company Identifier Codes GAN cubes may advertise under. cstimer fills the
 * full range [0x0001, 0xFF01] stepping by 0x0100 (256 values), because GAN's
 * CIC has changed across firmware batches.
 */
export const GAN_CIC_LIST: number[] = Array.from({ length: 256 }, (_v, i) => (i << 8) | 0x01);

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
 * Extract the MAC from the last 6 bytes (reversed) of `len` data bytes read
 * via `getByte`. Mirrors cstimer: it slices the manufacturer payload to 9
 * bytes and reads `dv[byteLength - i - 1]` for i in 0..5.
 */
function macFromPayload(getByte: (k: number) => number, len: number): string | null {
  const n = Math.min(len, 9);
  if (n < 6) return null;
  const parts: string[] = [];
  for (let i = 0; i < 6; i++) {
    parts.push((getByte(n - 1 - i) & 0xff).toString(16).padStart(2, '0'));
  }
  return parts.join(':').toUpperCase();
}

/**
 * Pull the cube MAC out of an `advertisementreceived` event's manufacturer
 * data. Handles both the Chrome `Map<companyId, DataView>` shape and Bluefy's
 * bare `DataView` (which keeps the 2-byte company-id prefix).
 */
export function extractMacFromManufacturerData(
  mfData: BluetoothManufacturerData | DataView,
): string | null {
  if (mfData instanceof DataView) {
    // Bluefy: [companyId(2)] [payload(9)] — skip the 2-byte prefix.
    const payloadStart = 2;
    const len = Math.max(0, mfData.byteLength - payloadStart);
    return macFromPayload((k) => mfData.getUint8(payloadStart + k), len);
  }
  for (const id of GAN_CIC_LIST) {
    if (mfData.has(id)) {
      const dv = mfData.get(id);
      if (!dv) continue;
      return macFromPayload((k) => dv.getUint8(k), dv.byteLength);
    }
  }
  return null;
}

/**
 * Best-effort MAC via BLE advertisements. Resolves the MAC string, or null if
 * the API is unsupported, times out, or carries no recognizable manufacturer
 * data. Never rejects — the caller treats null as "fall through to next
 * source". Default 10s timeout matches cstimer.
 */
export function watchAdvertisementsMac(device: BluetoothDevice, timeoutMs = 10000): Promise<string | null> {
  if (typeof device.watchAdvertisements !== 'function') return Promise.resolve(null);
  return new Promise<string | null>((resolve) => {
    const abort = new AbortController();
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
      finish(extractMacFromManufacturerData(ev.manufacturerData));
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
  try { localStorage.setItem(STORE_KEY, JSON.stringify(map)); } catch { /* ignore */ }
}

/** Forget a stored MAC (used after a wrong-MAC re-prompt). */
export function clearMac(deviceName: string | null | undefined): void {
  if (typeof localStorage === 'undefined' || !deviceName) return;
  const map = readMap();
  if (!(deviceName in map)) return;
  delete map[deviceName];
  try { localStorage.setItem(STORE_KEY, JSON.stringify(map)); } catch { /* ignore */ }
}

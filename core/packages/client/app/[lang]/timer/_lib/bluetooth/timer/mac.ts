/**
 * MAC-address discovery for the QiYi Timer / QiYi Adapter.
 *
 * The QiYi timer does not derive its AES key from the MAC (that key is fixed —
 * see `./qiyi_timer.ts`), but its hello message carries the MAC as a payload
 * and the device ignores a hello whose MAC does not match its own. So we still
 * have to find it. Web Bluetooth hides the real address, so, exactly as
 * csTimer does (`qiyitimer.js:196-236`):
 *
 *   1. BLE advertisement manufacturer data under CIC 0x0504.
 *   2. A prefix + the four hex digits at the end of the device name.
 *   3. Ask the user (handled by the caller, not here).
 *
 * !! Layout differs from the cube drivers !!
 * `../mac.ts` reads the LAST six manufacturer-data bytes reversed (GAN / MoYu /
 * QiYi *cubes*). The QiYi *timer* reads the FIRST six bytes reversed:
 * `qiyitimer.js:199-203` loops `i = 5 .. 0` over the payload from index 0.
 * Getting this backwards yields a plausible-looking but wrong MAC and the
 * timer simply never answers the hello.
 *
 * This module duplicates the advertisement-watching plumbing of `../mac.ts`
 * because that file is owned by another workstream right now. Once it lands,
 * `watchAdvertisementsMac` should grow a `(cics, layout)` parameterisation and
 * this file should shrink to just the QiYi-timer constants + name fallback.
 */

/** Company Identifier Code QiYi timers advertise under (qiyitimer.js:9). */
export const QIYI_TIMER_CIC_LIST: readonly number[] = [0x0504];

const MAC_RE = /^([0-9a-f]{2}:){5}[0-9a-f]{2}$/i;

/** Validate + normalise to upper-case "XX:XX:XX:XX:XX:XX", else null. */
export function normalizeTimerMac(mac: string | null | undefined): string | null {
  if (!mac) return null;
  const trimmed = mac.trim().replace(/-/g, ':');
  if (!MAC_RE.test(trimmed)) return null;
  return trimmed.toUpperCase();
}

/** Read six bytes from index 0..5 and join them REVERSED. */
function macFromPayloadHead(getByte: (k: number) => number, len: number): string | null {
  if (len < 6) return null;
  const parts: string[] = [];
  for (let i = 5; i >= 0; i--) {
    parts.push((getByte(i) & 0xff).toString(16).padStart(2, '0'));
  }
  return parts.join(':').toUpperCase();
}

/**
 * Pull the timer MAC out of an `advertisementreceived` event's manufacturer
 * data. Handles Chrome's `Map<companyId, DataView>` and Bluefy's bare
 * `DataView` (which keeps the 2-byte company-id prefix — csTimer's
 * `getManufacturerDataBytes` workaround).
 */
export function extractQiyiTimerMac(
  mfData: BluetoothManufacturerData | DataView,
): string | null {
  if (mfData instanceof DataView) {
    const start = 2;
    return macFromPayloadHead(
      (k) => mfData.getUint8(start + k),
      Math.max(0, mfData.byteLength - start),
    );
  }
  for (const id of QIYI_TIMER_CIC_LIST) {
    if (!mfData.has(id)) continue;
    const dv = mfData.get(id);
    if (!dv) continue;
    const mac = macFromPayloadHead((k) => dv.getUint8(k), dv.byteLength);
    if (mac) return mac;
  }
  return null;
}

/**
 * Fabricate the MAC from the device name. QiYi burns a fixed OUI-ish prefix
 * per product line and puts the low two bytes in the name
 * (`qiyitimer.js:230-234`):
 *
 *   QY-Timer-…-XXXX    ->  CC:A1:00:00:XX:XX
 *   QY-Adapter-…-XXXX  ->  CC:A8:00:00:XX:XX
 */
export function qiyiTimerMacFromName(name: string | null | undefined): string | null {
  if (!name) return null;
  const m = /^QY-(?:Timer|Adapter).*-([0-9A-F]{4})$/.exec(name.trim());
  if (!m) return null;
  const prefix = name.trim().startsWith('QY-Adapter') ? 'CC:A8' : 'CC:A1';
  return `${prefix}:00:00:${m[1].slice(0, 2)}:${m[1].slice(2, 4)}`.toUpperCase();
}

/** "AA:BB:CC:DD:EE:FF" -> [0xAA, ...]. Returns null on malformed input. */
export function timerMacToBytes(mac: string | null | undefined): Uint8Array | null {
  const norm = normalizeTimerMac(mac);
  if (!norm) return null;
  const out = new Uint8Array(6);
  const parts = norm.split(':');
  for (let i = 0; i < 6; i++) out[i] = parseInt(parts[i], 16);
  return out;
}

/**
 * Best-effort MAC via BLE advertisements. Never rejects — resolves null when
 * the API is unsupported, times out, or carries no recognisable manufacturer
 * data, so the caller can fall through to the name / prompt sources. The 10s
 * default matches csTimer's `waitForAdvs`.
 */
export function watchQiyiTimerAdvertisementsMac(
  device: BluetoothDevice,
  timeoutMs = 10000,
): Promise<string | null> {
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
      finish(extractQiyiTimerMac(ev.manufacturerData));
    };
    const timer = setTimeout(() => finish(null), timeoutMs);
    device.addEventListener('advertisementreceived', onAdv);
    try {
      const p = device.watchAdvertisements({ signal: abort.signal });
      void Promise.resolve(p).catch(() => finish(null));
    } catch {
      finish(null);
    }
  });
}

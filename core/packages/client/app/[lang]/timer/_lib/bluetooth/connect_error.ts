/**
 * What went wrong while connecting, and *where*.
 *
 * Motivated by a real, undiagnosable report from iOS: "连接失败：2". Bluefy
 * implements Web Bluetooth over a native bridge and rejects with a bare value
 * — that `2` is a native error code passed through verbatim, not a
 * DOMException. The old call sites did `(err as Error).message ?? String(err)`,
 * which reduced that to a single character and threw away everything else:
 *
 *   - `name`, `code`, and even the *type* of the rejected value (a numeric `2`
 *     and a string `'2'` mean different bridge behaviours, and we couldn't tell);
 *   - which step failed — picking the device, opening GATT, identifying the
 *     cube, or the handshake all collapsed into the same opaque line;
 *   - `err instanceof DOMException && err.name === 'NotFoundError'` — the test
 *     for "the user closed the picker" — can never hold for a bare value, so
 *     dismissing the picker is silent on Chrome but raises a scary failure on
 *     Bluefy.
 *
 * This module does not guess what `2` means (Bluefy publishes no code table, so
 * a guess would be unverifiable). It preserves the scene instead: the stage,
 * plus the rejected value's name / code / text / type. The next failure
 * describes itself.
 */

/** The steps `connect()` walks through, in order. */
export type ConnectStage =
  /**
   * The chooser was refused while `getAvailability()` never once said yes.
   * Its own stage because the browser's raw complaint is worthless here — iOS
   * Bluefy says `2` — while the real cause is plain and worth saying out loud:
   * the adapter had not woken up. Ordering matters to nothing but reading:
   * it sits before `picker` because it happens instead of it.
   */
  | 'adapter-asleep'
  | 'picker'          // navigator.bluetooth.requestDevice — the browser's chooser
  | 'advertisement'   // watchAdvertisements — best-effort MAC recovery
  | 'gatt'            // device.gatt.connect()
  | 'discover'        // service discovery + driver selection
  | 'handshake';      // driver.start — key exchange, subscriptions

export const CONNECT_STAGE_LABEL: Record<ConnectStage, { en: string; zh: string }> = {
  'adapter-asleep': { en: 'waiting for Bluetooth to wake up', zh: '等待蓝牙就绪' },
  picker: { en: 'choosing the device', zh: '选择设备' },
  advertisement: { en: 'reading the BLE advertisement', zh: '读取蓝牙广播' },
  gatt: { en: 'opening the GATT connection', zh: '建立 GATT 连接' },
  discover: { en: 'identifying the cube', zh: '识别魔方型号' },
  handshake: { en: 'the handshake', zh: '握手并订阅数据' },
};

/** Property read that survives exotic throwables (proxies, throwing getters). */
function readProp(obj: object, key: string): unknown {
  try {
    return (obj as Record<string, unknown>)[key];
  } catch {
    return undefined;
  }
}

/**
 * The `name` of a rejected value, or null when it has none.
 *
 * Deliberately structural rather than `instanceof DOMException`: a bridge that
 * mimics the spec's error names deserves the same handling as the real thing,
 * and cross-realm DOMExceptions fail `instanceof` anyway.
 */
export function errorName(err: unknown): string | null {
  if (typeof err !== 'object' || err === null) return null;
  const name = readProp(err, 'name');
  return typeof name === 'string' && name !== '' ? name : null;
}

/**
 * One readable line describing a rejected value, losing as little as possible.
 *
 * Bare values carry their type, because for those the type is the only extra
 * signal there is — `2` alone is what made the original report undiagnosable.
 */
export function describeError(err: unknown): string {
  if (err === null) return 'null';
  if (err === undefined) return 'undefined';
  if (typeof err !== 'object') {
    if (typeof err === 'string') return err.trim() === '' ? "'' (empty string)" : err.trim();
    return `${String(err)} (${typeof err})`;
  }

  const name = errorName(err);
  const rawMsg = readProp(err, 'message');
  const message = typeof rawMsg === 'string' ? rawMsg.trim() : '';
  const rawCode = readProp(err, 'code');
  const code = typeof rawCode === 'number' || typeof rawCode === 'string' ? String(rawCode) : '';

  const head = [name, message].filter(Boolean).join(': ');
  // Keep `code` even when there's a name — native bridges put the only useful
  // number there (`{ name: 'NetworkError', code: 2 }`).
  if (head) return code !== '' && !head.includes(code) ? `${head} (code ${code})` : head;
  if (code !== '') return `code ${code}`;

  const tag = Object.prototype.toString.call(err);
  try {
    const json = JSON.stringify(err);
    if (json !== undefined && json !== '{}') return `${tag} ${json}`;
  } catch {
    /* circular / non-serialisable — the tag alone will have to do */
  }
  return tag;
}

/**
 * True when `requestDevice` rejected because nothing was chosen — the user
 * dismissed the chooser, or it found no matching device. Not a failure: the
 * caller simply returns, leaving the connection state untouched.
 */
const NO_SELECTION_NAMES = new Set(['NotFoundError', 'NotAllowedError', 'AbortError']);

export function isNoDeviceSelected(err: unknown): boolean {
  const name = errorName(err);
  return name !== null && NO_SELECTION_NAMES.has(name);
}

/** A connect failure that remembers which step produced it and what was thrown. */
export class BluetoothConnectError extends Error {
  readonly stage: ConnectStage;
  /** Exactly what the browser threw. The only trustworthy diagnostic — never drop it. */
  readonly raw: unknown;
  /** `describeError(raw)`; what the UI shows. */
  readonly detail: string;

  constructor(stage: ConnectStage, raw: unknown) {
    const detail = describeError(raw);
    super(`${stage}: ${detail}`);
    this.name = 'BluetoothConnectError';
    this.stage = stage;
    this.raw = raw;
    this.detail = detail;
  }
}

/**
 * Tag a thrown value with the stage it came from. Already-tagged errors pass
 * through unchanged so the innermost (most specific) stage wins.
 */
export function atStage(stage: ConnectStage, err: unknown): BluetoothConnectError {
  return err instanceof BluetoothConnectError ? err : new BluetoothConnectError(stage, err);
}

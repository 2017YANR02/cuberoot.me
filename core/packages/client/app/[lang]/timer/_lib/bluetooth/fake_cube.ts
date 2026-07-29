/**
 * Dev-only fake smart cube.
 *
 * We own no physical smart cube, so without this nothing downstream of the BLE
 * layer — scramble verification, auto-stop, the live cube view, per-move
 * timing, CFOP splitting — can be exercised in a browser at all. The unit
 * tests cover the decoders; this covers everything the decoders feed.
 *
 * It is a fake PERIPHERAL, not a fake driver: it stands up the real GAN v4
 * GATT surface (service, notify + command characteristics) and emits real,
 * AES-encrypted GAN v4 frames. `ganV4Driver` runs against it completely
 * unmodified, including the move FIFO, the lost-move recovery handshake and
 * the facelets snapshot. Anything that works here works on hardware modulo the
 * radio itself.
 *
 * Usage from the browser console on a dev build:
 *
 *     __cuberootFakeCube.arm()          // next "connect cube" attaches to this
 *     // ...click Connect in the UI...
 *     __cuberootFakeCube.apply("R U R'")
 *     __cuberootFakeCube.scramble()     // apply whatever the page is showing
 *     __cuberootFakeCube.solve()        // back to solved, fires auto-stop
 *     __cuberootFakeCube.dropNext(2)    // swallow the next 2 notifications
 *     __cuberootFakeCube.state()        // facelet string, for assertions
 *
 * Compiled out of production builds: every entry point is behind a
 * `process.env.NODE_ENV !== 'production'` check, and `installFakeCube()` is
 * only ever called from the dev branch of the connect path.
 */

import {
  applyCubieAlg, cubieStateToWire, cubieToFacelets, solvedCubie, type CubieState,
} from '../cube/cubie';
import {
  decryptFrame, deriveKeyFromMac, encryptFrame, expandKey, type AesRoundKeys,
} from './gan_crypto';
import { macStringToBytes } from './mac';

const SERVICE = '00000010-0000-fff7-fff6-fff5fff4fff0';
const NOTIFY_CHAR = '0000fff6-0000-1000-8000-00805f9b34fb';
const COMMAND_CHAR = '0000fff5-0000-1000-8000-00805f9b34fb';

/** Any MAC will do — both sides derive the same key from it. */
const FAKE_MAC = 'AB:CD:EF:01:23:45';
const FAKE_NAME = 'GAN14-FAKE00';

/** Same base key/IV as the real v4 driver (csTimer's KEYS[2] / KEYS[3]). */
const KEY_BASE = new Uint8Array([
  0x01, 0x02, 0x42, 0x28, 0x31, 0x91, 0x16, 0x07,
  0x20, 0x05, 0x18, 0x54, 0x42, 0x11, 0x12, 0x53,
]);
const IV_BASE = new Uint8Array([
  0x11, 0x03, 0x32, 0x28, 0x21, 0x01, 0x76, 0x27,
  0x20, 0x95, 0x78, 0x14, 0x32, 0x12, 0x02, 0x43,
]);

/** How many past moves the cube remembers, for history replies. */
const HISTORY_DEPTH = 64;
/** Where the fake cube's own clock starts, so it is visibly not local time. */
const DEVICE_CLOCK_EPOCH = 1_234_567;

/* ------------------------------------------------------------------ */
/*  Bit packing (mirrors the frame layouts in gan_v4.ts)              */
/* ------------------------------------------------------------------ */

type BitWrite = [start: number, len: number, value: number];

function packBits(totalBytes: number, writes: BitWrite[]): Uint8Array {
  const bits = new Uint8Array(totalBytes * 8);
  for (const [start, len, value] of writes) {
    for (let i = 0; i < len; i++) bits[start + i] = (value >>> (len - 1 - i)) & 1;
  }
  const out = new Uint8Array(totalBytes);
  for (let b = 0; b < totalBytes; b++) {
    let v = 0;
    for (let i = 0; i < 8; i++) v = (v << 1) | bits[b * 8 + i];
    out[b] = v;
  }
  return out;
}

const AXIS_ONEHOT = [2, 32, 8, 1, 16, 4];
/** Move events index "URFDLB"; history events index "DUBFLR". */
const HISTORY_AXIS_OF = (face: string): number => 'DUBFLR'.indexOf(face);

/* ------------------------------------------------------------------ */
/*  Fake GATT                                                         */
/* ------------------------------------------------------------------ */

class FakeChar extends EventTarget {
  value?: DataView;
  constructor(readonly uuid: string, private readonly onWrite?: (b: Uint8Array) => void) {
    super();
  }
  async startNotifications(): Promise<FakeChar> { return this; }
  async stopNotifications(): Promise<FakeChar> { return this; }
  async readValue(): Promise<DataView> { return new DataView(new ArrayBuffer(1)); }
  async writeValue(v: BufferSource): Promise<void> { this.onWrite?.(toU8(v)); }
  async writeValueWithResponse(v: BufferSource): Promise<void> { this.onWrite?.(toU8(v)); }
  async writeValueWithoutResponse(v: BufferSource): Promise<void> { this.onWrite?.(toU8(v)); }
  emit(bytes: Uint8Array): void {
    const ab = new ArrayBuffer(bytes.length);
    new Uint8Array(ab).set(bytes);
    this.value = new DataView(ab);
    this.dispatchEvent(new Event('characteristicvaluechanged'));
  }
}

function toU8(v: BufferSource): Uint8Array {
  return v instanceof ArrayBuffer
    ? new Uint8Array(v)
    : new Uint8Array((v as ArrayBufferView).buffer, (v as ArrayBufferView).byteOffset, (v as ArrayBufferView).byteLength);
}

/* ------------------------------------------------------------------ */
/*  The cube                                                          */
/* ------------------------------------------------------------------ */

export interface FakeCubeApi {
  /** Arm the fake so the next connect attaches to it instead of the picker. */
  arm(): void;
  /** Stop intercepting connects. Does not disconnect an attached session. */
  disarm(): void;
  armed: boolean;
  /** Turn the cube. Accepts any WCA face-move sequence; `R2` sends two frames. */
  apply(alg: string): void;
  /** Apply whatever scramble the page is currently showing. */
  scramble(): void;
  /** Return to solved by the shortest route this cube knows: undo its history. */
  solve(): void;
  /** Silently swallow the next `n` move notifications (simulates BLE loss). */
  dropNext(n: number): void;
  /** Current state as a 54-char facelet string. */
  state(): string;
  /** Re-send the state snapshot, as the real cube does on request. */
  announce(): void;
}

interface FakeSession {
  notify: FakeChar;
  /** Frames the host has asked for but that we answer asynchronously. */
  pendingHistory: { start: number; count: number } | null;
}

class FakeCube {
  armed = false;
  private state: CubieState = solvedCubie();
  /** Local time at power-on, the reference the device clock advances from. */
  private readonly bootLocal = Date.now();
  private moveCnt = 0;
  private history: { cnt: number; mv: string }[] = [];
  private dropCount = 0;
  private session: FakeSession | null = null;
  private readonly expandedKey: AesRoundKeys;
  private readonly iv: Uint8Array;

  constructor() {
    const mac = macStringToBytes(FAKE_MAC);
    this.expandedKey = expandKey(deriveKeyFromMac(KEY_BASE, mac));
    this.iv = deriveKeyFromMac(IV_BASE, mac);
  }

  /* -- host-facing device ------------------------------------------ */

  makeDevice(): BluetoothDevice {
    const cmd = new FakeChar(COMMAND_CHAR, (bytes) => this.onCommand(bytes));
    const notify = new FakeChar(NOTIFY_CHAR);
    this.session = { notify, pendingHistory: null };

    const service = {
      uuid: SERVICE,
      getCharacteristic: async (uuid: string | number) => {
        const u = String(uuid).toLowerCase();
        if (u === NOTIFY_CHAR) return notify as unknown as BluetoothRemoteGATTCharacteristic;
        if (u === COMMAND_CHAR) return cmd as unknown as BluetoothRemoteGATTCharacteristic;
        throw new Error(`fake cube: no characteristic ${uuid}`);
      },
      getCharacteristics: async () => [notify, cmd],
    };

    const device = new EventTarget() as unknown as BluetoothDevice & { gatt: unknown };
    const gatt = {
      device,
      connected: true,
      connect: async () => gatt,
      disconnect: () => { gatt.connected = false; this.session = null; },
      getPrimaryService: async (uuid: string | number) => {
        if (String(uuid).toLowerCase() === SERVICE) return service;
        throw new Error(`fake cube: no service ${uuid}`);
      },
      getPrimaryServices: async () => [service],
    };
    Object.defineProperties(device, {
      id: { value: 'fake-smart-cube' },
      name: { value: FAKE_NAME },
      gatt: { value: gatt },
      watchAdvertisements: { value: async () => {} },
    });
    return device;
  }

  /** The MAC the driver must be handed — the fake derives its key from it. */
  get mac(): string { return FAKE_MAC; }

  /* -- protocol ----------------------------------------------------- */

  private send(plain: Uint8Array): void {
    if (!this.session) return;
    this.session.notify.emit(encryptFrame(plain, this.expandedKey, this.iv));
  }

  private onCommand(bytes: Uint8Array): void {
    // Commands arrive encrypted. Decrypt with the driver's own routine rather
    // than pattern-matching ciphertext, so a change to the handshake surfaces
    // here instead of being silently ignored.
    const req = decryptFrame(bytes, this.expandedKey, this.iv);
    if (req[0] === 0xdd && req[3] === 0xed) { this.announce(); return; }   // facelets
    if (req[0] === 0xdd && req[3] === 0xef) { this.sendBattery(); return; } // battery
    if (req[0] === 0xd1) { this.sendHistory(req[2], req[4]); return; }      // history
    // 0xDF hardware info: nothing the host acts on.
  }

  announce(): void {
    const { corners, edges } = cubieStateToWire(this.state);
    this.send(packBits(20, [
      [0, 8, 0xed], [8, 8, 0x10],
      [16, 8, this.moveCnt & 0xff], [24, 8, (this.moveCnt >>> 8) & 0xff],
      ...corners.flatMap((c, i): BitWrite[] => [
        [32 + i * 3, 3, c & 7], [53 + i * 2, 2, (c >> 3) & 3],
      ]),
      ...edges.flatMap((e, i): BitWrite[] => [
        [69 + i * 4, 4, (e >> 1) & 0xf], [113 + i, 1, e & 1],
      ]),
    ]));
  }

  private sendBattery(): void {
    this.send(packBits(20, [[0, 8, 0xef], [8, 8, 1], [16, 8, 87]]));
  }

  private sendHistory(start: number, count: number): void {
    const moves: BitWrite[] = [];
    let n = 0;
    for (let i = 0; i < count; i++) {
      const cnt = (start - i) & 0xff;
      const rec = this.history.find((h) => (h.cnt & 0xff) === cnt);
      if (!rec) break;
      const face = rec.mv[0];
      const pow = rec.mv.endsWith("'") ? 1 : 0;
      moves.push([24 + 4 * n, 3, HISTORY_AXIS_OF(face)], [27 + 4 * n, 1, pow]);
      n++;
    }
    if (n === 0) return;
    const len = Math.ceil(n / 2) + 1;
    this.send(packBits(20, [[0, 8, 0xd1], [8, 8, len], [16, 8, start & 0xff], ...moves]));
  }

  /* -- turning ------------------------------------------------------ */

  private turnOnce(mv: string): void {
    this.state = applyCubieAlg(this.state, mv);
    this.moveCnt = (this.moveCnt + 1) & 0xffff;
    this.history.unshift({ cnt: this.moveCnt, mv });
    if (this.history.length > HISTORY_DEPTH) this.history.length = HISTORY_DEPTH;

    if (this.dropCount > 0) { this.dropCount--; return; }

    const face = 'URFDLB'.indexOf(mv[0]);
    const pow = mv.endsWith("'") ? 1 : 0;
    // The cube's own clock. Deliberately NOT local time: a real cube counts
    // from its own power-on, so the host has to reconcile the two rather than
    // read device time as if it were ours. Advancing it with wall time is what
    // makes the fake cube able to exercise `MoveClock` at all — a constant
    // here would hand every move the same timestamp.
    const deviceTs = (DEVICE_CLOCK_EPOCH + (Date.now() - this.bootLocal)) >>> 0;
    this.send(packBits(20, [
      [0, 8, 0x01], [8, 8, 0x08],
      [16, 8, deviceTs & 0xff], [24, 8, (deviceTs >>> 8) & 0xff],
      [32, 8, (deviceTs >>> 16) & 0xff], [40, 8, (deviceTs >>> 24) & 0xff],
      [48, 8, this.moveCnt & 0xff], [56, 8, (this.moveCnt >>> 8) & 0xff],
      [64, 2, pow], [66, 6, AXIS_ONEHOT[face]],
    ]));
  }

  apply(alg: string): void {
    for (const token of alg.trim().split(/\s+/)) {
      if (!token) continue;
      const face = token[0];
      if ('URFDLB'.indexOf(face) < 0) throw new Error(`fake cube: unsupported move "${token}"`);
      const suffix = token.slice(1);
      // A real cube only reports quarter turns; a half turn arrives as two.
      if (suffix === '2') { this.turnOnce(face); this.turnOnce(face); }
      else if (suffix === "'") this.turnOnce(`${face}'`);
      else if (suffix === '') this.turnOnce(face);
      else throw new Error(`fake cube: unsupported move "${token}"`);
    }
  }

  solve(): void {
    // Undo the recorded history newest-first. Enough for any session that
    // started solved, which is every session this thing is used for.
    const undo = this.history.map((h) => (h.mv.endsWith("'") ? h.mv[0] : `${h.mv}'`));
    this.history = [];
    for (const mv of undo) this.turnOnce(mv);
    this.history = [];
  }

  dropNext(n: number): void { this.dropCount = n; }

  facelets(): string { return cubieToFacelets(this.state); }
}

/* ------------------------------------------------------------------ */
/*  Install                                                           */
/* ------------------------------------------------------------------ */

let singleton: FakeCube | null = null;

declare global {
  interface Window { __cuberootFakeCube?: FakeCubeApi }
}

/**
 * Publish the console API. Safe to call repeatedly; a no-op in production and
 * outside the browser.
 */
export function installFakeCube(getScramble: () => string): void {
  if (process.env.NODE_ENV === 'production') return;
  if (typeof window === 'undefined') return;
  const cube = (singleton ??= new FakeCube());
  window.__cuberootFakeCube = {
    get armed() { return cube.armed; },
    arm() { cube.armed = true; },
    disarm() { cube.armed = false; },
    apply: (alg) => cube.apply(alg),
    scramble: () => cube.apply(getScramble()),
    solve: () => cube.solve(),
    dropNext: (n) => cube.dropNext(n),
    state: () => cube.facelets(),
    announce: () => cube.announce(),
  };
}

/**
 * The armed fake device, or null. The connect path consults this before
 * touching `navigator.bluetooth`.
 */
export function armedFakeCube(): { device: BluetoothDevice; mac: string } | null {
  if (process.env.NODE_ENV === 'production') return null;
  if (!singleton?.armed) return null;
  return { device: singleton.makeDevice(), mac: singleton.mac };
}

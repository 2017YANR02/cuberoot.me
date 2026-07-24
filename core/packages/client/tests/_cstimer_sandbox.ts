/**
 * csTimer hardware-driver sandbox.
 * ================================
 *
 * Boots one of csTimer's ORIGINAL `src/js/hardware/*.js` files inside a Node
 * `vm` context so we can feed it synthetic BLE frames and observe exactly what
 * moves it decodes. Nothing under `D:\cube\cstimer` is modified or copied —
 * the files are read from disk and evaluated as-is.
 *
 * Why: we own no physical smart cube. The only trustworthy oracle for our
 * TypeScript drivers is csTimer's battle-tested JS, so we run BOTH against the
 * same ciphertext bytes and compare the emitted move streams.
 *
 * ---------------------------------------------------------------------------
 * What we stub, and why
 * ---------------------------------------------------------------------------
 *   lib/sha256.js   loaded verbatim  -> gives `$.aes128(key)` (cstimer's own AES)
 *   lib/lzstring.js loaded verbatim  -> gives `LZString` (KEYS are LZ-packed)
 *   lib/mathlib.js  NOT loaded       -> it throws `DEBUG is not defined` at load
 *                                       time. We hand-port the ~5 members the
 *                                       hardware files touch: `valuedArray`,
 *                                       `SOLVED_FACELET` and `CubieCube`
 *                                       (incl. `moveCube` / `CubeMult` /
 *                                       `toFaceCube` / `fromFacelet` /
 *                                       `verify`). The port is line-for-line
 *                                       from mathlib.js so `verify()` and the
 *                                       facelet round-trip behave for real —
 *                                       both matter, because csTimer *gates* on
 *                                       them (GAN mode-4 needs verify()==0,
 *                                       QiYi compares its computed facelet with
 *                                       the one in the frame).
 *   lib/utillib.js  NOT loaded       -> needs `location`; `execMain` is 3 lines.
 *   giikerutil / kernel / GiikerCube / BluetoothTimer: hand-written stubs that
 *   capture everything the driver emits.
 *
 * ---------------------------------------------------------------------------
 * API
 * ---------------------------------------------------------------------------
 *   const sb = await createCstimerSandbox({ hardware: 'gancube.js', ... });
 *   sb.setMac('AB:12:34:56:78:9A');   // what giikerutil.reqMacAddr() returns
 *   await sb.connect();               // drives regModel.init(fakeDevice)
 *   sb.feedFrame(cipherBytes);        // characteristicvaluechanged on notify
 *   sb.emittedMoves();                // ['R', "U'", ...] (normalised)
 *
 * See the bottom of this file for the full exported surface. Adding MoYu32 /
 * GAN Timer / QiYi Timer only needs a new `services` map in the caller — the
 * sandbox itself is protocol-agnostic.
 */

import { createContext, runInContext } from 'node:vm';
import { readFileSync } from 'node:fs';
import path from 'node:path';

/* ------------------------------------------------------------------ */
/*  Where the read-only csTimer clone lives                            */
/* ------------------------------------------------------------------ */

export const CSTIMER_ROOT = process.env.CSTIMER_SRC
  ? path.resolve(process.env.CSTIMER_SRC)
  : 'D:\\cube\\cstimer\\src\\js';

export function cstimerFileExists(): boolean {
  try {
    readFileSync(path.join(CSTIMER_ROOT, 'hardware', 'bluetooth.js'));
    return true;
  } catch {
    return false;
  }
}

function readCstimer(rel: string): string {
  return readFileSync(path.join(CSTIMER_ROOT, rel), 'utf8');
}

/**
 * Slice a top-level `function NAME(...) { ... }` (or `var NAME = ...;`) out of a
 * csTimer source file by brace matching. Used to reuse csTimer's OWN key
 * derivation / CRC / frame encoding when building synthetic frames, instead of
 * re-typing constants (which would bake our port's assumptions into the oracle).
 */
export function extractFunction(src: string, name: string): string {
  const needle = `function ${name}(`;
  const start = src.indexOf(needle);
  if (start < 0) throw new Error(`extractFunction: ${name} not found`);
  const braceStart = src.indexOf('{', start);
  let depth = 0;
  for (let i = braceStart; i < src.length; i++) {
    const c = src[i];
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return src.slice(start, i + 1);
    }
  }
  throw new Error(`extractFunction: unbalanced braces for ${name}`);
}

/** Slice a `var NAME = <expr>;` declaration (array / object literal) out. */
export function extractVarDecl(src: string, name: string): string {
  const re = new RegExp(`var\\s+${name}\\s*=`);
  const m = re.exec(src);
  if (!m) throw new Error(`extractVarDecl: ${name} not found`);
  const start = m.index;
  let depth = 0;
  let inStr: string | null = null;
  for (let i = src.indexOf('=', start) + 1; i < src.length; i++) {
    const c = src[i];
    if (inStr) {
      if (c === '\\') { i++; continue; }
      if (c === inStr) inStr = null;
      continue;
    }
    if (c === '"' || c === "'") { inStr = c; continue; }
    if (c === '[' || c === '{' || c === '(') depth++;
    else if (c === ']' || c === '}' || c === ')') depth--;
    else if (c === ';' && depth === 0) return src.slice(start, i + 1);
  }
  throw new Error(`extractVarDecl: no terminator for ${name}`);
}

/* ------------------------------------------------------------------ */
/*  Hand-ported mathlib subset (see header note)                       */
/* ------------------------------------------------------------------ */

const MATHLIB_STUB = `
var mathlib = (function() {
  function valuedArray(len, val) {
    var ret = [];
    if (typeof val === 'function') {
      for (var i = 0; i < len; i++) ret[i] = val(i);
    } else {
      for (var i = 0; i < len; i++) ret[i] = val;
    }
    return ret;
  }

  // ---- verbatim from mathlib.js (n < 16 branch is the only one we hit) ----
  function getNPerm(arr, n, even) {
    n = n || arr.length;
    var idx = 0;
    if (n >= 16) {
      for (var i = 0; i < n - 1; i++) {
        idx *= n - i;
        for (var j = i + 1; j < n; j++) { arr[j] < arr[i] && idx++; }
      }
      return even < 0 ? (idx >> 1) : idx;
    }
    var vall = 0x76543210;
    var valh = 0xfedcba98;
    for (var i = 0; i < n - 1; i++) {
      var v = arr[i] << 2;
      idx *= n - i;
      if (v >= 32) {
        idx += (valh >> (v - 32)) & 0xf;
        valh -= 0x11111110 << (v - 32);
      } else {
        idx += (vall >> v) & 0xf;
        valh -= 0x11111111;
        vall -= 0x11111110 << v;
      }
    }
    return even < 0 ? (idx >> 1) : idx;
  }

  function getNParity(idx, n) {
    var i, p = 0;
    for (i = n - 2; i >= 0; --i) { p ^= idx % (n - i); idx = ~~(idx / (n - i)); }
    return p & 1;
  }

  function CubieCube() {
    this.ca = [0, 1, 2, 3, 4, 5, 6, 7];
    this.ea = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22];
    this.ori = 0;
  }
  CubieCube.SOLVED = new CubieCube();
  CubieCube.EdgeMult = function(a, b, prod) {
    for (var ed = 0; ed < 12; ed++) prod.ea[ed] = a.ea[b.ea[ed] >> 1] ^ (b.ea[ed] & 1);
  };
  CubieCube.CornMult = function(a, b, prod) {
    for (var corn = 0; corn < 8; corn++) {
      var ori = ((a.ca[b.ca[corn] & 7] >> 3) + (b.ca[corn] >> 3)) % 3;
      prod.ca[corn] = a.ca[b.ca[corn] & 7] & 7 | ori << 3;
    }
  };
  CubieCube.CubeMult = function(a, b, prod) {
    CubieCube.CornMult(a, b, prod);
    CubieCube.EdgeMult(a, b, prod);
  };
  CubieCube.prototype.init = function(ca, ea) {
    this.ca = ca.slice(); this.ea = ea.slice(); return this;
  };
  CubieCube.prototype.isEqual = function(c) {
    c = c || CubieCube.SOLVED;
    for (var i = 0; i < 8; i++) if (this.ca[i] != c.ca[i]) return false;
    for (var i = 0; i < 12; i++) if (this.ea[i] != c.ea[i]) return false;
    return true;
  };
  CubieCube.cFacelet = [
    [8, 9, 20], [6, 18, 38], [0, 36, 47], [2, 45, 11],
    [29, 26, 15], [27, 44, 24], [33, 53, 42], [35, 17, 51]
  ];
  CubieCube.eFacelet = [
    [5, 10], [7, 19], [3, 37], [1, 46], [32, 16], [28, 25],
    [30, 43], [34, 52], [23, 12], [21, 41], [50, 39], [48, 14]
  ];
  CubieCube.ctFacelet = [4, 13, 22, 31, 40, 49];
  CubieCube.prototype.toPerm = function(cFacelet, eFacelet) {
    cFacelet = cFacelet || CubieCube.cFacelet;
    eFacelet = eFacelet || CubieCube.eFacelet;
    var f = [];
    for (var i = 0; i < 54; i++) f[i] = i;
    var obj = this;
    for (var c = 0; c < 8; c++) {
      var j = obj.ca[c] & 0x7, ori = obj.ca[c] >> 3;
      for (var n = 0; n < 3; n++) f[cFacelet[c][(n + ori) % 3]] = cFacelet[j][n];
    }
    for (var e = 0; e < 12; e++) {
      var j = obj.ea[e] >> 1, ori = obj.ea[e] & 1;
      for (var n = 0; n < 2; n++) f[eFacelet[e][(n + ori) % 2]] = eFacelet[j][n];
    }
    return f;
  };
  CubieCube.prototype.toFaceCube = function(cFacelet, eFacelet) {
    var perm = this.toPerm(cFacelet, eFacelet);
    var ts = "URFDLB", f = [];
    for (var i = 0; i < 54; i++) f[i] = ts[~~(perm[i] / 9)];
    return f.join("");
  };
  CubieCube.prototype.fromFacelet = function(facelet, cFacelet, eFacelet) {
    cFacelet = cFacelet || CubieCube.cFacelet;
    eFacelet = eFacelet || CubieCube.eFacelet;
    var count = 0, f = [];
    var centers = facelet[4] + facelet[13] + facelet[22] + facelet[31] + facelet[40] + facelet[49];
    for (var i = 0; i < 54; ++i) {
      f[i] = centers.indexOf(facelet[i]);
      if (f[i] == -1) return -1;
      count += 1 << (f[i] << 2);
    }
    if (count != 0x999999) return -1;
    var col1, col2, i, j, ori;
    for (i = 0; i < 8; ++i) {
      for (ori = 0; ori < 3; ++ori) if (f[cFacelet[i][ori]] == 0 || f[cFacelet[i][ori]] == 3) break;
      col1 = f[cFacelet[i][(ori + 1) % 3]];
      col2 = f[cFacelet[i][(ori + 2) % 3]];
      for (j = 0; j < 8; ++j) {
        if (col1 == ~~(cFacelet[j][1] / 9) && col2 == ~~(cFacelet[j][2] / 9)) {
          this.ca[i] = j | ori % 3 << 3;
          break;
        }
      }
    }
    for (i = 0; i < 12; ++i) {
      for (j = 0; j < 12; ++j) {
        if (f[eFacelet[i][0]] == ~~(eFacelet[j][0] / 9) && f[eFacelet[i][1]] == ~~(eFacelet[j][1] / 9)) {
          this.ea[i] = j << 1; break;
        }
        if (f[eFacelet[i][0]] == ~~(eFacelet[j][1] / 9) && f[eFacelet[i][1]] == ~~(eFacelet[j][0] / 9)) {
          this.ea[i] = j << 1 | 1; break;
        }
      }
    }
    return this;
  };
  CubieCube.prototype.verify = function() {
    var mask = 0, sum = 0, ep = [];
    for (var e = 0; e < 12; e++) {
      mask |= 1 << 8 << (this.ea[e] >> 1);
      sum ^= this.ea[e] & 1;
      ep.push(this.ea[e] >> 1);
    }
    var cp = [];
    for (var c = 0; c < 8; c++) {
      mask |= 1 << (this.ca[c] & 7);
      sum += this.ca[c] >> 3 << 1;
      cp.push(this.ca[c] & 0x7);
    }
    if (mask != 0xfffff || sum % 6 != 0
        || getNParity(getNPerm(ep, 12), 12) != getNParity(getNPerm(cp, 8), 8)) {
      return -1;
    }
    return 0;
  };
  CubieCube.moveCube = (function() {
    var moveCube = [];
    for (var i = 0; i < 18; i++) moveCube[i] = new CubieCube();
    moveCube[0].init([3, 0, 1, 2, 4, 5, 6, 7], [6, 0, 2, 4, 8, 10, 12, 14, 16, 18, 20, 22]);
    moveCube[3].init([20, 1, 2, 8, 15, 5, 6, 19], [16, 2, 4, 6, 22, 10, 12, 14, 8, 18, 20, 0]);
    moveCube[6].init([9, 21, 2, 3, 16, 12, 6, 7], [0, 19, 4, 6, 8, 17, 12, 14, 3, 11, 20, 22]);
    moveCube[9].init([0, 1, 2, 3, 5, 6, 7, 4], [0, 2, 4, 6, 10, 12, 14, 8, 16, 18, 20, 22]);
    moveCube[12].init([0, 10, 22, 3, 4, 17, 13, 7], [0, 2, 20, 6, 8, 10, 18, 14, 16, 4, 12, 22]);
    moveCube[15].init([0, 1, 11, 23, 4, 5, 18, 14], [0, 2, 4, 23, 8, 10, 12, 21, 16, 18, 7, 15]);
    for (var a = 0; a < 18; a += 3) {
      for (var p = 0; p < 2; p++) CubieCube.CubeMult(moveCube[a + p], moveCube[a], moveCube[a + p + 1]);
    }
    return moveCube;
  })();

  return {
    valuedArray: valuedArray,
    getNPerm: getNPerm,
    getNParity: getNParity,
    CubieCube: CubieCube,
    SOLVED_FACELET: "UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB"
  };
})();
`;

/* ------------------------------------------------------------------ */
/*  Fake BLE stack (lives INSIDE the vm so instanceof / DataView match) */
/* ------------------------------------------------------------------ */

const FAKE_BLE = `
var __capture = {
  callbacks: [],
  writes: [],
  battery: [],
  logs: [],
  macPrompts: [],
  disconnects: 0
};
var __injectedMac = null;
var __advMode = { kind: 'reject', code: -1 };

function __FakeChrct(uuid) {
  this.uuid = uuid;
  this.value = null;
  this._lis = [];
  this.notifying = false;
}
__FakeChrct.prototype.addEventListener = function(type, fn) {
  if (type === 'characteristicvaluechanged') this._lis.push(fn);
};
__FakeChrct.prototype.removeEventListener = function(type, fn) {
  if (type !== 'characteristicvaluechanged') return;
  var i = this._lis.indexOf(fn);
  if (i >= 0) this._lis.splice(i, 1);
};
__FakeChrct.prototype.startNotifications = function() {
  this.notifying = true;
  return Promise.resolve(this);
};
__FakeChrct.prototype.stopNotifications = function() {
  this.notifying = false;
  return Promise.resolve(this);
};
__FakeChrct.prototype.setReadValue = function(bytes) {
  var ab = new ArrayBuffer(bytes.length);
  var u8 = new Uint8Array(ab);
  for (var i = 0; i < bytes.length; i++) u8[i] = bytes[i] & 0xff;
  this._readValue = new DataView(ab);
};
__FakeChrct.prototype.readValue = function() {
  return Promise.resolve(this._readValue || this.value || new DataView(new ArrayBuffer(20)));
};
__FakeChrct.prototype.writeValue = function(buf) {
  var u8 = new Uint8Array(buf.buffer || buf);
  __capture.writes.push({ uuid: this.uuid, bytes: Array.prototype.slice.call(u8) });
  return Promise.resolve();
};
__FakeChrct.prototype.__emit = function(bytes) {
  var ab = new ArrayBuffer(bytes.length);
  var u8 = new Uint8Array(ab);
  for (var i = 0; i < bytes.length; i++) u8[i] = bytes[i] & 0xff;
  this.value = new DataView(ab);
  var ev = { target: this, type: 'characteristicvaluechanged' };
  for (var i = 0; i < this._lis.length; i++) this._lis[i](ev);
};

function __FakeService(uuid, chrctUuids, device) {
  this.uuid = uuid;
  this.device = device;
  this._chrcts = chrctUuids.map(function(u) { return new __FakeChrct(u); });
}
__FakeService.prototype.getCharacteristics = function() {
  return Promise.resolve(this._chrcts.slice());
};
__FakeService.prototype.getCharacteristic = function(uuid) {
  var want = String(uuid).toLowerCase();
  for (var i = 0; i < this._chrcts.length; i++) {
    if (this._chrcts[i].uuid.toLowerCase() === want) return Promise.resolve(this._chrcts[i]);
  }
  return Promise.reject(new Error('no chrct ' + uuid));
};

function __FakeGatt(device, serviceMap) {
  this.device = device;
  this.connected = false;
  this._services = Object.keys(serviceMap).map(function(u) {
    return new __FakeService(u, serviceMap[u], device);
  });
}
__FakeGatt.prototype.connect = function() { this.connected = true; return Promise.resolve(this); };
__FakeGatt.prototype.disconnect = function() { this.connected = false; };
__FakeGatt.prototype.getPrimaryServices = function() { return Promise.resolve(this._services.slice()); };
__FakeGatt.prototype.getPrimaryService = function(uuid) {
  var want = String(uuid).toLowerCase();
  for (var i = 0; i < this._services.length; i++) {
    if (this._services[i].uuid.toLowerCase() === want) return Promise.resolve(this._services[i]);
  }
  return Promise.reject(new Error('no service ' + uuid));
};

function __FakeDevice(name, serviceMap) {
  this.name = name;
  this.id = 'fake-' + name;
  this.gatt = new __FakeGatt(this, serviceMap);
  this._lis = {};
}
__FakeDevice.prototype.addEventListener = function(t, fn) {
  (this._lis[t] = this._lis[t] || []).push(fn);
};
__FakeDevice.prototype.removeEventListener = function(t, fn) {
  var a = this._lis[t] || [];
  var i = a.indexOf(fn);
  if (i >= 0) a.splice(i, 1);
};
__FakeDevice.prototype.watchAdvertisements = function() { return Promise.resolve(); };

var __device = null;

function __findChrct(uuid) {
  var svcs = __device.gatt._services;
  for (var i = 0; i < svcs.length; i++) {
    var cs = svcs[i]._chrcts;
    for (var j = 0; j < cs.length; j++) {
      if (!uuid || cs[j].uuid.toLowerCase() === String(uuid).toLowerCase()) {
        if (uuid) return cs[j];
        if (cs[j].notifying) return cs[j];
      }
    }
  }
  return null;
}

/* ---- csTimer ambient globals ---- */
var DEBUG = false;
var DEBUGBL = false;
var ISCSTIMER = true;
var LGHINT_BTNOTSUP = 'btnotsup';
var LGHINT_BTINVMAC = 'btinvmac';
var CONFIRM_GIIRST = 'reset?';
var logohint = { push: function(x) { __capture.logs.push(['logohint', x]); } };
var debugInfo = { appendLog: function() {} };

function execBoth(funcMain, funcWorker, params) {
  if (funcMain) return funcMain.apply(this, params || []);
  return {};
}
function execWorker(func, params) { return execBoth(undefined, func, params); }
function execMain(func, params) { return execBoth(func, undefined, params); }

function confirm() { return false; }
function prompt(msg, def) { __capture.macPrompts.push(msg); return __injectedMac; }
function alert() {}

var kernel = {
  _props: {},
  getProp: function(k, def) { return (k in kernel._props) ? kernel._props[k] : def; },
  setProp: function(k, v) { kernel._props[k] = v; }
};

var giikerutil = {
  log: function() { __capture.logs.push(Array.prototype.slice.call(arguments)); },
  markSolved: function() { __capture.logs.push(['markSolved']); },
  updateBattery: function(x) { __capture.battery.push(x); },
  checkScramble: function() {},
  markScrambled: function() {},
  isSync: function() { return true; },
  reSync: function() {},
  tsLinearFix: function(a) { return a; },
  setLastSolve: function() {},
  chkAvail: function() { return Promise.resolve(); },
  // Normally a prompt(); here it hands back exactly the MAC the test injected.
  reqMacAddr: function(forcePrompt, isWrongKey, deviceMac, defaultMac) {
    __capture.macPrompts.push({ forcePrompt: !!forcePrompt, isWrongKey: !!isWrongKey, deviceMac: deviceMac || null, defaultMac: defaultMac || null });
    if (deviceMac) return deviceMac;
    if (__injectedMac) return __injectedMac;
    return defaultMac || null;
  }
};

function __toUuid128(uuid) {
  if (/^[0-9A-Fa-f]{4}$/.exec(uuid)) uuid = "0000" + uuid + "-0000-1000-8000-00805F9B34FB";
  return String(uuid).toUpperCase();
}

var __regModels = [];
var GiikerCube = {
  regCubeModel: function(m) { __regModels.push(m); },
  findUUID: function(elems, uuid) {
    uuid = __toUuid128(uuid);
    for (var i = 0; i < elems.length; i++) {
      if (__toUuid128(elems[i].uuid) == uuid) return elems[i];
    }
    return null;
  },
  waitForAdvs: function() {
    if (__advMode.kind === 'reject') return Promise.reject(__advMode.code);
    // Chrome shape: Map-like { has(id), get(id) -> DataView }
    var payload = __advMode.payload;
    var cic = __advMode.cic;
    var ab = new ArrayBuffer(payload.length);
    var u8 = new Uint8Array(ab);
    for (var i = 0; i < payload.length; i++) u8[i] = payload[i] & 0xff;
    var dv = new DataView(ab);
    var mfData = {
      has: function(id) { return id === cic; },
      get: function(id) { return id === cic ? dv : undefined; }
    };
    return Promise.resolve(mfData);
  },
  callback: function(facelet, moves, ts, deviceName) {
    __capture.callbacks.push({
      facelet: facelet,
      moves: (moves || []).slice(),
      ts: (ts || []).slice(),
      deviceName: deviceName
    });
  },
  onDisconnect: function() { __capture.disconnects++; }
};
var BluetoothTimer = {
  regCubeModel: function(m) { __regModels.push(m); },
  findUUID: GiikerCube.findUUID,
  waitForAdvs: function() { return GiikerCube.waitForAdvs(); },
  callback: function() { GiikerCube.callback.apply(null, arguments); },
  onDisconnect: function() { __capture.disconnects++; },
  CONST: {
    DISCONNECT: 0, GET_SET: 1, HANDS_OFF: 2, RUNNING: 3, STOPPED: 4,
    IDLE: 5, HANDS_ON: 6, FINISHED: 7, INSPECTION: 8, GAN_RESET: 9
  }
};
`;

/* ------------------------------------------------------------------ */
/*  Public types                                                       */
/* ------------------------------------------------------------------ */

export interface CstimerCallback {
  /** Facelet string csTimer computed for the post-move state. */
  facelet: string;
  /** csTimer's rolling move window — `moves[0]` is the NEWEST move. */
  moves: string[];
  /** `[deviceTs, locTime]` as passed by the driver. */
  ts: Array<number | null>;
  /** Device name (GAN appends `'*'` on the v2/v3/v4 paths). */
  deviceName: string;
}

export interface CstimerRegModel {
  prefix: string | string[];
  init: (device: unknown) => Promise<unknown>;
  opservs?: unknown[];
  cics?: number[];
  clear?: () => unknown;
  getBatteryLevel?: () => Promise<unknown>;
}

export interface CstimerSandboxOptions {
  /** File name under `src/js/hardware/`, e.g. `'gancube.js'`. */
  hardware: string;
  /** BLE device name the fake device advertises. */
  deviceName: string;
  /** GATT layout: `{ [serviceUuid]: [charUuid, ...] }`. */
  services: Record<string, string[]>;
  /** MAC handed back by `giikerutil.reqMacAddr` / `prompt()`. */
  mac?: string | null;
  /**
   * Advertisement behaviour for `GiikerCube.waitForAdvs()`:
   *   - omitted / `{ kind: 'reject' }` -> manual-MAC path (reqMacAddr)
   *   - `{ kind: 'resolve', cic, payload }` -> advertisement-MAC path
   */
  adv?:
    | { kind: 'reject'; code?: number }
    | { kind: 'resolve'; cic: number; payload: number[] };
}

export interface CstimerSandbox {
  /** What the hardware file handed to `GiikerCube.regCubeModel(...)`. */
  regModel: CstimerRegModel;
  /** All `GiikerCube.callback(...)` invocations, in order. */
  callbacks: CstimerCallback[];
  /** Everything written to a characteristic (host -> cube), in order. */
  writes: Array<{ uuid: string; bytes: number[] }>;
  /** `giikerutil.updateBattery(...)` payloads. */
  batteryEvents: unknown[];
  /** `giikerutil.reqMacAddr(...)` / `prompt()` invocations. */
  macPrompts: unknown[];
  /** `GiikerCube.onDisconnect()` count (GAN fires it when the buffer wedges). */
  disconnects: () => number;
  /** MAC that `reqMacAddr` will return. Set BEFORE `connect()`. */
  setMac(mac: string | null): void;
  /** Drive `regModel.init(fakeDevice)`; resolves once init's promise chain settles. */
  connect(): Promise<void>;
  /** Dispatch `characteristicvaluechanged` with `bytes` on `uuid` (default: the notifying char). */
  feedFrame(bytes: ArrayLike<number>, uuid?: string): void;
  /**
   * Preload what `chrct.readValue()` resolves with. Must be called BEFORE
   * `connect()` for drivers that read a baseline during init (Giiker does).
   */
  setReadValue(uuid: string, bytes: ArrayLike<number>): void;
  /**
   * New moves csTimer decoded, oldest first, normalised to WCA notation.
   * csTimer hands `callback(facelet, prevMovesWindow, ...)` where the window's
   * head is the move just decoded, so one callback == one new move.
   */
  emittedMoves(): string[];
  /** Forget captured callbacks/writes without resetting driver state. */
  clearCaptured(): void;
  /** Call the driver's own `clear()` (full protocol reset). */
  reset(): Promise<void>;
  /** Evaluate arbitrary JS inside the vm (reuse csTimer's crypto for fixtures). */
  run<T = unknown>(code: string): T;
  /** Read a csTimer source file (read-only). */
  source(rel: string): string;
}

/* ------------------------------------------------------------------ */
/*  Factory                                                            */
/* ------------------------------------------------------------------ */

export async function createCstimerSandbox(opts: CstimerSandboxOptions): Promise<CstimerSandbox> {
  // Only inject host globals that a bare vm realm lacks. JS intrinsics
  // (Array / DataView / Promise / …) come from the context's OWN realm on
  // purpose: injecting the outer ones would break `x instanceof DataView`
  // inside csTimer (qiyicube.js does exactly that for Bluefy).
  const sandbox: Record<string, unknown> = {
    console,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    AbortController,
    TextEncoder,
    TextDecoder,
  };
  sandbox.window = sandbox;
  sandbox.self = sandbox;
  // sha256.js / lzstring.js only *augment* `$`; pre-seed it (documented gotcha).
  sandbox.$ = {
    isArray: Array.isArray,
    noop: () => {},
    now: () => Date.now(),
  };
  sandbox.navigator = { bluetooth: undefined, userAgent: 'node' };
  sandbox.location = { href: 'http://localhost/', search: '', hash: '' };
  sandbox.document = { addEventListener: () => {}, createElement: () => ({ style: {} }) };

  const ctx = createContext(sandbox);

  runInContext(readCstimer('lib/sha256.js'), ctx, { filename: 'cstimer/lib/sha256.js' });
  runInContext(readCstimer('lib/lzstring.js'), ctx, { filename: 'cstimer/lib/lzstring.js' });
  runInContext(MATHLIB_STUB, ctx, { filename: 'harness/mathlib-stub.js' });
  runInContext(FAKE_BLE, ctx, { filename: 'harness/fake-ble.js' });

  // Configure adv + mac BEFORE the hardware file registers/uses them.
  const advMode = opts.adv ?? { kind: 'reject' as const };
  ctx.__advMode = advMode.kind === 'reject'
    ? { kind: 'reject', code: advMode.code ?? -1 }
    : { kind: 'resolve', cic: advMode.cic, payload: advMode.payload };
  ctx.__injectedMac = opts.mac ?? null;

  runInContext(
    readCstimer(`hardware/${opts.hardware}`),
    ctx,
    { filename: `cstimer/hardware/${opts.hardware}` },
  );

  const models = ctx.__regModels as CstimerRegModel[];
  if (!models || models.length === 0) {
    throw new Error(`${opts.hardware} registered no cube model`);
  }
  const regModel = models[0];

  // Build the fake device inside the vm so DataView/instanceof stay native to it.
  ctx.__serviceMap = opts.services;
  ctx.__deviceNameIn = opts.deviceName;
  runInContext('__device = new __FakeDevice(__deviceNameIn, __serviceMap);', ctx);

  const cap = () => ctx.__capture as {
    callbacks: CstimerCallback[];
    writes: Array<{ uuid: string; bytes: number[] }>;
    battery: unknown[];
    macPrompts: unknown[];
    disconnects: number;
  };

  const api: CstimerSandbox = {
    regModel,
    get callbacks() { return cap().callbacks; },
    get writes() { return cap().writes; },
    get batteryEvents() { return cap().battery; },
    get macPrompts() { return cap().macPrompts; },
    disconnects: () => cap().disconnects,

    setMac(mac) { ctx.__injectedMac = mac; },

    async connect() {
      await regModel.init(ctx.__device);
      // Let any trailing .then() microtasks in the init chain drain.
      await new Promise((r) => setTimeout(r, 0));
    },

    feedFrame(bytes, uuid) {
      const chrct = uuid
        ? runInContext(`__findChrct(${JSON.stringify(uuid)})`, ctx)
        : runInContext('__findChrct(null)', ctx);
      if (!chrct) throw new Error(`feedFrame: no notifying characteristic (uuid=${uuid ?? 'auto'})`);
      ctx.__feedBytes = Array.from(bytes, (b) => Number(b) & 0xff);
      ctx.__feedUuid = uuid ?? null;
      runInContext('__findChrct(__feedUuid).__emit(__feedBytes);', ctx);
    },

    setReadValue(uuid, bytes) {
      ctx.__rvBytes = Array.from(bytes, (b) => Number(b) & 0xff);
      ctx.__rvUuid = uuid;
      runInContext('__findChrct(__rvUuid).setReadValue(__rvBytes);', ctx);
    },

    emittedMoves() {
      return cap().callbacks
        .filter((c) => c.moves && c.moves.length > 0)
        .map((c) => normalizeMove(c.moves[0]));
    },

    clearCaptured() {
      const c = cap();
      c.callbacks.length = 0;
      c.writes.length = 0;
      c.battery.length = 0;
      c.macPrompts.length = 0;
      c.disconnects = 0;
    },

    async reset() {
      if (regModel.clear) await Promise.resolve(regModel.clear());
    },

    run<T>(code: string): T {
      return runInContext(code, ctx) as T;
    },

    source(rel: string): string {
      return readCstimer(rel);
    },
  };

  return api;
}

/**
 * csTimer writes moves as `"U "` / `"U'"` / `"U2"` (fixed 2 chars). Our drivers
 * emit `"U"` / `"U'"` / `"U2"`. Compare on the trimmed form.
 */
export function normalizeMove(m: string): string {
  return (m ?? '').trim();
}

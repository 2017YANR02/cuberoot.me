/**
 * GAN Smart Cube v4 driver — covers GAN 12 / 13 / 14, Mini Pro, MG / AiCube
 * v4 firmwares that expose the FFF5/FFF6 GATT characteristics under the
 * 00000010-…-fff5fff4fff0 service.
 *
 * Protocol reference: cstimer's `src/js/hardware/gancube.js` (battle-tested
 * across years of community use). This driver is aligned with that
 * implementation:
 *
 *   - Service UUID `00000010-0000-fff7-fff6-fff5fff4fff0`
 *   - Notify characteristic `0000fff6-…` (mode + length + payload, 20 bytes)
 *   - Write characteristic   `0000fff5-…` (encrypted command opcodes)
 *   - AES-128-ECB key/IV derivation: per-cube key/iv = base + reversed-MAC
 *     under modular addition mod 255 (NOT XOR — GAN's quirk). Base bytes are
 *     KEYS[2] / KEYS[3] from gancube.js.
 *   - Encrypt/decrypt is a 16-byte rolling-window with two passes; for
 *     frames longer than 16 bytes the trailing 16-byte window is
 *     decrypted-then-XORed-with-IV first, then the leading 16-byte window.
 *     Encrypt is the exact inverse.
 *   - At connect we send hardware-info / facelets / battery requests so the
 *     cube starts streaming events. They are non-fatal.
 *   - Parsed events:
 *       mode 0x01 → cube move (axis + power, plus a 16-bit moveCnt for
 *                   drop detection),
 *       mode 0xEF → battery percentage,
 *       mode 0xED → facelets snapshot (we ignore the perm/ori payload; the
 *                   higher-level CubeStateTracker re-models state from
 *                   moves),
 *       mode 0xD1 → move history (used by cstimer to recover dropped moves;
 *                   we replay these into onMove so the host's state tracker
 *                   stays in sync).
 *
 * MAC discovery: Web Bluetooth on Chromium can surface the MAC via
 * `device.watchAdvertisements()` + manufacturer-data (CIC list 0x0001..0xFF01),
 * but only when the page was launched with `optionalManufacturerData` in the
 * picker filters AND the user has the experimental flag enabled. In this
 * codebase the picker (in `index.ts`) does not request advertisements, so
 * we fall back to parsing the trailing hex bytes from `device.name`
 * ("GAN-…-XXYYZZ"). When that also fails we use a zero-MAC, which works on
 * a small subset of pre-MAC firmwares and silently fails on the rest.
 */

import { BATTERY_SERVICE, writeGattValue, type CubeDriver, type CubeDriverStartResult } from './driver';
import type { CubeBrand } from './types';
import {
  GAN_V4_NOTIFY_CHARACTERISTIC_UUID,
  GAN_V4_SERVICE_UUID,
  GAN_V4_WRITE_CHARACTERISTIC_UUID,
  createGanV4BatteryCommand,
  createGanV4Cipher,
  createGanV4DecodeState,
  createGanV4FaceletsCommand,
  createGanV4HardwareInfoCommand,
  createGanV4HistoryCommand,
  decodeGanV4Frame,
  matchesGanV4Name,
  type GanV4DecodeState,
} from '@cuberoot/shared/smart-cube/gan-v4';
import { GAN_MAC_ADV, macStringToBytes } from './mac';

// Standard Bluetooth Battery Service / level characteristic. Most GAN v4
// cubes do NOT expose the standard service — they ship battery via mode
// 0xEF events on the notify pipe — but we still try, and fall back to the
// most recent 0xEF reading.
const BATTERY_LEVEL_CHAR = 0x2a19;


function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length >> 1);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return out;
}

function tryParseMacFromName(name: string | undefined): Uint8Array | null {
  if (!name) return null;
  // Only a FULL 6-byte MAC embedded in the name is trustworthy. We don't
  // fabricate one from a 3-byte suffix + a guessed OUI (GAN uses several OUIs
  // across batches — a guess derives a wrong key and fails silently). The hook
  // resolves the MAC (advertisement / prompt) before start() anyway.
  const m12 = /([0-9A-Fa-f]{12})$/.exec(name);
  if (m12) return hexToBytes(m12[1]);
  return null;
}

/** See the matching GAN v3 constant. */
const IDLE_STATE_CHECK_MS = [650, 1600, 3200] as const;

export type MoveDecodeState = GanV4DecodeState;
export { createGanV4DecodeState, decodeGanV4Frame };

/* ================================================================== */
/*  Driver implementation                                              */
/* ================================================================== */

export const ganV4Driver: CubeDriver = {
  brand: 'gan-v4' satisfies CubeBrand,
  service: GAN_V4_SERVICE_UUID,
  namePrefixes: ['GAN', 'MG', 'AiCube'],
  optionalServices: [BATTERY_SERVICE],
  needsMac: true,
  macAdv: GAN_MAC_ADV,
  hasGyro: true,

  matches(device: BluetoothDevice): boolean {
    // GAN 12 及以后的两位数编号(12 / 13 / 14 / 15 / 16 …)+ Mini Pro / MG /
    // AiCube。`(?!356)` 是有意的:GAN 356(i / i3 等)是 v3 家族,由注册表里的
    // v3 驱动认。
    //
    // 编号写成 `1[2-9]` 而不是逐个列出:这条**只是名字兜底** —— 正常路径是连上
    // 之后按 GATT service UUID 选驱动(见 index.ts 的 connect),GAN 出一款新
    // 型号只要还说 gen4 协议就自动认得。逐个列型号会让兜底路径凭空落后于硬件,
    // 而这条兜底恰恰是在 getPrimaryServices 失败时才用得上的救命绳。
    return matchesGanV4Name(device.name);
  },

  async start(server, onMove, ctx): Promise<CubeDriverStartResult> {
    const service = await server.getPrimaryService(GAN_V4_SERVICE_UUID);
    const notifyChar = await service.getCharacteristic(GAN_V4_NOTIFY_CHARACTERISTIC_UUID);

    const mac = ctx?.mac
      ? macStringToBytes(ctx.mac)
      : (tryParseMacFromName(server.device.name) ?? new Uint8Array(6));
    const cipher = createGanV4Cipher(mac);

    // `sendCmd` is defined below (it needs the command characteristic, which
    // is resolved after we subscribe). The decoder only ever calls these from
    // a notification, long after start() has finished, so a late binding is
    // safe — and it keeps the handshake order identical to cstimer's.
    let sendCmd: (req: Uint8Array) => Promise<void> = async () => {};

    const decState: MoveDecodeState = createGanV4DecodeState({
      // cstimer's requestMoveHistory: opcode 0xD1 / 0x04, window at [2] / [4].
      requestHistory: (startMoveCnt, numberOfMoves) => {
        void sendCmd(createGanV4HistoryCommand(startMoveCnt, numberOfMoves));
      },
      // DIVERGENCE from cstimer, deliberate: it force-disconnects when the
      // buffer wedges. We ask the cube for a fresh state snapshot instead —
      // that re-seeds from the source and keeps the session alive, which is
      // strictly better than dropping a connection mid-solve.
      onWedged: () => {
        decState.sync.reset();
        void sendCmd(createGanV4FaceletsCommand());
      },
      onState: (facelets) => ctx?.onState?.(facelets),
    });
    let keyErrorFired = false;
    let cleaned = false;
    const idleStateChecks = new Set<ReturnType<typeof setTimeout>>();
    const clearIdleStateChecks = (): void => {
      for (const timer of idleStateChecks) clearTimeout(timer);
      idleStateChecks.clear();
    };
    const scheduleIdleStateChecks = (): void => {
      clearIdleStateChecks();
      for (const delay of IDLE_STATE_CHECK_MS) {
        const timer = setTimeout(() => {
          idleStateChecks.delete(timer);
          if (!cleaned) void sendCmd(createGanV4FaceletsCommand());
        }, delay);
        idleStateChecks.add(timer);
      }
    };

    const onChar = (ev: Event): void => {
      const target = ev.target as BluetoothRemoteGATTCharacteristic;
      const dv = target.value;
      if (!dv) return;
      const ct = new Uint8Array(dv.buffer, dv.byteOffset, dv.byteLength);
      let pt: Uint8Array;
      try {
        pt = cipher.decrypt(ct);
      } catch {
        return;
      }
      const moves = decodeGanV4Frame(pt, decState, ctx?.onGyro);
      for (const mv of moves) onMove(mv.mv, mv.ts);
      if (moves.length > 0) scheduleIdleStateChecks();
      // Several unrecognised frames in a row ⇒ wrong MAC. Tell the hook once.
      if (!keyErrorFired && decState.badFrames >= 6) {
        keyErrorFired = true;
        ctx?.onKeyError?.();
      }
    };

    notifyChar.addEventListener('characteristicvaluechanged', onChar);
    await notifyChar.startNotifications();

    // Send the standard hello sequence cstimer's v4init runs:
    //   v4requestHardwareInfo  → opcode 0xDF / 0x03
    //   v4requestFacelets      → opcode 0xDD / 0x04 / 0xED
    //   v4requestBattery       → opcode 0xDD / 0x04 / 0xEF
    // All 20 bytes, encrypted via the same key/IV, written to FFF5. Failure
    // is non-fatal — many cubes auto-stream after subscribe.
    let cmdChar: BluetoothRemoteGATTCharacteristic | null = null;
    try {
      cmdChar = await service.getCharacteristic(GAN_V4_WRITE_CHARACTERISTIC_UUID);
    } catch {
      // No write characteristic — older firmware variant; just listen.
    }

    let writeTail: Promise<void> = Promise.resolve();
    sendCmd = (req: Uint8Array): Promise<void> => {
      if (!cmdChar) return Promise.resolve();
      const enc = cipher.encrypt(req);
      // Detach into a fresh ArrayBuffer-backed Uint8Array — the strict TS
      // lib types narrow `BufferSource` to `Uint8Array<ArrayBuffer>` and our
      // chained subarrays surface as `ArrayBufferLike`.
      const buf = new Uint8Array(enc.length);
      buf.set(enc);
      const task = writeTail.then(() => writeGattValue(cmdChar!, buf));
      writeTail = task.catch(() => {});
      return task.catch(() => {});
    };

    if (cmdChar) {
      // Sequenced — cstimer awaits each in turn.
      await sendCmd(createGanV4HardwareInfoCommand());
      await sendCmd(createGanV4FaceletsCommand());
      await sendCmd(createGanV4BatteryCommand());
    }

    const cleanup = (): void => {
      if (cleaned) return;
      cleaned = true;
      clearIdleStateChecks();
      notifyChar.removeEventListener('characteristicvaluechanged', onChar);
      void notifyChar.stopNotifications().catch(() => {});
    };

    const battery = async (): Promise<number | null> => {
      // Try the standard battery service first; fall back to whatever the
      // cube most recently reported on a mode-0xEF event.
      try {
        const battSvc = await server.getPrimaryService(BATTERY_SERVICE);
        const battChar = await battSvc.getCharacteristic(BATTERY_LEVEL_CHAR);
        const v = await battChar.readValue();
        return v.getUint8(0);
      } catch {
        return decState.battery;
      }
    };

    return { battery, cleanup };
  },
};

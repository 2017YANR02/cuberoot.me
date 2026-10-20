/** GAN Gen1 read protocol, ported from csTimer hardware/gancube.js (GPL-3.0).
 * Uses the shared AES primitive; unlike Gen2+, its hardware salt is mod 256.
 * Attribution: the canonical /about csTimer entry.
 */
import { decryptFrame, expandKey } from './gan_crypto';
import { cubieStateFromFacelets } from './cubie';

const uuid = (short: string) => `0000${short}-0000-1000-8000-00805f9b34fb`;
export const GAN_V1_SERVICE_UUID = uuid('fff0');
export const GAN_V1_META_SERVICE_UUID = uuid('180a');
export const GAN_V1_CHARACTERISTICS = { version: uuid('2a28'), hardware: uuid('2a23'), state: uuid('fff2'), moves: uuid('fff5'), times: uuid('fff6'), battery: uuid('fff7') };
const KEYS = [
  [198, 202, 21, 223, 79, 110, 19, 182, 119, 13, 230, 89, 58, 175, 186, 162],
  [67, 226, 91, 214, 125, 220, 120, 216, 7, 96, 163, 218, 130, 60, 1, 241],
];
export function createGanV1Cipher(version: number, hardware: Uint8Array) {
  if (version <= 0x010007 || (version & 0xfffe00) !== 0x010000 || hardware.length < 6) throw new Error('Unsupported GAN v1 firmware');
  const key = Uint8Array.from(KEYS[(version >> 8) & 255]);
  for (let i = 0; i < 6; i++) key[i] = (key[i] + hardware[5 - i]) & 255;
  const expanded = expandKey(key), iv = new Uint8Array(16);
  return { decrypt(bytes: Uint8Array) {
    if (bytes.length < 16) throw new Error('Truncated GAN v1 frame');
    return decryptFrame(bytes, expanded, iv);
  } };
}
export function decodeGanV1Facelets(bytes: Uint8Array): string {
  if (bytes.length !== 20) throw new Error('Invalid GAN v1 state length');
  let facelets = '';
  for (let i = 0; i < 18; i += 3) {
    const face = (bytes[i ^ 1] << 16) | (bytes[(i + 1) ^ 1] << 8) | bytes[(i + 2) ^ 1];
    for (let shift = 21; shift >= 0; shift -= 3) {
      const sticker = (face >> shift) & 7;
      if (sticker > 5) throw new Error('Invalid GAN v1 sticker');
      facelets += 'URFDLB'[sticker];
      if (shift === 12) facelets += 'URFDLB'[i / 3];
    }
  }
  if (!cubieStateFromFacelets(facelets)) throw new Error('Invalid GAN v1 cube state');
  return facelets;
}

/** Sequential reads only. A second counter read prevents pairing moves with a
 * newer timing window. Lost history is fatal, never a silently shortened solve. */
export function createGanV1Session(
  read: (service: string, characteristic: string) => Promise<DataView>,
  callbacks: {
    onState(facelets: string): void;
    onMove(move: string, time: number, metadata: { delayed: boolean }): void;
    onBattery(battery: number): void;
    onError(): void;
  },
) {
  let active = true, counter = -1, deviceTime = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let cipher: ReturnType<typeof createGanV1Cipher>;
  const bytes = async (service: string, characteristic: string) => {
    if (!active) throw new Error('Cube disconnected');
    const view = await read(service, characteristic);
    if (!active) throw new Error('Cube disconnected');
    return new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
  };
  const data = async (characteristic: string) => {
    const frame = cipher.decrypt(await bytes(GAN_V1_SERVICE_UUID, characteristic));
    if (frame.length !== 20) throw new Error('Invalid GAN v1 frame length');
    return frame;
  };
  const poll = async () => {
    const moves = await data(GAN_V1_CHARACTERISTICS.moves);
    const next = moves[12], count = (next - counter) & 255;
    if (!count) return;
    if (count > 6) throw new Error('GAN v1 move history lost');
    const times = await data(GAN_V1_CHARACTERISTICS.times);
    const confirm = await data(GAN_V1_CHARACTERISTICS.moves);
    if (confirm[12] !== next) return;
    const batch: { move: string; offset: number }[] = [];
    for (let i = count - 1; i >= 0; i--) {
      const move = moves[18 - i];
      if (move >= 18) throw new Error('Invalid GAN v1 move');
      batch.push({ move: 'URFDLB'[Math.floor(move / 3)] + ['', '2', "'"][move % 3], offset: times[17 - i * 2] | times[18 - i * 2] << 8 });
    }
    counter = next;
    for (const turn of batch) {
      if (!active) return;
      deviceTime += turn.offset;
      callbacks.onMove(turn.move, deviceTime, { delayed: count > 1 });
    }
  };
  const loop = () => { if (active) timer = setTimeout(() => {
    void poll().then(loop, () => { if (active) { active = false; callbacks.onError(); } });
  }, 30); };
  return {
    async start() {
      const version = await bytes(GAN_V1_META_SERVICE_UUID, GAN_V1_CHARACTERISTICS.version);
      if (version.length < 3) throw new Error('Invalid GAN v1 version');
      cipher = createGanV1Cipher((version[0] << 16) | (version[1] << 8) | version[2], await bytes(GAN_V1_META_SERVICE_UUID, GAN_V1_CHARACTERISTICS.hardware));
      for (let attempt = 0; attempt < 8; attempt++) {
        const before = await data(GAN_V1_CHARACTERISTICS.moves);
        const facelets = decodeGanV1Facelets(await data(GAN_V1_CHARACTERISTICS.state));
        const after = await data(GAN_V1_CHARACTERISTICS.moves);
        if (before[12] !== after[12]) continue;
        counter = after[12];
        callbacks.onState(facelets);
        const battery = await data(GAN_V1_CHARACTERISTICS.battery);
        if (battery[7] <= 100) callbacks.onBattery(battery[7]);
        loop(); return;
      }
      throw new Error('Hold GAN v1 still while connecting');
    },
    dispose() { active = false; if (timer !== undefined) clearTimeout(timer); },
  };
}

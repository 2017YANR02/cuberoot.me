/**
 * Smoke test for the Stackmat decoder. Run manually:
 *   pnpm --filter @cuberoot/client exec tsx src/pages/timer/stackmat/__smoke__.ts
 *
 * Builds a synthetic packet representing a Stackmat 'S' (running) state at
 * 1:23.456, decodes it through the bit-level decoder, and prints the result.
 */

import { createDecoder, feed, synthesizePacket } from './decoder';
import { parsePacket } from './packet';

function buildBytes(stateChar: string, m: number, s: number, ms: number): number[] {
  const sBy = stateChar.charCodeAt(0);
  const M = m & 0x0f;
  const S0 = Math.floor(s / 10);
  const S1 = s % 10;
  const M0 = Math.floor(ms / 100);
  const M1 = Math.floor((ms / 10) % 10);
  const M2 = ms % 10;
  const digits = [M, S0, S1, M0, M1, M2];
  const sum = digits.reduce((a, b) => a + b, 0);
  const checksum = (sum + 64) & 0xff;
  return [
    sBy,
    0x30 + M, 0x30 + S0, 0x30 + S1,
    0x30 + M0, 0x30 + M1, 0x30 + M2,
    checksum,
    0x0A,
  ];
}

function main() {
  const sampleRate = 44100;

  // 1) Direct packet parse.
  const direct = buildBytes('S', 1, 23, 456);
  const directPkt = parsePacket(new Uint8Array(direct));
  console.log('[direct] parsePacket =>', directPkt);
  if (!directPkt || directPkt.totalMs !== 83456) {
    throw new Error('FAIL: direct parse mismatch');
  }

  // 2) Decode through audio.
  const audio = synthesizePacket(direct, sampleRate);
  const decoder = createDecoder(sampleRate);
  // Feed in chunks of 512 like a real ScriptProcessor.
  let lastPkt = null;
  for (let i = 0; i < audio.length; i += 512) {
    const chunk = audio.subarray(i, Math.min(i + 512, audio.length));
    const p = feed(decoder, chunk);
    if (p) lastPkt = p;
  }
  console.log('[audio]  decoded =>', lastPkt);
  if (!lastPkt || lastPkt.totalMs !== 83456 || lastPkt.state !== 'S') {
    throw new Error('FAIL: audio decode mismatch');
  }

  // 3) Idle packet.
  const idle = buildBytes(' ', 0, 0, 0);
  const idleAudio = synthesizePacket(idle, sampleRate);
  const decoder2 = createDecoder(sampleRate);
  let idlePkt = null;
  for (let i = 0; i < idleAudio.length; i += 512) {
    const chunk = idleAudio.subarray(i, Math.min(i + 512, idleAudio.length));
    const p = feed(decoder2, chunk);
    if (p) idlePkt = p;
  }
  console.log('[idle]   decoded =>', idlePkt);
  if (!idlePkt || idlePkt.state !== ' ' || idlePkt.totalMs !== 0) {
    throw new Error('FAIL: idle decode mismatch');
  }

  console.log('OK — all smoke checks passed.');
}

main();

import { describe, expect, it } from 'vitest';

import {
  GOCUBE_COMMAND_BATTERY,
  createGoCubeCommand,
  matchesGoCubeName,
  parseGoCubeNotification,
} from '@cuberoot/shared/smart-cube/gocube';

function frame(opcode: number, payload: number[] | string): ArrayBuffer {
  const body = typeof payload === 'string'
    ? Array.from(payload, (character) => character.charCodeAt(0))
    : payload;
  return Uint8Array.from([
    0x2a,
    body.length + 4,
    opcode,
    ...body,
    0,
    0x0d,
    0x0a,
  ]).buffer;
}

describe('shared GoCube protocol', () => {
  it('matches only the supported plaintext device family', () => {
    expect(matchesGoCubeName('GoCube Edge')).toBe(true);
    expect(matchesGoCubeName("Rubik's Connected")).toBe(true);
    expect(matchesGoCubeName('Rubiks Connected')).toBe(true);
    expect(matchesGoCubeName('GAN12ui')).toBe(false);
    expect(matchesGoCubeName(undefined)).toBe(false);
  });

  it('creates one-byte commands and rejects impossible values', () => {
    expect(Array.from(new Uint8Array(createGoCubeCommand(GOCUBE_COMMAND_BATTERY))))
      .toEqual([0x32]);
    expect(() => createGoCubeCommand(-1)).toThrow(RangeError);
    expect(() => createGoCubeCommand(256)).toThrow(RangeError);
    expect(() => createGoCubeCommand(1.5)).toThrow(RangeError);
  });

  it('decodes move batches with the canonical axis mapping', () => {
    expect(parseGoCubeNotification(frame(0x01, [0, 8, 3, 9, 11, 10]))).toEqual({
      type: 'moves',
      moves: ['B', "F'", "L'"],
    });
  });

  it('decodes orientation and battery notifications', () => {
    expect(parseGoCubeNotification(frame(0x03, '16384#-16384#0#8192'))).toEqual({
      type: 'orientation',
      quaternion: { w: 0.5, x: 1, y: -1, z: 0 },
    });
    expect(parseGoCubeNotification(frame(0x05, [87]))).toEqual({
      type: 'battery',
      level: 87,
    });
  });

  it('honours a view byte window instead of reading adjacent bytes', () => {
    const notification = new Uint8Array(frame(0x05, [64]));
    const padded = Uint8Array.from([9, 9, ...notification, 8, 8]);
    const view = new DataView(padded.buffer, 2, notification.byteLength);

    expect(parseGoCubeNotification(view)).toEqual({ type: 'battery', level: 64 });
  });

  it('drops malformed, unknown and unsafe notifications', () => {
    const badHead = new Uint8Array(frame(0x05, [50]));
    badHead[0] = 0;
    const badTail = new Uint8Array(frame(0x05, [50]));
    badTail[badTail.length - 1] = 0;
    const badLength = new Uint8Array(frame(0x05, [50]));
    badLength[1] = 0;

    expect(parseGoCubeNotification(badHead)).toBeNull();
    expect(parseGoCubeNotification(badTail)).toBeNull();
    expect(parseGoCubeNotification(badLength)).toBeNull();
    expect(parseGoCubeNotification(Uint8Array.of(0x2a, 0x0d, 0x0a))).toBeNull();
    expect(parseGoCubeNotification(frame(0x04, [1]))).toBeNull();
    expect(parseGoCubeNotification(frame(0x05, [101]))).toBeNull();
    expect(parseGoCubeNotification(frame(0x03, '1#2#3#nope'))).toBeNull();
  });
});

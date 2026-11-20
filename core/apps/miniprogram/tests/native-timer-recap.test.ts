import { describe, expect, it, vi } from 'vitest';
import type { Solve } from '@cuberoot/shared/timer/types';
import { decodeReplayParam } from '@cuberoot/shared/timer/replay-decode';
import { createNativeTimerRecap, shouldAutoRecap } from '../src/lib/native-timer-recap';
import { nativeTimerPreview } from '../src/lib/native-timer-preview';
import { encodeNativeGyroTrack } from '../src/lib/native-timer-gyro';

const solve: Solve = {
  id: 'gan-test', ts: 1, timeMs: 1_000, event: '333', penalty: 'ok', scramble: 'R U',
  device: { model: 'gan-v4', name: 'GAN test cube' }, inspectionMs: 9_000,
  moves: [{ m: "U'", ts: 100 }, { m: "R'", ts: 750 }],
};

describe('native timer raw reconstruction', () => {
  it('uses the recorded frame and timestamps through playback, raw seek and the solved preview', () => {
    const recap = createNativeTimerRecap(solve, 'en')!;
    expect(recap.seek(0)).toMatchObject({ index: 0, total: 2, timeMs: 0, endMs: 750, move: '' });
    expect(recap.seekRaw(1)).toMatchObject({ index: 1, timeMs: 100, move: "U'" });
    expect(recap.advance(749)).toMatchObject({ index: 1, timeMs: 749, playing: true });
    expect(recap.advance(900)).toMatchObject({ index: 2, timeMs: 750, playing: false, move: "R'" });
    expect(recap.seek(2).image).toBe(nativeTimerPreview('333', ''));
    expect(recap.seek(0).image).not.toBe(recap.seek(2).image);
  });

  it('projects the actual moves and shared measurements, including the normal replay payload', () => {
    const recap = createNativeTimerRecap(solve, 'zh')!;
    expect(recap.rows[1]).toMatchObject({ index: 2, move: "R'", gap: 650, gapTime: '0.65', slow: true });
    expect(recap.slices).toMatchObject({ htmCount: 2, qtmCount: 2, longestPauseMs: 650, pauseCount: 1 });
    expect(recap.summary).toMatchObject({ stm: 2, tps: 2 });
    expect(recap.stages.map(stage => stage.key)).toEqual(['cross', 'f2l', 'oll', 'pll']);
    expect(recap.copyText).toBe("R U\n\nU' R'");
    const replay = new URL(recap.shareUrl());
    expect(replay.pathname).toBe('/zh/timer');
    expect(decodeReplayParam(replay.searchParams.get('replay')!)).toMatchObject({
      scramble: solve.scramble, moves: [{ m: "U'", ts: 0 }, { m: "R'", ts: 650 }],
    });
  });

  it('keeps timer-only results out of the playback view and honors the shared auto-recap setting', () => {
    expect(createNativeTimerRecap({ ...solve, moves: [] }, 'en')).toBeNull();
    expect(shouldAutoRecap(solve, {})).toBe(true);
    expect(shouldAutoRecap(solve, { autoRecap: false })).toBe(false);
  });

  it('uses the native byte encoder when the mini program has no btoa global', () => {
    const recap = createNativeTimerRecap({ ...solve, device: { model: 'gan-v4', name: '我的 GAN' } }, 'zh')!;
    const expected = recap.shareUrl();
    vi.stubGlobal('btoa', undefined);
    vi.stubGlobal('wx', { arrayBufferToBase64: (buffer: ArrayBuffer) => Buffer.from(buffer).toString('base64') });
    try { expect(recap.shareUrl()).toBe(expected); }
    finally { vi.unstubAllGlobals(); }
  });

  it('plays the quantized recorded pose and uses the shared move-animation duration', () => {
    const samples = [
      { tMs: 0, q: { w: 1, x: 0, y: 0, z: 0 } },
      { tMs: 750, q: { w: Math.SQRT1_2, x: Math.SQRT1_2, y: 0, z: 0 } },
    ];
    vi.stubGlobal('btoa', undefined);
    vi.stubGlobal('atob', undefined);
    vi.stubGlobal('wx', {
      arrayBufferToBase64: (buffer: ArrayBuffer) => Buffer.from(buffer).toString('base64'),
      base64ToArrayBuffer: (value: string) => Uint8Array.from(Buffer.from(value, 'base64')).buffer,
    });
    try {
      const gyro = encodeNativeGyroTrack(samples, 'scramble');
      const recap = createNativeTimerRecap({ ...solve, gyro: gyro ?? undefined }, 'en')!;
      expect(recap.hasGyro).toBe(true);
      expect(recap.poseAt(750)?.x).toBeCloseTo(Math.SQRT1_2);
      expect(recap.poseAt(375)?.x).toBeCloseTo(Math.sin(Math.PI / 8));
      expect(recap.moveAt(1)).toEqual({ token: "U'", durationTicks: 30 });
      expect(recap.seek(1).setup).toBe("R U U'");
    } finally { vi.unstubAllGlobals(); }
  });
});

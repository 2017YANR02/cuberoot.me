import { describe, expect, it } from 'vitest';
import { HistoryPlay, historyLight } from '@/app/[lang]/dev/architecture/history/history-play';

describe('history light trail', () => {
  it('allows two jumps, lands, and makes the next jump available', () => {
    const game = new HistoryPlay();
    expect(game.jump()).toBe(true);
    for (let frame = 0; frame < 20; frame++) game.step(1 / 60, 0, 0);
    const firstHeight = game.height;
    expect(game.jump()).toBe(true);
    expect(game.jump()).toBe(false);
    for (let frame = 0; frame < 20; frame++) game.step(1 / 60, 0, 0);
    expect(game.height).toBeGreaterThan(firstHeight);
    for (let frame = 0; frame < 180; frame++) game.step(1 / 60, 0, 0);
    expect(game.height).toBe(0);
    expect(game.jump()).toBe(true);
  });

  it.each([30, 60, 120])('uses the same jump trajectory at %s fps', fps => {
    const game = new HistoryPlay(); game.jump();
    for (let frame = 0; frame < fps / 2; frame++) game.step(1 / fps, 0, 0);
    expect(game.height).toBeCloseTo(2.55, 10);
  });

  it('freezes a paused jump and clears it on explicit navigation', () => {
    const game = new HistoryPlay(); game.jump(); game.step(.08, 0, 0);
    const height = game.height;
    for (const dt of [0, -1, NaN, Infinity]) game.step(dt, 0, 0);
    expect(game.height).toBe(height);
    game.seek(); expect(game.height).toBe(0); expect(game.score.combo).toBe(0);
    expect(game.jump()).toBe(true);
  });

  it('collects swept airborne crossings once and scores consecutive lights', () => {
    const game = new HistoryPlay(), first = historyLight(2, 0), second = historyLight(2, 1);
    game.jump(); game.step(.06, 0, 0); game.step(.06, 0, 0);
    game.step(.02, first.x - 2, first.x + 2);
    expect(game.score).toEqual({ lights: 1, score: 10, combo: 1, flips: 0, status: 'cruise' });
    game.step(.04, second.x - 2, second.x + 2);
    expect(game.score).toEqual({ lights: 2, score: 30, combo: 2, flips: 0, status: 'cruise' });
    game.step(.01, second.x - 2, second.x + 2);
    expect(game.score.score).toBe(30);
    game.seek(); expect(game.collected.size).toBe(2); expect(game.score.combo).toBe(0);
    game.reset(); expect(game.collected.size).toBe(0); expect(game.score.score).toBe(0);
  });

  it('does not collect by walking underneath, scrubbing, or moving backwards', () => {
    const game = new HistoryPlay(), light = historyLight(2, 0);
    game.step(.02, light.x - 1, light.x + 1);
    expect(game.score.score).toBe(0);
    game.jump(); game.step(.06, 0, 0); game.step(.06, 0, 0);
    game.step(.02, light.x - 20, light.x + 20);
    game.step(.02, light.x + 1, light.x - 1);
    expect(game.score.score).toBe(0);
  });

  it('expires a combo on active time without taking away collected lights', () => {
    const game = new HistoryPlay(), light = historyLight(0, 0);
    game.jump(); game.step(.06, 0, 0); game.step(.06, 0, 0);
    game.step(.02, light.x - 1, light.x + 1);
    for (let frame = 0; frame < 240; frame++) game.step(1 / 60, light.x + 1, light.x + 1);
    expect(game.score).toEqual({ lights: 1, score: 10, combo: 0, flips: 0, status: 'cruise' });
  });

  it.each([30, 60, 120])('rewards a released full flip only on landing at %s fps', fps => {
    const game = new HistoryPlay(); game.setGliding(true); game.jump(); game.hold(true);
    for (let i = 0; i < Math.round(fps * .85); i++) game.step(1 / fps, 0, 0);
    expect(game.score.flips).toBe(0);
    game.hold(false);
    for (let i = 0; i < Math.ceil(fps * .3); i++) game.step(1 / fps, 0, 0);
    expect(game.height).toBe(0);
    expect(game.score).toEqual({ lights: 0, score: 100, combo: 0, flips: 1, status: 'boost' });
    expect(game.speedFactor).toBe(1.15);
    game.seek(); expect(game.score.status).toBe('cruise'); expect(game.speedFactor).toBe(1);
  });

  it('slows an unfinished flip, blocks jumps briefly, then recovers', () => {
    const game = new HistoryPlay(); game.setGliding(true); game.jump(); game.hold(true);
    for (let i = 0; i < 30; i++) game.step(1 / 60, 0, 0);
    game.hold(false);
    for (let i = 0; i < 36; i++) game.step(1 / 60, 0, 0);
    expect(game.score.status).toBe('stumble'); expect(game.score.flips).toBe(0);
    expect(game.speedFactor).toBe(.38); expect(game.jump()).toBe(false);
    for (let i = 0; i < 72; i++) game.step(1 / 60, 0, 0);
    expect(game.score.status).toBe('cruise'); expect(game.jump()).toBe(true);
  });

  it('holding while walking cannot rotate or earn a flip; changing gait releases a flip', () => {
    const game = new HistoryPlay(); game.jump(); game.hold(true);
    for (let i = 0; i < 30; i++) game.step(1 / 60, 0, 0);
    expect(game.rotation).toBe(0);
    game.setGliding(true); game.hold(true); game.step(.08, 0, 0);
    expect(game.rotation).toBeGreaterThan(0);
    game.setGliding(false); expect(game.rotation).toBe(0);
    game.seek(); expect(game.score.flips).toBe(0);
  });
});

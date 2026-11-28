import { describe, expect, it } from 'vitest';
import { captionAss, initialCaptionStyle, pasteBoundaries, prepareCaptions, solutionCues } from '../lib/video-tools/recon-captions';

describe('caption source timestamps', () => {
  it('does not treat a stage duration or a zero-time inspection as a video timestamp', () => {
    const [cue] = solutionCues("x // insp\nR U' // pair (0.90)", NaN);
    expect(cue.start).toBeNaN();
    expect(cue.end).toBeNaN();
    const [timed] = prepareCaptions(solutionCues("R U' // pair (0.90)", .74));
    expect(timed.end).toBe(1.64);
    expect(timed.turns.every(t => Number.isNaN(t.from))).toBe(true);
  });

  it('keeps the marked source frame when editing stage boundaries and preserves pauses in ASS', () => {
    const adjusted = pasteBoundaries('0:00.50 0:01.5', [{
      text: "R U' F", start: .6, end: 1.8,
      marks: [{ start: .74, end: .8 }, { start: .9, end: 1.12 }, null],
    }], 2);
    const timeline = prepareCaptions(adjusted);
    expect(timeline[0].turns.map(t => [t.from, t.to])).toEqual([[.74, .8], [.9, 1.12], [NaN, NaN]]);
    const events = captionAss(timeline, initialCaptionStyle, 'Pixter-Granular Bold', 1920, 1080);
    expect(events).toContain('Style: Turns,Pixter-Granular Bold,64.00,&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,0,');
    expect(events).toContain('Dialogue: 1,0:00:00.80,0:00:00.90,');
    expect(events.split('\n').find(s => s.startsWith('Dialogue: 1,0:00:00.80'))).not.toContain('\\1c');
    expect(events).not.toContain('NaN');
  });
});

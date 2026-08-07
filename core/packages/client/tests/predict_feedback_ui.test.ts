import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const CLIENT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PAGE = readFileSync(join(CLIENT, 'app', '[lang]', 'predict', 'page.tsx'), 'utf8');

describe('/predict answer feedback and playback controls', () => {
  it('shows distinct feedback for correct and wrong sticker clicks', () => {
    expect(PAGE).toContain("setFeedback({ kind: 'wrong' })");
    expect(PAGE).toContain("setFeedback({ kind: 'correct' })");
    expect(PAGE).toContain('className="predict-feedback predict-correct"');
    expect(PAGE).toContain('className="predict-feedback predict-wrong"');
  });

  it('keeps the shared playback bar mounted from the initial question', () => {
    expect(PAGE).not.toMatch(/showPlayback\s*&&/);
    expect(PAGE).toMatch(/<div className="predict-replay">\s*<PlaybackBar/);
  });

  it('does not offer a bulk reset for the visible challenge settings', () => {
    expect(PAGE).not.toContain('ResetDefaultsButton');
    expect(PAGE).not.toContain('restoreDefaults');
  });
});

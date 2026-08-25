import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const CLIENT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PAGE = readFileSync(join(CLIENT, 'app', '[lang]', 'predict', 'page.tsx'), 'utf8');
const BOARD = readFileSync(join(CLIENT, 'app', '[lang]', 'predict', '_components', 'PredictBoard.tsx'), 'utf8');
const NOTATION_TRAINER = readFileSync(join(CLIENT, 'app', '[lang]', 'notation', '_components', 'NotationTrainer.tsx'), 'utf8');
const FEEDBACK_OVERLAY = readFileSync(join(CLIENT, 'components', 'TrainingFeedbackOverlay.tsx'), 'utf8');
const FEEDBACK_STYLES = readFileSync(join(CLIENT, 'components', 'TrainingFeedbackOverlay.module.css'), 'utf8');

describe('/predict answer feedback and playback controls', () => {
  it('shows distinct feedback for correct and wrong sticker clicks', () => {
    expect(PAGE).toContain("setFeedback({ kind: 'wrong' })");
    expect(PAGE).toContain("setFeedback({ kind: 'correct' })");
    expect(PAGE).toContain('<TrainingFeedbackOverlay');
    expect(FEEDBACK_OVERLAY).toContain("kind === 'correct'");
    expect(FEEDBACK_STYLES).toContain('var(--signal-success)');
    expect(FEEDBACK_STYLES).toContain('var(--destructive)');
  });

  it('reuses the same timed feedback overlay in both notation-training modes', () => {
    expect(NOTATION_TRAINER).toContain('<TrainingFeedbackOverlay');
    expect(NOTATION_TRAINER).toContain("showFeedback('correct')");
    expect(NOTATION_TRAINER).toContain("showFeedback('wrong')");
    expect(NOTATION_TRAINER).toContain('setFeedbackPulse(null), 1200');
  });

  it('keeps the shared playback bar mounted from the initial question', () => {
    expect(PAGE).not.toMatch(/showPlayback\s*&&/);
    expect(PAGE).toMatch(/<div className="predict-replay">\s*<PlaybackBar/);
  });

  it('does not offer a bulk reset for the visible challenge settings', () => {
    expect(PAGE).not.toContain('ResetDefaultsButton');
    expect(PAGE).not.toContain('restoreDefaults');
  });

  it('resets the 3D view after every successfully dealt challenge', () => {
    expect(PAGE).toContain('setViewResetSeq((seq) => seq + 1)');
    expect(PAGE).toContain('viewResetSeq={viewResetSeq}');
    expect(BOARD).toContain('useEffect(() => { resetView(); }, [resetView, viewResetSeq, ready])');
  });
});

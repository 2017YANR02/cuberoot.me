import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('Web timer shared print report', () => {
  it('mounts the shared report and removes the state-dependent legacy print header', () => {
    const source = readFileSync('app/[lang]/timer/_shell/SoloView.tsx', 'utf8');
    const css = readFileSync('app/[lang]/timer/timer.css', 'utf8');

    expect(source).toContain("TimerPrintController,");
    expect(source).toContain('<TimerPrintController');
    expect(source).toContain('currentResult={digitsText}');
    expect(source).toContain('currentScramble={displayScramble}');
    expect(source).not.toContain('print-only-header');
    expect(css).not.toContain('.print-only-header');
  });
});

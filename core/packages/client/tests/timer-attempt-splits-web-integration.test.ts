import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('Web timer attempt split integration', () => {
  it('consumes the shared recorder and UI without retaining private hooks', () => {
    const web = readFileSync('app/[lang]/timer/_shell/SoloView.tsx', 'utf8');
    const settings = readFileSync('app/[lang]/timer/_components/SettingsPanel.tsx', 'utf8');

    expect(web).toContain('new TimerAttemptSplitRecorder');
    expect(web).toContain('<TimerAttemptSplitStatus');
    expect(web).toContain("case 'mark-stage'");
    expect(web).toContain("case 'mark-bld-memo'");
    expect(web).toContain('timerSmartCubeStartsAttemptOnTurn');
    expect(web).not.toContain('useMultiStage');
    expect(web).not.toContain('useBldMemo');
    expect(settings).toContain('<TimerAttemptSplitSettings');
  });
});

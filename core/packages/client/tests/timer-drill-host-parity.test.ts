import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const solo = readFileSync(
  new URL('../app/[lang]/timer/_shell/SoloView.tsx', import.meta.url),
  'utf8',
);
const webPicker = readFileSync(
  new URL('../app/[lang]/timer/_components/DrillModal.tsx', import.meta.url),
  'utf8',
);
const oldGenerator = readFileSync(
  new URL('../app/[lang]/timer/_lib/scramble/drill.ts', import.meta.url),
  'utf8',
);

describe('Web and installed Timer drill parity', () => {
  it('keeps Web compatibility paths as shared re-exports without a private generator', () => {
    expect(webPicker.trim()).toBe("export { TimerDrillPicker as default } from '@cuberoot/timer-ui';");
    expect(oldGenerator).toContain('generateTimerDrillScramble');
    expect(oldGenerator).not.toContain('generateDrillScramble');
    expect(oldGenerator).not.toContain('function findCase');
  });

  it('uses the same strict generator and picker contract as installed clients', () => {
    expect(solo).toContain('generateTimerDrillScramble(drillTarget)');
    expect(solo).toContain('language={timerLanguage}');
    expect(solo).toContain('onPick={setDrillTarget}');
  });

  it('captures the selected case with the displayed history entry', () => {
    expect(solo).toContain('caseId: string | null;');
    expect(solo).toContain('event === drillTarget.type ? ds.targetCase : null');
    expect(solo).toContain('caseIdAtStartRef.current = currentScrambleEntry.caseId');
    expect(solo).toContain("{ kind: 'random', identity: `drill|${event}|${drillTarget.type}:${drillTarget.id}` }");
    expect(solo).toContain('const entry = history.list[history.idx];');
    expect(solo).toMatch(/const meta = s\.scrambleSource[\s\S]*?s\.scrambleSource\.kind === 'wca'[\s\S]*?: null[\s\S]*?: wcaMetaFor\(s\.scramble\)/);
  });
});

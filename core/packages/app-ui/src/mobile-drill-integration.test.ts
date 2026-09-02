import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const app = readFileSync(new URL('./App.tsx', import.meta.url), 'utf8');
const moreActions = readFileSync(new URL('./mobile-more-actions.ts', import.meta.url), 'utf8');

describe('Mobile Timer drill integration', () => {
  it('uses the shared picker and strict shared generator without a Web fallback', () => {
    expect(app).toContain('generateTimerDrillScramble(target)');
    expect(app).toContain('<TimerDrillPicker');
    expect(app).not.toContain('/timer?');
    expect(moreActions).toContain("'more.drill',");
  });

  it('freezes drill identity and exact trainer case into the displayed slot', () => {
    expect(app).toContain('`${identity}|drill:${target.type}:${target.id}`');
    expect(app).toContain('caseId: event === target.type ? generated.targetCase : null');
    expect(app).toContain('identity: `drill|${event}|${target.type}:${target.id}`');
    expect(app).toContain("kind: 'random'");
    expect(app).toContain('if (sourceIdentity !== scrambleIdentityFor(source, event)) return;');
  });

  it('keeps manual input first and resets through the canonical history path', () => {
    const manual = app.indexOf("if (source === 'manual') {");
    const drill = app.indexOf('const target = timerEventSupportsDrill(event)', manual);
    const random = app.indexOf("if (source === 'random') {", drill);
    expect(manual).toBeGreaterThan(-1);
    expect(drill).toBeGreaterThan(manual);
    expect(random).toBeGreaterThan(drill);
    expect(app).toContain("nextScramble(scrambleSource, activeEvent, 'reset');");
  });

  it('keeps active drill reopenable and closes the picker on unsupported events', () => {
    expect(app).toContain('drillActive: effectiveDrillTarget !== null');
    expect(app).toContain('openOverlayRef.current = TIMER_OVERLAY_IDS.drillPicker');
    expect(app).toContain('openOverlay !== TIMER_OVERLAY_IDS.drillPicker');
    expect(app).toContain('if (!timerEventSupportsDrill(activeEvent) && drillTarget) setDrillTarget(null)');
  });
});

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { mobileBackAction, type MobileBackContext } from './mobile-back';

const app = readFileSync(new URL('./App.tsx', import.meta.url), 'utf8');

const BASE: MobileBackContext = {
  fullscreen: false,
  manualEntryOpen: false,
  moreOpen: false,
  mutationBusy: false,
  overlayOpen: false,
  phase: 'idle',
  view: 'timer',
  webDepth: 0,
};

describe('Android Back priority', () => {
  it('cancels every pre-run phase without exiting the app', () => {
    expect(mobileBackAction({ ...BASE, phase: 'holding' })).toBe('cancel-arm');
    expect(mobileBackAction({ ...BASE, phase: 'ready' })).toBe('cancel-arm');
    expect(mobileBackAction({ ...BASE, phase: 'inspecting' })).toBe('cancel-arm');
  });

  it('exits fullscreen before blocking a running attempt', () => {
    expect(mobileBackAction({ ...BASE, fullscreen: true, phase: 'running' }))
      .toBe('exit-fullscreen');
    expect(mobileBackAction({ ...BASE, phase: 'running' })).toBe('block-busy');
  });

  it('closes overlays and subviews before delegating or exiting', () => {
    expect(mobileBackAction({
      ...BASE,
      fullscreen: true,
      manualEntryOpen: true,
      moreOpen: true,
      overlayOpen: true,
      phase: 'running',
    })).toBe('close-overlay');
    expect(mobileBackAction({ ...BASE, moreOpen: true })).toBe('close-more');
    expect(mobileBackAction({ ...BASE, manualEntryOpen: true })).toBe('close-manual-entry');
    expect(mobileBackAction({ ...BASE, view: 'history' })).toBe('close-subview');
    expect(mobileBackAction({ ...BASE, view: 'tools', webDepth: 2 })).toBe('embedded-back');
    expect(mobileBackAction(BASE)).toBe('exit-app');
  });

  it('controls every shared timer popover through one stable overlay id', () => {
    expect(app).toContain('useState<TimerOverlayId | null>(null)');
    expect(app).toContain('const openOverlayRef = useRef<TimerOverlayId | null>(openOverlay)');
    expect(app.match(/onOpenChange=\{handleTimerOverlayOpenChange\}/g)).toHaveLength(4);
    expect(app).toContain('onQuickMenuOpenChange={handleTimerOverlayOpenChange}');
    expect(app).toContain('quickMenuOpen={openOverlay === TIMER_OVERLAY_IDS.historyQuickMenu}');
    expect(app).toContain('open={openOverlay === TIMER_OVERLAY_IDS.puzzlePicker}');
    expect(app).toContain('open={openOverlay === TIMER_OVERLAY_IDS.scrambleSource}');
    expect(app).toContain('open={openOverlay === TIMER_OVERLAY_IDS.wcaCompetition}');
    expect(app).toContain('open={openOverlay === TIMER_OVERLAY_IDS.sessionSwitcher}');
    expect(app).toContain('overlayOpen: openOverlayRef.current !== null');
    expect(app).toMatch(
      /if \(action === 'close-overlay'\) \{\s*openOverlayRef\.current = null;\s*setOpenOverlay\(null\);/,
    );
  });

  it('removes a late host listener after React cleanup wins the race', () => {
    const registration = app.slice(
      app.indexOf('host.addBackButtonListener(() =>'),
      app.indexOf("document.addEventListener('fullscreenchange'"),
    );
    expect(registration).toContain('if (!active) {');
    expect(registration).toContain('void handle.remove();');
    expect(registration).toMatch(/return \(\) => \{\s*active = false;\s*void removeListener\?\.\(\);/);
  });
});

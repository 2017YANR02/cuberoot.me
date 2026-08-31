import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const wrapper = readFileSync(
  new URL('../app/[lang]/timer/_shell/SessionSwitcher.tsx', import.meta.url),
  'utf8',
);
const shellCss = readFileSync(
  new URL('../app/[lang]/timer/_shell/shell.css', import.meta.url),
  'utf8',
);

describe('Web timer session switcher adapter', () => {
  it('delegates the real UI and copy while keeping only persistence callbacks', () => {
    expect(wrapper).toContain('TimerSessionSwitcher as SharedTimerSessionSwitcher');
    expect(wrapper).toContain('TIMER_SESSION_UI_COPY');
    expect(wrapper).toContain('createAndActivateSession');
    expect(wrapper).toContain('setActiveSession(sessionId)');
    expect(wrapper).toContain('clearSession(sessionId)');
    expect(wrapper).toContain('deleteSession(sessionId)');
    expect(wrapper).not.toContain('window.confirm');
    expect(wrapper).not.toContain('lucide-react');
    expect(wrapper).not.toContain('className="session-menu"');
  });

  it('does not retain a second Web-only session CSS implementation', () => {
    expect(shellCss).not.toMatch(/\.session-(?:switcher|trigger|menu|item|rename|add-btn)/);
  });
});

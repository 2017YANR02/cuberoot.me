import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const app = readFileSync(new URL('./App.tsx', import.meta.url), 'utf8');
const repository = readFileSync(new URL('./data/timer-repository.ts', import.meta.url), 'utf8');
const labels = readFileSync(new URL('./timer-session-labels.ts', import.meta.url), 'utf8');

describe('Mobile timer session single-source contract', () => {
  it('mounts the real shared switcher in History with a snapshot-gated host', () => {
    expect(app).toContain('<TimerSessionSwitcher');
    expect(app).toMatch(
      /view === 'history'[\s\S]*?<TimerSessionSwitcher[\s\S]*?sessions=\{store!?\.database\.sessions\}/,
    );
    expect(app).toContain('const sessionHost = useMemo<TimerSessionSwitcherHost>');
    expect(app).toMatch(
      /commitSessionMutation[\s\S]*?beginMutation\(\)[\s\S]*?commitIfLatest\(revision, data, applyStoreSnapshot\)/,
    );
    expect(app).toContain('recoverLatestStoreSnapshot(revision)');
    expect(app).toContain('onOperationError={() => announce(copy.actionFailed)}');
  });

  it('associates event selection atomically and keeps labels on shared bilingual copy', () => {
    expect(app).toContain('repository.selectEvent(nextEvent)');
    expect(app).not.toContain('repository.updateSettings({ event: nextEvent })');
    expect(repository).toContain('associateTimerSessionEvent(');
    expect(repository).toContain('activateTimerSessionForEvent(');
    expect(repository).toContain('moveTimerSolveToSession(');
    expect(repository).not.toMatch(/function\s+sessionEventIn/);
    expect(labels).toContain('TIMER_SESSION_UI_COPY');
    expect(labels).not.toMatch(/['"](?:New session|新分组|Delete session|删除分组)['"]/);
  });
});

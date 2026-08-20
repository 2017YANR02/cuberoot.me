// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import TimerBootstrap, {
  buildTimerBootDiagnostic,
  type TimerBootDiagnostic,
} from '@/app/[lang]/timer/_components/TimerBootstrap';
import { TIMER_BOOT_EARLY_SCRIPT } from '@/app/[lang]/timer/_lib/timer_boot_early';

function ReadyTimer() {
  return createElement('div', null, 'timer ready');
}

describe('TimerBootstrap', () => {
  let host: HTMLDivElement;
  let root: Root;
  let consoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.useFakeTimers();
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    window.__timerBootDiagnostic = undefined;
    window.sessionStorage.clear();
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    vi.useRealTimers();
    consoleError.mockRestore();
    vi.restoreAllMocks();
  });

  it('replaces the loading state when the timer shell resolves', async () => {
    await act(async () => {
      root.render(createElement(TimerBootstrap, {
        loadTimerShell: async () => ({ default: ReadyTimer }),
      }));
      await Promise.resolve();
    });

    expect(host.textContent).toContain('timer ready');
    expect(host.textContent).not.toContain('Loading timer');
  });

  it('shows a diagnostic code and retries after a startup timeout', async () => {
    const retry = vi.fn();
    await act(async () => {
      root.render(createElement(TimerBootstrap, {
        loadTimerShell: () => new Promise<never>(() => {}),
        timeoutMs: 1_000,
        onRetry: retry,
      }));
    });

    await act(async () => vi.advanceTimersByTime(1_000));

    const alert = host.querySelector('[role="alert"]');
    expect(alert).not.toBeNull();
    expect(alert?.querySelector('code')?.textContent).toMatch(/^TMR-TIMEOUT-/);
    expect(window.__timerBootDiagnostic?.kind).toBe('timeout');
    expect(consoleError).toHaveBeenCalledWith('[timer-bootstrap]', expect.any(Object));

    const retryButton = Array.from(host.querySelectorAll('button'))
      .find(button => button.textContent === 'Retry');
    retryButton?.click();
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it('classifies a rejected dynamic import as a chunk failure', async () => {
    await act(async () => {
      root.render(createElement(TimerBootstrap, {
        loadTimerShell: async () => {
          throw new Error('ChunkLoadError: Loading chunk 417 failed.');
        },
      }));
      await Promise.resolve();
    });

    expect(host.querySelector('code')?.textContent).toMatch(/^TMR-CHUNK-/);
    expect(window.__timerBootDiagnostic?.kind).toBe('chunk');
  });

  it('retains window error and unhandled rejection evidence for the timeout report', async () => {
    await act(async () => {
      root.render(createElement(TimerBootstrap, {
        loadTimerShell: () => new Promise<never>(() => {}),
        timeoutMs: 1_000,
      }));
    });

    const rejection = new Event('unhandledrejection') as PromiseRejectionEvent;
    Object.defineProperty(rejection, 'reason', { value: new Error('background rejection') });
    window.dispatchEvent(rejection);
    window.dispatchEvent(new ErrorEvent('error', {
      message: 'SyntaxError: Unexpected token',
      filename: 'https://cuberoot.me/_next/static/chunks/timer.js?secret=removed',
    }));

    await act(async () => vi.advanceTimersByTime(1_000));

    const diagnostic = window.__timerBootDiagnostic as TimerBootDiagnostic;
    expect(diagnostic.kind).toBe('script');
    expect(diagnostic.evidence.map(item => item.source)).toEqual(['unhandledrejection', 'error']);
    expect(diagnostic.evidence[1]?.url).toBe('https://cuberoot.me/_next/static/chunks/timer.js');
  });
});

describe('buildTimerBootDiagnostic', () => {
  it('uses a stable fingerprint without putting URL query data in the code', () => {
    const first = buildTimerBootDiagnostic(
      new Error('Failed to fetch dynamically imported module'),
      [],
      'import',
    );
    const second = buildTimerBootDiagnostic(
      new Error('Failed to fetch dynamically imported module'),
      [],
      'import',
    );

    expect(first.code).toBe(second.code);
    expect(first.code).toMatch(/^TMR-CHUNK-/);
  });
});

describe('timer bootstrap early guard', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    window.history.replaceState({}, '', '/timer');
    window.__timerBootDiagnostic = undefined;
    window.__timerBootEarly = undefined;
  });

  afterEach(() => {
    window.__timerBootEarly?.stop();
    document.documentElement.removeAttribute('data-timer-boot-guard');
    document.querySelector('[data-timer-bootstrap]')?.remove();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('replaces the server loading shell even when React never hydrates', () => {
    const shell = document.createElement('main');
    shell.setAttribute('data-timer-bootstrap', 'loading');
    document.body.appendChild(shell);

    window.eval(TIMER_BOOT_EARLY_SCRIPT);
    vi.advanceTimersByTime(20_000);

    expect(document.documentElement.getAttribute('data-timer-boot-guard')).toBe('stopped');
    expect(shell.getAttribute('role')).toBe('alert');
    expect(shell.querySelector('code')?.textContent).toMatch(/^TMR-TIMEOUT-/);
    expect(shell.querySelectorAll('button')).toHaveLength(2);
    expect(window.__timerBootDiagnostic?.kind).toBe('timeout');
  });

  it('does not install the early guard outside the timer route', () => {
    window.history.replaceState({}, '', '/wca');

    window.eval(TIMER_BOOT_EARLY_SCRIPT);

    expect(window.__timerBootEarly).toBeUndefined();
    expect(document.documentElement.hasAttribute('data-timer-boot-guard')).toBe(false);
  });
});

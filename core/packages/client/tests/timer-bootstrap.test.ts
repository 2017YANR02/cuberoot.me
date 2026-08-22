// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import TimerBootstrap, {
  buildTimerBootDiagnostic,
  type TimerBootDiagnostic,
} from '@/app/[lang]/timer/_components/TimerBootstrap';
import {
  APP_BOOT_COPY,
  APP_BOOT_EARLY_SCRIPT,
  TIMER_BOOT_COPY,
} from '@/lib/app_boot_early';

const WECHAT_CHROME_83_USER_AGENT = 'Mozilla/5.0 (Linux; Android 10; wv) AppleWebKit/537.36 Chrome/83.0.4103.106 Mobile Safari/537.36 MicroMessenger/8.0.76';
const ANDROID_CHROME_78_USER_AGENT = 'Mozilla/5.0 (Linux; Android 10; V1921A) AppleWebKit/537.36 Chrome/78.0.3904.96 Mobile Safari/537.36';
const IOS_15_WECHAT_USER_AGENT = 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_8_8 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 MicroMessenger/8.0.76';
const MODERN_CHROME_USER_AGENT = 'Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Chrome/140.0.0.0 Mobile Safari/537.36';

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
    expect(host.textContent).toContain(TIMER_BOOT_COPY.message.en);
  });

  it('does not promise that opening an old Android system browser will help', async () => {
    vi.spyOn(window.navigator, 'userAgent', 'get').mockReturnValue(WECHAT_CHROME_83_USER_AGENT);

    await act(async () => {
      root.render(createElement(TimerBootstrap, {
        loadTimerShell: async () => {
          throw new SyntaxError("Unexpected token '='");
        },
      }));
      await Promise.resolve();
    });

    expect(host.textContent).toContain(TIMER_BOOT_COPY.outdatedWechatMessage.en);
    expect(host.textContent).toContain('merely choosing “Open in system browser” may not help');
    expect(host.textContent).not.toContain(TIMER_BOOT_COPY.message.en);
  });

  it('explains that an old iOS system engine affects every browser on the device', async () => {
    vi.spyOn(window.navigator, 'userAgent', 'get').mockReturnValue(IOS_15_WECHAT_USER_AGENT);

    await act(async () => {
      root.render(createElement(TimerBootstrap, {
        loadTimerShell: async () => {
          throw new SyntaxError('Invalid regular expression: invalid group specifier name');
        },
      }));
      await Promise.resolve();
    });

    expect(host.textContent).toContain(TIMER_BOOT_COPY.outdatedIosMessage.en);
    expect(host.textContent).toContain('switching browsers on the same device may not help');
    expect(host.textContent).not.toContain(TIMER_BOOT_COPY.message.en);
  });

  it('routes an obsolete standalone Android browser to browser guidance', async () => {
    vi.spyOn(window.navigator, 'userAgent', 'get').mockReturnValue(ANDROID_CHROME_78_USER_AGENT);

    await act(async () => {
      root.render(createElement(TimerBootstrap, {
        loadTimerShell: async () => {
          throw new SyntaxError("Unexpected token '?'");
        },
      }));
      await Promise.resolve();
    });

    expect(host.textContent).toContain(TIMER_BOOT_COPY.outdatedBrowserMessage.en);
    expect(host.textContent).not.toContain(TIMER_BOOT_COPY.outdatedWechatMessage.en);
  });

  it('keeps generic diagnostics for a modern browser syntax error', async () => {
    vi.spyOn(window.navigator, 'userAgent', 'get').mockReturnValue(MODERN_CHROME_USER_AGENT);

    await act(async () => {
      root.render(createElement(TimerBootstrap, {
        loadTimerShell: async () => {
          throw new SyntaxError('Unexpected token');
        },
      }));
      await Promise.resolve();
    });

    expect(host.textContent).toContain(TIMER_BOOT_COPY.message.en);
    expect(host.textContent).not.toContain(TIMER_BOOT_COPY.outdatedBrowserMessage.en);
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
    const insights = document.createElement('script');
    insights.src = 'https://cuberoot.me/_vercel/insights/script.js';
    document.head.appendChild(insights);
    insights.dispatchEvent(new Event('error'));
    insights.remove();
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

describe('app bootstrap early guard', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    window.history.replaceState({}, '', '/timer');
    window.__timerBootDiagnostic = undefined;
    window.__timerBootEarly = undefined;
    window.__appBootDiagnostic = undefined;
    window.__appBootEarly = undefined;
  });

  afterEach(() => {
    window.__appBootEarly?.stop();
    document.documentElement.removeAttribute('data-app-boot-guard');
    document.documentElement.removeAttribute('lang');
    document.querySelector('[data-timer-bootstrap]')?.remove();
    document.querySelector('[data-app-bootstrap]')?.remove();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('replaces the server loading shell even when React never hydrates', () => {
    const shell = document.createElement('main');
    shell.setAttribute('data-timer-bootstrap', 'loading');
    document.body.appendChild(shell);

    window.eval(APP_BOOT_EARLY_SCRIPT);
    vi.advanceTimersByTime(20_000);

    expect(document.documentElement.getAttribute('data-app-boot-guard')).toBe('stopped');
    expect(shell.getAttribute('role')).toBe('alert');
    expect(shell.querySelector('code')?.textContent).toMatch(/^TMR-TIMEOUT-/);
    expect(shell.querySelectorAll('button')).toHaveLength(2);
    expect(window.__timerBootDiagnostic?.kind).toBe('timeout');
  });

  it('shows the outdated WeChat guidance before React hydrates', () => {
    vi.spyOn(window.navigator, 'userAgent', 'get').mockReturnValue(WECHAT_CHROME_83_USER_AGENT);
    window.history.replaceState({}, '', '/zh/timer');
    document.documentElement.lang = 'zh-Hans';
    const shell = document.createElement('main');
    shell.setAttribute('data-timer-bootstrap', 'loading');
    document.body.appendChild(shell);

    window.eval(APP_BOOT_EARLY_SCRIPT);
    window.dispatchEvent(new ErrorEvent('error', {
      error: new SyntaxError("Unexpected token '='"),
      message: "Uncaught SyntaxError: Unexpected token '='",
      filename: 'https://cuberoot.me/_next/static/chunks/timer.js',
    }));
    vi.advanceTimersByTime(0);

    expect(shell.textContent).toContain(TIMER_BOOT_COPY.outdatedWechatMessage.zh);
    expect(shell.textContent).toContain('在系统浏览器打开');
    expect(shell.textContent).toContain('不一定有效');
    expect(shell.textContent).not.toContain(TIMER_BOOT_COPY.message.zh);
  });

  it('shows iOS system-update guidance before React hydrates', () => {
    vi.spyOn(window.navigator, 'userAgent', 'get').mockReturnValue(IOS_15_WECHAT_USER_AGENT);
    window.history.replaceState({}, '', '/zh/timer');
    document.documentElement.lang = 'zh-Hans';
    const shell = document.createElement('main');
    shell.setAttribute('data-timer-bootstrap', 'loading');
    document.body.appendChild(shell);

    window.eval(APP_BOOT_EARLY_SCRIPT);
    window.dispatchEvent(new ErrorEvent('error', {
      error: new SyntaxError('Invalid regular expression: invalid group specifier name'),
      message: 'Invalid regular expression: invalid group specifier name',
      filename: 'https://cuberoot.me/_next/static/chunks/timer.js',
    }));
    vi.advanceTimersByTime(0);

    expect(shell.textContent).toContain(TIMER_BOOT_COPY.outdatedIosMessage.zh);
    expect(shell.textContent).toContain('同一台设备上更换浏览器可能无效');
    expect(shell.textContent).not.toContain(TIMER_BOOT_COPY.message.zh);
  });

  it('shows the same actionable fallback on another route with a shared chunk parse failure', () => {
    vi.spyOn(window.navigator, 'userAgent', 'get').mockReturnValue(WECHAT_CHROME_83_USER_AGENT);
    window.history.replaceState({}, '', '/zh/paint');
    document.documentElement.lang = 'zh-Hans';

    window.eval(APP_BOOT_EARLY_SCRIPT);
    window.dispatchEvent(new ErrorEvent('error', {
      error: new SyntaxError("Unexpected token '='"),
      message: "Uncaught SyntaxError: Unexpected token '='",
      filename: 'https://cuberoot.me/_next/static/chunks/shared.js',
    }));
    vi.advanceTimersByTime(0);

    const alert = document.querySelector('[data-app-bootstrap="error"]');
    expect(alert?.textContent).toContain(APP_BOOT_COPY.outdatedWechatMessage.zh);
    expect(alert?.querySelector('code')?.textContent).toMatch(/^APP-CHUNK-/);
    expect(window.__appBootDiagnostic?.kind).toBe('chunk');
  });

  it('stops quietly after a normal non-timer page load', () => {
    window.history.replaceState({}, '', '/wca');

    window.eval(APP_BOOT_EARLY_SCRIPT);
    window.dispatchEvent(new Event('load'));
    vi.advanceTimersByTime(5_000);

    expect(document.documentElement.getAttribute('data-app-boot-guard')).toBe('stopped');
    expect(document.querySelector('[data-app-bootstrap="error"]')).toBeNull();
    expect(window.__appBootDiagnostic).toBeUndefined();
  });
});

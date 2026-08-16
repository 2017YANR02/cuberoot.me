import { afterEach, describe, expect, it, vi } from 'vitest';

import { openWebsitePageOnce } from '../src/lib/navigation';

describe('mini program website navigation', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('opens an allowlisted route and suppresses a duplicate tap', () => {
    let complete: (() => void) | undefined;
    const navigateTo = vi.fn((options: { complete(): void }) => {
      complete = options.complete;
    });
    vi.stubGlobal('wx', { navigateTo, showToast: vi.fn() });
    const owner = {};

    expect(openWebsitePageOnce(owner, 'alg', { failureMessage: '打开失败' })).toBe(true);
    expect(openWebsitePageOnce(owner, 'alg', { failureMessage: '打开失败' })).toBe(false);
    expect(navigateTo).toHaveBeenCalledOnce();
    expect(navigateTo).toHaveBeenCalledWith(expect.objectContaining({
      url: '/pages/web/index?key=alg',
    }));

    complete?.();
    expect(openWebsitePageOnce(owner, 'alg', { failureMessage: '打开失败' })).toBe(true);
    expect(navigateTo).toHaveBeenCalledTimes(2);
  });

  it('releases the lock when the runtime swallows navigation callbacks', () => {
    vi.useFakeTimers();
    const navigateTo = vi.fn();
    vi.stubGlobal('wx', { navigateTo, showToast: vi.fn() });
    const owner = {};

    expect(openWebsitePageOnce(owner, 'alg', { failureMessage: '打开失败' })).toBe(true);
    vi.advanceTimersByTime(4_999);
    expect(openWebsitePageOnce(owner, 'alg', { failureMessage: '打开失败' })).toBe(false);

    vi.advanceTimersByTime(1);
    expect(openWebsitePageOnce(owner, 'alg', { failureMessage: '打开失败' })).toBe(true);
    expect(navigateTo).toHaveBeenCalledTimes(2);
  });

  it('does not let a stale completion release a newer navigation lock', () => {
    vi.useFakeTimers();
    const completions: Array<() => void> = [];
    const navigateTo = vi.fn((options: { complete(): void }) => {
      completions.push(options.complete);
    });
    vi.stubGlobal('wx', { navigateTo, showToast: vi.fn() });
    const owner = {};

    expect(openWebsitePageOnce(owner, 'alg', { failureMessage: '打开失败' })).toBe(true);
    vi.advanceTimersByTime(5_000);
    expect(openWebsitePageOnce(owner, 'wiki', { failureMessage: '打开失败' })).toBe(true);

    completions[0]?.();
    expect(openWebsitePageOnce(owner, 'timer', { failureMessage: '打开失败' })).toBe(false);

    completions[1]?.();
    expect(openWebsitePageOnce(owner, 'timer', { failureMessage: '打开失败' })).toBe(true);
    expect(navigateTo).toHaveBeenCalledTimes(3);
  });

  it('does not let a stale failure report against a newer navigation', () => {
    vi.useFakeTimers();
    const failures: Array<() => void> = [];
    const showToast = vi.fn();
    const navigateTo = vi.fn((options: { fail(): void }) => {
      failures.push(options.fail);
    });
    vi.stubGlobal('wx', { navigateTo, showToast });
    const owner = {};

    expect(openWebsitePageOnce(owner, 'alg', { failureMessage: '打开失败' })).toBe(true);
    vi.advanceTimersByTime(5_000);
    expect(openWebsitePageOnce(owner, 'wiki', { failureMessage: '打开失败' })).toBe(true);

    failures[0]?.();
    expect(showToast).not.toHaveBeenCalled();
    expect(openWebsitePageOnce(owner, 'timer', { failureMessage: '打开失败' })).toBe(false);

    failures[1]?.();
    expect(showToast).toHaveBeenCalledOnce();
    expect(openWebsitePageOnce(owner, 'timer', { failureMessage: '打开失败' })).toBe(true);
  });

  it('releases the lock and shows feedback when navigation fails', () => {
    const showToast = vi.fn();
    const navigateTo = vi.fn((options: { fail(): void }) => options.fail());
    vi.stubGlobal('wx', { navigateTo, showToast });
    const owner = {};

    expect(openWebsitePageOnce(owner, 'wiki', { failureMessage: '页面暂时无法打开' })).toBe(true);
    expect(openWebsitePageOnce(owner, 'wiki', { failureMessage: '页面暂时无法打开' })).toBe(true);
    expect(navigateTo).toHaveBeenCalledTimes(2);
    expect(showToast).toHaveBeenCalledTimes(2);
  });

  it('reports a synchronous navigation rejection to the caller', () => {
    const showToast = vi.fn();
    const navigateTo = vi.fn(() => {
      throw new Error('navigation unavailable');
    });
    vi.stubGlobal('wx', { navigateTo, showToast });
    const owner = {};

    expect(openWebsitePageOnce(owner, 'timer', { failureMessage: '打开失败' })).toBe(false);
    expect(openWebsitePageOnce(owner, 'timer', { failureMessage: '打开失败' })).toBe(false);
    expect(navigateTo).toHaveBeenCalledTimes(2);
    expect(showToast).toHaveBeenCalledTimes(2);
  });

  it('rejects a destination outside the shared route registry', () => {
    const navigateTo = vi.fn();
    const showToast = vi.fn();
    vi.stubGlobal('wx', { navigateTo, showToast });

    expect(openWebsitePageOnce({}, 'https://example.com', {
      failureMessage: '打开失败',
      invalidMessage: '该功能暂不可用',
    })).toBe(false);
    expect(navigateTo).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith({ icon: 'none', title: '该功能暂不可用' });
  });

  it('keeps navigation failures controlled when toast feedback is unavailable', () => {
    vi.stubGlobal('wx', {
      navigateTo() {
        throw new Error('navigation unavailable');
      },
      showToast() {
        throw new Error('toast unavailable');
      },
    });

    expect(() => openWebsitePageOnce({}, 'timer', { failureMessage: '打开失败' }))
      .not.toThrow();
  });
});

// @vitest-environment jsdom

import { readFileSync } from 'node:fs';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { timerScrambleClickEffect } from '@cuberoot/shared/timer';
import { TimerScrambleClickActionSetting, TimerScrambleStrip } from '@cuberoot/timer-ui';

describe('shared scramble click action setting', () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
  });

  it('renders the canonical bilingual options and emits the selected action', () => {
    const onChange = vi.fn();
    act(() => root.render(createElement(TimerScrambleClickActionSetting, {
      localize: (copy) => copy.en,
      onChange,
      value: 'copy',
    })));

    const row = host.querySelector('[data-setting-id="settings.appearance.scramble-click-action"]');
    const select = host.querySelector<HTMLSelectElement>('select');
    expect(row?.textContent).toContain('Scramble click action');
    expect(select?.getAttribute('aria-labelledby')).toBe(
      row?.querySelector('.settings-row-label')?.id,
    );
    expect([...select!.options].map((option) => [option.value, option.textContent])).toEqual([
      ['none', 'Nothing'],
      ['next', 'Next scramble'],
      ['copy', 'Copy to clipboard'],
    ]);
    expect(select?.value).toBe('copy');

    act(() => {
      select!.value = 'next';
      select!.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(onChange).toHaveBeenCalledWith('next');

    act(() => root.render(createElement(TimerScrambleClickActionSetting, {
      localize: (copy) => copy.zh,
      onChange,
      value: 'none',
    })));
    expect(row?.textContent).toContain('点击打乱条');
    expect([...select!.options].map((option) => option.textContent)).toEqual([
      '无操作', '换下一个', '复制到剪贴板',
    ]);
  });

  it('keeps Web runtime on the shared enablement rule and prioritizes retry', () => {
    const solo = readFileSync('app/[lang]/timer/_shell/SoloView.tsx', 'utf8');
    expect(timerScrambleClickEffect('next', false, false, true)).toBe('retry');
    expect(solo).toContain('timerScrambleClickEffect(');
    expect(solo).toMatch(/timerScrambleClickEffect\([\s\S]*?attemptCanStart,[\s\S]*?scrambleStatus\?\.retryable === true/);
    expect(solo).not.toContain("onActivate={scrambleClickEffect === 'retry'");
    expect(solo).not.toContain('className="scramble-empty-retry"');
  });

  it('does not expose an empty copy slot as a fake button', () => {
    const activate = vi.fn();
    const effect = timerScrambleClickEffect('copy', false, true, false);
    act(() => root.render(createElement(TimerScrambleStrip, {
      copiedLabel: 'Copied',
      fallback: '—',
      onActivate: effect === 'copy' ? activate : undefined,
      scramble: '',
      verificationLabels: {
        copiedCorrection: 'Copied the scramble',
        correction: 'Back to scramble',
        correctionTitle: 'Correction path',
        mismatch: 'Does not match',
        ready: 'Scrambled',
      },
    })));

    const strip = host.querySelector<HTMLElement>('.scramble-strip');
    expect(effect).toBe('none');
    expect(strip?.getAttribute('role')).toBeNull();
    expect(strip?.hasAttribute('tabindex')).toBe(false);
    act(() => strip?.click());
    expect(activate).not.toHaveBeenCalled();
  });
});

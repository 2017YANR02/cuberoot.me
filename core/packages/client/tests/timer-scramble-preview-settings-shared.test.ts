// @vitest-environment jsdom

import {
  TIMER_SCRAMBLE_PREVIEW_SETTING_FIELD_IDS,
  TimerScramblePreviewSettings,
} from '@cuberoot/timer-ui';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('shared scramble preview settings UI', () => {
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

  async function render(value: { showCubePreview: boolean; prefer3D: boolean }, onChange = vi.fn()) {
    await act(async () => root.render(createElement(TimerScramblePreviewSettings, {
      localize: (copy) => copy.en,
      onChange,
      renderBooleanControl: ({ disabled, label, onChange: change, settingId, value: checked }) => (
        createElement('button', {
          'aria-checked': checked,
          'aria-label': label,
          'data-control-id': settingId,
          disabled,
          onClick: () => change(!checked),
          role: 'switch',
          type: 'button',
        })
      ),
      value,
    })));
    return onChange;
  }

  it('renders the exact canonical fields and emits one-field patches', async () => {
    const onChange = await render({ showCubePreview: true, prefer3D: false });
    expect([...host.querySelectorAll<HTMLElement>('[data-setting-id]')]
      .map((row) => row.dataset.settingId)).toEqual(TIMER_SCRAMBLE_PREVIEW_SETTING_FIELD_IDS);
    expect(host.textContent).toContain('Scramble image');
    expect(host.textContent).toContain('3D cube');
    expect(host.textContent).toContain('Drag to rotate; off shows the 2D net');

    const threeD = host.querySelector<HTMLButtonElement>('[data-control-id="settings.appearance.cube-3d"]')!;
    await act(async () => threeD.click());
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith({ prefer3D: true });
  });

  it('disables 3D while hidden without resetting the stored preference', async () => {
    await render({ showCubePreview: false, prefer3D: true });
    let threeD = host.querySelector<HTMLButtonElement>('[data-control-id="settings.appearance.cube-3d"]')!;
    expect(threeD.disabled).toBe(true);
    expect(threeD.getAttribute('aria-checked')).toBe('true');

    await render({ showCubePreview: true, prefer3D: true });
    threeD = host.querySelector<HTMLButtonElement>('[data-control-id="settings.appearance.cube-3d"]')!;
    expect(threeD.disabled).toBe(false);
    expect(threeD.getAttribute('aria-checked')).toBe('true');
  });
});

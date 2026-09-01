// @vitest-environment jsdom

import {
  DEFAULT_TIMER_ATTEMPT_SPLIT_SETTINGS,
  type TimerAttemptSplitOptions,
  type TimerSettingCopy,
} from '@cuberoot/shared/timer';
import {
  TimerAttemptSplitSettings,
  TimerAttemptSplitStatus,
} from '@cuberoot/timer-ui';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const localize = (copy: TimerSettingCopy) => copy.en;

describe('shared timer attempt split UI', () => {
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

  it('gives touch and keyboard hosts the same stage and memo controls', async () => {
    const onMarkMemo = vi.fn();
    const onMarkStage = vi.fn();
    await act(async () => root.render(createElement(TimerAttemptSplitStatus, {
      bldMemoActive: true,
      localize,
      multiStageActive: true,
      onMarkMemo,
      onMarkStage,
      state: { stages: {} },
    })));

    const buttons = [...host.querySelectorAll<HTMLButtonElement>('.stage-chip-action')];
    expect(buttons.map((button) => button.textContent)).toEqual([
      'Cross', 'F2L', 'OLL', 'Memo… press Enter or tap',
    ]);
    buttons[0].click();
    buttons[3].click();
    expect(onMarkStage).toHaveBeenCalledWith('cross');
    expect(onMarkMemo).toHaveBeenCalledOnce();

    await act(async () => root.render(createElement(TimerAttemptSplitStatus, {
      bldMemoActive: true,
      localize,
      multiStageActive: true,
      onMarkMemo,
      onMarkStage,
      precision: 3,
      state: { memoMs: 1_234, stages: { cross: 500 } },
    })));
    expect(host.textContent).toContain('Cross 0.500');
    expect(host.textContent).toContain('Memo 1.234');
    expect(host.textContent).toContain('Executing…');
  });

  it('renders contract-owned settings rows and patches one key at a time', async () => {
    const onChange = vi.fn<(patch: Partial<TimerAttemptSplitOptions>) => void>();
    await act(async () => root.render(createElement(TimerAttemptSplitSettings, {
      bldVisible: true,
      localize,
      onChange,
      renderBooleanControl: ({ label, onChange: toggle, value }) => createElement('button', {
        'aria-label': label,
        'aria-pressed': value,
        onClick: () => toggle(!value),
        type: 'button',
      }),
      stageVisible: true,
      value: DEFAULT_TIMER_ATTEMPT_SPLIT_SETTINGS,
    })));

    expect([...host.querySelectorAll<HTMLElement>('[data-setting-id]')].map((row) => row.dataset.settingId))
      .toEqual(['settings.training.stage-splits', 'settings.training.bld-memo-split']);
    host.querySelector<HTMLButtonElement>('[aria-label="CFOP stage splits"]')!.click();
    expect(onChange).toHaveBeenCalledWith({ multiStage: true });
  });
});

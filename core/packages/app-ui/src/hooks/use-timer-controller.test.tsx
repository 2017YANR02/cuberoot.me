// @vitest-environment jsdom

import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  useTimerController,
  type TimerController,
} from './use-timer-controller';

function Probe({
  canStart,
  enabled,
  inspectionSec,
  onStart,
  smartCubeActive,
  trainingStartMode,
  canManualArmTraining,
  onController,
}: {
  canStart: boolean;
  enabled: boolean;
  inspectionSec: number;
  onStart?(startedAtMs: number): void;
  smartCubeActive?: () => boolean;
  trainingStartMode?: () => 'first-turn' | 'scrambled' | 'manual' | undefined;
  canManualArmTraining?: () => boolean;
  onController(controller: TimerController): void;
}) {
  const controller = useTimerController({
    canStart,
    enabled,
    holdMs: 10,
    inspectionSec,
    onComplete: () => undefined,
    onStart,
    smartCubeActive,
    trainingStartMode,
    canManualArmTraining,
  });
  useEffect(() => onController(controller), [controller, onController]);
  return null;
}

describe('mobile timer controller source invalidation', () => {
  let controller: TimerController;
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.useFakeTimers();
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    vi.useRealTimers();
  });

  const render = async (
    enabled: boolean,
    inspectionSec: number,
    canStart = true,
    onStart?: (startedAtMs: number) => void,
  ) => {
    await act(async () => {
      root.render(
        <Probe
          canStart={canStart}
          enabled={enabled}
          inspectionSec={inspectionSec}
          onStart={onStart}
          onController={(value) => { controller = value; }}
        />,
      );
    });
  };

  const press = async () => {
    await act(async () => {
      controller.pressDown();
    });
  };

  it('blocks manual presses without blocking the smart-cube attempt', async () => {
    await act(async () => root.render(<Probe canStart enabled inspectionSec={0}
      smartCubeActive={() => true} onController={value => { controller = value; }} />));
    await act(async () => {
      expect(controller.pressDown()).toBe(false);
      expect(controller.pressUp()).toBe(false);
      expect(controller.armFromCube()).toBe(true);
      expect(controller.startFromCube()).toBe(true);
    });
    expect(controller.machine.phase).toBe('running');
    await act(async () => {
      expect(controller.pressDown()).toBe(false);
      expect(controller.pressUp()).toBe(false);
    });
    expect(controller.machine.phase).toBe('running');
    await act(async () => { expect(controller.stopFromCube()).toBe(true); });
    expect(controller.machine.phase).toBe('stopped');
  });

  it.each(['first-turn', 'scrambled', 'manual'] as const)('uses shared %s training timing without WCA penalties', async mode => {
    await act(async () => root.render(<Probe canStart enabled inspectionSec={15}
      trainingStartMode={() => mode} canManualArmTraining={() => true}
      smartCubeActive={() => true} onController={value => { controller = value; }} />));
    await act(async () => {
      expect(mode === 'manual' ? controller.pressDown() : controller.armFromCube()).toBe(true);
    });
    expect(controller.machine.phase).toBe(mode === 'first-turn' ? 'ready' : 'inspecting');
    expect(controller.machine.trainingStartMode).toBe(mode);
    await act(async () => { await vi.advanceTimersByTimeAsync(20_000); });
    await act(async () => { expect(controller.startFromCube()).toBe(true); });
    expect(controller.machine.phase).toBe('running');
    expect(controller.machine.autoPenalty).toBe('ok');
    await act(async () => { expect(controller.pressDown()).toBe(false); });
    expect(controller.machine.phase).toBe('running');
  });

  const release = async () => {
    await act(async () => {
      controller.pressUp();
    });
  };

  it('forces holding and ready back to idle when the scramble slot becomes invalid', async () => {
    await render(true, 0);
    await press();
    expect(controller.machine.phase).toBe('holding');

    await render(false, 0);
    expect(controller.machine.phase).toBe('idle');
    await release();
    expect(controller.machine.phase).toBe('idle');

    await render(true, 0);
    await press();
    await act(async () => vi.advanceTimersByTime(10));
    expect(controller.machine.phase).toBe('ready');

    await render(false, 0);
    expect(controller.machine.phase).toBe('idle');
    await release();
    expect(controller.machine.phase).toBe('idle');
  });

  it('cancels an active inspection when the scramble slot becomes invalid', async () => {
    await render(true, 15);
    await press();
    expect(controller.machine.phase).toBe('inspecting');

    await render(false, 15);
    expect(controller.machine.phase).toBe('idle');
    expect(controller.machine.inspectionStartedAtMs).toBeNull();
    expect(controller.machine.inspectionSec).toBeNull();
    await release();
    expect(controller.machine.phase).toBe('idle');
  });

  it('ignores body Space while a host view, overlay or mutation disables timing', async () => {
    await render(false, 0);
    await press();
    await act(async () => vi.advanceTimersByTime(20));
    await release();
    expect(controller.machine.phase).toBe('idle');
    expect(controller.machine.lastMs).toBeNull();
  });

  it('blocks every pointer and smart-cube start while the scramble gate is closed', async () => {
    await render(true, 0, false);

    await press();
    await act(async () => vi.advanceTimersByTime(20));
    await release();

    expect(controller.machine.phase).toBe('idle');
    expect(controller.machine.lastMs).toBeNull();
    expect(controller.armFromCube()).toBe(false);
    expect(controller.startFromCube()).toBe(false);
  });

  it('keeps an already-running attempt stoppable when the next-slot gate closes', async () => {
    await render(true, 0);
    await press();
    await act(async () => vi.advanceTimersByTime(10));
    await release();
    expect(controller.machine.phase).toBe('running');

    await render(true, 0, false);
    expect(controller.machine.phase).toBe('running');

    await press();
    expect(controller.machine.phase).toBe('stopped');
    expect(controller.machine.lastMs).not.toBeNull();
  });

  it('cancels pointer loss without releasing ready into a run', async () => {
    await render(true, 15);
    await press();
    expect(controller.machine.phase).toBe('inspecting');
    const inspectionStartedAtMs = controller.machine.inspectionStartedAtMs;

    await press();
    await act(async () => vi.advanceTimersByTime(10));
    expect(controller.machine.phase).toBe('ready');

    await act(async () => { controller.cancelPress(); });
    expect(controller.machine.phase).toBe('inspecting');
    expect(controller.machine.inspectionStartedAtMs).toBe(inspectionStartedAtMs);
    expect(controller.machine.lastMs).toBeNull();
  });

  it('starts a synchronized room attempt with server-countdown lateness preserved', async () => {
    await render(true, 0);
    await act(async () => {
      expect(controller.startNow(750)).toBe(true);
    });
    expect(controller.machine.phase).toBe('running');

    await act(async () => vi.advanceTimersByTime(250));
    await press();
    expect(controller.machine.phase).toBe('stopped');
    expect(controller.machine.lastMs).toBe(1_000);
  });

  it('reports the machine-clamped smart-cube start clock to move recorders', async () => {
    const onStart = vi.fn();
    await render(true, 0, true, onStart);
    await act(async () => vi.advanceTimersByTime(10_000));
    await act(async () => {
      expect(controller.armFromCube()).toBe(true);
    });
    expect(controller.machine.phase).toBe('ready');

    await act(async () => {
      expect(controller.startFromCube(5_000)).toBe(true);
    });

    expect(onStart).toHaveBeenCalledWith(8_000);
  });
});

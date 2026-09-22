import {
  SOLVED_SMART_CUBE_FACELETS,
  SmartCubeStateTracker,
} from '@cuberoot/shared/smart-cube/cubie';
import { SmartCubeSessionController } from '@cuberoot/shared/smart-cube/session';
import { describe, expect, it, vi } from 'vitest';

function faceletsAfter(move: string): string {
  const tracker = new SmartCubeStateTracker();
  tracker.applyMove(move);
  return tracker.getFacelets();
}

describe('SmartCubeSessionController', () => {
  it('commits each move before notifying consumers and emits solved after the final move', () => {
    const order: string[] = [];
    let localNow = 1_000;
    let controller!: SmartCubeSessionController<{ futureHistory: boolean }>;
    controller = new SmartCubeSessionController({
      now: () => localNow,
      onMove: (event) => {
        expect(controller.getFacelets()).toBe(event.facelets);
        order.push(`move:${event.move}`);
      },
      onChange: (snapshot) => order.push(`change:${snapshot.lastMove ?? 'open'}`),
      onSolved: (timestamp) => order.push(`solved:${timestamp}`),
    });
    const session = controller.open();
    order.length = 0;

    const first = session.move('R', 10, { futureHistory: true });
    localNow = 1_005;
    const final = session.move("R'", 35, { futureHistory: false });

    expect(first).toMatchObject({
      facelets: faceletsAfter('R'),
      metadata: { futureHistory: true },
      timestamp: 1_000,
    });
    expect(final).toMatchObject({
      facelets: SOLVED_SMART_CUBE_FACELETS,
      metadata: { futureHistory: false },
      timestamp: 1_025,
    });
    expect(order).toEqual([
      'move:R',
      'change:R',
      "move:R'",
      "change:R'",
      'solved:1025',
    ]);
  });

  it('ignores every callback from a superseded connection lease', () => {
    const onMove = vi.fn();
    const controller = new SmartCubeSessionController({ onMove });
    const oldSession = controller.open();
    oldSession.move('R');
    const currentSession = controller.open();
    onMove.mockClear();

    expect(oldSession.isCurrent()).toBe(false);
    expect(oldSession.move('U')).toBeNull();
    expect(oldSession.adoptFacelets(faceletsAfter('F'))).toBe(false);
    expect(onMove).not.toHaveBeenCalled();
    expect(controller.getRawFacelets()).toBe(SOLVED_SMART_CUBE_FACELETS);
    expect(currentSession.isCurrent()).toBe(true);
  });

  it('publishes one solved edge when an authoritative state resync completes the cube', () => {
    const onSolved = vi.fn();
    const controller = new SmartCubeSessionController({ onSolved });
    const session = controller.open();

    expect(session.adoptFacelets(faceletsAfter('R'))).toBe(true);
    expect(session.adoptFacelets(SOLVED_SMART_CUBE_FACELETS, 321)).toBe(true);
    expect(session.adoptFacelets(SOLVED_SMART_CUBE_FACELETS, 654)).toBe(true);

    expect(onSolved).toHaveBeenCalledOnce();
    expect(onSolved).toHaveBeenCalledWith(321);
  });

  it('re-evaluates the raw state when a host changes its training projection', () => {
    let projectAsSolved = false;
    const onSolved = vi.fn();
    const controller = new SmartCubeSessionController({
      projectFacelets: (rawFacelets) => (
        projectAsSolved ? SOLVED_SMART_CUBE_FACELETS : rawFacelets
      ),
      onSolved,
    });
    const session = controller.open();
    session.move('R');
    expect(controller.getSnapshot().solved).toBe(false);

    projectAsSolved = true;
    expect(controller.republish(777)).toBe(true);

    expect(controller.getRawFacelets()).toBe(faceletsAfter('R'));
    expect(controller.getFacelets()).toBe(SOLVED_SMART_CUBE_FACELETS);
    expect(onSolved).toHaveBeenCalledExactlyOnceWith(777);
  });

  it('resets the software model without manufacturing a solve completion', () => {
    const onSolved = vi.fn();
    const controller = new SmartCubeSessionController({ onSolved });
    const session = controller.open();
    session.move('R');

    expect(controller.resetState()).toBe(true);
    expect(controller.getSnapshot()).toMatchObject({
      active: true,
      rawFacelets: SOLVED_SMART_CUBE_FACELETS,
      solved: true,
    });
    expect(onSolved).not.toHaveBeenCalled();
  });
});

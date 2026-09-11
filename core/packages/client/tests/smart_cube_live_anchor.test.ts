import { describe, expect, it, vi } from 'vitest';
import { cubeMove, SOLVED_3X3 } from '@cuberoot/puzzle-solvers/timer-333-cube';
import { LiveSmartCubeAnchor } from '@cuberoot/shared/smart-cube/anchor';

const stateAfter = (...moves: string[]) => moves.reduce(cubeMove, SOLVED_3X3);
function deferred() {
  let resolve!: (alg: string) => void;
  const promise = new Promise<string>((done) => { resolve = done; });
  return { promise, resolve };
}
const flush = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); };

describe('shared live smart-cube anchor', () => {
  it('keeps a pending opening across subsequent move renders without duplicating the target', async () => {
    const pending = deferred();
    const solve = vi.fn(() => pending.promise);
    const anchor = new LiveSmartCubeAnchor({ solve, onChange: vi.fn() });
    anchor.setConnection('cube');
    anchor.observeFacelets(stateAfter('R'));
    anchor.move('U');
    anchor.observeFacelets(stateAfter('R', 'U'));
    anchor.move('F');
    anchor.observeFacelets(stateAfter('R', 'U', 'F'));
    expect(solve).toHaveBeenCalledOnce();
    pending.resolve('R');
    await flush();
    expect(anchor.getSnapshot()).toEqual({ moves: ['R', 'U', 'F'], algAnchored: true });
    expect(stateAfter(...anchor.getSnapshot().moves)).toBe(stateAfter('R', 'U', 'F'));
  });

  it('ignores a late answer after disconnect, and the same device can anchor on reconnect', async () => {
    const old = deferred(); const next = deferred();
    const solve = vi.fn().mockReturnValueOnce(old.promise).mockReturnValueOnce(next.promise);
    const anchor = new LiveSmartCubeAnchor({ solve, onChange: vi.fn() });
    anchor.setConnection('cube'); anchor.observeFacelets(stateAfter('R'));
    anchor.setConnection(null);
    old.resolve('R'); await flush();
    expect(anchor.getSnapshot()).toEqual({ moves: [], algAnchored: false });
    anchor.setConnection('cube'); anchor.observeFacelets(stateAfter('F'));
    next.resolve('F'); await flush();
    expect(anchor.getSnapshot()).toEqual({ moves: ['F'], algAnchored: true });
  });

  it('invalidates a pending opening on an authoritative state jump and rejects reordered responses', async () => {
    const old = deferred(); const next = deferred();
    const solve = vi.fn().mockReturnValueOnce(old.promise).mockReturnValueOnce(next.promise);
    const anchor = new LiveSmartCubeAnchor({ solve, onChange: vi.fn() });
    anchor.setConnection('cube'); anchor.observeFacelets(stateAfter('R'));
    anchor.move('U');
    anchor.observeFacelets(stateAfter('L'));
    anchor.move('B'); anchor.observeFacelets(stateAfter('L', 'B'));
    next.resolve('L'); await flush();
    old.resolve('R'); await flush();
    expect(anchor.getSnapshot()).toEqual({ moves: ['L', 'B'], algAnchored: true });
  });

  it('reanchors an already displayed cube after state resync rather than double applying old moves', async () => {
    const solve = vi.fn().mockResolvedValueOnce('R').mockResolvedValueOnce('L');
    const anchor = new LiveSmartCubeAnchor({ solve, onChange: vi.fn() });
    anchor.setConnection('cube'); anchor.observeFacelets(stateAfter('R')); await flush();
    anchor.move('U'); anchor.observeFacelets(stateAfter('R', 'U'));
    anchor.observeFacelets(stateAfter('L')); await flush();
    expect(anchor.getSnapshot()).toEqual({ moves: ['L'], algAnchored: true });
  });

  it('a physically solved state cancels the pending opening and anchors following turns at solved', async () => {
    const pending = deferred();
    const anchor = new LiveSmartCubeAnchor({ solve: () => pending.promise, onChange: vi.fn() });
    anchor.setConnection('cube'); anchor.observeFacelets(stateAfter('R'));
    anchor.move("R'"); anchor.observeFacelets(SOLVED_3X3);
    anchor.move('U'); anchor.observeFacelets(stateAfter('U'));
    pending.resolve('R'); await flush();
    expect(anchor.getSnapshot()).toEqual({ moves: ['U'], algAnchored: true });
  });

  it('rejects incorrect worker answers and invalid states; reconnect remains retryable', async () => {
    const solve = vi.fn().mockResolvedValue('L');
    const anchor = new LiveSmartCubeAnchor({ solve, onChange: vi.fn() });
    anchor.setConnection('cube'); anchor.observeFacelets('U'.repeat(54));
    expect(solve).not.toHaveBeenCalled();
    anchor.observeFacelets(stateAfter('R')); await flush();
    expect(anchor.getSnapshot().algAnchored).toBe(false);
    anchor.setConnection(null); anchor.setConnection('cube');
    anchor.observeFacelets(stateAfter('L')); await flush();
    expect(anchor.getSnapshot()).toEqual({ moves: ['L'], algAnchored: true });
  });
});

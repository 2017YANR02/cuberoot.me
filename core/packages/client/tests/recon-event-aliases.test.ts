import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useReconStore } from '@/lib/recon-store';
import { getCubedbPuzzle, getPuzzleId } from '@/lib/recon-utils';
import ReconEnginePlayer from '@/components/recon/ReconEnginePlayer';
import CuberReconPlayer from '@/components/CuberReconPlayer';
import Sq1ReconPlayer from '@/components/Sq1ReconPlayer';
import TweenReconPlayer from '@/components/recon/TweenReconPlayer';

vi.mock('@/lib/recon-api', () => ({ listRecons: vi.fn() }));
vi.mock('@/components/CuberReconPlayer', () => ({ default: vi.fn() }));
vi.mock('@/components/Sq1ReconPlayer', () => ({ default: vi.fn() }));
vi.mock('@/components/recon/TweenReconPlayer', () => ({ default: vi.fn() }));
vi.mock('@/components/recon/FtoReconPlayer', () => ({ default: vi.fn() }));
vi.mock('@/components/TwistySection', () => ({ default: vi.fn() }));

const aliases = [
  ['oh', 'OH', '333oh'],
  ['pyra', 'Pyraminx', 'pyram'],
  ['skewb', 'Skewb', 'sk'],
  ['sq1', 'SQ1', 'Square-1'],
  ['3bld', '3BLD', '333bf'],
];

beforeEach(() => {
  useReconStore.setState(useReconStore.getInitialState(), true);
});

describe('recon event aliases', () => {
  it('merges filter options and includes every spelling, including old cached records', () => {
    const events = aliases.flat();
    useReconStore.setState({ allSolves: events.map((event, id) => ({ id, event, official: 'wca' })) });
    expect(useReconStore.getState().getAvailableEvents()).toEqual(['3bld', 'oh', 'pyra', 'skewb', 'sq1']);
    for (const group of aliases) {
      for (const filter of group) {
        useReconStore.getState().setFilter('event', filter);
        expect(useReconStore.getState().getFilteredSolves().map(s => s.event).sort()).toEqual([...group].sort());
      }
    }
  });

  it.each([
    ['OH', '3x3x3', '3x3x3'],
    ['Pyraminx', 'pyraminx', 'pyraminx'],
    ['Skewb', 'skewb', 'skewb'],
    ['SQ1', 'square1', 'sq1'],
    ['444', '4x4x4', '4x4x4'],
  ])('maps %s to the same internal and external puzzle', (event, puzzle, cubedb) => {
    expect(getPuzzleId(event)).toBe(puzzle);
    expect(getCubedbPuzzle(event)).toBe(cubedb);
  });
});

describe('recon engine dispatch', () => {
  it.each([
    ['SQ1', Sq1ReconPlayer, undefined],
    ['Square-1', Sq1ReconPlayer, undefined],
    ['Skewb', TweenReconPlayer, 'skewb'],
    ['Pyraminx', TweenReconPlayer, 'pyraminx'],
    ['Gear', TweenReconPlayer, 'gear'],
  ])('uses the corresponding engine for %s', (event, component, puzzleKind) => {
    const player = ReconEnginePlayer({ event, scramble: '', solution: 'R U' });
    expect(player.type).toBe(component);
    if (puzzleKind) expect(player.props.puzzleKind).toBe(puzzleKind);
    if (event === 'Gear') {
      expect(player.props.parseMoves("R3 U6 F2'")).toHaveLength(3);
    }
  });

  it.each([['Mirror', 3], ['mirror2', 2]] as const)('uses mirror geometry for %s', (event, order) => {
    const player = ReconEnginePlayer({ event, scramble: '', solution: 'R U' });
    expect(player.type).toBe(CuberReconPlayer);
    expect(player.props.mirror).toBe(true);
    expect(player.props.order).toBe(order);
  });

  it('keeps ordinary cubes on ordinary geometry', () => {
    const player = ReconEnginePlayer({ event: 'OH', scramble: '', solution: 'R U' });
    expect(player.type).toBe(CuberReconPlayer);
    expect(player.props.mirror).toBe(false);
    expect(player.props.order).toBe(3);
  });
});

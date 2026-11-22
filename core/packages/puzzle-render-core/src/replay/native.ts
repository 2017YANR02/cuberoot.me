import { parseSq1Algorithm } from '@cuberoot/shared/sq1-notation';
import { parseSkewbAlgorithm } from '@cuberoot/shared/skewb-notation';
import { parsePyraAlgorithm } from '@cuberoot/shared/pyra-notation';
import { parseIvyStandardMoves } from '@cuberoot/puzzle-solvers/ivy';
import { duoMoveToString, parseDuoMoves } from '@cuberoot/puzzle-solvers/pyraminx-duo';
import {
  applyMagicMove, magicMoveToString, magicRoutePosition, magicStateFromMoves, parseMagicMoves, type MagicPuzzle,
} from '@cuberoot/puzzle-solvers/magic';
import { SIZE } from '../engine/define';
import { homeSceneRot } from '../engine/viewControls';
import Sq1Cube from '../engine/sq1/Sq1Cube';
import { applySq1Move, isSlashValid, moveToString as sq1MoveToString, solvedSq1, type Sq1Move } from '../engine/sq1/sq1State';
import SquareFamilyCube from '../engine/squareFamily/SquareFamilyCube';
import { SQUARE_FAMILY_SPECS, squareFamilyMoveToString, tryParseSquareFamilyMoves, type SquareFamilyKind } from '../engine/squareFamily/squareFamilyState';
import IvyCube from '../engine/ivy/IvyCube';
import DinoCube from '../engine/dino/DinoCube';
import { dinoMoveToString, parseDinoMoves } from '../engine/dino/dinoState';
import RediCube from '../engine/redi/RediCube';
import { parseRediMoves, rediMoveToString } from '../engine/redi/rediState';
import RexCube from '../engine/rex/RexCube';
import { parseRexMoves, rexMoveToString } from '../engine/rex/rexState';
import HeliCube from '../engine/heli/HeliCube';
import { heliMoveToString, parseHeliMoves } from '../engine/heli/heliState';
import GearCube from '../engine/gear/GearCube';
import { gearMoveToString, parseGearMoves } from '../engine/gear/gearState';
import GhostCube from '../engine/ghost/GhostCube';
import { applyGhostMove, ghostMoveToString, parseGhostMoves, solvedGhostPose } from '../engine/ghost/ghostState';
import SkewbCube from '../engine/skewb/SkewbCube';
import { skewbMoveToString } from '../engine/skewb/skewbState';
import PyraCube from '../engine/pyra/PyraCube';
import { pyraMoveToString } from '../engine/pyra/pyraState';
import DuoCube from '../engine/duo/DuoCube';
import MegaminxCube from '../engine/mega/MegaminxCube';
import { megaMoveToString, parseMegaMoves } from '../engine/mega/megaState';
import FtoCube from '../engine/fto/FtoCube';
import { parseFtoEifMoveGroups } from '../engine/fto/ftoEifMoves';
import MagicCube from '../engine/magic/MagicCube';
import { mountReplayScene } from './mountReplayScene';
import { mountReplayClock, parseClockReplayTokens } from './nativeClock';
import { mountNativeReplayModel, type NativeReplay, type ReplayModel, type ReplayModelOptions, type ReplayMoveGroup } from './nativePlayback';

export type { NativeReplay } from './nativePlayback';

interface NativeReplaySpec {
  parse(text: string): string[];
  mount(host: HTMLElement, interactive: boolean): NativeReplay;
}

function singletonGroups<Move>(moves: readonly Move[], format: (move: Move) => string): ReplayMoveGroup<Move>[] {
  return moves.map(move => ({ token: format(move), moves: [move] }));
}

/** Some simulator text fields skip unknown words for live editing. Standalone
 * playback instead rejects malformed algorithms before replacing the current one. */
function strictTokens<Move>(parse: (text: string) => readonly Move[], format: (move: Move) => string) {
  return (text: string): ReplayMoveGroup<Move>[] => text.trim().split(/\s+/).filter(Boolean).flatMap(token => {
    const moves = parse(token);
    if (!moves.length) throw new SyntaxError(`Invalid move ${token}`);
    return singletonGroups(moves, format);
  });
}

function modelSpec<Move, Model extends ReplayModel<Move>>(
  create: () => Model,
  options: ReplayModelOptions<Move, Model>,
): NativeReplaySpec {
  return {
    parse: text => options.parse(text).map(group => group.token),
    mount: (host, interactive) => mountNativeReplayModel(host, create(), interactive, options),
  };
}

function sq1Groups(text: string): ReplayMoveGroup<Sq1Move>[] {
  const { tokens, invalid } = parseSq1Algorithm(text);
  if (invalid.length) throw new SyntaxError(`Invalid Square-1 notation: ${invalid.join(' ')}`);
  for (const move of tokens) {
    if (move.kind === 'turn' && (!Number.isSafeInteger(move.top) || !Number.isSafeInteger(move.bot))) {
      throw new RangeError('Square-1 turn values must be safe integers');
    }
  }
  const moves = tokens.map(move => move.kind === 'turn'
    ? { ...move, top: move.top % 12, bot: move.bot % 12 }
    : move);
  return singletonGroups(moves, sq1MoveToString);
}

function squareSpec(kind: SquareFamilyKind): NativeReplaySpec {
  return modelSpec(() => new SquareFamilyCube(kind), {
    parse: text => {
      const moves = tryParseSquareFamilyMoves(text, SQUARE_FAMILY_SPECS[kind]);
      if (!moves) throw new SyntaxError(`Invalid ${kind.toUpperCase()} notation`);
      return singletonGroups(moves, squareFamilyMoveToString);
    },
    beginMove: (cube, move) => cube.beginMove(move, move.kind === 'slice' && cube.state.sliceSolved ? -1 : 1),
    framingSize: SIZE * 4.6,
  });
}

function magicSpec(kind: MagicPuzzle): NativeReplaySpec {
  return {
    parse: text => parseMagicMoves(text, kind).map(magicMoveToString),
    mount(host, interactive) {
      const cube = new MagicCube(kind);
      let scene: ReturnType<typeof mountReplayScene>;
      try {
        scene = mountReplayScene(host, cube, { interactive, framingSize: SIZE * (kind === 'magic' ? 3.25 : 4.25), wrapLights: true });
      } catch (error) {
        cube.dispose();
        throw error;
      }

      let disposed = false;
      function replayState(steps: readonly string[]) {
        return magicStateFromMoves(kind, steps.filter(step => step !== '.').join(' '));
      }
      return {
        validate(steps) { replayState(steps); },
        setup(steps) {
          if (disposed) return;
          cube.setState(replayState(steps));
          scene.invalidate();
        },
        animate(token, fraction) {
          if (disposed || token === '.' || !Number.isFinite(fraction)) return;
          const [move] = parseMagicMoves(token, kind);
          const next = applyMagicMove(cube.state, move, kind);
          const from = magicRoutePosition(kind, cube.state);
          const to = magicRoutePosition(kind, next);
          // A route marker is a setup state, not a fold between two tile positions.
          if (move.kind === 'fold') cube.renderPosition(from + (to - from) * Math.max(0, Math.min(1, fraction)));
          scene.invalidate();
        },
        commit(token) {
          if (disposed || token === '.') return;
          const [move] = parseMagicMoves(token, kind);
          cube.applyMoveSilent(move);
          scene.invalidate();
        },
        dispose() {
          if (disposed) return;
          disposed = true;
          scene.dispose();
          cube.dispose();
        },
      };
    },
  };
}

const NATIVE_REPLAY_SPECS = {
  sq1: modelSpec(() => new Sq1Cube(), {
    parse: sq1Groups,
    validateMoves(moves) {
      let state = solvedSq1();
      for (const move of moves) {
        if (move.kind === 'slice' && !isSlashValid(state)) throw new SyntaxError('Square-1 layers are not aligned for /');
        state = applySq1Move(state, move);
      }
    },
    beginMove: (cube, move) => cube.beginMove(move, move.kind === 'slice' && cube.state.sliceSolved ? -1 : 1),
    framingSize: SIZE * 4.6,
  }),
  sq2: squareSpec('sq2'),
  sq4: squareSpec('sq4'),
  ivy: modelSpec(() => new IvyCube(), {
    parse: text => singletonGroups(parseIvyStandardMoves(text), move => move.name),
  }),
  dino: modelSpec(() => new DinoCube(), { parse: strictTokens(parseDinoMoves, dinoMoveToString), framingSize: SIZE * 4 }),
  redi: modelSpec(() => new RediCube(), { parse: strictTokens(parseRediMoves, rediMoveToString), framingSize: SIZE * 4 }),
  rex: modelSpec(() => new RexCube(), { parse: strictTokens(parseRexMoves, rexMoveToString), framingSize: SIZE * 4 }),
  heli: modelSpec(() => new HeliCube(), { parse: strictTokens(parseHeliMoves, heliMoveToString), framingSize: SIZE * 4 }),
  gear: modelSpec(() => new GearCube(), { parse: strictTokens(parseGearMoves, gearMoveToString), framingSize: SIZE * 4 }),
  ghost: modelSpec(() => new GhostCube(), {
    parse: text => singletonGroups(parseGhostMoves(text), ghostMoveToString),
    validateMoves(moves) {
      const pose = solvedGhostPose();
      for (const move of moves) applyGhostMove(pose, move);
    },
    framingSize: SIZE * 4,
  }),
  skewb: modelSpec(() => new SkewbCube(), {
    parse(text) {
      const { moves, invalid } = parseSkewbAlgorithm(text);
      if (invalid.length) throw new SyntaxError(`Invalid Skewb notation: ${invalid.join(' ')}`);
      return singletonGroups(moves, skewbMoveToString);
    },
    framingSize: SIZE * 4,
  }),
  pyraminx: modelSpec(() => new PyraCube(), {
    parse(text) {
      const { moves, invalid } = parsePyraAlgorithm(text);
      if (invalid.length) throw new SyntaxError(`Invalid Pyraminx notation: ${invalid.join(' ')}`);
      return singletonGroups(moves, pyraMoveToString);
    },
  }),
  pyraminx_duo: modelSpec(() => new DuoCube(), {
    parse: text => singletonGroups(parseDuoMoves(text), duoMoveToString),
  }),
  megaminx: modelSpec(() => new MegaminxCube(), {
    parse: strictTokens(parseMegaMoves, megaMoveToString), framingSize: SIZE * 4, sceneRotation: homeSceneRot('megaminx'),
  }),
  fto: modelSpec(() => new FtoCube(), {
    parse(text) {
      const { tokens, groups, invalid } = parseFtoEifMoveGroups(text);
      if (invalid.length) throw new SyntaxError(`Invalid FTO notation: ${invalid.join(' ')}`);
      return tokens.map((token, index) => ({ token, moves: groups[index] }));
    },
    framingSize: SIZE * 4,
  }),
  clock: { parse: parseClockReplayTokens, mount: mountReplayClock },
  magic: magicSpec('magic'),
  mmagic: magicSpec('mmagic'),
} satisfies Record<string, NativeReplaySpec>;

export type NativeReplayPuzzle = keyof typeof NATIVE_REPLAY_SPECS;

export function isNativeReplayPuzzle(value: string): value is NativeReplayPuzzle {
  return Object.hasOwn(NATIVE_REPLAY_SPECS, value);
}

export function parseNativeReplay(puzzle: NativeReplayPuzzle, input: string): string[] {
  if (typeof input !== 'string') throw new TypeError('Expected an algorithm string');
  if (input.length > 32_768) throw new RangeError('Algorithm text is too long');
  const normalized = input.replace(/\/\/[^\n]*/g, ' ').replace(/[‘’′]/g, "'");
  const steps = normalized.split(/(\.)/).flatMap(part => part === '.' ? ['.'] : NATIVE_REPLAY_SPECS[puzzle].parse(part));
  if (steps.length > 10_000) throw new RangeError('Too many replay steps');
  return steps;
}

export function mountNativeReplay(host: HTMLElement, puzzle: NativeReplayPuzzle, interactive = true): NativeReplay {
  return NATIVE_REPLAY_SPECS[puzzle].mount(host, interactive);
}

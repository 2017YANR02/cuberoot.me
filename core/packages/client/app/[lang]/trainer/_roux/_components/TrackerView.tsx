'use client';

// Faithful de-MUI port of roux-trainers/src/components/TrackerView.tsx (the
// beta tracking trainer). All challenge-generation logic, state shape, handlers
// and CubeSim usage are preserved verbatim. Only the MUI presentation
// (Box/Paper/Grid/Typography/Button/FormControl/Select/MenuItem/TextField) is
// swapped for plain HTML + ./TrackerView.css using site tokens. The `theme` prop
// to CubeSim now comes from useEffectiveTheme() (the in-app theme name was
// dropped repo-wide). The unused `simBackground` value (upstream computed it but
// never passed it to CubeSim) is omitted.

import React from 'react';

import CubeSim from './CubeSim';
import { CubeUtil, CubieCube, FaceletCube, Mask, MoveSeq } from '@/lib/roux/CubeLib';
import { AppState, Action } from '@/lib/roux/Types';
import { Face } from '@/lib/roux/Defs';
import { rand_choice, rand_int, rand_shuffle } from '@/lib/roux/Math';
import { CachedSolver } from '@/lib/roux/CachedSolver';
import { SolverT } from '@/lib/roux/Solver';
import { useEffectiveTheme } from '@/lib/theme';

import './TrackerView.css';

type TrackerChallenge = {
  cubeBefore: CubieCube;
  moves: string;
  progress: number;
  mask: Mask;
};

type TrackerState = {
  mode: string;
  moveSet: string;
  moveCount: number;
  display: string;
  result: TrackerChallenge | null;
};

const initialState: TrackerState = {
  mode: 'fb,ss',
  moveSet: 'UDFBrRM',
  moveCount: 5,
  display: 'hidden',
  result: null,
};

const axis: { [key: string]: number } = {
  X: 0,
  R: 1,
  r: 1,
  l: 1,
  L: 1,
  M: 1,
  U: 2,
  D: 2,
  u: 2,
  d: 2,
  E: 2,
  F: 3,
  B: 3,
  f: 3,
  b: 3,
  S: 3,
};

function generateMoves(cube: CubieCube, solver: SolverT, moveSet: string, moveCount: number) {
  let candidate = moveSet
    .split('')
    .map((x) => [x, x + '2', x + "'"])
    .flat();
  let moves = '';
  let prev = 'X';
  let prevprev = 'X';
  let prevSolution = ' ';

  for (let i = 0; i < moveCount; i++) {
    let c = [...candidate];
    rand_shuffle(c);
    while (c.length > 0) {
      let next = c[c.length - 1];
      if (
        next[0] === prev ||
        (axis[next[0]] === axis[prev] && axis[prev] === axis[prevprev])
      ) {
        c.pop();
        continue;
      }
      let moveSeq = solver.solve(cube.apply(next), 0, i + 1, 1)[0];
      if (!!moveSeq && moveSeq.toString() !== prevSolution) {
        cube = cube.apply(next);
        moves = moves + next;

        prevSolution = moveSeq.toString();
        prevprev = prev;
        prev = next[0];
        break;
      }
      c.pop();
    }
    if (c.length === 0) {
      // unsuccessful
      return new MoveSeq('');
    }
    //if (new MoveSeq(prevSolution).moves.length === moveCount) break;
  }
  return new MoveSeq(moves);
}

function generateChallengeForFB(state: TrackerState): TrackerChallenge {
  let solver = CachedSolver.get('fb');
  let cubeAfter = CubeUtil.get_random_with_mask(Mask.fb_mask);
  let moves = generateMoves(cubeAfter, solver, state.moveSet, state.moveCount);
  //solver.solve(cubeBefore, state.moveCount, state.moveCount, 1)[0]
  let mask = Mask.copy(Mask.empty_mask); // empty_mask) // fbdr_mask)
  if (state.mode === 'fb,sp' || state.mode === 'fb,ss') {
    if (rand_int(2) === 0) {
      mask.ep[11] = 1;
      mask.cp[7] = 1;
    } else {
      mask.ep[10] = 1;
      mask.cp[6] = 1;
    }
  }
  if (state.mode === 'fb,dr' || state.mode === 'fb,ss') {
    mask.ep[7] = 1;
  }
  return {
    cubeBefore: cubeAfter.apply(moves),
    mask,
    moves: moves.inv().toString(),
    progress: 0,
  };
}

function generateChallengeForFS(state: TrackerState): TrackerChallenge {
  let mode = rand_choice(['fs-front', 'fs-back']);
  let solver = CachedSolver.get(mode);
  let cubeAfter = CubeUtil.get_random_with_mask(
    mode === 'fs-back' ? Mask.fs_back_mask : Mask.fs_front_mask,
  );
  let moves = generateMoves(cubeAfter, solver, state.moveSet, state.moveCount);
  //solver.solve(cubeBefore, state.moveCount, state.moveCount, 1)[0]
  let mask = Mask.copy(Mask.empty_mask); // empty_mask) // fbdr_mask)
  if (mode === 'fs-back') {
    mask.ep[8] = 1;
    mask.cp[4] = 1;
  } else {
    mask.ep[9] = 1;
    mask.cp[5] = 1;
  }
  if (state.mode === 'fs,lp+dr') {
    mask.ep[7] = 1;
  }
  return {
    cubeBefore: cubeAfter.apply(moves),
    mask,
    moves: moves.inv().toString(),
    progress: 0,
  };
}

function generateChallenge(state: TrackerState) {
  if (state.mode.slice(0, 3) === 'fb,') {
    return generateChallengeForFB(state);
  } else return generateChallengeForFS(state);
}

function getInitialState() {
  let result = generateChallenge(initialState);
  return { ...initialState, result };
}

function TrackerView(props: { state: AppState; dispatch: React.Dispatch<Action> }) {
  let { state: globalState } = props;
  const cubeTheme = useEffectiveTheme() === 'dark' ? 'dark' : 'bright';

  let [state, setState] = React.useState(getInitialState);

  let { cubeBefore, mask, moves, progress } = state.result!;
  let cube1 = FaceletCube.from_cubie(
    cubeBefore.apply(new MoveSeq(moves).toQuarter().slice(progress)),
    mask,
  );

  let cube2 = FaceletCube.from_cubie(cubeBefore.apply(moves), mask);

  let handleClick = () => {
    if (state.display === 'hidden') {
      setState({ ...state, display: 'revealed' });
    } else {
      let result = generateChallenge(state);
      setState({ ...state, result, display: 'hidden' });
    }
  };

  let handleProgress = (func: (x: number) => number) => () => {
    setState((state) => ({
      ...state,
      result: { ...state.result!, progress: func(state.result!.progress) },
    }));
  };

  let [moveSetText, setMoveSetText] = React.useState(state.moveSet);
  let onMoveSetEdit = (event: React.ChangeEvent<HTMLInputElement>) => {
    setMoveSetText(event?.target.value);
    onMoveSetCommit();
  };
  let onMoveSetCommit = () => {
    setState({ ...state, moveSet: moveSetText });
  };

  let handleMode = (event: React.ChangeEvent<HTMLSelectElement>) => {
    let value = event.target.value;
    setState({ ...state, mode: value });
  };
  let handleMoveCount = (event: React.ChangeEvent<HTMLSelectElement>) => {
    let value = Number.parseInt(event.target.value) || 5;
    setState({ ...state, moveCount: value });
  };

  return (
    <div className="roux-tracker">
      <div className="roux-tracker-panel">
        <div className="roux-tracker-scramble-row">
          <div className="roux-tracker-section-title">Scramble</div>
          <div className="roux-tracker-fgap" />
          <p className="roux-tracker-scramble">{moves}</p>
        </div>
      </div>

      <div className="roux-tracker-panel">
        <div className="roux-tracker-controls">
          <label className="roux-tracker-field">
            <span className="roux-field-label">Mode</span>
            <select className="roux-tracker-select" value={state.mode} onChange={handleMode}>
              <option value="fs,lp">Watch FS, Track Last Pair</option>
              <option value="fs,lp+dr">Watch FS, Track Last Pair + DR</option>
              <option value="fb,dr">Watch FB, Track DR</option>
              <option value="fb,sp">Watch FB, Track SB Pair</option>
              <option value="fb,ss">Watch FB, Track DR + SB Pair</option>
              <option value="cross,pair">
                Watch Cross, Track F2L Pair (will not be implemented, of course)
              </option>
            </select>
          </label>

          <label className="roux-tracker-field">
            <span className="roux-field-label">MoveCount</span>
            <select
              className="roux-tracker-select"
              value={state.moveCount}
              onChange={handleMoveCount}
            >
              <option value="3">3</option>
              <option value="4">4</option>
              <option value="5">5</option>
              <option value="6">6</option>
              <option value="7">7</option>
              <option value="8">8</option>
            </select>
          </label>

          <label className="roux-tracker-field">
            <span className="roux-field-label">MoveGroup</span>
            <input
              className="roux-tracker-input"
              value={moveSetText}
              onChange={onMoveSetEdit}
            />
          </label>
        </div>
      </div>

      <div className="roux-tracker-panel roux-tracker-panel-center">
        <div className="roux-tracker-nav">
          <button type="button" className="roux-btn roux-btn-text" onClick={handleProgress(() => 0)}>
            {'|<<'}
          </button>
          <button
            type="button"
            className="roux-btn roux-btn-text"
            onClick={handleProgress((x) => x - 1)}
          >
            {'<<'}
          </button>
          <button
            type="button"
            className="roux-btn roux-btn-text"
            onClick={handleProgress((x) => x + 1)}
          >
            {'>>'}
          </button>
          <button
            type="button"
            className="roux-btn roux-btn-text"
            onClick={handleProgress((x) => x + 1)}
          >
            {'>>|'}
          </button>
        </div>
        <button type="button" className="roux-btn roux-btn-outline" onClick={handleClick}>
          {state.display === 'hidden' ? 'Reveal' : 'Next'}
        </button>
      </div>

      <div className="roux-tracker-panel">
        <div className="roux-tracker-cubes">
          <div className="roux-tracker-cube">
            <CubeSim
              width={250}
              height={250}
              cube={cube1}
              colorScheme={globalState.colorScheme.getColorsForOri(globalState.cube.ori)}
              hintDistance={5}
              theme={cubeTheme}
              facesToReveal={[Face.L, Face.B, Face.D]}
            />
          </div>
          <div className="roux-tracker-cube">
            <CubeSim
              width={250}
              height={250}
              cube={
                state.display === 'revealed'
                  ? cube2
                  : FaceletCube.from_cubie(new CubieCube(), Mask.empty_mask)
              }
              colorScheme={globalState.colorScheme.getColorsForOri(globalState.cube.ori)}
              hintDistance={5}
              theme={cubeTheme}
              facesToReveal={[Face.L, Face.B, Face.D]}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default TrackerView;

'use client';

// Faithful de-MUI port of roux-trainers/src/components/AnalyzerView.tsx.
// ALL logic, state reads, dispatch flow, quiz/spoiler behavior, and the analyzer
// execution preserved. ONLY the MUI presentation is swapped for plain HTML + CSS
// using site tokens. The off-thread comlink worker (upstream src/worker + the
// useAnalyzer hook in src/lib/Hooks) is reimplemented inline below, with a
// guaranteed main-thread fallback if the worker can't be created/run.
//
// clsx is not installed: class composition uses template strings / filter+join.

import React from 'react';
import { Edit, Search } from 'lucide-react';
import { wrap, releaseProxy, type Remote } from 'comlink';

import CubeSim from './CubeSim';
import { CubeUtil, CubieCube, FaceletCube, Mask, MoveSeq, ColorScheme } from '@/lib/roux/CubeLib';
import { CachedSolver } from '@/lib/roux/CachedSolver';
import { Face } from '@/lib/roux/Defs';
import { AppState, Action } from '@/lib/roux/Types';
import {
  AnalyzerState,
  SolutionDesc,
  initialState,
  analyze_roux_solve,
  analyze as analyzeMain,
  fbStageT,
} from '@/lib/roux/Analyzer';
import { get_shortened_rotation, get_orientation_fb_colors } from '@/lib/roux/RotationHelp';
import { useIsMobile } from '@/hooks/useIsMobile';
import { useEffectiveTheme } from '@/lib/theme';

import { Modal, FieldLabel } from './ui';
import type { AnalyzerWorker } from './analyzer.worker';
import './AnalyzerView.css';

const resetState = (state: AnalyzerState): AnalyzerState => {
  return {
    ...state,
    post_scramble: '',
    full_solution: [],
    scramble: '',
    stage: 'fb',
  };
};

// ---- ScrambleView --------------------------------------------------------
function ScrambleView(props: {
  state: AnalyzerState;
  setState: (newState: AnalyzerState) => void;
}) {
  const { state, setState } = props;
  const [value, setValue] = React.useState(state.scramble);

  const onScrambleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(event.target.value);
  };

  const handleBegin = () => {
    setState({ ...resetState(state), scramble: value });
  };
  const handleGen = () => {
    const cube = CubeUtil.get_random_with_mask(Mask.empty_mask);
    const scramble = CachedSolver.get('min2phase').solve(cube, 0, 0, 0)[0].inv().toString();
    setState({ ...resetState(state), scramble });
    setValue(scramble);
  };

  return (
    <div className="roux-analyzer-scramble">
      <div className="roux-analyzer-scramble-field">
        <FieldLabel>Scramble</FieldLabel>
        <textarea
          className="roux-analyzer-scramble-input"
          rows={2}
          value={value}
          onChange={onScrambleChange}
          spellCheck={false}
        />
      </div>
      <div className="roux-analyzer-scramble-actions">
        <button
          type="button"
          className="roux-btn roux-btn-primary"
          onFocus={(evt) => evt.currentTarget.blur()}
          onClick={handleGen}
        >
          Gen
        </button>
        <button
          type="button"
          className="roux-btn roux-btn-primary"
          onFocus={(evt) => evt.currentTarget.blur()}
          onClick={handleBegin}
        >
          GO
        </button>
      </div>
    </div>
  );
}

// ---- ConfigView ----------------------------------------------------------
function ConfigView(props: { state: AnalyzerState; setState: (newState: AnalyzerState) => void }) {
  const { state, setState } = props;

  const fb_ori_str = state.orientation + ',' + state.pre_orientation;
  const handleFBOri = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value.split(',');
    setState({ ...state, orientation: value[0], pre_orientation: value[1] });
  };
  const handle_display_mode = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setState({ ...state, show_mode: event.target.value });
  };
  const handle_num_solution = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const value = Number.parseInt(event.target.value);
    setState({ ...state, num_solution: value || state.num_solution });
  };
  const handle_fb_stage = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setState({ ...state, fb_stage: event.target.value as fbStageT });
  };
  const handle_hide_solutions = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setState({ ...state, hide_solutions: event.target.value === 'true' });
  };

  return (
    <div className="roux-analyzer-config">
      <div className="roux-analyzer-config-item">
        <FieldLabel>FB Orientation</FieldLabel>
        <select className="roux-analyzer-select" value={fb_ori_str} onChange={handleFBOri}>
          <option value="x2y,">x2y on W/Y</option>
          <option value="x2y,x">x2y on B/G</option>
          <option value="x2y,z">x2y on R/O</option>
          <option value="cn,">Color Neutral</option>
        </select>
      </div>
      <div className="roux-analyzer-config-item">
        <FieldLabel>Organize</FieldLabel>
        <select className="roux-analyzer-select" value={state.show_mode} onChange={handle_display_mode}>
          <option value="foreach">By FB</option>
          <option value="combined">Combined</option>
        </select>
      </div>
      <div className="roux-analyzer-config-item">
        <FieldLabel># Solutions</FieldLabel>
        <select
          className="roux-analyzer-select"
          value={state.num_solution}
          onChange={handle_num_solution}
        >
          <option value={1}>1</option>
          <option value={3}>3</option>
          <option value={5}>5</option>
          <option value={10}>10</option>
          <option value={25}>25</option>
        </select>
      </div>
      <div className="roux-analyzer-config-item">
        <FieldLabel>FB Stage</FieldLabel>
        <select className="roux-analyzer-select" value={state.fb_stage} onChange={handle_fb_stage}>
          <option value="fb">FB</option>
          <option value="fs">FS</option>
          <option value="pseudo-fs">Pseudo FS</option>
          <option value="felinep1">E-Line+1</option>
          <option value="fs-combo">FS/Line</option>
        </select>
      </div>
      <div className="roux-analyzer-config-item">
        <FieldLabel>Hints?</FieldLabel>
        <select
          className="roux-analyzer-select"
          value={state.hide_solutions.toString()}
          onChange={handle_hide_solutions}
        >
          <option value="true">Yes</option>
          <option value="false">No</option>
        </select>
      </div>
    </div>
  );
}

// ---- SolutionInputView ---------------------------------------------------
function SolutionInputView(props: {
  state: AnalyzerState;
  setState: (newState: AnalyzerState) => void;
}) {
  const [editing, setEditing] = React.useState(false);
  const [value, setValue] = React.useState('');

  const onChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(event.target.value);
    event.stopPropagation();
  };
  const toggleEdit = () => {
    setEditing(true);
  };
  const handleClose = () => {
    setEditing(false);
    const full_solution = analyze_roux_solve(
      new CubieCube().apply(props.state.scramble),
      new MoveSeq(value),
    );
    if (
      full_solution.length > 1 ||
      (full_solution.length === 1 && full_solution[0].solution.moves.length > 0)
    ) {
      props.setState({ ...props.state, full_solution });
    }
  };

  return (
    <div>
      <div>
        <button
          type="button"
          className={'roux-btn ' + (editing ? 'roux-btn-primary' : 'roux-btn-outline')}
          onClick={toggleEdit}
        >
          <Edit size={15} />
          Input Your Solution
        </button>
      </div>

      <Modal
        open={editing}
        onClose={handleClose}
        title="Input your reconstructed solution"
        maxWidth={520}
        actions={
          <button type="button" className="roux-btn roux-btn-outline" onClick={handleClose}>
            Confirm
          </button>
        }
      >
        <textarea
          className="roux-analyzer-solution-input"
          rows={5}
          value={value}
          onChange={onChange}
        />
      </Modal>
    </div>
  );
}

// ---- ColorPair -----------------------------------------------------------
const colorMap: { [key: string]: string } = ColorScheme.default_colors;

function ColorPair({ colors }: { colors: string[] }) {
  return (
    <span className="roux-analyzer-colorpair">
      {colors.map((color, i) => (
        <span
          key={i}
          className="roux-analyzer-colorsq"
          style={{ backgroundColor: colorMap[color] }}
        />
      ))}
    </span>
  );
}

// ---- StageSolutionView ---------------------------------------------------
function StageSolutionView(props: { solution: SolutionDesc; shortestLength?: number }) {
  const { solution, stage, premove, orientation, fb_tag } = props.solution;
  const getTags = () => {
    if (stage === 'fb') {
      const colors = get_orientation_fb_colors(orientation || '');
      return [<ColorPair key="colors" colors={colors} />, fb_tag].filter(Boolean);
    } else if (stage === 'ss-front' || stage === 'ss-back') {
      return [stage];
    } else return [];
  };
  const tags = getTags();
  const isShortest =
    props.shortestLength !== undefined && solution.moves.length === props.shortestLength;
  const shortened_rotation = get_shortened_rotation(orientation + ' ' + premove);

  return (
    <div className="roux-analyzer-sol-row">
      {tags.filter((x) => x).map((t, i) => (
        <span className="roux-analyzer-chip" key={i}>
          {t}
        </span>
      ))}
      <span className="roux-analyzer-sol-gap" />
      <div className="roux-analyzer-sol-moves">
        {shortened_rotation + ' ' + solution.moves.map((m) => m.name).join(' ')}
        {isShortest && ' (*)'}
      </div>
    </div>
  );
}

// ---- StageSolutionListView (quiz / spoiler) ------------------------------
function StageSolutionListView(props: {
  solutions: SolutionDesc[];
  num_to_display: number;
  state: AnalyzerState;
  setState: (newState: AnalyzerState) => void;
}) {
  const { solutions, num_to_display, state } = props;
  const [isRevealed, setIsRevealed] = React.useState(!state.hide_solutions);

  React.useEffect(() => {
    setIsRevealed(!state.hide_solutions);
  }, [state.hide_solutions, solutions]);

  const shortestSolution =
    solutions.length > 0
      ? solutions.reduce((shortest, current) =>
          current.solution.moves.length < shortest.solution.moves.length ? current : shortest,
        )
      : null;

  const handleClick = () => {
    setIsRevealed(true);
  };

  const shortest_length = shortestSolution?.solution.moves.length || 0;
  const shortest_solutions = solutions.filter(
    (s) => s.solution.moves.length === shortest_length,
  );
  const tag_full_name: Record<string, string> = {
    FS: 'FS',
    FB: 'FB',
    Ps: 'Pseudo FS',
    Line: 'E-Line + 1c',
  };
  const shortest_solution_tag_names = shortest_solutions.map((s) => ({
    tag: tag_full_name[s.fb_tag || 'FB'],
    fb_name: get_orientation_fb_colors(s.orientation || ''),
  }));
  const shortest_tag_names = shortest_solution_tag_names.reduce(
    (acc, curr) => {
      if (!acc[curr.tag]) {
        acc[curr.tag] = new Set();
      }
      acc[curr.tag].add(curr.fb_name.join('-'));
      return acc;
    },
    {} as Record<string, Set<string>>,
  );
  const shortest_tag_names_str = Object.entries(shortest_tag_names).map(([tag, fb_names]) => {
    const colorPairs = [...fb_names].map((name) => {
      const [color1, color2] = name.split('-');
      return <ColorPair key={name} colors={[color1, color2]} />;
    });

    return (
      <React.Fragment key={tag}>
        <div className="roux-analyzer-hint-line">
          {`There exists ${shortest_length}-STM ${tag || 'solution'} in: `}
        </div>
        <div className="roux-analyzer-hint-pairs">{colorPairs}</div>
      </React.Fragment>
    );
  });

  return (
    <div className="roux-analyzer-sol-list">
      {solutions.length > 0 && (
        <div
          onClick={!isRevealed ? handleClick : undefined}
          className={!isRevealed ? 'roux-analyzer-quiz-clickable' : undefined}
        >
          {!isRevealed ? (
            <div className="roux-analyzer-quiz">
              {shortest_tag_names_str}
              <div className="roux-analyzer-quiz-hint">(Click to reveal)</div>
            </div>
          ) : (
            <div>
              {solutions.slice(0, num_to_display).map((s, i) => (
                <StageSolutionView
                  solution={s}
                  key={i}
                  shortestLength={shortestSolution?.solution.moves.length}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---- FullSolutionView ----------------------------------------------------
function FullSolutionView(props: {
  state: AnalyzerState;
  setState: (newState: AnalyzerState) => void;
}) {
  const { state, setState } = props;

  const setStage = (i: number) => () => {
    setState({
      ...state,
      stage: state.full_solution[i].stage,
      post_scramble: state.full_solution
        .slice(0, i)
        .map((x) => x.premove + x.solution.toString())
        .join(' '),
    });
  };
  const [show, setShow] = React.useState(-1);
  const stageView = (sol: SolutionDesc, i: number) => {
    return (
      <div
        className="roux-analyzer-stage"
        key={i}
        onMouseLeave={() => setShow(-1)}
        onMouseEnter={() => setShow(i)}
        onClick={() => setShow(show === i ? -1 : i)}
      >
        <button
          type="button"
          className={
            'roux-analyzer-stage-btn' + (show === i ? ' roux-analyzer-stage-btn-active' : '')
          }
          onClick={setStage(i)}
        >
          <span className="roux-analyzer-stage-text">
            {sol.solution.toString()} {'//'} {sol.stage}
          </span>
          <Search size={14} />
        </button>
      </div>
    );
  };
  return (
    <div className="roux-analyzer-full-solution">
      <div>
        <SolutionInputView state={state} setState={setState} />
      </div>
      <div className="roux-analyzer-stage-list">
        {props.state.full_solution.map((desc, i) => stageView(desc, i))}
      </div>
    </div>
  );
}

// ---- analyzer execution (reimplements useAnalyzer / Hooks.tsx) -----------
// Off-thread comlink worker when available; main-thread fallback otherwise.
type AnalyzerData = { isRunning: boolean; solutions: SolutionDesc[] | undefined };

function useAnalyzer(analyzerState: AnalyzerState): AnalyzerData {
  const [data, setData] = React.useState<AnalyzerData>({
    isRunning: false,
    solutions: undefined,
  });

  // Create one worker for the lifetime of the component; reuse it.
  const workerRef = React.useRef<Worker | null>(null);
  const apiRef = React.useRef<Remote<AnalyzerWorker> | null>(null);

  React.useEffect(() => {
    try {
      const worker = new Worker(new URL('./analyzer.worker.ts', import.meta.url), {
        type: 'module',
      });
      workerRef.current = worker;
      apiRef.current = wrap<AnalyzerWorker>(worker);
    } catch {
      // Worker unavailable — main-thread fallback kicks in below.
      workerRef.current = null;
      apiRef.current = null;
    }
    return () => {
      try {
        apiRef.current?.[releaseProxy]();
      } catch {
        /* noop */
      }
      workerRef.current?.terminate();
      workerRef.current = null;
      apiRef.current = null;
    };
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    if (analyzerState.scramble === '') {
      // Mirror upstream: flag running but never resolve for empty scramble.
      setData({ isRunning: true, solutions: undefined });
      return;
    }
    setData({ isRunning: true, solutions: undefined });

    const runMainThread = () => {
      // Yield once so the spinner paints before the heavy synchronous analyze.
      setTimeout(() => {
        if (cancelled) return;
        const solutions = analyzeMain(analyzerState);
        if (!cancelled) setData({ isRunning: false, solutions });
      }, 0);
    };

    const api = apiRef.current;
    if (api) {
      api
        .analyze(analyzerState)
        .then((solutions) => {
          if (!cancelled) setData({ isRunning: false, solutions });
        })
        .catch(() => {
          // Worker errored at runtime — fall back to main thread.
          if (!cancelled) runMainThread();
        });
    } else {
      runMainThread();
    }

    return () => {
      cancelled = true;
    };
  }, [analyzerState]);

  return data;
}

// ---- AnalyzerView (main) -------------------------------------------------
function AnalyzerView(props: { state: AppState; dispatch: React.Dispatch<Action> }) {
  const { state: appState } = props;

  const [state, setState] = React.useState<AnalyzerState>(initialState);

  const isMobile = useIsMobile(599);
  const effective = useEffectiveTheme();
  const cubeTheme = effective === 'dark' ? 'dark' : 'bright';

  const mask = Mask.solved_mask;
  const cubieCube = new CubieCube().apply(state.scramble).apply(state.post_scramble);
  const faceletCube = FaceletCube.from_cubie(cubieCube, mask);

  const analyzerData = useAnalyzer(state);

  let solutions_to_display = analyzerData.isRunning ? [] : analyzerData.solutions || [];
  let num_solutions_to_display = solutions_to_display.length;

  if (state.show_mode === 'combined') {
    solutions_to_display = [...solutions_to_display].sort((x, y) => x.score - y.score);
    num_solutions_to_display = state.num_solution;
  }

  // canvas sizing: !mobile gets the larger frame (upstream gt_sm/gt_md branch),
  // mobile gets the small frame.
  const canvas_wh = isMobile ? [320, 280] : [400, 350];

  const configPanel = (
    <div className="roux-analyzer-panel">
      <ConfigView state={state} setState={setState} />
    </div>
  );

  return (
    <div className="roux-analyzer">
      <div className="roux-analyzer-panel">
        <ScrambleView state={state} setState={setState} />
      </div>

      {!isMobile && configPanel}

      <div className="roux-analyzer-panel">
        <div className="roux-analyzer-grid">
          <div className="roux-analyzer-col">
            <div className="roux-analyzer-sol-block">
              <div className="roux-analyzer-sol-head">
                <div className="roux-analyzer-title">Solutions</div>
                <div>
                  <span className="roux-analyzer-stage-tag">{state.stage}</span>
                </div>
              </div>
              <span className="roux-analyzer-sol-gap" />
              <div className="roux-analyzer-sol-body">
                <StageSolutionListView
                  solutions={solutions_to_display}
                  num_to_display={num_solutions_to_display}
                  state={state}
                  setState={setState}
                />
              </div>
            </div>
          </div>
          <div className="roux-analyzer-cube-col">
            <div className="roux-analyzer-cube-wrap">
              <CubeSim
                width={canvas_wh[0]}
                height={canvas_wh[1]}
                cube={faceletCube}
                colorScheme={appState.colorScheme.getColorsForOri('WG')}
                hintDistance={6}
                theme={cubeTheme}
                facesToReveal={[Face.L, Face.B, Face.D]}
              />
            </div>
          </div>
        </div>
      </div>

      {isMobile && configPanel}
    </div>
  );
}

export default AnalyzerView;

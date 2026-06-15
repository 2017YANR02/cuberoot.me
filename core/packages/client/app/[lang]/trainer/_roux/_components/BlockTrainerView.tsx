'use client';

// De-MUI faithful port of roux-trainers/src/components/BlockTrainerView.tsx.
// ALL engine logic, state reads, dispatch calls, per-mode config panels and
// global keyboard handling are preserved verbatim; only the MUI presentation
// (Box/Grid/Paper/Typography/Button/Divider/IconButton/Tooltip/makeStyles/
// useTheme/useMediaQuery) is replaced by plain HTML + site-token CSS.

import React, { Fragment } from 'react';
import { AlertCircle, Heart } from 'lucide-react';

import CubeSim from './CubeSim';
import { FaceletCube, Mask, MoveSeq } from '@/lib/roux/CubeLib';
import { Face } from '@/lib/roux/Defs';
import { CaseDesc } from '@/lib/roux/Algs';
import { AppState, Action, FavCase, Mode } from '@/lib/roux/Types';
import { useEffectiveTheme } from '@/lib/theme';
import { useIsMobile } from '@/hooks/useIsMobile';

import { SingleSelect, MultiSelect, SliderSelect } from './SelectorViews';
import { ColorPanel } from './Input';
import { ScrambleInputView } from './ScrambleInputView';
import { FieldLabel } from './ui';
import { useRT } from '../i18n';

import './BlockTrainerView.css';

function getMask(state: AppState): Mask {
  if (state.mode === 'fbdr') {
    const fbOnly = state.case.desc.length === 0 || state.case.desc[0].kind === 'fb';
    //   getActiveName(state.config.fbOnlySelector) === "FB Last Pair"
    return fbOnly ? Mask.fb_mask : Mask.fbdr_mask;
  } else if (state.mode === 'fs') {
    const name = state.config.fsSelector.getActiveName();
    return (
      {
        'Front FS': Mask.fs_front_mask,
        'Back FS': Mask.fs_back_mask,
        Both: Mask.fb_mask,
      } as any
    )[name];
  } else if (state.mode === 'ss') {
    if (state.case.desc.length === 0) return Mask.sb_mask;
    const name = state.config.ssSelector.getActiveName();
    const dpair = state.config.ssPairOnlySelector.getActiveName() === 'D-Pair only';

    switch (name) {
      case 'Front SS':
        return dpair ? Mask.ssdp_front_mask : Mask.ss_front_mask;
      case 'Back SS':
        return dpair ? Mask.ssdp_back_mask : Mask.ss_back_mask;
      default:
        return dpair ? Mask.ssdp_both_mask : Mask.f2b_mask;
    }
  } else if (state.mode === 'fb') {
    if (
      state.case.desc.length === 0 ||
      state.case.desc[0].kind === 'fb' ||
      state.case.desc[0].kind.startsWith('fb@')
    ) {
      return Mask.fb_mask;
    } else if (state.case.desc[0].kind === 'fbdr') {
      return Mask.fbdr_mask;
    } else {
      return Mask.solved_mask;
    }
  } else if (state.mode === 'fbss') {
    const name = state.config.fbssSsSelector.getActiveName();
    return (
      {
        'Front SS': Mask.ss_front_mask,
        'Back SS': Mask.ss_back_mask,
        Both: Mask.f2b_mask,
      } as any
    )[name];
  } else if (state.mode === '4c' || state.mode === 'eopair') {
    return Mask.solved_mask;
  } else return Mask.sb_mask;
}

function getHelperTextForMode(mode: Mode) {
  if (mode === '4c' || mode === 'eopair') {
    return (
      'Usage: Press space for next case. Enter to redo.' +
      "\n\nVirtual Cube: I/K (E/D) for M'/M, J/F for U/U'"
    );
  } else {
    return null;
  }
}

function BlockTrainerView(props: { state: AppState; dispatch: React.Dispatch<Action> }) {
  const { state, dispatch } = props;
  const { t, isZh } = useRT();
  const cube = state.cube.state;

  const facelet = FaceletCube.from_cubie(cube, getMask(state));

  const desc: CaseDesc[] = state.case.desc.length
    ? state.case.desc
    : [{ algs: [''], setup: t('Press next for new case'), id: '', kind: '' }];

  const spaceButtonText = state.name === 'hiding' ? 'Reveal' : 'Next';
  const showMoveCountHint = state.config.moveCountHint.getActiveName() === 'Show';

  const describe_reveal = function (algs: CaseDesc[]) {
    const get_algs = (d: CaseDesc) => d.algs;
    if (algs.length === 1) {
      return get_algs(algs[0]).join('\n');
    } else {
      return algs.map((alg) => `[${alg.kind}]:\n` + get_algs(alg).join('\n') + '\n');
    }
  };

  const describe_hide = (desc: CaseDesc[]) => {
    const minMove = desc
      .map((d) => d.algs.map((a) => new MoveSeq(a).remove_setup().moves.length))
      .flat()
      .reduce((a, b) => Math.min(a, b), 100);
    return isZh ? `(最少 = ${minMove} STM)` : `(Min = ${minMove} STM)`;
  };
  const algText =
    state.name === 'hiding'
      ? showMoveCountHint
        ? describe_hide(desc)
        : ''
      : state.name === 'revealed'
        ? describe_reveal(desc)
        : '';

  const [favSelected, setFav] = React.useState(false);

  const handleSpace = () => {
    dispatch({ type: 'key', content: '#space' });
    if (spaceButtonText === 'Next') {
      setFav(false);
    }
  };

  const setup = desc.length ? desc[0].setup! : '';

  // Add event listeners
  React.useEffect(() => {
    function downHandler(event: KeyboardEvent) {
      if (event.key === ' ' && spaceButtonText === 'Next') {
        setFav(false);
      }
      state.keyMapping.handle(event, dispatch);
    }
    window.addEventListener('keydown', downHandler);
    return () => {
      window.removeEventListener('keydown', downHandler);
    };
  });

  const handleFav = () => {
    if (state.case.desc.length === 0) return;
    const case_: FavCase = {
      mode: state.mode,
      solver: state.case.desc.map((x) => x.kind),
      setup: setup || '',
    };
    if (!favSelected) {
      setFav(true);
      dispatch({ type: 'favList', content: [case_], action: 'add' });
    } else {
      setFav(false);
      dispatch({ type: 'favList', content: [case_], action: 'remove' });
    }
  };

  const gt_sm = !useIsMobile(599);
  const effectiveTheme = useEffectiveTheme();
  const canvas_wh = gt_sm ? [400, 350] : [320, 280];
  const ADD_STR = gt_sm ? t('Add') : '';

  // helper-text
  const helperText = getHelperTextForMode(state.mode);

  const levelSelectionWarning = t(
    "We weren't able to generate your level within time limit. You can try again -- some levels are reachable within a few tries.",
  );
  const levelSelectionSuccess = state.cube.levelSuccess;

  const scramblePanel = (
    <div className="roux-block-scramble-panel">
      <ScrambleInputView display={setup} dispatch={dispatch} scrambles={state.scrambleInput} />

      <div>
        {gt_sm ? (
          <button
            type="button"
            name="fav"
            onClick={handleFav}
            className={
              'roux-btn roux-block-fav-btn' +
              (favSelected ? ' roux-btn-primary' : ' roux-btn-outline')
            }
          >
            <Heart size={16} />
            {favSelected ? '✓' : ADD_STR}
          </button>
        ) : null}
      </div>
    </div>
  );

  return (
    <div className="roux-block-container">
      <div className="roux-block-paper">
        <div className="roux-block-scramble-head">
          <div className="roux-block-title-col">
            <div className="roux-block-title">{t('Scramble')}</div>
          </div>
          <div className="roux-block-fgap" />
          <div className="roux-block-setup-wrap">
            <p className="roux-block-setup">{setup}</p>
          </div>
          <div className="roux-block-fgap" />

          {gt_sm && scramblePanel}
        </div>
      </div>

      <div className="roux-block-paper">
        <div className="roux-block-grid">
          <div className="roux-block-grid-half roux-block-solutions-col">
            <div className="roux-block-solutions-head">
              <div className="roux-block-title-col-start">
                <div className="roux-block-title">{t('Solutions')}</div>
              </div>
              <div className="roux-block-fgap" />
              <div>
                <div className="roux-block-alg-wrap">
                  <p className="roux-block-alg-text">{algText}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="roux-block-grid-half roux-block-cube-col">
            <div className="roux-block-cube-wrap">
              {props.state.config.showCube.getActiveName() === 'Show' ? (
                <CubeSim
                  width={canvas_wh[0]}
                  height={canvas_wh[1]}
                  cube={facelet}
                  colorScheme={state.colorScheme.getColorsForOri(state.cube.ori)}
                  hintDistance={state.mode === '4c' || state.mode === 'eopair' ? 3 : 7}
                  theme={effectiveTheme === 'dark' ? 'dark' : 'bright'}
                  facesToReveal={[Face.L, Face.B, Face.D]}
                  obscureNonLR={
                    state.mode === 'ss' &&
                    state.config.obscureNonLRSelector.getActiveName() === 'On'
                  }
                  obscureStickerWidth={
                    state.mode === 'ss'
                      ? state.config.obscureStickerWidthSelector.getActiveName()
                      : undefined
                  }
                  obscureCornerMask={
                    state.mode === 'ss' &&
                    state.config.obscureCornerMaskSelector.getActiveName() === 'On'
                  }
                />
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <div className="roux-block-paper roux-block-action-paper">
        <div className="roux-block-action-row">
          <div className="roux-block-space-btn-wrap">
            <button
              type="button"
              onFocus={(evt) => evt.currentTarget.blur()}
              className="roux-btn roux-btn-primary roux-block-space-btn"
              onClick={handleSpace}
            >
              {t(spaceButtonText)}
            </button>
          </div>
          {!levelSelectionSuccess ? (
            <div className="roux-block-warn-wrap">
              <span className="roux-icon-btn roux-block-warn-icon" title={levelSelectionWarning}>
                <AlertCircle size={28} />
              </span>
            </div>
          ) : null}
        </div>
      </div>

      <div className="roux-block-spacer-20" />
      <hr className="roux-block-divider" />
      <div className="roux-block-spacer-20" />

      <div className="roux-block-config-group">
        <ConfigPanelGroup {...{ state, dispatch }} />
      </div>

      {helperText ? (
        <Fragment>
          <div className="roux-block-spacer-20" />
          <hr className="roux-block-divider" />
          <div className="roux-block-spacer-15" />
          <div>
            <div className="roux-block-prompt">
              <FieldLabel>
                <pre className="roux-block-helper-pre">{t(helperText)}</pre>
              </FieldLabel>
            </div>
          </div>
        </Fragment>
      ) : null}
    </div>
  );
}

function ConfigPanelGroup(props: { state: AppState; dispatch: React.Dispatch<Action> }) {
  const { state, dispatch } = props;
  if (state.mode === 'ss') {
    const DRManip = [
      // names: ["UF", "FU", "UL", "LU", "UB", "BU", "UR", "RU", "DF", "FD", "DB", "BD",
      // "DR", "RD", "BR", "RB", "FR", "RF"],
      {
        name: 'Toggle Select All',
        enableIdx: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17],
      },
      { name: 'Toggle All Oriented', enableIdx: [0, 2, 4, 6, 8, 10, 12, 14, 16] },
    ];
    return (
      <Fragment>
        <SliderSelect {...{ state, dispatch, select: 'ssLevelSelector' }} />

        <div className="roux-block-config-panel">
          <SingleSelect {...{ state, dispatch, select: 'ssSelector' }}> </SingleSelect>
          <SingleSelect {...{ state, dispatch, select: 'ssPairOnlySelector' }}> </SingleSelect>
          <SingleSelect {...{ state, dispatch, select: 'solutionNumSelector' }}> </SingleSelect>
          {/* <SingleSelect {...{state, dispatch, select: "evaluator"}}> </SingleSelect> */}

          <SingleSelect {...{ state, dispatch, select: 'moveCountHint' }}> </SingleSelect>
          <SingleSelect {...{ state, dispatch, select: 'showCube' }}> </SingleSelect>

          <div>
            <SingleSelect {...{ state, dispatch, select: 'obscureNonLRSelector' }}> </SingleSelect>
            {state.config.obscureNonLRSelector.getActiveName() === 'On' && (
              <SingleSelect {...{ state, dispatch, select: 'obscureStickerWidthSelector' }}>
                {' '}
              </SingleSelect>
            )}
            {state.config.obscureNonLRSelector.getActiveName() === 'On' && (
              <SingleSelect {...{ state, dispatch, select: 'obscureCornerMaskSelector' }}>
                {' '}
              </SingleSelect>
            )}
          </div>

          <MultiSelect
            {...{ state, dispatch, select: 'ssPosSelector', options: { manipulators: DRManip } }}
          >
            {' '}
          </MultiSelect>
          <ColorPanel {...{ state, dispatch }} />
        </div>
      </Fragment>
    );
  } else if (state.mode === 'fbdr') {
    const select1 = 'fbdrSelector';
    const select2 = 'fbOnlySelector';
    const select3 = 'fbPairSolvedSelector';
    const select4 = 'fbdrScrambleSelector';
    const select5 = 'solutionNumSelector';

    const LPEdgeManip = [
      {
        name: 'Toggle Select All',
        enableIdx: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17],
      },
    ];
    const pos1 = 'fbdrPosSelector1';
    const pos3 = 'fbdrPosSelector3';

    return (
      <Fragment>
        <SliderSelect {...{ state, dispatch, select: 'fbdrLevelSelector' }} />

        <div className="roux-block-config-panel">
          <SingleSelect {...{ state, dispatch, select: select2 }}> </SingleSelect>
          <SingleSelect {...{ state, dispatch, select: select1 }}> </SingleSelect>
          <SingleSelect {...{ state, dispatch, select: select3 }}> </SingleSelect>
          <SingleSelect {...{ state, dispatch, select: select4 }}> </SingleSelect>
          <SingleSelect {...{ state, dispatch, select: select5 }}> </SingleSelect>
          {/* <SingleSelect {...{state, dispatch, select: "evaluator"}}> </SingleSelect> */}
          <SingleSelect {...{ state, dispatch, select: 'moveCountHint' }}> </SingleSelect>
          <SingleSelect {...{ state, dispatch, select: 'showCube' }}> </SingleSelect>

          <MultiSelect
            {...{ state, dispatch, select: pos1, options: { manipulators: LPEdgeManip } }}
          >
            {' '}
          </MultiSelect>
          <MultiSelect
            {...{ state, dispatch, select: pos3, options: { manipulators: LPEdgeManip } }}
          >
            {' '}
          </MultiSelect>
          <ColorPanel {...{ state, dispatch }} />
        </div>
      </Fragment>
    );
  } else if (state.mode === 'fb') {
    return (
      <Fragment>
        <SliderSelect {...{ state, dispatch, select: 'fbLevelSelector' }} />
        {/* <SingleSelect {...{state, dispatch, select: "fbStratSelector"}} />  */}

        <div className="roux-block-config-panel">
          <SingleSelect {...{ state, dispatch, select: 'fbPieceSolvedSelector' }}> </SingleSelect>
          {/* <SingleSelect {...{state, dispatch, select: "fbBasisSelector"}} />  */}
          <SingleSelect {...{ state, dispatch, select: 'solutionNumSelector' }}> </SingleSelect>
          {/* <SingleSelect {...{state, dispatch, select: "evaluator"}}> </SingleSelect> */}
          <SingleSelect {...{ state, dispatch, select: 'moveCountHint' }}> </SingleSelect>
          <SingleSelect {...{ state, dispatch, select: 'showCube' }}> </SingleSelect>

          <ColorPanel {...{ state, dispatch }} />
        </div>
      </Fragment>
    );
  } else if (state.mode === 'fs') {
    const select1 = 'fsSelector';
    const select2 = 'solutionNumSelector';

    return (
      <Fragment>
        <SliderSelect {...{ state, dispatch, select: 'fsLevelSelector' }} />

        <div className="roux-block-config-panel">
          <SingleSelect {...{ state, dispatch, select: select1 }}> </SingleSelect>
          <SingleSelect {...{ state, dispatch, select: select2 }}> </SingleSelect>
          {/* <SingleSelect {...{state, dispatch, select: "evaluator"}}> </SingleSelect> */}
          <SingleSelect {...{ state, dispatch, select: 'moveCountHint' }}> </SingleSelect>
          <SingleSelect {...{ state, dispatch, select: 'showCube' }}> </SingleSelect>

          <ColorPanel {...{ state, dispatch }} />
        </div>
      </Fragment>
    );
  } else if (state.mode === 'fsdr') {
    const select1 = 'fsSelector';
    const select2 = 'solutionNumSelector';

    return (
      <Fragment>
        <SliderSelect {...{ state, dispatch, select: 'fsLevelSelector' }} />

        <div className="roux-block-config-panel">
          <SingleSelect {...{ state, dispatch, select: select1 }}> </SingleSelect>
          <SingleSelect {...{ state, dispatch, select: select2 }}> </SingleSelect>
          {/* <SingleSelect {...{state, dispatch, select: "evaluator"}}> </SingleSelect> */}
          <SingleSelect {...{ state, dispatch, select: 'moveCountHint' }}> </SingleSelect>
          <SingleSelect {...{ state, dispatch, select: 'showCube' }}> </SingleSelect>

          <ColorPanel {...{ state, dispatch }} />
        </div>
      </Fragment>
    );
  } else if (state.mode === 'fbss') {
    const select1 = 'fbssLpSelector';
    const select2 = 'fbssSsSelector';
    const select3 = 'solutionNumSelector';

    return (
      <Fragment>
        <SliderSelect {...{ state, dispatch, select: 'fbssLevelSelector' }} />
        <div className="roux-block-config-panel">
          <SingleSelect {...{ state, dispatch, select: select1 }}> </SingleSelect>
          <SingleSelect {...{ state, dispatch, select: select2 }}> </SingleSelect>
          <SingleSelect {...{ state, dispatch, select: select3 }}> </SingleSelect>
          {/* <SingleSelect {...{state, dispatch, select: "evaluator"}}> </SingleSelect> */}
          <SingleSelect {...{ state, dispatch, select: 'moveCountHint' }}> </SingleSelect>
          <ColorPanel {...{ state, dispatch }} />
        </div>
      </Fragment>
    );
  } else if (state.mode === '4c') {
    const select1 = 'lseStageSelector';
    const select2 = 'lseMCSelector';
    const select3 = 'lseBarSelector';
    const select4 = 'solutionNumSelector';

    return (
      <Fragment>
        <div className="roux-block-config-panel">
          <SingleSelect {...{ state, dispatch, select: select1 }}> </SingleSelect>
          <SingleSelect {...{ state, dispatch, select: select2 }}> </SingleSelect>
          <SingleSelect {...{ state, dispatch, select: select3 }}> </SingleSelect>
          <SingleSelect {...{ state, dispatch, select: select4 }}> </SingleSelect>
          {/* <SingleSelect {...{state, dispatch, select: "evaluator"}}> </SingleSelect> */}
          <SingleSelect {...{ state, dispatch, select: 'moveCountHint' }}> </SingleSelect>
          <SingleSelect {...{ state, dispatch, select: 'showCube' }}> </SingleSelect>

          <ColorPanel {...{ state, dispatch }} />
        </div>
      </Fragment>
    );
  } else if (state.mode === 'eopair') {
    const select1 = 'lseEOSelector';
    const select2 = 'lseEOLRMCSelector';
    const select3 = 'lseBarbieSelector';
    const select4 = 'lseEOLRScrambleSelector';
    const select5 = 'solutionNumSelector';

    return (
      <Fragment>
        <div className="roux-block-config-panel">
          <MultiSelect {...{ state, dispatch, select: select1, options: { noDialog: true } }}>
            {' '}
          </MultiSelect>
          <SingleSelect {...{ state, dispatch, select: select2 }}> </SingleSelect>
          <SingleSelect {...{ state, dispatch, select: select3 }}> </SingleSelect>
          <SingleSelect {...{ state, dispatch, select: select4 }}> </SingleSelect>
          <SingleSelect {...{ state, dispatch, select: select5 }}> </SingleSelect>
          {/* <SingleSelect {...{state, dispatch, select: "evaluator"}}> </SingleSelect> */}
          <SingleSelect {...{ state, dispatch, select: 'moveCountHint' }}> </SingleSelect>
          <SingleSelect {...{ state, dispatch, select: 'showCube' }}> </SingleSelect>

          <ColorPanel {...{ state, dispatch }} />
        </div>
      </Fragment>
    );
  } else return <Fragment />;
}

export default BlockTrainerView;

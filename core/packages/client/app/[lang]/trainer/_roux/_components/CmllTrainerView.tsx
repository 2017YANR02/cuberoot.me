'use client';

// Faithful de-MUI port of roux-trainers/src/components/CmllTrainerView.tsx.
// Two named exports: CmllTrainerView (CMLL) and OllcpTrainerView (OLLCP).
//
// ALL logic preserved verbatim: facelet derivation (mask / hyperori / kata),
// 2D/3D/flat3D visual toggle, reveal/next handlers, keyboard interception
// (keyMapping.handle + "/" reveal), alg/setup computation from state.case.desc.
// MUI presentation → plain HTML + ./CmllTrainerView.css. The upstream in-app
// bright/dark theme toggle was dropped repo-wide → CubeSim theme comes from the
// site theme via useEffectiveTheme() ('dark' → 'dark', else 'bright').

import React from 'react';

import CubeSim from './CubeSim';
import { CubeSim2D, CubeSimFlat3D } from './CubeSim2D';
import { FaceletCube, Mask, MoveSeq } from '@/lib/roux/CubeLib';
import { Face } from '@/lib/roux/Defs';
import { useEffectiveTheme } from '@/lib/theme';

import { AppState, Action } from '@/lib/roux/Types';
import { MultiSelect, SingleSelect } from './SelectorViews';
import { ColorPanel } from './Input';
import CaseSelectDialog from './CaseSelectView';
import { useRT } from '../i18n';
import {
  cmll_algs_raw,
  nmcll_display_parity,
  nmcll_to_cmll_mapping,
  ollcp_algs_raw,
} from '@/lib/roux/Algs';

import CaseVisualizer from './CaseVisualizer';
import './CmllTrainerView.css';

const cmll_name_to_alg = Object.fromEntries(cmll_algs_raw);
const nmcll_display_algs = nmcll_to_cmll_mapping.map(([x, y], i) => {
  const parity = nmcll_display_parity[i];
  let alg = cmll_name_to_alg[y[0][0]];
  alg = parity[2] + ' ' + alg + ' ' + parity[1];
  return [x, alg] as [string, string];
});

function NMCLLSelect(props: { state: AppState; dispatch: React.Dispatch<Action> }) {
  const { state, dispatch } = props;
  const groups = ['o', 's', 'as', 't', 'u', 'l', 'pi', 'h'];
  return (
    <CaseSelectDialog
      {...{
        state,
        dispatch,
        settings: {
          selector: 'nmcllSelector',
          groups,
          algs: nmcll_display_algs,
          visualizeMask: 'cmll',
          cubeOptions: {
            colorScheme: {
              0: '#ffffff', // URFDLB. U = white
              1: '#ee0000', // R = red
              2: '#404040', // F = green
              3: '#404040', // D = yellow
              4: '#ffa100', // L = orange
              5: '#404040', // B = blue
            },
          },
        },
        title:
          "Select cases by NMCLL recog (this is a separate selection from above, only activated when you're in L/R or F/B mode)",
        label: 'Select by NMCLL',
      }}
    />
  );
}

function _getMask(name: string) {
  switch (name) {
    case 'Show':
      return Mask.solved_mask;
    case 'Hide':
      return Mask.empty_mask;
    case 'Hide LSE':
      return Mask.lse_mask;
    default:
      return Mask.solved_mask;
  }
}

export function CmllTrainerView(props: { state: AppState; dispatch: React.Dispatch<Action> }) {
  const { state, dispatch } = props;
  const { t } = useRT();
  const cube = state.cube.state;
  const cubeTheme = useEffectiveTheme() === 'dark' ? 'dark' : 'bright';

  let facelet = FaceletCube.from_cubie(
    cube,
    _getMask(state.config.cmllCubeMaskSelector.getActiveName() || 'Show'),
  );

  const cmll2D3DActiveName = state.config.cmll2D3DSelector.getActiveName() || '3D';
  const use3D = cmll2D3DActiveName === '3D';
  const useFlat3D = cmll2D3DActiveName === 'flat3D';
  const kataMode = state.config.cmllKataSelector.getActiveName();
  const flat3DShowLFace = state.config.cmllflat3DFaceSelector.getActiveName() === 'L';
  const _3DShowLFace = state.config.cmll3DFaceSelector.getActiveName() === 'Show';

  const hyperori = state.config.hyperOriSelector.getActiveName() || 'off';
  if (hyperori !== 'off') {
    // if hyperori on
    if (hyperori === 'F/B') {
      facelet = FaceletCube.as_actrm(facelet, 'fb', true);
    } else {
      facelet = FaceletCube.as_actrm(facelet, 'lr', true);
    }
  } else {
    // if kata mode is on, we mask out all non-U stickers that are not used by recognition
    // we will go with the following (OO) recognition schema courtesy of James Macdiarmid:
    // Pi/H: U face
    // S/As/T/U: the T shape
    // L: the U face plus the FUR and BUL
    if (kataMode !== 'off') {
      // for now, let's add support for T-shape kata only.
      // This may be used for T,U,Pi,H obviously, but also for Sune/AntiSune with the James Macdiarmid recog methdo
      facelet = FaceletCube.as_kata(facelet);
    }
  }

  const cmllcubemaskSel = 'cmllCubeMaskSelector';
  const cmllaufSel = 'cmllAufSelector';
  const triggerSel = 'triggerSelector';
  const hyperoriSel = 'hyperOriSelector';
  const _2d3dSel = 'cmll2D3DSelector';
  const kataSel = 'cmllKataSelector';

  const panel = (
    <div className="roux-cmll-panel">
      <CaseSelectDialog
        {...{
          state,
          dispatch,
          settings: {
            selector: 'cmllCaseSelector',
            algs: cmll_algs_raw,
            groups: ['o', 's', 'as', 't', 'u', 'l', 'pi', 'h'],
            visualizeMask: 'cmll',
            cubeOptions: {
              colorScheme: {
                0: '#FEFE00', // URFDLB. U = yellow
                1: '#ffa100', // R = o
                2: '#00b800', // F = g
                3: '#404040', // D = w
                4: '#ee0000', // L = r
                5: '#0000f2', // B = blue
              },
            },
          },
          label: 'Select CMLL Cases',
        }}
      />

      <div className="roux-cmll-multirow">
        <MultiSelect
          {...{
            state,
            dispatch,
            select: cmllaufSel,
            options: { label: 'CMLL Auf', noDialog: true },
          }}
        />
        <MultiSelect
          {...{
            state,
            dispatch,
            select: triggerSel,
            options: {
              label: 'SB Last Pair Trigger (Uncheck all for pure CMLL)',
              noDialog: true,
            },
          }}
        />
      </div>

      <hr className="roux-cmll-divider" />

      <SingleSelect {...{ state, dispatch, select: cmllcubemaskSel, label: 'Virtual Cube' }} />

      <div className="roux-cmll-visualrow">
        <SingleSelect {...{ state, dispatch, select: _2d3dSel, label: 'Visualize as' }} />
        {use3D && (
          <SingleSelect
            {...{ state, dispatch, select: 'cmll3DFaceSelector', label: 'Show L face' }}
          />
        )}
        {useFlat3D && (
          <SingleSelect
            {...{
              state,
              dispatch,
              select: 'cmllflat3DFaceSelector',
              label: 'L/R faces to reveal',
            }}
          />
        )}
      </div>

      <SingleSelect
        {...{ state, dispatch, select: kataSel, label: 'Display recog stickers only' }}
      />
      <ColorPanel {...{ state, dispatch }} />

      <hr className="roux-cmll-divider" />

      <SingleSelect {...{ state, dispatch, select: hyperoriSel, label: 'NMCLL Recog Mode' }} />
      {hyperori !== 'off' && <NMCLLSelect {...{ state, dispatch }} />}
    </div>
  );

  React.useEffect(() => {
    setReveal(false); // todo: drive this from props. now there's a delay which causes the answer to leak for a split second
  }, [state]);
  const [reveal, setReveal] = React.useState(false);
  const handleClick = () => {
    setReveal(true);
  };
  const handleNext = () => {
    dispatch({ type: 'key', content: '#space' });
  };

  React.useEffect(() => {
    function downHandler(event: KeyboardEvent) {
      state.keyMapping.handle(event, dispatch);
      // intercept keyboard event for local control
      if (event.key === '/') {
        setReveal(true);
      }
    }
    window.addEventListener('keydown', downHandler);
    return () => {
      window.removeEventListener('keydown', downHandler);
    };
  });

  let alg = '';
  let setup = '';
  if (state.case.desc.length === 4) {
    setup = state.case.desc[3].algs[0];
  }
  if (reveal && state.case.desc.length >= 3) {
    const moves = new MoveSeq(state.case.desc[1].algs[0] + state.case.desc[2].algs[0]);
    const moves_c = moves.collapse();
    if (moves_c.moves.length > 0) {
      if (moves_c.moves[0].name[0] === 'U') {
        alg += '(' + moves_c.moves[0].name + ') ';
        moves_c.moves = moves_c.moves.slice(1);
      }
      alg += moves_c.toString();
    }
  }
  const colorSchemeColors = state.colorScheme.getColorsForOri(state.cube.ori);

  return (
    <div className="roux-cmll">
      <div className="roux-cmll-canvas">
        {use3D ? (
          <CubeSim
            width={400}
            height={350}
            cube={facelet}
            colorScheme={colorSchemeColors}
            theme={cubeTheme}
            facesToReveal={_3DShowLFace ? [Face.L] : []}
          />
        ) : useFlat3D ? (
          <CubeSimFlat3D
            width={400}
            height={350}
            cube={facelet}
            colorScheme={colorSchemeColors}
            theme={cubeTheme}
            facesToReveal={[flat3DShowLFace ? Face.L : Face.R]}
          />
        ) : (
          <CubeSim2D
            width={400}
            height={350}
            cube={facelet}
            colorScheme={colorSchemeColors}
            theme={cubeTheme}
          />
        )}
      </div>

      <div className="roux-cmll-card">
        <div className="roux-cmll-grid">
          <div className="roux-cmll-label">{t('Scramble')}</div>
          <div className="roux-cmll-value">
            <p className="roux-cmll-text">{setup}</p>
          </div>

          <div className="roux-cmll-label">{t('Case')}</div>
          {!reveal ? (
            <div className="roux-cmll-showcell">
              <button
                type="button"
                onFocus={(evt) => (evt.target as HTMLButtonElement).blur()}
                className="roux-btn roux-btn-outline roux-cmll-fullbtn"
                onClick={handleClick}
              >
                {t('Show')}
              </button>
            </div>
          ) : (
            <div className="roux-cmll-value">
              <p className="roux-cmll-text">{alg}</p>
              <div className="roux-cmll-casevis">
                <CaseVisualizer
                  name=""
                  size={100}
                  alg={alg}
                  mask="cmll"
                  color={colorSchemeColors}
                  cubeOptions={{}}
                />
              </div>
            </div>
          )}
        </div>

        <div className="roux-cmll-nextrow">
          <button
            type="button"
            onFocus={(evt) => (evt.target as HTMLButtonElement).blur()}
            className="roux-btn roux-btn-primary roux-cmll-nextbtn"
            onClick={handleNext}
          >
            {t('Next')}
          </button>
        </div>
      </div>

      <hr className="roux-cmll-divider" />
      {panel}
      <hr className="roux-cmll-divider" />

      <div className="roux-cmll-usage">
        {t('Usage: Press space for next case. Enter to redo. / to reveal.')}
      </div>
    </div>
  );
}

export function OllcpTrainerView(props: { state: AppState; dispatch: React.Dispatch<Action> }) {
  const { state, dispatch } = props;
  const { t } = useRT();
  const cube = state.cube.state;
  const cubeTheme = useEffectiveTheme() === 'dark' ? 'dark' : 'bright';

  let facelet = FaceletCube.from_cubie(cube, Mask.solved_mask);

  const use3D = (state.config.cmll2D3DSelector.getActiveName() || '3D') === '3D';
  const kataMode = state.config.cmllKataSelector.getActiveName();

  if (kataMode !== 'off') {
    facelet = FaceletCube.as_kata(facelet);
  }

  const _2d3dSel = 'cmll2D3DSelector';
  const kataSel = 'cmllKataSelector';

  const panel = (
    <div className="roux-cmll-panel">
      <CaseSelectDialog
        {...{
          state,
          dispatch,
          settings: {
            selector: 'ollcpCaseSelector',
            algs: ollcp_algs_raw,
            groups: ['34', '39', '45', '51', '56', '13', '14'],
            visualizeMask: 'coll',
            cubeOptions: {
              colorScheme: {
                0: '#FEFE00', // URFDLB. U = yellow
                1: '#ffa100', // R = o
                2: '#00b800', // F = g
                3: '#404040', // D = w
                4: '#ee0000', // L = r
                5: '#0000f2', // B = blue
              },
            },
          },
          label: 'Select OLLCP Cases',
        }}
      />

      <div className="roux-cmll-visualrow">
        <SingleSelect {...{ state, dispatch, select: _2d3dSel, label: 'Visualize as' }} />
        <SingleSelect
          {...{ state, dispatch, select: kataSel, label: 'Display recog stickers only' }}
        />
      </div>
      <ColorPanel {...{ state, dispatch }} />

      <hr className="roux-cmll-divider" />
    </div>
  );

  React.useEffect(() => {
    setReveal(false); // todo: drive this from props. now there's a delay which causes the answer to leak for a split second
  }, [state]);
  const [reveal, setReveal] = React.useState(false);
  const handleClick = () => {
    setReveal(true);
  };
  const handleNext = () => {
    dispatch({ type: 'key', content: '#space' });
  };

  React.useEffect(() => {
    function downHandler(event: KeyboardEvent) {
      state.keyMapping.handle(event, dispatch);
      // intercept keyboard event for local control
      if (event.key === '/') {
        setReveal(true);
      }
    }
    window.addEventListener('keydown', downHandler);
    return () => {
      window.removeEventListener('keydown', downHandler);
    };
  });

  let alg = '';
  let setup = '';
  if (state.case.desc.length === 4) {
    setup = state.case.desc[3].algs[0];
  }
  if (reveal && state.case.desc.length >= 3) {
    const moves = new MoveSeq(state.case.desc[1].algs[0] + state.case.desc[2].algs[0]);
    const moves_c = moves.collapse();
    if (moves_c.moves.length > 0) {
      if (moves_c.moves[0].name[0] === 'U') {
        alg += '(' + moves_c.moves[0].name + ') ';
        moves_c.moves = moves_c.moves.slice(1);
      }
      alg += moves_c.toString();
    }
  }
  const colorSchemeColors = state.colorScheme.getColorsForOri(state.cube.ori);

  return (
    <div className="roux-cmll">
      <div className="roux-cmll-canvas">
        {use3D ? (
          <CubeSim
            width={400}
            height={350}
            cube={facelet}
            colorScheme={colorSchemeColors}
            theme={cubeTheme}
            facesToReveal={[Face.L]}
          />
        ) : (
          <CubeSim2D
            width={400}
            height={350}
            cube={facelet}
            colorScheme={colorSchemeColors}
            theme={cubeTheme}
          />
        )}
      </div>

      <div className="roux-cmll-card">
        <div className="roux-cmll-grid">
          <div className="roux-cmll-label">{t('Scramble')}</div>
          <div className="roux-cmll-value">
            <p className="roux-cmll-text">{setup}</p>
          </div>

          <div className="roux-cmll-label">{t('Case')}</div>
          {!reveal ? (
            <div className="roux-cmll-showcell">
              <button
                type="button"
                onFocus={(evt) => (evt.target as HTMLButtonElement).blur()}
                className="roux-btn roux-btn-outline roux-cmll-fullbtn"
                onClick={handleClick}
              >
                {t('Show')}
              </button>
            </div>
          ) : (
            <div className="roux-cmll-value">
              <p className="roux-cmll-text">{alg}</p>
              <div className="roux-cmll-casevis">
                <CaseVisualizer
                  name=""
                  size={100}
                  alg={alg}
                  mask="cmll"
                  color={colorSchemeColors}
                  cubeOptions={{}}
                />
              </div>
            </div>
          )}
        </div>

        <div className="roux-cmll-nextrow">
          <button
            type="button"
            onFocus={(evt) => (evt.target as HTMLButtonElement).blur()}
            className="roux-btn roux-btn-primary roux-cmll-nextbtn"
            onClick={handleNext}
          >
            {t('Next')}
          </button>
        </div>
      </div>

      <hr className="roux-cmll-divider" />
      {panel}
      <hr className="roux-cmll-divider" />

      <div className="roux-cmll-usage">
        {t('Usage: Press space for next case. Enter to redo. / to reveal.')}
      </div>
    </div>
  );
}

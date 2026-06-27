'use client';

// Faithful de-MUI port of roux-trainers/src/components/PanoramaView.tsx.
// Upstream rendered an MUI <ImageList> of <VisualCube> images sourced from a
// dead `http://localhost:8000/visualcube.php` PHP endpoint (a leftover dev
// placeholder). The data (a hardcoded ["RUR","RU'R'"] CaseDesc list rendered in
// two identical PanoramaTable grids), the structure, and the props are kept
// verbatim; the broken PHP <img> is swapped for the in-repo CubeSim renderer
// (the available cube renderer — same stage as upstream's stage="f2b"). MUI
// ImageList/ImageListItem → div + CSS grid. props: { state, dispatch }.

import { Dispatch } from 'react';

import CubeSim from './CubeSim';
import { CaseDesc } from '@/lib/roux/Algs';
import { AppState, Action } from '@/lib/roux/Types';
import { CubieCube, FaceletCube, Mask, MoveSeq } from '@/lib/roux/CubeLib';
import { Face } from '@/lib/roux/Defs';
import { useEffectiveTheme } from '@/lib/theme';

import './PanoramaView.css';

function PanoramaCube(props: {
  alg: string;
  colorScheme: string[];
  theme: string;
}) {
  const cube = FaceletCube.from_cubie(
    new CubieCube().apply(new MoveSeq(props.alg)),
    Mask.f2b_mask,
  );
  return (
    <CubeSim
      width={150}
      height={150}
      cube={cube}
      colorScheme={props.colorScheme}
      hintDistance={5}
      theme={props.theme}
      facesToReveal={[Face.L, Face.B, Face.D]}
    />
  );
}

function PanoramaTable(props: { algs: CaseDesc[]; colorScheme: string[]; theme: string }) {
  const { algs, colorScheme, theme } = props;
  return (
    <div className="roux-pano-grid">
      {algs.map((alg) => (
        <div className="roux-pano-item" key={alg.id}>
          <PanoramaCube alg={alg.algs[0]} colorScheme={colorScheme} theme={theme} />
        </div>
      ))}
    </div>
  );
}

export default function PanoramaView(props: { state: AppState; dispatch: Dispatch<Action> }) {
  const { state } = props;
  const theme = useEffectiveTheme() === 'dark' ? 'dark' : 'bright';
  const colorScheme = state.colorScheme.getColorsForOri(state.cube.ori);

  const algs: CaseDesc[] = ['RUR', "RU'R'"].map((str) => ({
    id: str,
    algs: [str],
    kind: 'sb',
  }));

  return (
    <div className="roux-pano-root">
      <div>
        <PanoramaTable algs={algs} colorScheme={colorScheme} theme={theme} />
      </div>
      <div>
        <PanoramaTable algs={algs} colorScheme={colorScheme} theme={theme} />
      </div>
    </div>
  );
}

'use client';

/**
 * Baby FTO uses a compact product-coordinate BFS built on its mathematical
 * equivalence with Skewb Diamond and verified against cubing.js's named
 * Baby FTO model. The kernel accepts all eight faces and solves the state;
 * it neither imports the older Diamond solver nor reverses the input path.
 */
import { useEffect, useState } from 'react';
import { Check, Copy } from '@app-foundation/icons/lucide';
import {
  BABY_FTO_GODS_NUMBER, BABY_FTO_TOTAL_STATES, classifyBabyFtoTokens, solveBabyFto,
} from '@cuberoot/puzzle-solvers/baby-fto';
import AlgPlayer from '@/components/AlgPlayer/AlgPlayer';
import { useCopy } from '@/hooks/useCopy';
import { pooledScramble } from '@/lib/cubing-scramble';
import { tr } from '@/i18n/tr';
import PuzzleSolverPage, {
  type SolverSpec, METRIC_FIXED_OPTIMAL, CAVEAT_TITLE_OPTIMAL, badgeGodsNumber,
} from './_components/PuzzleSolverPage';
import './baby_fto_solver.css';

type BabyFtoSolution = Awaited<ReturnType<typeof solveBabyFto>>;

function BabyFtoPlayback({ result, scramble }: { result: BabyFtoSolution; scramble: string }) {
  const { copied, copy } = useCopy();
  const [view, setView] = useState<'3D' | '2D' | null>(null);
  const [supports3D, setSupports3D] = useState(false);

  useEffect(() => {
    // Check before mounting cubing's player, so a disabled WebGL context
    // uses its SVG player with the same setup, algorithm and step controls.
    const canvas = document.createElement('canvas');
    let available = false;
    try {
      const context = canvas.getContext('webgl2');
      available = context !== null;
      context?.getExtension('WEBGL_lose_context')?.loseContext();
    } catch { /* SVG playback remains available. */ }
    setSupports3D(available);
    setView(available ? '3D' : '2D');
  }, []);

  return (
    <div className="baby-fto-solution">
      <div className="ivy-solbox">{result.solution}</div>
      <div className="baby-fto-solution-tools">
        <button type="button" className="bsp-btn" onClick={() => copy(result.solution)}>
          {copied ? <Check size={15} aria-hidden /> : <Copy size={15} aria-hidden />}
          {tr(copied ? { zh: '已复制', en: 'Copied' } : { zh: '复制解法', en: 'Copy solution' })}
        </button>
        {view && (
          <select className="native-select" value={view}
            aria-label={tr({ zh: '解法播放视图', en: 'Solution playback view' })}
            onChange={event => setView(event.currentTarget.value === '2D' ? '2D' : '3D')}>
            <option value="3D" disabled={!supports3D}>{tr({ zh: '立体', en: '3D' })}</option>
            <option value="2D">{tr({ zh: '平面', en: '2D' })}</option>
          </select>
        )}
      </div>
      {view && (
        <div className="baby-fto-solution-player" aria-label={tr({ zh: '二阶 FTO 解法动画', en: 'Baby FTO solution animation' })}>
          <AlgPlayer puzzle="baby_fto" set="" setup={scramble} alg={result.solution}
            visualization={view} size={260} moveDurationMs={600} />
        </div>
      )}
      {view && !supports3D && (
        <p className="pos-lead">{tr({ zh: '立体显示不可用，已切换到平面播放。', en: '3D is unavailable. Playback is shown in 2D.' })}</p>
      )}
    </div>
  );
}

const SPEC: SolverSpec<BabyFtoSolution> = {
  event: 'baby_fto',
  titleZh: '二阶 FTO 最优求解器',
  titleEn: 'Baby FTO Optimal Solver',
  previewSize: 90,
  invocation: { async: true, solve: solveBabyFto },
  leadText: {
    zh: '每次 120° 面转计 1 步，忽略整体朝向。支持 U、F、R、L、D、B、BR、BL 及其逆转。',
    en: 'Each 120° face turn counts as one move; whole-puzzle orientation is ignored. Supports U, F, R, L, D, B, BR, BL and their inverses.',
  },
  placeholder: {
    zh: "每行一条打乱，如 U R' BR F BL'",
    en: "One scramble per line, e.g. U R' BR F BL'",
  },
  solvingText: { zh: '求解中…', en: 'Solving…' },
  errorNotationText: {
    zh: '无法求解，请检查面转记号',
    en: 'Unable to solve; check the face-turn notation',
  },
  metricLabel: METRIC_FIXED_OPTIMAL,
  badge: badgeGodsNumber(BABY_FTO_GODS_NUMBER),
  caveatTitle: CAVEAT_TITLE_OPTIMAL,
  caveatBody: {
    zh: `忽略整体朝向后共有 ${BABY_FTO_TOTAL_STATES.toLocaleString('en-US')} 个状态，精确距离表保证最短解。以各面颜色还原为目标，不计中心贴纸的自身朝向。逆转和后缀 2 都表示反向 120°，均计 1 步。`,
    en: `There are ${BABY_FTO_TOTAL_STATES.toLocaleString('en-US')} states up to whole-puzzle orientation; exact distances guarantee a shortest solution. The goal is uniform face colors; center-sticker orientation is ignored. A prime or suffix 2 denotes a reverse 120° turn and counts as one move.`,
  },
  validate: line => classifyBabyFtoTokens(line).find(token => token.bad)?.text ?? null,
  randomOne: () => pooledScramble('baby_fto'),
  renderSolution: (result, scramble) => <BabyFtoPlayback key={scramble} result={result} scramble={scramble} />,
};

export default function BabyFtoSolverPage() {
  return <PuzzleSolverPage spec={SPEC} />;
}

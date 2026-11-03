'use client';
import { Check, Copy } from 'lucide-react';
import ReconCaseLink from '@/components/ReconCaseLink';
import { useCopy } from '@/hooks/useCopy';
import { tr } from '@/i18n/tr';
import { COLOR_NAMES, COLOR_RGB, type CubeColor, type RecoveredState } from '@cuberoot/shared/cube-photo/recognize';
import { photoAlgSets, type PhotoAlgResult, type PhotoAlgSet } from '@cuberoot/shared/cube-photo/lookup';
import './cube-photo.css';
const GOALS: Record<PhotoAlgSet, { zh: string; en: string }> = {
  oll: { zh: '完成顶面', en: 'Orient the last layer' },
  ollcp: { zh: '完成顶面与角块', en: 'Solve corners and last-layer orientation' },
  coll: { zh: '完成顶层角块，保持十字', en: 'Solve corners and preserve the oriented cross' },
  '1lll': { zh: '直接复原', en: 'Solve the cube' }, zbll: { zh: '直接复原', en: 'Solve the cube' }, pll: { zh: '复原顶层排列', en: 'Solve the last-layer permutation' },
};

export function Swatch({ color }: { color: CubeColor }) {
  const [r, g, b] = COLOR_RGB[color];
  // Cube sticker colors are media data, independent of page theme.
  return <svg width="17" height="17" viewBox="0 0 17 17" aria-hidden="true"><rect width="17" height="17" rx="3" fill={`rgb(${r},${g},${b})`} /></svg>;
}

export function PhotoStateHeading({ state }: { state: RecoveredState }) {
  const sets = photoAlgSets(state.facelet);
  return <>
    <h2>{sets.includes('pll') ? tr({ zh: '顶面完成 · PLL', en: 'Last layer oriented · PLL' }) : sets.includes('zbll') ? tr({ zh: '顶层十字已完成', en: 'Last-layer cross oriented' }) : sets.length ? tr({ zh: '顶层十字未完成', en: 'Last-layer cross not oriented' }) : tr({ zh: '魔方已复原', en: 'Cube solved' })}</h2>
    <p className="cube-photo-orientation">{(['U', 'F', 'R'] as const).map(face => <span key={face}>{face} <Swatch color={state.frame[face]} />{tr(COLOR_NAMES[state.frame[face]])}</span>)}</p>
    <p className="cube-photo-note">{tr({ zh: 'F 对应照片左侧面，R 对应照片右侧面。', en: 'F is the left face in the photo; R is the right face.' })}</p>
  </>;
}

export default function PhotoAlgorithmCards({sets,results,error=false}:{sets:PhotoAlgSet[];results:Partial<Record<PhotoAlgSet,PhotoAlgResult>>;error?:boolean}) {
  const {copiedKey,copy}=useCopy();
  return <>    {sets.length > 0 && <div className="cube-photo-formulas">
      <p className="cube-photo-note">{tr({ zh: '每条公式独立从照片状态出发，已包含所需 AUF。', en: 'Each formula starts independently from the photo state and includes the required AUF.' })}</p>
      {sets.map(set => {
        const result = results[set], match = result?.match;
        return <article key={set} className="cube-photo-formula" data-site-surface="panel" data-alg-set={set}>
          <div className="cube-photo-formula-heading"><h3>{!match?.name.toLowerCase().startsWith(set) && set.toUpperCase()}{match && <ReconCaseLink href={match.href}>{match.name}</ReconCaseLink>}</h3>
            {match && <button aria-label={tr({ zh: `复制 ${set.toUpperCase()} 公式`, en: `Copy ${set.toUpperCase()} algorithm` })} onClick={() => copy(match.alg, set)}>{copiedKey === set ? <Check size={16} /> : <Copy size={16} />}</button>}
          </div>
          <p className="cube-photo-note">{tr(GOALS[set])}</p>
          {match ? <><code>{match.alg}</code><small><Check size={13} />{tr({ zh: '模拟验证通过', en: 'Simulation verified' })} · {match.turns} STM</small></> : <p className="cube-photo-note">{result?.status === 'error' || error
            ? tr({ zh: '公式库加载失败，请重试。', en: 'Could not load the algorithm library. Retry.' })
            : result?.status === 'missing' ? tr({ zh: '当前公式库中未找到通过验证的公式。', en: 'No verified algorithm found in the current library.' })
              : tr({ zh: '正在检索与验证…', en: 'Finding and verifying an algorithm…' })}</p>}
        </article>;
      })}
    </div>}
</>;
}

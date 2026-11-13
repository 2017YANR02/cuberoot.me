import type { AlgPuzzle } from '@cuberoot/shared/alg';
import { gen, qtm } from '@cuberoot/shared/alg-notation';
import { displayedAlgorithmStm } from '@/lib/alg-metrics';
import { displayAlg } from '@/lib/alg_display';
import { tr } from '@/i18n/tr';

/** Receives the complete selected algorithm, including grouped prefixes. */
export default function AlgInformation({ puzzle, algorithm }: { puzzle: AlgPuzzle; algorithm?: string }) {
  const moves = algorithm ? displayedAlgorithmStm(puzzle, algorithm) : null;
  const quarterTurns = algorithm ? qtm(displayAlg(algorithm)) : null;
  const showQtm = /^[2-7]x[2-7]$/.test(puzzle);
  return <div className="alg-meta-facts alg-information">
    <div className="alg-meta-row"><span className="alg-meta-key">{tr({ zh: '流', en: 'Generators' })}</span>
      <span className="alg-meta-val">{algorithm ? gen(algorithm) || '—' : '—'}</span></div>
    <div className="alg-meta-row"><span className="alg-meta-key">{puzzle === 'sq1' ? tr({ zh: '步数', en: 'Moves' }) : 'STM'}</span>
      <span className="alg-meta-val">{moves ?? '—'}</span></div>
    {showQtm && <div className="alg-meta-row"><span className="alg-meta-key">QTM</span>
      <span className="alg-meta-val">{quarterTurns ?? '—'}</span></div>}
  </div>;
}

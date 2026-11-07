'use client';

import { Check } from '@app-foundation/icons/lucide';
import { pllCommentName } from '@cuberoot/shared/recon/alg-case-display';
import { tr } from '@/i18n/tr';
import './pll-chain-progress.css';

export function PllChainProgress({ order, completed, interrupted }: { order: readonly string[]; completed: number; interrupted: boolean }) {
  return <div className="pll-chain-progress" data-no-timer>
    <ol aria-label={tr({ zh: 'PLL 顺序', en: 'PLL order' })}>
      {order.map((id, i) => <li key={id} className={i < completed ? 'is-complete' : i === completed ? 'is-current' : ''} aria-current={i === completed ? 'step' : undefined}>
        {i < completed && <Check size={12} aria-hidden="true" />}<span>{pllCommentName(id)}</span>
      </li>)}
    </ol>
    <span role="status">{completed} / 21{interrupted && <span className="pll-chain-warning"> · {tr({ zh: '动作不完整', en: 'Incomplete move stream' })}</span>}</span>
  </div>;
}

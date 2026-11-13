'use client';
import type { ReactNode } from 'react';
import type { AssistantAlgorithmCard } from '@cuberoot/shared/site-assistant';
import { CaseThumb } from './CaseThumb';
import ReconCaseLink from './ReconCaseLink';
import { Check, Copy } from '@app-foundation/icons/lucide';
import { useCopy } from '@/hooks/useCopy';
import { Tooltip } from './Tooltip';
import { tr } from '@/i18n/tr';

/** Shared contents for photographed cases and ordinary library replies. */
export function AlgorithmReplyCard({card, display = 'both', title, suffix, thumbnailAlg}: {
  card: Pick<AssistantAlgorithmCard, 'puzzle'|'set'|'name'|'href'|'alg'|'setup'|'sticker'>;
  display?: 'both'|'image'|'text'; title?: ReactNode; suffix?: ReactNode; thumbnailAlg?: string;
}) {
  const {copy, copiedKey} = useCopy();
  return <>
    <div className="cube-photo-formula-heading">
      <ReconCaseLink href={card.href} className="cube-photo-formula-title">
        {display !== 'text' && <CaseThumb local loading="lazy" puzzle={card.puzzle} set={card.set} sticker={card.sticker} alg={thumbnailAlg ?? card.alg} setup={card.setup} size={72} alt={card.name}/>}
        <h3>{title ?? card.name}</h3>
      </ReconCaseLink>
      {display !== 'image' && <Tooltip content={tr({zh:'复制公式',en:'Copy algorithm'})}>{tip => <button {...tip} type="button" className="cube-photo-copy" aria-label={tr({zh:`复制 ${card.name} 公式`,en:`Copy ${card.name} algorithm`})} onClick={()=>copy(card.alg, card.alg)}>{copiedKey===card.alg ? <Check size={16}/> : <Copy size={16}/>}</button>}</Tooltip>}
    </div>
    {display !== 'image' && <div className="cube-photo-sequence"><code>{card.alg}</code>{suffix}</div>}
  </>;
}

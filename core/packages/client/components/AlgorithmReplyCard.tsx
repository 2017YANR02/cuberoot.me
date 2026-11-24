'use client';
import type { ReactNode } from 'react';
import type { AssistantAlgorithmCard } from '@cuberoot/shared/site-assistant';
import { CaseThumb } from './CaseThumb';
import ReconCaseLink from './ReconCaseLink';
import { Check, Copy } from '@app-foundation/icons/lucide';
import { useCopy } from '@/hooks/useCopy';
import { Tooltip } from './Tooltip';
import { tr } from '@/i18n/tr';
import { assistantAlgorithmDiagramOptions } from '@/lib/assistant-algorithms';

/** Shared contents for photographed cases and ordinary library replies. */
export function AlgorithmReplyCard({card, display = 'both', title, suffix, thumbnailAlg, imageLoading = 'lazy', compact = false}: {
  card: Pick<AssistantAlgorithmCard, 'puzzle'|'set'|'name'|'href'|'alg'|'setup'|'sticker'>;
  display?: 'both'|'image'|'text'; title?: ReactNode; suffix?: ReactNode; thumbnailAlg?: string; imageLoading?: 'lazy'|'eager';
  compact?: boolean;
}) {
  const {copy, copiedKey} = useCopy();
  const diagram = display !== 'text' && <CaseThumb local loading={imageLoading}
    puzzle={card.puzzle} set={card.set} sticker={card.sticker} alg={thumbnailAlg ?? card.alg} setup={card.setup}
    {...assistantAlgorithmDiagramOptions(card.puzzle)} size={compact ? 52 : card.puzzle === 'sq1' ? 112 : 72} alt={card.name}/>;
  const copyButton = display !== 'image' && <Tooltip content={tr({zh:'复制公式',en:'Copy algorithm'})}>{tip => <button {...tip} type="button" className="cube-photo-copy"
    aria-label={tr({zh:`复制 ${card.name} 公式`,en:`Copy ${card.name} algorithm`})}
    onClick={() => copy(card.alg, card.alg)}>{copiedKey === card.alg ? <Check size={16}/> : <Copy size={16}/>}</button>}</Tooltip>;
  const sequence = display !== 'image' && <div className="cube-photo-sequence"><code>{card.alg}</code>{suffix}</div>;
  if (compact) return <div className="cfop-formula-summary">
    <ReconCaseLink href={card.href} className="cube-photo-formula-title">{diagram}<strong>{title ?? card.name}</strong></ReconCaseLink>
    {sequence}
    {copyButton}
  </div>;
  return <>
    <div className="cube-photo-formula-heading">
      <ReconCaseLink href={card.href} className="cube-photo-formula-title">
        {diagram}
        <h3>{title ?? card.name}</h3>
      </ReconCaseLink>
      {copyButton}
    </div>
    {sequence}
  </>;
}

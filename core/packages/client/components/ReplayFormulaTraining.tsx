'use client';

import { useEffect, useId, useState, type ReactNode } from 'react';
import type { CfopFormulaFocus, CfopFormulaTarget } from '@cuberoot/timer-ui/reconstruct/cfop-diagnosis';
import AppLink from '@/components/AppLink';
import { AlgorithmReplyCard } from '@/components/AlgorithmReplyCard';
import { CaseThumb } from '@/components/CaseThumb';
import MoreToggle, { MoreTogglePanel } from '@/components/MoreToggle';
import { loadLibrarySource } from '@/lib/alg-library-cache';
import { readPreferredAlgItems } from '@/lib/alg-preferred-algs';
import { replayFormulaCard, replayFormulaTrainingHref } from '@/lib/replay-formula-training';
import { tr } from '@/i18n/tr';
import './cube-photo/cube-photo.css';

type Card = NonNullable<ReturnType<typeof replayFormulaCard>>;

export default function ReplayFormulaTraining({ set, caseName, focus, fallback }: CfopFormulaTarget & { focus: CfopFormulaFocus; fallback: ReactNode }) {
  const [card, setCard] = useState<Card | null>();
  const [revealed, setRevealed] = useState(false);
  const answerId = useId();
  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => { if (active) setCard(null); }, 4000);
    void loadLibrarySource('3x3', set).then(file => {
      if (active) setCard(replayFormulaCard(file, { set, caseName }, readPreferredAlgItems('3x3', set)) ?? null);
    }).catch(() => { if (active) setCard(null); }).finally(() => window.clearTimeout(timer));
    return () => { active = false; window.clearTimeout(timer); };
  }, [set, caseName]);

  if (!card) return <div className="cfop-formula-status"><p className="cfop-note" role="status">{tr(card === undefined
    ? { zh: '正在加载公式卡…', en: 'Loading the algorithm card…' }
    : { zh: '暂时没有这张公式卡，可以先练整个阶段。', en: 'This case card is unavailable. You can practise the full stage.' })}</p>
    {card === null && fallback}
  </div>;

  return <article className="cube-photo-formula cfop-formula" data-site-surface="panel">
    {focus === 'recognition' ? <div className="cfop-formula-prompt">
      <CaseThumb local puzzle={card.puzzle} set={set} sticker={card.sticker} alg={card.alg} setup={card.setup} size={52}
        alt={tr({ zh: '用于识别练习的魔方局面', en: 'Cube position for recognition practice' })}/>
      <MoreToggle expanded={revealed} aria-controls={answerId} onToggle={() => setRevealed(value => !value)} animate={false}>
        {tr(revealed ? { zh: '隐藏答案', en: 'Hide answer' } : { zh: '揭开并核对公式', en: 'Reveal and check the algorithm' })}
      </MoreToggle>
    </div> : <AlgorithmReplyCard card={card} imageLoading="eager" compact/>}
    <AppLink href={replayFormulaTrainingHref(set, card.caseId, focus)} prefetch={false} target="_blank" rel="noopener noreferrer"
      className="rc-action cfop-formula-start">
      {tr({ zh: '开始单 case 训练', en: 'Start single-case practice' })}
    </AppLink>
    {focus === 'recognition' && <MoreTogglePanel expanded={revealed} id={answerId} animate={false} className="cfop-formula-answer">
      <AlgorithmReplyCard card={card} display="text" compact/>
    </MoreTogglePanel>}
  </article>;
}

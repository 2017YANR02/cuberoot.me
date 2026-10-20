'use client';

import { useEffect, useId, useState } from 'react';
import { ChevronDown, ChevronUp, Lightbulb } from 'lucide-react';
import { T, tr } from '@/i18n/tr';
import Link from '@/components/AppLink';
import { F2L_CHAPTERS, type ChapterId, type ChapterTip } from '../data/chapters';


export default function TeachingTips({ stepId }: { stepId: ChapterId }) {
  const tips: readonly ChapterTip[] = F2L_CHAPTERS.find(chapter => chapter.id === stepId)!.tips;
  const [index, setIndex] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const contentId = useId();
  useEffect(() => {
    if (expanded || tips.length < 2) return;
    const timer = window.setInterval(() => setIndex(current => (current + 1) % tips.length), 7000);
    return () => window.clearInterval(timer);
  }, [expanded, tips]);
  if (!tips.length) return null;

  return <aside className="f2l-tips" data-site-surface="panel" aria-label={tr({ zh: '小贴士', en: 'Tips' })}>
    <div className="f2l-tips-header">
      <span className="f2l-tips-title"><Lightbulb size={15} aria-hidden="true" /><T zh="小贴士" en="Tips" /></span>
      <button type="button" className="f2l-tips-expand" aria-expanded={expanded} aria-controls={contentId} onClick={() => setExpanded(current => !current)}>
        {expanded ? <><T zh="收回" en="Collapse" /><ChevronUp size={15} aria-hidden="true" /></> : <><T zh="展开" en="Expand" /><ChevronDown size={15} aria-hidden="true" /></>}
      </button>
    </div>
    <div id={contentId} className={'f2l-tips-viewport' + (expanded ? ' is-expanded' : '')} aria-live="off">
      {tips.map((tip, tipIndex) => <p key={tipIndex} aria-hidden={!expanded && index !== tipIndex}
        className="f2l-tip" style={expanded ? undefined : { transform: `translateY(${(tipIndex - index) * 110}%)`, opacity: index === tipIndex ? 1 : 0 }}>
        {tip.href ? <Link href={tip.href} prefetch={false} tabIndex={!expanded && index !== tipIndex ? -1 : undefined}>{tr(tip)}</Link> : tr(tip)}
      </p>)}
    </div>
  </aside>;
}

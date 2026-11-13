'use client';
import { useEffect, useRef, useState } from 'react';
import type { AssistantAlgorithmCard, AssistantAlgorithms } from '@cuberoot/shared/site-assistant';
import { loadNextAssistantAlgorithm } from '@/lib/assistant-algorithms';
import { AlgorithmReplyCard } from './AlgorithmReplyCard';
import { tr } from '@/i18n/tr';
import './cube-photo/cube-photo.css';
import './assistant-algorithms.css';

export default function AssistantAlgorithmCards({result, onAsk, onChange}: {result:AssistantAlgorithms; onAsk?:(question:string)=>void;
  onChange?:(index:number, expected:AssistantAlgorithmCard, next:AssistantAlgorithmCard)=>void}) {
  const pending = useRef(new Set<number>()), mounted = useRef(true);
  const [status, setStatus] = useState<Record<number, 'loading'|'error'|undefined>>({});
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const another = async (index:number) => {
    const card = result.cards[index];
    if (!onChange || card.caseId === undefined || pending.current.has(index)) return;
    pending.current.add(index); setStatus(s => ({...s, [index]:'loading'}));
    try {
      const next = await loadNextAssistantAlgorithm(card);
      if (mounted.current) { onChange(index, card, next); setStatus(s => ({...s, [index]:undefined})); }
    } catch { if (mounted.current) setStatus(s => ({...s, [index]:'error'})); }
    finally { pending.current.delete(index); }
  };
  const mode = {both:{zh:'状态图和公式',en:'diagrams and algorithms'},image:{zh:'只显示状态图',en:'diagrams only'},text:{zh:'只显示公式文字',en:'algorithm text only'}}[result.display];
  const more = () => onAsk?.(tr({zh:`继续展示 ${result.puzzle} ${result.set} ${result.query ?? ''}，从第 ${(result.nextOffset ?? 0)+1} 个 case 开始，${mode.zh}。`,en:`Continue ${result.puzzle} ${result.set} ${result.query ?? ''}, starting at case ${(result.nextOffset ?? 0)+1}, ${mode.en}.`}));
  return <section className="assistant-algorithms" aria-label={result.title}>
    <h4>{result.title}</h4>
    {!result.cards.length && <p>{tr({zh:'未找到符合条件的公式。',en:'No matching algorithm was found.'})}</p>}
    <div className="cube-photo-formulas">{result.cards.map((card,i)=><article key={`${card.caseId ?? card.name}:${i}`} className="cube-photo-formula" data-site-surface="panel" aria-busy={status[i]==='loading'}>
      <AlgorithmReplyCard card={card} display={result.display}/>
      {card.alternativeCount>1 && result.display!=='image' && <div className="assistant-algorithm-controls">
        <span>{tr({zh:`公式 ${card.alternative+1}/${card.alternativeCount}`,en:`Algorithm ${card.alternative+1}/${card.alternativeCount}`})}</span>
        {onChange && card.caseId!==undefined && <button className="cube-photo-expand" type="button" disabled={status[i]==='loading'} aria-label={tr({zh:`更换 ${card.name} 公式`,en:`Change ${card.name} algorithm`})} onClick={()=>void another(i)}>{tr(status[i]==='loading' ? {zh:'加载中…',en:'Loading…'} : status[i]==='error' ? {zh:'重试',en:'Retry'} : {zh:'换一条公式',en:'Another algorithm'})}</button>}
      </div>}
      {status[i]==='error' && <p className="assistant-algorithm-error" role="status">{tr({zh:'公式加载失败，请重试。',en:'Could not load algorithms. Please retry.'})}</p>}
    </article>)}</div>
    {result.nextOffset!==undefined && <div className="assistant-algorithms-more"><span>{tr({zh:`已展示 ${result.offset+1}–${result.nextOffset} / ${result.total} 个 case`,en:`Cases ${result.offset+1}–${result.nextOffset} of ${result.total}`})}</span>{onAsk && <button type="button" onClick={more}>{tr({zh:'加载更多',en:'Load more'})}</button>}</div>}
  </section>;
}

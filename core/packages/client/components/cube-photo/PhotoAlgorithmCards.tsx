'use client';
import { useId, useState } from 'react';
import { Check, ChevronDown, Copy } from 'lucide-react';
import { AlgorithmReplyCard } from '@/components/AlgorithmReplyCard';
import { useCopy } from '@/hooks/useCopy';
import { tr } from '@/i18n/tr';
import { COLOR_RGB, type CubeColor } from '@cuberoot/shared/cube-photo/recognize';
import { getAlgSetMeta } from '@cuberoot/shared/alg';
import { FOUR_PHOTO_ALG_SETS, POCKET_PHOTO_ALG_SETS } from '@cuberoot/shared/cube-photo/lookup';
import type { PhotoCardMatch, PhotoCardResult } from '@/lib/cube-photo/card-types';
import './cube-photo.css';

export function Swatch({ color }: { color: CubeColor }) {
  const [r, g, b] = COLOR_RGB[color];
  // Cube sticker colors are media data, independent of page theme.
  return <svg width="17" height="17" viewBox="0 0 17 17" aria-hidden="true"><rect width="17" height="17" rx="3" fill={`rgb(${r},${g},${b})`} /></svg>;
}

function alternativesKey(stateKey: string | undefined, match: PhotoCardMatch | undefined): string {
  return stateKey && match?.body ? JSON.stringify([stateKey, match.set, match.caseId ?? match.caseName, match.alg]) : '';
}

export default function PhotoAlgorithmCards({ stateKey, sets, results, error = false }: {
  stateKey?: string; sets: readonly string[]; results: Partial<Record<string, PhotoCardResult>>; error?: boolean;
}) {
  const { copiedKey, copy } = useCopy();
  const id = useId();
  const [expanded, setExpanded] = useState<string | null>(null);

  return sets.length > 0 && <div className="cube-photo-formulas">
      {sets.map(set => {
        const result = results[set], match = result?.match;
        const meta = getAlgSetMeta(match?.puzzle ?? (FOUR_PHOTO_ALG_SETS.some(slug => slug === set) ? '4x4' : POCKET_PHOTO_ALG_SETS.some(slug => slug === set) ? '2x2' : '3x3'), set);
        const label = meta?.short ?? (meta ? tr(meta) : set.toUpperCase());
        const key = alternativesKey(stateKey, match), alternatives = result?.alternatives ?? [];
        const open = !!key && expanded === key;
        const panelId = `${id}-${set}-alternatives`, toggleId = `${panelId}-toggle`;
        return <article key={set} className="cube-photo-formula" data-site-surface="panel" data-alg-set={set}>
          {match ? <AlgorithmReplyCard thumbnailAlg={match.thumbnail?.alg ?? match.body ?? match.alg} card={{puzzle:match.puzzle ?? '3x3', set, name:match.name, href:match.href, alg:match.alg, setup:match.thumbnail?.setup, sticker:match.thumbnail?.sticker ?? {kind:'raw',tag:'',attrs:{}}}} title={<>{!match.name.toLowerCase().startsWith(label.toLowerCase()) && label}<span className="cube-photo-case-name">{match.name}</span></>} suffix={<small>{match.turns} STM</small>}/> : <><h3>{label}</h3><p className="cube-photo-note">{tr(result?.status === 'error' || error ? {zh:'公式库加载失败，请重试。',en:'Could not load the algorithm library. Retry.'} : result?.status === 'missing' ? {zh:'当前公式库中未找到通过验证的公式。',en:'No verified algorithm found in the current library.'} : {zh:'正在检索与验证…',en:'Finding and verifying an algorithm…'})}</p></>}
          {key && alternatives.length > 0 && <>
            <button className="cube-photo-expand" id={toggleId} aria-expanded={open} aria-controls={panelId}
              onClick={() => setExpanded(open ? null : key)}>
              <ChevronDown size={15} />{open ? tr({ zh: '收起', en: 'Collapse' }) : tr({ zh: '展开', en: 'Expand' })}
            </button>
            <div className={`cube-photo-alternatives${open ? ' is-open' : ''}`} id={panelId} role="region" aria-labelledby={toggleId} aria-hidden={!open} inert={!open}>
              <div className="cube-photo-alternatives-inner"><div className="cube-photo-alternatives-content">
                <ul className="cube-photo-alternative-list">{alternatives.map((alternative, index) => {
                    const copyKey = `${set}:${index}`;
                    return <li key={alternative.alg}>
                      <div className="cube-photo-sequence"><code>{alternative.alg}</code><small>{alternative.turns} STM</small></div>
                      <button className="cube-photo-copy" aria-label={tr({ zh: `复制 ${label} 其他公式 ${index + 1}`, en: `Copy ${label} alternative ${index + 1}` })} onClick={() => copy(alternative.alg, copyKey)}>
                        {copiedKey === copyKey ? <Check size={16} /> : <Copy size={16} />}
                      </button>
                    </li>;
                  })}</ul>
              </div></div>
            </div>
          </>}
        </article>;
      })}
    </div>;
}

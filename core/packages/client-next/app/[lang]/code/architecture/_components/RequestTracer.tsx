'use client';

import { useState } from 'react';
import { useLang } from '../../_lib/Lang';
import { TRACER_PATTERNS, TRACER_STAGES } from '../_lib/arch-data';
import type { StageId } from '../_lib/arch-data';
import i18n from '@/i18n/i18n-client';

export default function RequestTracer() {
  const lang = useLang();
  const [pid, setPid] = useState<string>(TRACER_PATTERNS[0].id);
  const p = TRACER_PATTERNS.find(x => x.id === pid)!;
  const lit = new Set<StageId>(p.lit);
  const txt = (i18n.language === 'zh-Hant' ? (p.zhHant ?? p.zh) : (i18n.language.startsWith('zh') ? p.zh : p.en));
  return (
    <div className="tracer">
      <div className="tracer-tabs" role="tablist">
        {TRACER_PATTERNS.map((pat) => {
          const t = (i18n.language === 'zh-Hant' ? (pat.zhHant ?? pat.zh) : (i18n.language.startsWith('zh') ? pat.zh : pat.en));
          const active = pid === pat.id;
          return (
            <button
              key={pat.id}
              type="button"
              role="tab"
              aria-selected={active}
              className={`tracer-tab${active ? ' active' : ''}`}
              onClick={() => setPid(pat.id)}
            >
              <span className="tracer-tab-label">{t.label}</span>
              <span className="tracer-tab-route">{pat.route}</span>
            </button>
          );
        })}
      </div>
      <ol className="tracer-flow">
        {TRACER_STAGES.map((s, i) => {
          const isLit = lit.has(s.id);
          const isHit = p.cacheHit && s.id === 'api';
          const litList = p.lit;
          const isFinal = isLit && s.id === litList[litList.length - 1];
          const st = (i18n.language === 'zh-Hant' ? (s.zhHant ?? s.zh) : (i18n.language.startsWith('zh') ? s.zh : s.en));
          return (
            <li key={s.id} className={`tracer-stage${isLit ? ' lit' : ''}${isHit ? ' hit' : ''}${isFinal ? ' final' : ''}`}>
              <div className="tracer-stage-num">{String(i + 1).padStart(2, '0')}</div>
              <div className="tracer-stage-name">{st}</div>
              <div className="tracer-stage-sub">{s.sub}</div>
              {isHit && <div className="tracer-stage-badge">CACHE HIT</div>}
              {isFinal && !isHit && <div className="tracer-stage-badge tracer-stage-badge-end">RETURN</div>}
            </li>
          );
        })}
      </ol>
      <div className="tracer-meta">
        <span className="tracer-eta">{p.eta}</span>
      </div>
      <p className="tracer-detail">{txt.detail}</p>
    </div>
  );
}

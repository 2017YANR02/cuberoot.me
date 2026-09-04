'use client';

import { useMemo, useState } from 'react';
import type { Lang } from '../../_lib/Lang';
import {
  ARCHITECTURE_EDGES,
  ARCHITECTURE_LANES,
  ARCHITECTURE_NODES,
} from '../_lib/architecture-map';

export default function ArchitectureAtlas({ lang }: { lang: Lang }) {
  const [selectedId, setSelectedId] = useState('web');
  const ui = {
    zh: { request: '在线请求', capability: '共享能力', artifact: '生成物', source: '源码位置', terms: '这里用到的术语' },
    en: { request: 'Request', capability: 'Capability', artifact: 'Artifact', source: 'Source', terms: 'Terms used here' },
  }[lang];
  const selected = ARCHITECTURE_NODES.find((node) => node.id === selectedId) ?? ARCHITECTURE_NODES[0];
  const connectedIds = useMemo(() => {
    const ids = new Set([selected.id]);
    for (const edge of ARCHITECTURE_EDGES) {
      if (edge.from === selected.id) ids.add(edge.to);
      if (edge.to === selected.id) ids.add(edge.from);
    }
    return ids;
  }, [selected.id]);

  return (
    <div className="architecture-atlas">
      <div className="architecture-atlas__stage">
        <div className="architecture-atlas__lanes" aria-hidden="true">
          {ARCHITECTURE_LANES.map((lane) => (
            <span key={lane.id}>{lane.label[lang]}</span>
          ))}
        </div>

        <svg className="architecture-atlas__edges" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            {(['request', 'capability', 'artifact'] as const).map((kind) => (
              <marker key={kind} id={`atlas-arrow-${kind}`} markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto">
                <path d="M0,0 L5,2.5 L0,5 z" />
              </marker>
            ))}
          </defs>
          {ARCHITECTURE_EDGES.map((edge) => {
            const from = ARCHITECTURE_NODES.find((node) => node.id === edge.from);
            const to = ARCHITECTURE_NODES.find((node) => node.id === edge.to);
            if (!from || !to) return null;
            const active = edge.from === selected.id || edge.to === selected.id;
            return (
              <line
                key={`${edge.from}-${edge.to}`}
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                className={`architecture-atlas__edge architecture-atlas__edge--${edge.kind}${active ? ' is-active' : ''}`}
                markerEnd={`url(#atlas-arrow-${edge.kind})`}
                vectorEffect="non-scaling-stroke"
              />
            );
          })}
        </svg>

        <div className="architecture-atlas__nodes">
          {ARCHITECTURE_NODES.map((node) => (
            <button
              key={node.id}
              type="button"
              className={`architecture-atlas__node${node.id === selected.id ? ' is-selected' : ''}${connectedIds.has(node.id) ? ' is-connected' : ''}`}
              style={{ left: `${node.x}%`, top: `${node.y}%` }}
              aria-pressed={node.id === selected.id}
              onClick={() => setSelectedId(node.id)}
            >
              <span className="architecture-atlas__node-code">{node.eyebrow}</span>
              <strong>{node.label[lang]}</strong>
              <span>{node.terms.map((term) => term.name).join(' / ')}</span>
            </button>
          ))}
        </div>

        <div className="architecture-atlas__legend">
          <span><i className="is-request" />{ui.request}</span>
          <span><i className="is-capability" />{ui.capability}</span>
          <span><i className="is-artifact" />{ui.artifact}</span>
        </div>
      </div>

      <aside className="architecture-atlas__detail" aria-live="polite">
        <div className="architecture-atlas__detail-kicker">{selected.eyebrow}</div>
        <h2>{selected.label[lang]}</h2>
        <p>{selected[lang]}</p>

        {selected.sourcePaths.length > 0 && (
          <div className="architecture-atlas__source">
            <h3>{ui.source}</h3>
            {selected.sourcePaths.map((path) => <code key={path}>{path}</code>)}
          </div>
        )}

        <div className="architecture-atlas__terms">
          <h3>{ui.terms}</h3>
          {selected.terms.map((term) => (
            <section key={term.name}>
              <div><strong>{term.name}</strong><span>{term.fullName}</span></div>
              <p>{term[lang]}</p>
            </section>
          ))}
        </div>
      </aside>
    </div>
  );
}

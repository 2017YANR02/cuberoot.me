'use client';

import { useId } from 'react';
import { VisualCube } from '@/components/VisualCube';
import { tr } from '@/i18n/tr';
import '../lessons/flowchart.css';

export interface CaseFlowNode {
  name: string; x: number; y: number; facelets: string;
  selected?: boolean; current?: boolean; visited?: boolean; receiving?: boolean;
  onSelect?: () => void;
}
export interface CaseFlowEdge {
  from: string; to: string; d: string;
  selected?: boolean; complete?: boolean; current?: boolean; moving?: boolean; progress?: number;
  onSelect?: () => void;
}
export const flowLabel = (name: string) => name === 'solved' ? tr({ zh: '还原', en: 'Solved' }) : name;

/** One renderer for the lesson-10 playback and the live practice state graph. */
export default function CaseFlowGraph({ nodes, edges, viewBox }: {
  nodes: CaseFlowNode[]; edges: CaseFlowEdge[]; viewBox: string;
}) {
  const markerId = useId().replace(/:/g, '');
  return <svg viewBox={viewBox} role="group" aria-label={tr({ zh: '转化路径', en: 'Transformation paths' })}>
    {edges.map((edge, index) => <g key={`${edge.from}:${edge.to}`}
      className={`f2l-flow-edge${edge.selected ? ' is-selected' : ''}${edge.complete ? ' is-complete' : ''}${edge.current ? ' is-current' : ''}${edge.moving ? ' is-moving' : ''}`}
      data-interactive={!!edge.onSelect} role={edge.onSelect ? 'button' : undefined} tabIndex={edge.onSelect ? 0 : undefined}
      aria-pressed={edge.onSelect ? !!edge.selected : undefined}
      aria-label={edge.onSelect ? tr({ zh: `选择经过 ${flowLabel(edge.from)} → ${flowLabel(edge.to)} 的还原路径`, en: `Choose a solution path through ${flowLabel(edge.from)} → ${flowLabel(edge.to)}` }) : undefined}
      onClick={edge.onSelect} onKeyDown={edge.onSelect ? event => {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); edge.onSelect!(); }
      } : undefined}>
      <defs><marker id={`${markerId}-${index}`} viewBox="0 0 10 10" refX="8" refY="5"
        markerWidth="11" markerHeight="11" markerUnits="userSpaceOnUse" orient="auto">
        <path className="f2l-flow-arrow" d="M 2 1 L 8 5 L 2 9" />
      </marker></defs>
      <path className="f2l-flow-edge-line" d={edge.d} markerEnd={`url(#${markerId}-${index})`} />
      {edge.current && <path className="f2l-flow-glow" d={edge.d} pathLength="1" strokeDasharray={`${edge.progress ?? 0} 1`} />}
      {edge.selected && <path className="f2l-flow-progress" d={edge.d} pathLength="1" strokeDasharray={`${edge.progress ?? 0} 1`} />}
      {edge.current && <circle className="f2l-flow-pulse" r="4.5"
        style={{ offsetPath: `path('${edge.d}')`, offsetDistance: `${(edge.progress ?? 0) * 100}%` }} />}
      {edge.onSelect && <path className="f2l-flow-edge-hit" d={edge.d} />}
    </g>)}
    {nodes.map(node => {
      const className = `f2l-flow-node${node.selected ? ' is-selected' : ''}${node.visited ? ' is-visited' : ''}${node.receiving ? ' is-receiving' : ''}`;
      const content = <><VisualCube local view="iso" size={68} faceletColors={node.facelets} alt="" /><span>{flowLabel(node.name)}</span></>;
      return <foreignObject key={node.name} x={node.x - 45} y={node.y} width="90" height="106">
        {node.onSelect ? <button type="button" className={className} onClick={node.onSelect}
          aria-current={node.current ? 'step' : undefined}
          aria-label={tr({ zh: `查看 ${flowLabel(node.name)} 状态`, en: `View ${flowLabel(node.name)} state` })}>{content}</button>
          : <div className={className} data-interactive="false" aria-current={node.current ? 'step' : undefined}>{content}</div>}
      </foreignObject>;
    })}
  </svg>;
}

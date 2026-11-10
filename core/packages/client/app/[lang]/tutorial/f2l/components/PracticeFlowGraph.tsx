'use client';

import { useMemo } from 'react';
import { stickeringMaskFn } from '@cuberoot/puzzle-render-core/engine/nxn/stickering';
import { tr } from '@/i18n/tr';
import { f2lDiagramFacelets } from '../lib/cube-preview';
import { flowEdgeId, type PracticeFlow, type FlowProgress, type PracticeFlowRoute } from '../lib/practice-flow';
import CaseFlowGraph from './CaseFlowGraph';

const mask = stickeringMaskFn(3, 'F2LOverview')!;

export default function PracticeFlowGraph({ flow, progress, orientation, selectedRoute, onSelectEdge }: {
  flow: PracticeFlow; progress: FlowProgress; orientation: string;
  selectedRoute?: PracticeFlowRoute; onSelectEdge?: (id: string) => void;
}) {
  const layout = useMemo(() => {
    const depths = new Map<string, number>([[flow.name, 0]]);
    const queue = [flow.name];
    for (let i = 0; i < queue.length; i++) {
      for (const edge of flow.edges.filter(edge => edge.from === queue[i] && edge.to !== 'solved')) {
        if (depths.has(edge.to)) continue;
        depths.set(edge.to, depths.get(edge.from)! + 1);
        queue.push(edge.to);
      }
    }
    // Prefer successive stages on successive rows. Shortcuts must not pull a
    // three-step case up beside the cases that lead into it.
    const stageEdges = flow.edges.filter(edge => edge.to !== 'solved' && edge.to !== flow.name);
    const incoming = new Map([...depths.keys()].map(name => [name, stageEdges.filter(edge => edge.to === name).length]));
    const ordered = [...incoming.keys()].filter(name => incoming.get(name) === 0);
    const stages = new Map<string, number>([[flow.name, 0]]);
    for (let i = 0; i < ordered.length; i++) for (const edge of stageEdges.filter(edge => edge.from === ordered[i])) {
      stages.set(edge.to, Math.max(stages.get(edge.to) ?? 0, (stages.get(edge.from) ?? 0) + 1));
      incoming.set(edge.to, incoming.get(edge.to)! - 1);
      if (incoming.get(edge.to) === 0) ordered.push(edge.to);
    }
    if (ordered.length === depths.size) for (const [name, depth] of stages) depths.set(name, depth);
    const rows: typeof flow.nodes[] = [];
    for (let depth = 0; depth <= Math.max(...depths.values()); depth++) {
      const group = flow.nodes.filter(node => depths.get(node.name) === depth);
      for (let i = 0; i < group.length; i += 3) rows.push(group.slice(i, i + 3));
    }
    rows.push(flow.nodes.filter(node => node.name === 'solved'));
    const nodes = rows.flatMap((row, i) => row.map((node, j) => ({
      ...node, x: 260 + (j - (row.length - 1) / 2) * 140, y: i * 150,
      facelets: f2lDiagramFacelets(node.setup, orientation, mask),
    })));
    const edges = flow.edges.map((edge, i) => {
      const from = nodes.find(node => node.name === edge.from)!;
      const to = nodes.find(node => node.name === edge.to)!;
      let d: string;
      if (to.y === from.y + 150) {
        d = `M ${from.x} ${from.y + 108} C ${from.x} ${from.y + 130} ${to.x} ${to.y - 24} ${to.x} ${to.y - 4}`;
      } else {
        // Bypass and return edges run outside the rows instead of through cubes.
        const side = i % 2 ? 1 : -1;
        const lane = side > 0 ? 500 - (i % 4) * 8 : 20 + (i % 4) * 8;
        d = `M ${from.x + side * 47} ${from.y + 53} C ${lane} ${from.y + 53} ${lane} ${to.y + 53} ${to.x + side * 49} ${to.y + 53}`;
      }
      return { ...edge, d };
    });
    return { nodes, edges, viewBox: `0 -8 520 ${Math.max(1, rows.length - 1) * 150 + 122}` };
  }, [flow, orientation]);
  const selectedEdges = selectedRoute ? new Set(selectedRoute.points.slice(1).map((point, i) => flowEdgeId(selectedRoute.points[i].name, point.name))) : undefined;
  return <div className="f2l-flow-graph f2l-practice-flow" aria-label={tr({ zh: '练习转化路径', en: 'Practice transformation paths' })}>
    <CaseFlowGraph viewBox={layout.viewBox}
      nodes={layout.nodes.map(node => ({ ...node, selected: true, current: progress.current === node.name,
        visited: progress.visitedNodes.has(node.name), receiving: layout.edges.some(edge => edge.to === node.name && progress.edges.has(edge.id)) }))}
      edges={layout.edges.map(edge => ({ ...edge, selected: selectedEdges ? selectedEdges.has(edge.id) : progress.edges.has(edge.id) || progress.visitedEdges.has(edge.id),
        onSelect: onSelectEdge ? () => onSelectEdge(edge.id) : undefined,
        complete: progress.visitedEdges.has(edge.id), current: progress.edges.has(edge.id), progress: progress.edges.get(edge.id) ?? (progress.visitedEdges.has(edge.id) ? 1 : 0) }))} />
  </div>;
}

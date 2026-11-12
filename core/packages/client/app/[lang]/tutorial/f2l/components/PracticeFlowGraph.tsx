'use client';

import { useMemo } from 'react';
import { stickeringMaskFn } from '@cuberoot/puzzle-render-core/engine/nxn/stickering';
import { tr } from '@/i18n/tr';
import { f2lDiagramFacelets } from '../lib/cube-preview';
import { flowEdgeId, type PracticeFlow, type FlowProgress, type PracticeFlowRoute } from '../lib/practice-flow';
import CaseFlowGraph from './CaseFlowGraph';

const mask = stickeringMaskFn(3, 'F2LOverview')!;

type Point = { x: number; y: number };

/** Prefer the original broad Bezier arcs whenever they clear the node cards. */
function clearCurve(points: Point[], nodes: Point[]): boolean {
  for (let i = 0; i <= 128; i++) {
    const t = i / 128, u = 1 - t;
    const x = u ** 3 * points[0].x + 3 * u ** 2 * t * points[1].x + 3 * u * t ** 2 * points[2].x + t ** 3 * points[3].x;
    const y = u ** 3 * points[0].y + 3 * u ** 2 * t * points[1].y + 3 * u * t ** 2 * points[2].y + t ** 3 * points[3].y;
    if (nodes.some(node => x > node.x - 46.5 && x < node.x + 46.5 && y > node.y - 1.5 && y < node.y + 107.5)) return false;
  }
  return true;
}

/** Only obstructed arcs need waypoints through the space between rows. */
function roundedPath(points: { x: number; y: number }[]): string {
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length - 1; i++) {
    const previous = points[i - 1], point = points[i], next = points[i + 1];
    const before = Math.hypot(point.x - previous.x, point.y - previous.y);
    const after = Math.hypot(next.x - point.x, next.y - point.y);
    const radius = Math.min(48, before / 2, after / 2);
    if (!radius) continue;
    d += ` L ${point.x + (previous.x - point.x) * radius / before} ${point.y + (previous.y - point.y) * radius / before}`;
    d += ` Q ${point.x} ${point.y} ${point.x + (next.x - point.x) * radius / after} ${point.y + (next.y - point.y) * radius / after}`;
  }
  const end = points[points.length - 1];
  return `${d} L ${end.x} ${end.y}`;
}

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
    const lanes = { left: 0, right: 0 };
    const edges = flow.edges.map(edge => {
      const from = nodes.find(node => node.name === edge.from)!;
      const to = nodes.find(node => node.name === edge.to)!;
      let d: string;
      if (to.y === from.y + 150) {
        d = `M ${from.x} ${from.y + 108} C ${from.x} ${from.y + 130} ${to.x} ${to.y - 24} ${to.x} ${to.y - 4}`;
      } else {
        // Use the nearer outside corridor. A middle node must first leave its
        // row through the gap below it; a side exit would cross its neighbour.
        const side = from.x + to.x === 520 ? (lanes.left <= lanes.right ? -1 : 1) : (from.x + to.x < 520 ? -1 : 1);
        const laneIndex = lanes[side < 0 ? 'left' : 'right']++;
        const lane = side < 0 ? 20 + (laneIndex % 3) * 12 : 500 - (laneIndex % 3) * 12;
        const outside = (node: typeof from) => !nodes.some(other => other.y === node.y && (other.x - node.x) * side > 0);
        const exit = outside(from)
          ? [{ x: from.x + side * 47, y: from.y + 53 }, { x: lane, y: from.y + 53 }]
          : [{ x: from.x, y: from.y + 108 }, { x: from.x, y: from.y + 128 }, { x: lane, y: from.y + 128 }];
        const entry = outside(to)
          ? [{ x: lane, y: to.y + 53 }, { x: to.x + side * 49, y: to.y + 53 }]
          : [{ x: lane, y: to.y - 22 }, { x: to.x, y: to.y - 22 }, { x: to.x, y: to.y - 4 }];
        d = roundedPath([...exit, ...entry]);
        for (const curveSide of [side, -side]) {
          const curveLane = curveSide < 0 ? 20 : 500;
          const points = [
            { x: from.x + curveSide * 47, y: from.y + 53 },
            { x: curveLane, y: from.y + 53 },
            { x: curveLane, y: to.y + 53 },
            { x: to.x + curveSide * 49, y: to.y + 53 },
          ];
          if (!clearCurve(points, nodes)) continue;
          d = `M ${points[0].x} ${points[0].y} C ${points.slice(1).map(point => `${point.x} ${point.y}`).join(' ')}`;
          break;
        }
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

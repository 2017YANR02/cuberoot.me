'use client';

import {
  MousePointer2,
  Square,
  Squircle,
  Circle,
  Slash,
  Hexagon,
  Star,
  PenTool,
  Pencil,
  Type,
  Pipette,
  Hand,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { tr } from '@/i18n/tr';
import type { ToolId } from '../_lib/types';
import { usePaint } from '../_lib/store';

interface ToolDef {
  id: ToolId;
  icon: LucideIcon;
  label: { zh: string; en: string };
  key?: string;
  stub?: boolean;
}

// Functional tools (Phase 1) come first; stubs marked with a dot.
const TOOLS: ToolDef[] = [
  { id: 'select', icon: MousePointer2, label: { zh: '选择', en: 'Select' }, key: 'V' },
  { id: 'rect', icon: Square, label: { zh: '矩形', en: 'Rectangle' }, key: 'R' },
  { id: 'roundRect', icon: Squircle, label: { zh: '圆角矩形', en: 'Rounded rect' }, key: 'U' },
  { id: 'ellipse', icon: Circle, label: { zh: '椭圆', en: 'Ellipse' }, key: 'O' },
  { id: 'line', icon: Slash, label: { zh: '直线', en: 'Line' }, key: 'L' },
  { id: 'polygon', icon: Hexagon, label: { zh: '多边形', en: 'Polygon' }, key: 'G' },
  { id: 'star', icon: Star, label: { zh: '星形', en: 'Star' }, key: 'S' },
  { id: 'pen', icon: PenTool, label: { zh: '钢笔', en: 'Pen' }, key: 'P' },
  { id: 'pencil', icon: Pencil, label: { zh: '铅笔', en: 'Pencil' }, key: 'N' },
  { id: 'text', icon: Type, label: { zh: '文本', en: 'Text' }, key: 'T' },
  { id: 'eyedropper', icon: Pipette, label: { zh: '取色', en: 'Eyedropper' }, key: 'I' },
  { id: 'hand', icon: Hand, label: { zh: '抓手', en: 'Pan' }, key: 'H' },
];

export default function Toolbar() {
  const tool = usePaint((s) => s.tool);
  const setTool = usePaint((s) => s.setTool);

  return (
    <div className="paint-toolbar" role="toolbar" aria-label={tr({ zh: '工具', en: 'Tools' })}>
      {TOOLS.map((t) => {
        const Icon = t.icon;
        const active = tool === t.id;
        const title = `${tr(t.label)}${t.key ? `  (${t.key})` : ''}${
          t.stub ? `  · ${tr({ zh: '即将推出', en: 'coming soon' })}` : ''
        }`;
        return (
          <button
            key={t.id}
            type="button"
            className={`paint-tool${active ? ' is-active' : ''}${t.stub ? ' is-stub' : ''}`}
            title={title}
            aria-label={tr(t.label)}
            aria-pressed={active}
            onClick={() => setTool(t.id)}
          >
            <Icon size={18} strokeWidth={1.8} />
          </button>
        );
      })}
    </div>
  );
}

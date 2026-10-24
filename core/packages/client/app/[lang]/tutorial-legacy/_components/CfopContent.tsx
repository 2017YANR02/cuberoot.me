/**
 * CfopContent — 渲染 restructureCfop 产出的分节 HTML。
 * 在 TutorialContent 的基础上多认一种节点:带 data-icon 的 <h2 class="cfop-sec-head">
 * → 渲染成 lucide 图标 + 中/英标题。其余(chip / 图片 /stats 改源 / 内站链接)同 TutorialContent。
 */
import parse, { domToReact } from 'html-react-parser';
import DOMPurify from 'dompurify';
import {
  RotateCw, Hand, Shuffle, BookOpen, Globe, Zap, Layers,
  Plus, Compass, Box, Boxes, Crown, Brain,
} from '@app-foundation/icons/lucide';
import { createTutorialContentOptions } from './tutorial-content-parser';
import type { CfopIcon } from '../_lib/restructureCfop';

const SANITIZE_CONFIG = {
  ADD_TAGS: ['span', 'u', 's', 'em', 'strong', 'sub', 'sup', 'section', 'h2'],
  ADD_ATTR: ['data-alg', 'data-see-also', 'data-icon', 'loading', 'decoding'],
};

const ICONS: Record<CfopIcon, React.ComponentType<{ className?: string }>> = {
  rotate: RotateCw,
  hand: Hand,
  shuffle: Shuffle,
  book: BookOpen,
  globe: Globe,
  zap: Zap,
  layers: Layers,
  cross: Plus,
  compass: Compass,
  f2l: Box,
  boxes: Boxes,
  crown: Crown,
  brain: Brain,
};

export function CfopContent({ html }: { html: string }) {
  const clean = DOMPurify.sanitize(html, SANITIZE_CONFIG);

  const options = createTutorialContentOptions((el, options) => {
    // 分节标题
    if (el.name === 'h2' && el.attribs?.class?.includes('cfop-sec-head')) {
      const iconKey = (el.attribs['data-icon'] as CfopIcon) || 'layers';
      const Icon = ICONS[iconKey] ?? Layers;
      return (
        <h2 className="cfop-sec-head" data-icon={iconKey}>
          <span className="cfop-sec-ic" aria-hidden>
            <Icon className="cfop-sec-ic-svg" />
          </span>
          {domToReact(el.children, options)}
        </h2>
      );
    }
    return undefined;
  });

  return <div className="tutorial-content cfop-content">{parse(clean, options)}</div>;
}

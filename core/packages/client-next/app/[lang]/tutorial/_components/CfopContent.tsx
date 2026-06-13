/**
 * CfopContent — 渲染 restructureCfop 产出的分节 HTML。
 * 在 TutorialContent 的基础上多认一种节点:带 data-icon 的 <h2 class="cfop-sec-head">
 * → 渲染成 lucide 图标 + 中/英标题。其余(chip / 图片 /stats 改源 / 内站链接)同 TutorialContent。
 */
import parse, {
  domToReact,
  type HTMLReactParserOptions,
  type DOMNode,
} from 'html-react-parser';
import DOMPurify from 'dompurify';
import {
  RotateCw, Hand, Shuffle, BookOpen, Globe, Zap, Layers,
  Plus, Compass, Box, Boxes, Crown, Brain,
} from 'lucide-react';
import Link from '@/components/AppLink';
import { AlgChip } from './AlgChip';
import { tutorialMediaUrl } from '../_lib/useTutorialCatalog';
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

function serializeChipChildren(children: DOMNode[]): string {
  return children
    .map((c: any) => {
      if (c.type === 'text') return c.data ?? '';
      if (c.type !== 'tag') return '';
      const tag = String(c.name ?? '').toLowerCase();
      const inner = serializeChipChildren(c.children ?? []);
      if (['u', 's', 'em', 'strong', 'sub', 'sup', 'i', 'b'].includes(tag)) {
        return `<${tag}>${inner}</${tag}>`;
      }
      return inner;
    })
    .join('');
}

export function CfopContent({ html }: { html: string }) {
  const clean = DOMPurify.sanitize(html, SANITIZE_CONFIG);

  const options: HTMLReactParserOptions = {
    replace: node => {
      if (node.type !== 'tag') return;
      const el = node as unknown as {
        name: string;
        attribs: Record<string, string>;
        children: DOMNode[];
      };

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

      // alg chip
      if (el.name === 'span' && el.attribs?.class?.includes('tutorial-chip')) {
        const alg = el.attribs['data-alg'] ?? '';
        if (alg) {
          const inner = serializeChipChildren(el.children);
          const algHtml = /<[a-z]+>/i.test(inner) ? inner : undefined;
          return <AlgChip alg={alg} algHtml={algHtml} />;
        }
      }

      // 图片 /stats/… → static origin
      if (el.name === 'img' && el.attribs?.src?.startsWith('/stats/')) {
        el.attribs.src = tutorialMediaUrl(el.attribs.src);
        return undefined;
      }

      // 内站链接 /tutorial/... → Next Link
      if (el.name === 'a') {
        const href = el.attribs.href ?? '';
        if (href.startsWith('/tutorial/')) {
          return (
            <Link href={href} className={el.attribs.class}>
              {domToReact(el.children, options)}
            </Link>
          );
        }
      }
      return undefined;
    },
  };

  return <div className="tutorial-content cfop-content">{parse(clean, options)}</div>;
}

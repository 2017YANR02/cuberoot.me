/**
 * TutorialContent — 从 build pipeline 生成的 article HTML 渲染 React
 * - DOMPurify 清洗（build pipeline 是可信来源，但加一层保险）
 * - html-react-parser 解析，在 <span class="tutorial-chip"> 位置注入 AlgChip
 * - <a href="/tutorial/..."> 被替换成 Next Link（SPA 导航）
 */
import parse, {
  domToReact,
  type HTMLReactParserOptions,
  type DOMNode,
} from 'html-react-parser';
import DOMPurify from 'dompurify';
import Link from 'next/link';
import { AlgChip } from './AlgChip';

interface TutorialContentProps {
  html: string;
}

const SANITIZE_CONFIG = {
  ADD_TAGS: ['span', 'u', 's', 'em', 'strong', 'sub', 'sup'],
  ADD_ATTR: ['data-alg', 'data-see-also', 'loading', 'decoding'],
};

/** 把 chip span 的子节点序列化成 markup 字符串(用于传给 AlgChip 的 algHtml) */
function serializeChipChildren(children: DOMNode[]): string {
  return children
    .map((c: any) => {
      if (c.type === 'text') return c.data ?? '';
      if (c.type !== 'tag') return '';
      const tag = String(c.name ?? '').toLowerCase();
      const inner = serializeChipChildren(c.children ?? []);
      // Only known safe tags pass through; others unwrap
      if (['u', 's', 'em', 'strong', 'sub', 'sup', 'i', 'b'].includes(tag)) {
        return `<${tag}>${inner}</${tag}>`;
      }
      return inner;
    })
    .join('');
}

export function TutorialContent({ html }: TutorialContentProps) {
  const clean = DOMPurify.sanitize(html, SANITIZE_CONFIG);

  const options: HTMLReactParserOptions = {
    replace: node => {
      if (node.type !== 'tag') return;
      const el = node as unknown as {
        name: string;
        attribs: Record<string, string>;
        children: DOMNode[];
      };

      // alg chip
      if (el.name === 'span' && el.attribs?.class?.includes('tutorial-chip')) {
        const alg = el.attribs['data-alg'] ?? '';
        if (alg) {
          const inner = serializeChipChildren(el.children);
          // 只有当 chip 内部含 markup 标签时才传 algHtml
          const algHtml = /<[a-z]+>/i.test(inner) ? inner : undefined;
          return <AlgChip alg={alg} algHtml={algHtml} />;
        }
      }

      // 内站链接 /tutorial/... → Next Link
      if (el.name === 'a') {
        const href = el.attribs.href ?? '';
        if (href.startsWith('/tutorial/')) {
          const className = el.attribs.class;
          return (
            <Link href={href} className={className}>
              {domToReact(el.children, options)}
            </Link>
          );
        }
      }
      return undefined;
    },
  };

  return <div className="tutorial-content">{parse(clean, options)}</div>;
}

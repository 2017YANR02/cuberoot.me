/**
 * TutorialContent — 从 build pipeline 生成的 article HTML 渲染 React
 * - DOMPurify 清洗（build pipeline 是可信来源，但加一层保险）
 * - html-react-parser 解析，在 <span class="tutorial-chip"> 位置注入 AlgChip
 * - <a href="/tutorial/..."> 被替换成 React Router Link（SPA 导航）
 */
import parse, {
  domToReact,
  type HTMLReactParserOptions,
  type DOMNode,
} from 'html-react-parser';
import DOMPurify from 'dompurify';
import { Link } from 'react-router-dom';
import { AlgChip } from './AlgChip';

interface TutorialContentProps {
  html: string;
}

const SANITIZE_CONFIG = {
  ADD_TAGS: ['span'],
  ADD_ATTR: ['data-alg', 'data-see-also', 'loading', 'decoding'],
};

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
        if (alg) return <AlgChip alg={alg} />;
      }

      // 内站链接 /tutorial/... → React Router Link
      if (el.name === 'a') {
        const href = el.attribs.href ?? '';
        if (href.startsWith('/tutorial/')) {
          const className = el.attribs.class;
          return (
            <Link to={href} className={className}>
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

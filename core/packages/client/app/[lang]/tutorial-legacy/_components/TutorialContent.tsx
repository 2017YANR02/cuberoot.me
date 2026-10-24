/**
 * TutorialContent — 从 build pipeline 生成的 article HTML 渲染 React
 * - DOMPurify 清洗（build pipeline 是可信来源，但加一层保险）
 * - html-react-parser 解析，在 <span class="tutorial-chip"> 位置注入 AlgChip
 * - 旧教程内链被改到 legacy 路由并替换成 Next Link
 */
import parse from 'html-react-parser';
import DOMPurify from 'dompurify';
import { createTutorialContentOptions } from './tutorial-content-parser';

interface TutorialContentProps {
  html: string;
}

const SANITIZE_CONFIG = {
  ADD_TAGS: ['span', 'u', 's', 'em', 'strong', 'sub', 'sup'],
  ADD_ATTR: ['data-alg', 'data-see-also', 'loading', 'decoding'],
};

export function TutorialContent({ html }: TutorialContentProps) {
  const clean = DOMPurify.sanitize(html, SANITIZE_CONFIG);

  const options = createTutorialContentOptions();

  return <div className="tutorial-content">{parse(clean, options)}</div>;
}

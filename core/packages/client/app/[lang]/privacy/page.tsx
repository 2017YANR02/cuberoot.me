'use client';

import { createElement } from 'react';
import { PRIVACY_DOCUMENT, type PrivacyNode } from '@cuberoot/shared/privacy';
import { useT } from '@/hooks/useT';
import './privacy.css';

export default function PrivacyPage() {
  const t = useT();
  function render(node: PrivacyNode, key: number): React.ReactNode {
    if ('zh' in node) return t(node.zh, node.en);
    return createElement(node.tag, { key, id: node.id, className: node.className, href: node.href, target: node.target, rel: node.rel },
      node.children.map(render));
  }
  return <main className="privacy-page">{PRIVACY_DOCUMENT.map(render)}</main>;
}

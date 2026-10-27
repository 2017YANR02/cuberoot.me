import { isAssistantSourceHref, type AssistantAnswer } from '@cuberoot/shared/site-assistant';

type Destination = { id: string; title: string; href: string };
type MarkdownNode = { type: string; value?: string; url?: string; children?: MarkdownNode[] };

// Language prefixes are presentation-only; query strings and fragments remain exact.
const linkKey = (href: string) => href.replace(/^\/(?:zh|en)(?=\/|$)/, '') || '/';

export function assistantAnswerLinks(result: AssistantAnswer) {
  const destinations = new Map<string, Destination>();
  for (const item of [...result.sources, ...(result.actions ?? [])]) {
    if (isAssistantSourceHref(item.href)) destinations.set(linkKey(item.href), item);
  }
  return (href: string) => destinations.get(linkKey(href));
}

/** Link plain addresses only when this answer's retrieval metadata verifies them. */
export function remarkAssistantLinks(resolve: ReturnType<typeof assistantAnswerLinks>) {
  return () => (tree: MarkdownNode) => {
    function walk(node: MarkdownNode) {
      // Never rewrite existing links, inline code, code blocks, or their contents.
      if (['link', 'linkReference', 'code', 'inlineCode'].includes(node.type) || !node.children) return;
      node.children = node.children.flatMap(child => {
        if (child.type !== 'text' || !child.value) { walk(child); return [child]; }
        const value = child.value, parts: MarkdownNode[] = [];
        const addresses = /https?:\/\/[^\s<>「」『』（）。，；！？、"']+|\/[A-Za-z0-9][A-Za-z0-9/_?&=.%#~+:-]*/g;
        let end = 0;
        for (const match of value.matchAll(addresses)) {
          const start = match.index;
          if (start > 0 && /[A-Za-z0-9/:_.-]/.test(value[start - 1])) continue;
          const address = match[0].replace(/[.,;!?:)\]]+$/, '');
          const destination = resolve(address);
          if (!destination) continue;
          if (start > end) parts.push({ type: 'text', value: value.slice(end, start) });
          parts.push({ type: 'link', url: destination.href, children: [{ type: 'text', value: address }] });
          end = start + address.length;
        }
        if (!end) return [child];
        if (end < value.length) parts.push({ type: 'text', value: value.slice(end) });
        return parts;
      });
    }
    walk(tree);
  };
}

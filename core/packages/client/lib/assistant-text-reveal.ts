type Node = { type: string; value?: string; tagName?: string; properties?: Record<string, unknown>; children?: Node[] };

// Stable character positions let React retain existing spans as streaming text grows.
// Segment graphemes so emoji and combining marks appear together.
export function rehypeAssistantReveal() {
  return (tree: Node) => {
    const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
    function walk(node: Node) {
      if (!node.children) return;
      node.children = node.children.flatMap(child => {
        if (child.type !== 'text' || !child.value) { walk(child); return [child]; }
        return Array.from(segmenter.segment(child.value), ({ segment }) => ({
          type: 'element', tagName: 'span',
          properties: { className: ['site-assistant-letter'] },
          children: [{ type: 'text', value: segment }],
        }));
      });
    }
    walk(tree);
  };
}

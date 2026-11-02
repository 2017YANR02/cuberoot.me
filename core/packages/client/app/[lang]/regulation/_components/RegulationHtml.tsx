'use client';

import { useMemo, type ComponentProps } from 'react';
import parse, { attributesToProps, domToReact, type DOMNode, type HTMLReactParserOptions } from 'html-react-parser';
import RegulationLink from './RegulationLink';

const options: HTMLReactParserOptions = {
  replace(node) {
    if (node.type !== 'tag' || node.name !== 'a') return;
    const props = attributesToProps(node.attribs) as ComponentProps<'a'>;
    // allow-nested-link: replaces the source anchor rather than wrapping it.
    return <RegulationLink {...props}>{domToReact(node.children as DOMNode[], options)}</RegulationLink>;
  },
};

/** Only accepts the HTML already sanitized by scripts/wca-content.mts. */
export default function RegulationHtml({ html, ...props }: Omit<ComponentProps<'div'>, 'children' | 'dangerouslySetInnerHTML'> & { html: string }) {
  const content = useMemo(() => parse(html, options), [html]);
  return <div {...props}>{content}</div>;
}

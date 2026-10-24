import type { ReactElement } from 'react';
import { domToReact, type HTMLReactParserOptions, type DOMNode } from 'html-react-parser';
import Link from '@/components/AppLink';
import { AlgChip } from './AlgChip';
import { tutorialMediaUrl } from '../_lib/useTutorialCatalog';

interface TutorialElement {
  name: string;
  attribs: Record<string, string>;
  children: DOMNode[];
}

/** Preserve the existing chip markup whitelist after the caller sanitizes HTML. */
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

export function createTutorialContentOptions(
  replace?: (element: TutorialElement, options: HTMLReactParserOptions) => ReactElement | undefined,
): HTMLReactParserOptions {
  const options: HTMLReactParserOptions = {
    replace: node => {
      if (node.type !== 'tag') return;
      const el = node as unknown as TutorialElement;
      const replacement = replace?.(el, options);
      if (replacement) return replacement;

      if (el.name === 'span' && el.attribs?.class?.includes('tutorial-chip')) {
        const alg = el.attribs['data-alg'] ?? '';
        if (alg) {
          const inner = serializeChipChildren(el.children);
          const algHtml = /<[a-z]+>/i.test(inner) ? inner : undefined;
          return <AlgChip alg={alg} algHtml={algHtml} />;
        }
      }

      // Let the default renderer retain every other image attribute.
      if (el.name === 'img' && el.attribs?.src?.startsWith('/stats/')) {
        el.attribs.src = tutorialMediaUrl(el.attribs.src);
        return undefined;
      }

      if (el.name === 'a') {
        const href = el.attribs.href ?? '';
        if (href.startsWith('/tutorial/')) {
          return (
            // allow-nested-link: html-react-parser replaces the source anchor node.
            <Link href={href.replace('/tutorial/', '/tutorial-legacy/')} className={el.attribs.class}>
              {domToReact(el.children, options)}
            </Link>
          );
        }
      }
      return undefined;
    },
  };
  return options;
}

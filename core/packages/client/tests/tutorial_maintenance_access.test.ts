import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import TutorialAccessGate from '@/app/[lang]/tutorial/_components/TutorialAccessGate';
import {
  SEARCH_CARDS,
  SECTIONS,
  isLandingSearchCardVisible,
} from '@/lib/landing-sections';

const layoutSource = readFileSync(
  new URL('../app/[lang]/tutorial/layout.tsx', import.meta.url),
  'utf8',
);
const gateSource = readFileSync(
  new URL('../app/[lang]/tutorial/_components/TutorialAccessGate.tsx', import.meta.url),
  'utf8',
);

describe('tutorial maintenance access', () => {
  it('locks the homepage card and removes the visitor search entry', () => {
    const tutorialCard = SECTIONS
      .find(({ id }) => id === 'learn')
      ?.cards.find(({ href }) => href === '/tutorial');
    const tutorialSearchCard = SEARCH_CARDS.find(({ href }) => href === '/tutorial');

    expect(tutorialCard?.lockedForNonAdmin).toBe(true);
    expect(tutorialSearchCard?.lockedForNonAdmin).toBe(true);
    expect(isLandingSearchCardVisible(tutorialSearchCard!, false)).toBe(false);
    expect(isLandingSearchCardVisible(tutorialSearchCard!, true)).toBe(true);
  });

  it('wraps the whole tutorial route family in the administrator gate', () => {
    expect(layoutSource).toContain('<TutorialAccessGate>{children}</TutorialAccessGate>');
    expect(layoutSource).toContain('robots: { index: false, follow: false }');
    expect(gateSource).toContain('if (!mounted)');
    expect(gateSource).toContain('if (!isAdmin)');
    expect(gateSource).toContain('return children;');
  });

  it('does not expose tutorial content before authentication hydrates', () => {
    const html = renderToStaticMarkup(createElement(
      TutorialAccessGate,
      null,
      createElement('p', null, 'private tutorial fixture'),
    ));

    expect(html).toContain('aria-busy="true"');
    expect(html).not.toContain('private tutorial fixture');
  });
});

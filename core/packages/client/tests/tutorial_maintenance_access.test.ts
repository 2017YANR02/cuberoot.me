import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import TutorialAccessGate from '@/app/[lang]/tutorial-legacy/_components/TutorialAccessGate';
import {
  SEARCH_CARDS,
  SECTIONS,
  isLandingSearchCardVisible,
} from '@/lib/landing-sections';

const layoutSource = readFileSync(
  new URL('../app/[lang]/tutorial-legacy/layout.tsx', import.meta.url),
  'utf8',
);
const gateSource = readFileSync(
  new URL('../app/[lang]/tutorial-legacy/_components/TutorialAccessGate.tsx', import.meta.url),
  'utf8',
);
const newPageSource = readFileSync(
  new URL('../app/[lang]/tutorial/page.tsx', import.meta.url),
  'utf8',
);
const legacyPageSource = readFileSync(
  new URL('../app/[lang]/tutorial-legacy/page.tsx', import.meta.url),
  'utf8',
);

describe('legacy tutorial maintenance access', () => {
  it('publishes the new tutorial homepage card', () => {
    const tutorialCard = SECTIONS
      .find(({ id }) => id === 'learn')
      ?.cards.find(({ href }) => href === '/tutorial');
    const tutorialSearchCard = SEARCH_CARDS.find(({ href }) => href === '/tutorial');

    expect(tutorialCard?.lockedForNonAdmin).toBeUndefined();
    expect(tutorialSearchCard?.lockedForNonAdmin).toBeUndefined();
    expect(isLandingSearchCardVisible(tutorialSearchCard!, false)).toBe(true);
    expect(isLandingSearchCardVisible(tutorialSearchCard!, true)).toBe(true);
  });

  it('keeps the new tutorial page empty and moves the catalog to legacy', () => {
    expect(newPageSource).toContain('<BackHome />');
    expect(newPageSource).not.toContain('useTutorialCatalog');
    expect(legacyPageSource).toContain('/tutorial-legacy/c/');
  });

  it('wraps the legacy tutorial route family in the administrator gate', () => {
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

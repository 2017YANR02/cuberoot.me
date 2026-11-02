import { describe, expect, it, vi } from 'vitest';

// Verified references are supplied by the content index; fixtures exercise URL
// selection semantics without depending on network access or an imported PDF.
vi.mock('@/app/[lang]/regulation/_data/link-index.json', async importOriginal => {
  const original = await importOriginal<{ default: { sources: string[][] } }>();
  return { default: { ...original.default, sources: [...original.default.sources,
    ['https://drive.google.com/file/d/test-report/view?usp=sharing', '/regulation/reference/test-report'],
    ['https://docs.google.com/document/d/test-document/edit', '/regulation/reference/test-document'],
  ] } };
});

import { regulationSupplementId, resolveRegulationHref } from '@/lib/regulation-links';

describe('regulation reading destinations', () => {
  it('maps known announcements and incidents with the current UI language', () => {
    expect(resolveRegulationHref('https://www.worldcubeassociation.org/posts/integrity-committee-digest-2026-q3', 'zh-Hans'))
      .toBe('/zh/regulation/post/integrity-committee-digest-2026-q3');
    expect(resolveRegulationHref('/posts/integrity-committee-digest-2026-q3', 'en'))
      .toBe('/regulation/post/integrity-committee-digest-2026-q3');
    expect(resolveRegulationHref('https://worldcubeassociation.org/incidents/98', 'zh'))
      .toBe('/zh/regulation/logs?kind=incidents&entry=incidents%3A98');
    expect(resolveRegulationHref('https://www.worldcubeassociation.org/incidents/999999', 'en')).toBeNull();
    expect(resolveRegulationHref('https://www.worldcubeassociation.org/posts/not-yet-imported', 'en')).toBeNull();
  });

  it('retains exact existing clause and guideline anchors', () => {
    expect(resolveRegulationHref('https://www.worldcubeassociation.org/regulations/guidelines.html#A7g++++', 'zh'))
      .toBe('/zh/regulation/full#A7g++++');
    expect(resolveRegulationHref('https://www.worldcubeassociation.org/regulations/full/#A7g%2B%2B', 'en'))
      .toBe('/regulation/full#A7g++');
    expect(resolveRegulationHref('https://www.worldcubeassociation.org/regulations/translations/chinese/#article-A', 'en'))
      .toBe('/regulation/full#article-A');
    expect(resolveRegulationHref('https://www.worldcubeassociation.org/regulations/#article-A-speedsolving', 'zh'))
      .toBe('/zh/regulation/full#article-A');
    expect(resolveRegulationHref('https://www.worldcubeassociation.org/regulations/#article-F-clock', 'en')).toBeNull();
    expect(resolveRegulationHref('https://www.worldcubeassociation.org/regulations/#nonexistent-clause', 'en')).toBeNull();
  });

  it('does not redirect historical rules or unknown sections to current text', () => {
    expect(resolveRegulationHref('https://www.worldcubeassociation.org/regulations/history/official/2018-01-01/#A7g', 'zh')).toBeNull();
    expect(resolveRegulationHref('https://www.worldcubeassociation.org/regulations/?version=2018#A7g', 'zh')).toBeNull();
  });

  it('matches the exact curated forum topic without conflating investigations or replies', () => {
    expect(resolveRegulationHref('https://forum.worldcubeassociation.org/t/any-slug/68143?utm_source=test', 'zh'))
      .toBe('/zh/regulation/post/wic-investigation-2026');
    expect(resolveRegulationHref('https://forum.worldcubeassociation.org/t/statement/68143/2', 'zh')).toBeNull();
    expect(resolveRegulationHref('https://forum.worldcubeassociation.org/t/statement/67571', 'zh'))
      .not.toBe('/zh/regulation/post/wic-investigation-2026');
  });

  it('normalizes Drive viewing URLs while preserving meaningful document selections', () => {
    expect(resolveRegulationHref('https://drive.google.com/open?id=test-report', 'en')).toBe('/regulation/reference/test-report');
    expect(resolveRegulationHref('https://drive.google.com/uc?export=download&id=test-report', 'zh')).toBe('/zh/regulation/reference/test-report');
    expect(resolveRegulationHref('https://drive.google.com/file/d/test-report/view#page=2', 'zh')).toBeNull();
    expect(resolveRegulationHref('https://docs.google.com/document/d/test-document/edit?usp=sharing', 'en')).toBe('/regulation/reference/test-document');
    expect(resolveRegulationHref('https://docs.google.com/document/d/test-document/edit?tab=t.second', 'en')).toBeNull();
    expect(resolveRegulationHref('https://docs.google.com/spreadsheets/d/test-report/edit#gid=123', 'en')).toBeNull();
    expect(resolveRegulationHref('https://drive.google.com/file/d/test-report/view?range=A1', 'en')).toBeNull();
  });

  it('links archived supplements to their actual DOM id', () => {
    const href = resolveRegulationHref('https://www.worldcubeassociation.org/archive/forum_topics/388#p1640', 'zh');
    expect(href?.split('#')[0]).toBe('/zh/regulation/post/important-announcement-about-blindfolded-solving');
    expect(decodeURIComponent(href!.split('#')[1])).toBe(regulationSupplementId('archive:forum_topics/388#p1640'));
  });

  it('reuses person and competition destinations without swallowing registration or unsupported anchors', () => {
    expect(resolveRegulationHref('https://www.worldcubeassociation.org/persons/2017YANR02', 'zh')).toBe('/zh/wca/persons/2017YANR02');
    expect(resolveRegulationHref('https://www.worldcubeassociation.org/results/p.php?i=2017YANR02', 'en')).toBe('/wca/persons/2017YANR02');
    expect(resolveRegulationHref('https://www.worldcubeassociation.org/competitions/WC2027#e333_1', 'zh')).toBe('/zh/wca/comp/WC2027?event=333&round=1');
    expect(resolveRegulationHref('https://www.worldcubeassociation.org/results/c.php?i=WC2007', 'en')).toBe('/wca/comp/WC2007');
    expect(resolveRegulationHref('https://www.worldcubeassociation.org/competitions/WC2027/register', 'en')).toBeNull();
    expect(resolveRegulationHref('https://www.worldcubeassociation.org/competitions/WC2027#registration', 'en')).toBeNull();
    expect(resolveRegulationHref('https://www.worldcubeassociation.org/teams-committees#wic', 'zh')).toBeNull();
    expect(resolveRegulationHref('https://www.worldcubeassociation.org/results/rankings/222/single?', 'zh'))
      .toBe('/zh/wca/results?events=222&type=single&show=persons&basis=cumulative');
  });

  it.each([
    'https://www.worldcubeassociation.org/posts/integrity-committee-digest-2026-q3?version=old',
    'https://www.worldcubeassociation.org/incidents/98?revision=2',
    'https://www.worldcubeassociation.org/incidents?page=2',
    'https://www.worldcubeassociation.org/persons/2017YANR02?tab=records',
    'https://www.worldcubeassociation.org/competitions/WC2027?tab=registration',
    'https://www.worldcubeassociation.org/results/rankings/222/single?region=China',
  ])('does not discard a meaningful query selection in %s', href => {
    expect(resolveRegulationHref(href, 'en')).toBeNull();
  });

  it('localizes existing site pages while keeping downloadable assets language-neutral', () => {
    expect(resolveRegulationHref('/zh/regulation/full#A7g', 'en')).toBe('/regulation/full#A7g');
    expect(resolveRegulationHref('https://www.cuberoot.me/regulation/full#A7g', 'zh')).toBe('/zh/regulation/full#A7g');
    expect(resolveRegulationHref('https://cuberoot.me/regulation/wca-translation-reference.md', 'zh')).toBe('/regulation/wca-translation-reference.md');
  });

  it.each(['mailto:integrity@worldcubeassociation.org', '#A7g', 'javascript:alert(1)', 'https://www.worldcubeassociation.org.evil.test/regulations/#A7g', 'https://user@www.worldcubeassociation.org/regulations/#A7g', 'https://example.org/regulations/#A7g'])('leaves external or non-page target %s alone', href => {
    expect(resolveRegulationHref(href, 'zh')).toBeNull();
  });
});

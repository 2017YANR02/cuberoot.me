import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const detailSource = readFileSync(fileURLToPath(new URL(
  '../app/[lang]/alg/[puzzle]/[set]/[subgroup]/AlgCaseView.tsx',
  import.meta.url,
)), 'utf8');
const metaSource = readFileSync(fileURLToPath(new URL(
  '../components/AlgCaseMetaContent.tsx',
  import.meta.url,
)), 'utf8');

describe('community algorithm placement', () => {
  it('mounts community rows inside the formula area for both detail layouts', () => {
    expect(detailSource).toContain('algsAfter={communityAlgs}');
    expect(detailSource).toMatch(/caseObj\.algs\.map[\s\S]*?\}\)\}\s*\{communityAlgs\}\s*<\/div>/);
    expect(metaSource.indexOf('{algsAfter}')).toBeGreaterThan(metaSource.indexOf('{algsWrap('));
    expect(metaSource.indexOf('{algsAfter}')).toBeLessThan(metaSource.indexOf('className="alg-meta-facts"'));
  });

  it('keeps only one community component definition instead of a detached footer copy', () => {
    expect(detailSource.match(/<CommunityAlgs/g)).toHaveLength(1);
  });
});

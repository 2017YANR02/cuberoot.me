import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const categorySource = readFileSync(new URL('../components/AlgCategoryView.tsx', import.meta.url), 'utf8');
const detailSource = readFileSync(new URL('../components/AlgCaseMetaContent.tsx', import.meta.url), 'utf8');
const communitySource = readFileSync(new URL('../components/CommunityAlgs.tsx', import.meta.url), 'utf8');

describe('community algorithm add control placement', () => {
  it('hides add controls on the set list and renders the detail slot once', () => {
    expect(categorySource).toContain('allowAdd={false}');
    expect(detailSource.match(/\{algsAfter\}/g)).toHaveLength(1);
    expect(communitySource).toContain('if (!allowAdd && submissions.length === 0) return null;');
    expect(communitySource).toContain('{allowAdd && (user && adding ? (');
  });
});

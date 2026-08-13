import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8');

describe('algorithm player placement', () => {
  it('keeps category lists static and plays algs on case detail pages', () => {
    const category = read('components/AlgCategoryView.tsx');
    const detail = read('app/[lang]/alg/[puzzle]/[set]/[subgroup]/AlgCaseView.tsx');
    const meta = read('components/AlgCaseMetaContent.tsx');

    expect(category).not.toContain("import AlgPlayer from '@/components/AlgPlayer'");
    expect(category).not.toContain('<AlgPlayer');

    // Lean cases such as F2L render the player directly; metadata-heavy cases
    // opt into the same player through AlgCaseMetaContent.
    expect(detail).toContain('<AlgPlayer');
    expect(detail).toMatch(/<AlgCaseMetaContent[\s\S]*?\bplayable\b/);
    expect(meta).toContain("import AlgPlayer from '@/components/AlgPlayer'");
    expect(meta).toContain('{expanded && (');
  });
});

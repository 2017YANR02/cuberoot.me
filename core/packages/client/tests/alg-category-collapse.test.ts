import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('../components/AlgCategoryView.tsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../app/[lang]/alg/alg.css', import.meta.url), 'utf8');

describe('algorithm group headings', () => {
  it('keeps every case group permanently expanded', () => {
    expect(source).not.toContain('collapsedGroups');
    expect(source).not.toContain('toggleGroup');
    expect(source).not.toContain('alg-subgroup-title is-toggleable');
  });

  it('renders plain headings without a divider', () => {
    const headingRule = styles.match(/\.alg-subgroup-title\s*\{([^}]*)\}/)?.[1] ?? '';
    expect(headingRule).not.toContain('border-bottom');
    expect(styles).not.toContain('.alg-subgroup-title.is-toggleable');
    expect(source).not.toContain('alg-subgroup-count');
  });

  it('renders imported formula emphasis at the surrounding text weight', () => {
    const weightRule = styles.match(
      /\.alg-alg-text strong,\s*\.alg-meta-algline-code strong,\s*\.alg-editor-input strong\s*\{([^}]*)\}/,
    )?.[1] ?? '';
    expect(weightRule).toContain('font-weight: inherit');
  });
});

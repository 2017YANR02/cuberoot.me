import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  ABILITY_COUNT,
  ABILITY_GROUPS,
} from '../app/[lang]/why-cube/_ability-details';

const CLIENT_ROOT = join(import.meta.dirname, '..');

describe('why-cube ability atlas', () => {
  it('ships five illustrated groups and twenty unique expandable topics', () => {
    const abilities = ABILITY_GROUPS.flatMap(group => group.abilities);

    expect(ABILITY_GROUPS).toHaveLength(5);
    expect(ABILITY_COUNT).toBe(20);
    expect(new Set(abilities.map(ability => ability.id)).size).toBe(20);
    expect(new Set(ABILITY_GROUPS.map(group => group.image)).size).toBe(5);
  });

  it('keeps every topic substantial and bilingual', () => {
    for (const group of ABILITY_GROUPS) {
      expect(group.title[0]).toBeTruthy();
      expect(group.title[1]).toBeTruthy();

      for (const ability of group.abilities) {
        const chineseBody = ability.paragraphs.map(paragraph => paragraph[0]).join('');
        const chineseCharacterCount = chineseBody.match(/[\u3400-\u9fff]/g)?.length ?? 0;

        expect(ability.paragraphs).toHaveLength(3);
        expect(chineseCharacterCount, ability.id).toBeGreaterThanOrEqual(400);
        expect(chineseCharacterCount, ability.id).toBeLessThanOrEqual(500);
        expect(ability.paragraphs.every(paragraph => paragraph[1].length > 200), ability.id).toBe(true);
      }
    }
  });

  it('keeps every generated illustration inside client public assets', () => {
    for (const group of ABILITY_GROUPS) {
      expect(group.image.startsWith('/why-cube/')).toBe(true);
      expect(existsSync(join(CLIENT_ROOT, 'public', group.image))).toBe(true);
    }
  });

  it('renders the full NxN line-up through the shared sim engine', () => {
    const pageSource = readFileSync(join(CLIENT_ROOT, 'app', '[lang]', 'why-cube', 'page.tsx'), 'utf8');

    expect(pageSource).not.toContain('VisualCube');
    expect(pageSource).toContain('puzzleOrder={s.n}');
    expect(pageSource).toContain('engine="sim"');
  });
});

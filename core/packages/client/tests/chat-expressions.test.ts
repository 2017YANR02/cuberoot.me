import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { getPetExpressionPacks } from '@/lib/chat-expressions';
import archivedWechat from '@/lib/chat-wechat.json';
import { THEME_IDS } from '@/lib/deskpet-themes';
import { PET_GALLERY } from '@/lib/deskpet-gallery';

describe('chat expression catalog', () => {
  it('preserves the withheld WeChat archive with unique safe tokens', () => {
    const items = archivedWechat;
    expect(items).toHaveLength(109);
    expect(new Set(items.map(item => item.token)).size).toBe(109);
    for (const item of items) {
      expect(item.token).toMatch(/^\[[^\[\]]+\]$/);
      expect(readFileSync(resolve('withheld', item.src.slice(1))).subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
      expect(item.en.length).toBeGreaterThan(0);
    }
  });
  it('fails closed without catalog and hides locked, removed and unknown pets', () => {
    expect(getPetExpressionPacks(null)).toEqual([]);
    const entries = THEME_IDS.map(id => ({ id, locked: true, removed: false }));
    expect(getPetExpressionPacks({ revision: 1, entries })).toEqual([]);
    entries[0] = { ...entries[0], locked: false, removed: true };
    expect(getPetExpressionPacks({ revision: 1, entries })).toEqual([]);
  });
  it('derives every unlocked animation and current URL from the existing pet gallery', () => {
    const packs = getPetExpressionPacks({ revision: 1, entries: THEME_IDS.map(id => ({ id, locked: false, removed: false })) });
    expect(packs).toHaveLength(THEME_IDS.length);
    const tokens = packs.flatMap(pack => pack.items.map(item => item.token));
    expect(new Set(tokens).size).toBe(tokens.length);
    for (const pack of packs) {
      const group = PET_GALLERY.find(g => `pet:${g.id}` === pack.id)!;
      expect(pack.items).toHaveLength(group.scripted ? 1 : group.anims.length);
      for (const item of pack.items) expect(existsSync(resolve('public', item.src.split('?')[0].slice(1))), item.src).toBe(true);
      if (!group.scripted) for (const [index, item] of pack.items.entries()) {
        const anim = group.anims[index];
        expect(item.src).toBe(anim.src ?? `${group.base}${anim.file}${group.v ? `?v=${group.v}` : ''}`);
      }
    }
  });
});

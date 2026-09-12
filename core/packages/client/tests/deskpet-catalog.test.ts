import { describe, expect, it } from 'vitest';
import { DEFAULT_OPEN_PETS, isDeskPetCatalog, resolveDeskPets } from '@cuberoot/shared/deskpet';

describe('pet catalog lifecycle', () => {
  it('opens the four chosen IDs regardless of asset order and locks new assets', () => {
    const pets = resolveDeskPets(['new-pet', ...DEFAULT_OPEN_PETS.slice().reverse()], []);
    expect(pets.filter(p => !p.locked).map(p => p.id)).toEqual(DEFAULT_OPEN_PETS.slice().reverse());
    expect(pets[0]).toEqual({ id: 'new-pet', locked: true, removed: false });
  });
  it('preserves order, removal and renamed labels, ignoring retired assets', () => {
    const entries = [
      { id: 'retired', locked: false, removed: false },
      { id: 'calico', locked: true, removed: true, label: { zh: '猫猫', en: 'Kitty' } },
      { id: 'rootbeast', locked: false, removed: false },
    ];
    expect(resolveDeskPets(['rootbeast', 'calico', 'future'], entries)).toEqual([
      entries[1], entries[2], { id: 'future', locked: true, removed: false },
    ]);
  });
  it('validates IDs, uniqueness, flags, names and revisions', () => {
    const entry = { id: 'future-pet', locked: true, removed: false };
    expect(isDeskPetCatalog({ revision: 0, entries: [entry] })).toBe(true);
    for (const value of [null, {}, { revision: -1, entries: [] },
      { revision: 0, entries: [entry, entry] },
      ...[{ id: '../asset' }, { locked: 'false' }, { label: { en: '', zh: '宠物' } }, { label: null }]
        .map(patch => ({ revision: 0, entries: [{ ...entry, ...patch }] })),
    ]) expect(isDeskPetCatalog(value)).toBe(false);
  });
});

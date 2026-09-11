import { describe, expect, it } from 'vitest';
import { CARE_ACTIONS, careDay, careFor, careWait, createPetCare, currentCare, readCareBook, serializeCareBook } from '@/lib/deskpet-care';

const now = new Date(2026, 8, 9, 12).getTime();
describe('local pet care', () => {
  it('gives one daily bond per interaction, with immediate care and bounded meters', () => {
    let pet = createPetCare(now);
    for (const action of CARE_ACTIONS) pet = careFor(pet, action, now).pet;
    expect(pet.bond).toBe(4);
    expect(pet.food).toBe(95);
    expect(pet.mood).toBe(100);
    expect(pet.energy).toBe(88);
    expect(pet.rewarded).toEqual(CARE_ACTIONS);
    const again = careFor(pet, 'feed', now + 60_000);
    expect(again.accepted).toBe(true);
    expect(again.gained).toBe(false);
    expect(again.pet.bond).toBe(4);
    expect(again.pet.food).toBe(100);
  });
  it('blocks rapid repeat clicks through reloads and allows the exact cooldown boundary', () => {
    const fed = careFor(createPetCare(now), 'feed', now).pet;
    const loaded = readCareBook(serializeCareBook({ rootbeast: fed }), ['rootbeast'], now).rootbeast;
    expect(careFor(loaded, 'feed', now + 59_999).accepted).toBe(false);
    expect(careWait(loaded, 'feed', now + 59_999)).toBe(1);
    expect(careFor(loaded, 'feed', now + 60_000).accepted).toBe(true);
  });
  it('starts a new local day without losing friendship', () => {
    const fed = careFor(createPetCare(now), 'feed', now).pet;
    const tomorrow = new Date(2026, 8, 10, 0, 0, 1).getTime();
    expect(currentCare(fed, tomorrow).rewarded).toEqual([]);
    const next = careFor(fed, 'feed', tomorrow).pet;
    expect(next.rewardDay).toBe(careDay(tomorrow));
    expect(next.bond).toBe(2);
  });
  it('preserves bond after a long absence, caps need loss and recovers energy', () => {
    const absent = currentCare({ ...createPetCare(now), bond: 28, food: 60, mood: 60, energy: 10 }, now + 365 * 86_400_000);
    expect(absent.food).toBe(25);
    expect(absent.mood).toBe(25);
    expect(absent.energy).toBe(100);
    expect(absent.bond).toBe(28);
  });
  it('prevents play when tired and permits it after a nap', () => {
    const tired = { ...createPetCare(now), energy: 14 };
    expect(careFor(tired, 'play', now).accepted).toBe(false);
    const rested = careFor(tired, 'rest', now).pet;
    expect(rested.energy).toBe(34);
    expect(careFor(rested, 'play', now).pet.energy).toBe(22);
  });
  it('isolates all four pets and keeps valid records when a sibling is damaged', () => {
    const ids = ['rootbeast', 'clawd', 'calico', 'cloudling'];
    const pets = Object.fromEntries(ids.map((id, i) => [id, { ...createPetCare(now), bond: i }]));
    const loaded = readCareBook(serializeCareBook(pets), ids, now);
    expect(ids.map(id => loaded[id].bond)).toEqual([0, 1, 2, 3]);
    const mixed = JSON.stringify({ version: 1, pets: { ...pets, clawd: { food: 'invalid' }, unknown: pets.rootbeast } });
    expect(Object.keys(readCareBook(mixed, ids, now))).toEqual(['rootbeast', 'calico', 'cloudling']);
  });
  it('rejects corrupt/unsupported storage and sanitizes out-of-range values and future clocks', () => {
    for (const raw of [null, '', '{', 'null', '[]', '{"version":2,"pets":{}}']) expect(readCareBook(raw, ['rootbeast'], now)).toEqual({});
    const bad = { ...createPetCare(now + 100_000), food: -9, mood: 900, bond: -1, lastAction: { feed: now + 999_999 }, rewarded: ['feed', 'feed', 'unknown'] };
    const loaded = readCareBook(JSON.stringify({ version: 1, pets: { rootbeast: bad } }), ['rootbeast'], now).rootbeast;
    expect(loaded.updatedAt).toBe(now);
    expect(loaded.food).toBe(0);
    expect(loaded.mood).toBe(100);
    expect(loaded.bond).toBe(0);
    expect(loaded.rewarded).toEqual(['feed']);
    expect(careWait(loaded, 'feed', now)).toBe(0);
    expect(currentCare(createPetCare(now), now - 60_000).food).toBe(70);
  });
});

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ALG_COMBO_TYPES, algComboTypeInfo } from '@/lib/alg_combo_types';

function collectComboTypes(value: unknown, found: Set<string>): void {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    value.forEach(item => collectComboTypes(item, found));
    return;
  }

  const record = value as Record<string, unknown>;
  const meta = record.meta;
  if (meta && typeof meta === 'object') {
    const type = (meta as Record<string, unknown>).type;
    if (typeof type === 'string' && type) found.add(type);
  }
  Object.values(record).forEach(item => collectComboTypes(item, found));
}

describe('algorithm combo type guide', () => {
  it('documents every combo type present in the algorithm fixture', () => {
    const fixture = JSON.parse(readFileSync(
      new URL('./fixtures/alg-case-alignment.json', import.meta.url),
      'utf8',
    )) as unknown;
    const actual = new Set<string>();
    collectComboTypes(fixture, actual);

    expect([...actual].sort()).toEqual(ALG_COMBO_TYPES.map(type => type.code).sort());
  });

  it('provides bilingual full names and lookup for every code', () => {
    expect(new Set(ALG_COMBO_TYPES.map(type => type.code)).size).toBe(ALG_COMBO_TYPES.length);
    for (const type of ALG_COMBO_TYPES) {
      expect(type.fullName.zh).not.toBe('');
      expect(type.fullName.en).not.toBe('');
      expect(algComboTypeInfo(type.code)).toBe(type);
    }
  });
});

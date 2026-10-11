import { describe, expect, it } from 'vitest';
import { CUBES, SOURCES } from '../app/[lang]/cube-history/_data/catalog-source';
import packed from '../app/[lang]/cube-history/_data/catalog.compact.json';
import { decodeCatalog, encodeCatalog, type PackedCatalog } from '../app/[lang]/cube-history/_data/catalog-codec';
describe('complete cube history transport', () => {
  it('preserves every field of every research record and source', () => {
    expect(decodeCatalog(packed as PackedCatalog)).toEqual({ CUBES, SOURCES });
    expect(packed).toEqual(encodeCatalog({ CUBES, SOURCES }));
  });
  it('preserves numbers, nulls, empty containers and property names', () => {
    const input = JSON.parse('{"__proto__":{"constructor":2},"zero":0,"values":[null,false,true,"",[],{},2.54,-4]}');
    expect(decodeCatalog(encodeCatalog(input))).toEqual(input);
  });
});

import packed from './catalog.compact.json';
import aliases from './aliases.json';
import { decodeCatalog, type PackedCatalog } from './catalog-codec';
import type { Cube, Source } from './types';

// Generated from the complete research records. Details and exports stay synchronous.
export const { CUBES, SOURCES } = decodeCatalog<{ CUBES: Cube[]; SOURCES: Source[] }>(packed as PackedCatalog);
export const SOURCE_BY_ID = new Map(SOURCES.map((source, index) => [source.id, { ...source, number: index + 1 }]));
export const CUBE_ALIASES = aliases;
const canonicalIds = new Map(aliases.map(alias => [alias.from, alias.to]));
/** Historical shared links remain usable when evidence identifies duplicate records. */
export const resolveCubeId = (id: string): string => canonicalIds.get(id) ?? id;

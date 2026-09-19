/** Artwork presets are local procedural geometry, not uploaded face textures. */
export const ROOM_THEMES = [
  { id: 'whimsy', zh: '奇想生活', en: 'Little daydreams' },
  { id: 'forest', zh: '森林秘境', en: 'Secret woodland' },
  { id: 'cosmos', zh: '星际漫游', en: 'Cosmic voyages' },
] as const;
export type RoomTheme = typeof ROOM_THEMES[number]['id'];
export type RoomThemeSetting = RoomTheme | 'off';

export function normalizeRoomTheme(value: unknown): RoomThemeSetting {
  return ROOM_THEMES.find((theme) => theme.id === value)?.id ?? 'off';
}

export function supportsRoomCube(puzzle: unknown): puzzle is number {
  return typeof puzzle === 'number' && Number.isInteger(puzzle) && puzzle >= 2 && puzzle <= 7;
}

export function roomCubeActive(puzzle: unknown, theme: unknown): boolean {
  return supportsRoomCube(puzzle) && normalizeRoomTheme(theme) !== 'off';
}

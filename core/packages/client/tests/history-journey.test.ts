import { describe, expect, it } from 'vitest';
import DAYS from '@/app/[lang]/dev/architecture/timeline_commits.json';
import { HISTORY_LAST, HISTORY_PLACES, clampHistoryPosition, historyWindow } from '@/app/[lang]/dev/architecture/history/history-days';

describe('complete history landscape', () => {
  it('represents every recorded date exactly once, in canonical order, with its full original story', () => {
    expect(HISTORY_PLACES.map(place => place.day)).toEqual(DAYS);
    const dates = HISTORY_PLACES.map(place => place.date);
    expect(dates).toEqual([...new Set(dates)].sort());
    expect(dates[0]).toBe('2025-12-13');
    expect(dates.at(-1)).toBe(DAYS.at(-1)!.date);
    expect(new Set(HISTORY_PLACES.map(place => place.seed)).size).toBe(DAYS.length);
  });

  it.each(HISTORY_PLACES)('has a concise bilingual map note and a valid landscape for $date', place => {
    for (const language of ['en', 'zh'] as const) {
      expect(place[language].length > 0).toBe(true);
      if (place.caption) expect(place.caption[language].length > 0).toBe(true);
      expect(place.note[language].title.length > 0).toBe(true);
      expect(place.note[language].title.length <= (language === 'zh' ? 24 : 58)).toBe(true);
      expect(place.note[language].detail.length <= (language === 'zh' ? 30 : 68)).toBe(true);
    }
    expect(place.authored ? Number.isInteger(place.motif) && place.motif! >= 0 && place.motif! <= 7 : place.motif === null).toBe(true);
    expect(Number.isInteger(place.biome) && place.biome >= 0 && place.biome <= 7).toBe(true);
  });

  it('preserves the eight reviewed September scenes by date, regardless of earlier history', () => {
    const authored = HISTORY_PLACES.filter(place => place.authored);
    expect(authored.map(place => place.date)).toEqual(Array.from({ length: 8 }, (_, i) => `2026-09-0${i + 1}`));
    expect(authored.map(place => place.motif)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(authored.map(place => place.biome)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });

  it('bounds loaded passages across the entire journey and handles invalid or out-of-range input', () => {
    expect(historyWindow(NaN)).toEqual([0, 1, 2]);
    expect(historyWindow(-1)).toEqual([0, 1, 2]);
    expect(historyWindow(Infinity)).toEqual([0, 1, 2]);
    expect(historyWindow(HISTORY_LAST + 100)).toEqual([HISTORY_LAST - 2, HISTORY_LAST - 1, HISTORY_LAST]);
    for (let position = 0; position <= HISTORY_LAST; position += .25) {
      const window = historyWindow(position);
      expect(window.length <= 5).toBe(true);
      expect(window).toContain(Math.round(position));
      expect(window.every(i => i >= 0 && i <= HISTORY_LAST)).toBe(true);
      expect(clampHistoryPosition(position)).toBe(position);
    }
  });
});

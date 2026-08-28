import { describe, expect, it } from 'vitest';
import { normalizeCreatorGalleryCaptions } from '../src/routes/creator_gallery.js';

const validCaptions = () =>
  Array.from({ length: 8 }, (_, index) => ({
    imageKey: `photo-${String(index + 1).padStart(2, '0')}`,
    captionZh: ` 中文说明 ${index + 1} `,
    captionEn: ` English caption ${index + 1} `,
  }));

describe('creator gallery caption validation', () => {
  it('trims captions and returns them in image-key order', () => {
    const captions = validCaptions().reverse();
    const result = normalizeCreatorGalleryCaptions({ captions });

    expect(result).toEqual({
      value: validCaptions().map((caption) => ({
        ...caption,
        captionZh: caption.captionZh.trim(),
        captionEn: caption.captionEn.trim(),
      })),
    });
  });

  it('requires all eight fixed photo keys', () => {
    expect(normalizeCreatorGalleryCaptions({ captions: validCaptions().slice(0, 7) })).toEqual({
      error: 'captions must contain exactly 8 entries',
    });
  });

  it('rejects duplicated or unknown photo keys', () => {
    const duplicated = validCaptions();
    duplicated[7]!.imageKey = 'photo-01';
    expect(normalizeCreatorGalleryCaptions({ captions: duplicated })).toEqual({
      error: 'imageKey malformed or duplicated',
    });

    const unknown = validCaptions();
    unknown[7]!.imageKey = 'photo-09';
    expect(normalizeCreatorGalleryCaptions({ captions: unknown })).toEqual({
      error: 'imageKey malformed or duplicated',
    });
  });

  it('rejects non-string and oversized captions', () => {
    const nonString = validCaptions();
    nonString[0]!.captionZh = 42 as unknown as string;
    expect(normalizeCreatorGalleryCaptions({ captions: nonString })).toEqual({
      error: 'captionZh and captionEn must be strings',
    });

    const oversized = validCaptions();
    oversized[0]!.captionEn = 'x'.repeat(801);
    expect(normalizeCreatorGalleryCaptions({ captions: oversized })).toEqual({
      error: 'captions must be at most 800 characters',
    });
  });
});

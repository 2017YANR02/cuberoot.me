import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { stickerMime } from '../src/utils/chat_stickers.js';
import { CHAT_STICKER_MAX_BYTES } from '@cuberoot/shared/chat';

describe('private sticker raster boundary', () => {
  it('recognizes GIF and PNG originals without re-encoding animation or transparency', () => {
    const gif = Buffer.from('R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==', 'base64');
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9ioAAAAASUVORK5CYII=', 'base64');
    expect(stickerMime(gif)).toBe('image/gif');
    expect(stickerMime(png)).toBe('image/png');
  });
  it('rejects SVG, oversized payloads, truncated rasters and excessive dimensions', () => {
    for (const data of [Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'), Buffer.from('GIF89a'), Buffer.alloc(CHAT_STICKER_MAX_BYTES + 1)]) {
      expect(() => stickerMime(data)).toThrow();
    }
    const gif = Buffer.from('R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==', 'base64');
    gif.writeUInt16LE(5000, 6);
    expect(() => stickerMime(gif)).toThrow('INVALID_INPUT');
  });
  it('keeps the new migration in the schema snapshot', async () => {
    const schema = await readFile(new URL('../src/db/schema.pg.sql', import.meta.url), 'utf8');
    const migration = await readFile(new URL('../migrations/0250_chat_stickers.sql', import.meta.url), 'utf8');
    expect(schema).toContain(migration.trim());
  });
});

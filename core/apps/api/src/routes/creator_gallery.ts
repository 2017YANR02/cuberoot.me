/**
 * /v1/creator-gallery/captions - 颜瑞民个人页图库说明。
 *   - GET /v1/creator-gallery/captions - public, short cache
 *   - PUT /v1/creator-gallery/captions - admin, full replacement
 */
import { Hono } from 'hono';
import { query } from '../db/connection.js';
import { getIp } from '../utils/analytics_helpers.js';
import { checkRateLimit, requireAdminOrApiKey } from '../utils/recon_helpers.js';

export const creatorGalleryRoutes = new Hono();

const IMAGE_KEYS = [
  'photo-01',
  'photo-02',
  'photo-03',
  'photo-04',
  'photo-05',
  'photo-06',
  'photo-07',
  'photo-08',
] as const;
const IMAGE_KEY_SET = new Set<string>(IMAGE_KEYS);
const CAPTION_MAX = 800;

interface CaptionRow {
  image_key: string;
  caption_zh: string;
  caption_en: string;
}

interface CaptionInput {
  imageKey?: unknown;
  captionZh?: unknown;
  captionEn?: unknown;
}

interface CaptionBody {
  captions?: unknown;
}

interface NormalizedCaption {
  imageKey: string;
  captionZh: string;
  captionEn: string;
}

function rowToJson(row: CaptionRow): NormalizedCaption {
  return {
    imageKey: row.image_key,
    captionZh: row.caption_zh,
    captionEn: row.caption_en,
  };
}

export function normalizeCreatorGalleryCaptions(
  body: CaptionBody,
): { error: string } | { value: NormalizedCaption[] } {
  if (!Array.isArray(body.captions) || body.captions.length !== IMAGE_KEYS.length) {
    return { error: `captions must contain exactly ${IMAGE_KEYS.length} entries` };
  }

  const seen = new Set<string>();
  const captions: NormalizedCaption[] = [];
  for (const raw of body.captions as CaptionInput[]) {
    if (!raw || typeof raw !== 'object') return { error: 'caption entry malformed' };
    if (typeof raw.imageKey !== 'string' || !IMAGE_KEY_SET.has(raw.imageKey) || seen.has(raw.imageKey)) {
      return { error: 'imageKey malformed or duplicated' };
    }
    if (typeof raw.captionZh !== 'string' || typeof raw.captionEn !== 'string') {
      return { error: 'captionZh and captionEn must be strings' };
    }

    const captionZh = raw.captionZh.trim();
    const captionEn = raw.captionEn.trim();
    if (captionZh.length > CAPTION_MAX || captionEn.length > CAPTION_MAX) {
      return { error: `captions must be at most ${CAPTION_MAX} characters` };
    }

    seen.add(raw.imageKey);
    captions.push({ imageKey: raw.imageKey, captionZh, captionEn });
  }

  captions.sort((a, b) => a.imageKey.localeCompare(b.imageKey));
  return { value: captions };
}

creatorGalleryRoutes.get('/creator-gallery/captions', async (c) => {
  c.header('Cache-Control', 'public, max-age=60, s-maxage=300');
  const rows = await query<CaptionRow>(
    'SELECT image_key, caption_zh, caption_en FROM creator_gallery_captions ORDER BY image_key',
  );
  return c.json({ captions: rows.map(rowToJson) });
});

creatorGalleryRoutes.put('/creator-gallery/captions', async (c) => {
  c.header('Cache-Control', 'no-cache, no-store, must-revalidate');
  checkRateLimit(getIp(c));
  await requireAdminOrApiKey(c);

  const normalized = normalizeCreatorGalleryCaptions(await c.req.json<CaptionBody>());
  if ('error' in normalized) return c.json({ error: normalized.error }, 400);

  const placeholders = normalized.value.map(() => '(?, ?, ?)').join(', ');
  const params = normalized.value.flatMap((caption) => [
    caption.imageKey,
    caption.captionZh,
    caption.captionEn,
  ]);
  await query(
    `INSERT INTO creator_gallery_captions (image_key, caption_zh, caption_en)
     VALUES ${placeholders}
     ON CONFLICT (image_key) DO UPDATE SET
       caption_zh = EXCLUDED.caption_zh,
       caption_en = EXCLUDED.caption_en,
       updated_at = NOW()`,
    params,
  );

  return c.json({ captions: normalized.value });
});

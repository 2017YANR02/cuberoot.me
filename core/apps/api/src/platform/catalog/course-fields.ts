import { badRequest } from '../errors.js';
import { isObject, stringField, type JsonObject, enumField, integerField } from '../validation.js';
import { createHash } from 'node:crypto';

export const SLUG = /^[a-z0-9][a-z0-9_-]{0,119}$/;

const CURRENCY = /^[A-Z]{3}$/;

const COURSE_STATUSES = ['draft', 'published', 'unlisted', 'archived'] as const;

const ENROLLMENT_MODES = ['free', 'purchase', 'invite', 'admin_grant'] as const;

export function hashJson(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value), 'utf8').digest('hex');
}

function coursePresentation(value: unknown): Record<string, unknown> | undefined {
  if (value === undefined) return undefined;
  if (!isObject(value)) badRequest('presentation must be an object');
  const result: Record<string, unknown> = {};
  for (const key of ['level','format','coverUrl','previewUrl','nextLiveAt']) {
    const text = stringField(value,key,{max:2048});
    if (text && ['coverUrl','previewUrl'].includes(key) && !text.startsWith('/') && !/^https?:\/\//.test(text)) badRequest(`${key} must be a site path or HTTP URL`);
    if (text) result[key]=text;
  }
  for (const key of ['tags','highlights']) {
    if (value[key] == null) continue;
    if (!Array.isArray(value[key]) || value[key].length>100 || value[key].some(item=>typeof item!=='string'||item.length>2000)) badRequest(`${key} must be a text array`);
    result[key]=value[key];
  }
  if (value.outline != null) {
    if(!Array.isArray(value.outline)||value.outline.length>200||value.outline.some(item=>!isObject(item)||typeof item.label!=='string'||typeof item.topic!=='string'||item.label.length>200||item.topic.length>2000)) badRequest('outline must contain label and topic');
    result.outline=value.outline;
  }
  return result;
}

export function courseFields(body: JsonObject, required: boolean) {
  return {
    presentation: coursePresentation(body.presentation),
    slug: stringField(body, 'slug', { required, max: 120, pattern: SLUG }),
    titleZh: stringField(body, 'titleZh', { required: false, max: 240 }),
    titleEn: stringField(body, 'titleEn', { required: false, max: 240 }),
    summaryZh: stringField(body, 'summaryZh', { max: 4_000 }),
    summaryEn: stringField(body, 'summaryEn', { max: 4_000 }),
    descriptionZh: stringField(body, 'descriptionZh', { max: 100_000, trim: false }),
    descriptionEn: stringField(body, 'descriptionEn', { max: 100_000, trim: false }),
    status: enumField(body, 'status', COURSE_STATUSES),
    enrollmentMode: enumField(body, 'enrollmentMode', ENROLLMENT_MODES),
    baseAmountMinor: integerField(body, 'baseAmountMinor', { min: 0, max: Number.MAX_SAFE_INTEGER }),
    memberAmountMinor: body.memberAmountMinor === null
      ? null
      : integerField(body, 'memberAmountMinor', { min: 0, max: Number.MAX_SAFE_INTEGER }),
    currency: stringField(body, 'currency', { max: 3, pattern: CURRENCY }),
  };
}

export function requireBilingualTitle(titleZh: string | undefined, titleEn: string | undefined): void {
  if (!titleZh && !titleEn) badRequest('At least one of titleZh and titleEn is required');
}

export const COURSE_PROJECTION = `
  c.id::text AS id, c.slug, c.status, c.base_amount_minor AS "baseAmountMinor",
  c.member_amount_minor AS "memberAmountMinor", c.currency,
  c.enrollment_mode AS "enrollmentMode", c.current_revision AS "currentRevision",
  r.title_zh AS "titleZh", r.title_en AS "titleEn", r.summary_zh AS "summaryZh",
  r.summary_en AS "summaryEn", r.description_zh AS "descriptionZh",
  r.description_en AS "descriptionEn", r.presentation, c.published_at AS "publishedAt",
  c.created_at AS "createdAt", c.updated_at AS "updatedAt"`;

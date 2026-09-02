import { badRequest } from './errors.js';
import { approvedQrTarget, isObject, stringField } from './validation.js';

export const QR_LINK_LIMIT = 20;

export interface QrLandingLink {
  label: string;
  href: string;
  note?: string;
}

function linkText(body: Record<string, unknown>, key: string, path: string, max: number, required = false): string | undefined {
  if (Object.prototype.hasOwnProperty.call(body, key) && typeof body[key] !== 'string') {
    badRequest(`${path} must be a string`);
  }
  const value = stringField(body, key, { required, max });
  if (value != null && /[\u0000-\u001f\u007f]/.test(value)) {
    badRequest(`${path} contains unsupported control characters`);
  }
  return value;
}

export function parseQrLinks(value: unknown): QrLandingLink[] {
  if (!Array.isArray(value) || value.length > QR_LINK_LIMIT) {
    badRequest(`links must be an array with at most ${QR_LINK_LIMIT} items`);
  }
  return value.map((raw, index) => {
    if (!isObject(raw)) badRequest(`links[${index}] must be an object`);
    const unknown = Object.keys(raw).find((key) => !['label', 'href', 'note'].includes(key));
    if (unknown) badRequest(`links[${index}].${unknown} is not supported`);
    const label = linkText(raw, 'label', `links[${index}].label`, 160, true)!;
    const href = approvedQrTarget(stringField(raw, 'href', { required: true, max: 4_000 })!);
    const note = linkText(raw, 'note', `links[${index}].note`, 240);
    return { label, href, ...(note ? { note } : {}) };
  });
}

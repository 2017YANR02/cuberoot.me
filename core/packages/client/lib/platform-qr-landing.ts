export const PLATFORM_QR_LINK_LIMIT = 20;

export interface PlatformQrLink {
  label: string;
  href: string;
  note?: string;
}

export type PlatformQrMode = 'disabled' | 'redirect' | 'landing';
export type PlatformQrTargetKind = 'internal_path' | 'external_url' | 'content';

export interface PlatformQrLandingState {
  mode: PlatformQrMode;
  target: string;
  title: string;
  intro: string;
  term: string;
  links: PlatformQrLink[];
}

export function platformQrCardStudioHref(code: string): string {
  const encoded = encodeURIComponent(code.trim());
  return `/platform/admin/qr/cards?codes=${encoded}&edit=${encoded}`;
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function text(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

/** Only site-absolute paths and credential-free HTTP(S) links can leave the landing page. */
export function isPlatformQrLinkHref(value: string): boolean {
  const href = value.trim();
  if (/^\/[A-Za-z0-9/_?&=.#%+~-]*$/.test(href) && !href.startsWith('//')) return true;
  try {
    const url = new URL(href);
    return (url.protocol === 'http:' || url.protocol === 'https:') && !url.username && !url.password;
  } catch {
    return false;
  }
}

export function platformQrTargetProblem(
  kind: PlatformQrTargetKind,
  value: string,
): 'required' | 'internal' | 'external' | null {
  const target = value.trim();
  if (!target) return 'required';
  if (kind === 'internal_path' && (!/^\/[A-Za-z0-9/_?&=.#%+~-]*$/.test(target) || target.startsWith('//'))) return 'internal';
  if (kind === 'external_url' && (!isPlatformQrLinkHref(target) || target.startsWith('/'))) return 'external';
  return null;
}

export function normalizePlatformQrLinks(value: unknown): PlatformQrLink[] {
  if (!Array.isArray(value)) return [];
  const links: PlatformQrLink[] = [];
  for (const raw of value.slice(0, PLATFORM_QR_LINK_LIMIT)) {
    const item = record(raw);
    if (!item) continue;
    const label = text(item.label, 160);
    const href = text(item.href, 4000);
    const note = text(item.note, 240);
    if (!label || !href || !isPlatformQrLinkHref(href)) continue;
    links.push({ label, href, ...(note ? { note } : {}) });
  }
  return links;
}

export function platformQrLinksProblem(value: readonly PlatformQrLink[]): 'limit' | 'label' | 'href' | 'note' | null {
  if (value.length > PLATFORM_QR_LINK_LIMIT) return 'limit';
  for (const item of value) {
    if (!item.label.trim() || item.label.trim().length > 160) return 'label';
    if (!item.href.trim() || item.href.trim().length > 4000 || !isPlatformQrLinkHref(item.href)) return 'href';
    if ((item.note ?? '').trim().length > 240) return 'note';
  }
  return null;
}

export function resolvePlatformQrLanding(
  data: Readonly<Record<string, unknown>>,
  options: {
    english: boolean;
    defaultTitle: string;
    defaultIntro: string;
    defaultLinks: readonly PlatformQrLink[];
  },
): PlatformQrLandingState {
  const status = text(data.status, 32);
  const type = text(data.type, 32);
  const targetKind = text(data.targetKind, 32);
  const target = text(data.targetValue, 4000) || text(data.target, 4000);
  const safeTarget = (targetKind === 'internal_path' || targetKind === 'external_url')
    && platformQrTargetProblem(targetKind, target) === null;
  const preferredTitle = text(data[options.english ? 'titleEn' : 'titleZh'], 240);
  const alternateTitle = text(data[options.english ? 'titleZh' : 'titleEn'], 240);
  const title = preferredTitle || alternateTitle || text(data.title, 240) || options.defaultTitle;
  const intro = text(data.intro, 1000) || options.defaultIntro;
  const term = text(data.term, 160);
  const links = normalizePlatformQrLinks(data.links);
  return {
    mode: status === 'disabled'
      ? 'disabled'
      : type === 'redirect' && safeTarget
        ? 'redirect'
        : 'landing',
    target: safeTarget ? target : '',
    title,
    intro,
    term,
    links: links.length ? links : [...options.defaultLinks],
  };
}

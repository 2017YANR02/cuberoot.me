import index from '../app/[lang]/regulation/_data/link-index.json';
import { compHref, parseWcaAnchor } from './comp-link';
import { personHref } from './person-link';
import { isWcaIdFormat } from '@cuberoot/shared/account';
import { ALL_EVENT_IDS } from './event-constants';

const posts = new Set(index.posts);
const incidents = new Set(index.incidents);
const anchors = new Set(index.anchors);
const wcaHosts = new Set(['www.worldcubeassociation.org', 'worldcubeassociation.org']);
const localHosts = new Set(['cuberoot.me', 'www.cuberoot.me']);

/** Must also be used by the section containing the archived supplement. */
export const regulationSupplementId = (id: string) => `supplement-${id}`;

function sourceKey(url: URL): string {
  const search = new URLSearchParams(url.search);
  for (const key of [...search.keys()]) if (/^utm_|^(?:fbclid|gclid)$/.test(key)) search.delete(key);
  search.sort();
  if (url.hostname === 'drive.google.com' || url.hostname === 'docs.google.com') {
    const file = /^\/(?:file|document|spreadsheets|presentation)\/d\/([^/]+)/.exec(url.pathname)?.[1]
      ?? (/^\/(?:open|uc)$/.test(url.pathname) ? url.searchParams.get('id') : null);
    if (file) {
      for (const key of ['usp', 'authuser', 'resourcekey']) search.delete(key);
      if (/^\/(?:open|uc)$/.test(url.pathname)) search.delete('id');
      if (url.pathname === '/uc' && search.get('export') === 'download') search.delete('export');
      return `google-file:${file}${search.size ? `?${search}` : ''}${url.hash}`;
    }
  }
  if (url.hostname === 'forum.worldcubeassociation.org') {
    const topic = /^\/t\/(?:[^/]+\/)?(\d+)(?:\/1)?\/?$/.exec(url.pathname)?.[1];
    if (topic && !url.hash && !search.size) return `wca-topic:${topic}`;
  }
  const hostname = wcaHosts.has(url.hostname) ? 'www.worldcubeassociation.org' : url.hostname;
  return `${hostname}${url.pathname.replace(/\/$/, '')}${search.size ? `?${search}` : ''}${url.hash}`;
}

const sourceDestinations = new Map(index.sources.map(([source, destination]) => [sourceKey(new URL(source)), destination]));

function localize(path: string, language: string): string {
  const normalized = path.replace(/^\/(?:zh|en)(?=\/|$)/, '') || '/';
  // Public files are language-neutral; language only belongs to page routes.
  if (/\.[a-z\d]+$/i.test(normalized.split(/[?#]/)[0])) return normalized;
  return language.startsWith('zh') ? `/zh${normalized === '/' ? '' : normalized}` : normalized;
}

/** Resolve only destinations backed by site content; source links can bypass this. */
export function resolveRegulationHref(href: string, language: string): string | null {
  if (!href || href.startsWith('#') || /^(?:mailto:|tel:)/i.test(href)) return null;
  if (/^\/(?:(?:zh|en)\/)?regulation(?:[/?#]|$)/.test(href)) return localize(href, language);
  let url: URL;
  try { url = new URL(href, 'https://www.worldcubeassociation.org'); } catch { return null; }
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.port) return null;
  if (localHosts.has(url.hostname)) return localize(url.pathname + url.search + url.hash, language);
  const matched = sourceDestinations.get(sourceKey(url));
  if (matched) return localize(matched, language);
  if (!wcaHosts.has(url.hostname)) return null;
  const path = url.pathname.replace(/\/$/, '');
  const contentQuery = [...url.searchParams.keys()].filter(key => !/^utm_|^(?:fbclid|gclid)$/.test(key));
  const person = /^\/persons\/([^/]+)$/.exec(path)?.[1]
    ?? (path === '/results/p.php' && contentQuery.every(key => key === 'i') ? url.searchParams.get('i') : null);
  if (person && isWcaIdFormat(person) && !url.hash && contentQuery.every(key => path === '/results/p.php' && key === 'i')) {
    return localize(personHref(person), language);
  }
  const competition = /^\/competitions\/([A-Za-z0-9]+)$/.exec(path)?.[1]
    ?? (path === '/results/c.php' && contentQuery.every(key => key === 'i') ? url.searchParams.get('i') : null);
  if (competition && /^[A-Za-z0-9]+$/.test(competition) && contentQuery.every(key => path === '/results/c.php' && key === 'i')) {
    const options = parseWcaAnchor(url.hash.slice(1));
    if (!url.hash || options.event) return localize(compHref(competition, options), language);
  }
  if (path === '/results/records' && !url.hash && !contentQuery.length) return localize('/wca/records', language);
  const ranking = /^\/results\/rankings\/([^/]+)\/(single|average)$/.exec(path);
  if (ranking && ALL_EVENT_IDS.includes(ranking[1]) && !url.hash && !contentQuery.length) {
    return localize(`/wca/results?events=${ranking[1]}&type=${ranking[2]}&show=persons&basis=cumulative`, language);
  }
  const post = /^\/posts\/([^/]+)$/.exec(path)?.[1];
  if (post && posts.has(post) && !url.hash && !contentQuery.length) return localize(`/regulation/post/${post}`, language);
  const incident = /^\/incidents\/(\d+)$/.exec(path)?.[1];
  if (incident && incidents.has(incident) && !url.hash && !contentQuery.length) return localize(`/regulation/logs?kind=incidents&entry=incidents%3A${incident}`, language);
  if (path === '/incidents' && !url.hash && !contentQuery.length) return localize('/regulation/logs?kind=incidents', language);
  if (path === '/disciplinary' && !url.hash && !contentQuery.length) return localize('/regulation/logs?kind=disciplinary', language);
  if (!/^\/regulations(?:\/(?:full|guidelines\.html|translations\/chinese))?$/.test(path)) return null;
  if ([...url.searchParams.keys()].some(key => !/^utm_|^(?:fbclid|gclid)$/.test(key))) return null;
  let anchor: string;
  try { anchor = decodeURIComponent(url.hash.slice(1)); } catch { return null; }
  // Older unversioned URLs appended a chapter title to the same article ID.
  const articleAlias = /^article-([A-Z]|\d+)-[a-z-]+$/.exec(anchor);
  if (articleAlias && anchors.has(`article-${articleAlias[1]}`)) anchor = `article-${articleAlias[1]}`;
  // In particular, never send a deleted clause or a historical version to an unrelated rule.
  if (anchor && !anchors.has(anchor)) return null;
  return localize(`/regulation/full${anchor ? `#${anchor}` : ''}`, language);
}

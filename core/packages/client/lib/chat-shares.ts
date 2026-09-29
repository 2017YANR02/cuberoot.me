import { isMeetCode } from './video-room-api';

/** Only links into our existing meeting/music pages get an actionable chat card. */
export function parseChatShare(raw: string): { kind: 'meet' | 'music'; id: string; href: string } | null {
  try {
    const url = new URL(raw.trim());
    if (url.protocol !== 'https:' || !['cuberoot.me', 'www.cuberoot.me'].includes(url.hostname) || url.port || url.username || url.password) return null;
    if (/^\/(?:zh\/)?meet$/.test(url.pathname) && isMeetCode(url.searchParams.get('room') ?? '')) {
      const id = url.searchParams.get('room')!;
      return { kind: 'meet', id, href: `/meet?room=${id}` };
    }
    const id = url.searchParams.get('track');
    if (/^\/(?:zh\/)?music$/.test(url.pathname) && id && id.length <= 160 && !/[\x00-\x1f]/.test(id)) return { kind: 'music', id, href: `/music?track=${encodeURIComponent(id)}&view=player` };
  } catch { /* A normal text line. */ }
  return null;
}

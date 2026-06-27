// 报名时段文案 — 比赛页弹窗 + 首页「今日公示」共用。
// 未到 → "X 报名";进行中 → "X 截止";已截止 → "报名已截止"。ISO 转用户本地时区。
// 两个字段都没有时返回 null。
import { tr } from '@/i18n/tr';

export function formatRegStatus(
  open: string | null | undefined,
  close: string | null | undefined,
  isZh: boolean,
): string | null {
  if (!open && !close) return null;
  const now = Date.now();
  const fmt = (iso: string): string => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    const Y = d.getFullYear();
    const M = String(d.getMonth() + 1).padStart(2, '0');
    const D = String(d.getDate()).padStart(2, '0');
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    return `${Y}-${M}-${D} ${h}:${m}`;
  };
  const openMs = open ? new Date(open).getTime() : null;
  const closeMs = close ? new Date(close).getTime() : null;
  if (openMs !== null && now < openMs) {
    return (isZh ? `${fmt(open!)} 报名` : `Registration opens ${fmt(open!)}`);
  }
  if (closeMs !== null && now >= closeMs) {
    return tr({ zh: '报名已截止', en: 'Registration closed'
    });
  }
  if (closeMs !== null) {
    return isZh ? `${fmt(close!)} 截止` : `Closes ${fmt(close!)}`;
  }
  return tr({ zh: '报名中', en: 'Registration open'
  });
}

// 报名状态「胶囊」版 — 与首页「报名」tab 的 CompCard pill 同形({ when, word, tone }),
// 供「公示」tab / 比赛卡片视图复用同一套彩色胶囊样式(registration_comps.css 的 .rc-pill)。
// 措辞对齐「报名」tab:未开放→开放(绿) / 报名中有截止→截止(黄,24h 内红) / 已过→报名已截止(灰)。
export type RegPillTone = 'open' | 'close' | 'urgent' | 'closed';
export interface RegStatusPill { when?: string; word: string; tone: RegPillTone; }

export function regStatusPill(
  open: string | null | undefined,
  close: string | null | undefined,
): RegStatusPill | null {
  if (!open && !close) return null;
  const now = Date.now();
  const dt = (iso: string): string => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    const M = String(d.getMonth() + 1).padStart(2, '0');
    const D = String(d.getDate()).padStart(2, '0');
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    return `${d.getFullYear()}-${M}-${D} ${h}:${m}`;
  };
  const openMs = open ? new Date(open).getTime() : null;
  const closeMs = close ? new Date(close).getTime() : null;
  if (openMs !== null && now < openMs) {
    return { when: dt(open!), word: tr({ zh: '开放', en: 'Opens' }), tone: 'open' };
  }
  if (closeMs !== null && now >= closeMs) {
    return { word: tr({ zh: '报名已截止', en: 'Closed' }), tone: 'closed' };
  }
  if (closeMs !== null) {
    return { when: dt(close!), word: tr({ zh: '截止', en: 'Closes' }), tone: closeMs - now <= 86_400_000 ? 'urgent' : 'close' };
  }
  return { word: tr({ zh: '报名中', en: 'Open' }), tone: 'open' };
}

// 报名时段文案 — 比赛页弹窗 + 首页「今日公示」共用。
// 未到 → "X 开放报名";进行中 → "X 截止";已截止 → "报名已截止"。ISO 转用户本地时区。
// 两个字段都没有时返回 null。
import i18n from '@/i18n/i18n-client';
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
    return i18n.language === 'zh-Hant' ? (`${fmt(open!)} 開放報名`) : (isZh ? `${fmt(open!)} 开放报名` : `Registration opens ${fmt(open!)}`);
  }
  if (closeMs !== null && now >= closeMs) {
    return tr({ zh: '报名已截止', en: 'Registration closed',
        zhHant: "報名已截止"
    });
  }
  if (closeMs !== null) {
    return isZh ? `${fmt(close!)} 截止` : `Closes ${fmt(close!)}`;
  }
  return tr({ zh: '报名中', en: 'Registration open',
      zhHant: "報名中"
  });
}

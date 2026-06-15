// 智能粘贴 — 检测剪贴板内容并路由到对应工具
// Ported from packages/client/src/utils/smart_paste.ts.
// 返回的 route 为裸路径,调用方 (LandingSearch) 自行加 /[lang] 前缀。
import { rewriteWcaCompUrl } from './comp-link';

export type PasteIntentKind =
  | 'wca-person'
  | 'wca-comp'
  | 'cubing-com-comp'
  | 'scramble'
  | 'youtube'
  | 'twitch';

export interface PasteIntent {
  kind: PasteIntentKind;
  route: string;
  /** 给 UI 显示的简短标签(中英共用,UI 层再 i18n) */
  labelZh: string;
  labelEn: string;
}

const MOVE_RE = /^([FRULBDfrulbd][wW]?|[xyzXYZ]|[MESmes])(?:[2'])?$/;

function looksLikeScramble(s: string): boolean {
  const tokens = s.split(/\s+/).filter(Boolean);
  if (tokens.length < 6) return false;
  let ok = 0;
  for (const t of tokens) if (MOVE_RE.test(t)) ok++;
  return ok / tokens.length >= 0.7;
}

export function detectPasteIntent(raw: string): PasteIntent | null {
  const s = (raw || '').trim();
  if (!s) return null;

  // WCA person URL
  const mPerson = s.match(/worldcubeassociation\.org\/persons\/([A-Za-z0-9]+)/i);
  if (mPerson) {
    return {
      kind: 'wca-person',
      route: `/wca/persons/${mPerson[1]}`,
      labelZh: '选手页',
      labelEn: 'Person'
    };
  }

  // WCA comp URL
  const compRoute = rewriteWcaCompUrl(s);
  if (compRoute) {
    return { kind: 'wca-comp', route: compRoute, labelZh: '比赛页', labelEn: 'Competition'
    };
  }

  // cubing.com 比赛页
  const mCubingCom = s.match(/cubing\.com\/(?:comp|competitions?)\/([A-Za-z0-9_-]+)/i);
  if (mCubingCom) {
    return {
      kind: 'cubing-com-comp',
      route: `/wca/comp/${mCubingCom[1]}`,
      labelZh: '比赛页',
      labelEn: 'Competition'
    };
  }

  // YouTube / Twitch 视频 → 数帧 (拖文件更直接,链接先放着待开发,目前路由到 frame-count 让用户手动粘)
  if (/(?:youtube\.com\/watch|youtu\.be\/|twitch\.tv\/videos\/)/i.test(s)) {
    return { kind: 'youtube', route: '/frame-count', labelZh: '数帧', labelEn: 'Frame count'
    };
  }

  // 3x3 scramble / alg (>= 6 tokens, >= 70% 合法 move 记号)
  if (looksLikeScramble(s)) {
    const enc = encodeURIComponent(s.replace(/\s+/g, ' '));
    return {
      kind: 'scramble',
      route: `/scramble/analyzer?scramble=${enc}`,
      labelZh: '打乱分析',
      labelEn: 'Analyzer'
    };
  }

  return null;
}

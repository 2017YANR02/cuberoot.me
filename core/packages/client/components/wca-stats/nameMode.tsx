'use client';

// 姓名口径(英文名 / 全名 / 本地名 / 含曾用名)——姓名分布 + 排名页名录共用。
// WCA 名形如 "Latin (本地名)";含曾用名口径下现名为全名、曾用名(改名前)单独带标签弱化显示。
import { tr } from '@/i18n/tr';
import { stripChineseParens } from '@/lib/cuber-name-display';
import './name-mode.css';

export type NameMode = 'latin' | 'full' | 'local' | 'aka';
export const NAME_MODES: NameMode[] = ['latin', 'full', 'local', 'aka'];

/** 末尾括号内的本地名(无则空串) */
export function localPart(n: string): string {
  const m = n.match(/\(([^)]*)\)\s*$/);
  return m ? m[1].trim() : '';
}

/** 按口径取「现名」显示串(aka 的现名 = 全名,曾用名另渲染) */
export function nameByMode(n: string, mode: NameMode): string {
  if (mode === 'full' || mode === 'aka') return n;
  if (mode === 'local') return localPart(n) || stripChineseParens(n);
  return stripChineseParens(n);
}

/** 口径切换器的选项(标签 / 悬浮说明,走 tr) */
export function nameModeOptions(): { id: NameMode; label: string; title: string }[] {
  return [
    { id: 'latin', label: tr({ zh: '英文名', en: 'Latin name' }), title: tr({ zh: '去掉括号,只看拉丁名', en: 'Latin name only (drop parentheses)' }) },
    { id: 'full', label: tr({ zh: '全名', en: 'Full name' }), title: tr({ zh: '完整 WCA 名(拉丁名 + 括号内本地名)', en: 'Full WCA name (Latin + parenthesized local name)' }) },
    { id: 'local', label: tr({ zh: '本地名', en: 'Local name' }), title: tr({ zh: '只看括号内的本地名(仅有本地名的选手)', en: 'Parenthesized local name only (competitors who have one)' }) },
    { id: 'aka', label: tr({ zh: '含曾用名', en: 'With former names' }), title: tr({ zh: '全名 + 历史曾用名(改名前的名字)', en: 'Full name plus former names (pre-rename)' }) },
  ];
}

/** 现名后跟随的曾用名(弱化 + 标签),含曾用名口径下用 */
export function FormerNames({ former }: { former?: string[] }) {
  if (!former || !former.length) return null;
  return (
    <>
      {former.map((f, i) => (
        <span className="ns-former" key={i}>
          <span className="ns-former-tag">{tr({ zh: '曾用名', en: 'formerly' })}</span>
          {f}
        </span>
      ))}
    </>
  );
}

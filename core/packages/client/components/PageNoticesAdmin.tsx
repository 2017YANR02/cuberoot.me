'use client';

/**
 * 个人页给**管理员**的页面通知总览 —— 全站哪些页挂着通知条(维护中 / WIP / 已知 bug),
 * 一眼看全,点一下跳过去。挂了通知的页容易忘掉,靠逐页翻是找不回来的。
 *
 * 只有管理员看得见(别人不渲染、也不请求)。数据走 /v1/page-notices/manage(含 disabled),
 * 与横幅本体同一张表;**编辑仍在目标页顶部的横幅上做** —— 那里所见即所得,这里只负责
 * 「有哪些 + 在哪」,不再复制一份编辑器。
 *
 * 跳转用真 <a>(AppLink),中键能新开。前缀模式 `/foo/*` 跳到 `/foo`;全站 `/*` 无处可跳,
 * 不给链接。
 */
import { useCallback, useEffect, useState } from 'react';
import { ChevronRight, Megaphone, RefreshCw } from 'lucide-react';
import AppLink from '@/components/AppLink';
import { useIsAdmin } from '@/lib/auth-store';
import { fetchAllPageNotices, type PageNotice } from '@/lib/page-notices-api';
import { colorFor, iconFor } from '@/lib/page-notice-visuals';
import { tr, useLang } from '@/i18n/tr';
import './page-notices-admin.css';

/** 通知的 path 模式 → 可跳的站内地址;全站模式没有对应页面,返回 null。 */
function hrefFor(path: string): string | null {
  if (path === '/*') return null;
  if (path.endsWith('/*')) return path.slice(0, -2) || '/';
  return path;
}

export default function PageNoticesAdmin() {
  const isAdmin = useIsAdmin();
  const lang = useLang();
  const [items, setItems] = useState<PageNotice[] | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await fetchAllPageNotices();
      // 启用的排前面(要盯的是这些),其次按路径 —— 同一分组内路径序读起来像站点结构。
      rows.sort((a, b) => Number(b.enabled) - Number(a.enabled) || a.path.localeCompare(b.path));
      setItems(rows);
    } catch (e) {
      console.warn('[page-notices] 拉取失败', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) void load();
  }, [isAdmin, load]);

  if (!isAdmin) return null;

  const total = items?.length ?? 0;
  const off = items?.filter((n) => !n.enabled).length ?? 0;

  return (
    <section className="pna-section">
      <h2 className="pna-head">
        <Megaphone size={15} className="pna-icon" />
        <span>{tr({ zh: '页面通知', en: 'Page notices' })}</span>
        {items !== null && (
          <span className="pna-count">
            {total === 0
              ? tr({ zh: '无', en: 'None' })
              : off > 0
                ? tr({ zh: `${total} 条,${off} 条已停用`, en: `${total}, ${off} disabled` })
                : tr({ zh: `${total} 条`, en: `${total} active` })}
          </span>
        )}
        <button
          type="button"
          className="pna-refresh"
          onClick={() => void load()}
          disabled={loading}
          title={tr({ zh: '刷新', en: 'Refresh' })}
          aria-label={tr({ zh: '刷新', en: 'Refresh' })}
        >
          <RefreshCw size={13} className={loading ? 'pna-spin' : undefined} />
        </button>
      </h2>

      {items !== null && total > 0 && (
        <ul className="pna-list">
          {items.map((n) => {
            const Icon = iconFor(n);
            const href = hrefFor(n.path);
            const body = (lang === 'en' ? (n.bodyEn || n.bodyZh) : (n.bodyZh || n.bodyEn));
            const inner = (
              <>
                <Icon size={14} className="pna-row-icon" />
                <code className="pna-row-path">
                  {n.path === '/*' ? tr({ zh: '全站', en: 'Whole site' }) : n.path}
                </code>
                <span className="pna-row-body">{body}</span>
                {!n.enabled && (
                  <span className="pna-tag">{tr({ zh: '已停用', en: 'Disabled' })}</span>
                )}
                {n.enabled && !n.dismissible && (
                  <span className="pna-tag">{tr({ zh: '不可关闭', en: 'Not dismissible' })}</span>
                )}
                {href && <ChevronRight size={13} className="pna-row-chev" />}
              </>
            );
            return (
              <li key={n.id} className="pna-item" style={{ '--pna-c': colorFor(n) } as React.CSSProperties}>
                {href
                  ? <AppLink href={href} className="pna-row" prefetch={false}>{inner}</AppLink>
                  : <div className="pna-row is-static">{inner}</div>}
              </li>
            );
          })}
        </ul>
      )}

      {items !== null && total > 0 && (
        <p className="pna-hint">
          {tr({
            zh: '改内容 / 停用 / 删除:点进去,在那页顶部的通知条上直接编辑。',
            en: 'To edit, disable or delete: open the page and use the notice bar at its top.',
          })}
        </p>
      )}
    </section>
  );
}

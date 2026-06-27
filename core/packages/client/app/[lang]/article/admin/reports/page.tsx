'use client';

/**
 * /article/admin/reports — admin 审核页(被举报文章聚合)。
 *
 * 仅 admin 可见(isAdminWcaId 门控,登录态读自 auth-store);非 admin / 未登录直接早返。
 * 列出被举报文章(reportCount / reporterCount / 最近举报理由 + 时间),admin 可一键删文。
 * 安全:lastReason 是 untrusted 用户输入,只能作纯 React 文本节点渲染,禁 dangerouslySetInnerHTML。
 * 双主题走 globals.css token;双语走 useTranslation + isZh + i18n key(article.*)。
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Link from 'next/link';
import { ChevronLeft, Trash2 } from 'lucide-react';
import HomeLink from '@/components/HomeLink';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useAuthStore } from '@/lib/auth-store';
import { isAdminWcaId } from '@cuberoot/shared/admin';
import { displayCuberName } from '@/lib/cuber-name-display';
import { fetchArticleReports, deleteArticle, type ArticleReportRow } from '@/lib/article-api';
import './reports.css';
import { tr } from '@/i18n/tr';

export default function ArticleReportsPage() {
  const { t, i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  useDocumentTitle(t('article.adminReports'), t('article.adminReports'));

  const user = useAuthStore((s) => s.user);
  const admin = isAdminWcaId(user?.wcaId);
  const langPrefix = (i18n.language.startsWith('zh') ? 'zh' : 'en');

  const [rows, setRows] = useState<ArticleReportRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    if (!admin) return;
    let cancelled = false;
    fetchArticleReports()
      .then((list) => {
        if (!cancelled) setRows(list);
      })
      .catch((e) => {
        if (!cancelled) setErr(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [admin]);

  // 非 admin(含未登录)→ 最小化未授权提示 + 回首页,早返。
  if (!admin) {
    return (
      <div className="article-reports-page article-reports-denied">
        <p className="article-reports-denied-msg">{t('article.adminNotAuthorized')}</p>
        <HomeLink className="article-reports-back">
          <ChevronLeft size={16} />
          <span>{tr({ zh: '首页', en: 'Home'
        })}</span>
        </HomeLink>
      </div>
    );
  }

  async function handleDelete(slug: string) {
    if (!window.confirm(t('article.deleteConfirm'))) return;
    setDeleting(slug);
    setErr(null);
    try {
      await deleteArticle(slug);
      const list = await fetchArticleReports();
      setRows(list);
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('article.deleteFailed'));
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="article-reports-page">
      <header className="article-reports-header">
        <HomeLink className="article-reports-back">
          <ChevronLeft size={16} />
          <span>{tr({ zh: '首页', en: 'Home'
        })}</span>
        </HomeLink>
        <Link href={`/${langPrefix}/article`} className="article-reports-breadcrumb">
          {t('article.backToList')}
        </Link>
      </header>

      <h1 className="article-reports-title">{t('article.adminReports')}</h1>

      {err && <div className="article-reports-error">{err}</div>}

      {!rows && !err && <div className="article-reports-empty">{t('article.loading')}</div>}

      {rows && rows.length === 0 && (
        <div className="article-reports-empty">{t('article.adminReportsEmpty')}</div>
      )}

      {rows && rows.length > 0 && (
        <div className="article-reports-scroll">
          <table className="article-reports-table">
            <thead>
              <tr>
                <th>{t('article.adminColArticle')}</th>
                <th>{t('article.adminColAuthor')}</th>
                <th className="ar-num">{t('article.adminColReports')}</th>
                <th className="ar-reason">{t('article.adminColLastReason')}</th>
                <th>{t('article.adminColLastReported')}</th>
                <th className="ar-action" aria-hidden="true" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.slug} className={row.deletedAt ? 'ar-row-deleted' : undefined}>
                  <td data-label={t('article.adminColArticle')}>
                    <Link href={`/${langPrefix}/article/${row.slug}`} className="ar-title-link">
                      {row.title}
                    </Link>
                  </td>
                  <td data-label={t('article.adminColAuthor')}>
                    {displayCuberName(row.authorName, isZh)}
                  </td>
                  <td className="ar-num" data-label={t('article.adminColReports')}>
                    {row.reportCount}
                  </td>
                  <td className="ar-reason" data-label={t('article.adminColLastReason')}>
                    {/* SECURITY: untrusted 用户输入,纯文本节点渲染,禁 dangerouslySetInnerHTML。 */}
                    {row.lastReason ?? '—'}
                  </td>
                  <td data-label={t('article.adminColLastReported')}>
                    {row.lastReportedAt.slice(0, 10)}
                  </td>
                  <td className="ar-action">
                    {row.deletedAt ? (
                      <span className="ar-deleted-badge">{t('article.adminDeleted')}</span>
                    ) : (
                      <button
                        type="button"
                        className="ar-delete-btn"
                        onClick={() => handleDelete(row.slug)}
                        disabled={deleting === row.slug}
                        title={t('article.adminDelete')}
                      >
                        <Trash2 size={15} />
                        <span>{t('article.adminDelete')}</span>
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

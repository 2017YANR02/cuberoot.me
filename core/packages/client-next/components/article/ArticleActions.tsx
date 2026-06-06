'use client';

/**
 * /article/[slug] 阅读页底栏交互(client island)。
 *
 * SERVER 阅读页是 SSG/ISR、纯渲染;owner/admin 的 Edit/Delete 与登录用户的 Report
 * 依赖 auth store(localStorage)+ 写接口,必须在 client 跑,故抽成这一座岛。
 *
 *   - owner(user.wcaId === authorWcaId)或 admin → Edit 链接 + Delete 按钮。
 *   - 已登录但非 owner → Report 控件(内联面板,可选 reason)。
 *   - 未登录 → 渲染 null。
 *
 * 所有文案走 t('article.*'),颜色全 token(危险态走 --destructive)。
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Pencil, Trash2, Flag } from 'lucide-react';
import { useAuthStore } from '@/lib/auth-store';
import { isAdminWcaId } from '@cuberoot/shared/admin';
import { deleteArticle, reportArticle } from '@/lib/article-api';

interface ArticleActionsProps {
  slug: string;
  authorWcaId: string;
  lang: string;
}

export default function ArticleActions({ slug, authorWcaId, lang }: ArticleActionsProps) {
  const { t, i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh') || lang.startsWith('zh');
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  const [busy, setBusy] = useState(false);
  const [actionErr, setActionErr] = useState<string | null>(null);

  // report 面板状态
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportDone, setReportDone] = useState(false);
  const [reportErr, setReportErr] = useState<string | null>(null);

  if (!user) return null;

  const langPrefix = isZh ? 'zh' : 'en';
  const canManage = user.wcaId === authorWcaId || isAdminWcaId(user.wcaId);

  async function onDelete() {
    if (busy) return;
    if (!window.confirm(t('article.deleteConfirm'))) return;
    setBusy(true);
    setActionErr(null);
    try {
      await deleteArticle(slug);
      router.push(`/${langPrefix}/article`);
    } catch (e) {
      setBusy(false);
      setActionErr(`${t('article.deleteFailed')}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  async function onSubmitReport() {
    if (busy) return;
    setBusy(true);
    setReportErr(null);
    try {
      await reportArticle(slug, reportReason.trim() || undefined);
      setReportDone(true);
      setReportOpen(false);
    } catch (e) {
      setReportErr(`${t('article.reportFailed')}: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  if (canManage) {
    return (
      <div className="article-actions">
        <Link href={`/${langPrefix}/article/${slug}/edit`} className="article-action-link">
          <Pencil size={15} />
          <span>{t('article.edit')}</span>
        </Link>
        <button
          type="button"
          className="article-action-danger"
          onClick={onDelete}
          disabled={busy}
        >
          <Trash2 size={15} />
          <span>{t('article.delete')}</span>
        </button>
        {actionErr && <span className="article-action-err">{actionErr}</span>}
      </div>
    );
  }

  // 已登录、非 owner、非 admin → 举报
  if (reportDone) {
    return <div className="article-actions article-report-thanks">{t('article.reportThanks')}</div>;
  }

  return (
    <div className="article-actions">
      {!reportOpen ? (
        <button
          type="button"
          className="article-action-link"
          onClick={() => {
            setReportOpen(true);
            setReportErr(null);
          }}
        >
          <Flag size={15} />
          <span>{t('article.report')}</span>
        </button>
      ) : (
        <div className="article-report-panel">
          <label className="article-report-label" htmlFor="article-report-reason">
            {t('article.reportReason')}
          </label>
          <textarea
            id="article-report-reason"
            className="article-report-textarea"
            value={reportReason}
            onChange={(e) => setReportReason(e.target.value)}
            placeholder={t('article.reportPlaceholder')}
            rows={3}
          />
          <div className="article-report-buttons">
            <button
              type="button"
              className="article-report-submit"
              onClick={onSubmitReport}
              disabled={busy}
            >
              {t('article.reportSubmit')}
            </button>
            <button
              type="button"
              className="article-report-cancel"
              onClick={() => {
                setReportOpen(false);
                setReportReason('');
                setReportErr(null);
              }}
              disabled={busy}
            >
              {t('article.cancel')}
            </button>
          </div>
          {reportErr && <span className="article-action-err">{reportErr}</span>}
        </div>
      )}
    </div>
  );
}

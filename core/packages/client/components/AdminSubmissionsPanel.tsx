'use client';

/**
 * 管理员「新公式投稿」下拉面板 —— 桌宠角标点开。
 * 挂载即拉最近投稿 + 标记已读(角标回落 0)。每条链到对应 case 的 alg 页。
 * DeskPet 在 I18nProvider 外,故文案 / 链接前缀都靠 lang prop,不用 react-i18next / AppLink。
 */
import { useEffect, useState } from 'react';
import NextLink from 'next/link';
import { X, Inbox } from 'lucide-react';
import type { AlgSubmission } from '@cuberoot/shared';
import { fetchRecentSubmissions, markSubmissionsSeen } from '@/lib/alg_api';
import { setAlgSubmissionUnread } from '@/lib/alg-submission-unread';
import { displayCuberName } from '@/lib/cuber-name-display';

const CSS = `
.alg-subnotify-backdrop{position:fixed;inset:0;z-index:2147483600;background:transparent;}
.alg-subnotify{position:fixed;z-index:2147483601;left:16px;bottom:84px;width:min(360px,calc(100vw - 32px));
  max-height:60vh;display:flex;flex-direction:column;background:var(--popover,var(--background));
  color:var(--foreground);border:1px solid var(--border);border-radius:12px;
  box-shadow:0 10px 40px rgba(0,0,0,.28);overflow:hidden;}
.alg-subnotify-head{display:flex;align-items:center;gap:8px;padding:10px 12px;border-bottom:1px solid var(--border);
  font-weight:600;font-size:14px;flex-shrink:0;}
.alg-subnotify-head .sn-spacer{flex:1;}
.alg-subnotify-head button{display:flex;align-items:center;justify-content:center;width:26px;height:26px;
  border:none;background:none;color:var(--muted-foreground);border-radius:6px;cursor:pointer;}
.alg-subnotify-head button:hover{background:var(--accent-soft);color:var(--foreground);}
.alg-subnotify-list{overflow-y:auto;padding:4px;}
.alg-subnotify-empty{display:flex;flex-direction:column;align-items:center;gap:8px;
  padding:28px 12px;color:var(--muted-foreground);font-size:13px;}
.alg-subnotify-row{display:block;padding:8px 10px;border-radius:8px;text-decoration:none;color:inherit;}
.alg-subnotify-row:hover{background:var(--accent-soft);}
.alg-subnotify-row + .alg-subnotify-row{border-top:1px solid color-mix(in srgb,var(--border) 60%,transparent);}
.sn-top{display:flex;align-items:baseline;gap:6px;font-size:11px;color:var(--muted-foreground);margin-bottom:2px;}
.sn-case{font-weight:600;color:var(--accent);}
.sn-time{margin-left:auto;flex-shrink:0;}
.sn-alg{font-family:Consolas,monospace;font-size:12.5px;color:var(--foreground);word-break:break-word;}
.sn-author{font-size:11px;color:var(--muted-foreground);margin-top:2px;}
.sn-notes{font-size:11px;color:var(--muted-foreground);margin-top:1px;font-style:italic;}
@media (max-width:480px){
  .alg-subnotify{left:8px;right:8px;width:auto;bottom:72px;max-height:66vh;}
}
`;

interface Props {
  lang: 'zh' | 'en';
  onClose: () => void;
}

export default function AdminSubmissionsPanel({ lang, onClose }: Props) {
  const isZh = lang === 'zh';
  const t = (zh: string, en: string) => (isZh ? zh : en);
  const [items, setItems] = useState<AlgSubmission[] | null>(null);

  useEffect(() => {
    let alive = true;
    fetchRecentSubmissions(30)
      .then(rows => { if (alive) setItems(rows); })
      .catch(() => { if (alive) setItems([]); });
    // 打开即视为已读
    markSubmissionsSeen();
    setAlgSubmissionUnread(0);
    return () => { alive = false; };
  }, []);

  const prefix = isZh ? '/zh' : '';

  return (
    <>
      <style>{CSS}</style>
      <div className="alg-subnotify-backdrop" onClick={onClose} />
      <div className="alg-subnotify" role="dialog" aria-modal="true">
        <div className="alg-subnotify-head">
          <Inbox size={15} />
          <span>{t('新公式投稿', 'New alg submissions')}</span>
          <span className="sn-spacer" />
          <button type="button" onClick={onClose} title={t('关闭', 'Close')} aria-label={t('关闭', 'Close')}>
            <X size={16} />
          </button>
        </div>
        <div className="alg-subnotify-list">
          {items === null && (
            <div className="alg-subnotify-empty">{t('加载中…', 'Loading…')}</div>
          )}
          {items !== null && items.length === 0 && (
            <div className="alg-subnotify-empty">
              <Inbox size={28} strokeWidth={1.4} />
              {t('暂无投稿', 'No submissions yet')}
            </div>
          )}
          {items?.map(s => (
            <NextLink
              key={s.id}
              href={`${prefix}/alg/${s.puzzle}/${s.setSlug}`}
              className="alg-subnotify-row"
              onClick={onClose}
            >
              <div className="sn-top">
                <span className="sn-case">
                  {s.puzzle}{' '}
                  {s.caseName.toLowerCase().includes(s.setSlug.toLowerCase())
                    ? s.caseName
                    : `${s.setSlug.toUpperCase()} ${s.caseName}`}
                </span>
                <span className="sn-time">{s.createdAt.slice(0, 16).replace('T', ' ')}</span>
              </div>
              <div className="sn-alg">{s.alg}</div>
              <div className="sn-author">{t('投稿者', 'by')}: {displayCuberName(s.authorName, isZh)}</div>
              {s.notes && <div className="sn-notes">{s.notes}</div>}
            </NextLink>
          ))}
        </div>
      </div>
    </>
  );
}

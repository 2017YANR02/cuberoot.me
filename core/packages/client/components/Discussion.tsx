'use client';

/**
 * 评论 / 另解 共用 UI 原子
 * NOTE: 两边都是"已登录用户的评论流"形态——头像 + 作者元信息 + body + 三点菜单。
 *       这里抽 3 块小组件,具体的 body 渲染、reply/pin 等 list-specific 逻辑各自处理。
 */
import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Key, MoreVertical } from 'lucide-react';
import { useAuthStore } from '@/lib/auth-store';
import { displayCuberName } from '@/lib/cuber-name-display';
import { Flag } from '@/components/Flag';
import { wcaPersonUrl } from '@/lib/recon-utils';
import { personFlagIso2 } from '@/lib/country-flags';
import { toIsoDate } from '@/lib/wca-date';

/** textarea 高度跟随内容——空时 1 行,粘贴长解法时自动撑开 */
function autoResize(el: HTMLTextAreaElement | null) {
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = el.scrollHeight + 'px';
}

/**
 * 提交框 —— YouTube 风格
 * 未登录显示登录提示;登录态显示头像 + 自适应高度的 textarea + 取消/提交按钮。
 * 父组件控制 value;onSubmit 抛错走 alert,resolve 后自动收起。
 */
export function DiscussionComposer({
  value, onChange, onSubmit, onCancel,
  placeholder, submitLabel, loginHint,
  mono, autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => Promise<void>;
  /** 取消按钮回调;不传则默认 onChange('') + 收起 */
  onCancel?: () => void;
  placeholder: string;
  submitLabel: string;
  loginHint: string;
  /** alt 用 mono 字体(粘贴解法对齐) */
  mono?: boolean;
  autoFocus?: boolean;
}) {
  const { t } = useTranslation();
  const user = useAuthStore(s => s.user);
  const currentWcaId = user?.wcaId || '';
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const expanded = open || !!value;

  if (!currentWcaId) {
    return (
      <div
        className="detail-comment-login-hint"
        onClick={() => useAuthStore.getState().login()}
        style={{ cursor: 'pointer' }}
      >
        <Key size={16} /> {loginHint}
      </div>
    );
  }

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    } else {
      onChange('');
      setOpen(false);
    }
  };

  const handleSubmit = async () => {
    if (!value.trim() || submitting) return;
    setSubmitting(true);
    try {
      await onSubmit();
      setOpen(false);
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={`yt-composer${expanded ? ' yt-composer-active' : ''}`}>
      {user?.avatar ? (
        <img src={user.avatar} alt="" className="yt-composer-avatar" />
      ) : (
        <div className="yt-composer-avatar yt-composer-avatar-fallback">
          {user?.name?.[0]?.toUpperCase() || '?'}
        </div>
      )}
      <div className="yt-composer-body">
        <textarea
          className={`yt-composer-input${mono ? ' alt-composer-input' : ''}`}
          value={value}
          ref={autoResize}
          onChange={(e) => { onChange(e.target.value); autoResize(e.currentTarget); }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          rows={1}
          autoFocus={autoFocus}
        />
        {expanded && (
          <div className="yt-composer-actions">
            <div />
            <div className="yt-composer-buttons">
              <button type="button" className="yt-btn-text" onClick={handleCancel}>
                {t('recon.cancel')}
              </button>
              <button
                type="button"
                className="yt-btn-primary"
                onClick={handleSubmit}
                disabled={submitting || !value.trim()}
              >
                {submitting ? t('recon.posting') : submitLabel}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** 编辑模式的 textarea + 取消/保存按钮(评论 / 另解都用) */
export function DiscussionEditBox({
  value, onChange, onSave, onCancel, mono, autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  onSave: () => void;
  onCancel: () => void;
  mono?: boolean;
  autoFocus?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div className="yt-comment-edit">
      <textarea
        className={`yt-composer-input${mono ? ' alt-composer-input' : ''}`}
        value={value}
        ref={autoResize}
        onChange={(e) => { onChange(e.target.value); autoResize(e.currentTarget); }}
        rows={1}
        autoFocus={autoFocus}
      />
      <div className="yt-composer-actions">
        <div />
        <div className="yt-composer-buttons">
          <button type="button" className="yt-btn-text" onClick={onCancel}>
            {t('recon.cancel')}
          </button>
          <button
            type="button"
            className="yt-btn-primary"
            onClick={onSave}
            disabled={!value.trim()}
          >
            {t('recon.save')}
          </button>
        </div>
      </div>
    </div>
  );
}

/** 作者元信息条:国旗 + 名字(链到 WCA profile)+ 时间戳 */
export function UserHeadline({
  authorId, authorName, createdAt, suffix,
}: {
  authorId: string | undefined | null;
  authorName: string | undefined | null;
  createdAt: number;
  /** 时间戳后追加文本(如 "(已编辑)") */
  suffix?: ReactNode;
}) {
  const { i18n } = useTranslation();
  const isZh = i18n.language === 'zh';
  const displayName = displayCuberName(authorName || '', isZh);
  return (
    <div className="yt-comment-meta">
      {authorId && <Flag iso2={personFlagIso2(authorId)} className="yt-comment-flag" />}
      {authorId ? (
        <a href={wcaPersonUrl(authorId)} target="_blank" rel="noopener noreferrer" className="yt-comment-author">
          {displayName}
        </a>
      ) : <span className="yt-comment-author">{displayName}</span>}
      <span className="yt-comment-time">
        {toIsoDate(new Date(createdAt * 1000))}
        {suffix}
      </span>
    </div>
  );
}

/**
 * 三点菜单 —— 任意 actions 数组渲染成下拉
 * 自带:外面任意位置点击关闭。
 */
export function ItemMenu({ items }: { items: Array<{ icon: ReactNode; label: string; onClick: () => void }> }) {
  const [open, setOpen] = useState(false);

  // NOTE: 点空白关菜单
  useEffect(() => {
    if (!open) return;
    const h = () => setOpen(false);
    const t = setTimeout(() => document.addEventListener('click', h), 0);
    return () => { clearTimeout(t); document.removeEventListener('click', h); };
  }, [open]);

  if (items.length === 0) return null;

  return (
    <div className="yt-comment-menu-wrap" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        className="yt-comment-menu-btn"
        onClick={() => setOpen(o => !o)}
      >
        <MoreVertical size={18} />
      </button>
      {open && (
        <div className="yt-comment-menu">
          {items.map((it, i) => (
            <button key={i} type="button" onClick={() => { setOpen(false); it.onClick(); }}>
              {it.icon} {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** 头像 fallback —— 圆形首字母色块,avatar URL 优先 */
export function UserAvatarFallback({ name, avatar }: { name?: string | null; avatar?: string | null }) {
  if (avatar) return <img src={avatar} alt="" className="yt-comment-avatar" />;
  return (
    <div className="yt-comment-avatar yt-comment-avatar-fallback">
      {name?.[0]?.toUpperCase() || '?'}
    </div>
  );
}


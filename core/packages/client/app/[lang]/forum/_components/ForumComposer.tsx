'use client';

// Post/reply composer: login-gated textarea with a markdown preview toggle.
// Controlled value so the thread page can inject quote blocks.

import { useRef, useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Key, Eye, Pencil } from 'lucide-react';
import { tr } from '@/i18n/tr';
import { useAuthStore, useAuthUser } from '@/lib/auth-store';
import { renderArticleMarkdown } from '@/lib/article-markdown';

export interface ForumComposerHandle {
  focus: () => void;
}

export const MAX_POST_LEN = 50000;

export const ForumComposer = forwardRef<ForumComposerHandle, {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => Promise<void>;
  submitLabel: string;
  placeholder?: string;
  /** Extra content rendered to the left of the submit button (e.g. cancel). */
  extraActions?: React.ReactNode;
  minRows?: number;
}>(function ForumComposer({ value, onChange, onSubmit, submitLabel, placeholder, extraActions, minRows = 4 }, ref) {
  const user = useAuthUser();
  const [preview, setPreview] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const taRef = useRef<HTMLTextAreaElement>(null);

  useImperativeHandle(ref, () => ({
    focus: () => {
      taRef.current?.focus();
      taRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    },
  }), []);

  // Auto-grow with content.
  useEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.max(el.scrollHeight, minRows * 22) + 'px';
  }, [value, preview, minRows]);

  if (!user) {
    return (
      <button
        type="button"
        className="forum-login-hint"
        onClick={() => useAuthStore.getState().login()}
      >
        <Key size={15} aria-hidden="true" />
        {tr({ zh: '登录后参与讨论', en: 'Log in to join the discussion' })}
      </button>
    );
  }

  const handleSubmit = async () => {
    const text = value.trim();
    if (!text || submitting) return;
    if (text.length > MAX_POST_LEN) {
      setError(tr({ zh: `内容超过 ${MAX_POST_LEN} 字上限`, en: `Content exceeds ${MAX_POST_LEN} characters` }));
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await onSubmit();
      setPreview(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="forum-composer">
      <div className="forum-composer-tabs">
        <button
          type="button"
          className={`forum-tab-btn${!preview ? ' active' : ''}`}
          onClick={() => setPreview(false)}
        >
          <Pencil size={13} aria-hidden="true" /> {tr({ zh: '编辑', en: 'Write' })}
        </button>
        <button
          type="button"
          className={`forum-tab-btn${preview ? ' active' : ''}`}
          onClick={() => setPreview(true)}
        >
          <Eye size={13} aria-hidden="true" /> {tr({ zh: '预览', en: 'Preview' })}
        </button>
        <span className="forum-composer-hint">
          {tr({ zh: '支持 Markdown', en: 'Markdown supported' })}
        </span>
      </div>
      {preview ? (
        <div className="forum-post-body forum-composer-preview">
          {value.trim()
            ? renderArticleMarkdown(value)
            : <p className="forum-composer-empty">{tr({ zh: '没有内容可预览', en: 'Nothing to preview' })}</p>}
        </div>
      ) : (
        <textarea
          ref={taRef}
          className="forum-composer-input"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder ?? tr({ zh: '写点什么…', en: 'Write something…' })}
          rows={minRows}
          maxLength={MAX_POST_LEN + 1000}
        />
      )}
      <div className="forum-composer-actions">
        {error && <span className="forum-composer-error">{error}</span>}
        <span className="forum-composer-spacer" />
        {extraActions}
        <button
          type="button"
          className="forum-btn-primary"
          onClick={handleSubmit}
          disabled={submitting || !value.trim()}
        >
          {submitting ? tr({ zh: '提交中…', en: 'Posting…' }) : submitLabel}
        </button>
      </div>
    </div>
  );
});

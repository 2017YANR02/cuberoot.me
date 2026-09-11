'use client';

// Post/reply composer: login-gated rich markdown editor (toolbar + directives +
// image upload + live preview, shared with /forum/new). Controlled value so the
// thread page can inject quote blocks; focus() delegates to the editor.

import { useRef, useState, forwardRef, useImperativeHandle } from 'react';
import AppLink from '@/components/AppLink';
import { Key } from 'lucide-react';
import { tr } from '@/i18n/tr';
import { useAuthStore, useAuthUser } from '@/lib/auth-store';
import { ForumMarkdownEditor, type ForumEditorHandle } from './ForumMarkdownEditor';

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
}>(function ForumComposer({ value, onChange, onSubmit, submitLabel, placeholder, extraActions }, ref) {
  const user = useAuthUser();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const editorRef = useRef<ForumEditorHandle>(null);

  useImperativeHandle(ref, () => ({
    focus: () => editorRef.current?.focus(),
  }), []);

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
    } catch (e) {
      setError((e as Error).message === 'FORUM_BANNED'
        ? tr({ zh: '你的账号已被禁止在论坛发帖和评论。', en: 'Your account is banned from posting and commenting in the forum.' })
        : (e as Error).message === 'FORUM_PROFILE_INCOMPLETE'
        ? tr({ zh: '请先完善并保存姓名、出生日期、性别、国家及可选的省份和城市，再提交评论。', en: 'Save your name, birth date, gender, country and available state and city selections before commenting.' })
        : (e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="forum-composer">
      <p className="forum-login-hint">
        {tr({ zh: '新参与论坛的用户，评论前请完整填写并保存个人资料；新规前已发帖或评论的用户不受影响。', en: 'New participants must complete and save their profile before commenting. Earlier contributors are exempt.' })}{' '}
        <AppLink href="/account?view=signin" prefetch={false} target="_blank" rel="noopener noreferrer">
          {tr({ zh: '完善个人资料', en: 'Complete profile' })}
        </AppLink>
      </p>
      <ForumMarkdownEditor
        ref={editorRef}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
      />
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

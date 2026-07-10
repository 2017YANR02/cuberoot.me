'use client';

// Post/reply composer: login-gated rich markdown editor (toolbar + directives +
// image upload + live preview, shared with /forum/new). Controlled value so the
// thread page can inject quote blocks; focus() delegates to the editor.

import { useRef, useState, forwardRef, useImperativeHandle } from 'react';
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
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="forum-composer">
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

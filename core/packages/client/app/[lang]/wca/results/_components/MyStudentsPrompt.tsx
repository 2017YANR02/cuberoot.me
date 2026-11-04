'use client';

import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import AppLink from '@/components/AppLink';
import { useModalDismiss } from '@/hooks/useModalDismiss';
import { tr } from '@/i18n/tr';
import '@/components/wca-teacher-cell.css';

export default function MyStudentsPrompt({ loggedIn, needsWcaId, loading, onClose, onContinue }: {
  loggedIn: boolean; needsWcaId: boolean; loading: boolean; onClose: () => void; onContinue: () => void;
}) {
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const backdrop = useModalDismiss(onClose);
  useEffect(() => {
    const previous = document.activeElement;
    panel.current?.querySelector<HTMLButtonElement>('button')?.focus();
    return () => { if (previous instanceof HTMLElement && previous.isConnected) previous.focus(); };
  }, []);
  return createPortal(<div className="wca-teacher-dialog-layer" {...backdrop}>
    <div ref={panel} className="wca-teacher-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId}
      onKeyDown={event => {
        if (event.key !== 'Tab') return;
        const items = panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled),a[href]');
        if (!items?.length) return;
        const first = items[0], last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }}>
      <div className="wca-teacher-dialog-heading"><h2 id={titleId}>{tr({ zh: '我的学生', en: 'My students' })}</h2></div>
      <p>{tr(needsWcaId
        ? { zh: '绑定 WCA ID，即可查看我的学生。', en: 'Link your WCA ID to view your students.' }
        : loggedIn
          ? { zh: '开通会员，即可查看我的学生成绩。', en: 'Become a member to view your students’ results.' }
          : { zh: '登录会员账号，即可查看我的学生成绩。', en: 'Sign in with a membership to view your students’ results.' })}</p>
      <div className="wca-teacher-dialog-actions">
        <button type="button" onClick={onClose}>{tr({ zh: '取消', en: 'Cancel' })}</button>
        {needsWcaId ? <AppLink href={`/account?next=${encodeURIComponent(window.location.pathname + window.location.search + window.location.hash)}`} prefetch={false} className="wca-teacher-dialog-primary">{tr({ zh: '绑定 WCA ID', en: 'Link WCA ID' })}</AppLink>
          : <button type="button" className="wca-teacher-dialog-primary" disabled={loading} onClick={onContinue}>{tr(loading
            ? { zh: '正在检查会员状态…', en: 'Checking membership…' }
            : loggedIn ? { zh: '开通会员', en: 'Become a member' } : { zh: '登录并开通会员', en: 'Sign in to continue' })}</button>}
      </div>
    </div>
  </div>, document.body);
}

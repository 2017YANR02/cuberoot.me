'use client';

import { useEffect, useState } from 'react';
import { tr } from '@/i18n/tr';
import { changeAppLanguage } from '@/i18n/i18n-client';
import { getSessionToken, safeNext } from '@/lib/auth-store';
import { syncPageSessionCookie } from '@/lib/home-card-access';
import { isCompSimPage, verifyPageRole, verifyPageAdmin, verifyForumPageAccess } from '@/lib/page-admin-session';
import { AuthCallbackStatus } from '../_components/AuthCallbackStatus';

export default function PageAccess() {
  const [error, setError] = useState('');
  const [login, setLogin] = useState('/account');
  const [profileRequired, setProfileRequired] = useState(false);
  useEffect(() => {
    let active = true;
    const next = safeNext(new URLSearchParams(window.location.search).get('next')) || '/';
    const prefix = next === '/zh' || next.startsWith('/zh/') ? '/zh' : '';
    changeAppLanguage(prefix ? 'zh' : 'en');
    setLogin(`${prefix}/account?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
    const token = getSessionToken();
    if (isCompSimPage(new URL(next, window.location.origin).pathname)) {
      setProfileRequired(true);
      void verifyPageRole(token).then((role) => {
        if (!active) return;
        if (role === 'login') {
          window.location.replace(`${prefix}/account?next=${encodeURIComponent(next)}`);
          return;
        }
        syncPageSessionCookie(token);
        window.location.replace(role === 'admin' ? next : prefix || '/');
      }).catch(() => {
        if (active) setError(tr({ zh: '暂时无法验证访问权限，请刷新重试。', en: 'Could not verify access. Please refresh to retry.' }));
      });
      return () => { active = false; };
    }
    const needsProfile = new URLSearchParams(window.location.search).get('require') === 'forum-profile';
    setProfileRequired(needsProfile);
    if (needsProfile) {
      void verifyForumPageAccess(token).then((access) => {
        if (!active) return;
        if (access === 'allowed') {
          syncPageSessionCookie(token);
          window.location.replace(next.startsWith('/auth/page-access') ? '/' : next);
          return;
        }
        setError(access === 'banned'
          ? tr({ zh: '账号已被论坛封禁，暂不能使用赛前训练。', en: 'This account is banned from the forum and cannot use Competition Practice.' })
          : tr({ zh: '赛前训练与论坛评论使用相同准入条件。请先登录并在账号页完善姓名、生日、性别和所在地；论坛原有资料豁免继续适用。', en: 'Competition Practice uses the forum comment requirements. Sign in and complete your name, birth date, gender and location on your account page. Existing forum profile exemptions still apply.' }));
      }).catch(() => {
        if (active) setError(tr({ zh: '暂时无法验证访问权限，请刷新重试。', en: 'Could not verify access. Please refresh to retry.' }));
      });
      return () => { active = false; };
    }
    void verifyPageAdmin(token).then((admin) => {
      if (!active) return;
      if (!admin) {
        syncPageSessionCookie('');
        setError(tr({ zh: '页面开发中，仅管理员可访问。', en: 'This page is in development and available to administrators only.' }));
        return;
      }
      syncPageSessionCookie(token);
      window.location.replace(next.startsWith('/auth/page-access') ? '/' : next);
    }).catch(() => {
      if (active) setError(tr({ zh: '暂时无法验证访问权限，请刷新重试。', en: 'Could not verify access. Please refresh to retry.' }));
    });
    return () => { active = false; };
  }, []);
  return <AuthCallbackStatus pendingLabel={tr({ zh: '正在验证访问权限…', en: 'Checking page access…' })} error={error}>
    <a className="auth-callback-status__retry" href={login}>{profileRequired
      ? tr({ zh: '前往账号页', en: 'Go to account' })
      : tr({ zh: '管理员登录', en: 'Administrator sign-in' })}</a>
  </AuthCallbackStatus>;
}

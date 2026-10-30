'use client';

import { useCallback, useState } from 'react';
import { Settings, LogOut, UserRound } from '@app-foundation/icons/lucide';
import AppLink from '@/components/AppLink';
import { CompactSelect } from '@/components/CompactSelect';
import { useAuthStore, useAuthUser } from '@/lib/auth-store';
import { notifyMiniProgramLogout } from '@/lib/miniprogram-bridge';
import { useT } from '@/hooks/useT';
import './chat-account-menu.css';

export default function ChatAccountMenu() {
  const t = useT();
  const user = useAuthUser();
  const [open, setOpen] = useState(false);
  const focusSettings = useCallback((node: HTMLAnchorElement | null) => { node?.focus(); }, []);
  return <CompactSelect open={open} onOpenChange={setOpen} unstyledTrigger side="top"
    triggerClassName="chat-account-trigger" popupClassName="chat-account-menu"
    ariaLabel={t('账号菜单', 'Account menu')} label={user?.avatar ? <img src={user.avatar} alt="" /> : <UserRound size={22} />}
    items={[]} onChange={() => {}} panelContent={<>
      {user && <div className="chat-account-identity">
        {user.avatar && <img src={user.avatar} alt="" />}<strong>{user.name || user.wcaId}</strong>
      </div>}
      <AppLink className="chat-account-menu-item" ref={focusSettings} href="/chat?settings=general" prefetch={false} onClick={() => setOpen(false)}><Settings size={18} aria-hidden="true"/>{t('设置', 'Settings')}</AppLink>
      {user ? <button className="chat-account-menu-item" type="button" onClick={() => {
        setOpen(false); useAuthStore.getState().logout(); void notifyMiniProgramLogout();
      }}><LogOut size={18}/>{t('退出登录', 'Log out')}</button> :
        <AppLink className="chat-account-menu-item" href="/chat?settings=account" prefetch={false} onClick={() => setOpen(false)}><UserRound size={18}/>{t('登录', 'Sign in')}</AppLink>}
    </>} />;
}

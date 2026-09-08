'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Megaphone, Sparkles, UserCog, Laptop, Globe, Drama, LogOut } from 'lucide-react';
import { ensureFreshToken, refreshSessionUser, canTestRoles, getRolePreview, startRolePreview, endRolePreview, useAuthUser, isAdmin, type TestRole } from '@/lib/auth-store';
import AppLink from './AppLink';
import { openPageNoticeEditor, pageKeyFromPathname } from '@/lib/page-notices-api';
import { useLiveUrlSuffix } from '@/hooks/useLiveUrlSuffix';
import { CompactSelect } from './CompactSelect';
import { useT } from '@/hooks/useT';

/**
 * Global session refresh and the superadmin's current-tab role-test controls.
 */
export default function AuthTokenRefresher() {
  useEffect(() => { void ensureFreshToken().then(refreshSessionUser); }, []);
  return null;
}

export function AdminTools({ centerX = 0.5 }: { centerX?: number }) {
  const user = useAuthUser();
  const t = useT();
  const pathname = usePathname();
  const liveUrlSuffix = useLiveUrlSuffix();
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const toolbarRef = useRef<HTMLElement>(null);
  // The pet owns the position; viewport clamping moves that same root.
  const moveTo = useCallback((left: number, top: number) => {
    const toolbar = toolbarRef.current;
    const root = toolbar?.parentElement;
    if (!toolbar || !root) return;
    const rect = toolbar.getBoundingClientRect();
    const anchor = getComputedStyle(root);
    const right = parseFloat(anchor.right), bottom = parseFloat(anchor.bottom);
    root.style.right = `${right - (left - rect.left)}px`;
    root.style.bottom = `${bottom - (top - rect.top)}px`;
  }, []);
  useEffect(() => { setReady(true); }, []);
  useEffect(() => {
    const toolbar = toolbarRef.current;
    const root = toolbar?.parentElement;
    const hit = root?.querySelector('.clawd-deskpet-hit');
    if (!toolbar || !root || !hit) return;
    // Clamp the whole group, including wrapped role-test text on narrow screens.
    const clamp = () => {
      const viewportWidth = document.documentElement.getBoundingClientRect().width;
      toolbar.style.maxWidth = `${viewportWidth - 32}px`;
      const rect = toolbar.getBoundingClientRect();
      const pet = hit.getBoundingClientRect();
      const left = Math.min(rect.left, pet.left), right = Math.max(rect.right, pet.right);
      const top = Math.min(rect.top, pet.top), bottom = Math.max(rect.bottom, pet.bottom);
      const dx = Math.max(16 - left, Math.min(0, viewportWidth - 16 - right));
      const dy = Math.max(16 - top, Math.min(0, window.innerHeight - 16 - bottom));
      if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) moveTo(rect.left + dx, rect.top + dy);
    };
    const resize = new ResizeObserver(clamp);
    resize.observe(toolbar); resize.observe(root);
    const mutation = new MutationObserver(clamp);
    mutation.observe(root, { attributes: true, attributeFilter: ['style', 'class'] });
    window.addEventListener('resize', clamp);
    clamp();
    return () => { resize.disconnect(); mutation.disconnect(); window.removeEventListener('resize', clamp); };
  }, [ready, user, moveTo, centerX]);
  const preview = ready ? getRolePreview() : null;
  const admin = ready && !!user && isAdmin();
  const roleTesting = ready && (!!preview || (!!user && canTestRoles()));
  if (!ready || (!admin && !roleTesting)) return null;
  const items = [
    { value: 'admin' as const, label: t('管理员', 'Administrator') },
    { value: 'member' as const, label: t('网盘成员', 'Drive member') },
    { value: 'user' as const, label: t('普通用户（无网盘权限）', 'User without Drive access') },
    { value: 'guest' as const, label: t('访客', 'Guest') },
  ];
  const run = async (role?: TestRole) => {
    setBusy(true); setError(false);
    try {
      if (role) {
        await startRolePreview(role);
      } else await endRolePreview();
    } catch { setError(true); }
    finally { setBusy(false); }
  };
  return <aside ref={toolbarRef} className="admin-tools" aria-label={t('管理工具', 'Admin tools')} style={{ position: 'absolute', top: '100%', left: `${centerX * 100}%`, transform: 'translateX(-50%)', marginTop: 8, width: 'max-content', maxWidth: 'calc(100vw - 32px)', pointerEvents: 'auto', color: 'var(--foreground)', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
    <style>{`
      .admin-tools{box-sizing:border-box;padding:4px 6px;border-radius:24px;
        border:1px solid color-mix(in srgb,var(--foreground) 14%,transparent);
        background:linear-gradient(135deg,color-mix(in srgb,var(--foreground) 9%,transparent),transparent 55%),
          color-mix(in srgb,var(--background) 48%,transparent);
        backdrop-filter:blur(20px) saturate(180%);-webkit-backdrop-filter:blur(20px) saturate(180%);
        box-shadow:inset 0 1px 0 color-mix(in srgb,var(--foreground) 16%,transparent),
          inset 0 -1px 0 color-mix(in srgb,var(--background) 30%,transparent),
          0 6px 24px color-mix(in srgb,var(--foreground) 8%,transparent);}
      .admin-tools .compact-select-trigger{border:0;background:transparent;padding:6px;}
      .admin-tools .compact-select-trigger:hover{background:transparent;color:var(--accent);}
      .admin-tool-action{display:inline-flex;align-items:center;justify-content:center;box-sizing:border-box;width:29px;height:29px;flex-shrink:0;gap:6px;white-space:nowrap;
        border:0;background:transparent;color:inherit;font:inherit;text-decoration:none;padding:6px;cursor:pointer;}
      .admin-tool-action svg{width:17px;height:17px;}
      .admin-tool-action:hover{color:var(--accent);}
      .admin-env-switch{display:inline-flex;align-items:center;gap:8px;}
      .admin-env-switch .admin-tool-action{color:var(--faint-foreground);}
      .admin-env-switch .admin-tool-action[aria-current="page"]{color:var(--foreground);}
    `}</style>
    {admin && <>
      <button type="button" className="admin-tool-action" onClick={() => openPageNoticeEditor('page_top')}
        title={t('添加本页通知', 'Add notice for this page')} aria-label={t('添加本页通知', 'Add notice for this page')}>
        <Megaphone size={17} aria-hidden />
      </button>
      {pageKeyFromPathname(pathname || '/') === '/' && <button type="button" className="admin-tool-action" onClick={() => openPageNoticeEditor('home_featured')}
        title={t('首页焦点', 'Homepage feature')} aria-label={t('首页焦点', 'Homepage feature')}>
        <Sparkles size={17} aria-hidden />
      </button>}
      <AppLink href="/admin" className="admin-tool-action" prefetch={false}
        title={t('管理后台', 'Administration')} aria-label={t('管理后台', 'Administration')}>
        <UserCog size={13} aria-hidden />
      </AppLink>
      {liveUrlSuffix && <div className="admin-env-switch" role="group" aria-label={t('切换环境', 'Switch environment')}>
        {[
          { env: 'local', origin: 'http://localhost:3000', label: t('本地', 'Local'), Icon: Laptop },
          { env: 'prod', origin: 'https://cuberoot.me', label: t('线上', 'Live'), Icon: Globe },
        ].map(({ env, origin, label, Icon }) => <a key={env} className="admin-tool-action" href={origin + liveUrlSuffix}
          title={label} aria-label={label} aria-current={env === (['localhost', '127.0.0.1'].includes(window.location.hostname) ? 'local' : 'prod') ? 'page' : undefined}>
          <Icon size={13} aria-hidden />
        </a>)}
      </div>}
    </>}
    {roleTesting && (preview ? <>
      <CompactSelect
        label={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Drama size={17} aria-hidden />{preview.role === 'user' ? t('普通用户', 'User') : items.find(item => item.value === preview.role)?.label}</span>}
        ariaLabel={t('测试角色与说明', 'Test role and details')}
        title={t('正在测试角色', 'Testing role')}
        value={preview.role}
        items={items.map(item => ({ ...item, disabled: busy }))}
        onChange={role => { if (role !== preview.role) void run(role); }}
        footer={() => <small style={{ display: 'block', maxWidth: 240, margin: '6px 8px', whiteSpace: 'normal', lineHeight: 1.5 }}>
          {t('仅当前标签页，30 分钟有效；业务操作会真实保存。', 'This tab only, valid for 30 minutes. Business changes are real.')}
        </small>}
      />
      <button type="button" className="admin-tool-action" disabled={busy} onClick={() => void run()}
        title={t('退出测试', 'Exit test')} aria-label={t('退出测试', 'Exit test')}><LogOut size={17} aria-hidden /></button>
    </> : <CompactSelect label={<Drama size={17} aria-hidden />} title={busy ? t('正在切换…', 'Switching…') : t('角色测试', 'Test role')} ariaLabel={busy ? t('正在切换…', 'Switching…') : t('选择测试角色', 'Choose test role')} items={items.map(item => ({ ...item, disabled: busy }))} onChange={role => void run(role)} />)}
    {error && <span role="alert">{t('切换失败，请重试。', 'Switch failed. Please retry.')}</span>}
  </aside>;
}

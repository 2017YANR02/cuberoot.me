'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Megaphone, Sparkles, UserCog, Laptop, Globe, Drama } from 'lucide-react';
import { ensureFreshToken, refreshSessionUser, canTestRoles, getRolePreview, startRolePreview, endRolePreview, useAuthUser, isAdmin, type TestRole } from '@/lib/auth-store';
import AppLink from './AppLink';
import { openPageNoticeEditor, pageKeyFromPathname } from '@/lib/page-notices-api';
import { useLiveUrlSuffix } from '@/hooks/useLiveUrlSuffix';
import { CompactSelect } from './CompactSelect';
import { useT } from '@/hooks/useT';
import { usePopoverDismiss } from '@/hooks/usePopoverDismiss';
import { adminEnvironment } from '@/lib/admin-environment';
import './glass-material.css';

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
  const [expanded, setExpanded] = useState(false);
  const [actionsWidth, setActionsWidth] = useState(0);
  const [toggleOffset, setToggleOffset] = useState(0);
  const [toggleLeft, setToggleLeft] = useState(0);
  const actionsRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toolbarRef = useRef<HTMLElement>(null);
  const toggleRef = useRef<HTMLAnchorElement>(null);
  const cancelCollapse = useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = null;
  }, []);
  const collapse = () => { cancelCollapse(); setExpanded(false); };
  usePopoverDismiss(expanded, reason => {
    // The role list is a body portal; let its own dismissal finish first.
    if (reason === 'outside' && document.querySelector('.admin-tools-role-popup')) return;
    collapse();
  }, toolbarRef, toggleRef);
  useEffect(() => {
    const actions = actionsRef.current;
    if (!actions) return;
    const measure = () => {
      setActionsWidth(actions.getBoundingClientRect().width);
      const toggle = toggleRef.current;
      if (toggle) {
        setToggleLeft(toggle.offsetLeft);
        setToggleOffset(actions.getBoundingClientRect().width - toggle.offsetLeft - toggle.offsetWidth);
      }
    };
    const observer = new ResizeObserver(measure);
    observer.observe(actions);
    measure();
    return () => observer.disconnect();
  }, [ready, user]);
  useEffect(() => {
    if (!expanded) return;
    const onMove = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse') return;
      const target = event.target as Element;
      if (toolbarRef.current?.contains(target) || target.closest('.admin-tools-role-popup')) {
        cancelCollapse();
        return;
      }
      if (closeTimer.current) return;
      closeTimer.current = setTimeout(() => {
        closeTimer.current = null;
        if (toolbarRef.current?.querySelector('[aria-haspopup="listbox"][aria-expanded="true"]')) return;
        // A mouse click leaves focus on the toggle; only keyboard focus keeps it open.
        if (toolbarRef.current?.querySelector(':focus-visible')) return;
        setExpanded(false);
      }, 200);
    };
    document.addEventListener('pointermove', onMove);
    return () => { document.removeEventListener('pointermove', onMove); cancelCollapse(); };
  }, [expanded, cancelCollapse]);
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
  const environment = adminEnvironment(window.location.hostname, navigator);
  const local = environment.current === 'local';
  const environmentLabel = local ? t('切换到线上', 'Switch to live') : t('切换到本地', 'Switch to local');
  const environmentHref = (local ? 'https://cuberoot.me' : environment.localOrigin) + liveUrlSuffix;
  const items = [
    { value: 'superadmin' as const, label: t('超级管理员', 'Super administrator') },
    { value: 'admin' as const, label: t('管理员', 'Administrator') },
    { value: 'member' as const, label: t('网盘成员', 'Drive member') },
    { value: 'user' as const, label: t('普通用户（无网盘权限）', 'User without Drive access') },
    { value: 'user-complete' as const, label: t('普通用户（资料完整）', 'User with complete profile') },
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
  return <aside ref={toolbarRef} className="admin-tools" data-expanded={expanded} aria-label={t('管理工具', 'Admin tools')}
    onPointerEnter={event => {
      if (event.pointerType !== 'mouse') return;
      cancelCollapse();
      setExpanded(true);
    }}
    onBlur={event => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)
        && !(event.relatedTarget as Element | null)?.closest?.('.admin-tools-role-popup')) collapse();
    }}
    // Anchor expansion on the environment icon, not the changing toolbar midpoint.
    // Width, toolbar translation and toggle translation share one easing curve.
    style={{ position: 'absolute', top: '100%', left: `${centerX * 100}%`, transform: `translateX(${-21 - (expanded ? toggleLeft : 0)}px)`, marginTop: 8, width: expanded ? actionsWidth + 10 : 42, maxWidth: 'calc(100vw - 32px)', pointerEvents: 'auto', color: 'var(--foreground)', display: 'flex', alignItems: 'center' }}>
    <style>{`
      .admin-tools{box-sizing:border-box;padding:4px;border-radius:24px;
        border:1px solid var(--glass-edge);background:var(--glass-background);
        backdrop-filter:var(--glass-filter);-webkit-backdrop-filter:var(--glass-filter);
        box-shadow:var(--glass-shadow);height:42px;
        transition:width 420ms cubic-bezier(.22,1,.36,1),transform 420ms cubic-bezier(.22,1,.36,1);}
      .admin-tools .compact-select-trigger{border:0;background:transparent;padding:6px;}
      .admin-tools .compact-select-trigger:hover{background:transparent;color:var(--accent);}
      .admin-tools .compact-select-arrow{display:none;}
      .admin-tool-action{display:inline-flex;align-items:center;justify-content:center;box-sizing:border-box;width:29px;height:29px;flex-shrink:0;gap:6px;white-space:nowrap;
        border:0;background:transparent;color:inherit;font:inherit;text-decoration:none;padding:6px;cursor:pointer;}
      .admin-tool-action svg{width:17px;height:17px;}
      .admin-tool-action:hover{color:var(--accent);}
      .admin-tools-toggle{width:32px;height:32px;border-radius:50%;transition:transform 420ms cubic-bezier(.22,1,.36,1);}
      .admin-tools-toggle:focus-visible{outline:2px solid var(--ring);outline-offset:2px;}
      .admin-tools-actions{position:absolute;right:4px;display:flex;align-items:center;gap:8px;width:max-content;max-width:calc(100vw - 42px);min-width:0;}
      .admin-tools-group{display:contents;}
      .admin-tools-group > *{
        opacity:0;visibility:hidden;transform:translateX(8px);pointer-events:none;
        transition:opacity 140ms ease,transform 300ms cubic-bezier(.22,1,.36,1),visibility 0s 140ms;}
      .admin-tools[data-expanded="true"] .admin-tools-group > *{opacity:1;visibility:visible;transform:none;pointer-events:auto;
        transition:opacity 220ms ease 100ms,transform 420ms cubic-bezier(.22,1,.36,1),visibility 0s;}
      .admin-tools-actions .compact-select{min-width:0;}
      @media(prefers-reduced-motion:reduce){.admin-tools,.admin-tools-toggle,.admin-tools-group > *{transition:none;}}
    `}</style>
    <div ref={actionsRef} className="admin-tools-actions">
    {admin && <div className="admin-tools-group" inert={!expanded}>
      <button type="button" className="admin-tool-action" onClick={() => openPageNoticeEditor('page_top')}
        title={t('添加本页通知', 'Add notice for this page')} aria-label={t('添加本页通知', 'Add notice for this page')}>
        <Megaphone size={17} aria-hidden />
      </button>
      {pageKeyFromPathname(pathname || '/') === '/' && <button type="button" className="admin-tool-action" onClick={() => openPageNoticeEditor('home_featured')}
        title={t('首页焦点', 'Homepage feature')} aria-label={t('首页焦点', 'Homepage feature')}>
        <Sparkles size={17} aria-hidden />
      </button>}
    </div>}
    <a ref={toggleRef} className="admin-tool-action admin-tools-toggle" href={environmentHref}
      aria-label={environmentLabel} title={environmentLabel} aria-expanded={expanded}
      style={{ transform: expanded ? undefined : `translateX(${toggleOffset}px)` }}
      onClick={event => {
        if (!expanded) { event.preventDefault(); cancelCollapse(); setExpanded(true); }
      }}>
      {local ? <Globe size={17} aria-hidden /> : <Laptop size={17} aria-hidden />}
    </a>
    <div className="admin-tools-group" inert={!expanded}>
      {admin && <AppLink href="/admin" className="admin-tool-action" prefetch={false}
        title={t('管理后台', 'Administration')} aria-label={t('管理后台', 'Administration')}>
        <UserCog size={13} aria-hidden />
      </AppLink>}
    {roleTesting &&
      <CompactSelect
        openOnHover
        dismissOnMouseLeave
        popupClassName="admin-tools-role-popup"
        label={preview ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Drama size={17} aria-hidden />{preview.role === 'user' ? t('普通用户', 'User') : items.find(item => item.value === preview.role)?.label}</span> : <Drama size={17} aria-hidden />}
        ariaLabel={busy ? t('正在切换…', 'Switching…') : t('选择测试角色', 'Choose test role')}
        title={busy ? t('正在切换…', 'Switching…') : t('角色测试', 'Test role')}
        value={preview?.role ?? 'superadmin'}
        items={items.map(item => ({ ...item, disabled: busy }))}
        onChange={role => { if (role !== (preview?.role ?? 'superadmin')) void run(role === 'superadmin' ? undefined : role); }}
      />
    }
    {error && <span role="alert">{t('切换失败，请重试。', 'Switch failed. Please retry.')}</span>}
    </div>
    </div>
  </aside>;
}

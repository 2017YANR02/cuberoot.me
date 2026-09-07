'use client';

import { useEffect, useState } from 'react';
import { ensureFreshToken, refreshSessionUser, canTestRoles, getRolePreview, startRolePreview, endRolePreview, useAuthUser, type TestRole } from '@/lib/auth-store';
import { CompactSelect } from './CompactSelect';
import { useT } from '@/hooks/useT';

/**
 * Global session refresh and the superadmin's current-tab role-test controls.
 */
export default function AuthTokenRefresher() {
  const user = useAuthUser();
  const t = useT();
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  useEffect(() => {
    setReady(true);
    void ensureFreshToken().then(refreshSessionUser);
  }, []);
  const preview = ready ? getRolePreview() : null;
  if (!ready || (!preview && (!user || !canTestRoles()))) return null;
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
        if (!window.confirm(t('进入独立测试身份。业务操作会真实保存；不修改你的账号角色。继续？', 'Enter a separate test identity. Business changes are real; your account role is unchanged. Continue?'))) return;
        await startRolePreview(role);
      } else await endRolePreview();
    } catch { setError(true); }
    finally { setBusy(false); }
  };
  return <aside aria-label={t('角色测试', 'Role testing')} style={{ position: 'fixed', bottom: 16, right: 'max(16px, calc((100vw - 1100px) / 2))', zIndex: 10000, maxWidth: 'calc(100vw - 32px)', background: 'var(--background)', color: 'var(--foreground)', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
    {preview ? <>
      <span>{t('测试中：', 'Testing: ')}{items.find(item => item.value === preview.role)?.label}</span>
      <button type="button" disabled={busy} onClick={() => void run()}>{t('退出测试', 'Exit test')}</button>
      <small>{t('仅当前标签页，30 分钟有效；业务操作会真实保存。', 'This tab only, valid for 30 minutes. Business changes are real.')}</small>
    </> : <CompactSelect label={busy ? t('正在切换…', 'Switching…') : t('角色测试', 'Test role')} ariaLabel={t('选择测试角色', 'Choose test role')} items={items.map(item => ({ ...item, disabled: busy }))} onChange={role => void run(role)} />}
    {error && <span role="alert">{t('切换失败，请重试。', 'Switch failed. Please retry.')}</span>}
  </aside>;
}

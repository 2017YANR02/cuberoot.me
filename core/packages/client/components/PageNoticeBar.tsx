'use client';

// 每页顶部管理员通知条(维护中 / WIP / 已知 bug)。全站注入(见 app/[lang]/layout.tsx)。
//   - 访客:看到匹配当前页的 enabled 通知,可关闭(内容变更后重新出现)。
//   - 管理员:任意页顶部直接 添加 / 编辑 / 删除本页通知,作用路径默认当前页、可改 /* 覆盖全站。
// 数据走 /v1/page-notices(公开读 + admin 写),鉴权 authHeaders(WCA OAuth / X-Admin-Key)。
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Info, AlertTriangle, Wrench, X, Pencil, Plus, Trash2 } from 'lucide-react';
import { useIsAdmin } from '@/lib/auth-store';
import { tr, T, useLang } from '@/i18n/tr';
import BoolToggle from './BoolToggle';
import {
  type PageNotice, type NoticeLevel, type PageNoticeInput,
  fetchPageNotices, fetchAllPageNotices, savePageNotice, deletePageNotice,
  pageKeyFromPathname, matchNotices,
} from '@/lib/page-notices-api';
import './PageNoticeBar.css';

const LEVEL_ICON: Record<NoticeLevel, typeof Info> = {
  info: Info,
  warning: AlertTriangle,
  maintenance: Wrench,
};

const DISMISS_KEY = 'pn-dismissed';

interface FormState {
  id: number | null;   // null = 新建
  path: string;
  level: NoticeLevel;
  bodyZh: string;
  bodyEn: string;
  enabled: boolean;
  dismissible: boolean;
}

export default function PageNoticeBar() {
  const pathname = usePathname();
  const lang = useLang();
  const isAdmin = useIsAdmin();
  const key = pageKeyFromPathname(pathname || '/');

  const [notices, setNotices] = useState<PageNotice[]>([]);
  const [dismissed, setDismissed] = useState<Record<string, string>>({});
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // enabled 通知:layout 常驻,导航不重挂 → 挂载时拉一次即可。后端挂了静默降级。
  useEffect(() => {
    fetchPageNotices().then(setNotices).catch(() => { /* 不影响页面 */ });
  }, []);

  // 本地「已关闭」记录(id → updatedAt;内容变更后 updatedAt 变,重新出现)。
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DISMISS_KEY);
      if (raw) setDismissed(JSON.parse(raw));
    } catch { /* ignore */ }
  }, []);

  // 写操作后用返回行就地更新(避开公开 GET 的 60s 缓存,改动即时可见)。
  const applyResult = (row: PageNotice) => {
    setNotices((prev) => {
      const rest = prev.filter((n) => n.id !== row.id && n.path !== row.path);
      return row.enabled ? [...rest, row] : rest;
    });
  };

  const dismiss = (n: PageNotice) => {
    setDismissed((prev) => {
      const next = { ...prev, [n.id]: n.updatedAt };
      try { localStorage.setItem(DISMISS_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  };

  const openNew = async () => {
    setErr(null);
    // 拉 manage(含 disabled)看本页 key 是否已有被关掉的通知,有则预填避免重复。
    let existing: PageNotice | undefined;
    try {
      existing = (await fetchAllPageNotices()).find((n) => n.path === key);
    } catch { /* 拿不到就当全新 */ }
    setForm(existing
      ? { id: existing.id, path: existing.path, level: existing.level, bodyZh: existing.bodyZh, bodyEn: existing.bodyEn, enabled: existing.enabled, dismissible: existing.dismissible }
      : { id: null, path: key, level: 'info', bodyZh: '', bodyEn: '', enabled: true, dismissible: true });
  };

  const openEdit = (n: PageNotice) => {
    setErr(null);
    setForm({ id: n.id, path: n.path, level: n.level, bodyZh: n.bodyZh, bodyEn: n.bodyEn, enabled: n.enabled, dismissible: n.dismissible });
  };

  const save = async () => {
    if (!form) return;
    setSaving(true);
    setErr(null);
    try {
      const body: PageNoticeInput = {
        path: form.path.trim(),
        level: form.level,
        bodyZh: form.bodyZh.trim(),
        bodyEn: form.bodyEn.trim(),
        enabled: form.enabled,
        dismissible: form.dismissible,
      };
      applyResult(await savePageNotice(body));
      setForm(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (form?.id == null) return;
    const id = form.id;
    setSaving(true);
    setErr(null);
    try {
      await deletePageNotice(id);
      setNotices((prev) => prev.filter((n) => n.id !== id));
      setForm(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const pick = (n: PageNotice) => (lang === 'en' ? (n.bodyEn || n.bodyZh) : (n.bodyZh || n.bodyEn));

  const matched = matchNotices(notices, key);
  const visible = matched.filter((n) => isAdmin || !(n.dismissible && dismissed[n.id] === n.updatedAt));
  const hasExact = notices.some((n) => n.path === key); // 本页是否已有精确通知 → 决定显 编辑 还是 添加

  if (!isAdmin && visible.length === 0) return null;

  const canSave = form != null && form.path.trim() !== '' && (form.bodyZh.trim() !== '' || form.bodyEn.trim() !== '');

  return (
    <div className="page-notice-wrap">
      {visible.map((n) => {
        const Icon = LEVEL_ICON[n.level];
        return (
          <div key={n.id} className="page-notice" data-level={n.level} role="status">
            <Icon className="page-notice-icon" size={17} aria-hidden />
            <div className="page-notice-body">{pick(n)}</div>
            <div className="page-notice-actions">
              {isAdmin ? (
                <button type="button" className="page-notice-btn" onClick={() => openEdit(n)}
                  aria-label={tr({ en: 'Edit notice', zh: '编辑通知' })}>
                  <Pencil size={15} aria-hidden />
                </button>
              ) : n.dismissible ? (
                <button type="button" className="page-notice-btn" onClick={() => dismiss(n)}
                  aria-label={tr({ en: 'Dismiss', zh: '关闭' })}>
                  <X size={16} aria-hidden />
                </button>
              ) : null}
            </div>
          </div>
        );
      })}

      {isAdmin && !form && !hasExact && (
        <button type="button" className="page-notice-add" onClick={openNew}>
          <Plus size={13} aria-hidden />
          <T en="Add notice for this page" zh="添加本页通知" />
        </button>
      )}

      {isAdmin && form && (
        <div className="page-notice-editor">
          <label className="page-notice-field">
            <span><T en="Applies to path (use /* for whole site)" zh="作用路径(填 /* 覆盖全站)" /></span>
            <input value={form.path} onChange={(e) => setForm({ ...form, path: e.target.value })} placeholder="/scramble/stats" />
          </label>

          <div className="page-notice-editor-row">
            <label className="page-notice-field">
              <span><T en="Level" zh="级别" /></span>
              <select value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value as NoticeLevel })}>
                <option value="info">{tr({ en: 'Info', zh: '信息' })}</option>
                <option value="warning">{tr({ en: 'Warning', zh: '警告' })}</option>
                <option value="maintenance">{tr({ en: 'Maintenance', zh: '维护' })}</option>
              </select>
            </label>
            <BoolToggle value={form.enabled} onChange={(v) => setForm({ ...form, enabled: v })}
              label={<T en="Enabled" zh="启用" />} ariaLabel={tr({ en: 'Enabled', zh: '启用' })} />
            <BoolToggle value={form.dismissible} onChange={(v) => setForm({ ...form, dismissible: v })}
              label={<T en="Dismissible" zh="可关闭" />} ariaLabel={tr({ en: 'Dismissible', zh: '可关闭' })} />
          </div>

          <label className="page-notice-field">
            <span><T en="Chinese text" zh="中文" /></span>
            <textarea value={form.bodyZh} onChange={(e) => setForm({ ...form, bodyZh: e.target.value })}
              placeholder={tr({ en: 'e.g. This page is under maintenance', zh: '例:本页正在维护,稍后恢复' })} />
          </label>
          <label className="page-notice-field">
            <span><T en="English text" zh="英文" /></span>
            <textarea value={form.bodyEn} onChange={(e) => setForm({ ...form, bodyEn: e.target.value })}
              placeholder="e.g. This page is under maintenance" />
          </label>

          {err && <div className="page-notice-err">{err}</div>}

          <div className="page-notice-editor-actions">
            <button type="button" className="page-notice-save" onClick={save} disabled={saving || !canSave}>
              <T en="Save" zh="保存" />
            </button>
            <button type="button" className="page-notice-cancel" onClick={() => { setForm(null); setErr(null); }}>
              <T en="Cancel" zh="取消" />
            </button>
            {form.id != null && (
              <button type="button" className="page-notice-delete" onClick={remove} disabled={saving}>
                <Trash2 size={14} aria-hidden style={{ verticalAlign: '-2px', marginRight: 3 }} />
                <T en="Delete" zh="删除" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

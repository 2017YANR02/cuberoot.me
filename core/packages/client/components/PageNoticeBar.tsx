'use client';

// 每页顶部管理员通知条(维护中 / WIP / 已知 bug)。全站注入(见 app/[lang]/layout.tsx)。
//   - 访客:看到匹配当前页的 enabled 通知,可关闭(内容变更后重新出现)。
//   - 管理员:任意页顶部直接 添加 / 编辑 / 删除本页通知,作用路径默认当前页、可改 /* 覆盖全站。
// 数据走 /v1/page-notices(公开读 + admin 写),鉴权 authHeaders(WCA OAuth / X-Admin-Key)。
import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Info, AlertTriangle, Wrench, X, Pencil, Plus, Trash2, Laptop, Globe } from 'lucide-react';
import { useIsAdmin } from '@/lib/auth-store';
import { useLiveUrlSuffix } from '@/hooks/useLiveUrlSuffix';
import { tr, T, useLang } from '@/i18n/tr';
import BoolToggle from './BoolToggle';
import { persistItem } from '@/lib/safe-storage';
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

// 管理员本地 / 线上环境切换目标 origin(切换时保留当前 path+query+hash)。
const LOCAL_ORIGIN = 'http://localhost:3000';
const PROD_ORIGIN = 'https://cuberoot.me';

// 管理员专用:在任意页原地切换 本地 ↔ 线上,便于调试对照。
// 高亮当前所在环境(本地=琥珀、线上=绿),同时充当「我现在在哪个环境」的指示。
// 两端都用真 <a>(跨 origin,故非 AppLink):支持中键 / Ctrl 点在新标签打开,本地与线上并排对比。
// URL 走 useLiveUrlSuffix:本条通知栏常驻 layout,nuqs 的 shallow 写不会让它重渲染,
// render 时读 window.location 会把 ?q=... 这类页内状态漏在快照外。
function EnvSwitch() {
  const rest = useLiveUrlSuffix();
  if (!rest) return null; // SSR / 未 hydrate:还没有可用的 window.location
  // hostname 不随页内状态变(换 origin 必然整页导航),render 时读即可。
  const { hostname } = window.location;
  const active: 'local' | 'prod' = hostname === 'localhost' || hostname === '127.0.0.1' ? 'local' : 'prod';
  const opts = [
    { env: 'local' as const, href: LOCAL_ORIGIN + rest, label: { en: 'Local', zh: '本地' }, Icon: Laptop },
    { env: 'prod' as const, href: PROD_ORIGIN + rest, label: { en: 'Live', zh: '线上' }, Icon: Globe },
  ];
  return (
    <div className="env-switch" role="group" aria-label={tr({ en: 'Switch environment', zh: '切换环境' })}>
      {opts.map(({ env, href, label, Icon }) => (
        <a key={env} href={href} data-env={env} title={tr(label)}
          className={`env-switch-opt${env === active ? ' is-active' : ''}`}
          aria-current={env === active ? 'page' : undefined}
          aria-label={tr(label)}>
          <Icon size={13} aria-hidden />
        </a>
      ))}
    </div>
  );
}

// 常用模板:点一下填 级别 + 中英文,填完仍可自由改。
const PRESETS: { label: { en: string; zh: string }; level: NoticeLevel; bodyZh: string; bodyEn: string }[] = [
  { label: { en: 'Maintenance', zh: '维护中' }, level: 'maintenance',
    bodyZh: '本页正在维护,稍后恢复,给你带来不便敬请谅解。',
    bodyEn: 'This page is under maintenance and will be back shortly. Sorry for the inconvenience.' },
  { label: { en: 'Work in progress', zh: '开发中' }, level: 'info',
    bodyZh: '本页仍在开发中,功能尚不完整,后续会持续完善。',
    bodyEn: 'This page is still under development; some features are incomplete and will keep improving.' },
  { label: { en: 'Known issue', zh: '已知问题' }, level: 'warning',
    bodyZh: '本页存在已知问题,我们正在修复,感谢反馈与耐心。',
    bodyEn: 'This page has a known issue we are working to fix. Thanks for your patience.' },
  { label: { en: 'Data updating', zh: '数据更新中' }, level: 'info',
    bodyZh: '数据正在更新,部分内容可能暂不准确,稍后刷新即可。',
    bodyEn: 'Data is currently updating; some content may be temporarily inaccurate. Please check back soon.' },
  { label: { en: 'Experimental', zh: '实验性功能' }, level: 'warning',
    bodyZh: '实验性功能,行为可能随时变化,请谨慎使用。',
    bodyEn: 'Experimental feature — behavior may change at any time. Use with caution.' },
  { label: { en: 'Beta / preview', zh: '预览版' }, level: 'info',
    bodyZh: '本页为预览版,仅供体验,数据与样式后续可能调整。',
    bodyEn: 'This is a preview build for early access; data and layout may still change.' },
];

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
      persistItem(DISMISS_KEY, JSON.stringify(next));
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

  const renders = isAdmin || visible.length > 0;

  // 把本条实际高度写进 --page-notice-h,供全屏页(position:fixed;inset:0,如 /sim /paint)
  // 顶部让位——否则那些页会盖住整条通知栏(含管理员的 添加 / 环境切换)。无内容时置 0。
  const wrapRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = document.documentElement;
    const el = wrapRef.current;
    if (!el) { root.style.setProperty('--page-notice-h', '0px'); return; }
    const write = () => root.style.setProperty('--page-notice-h', `${el.offsetHeight}px`);
    write();
    const ro = new ResizeObserver(write);
    ro.observe(el);
    return () => { ro.disconnect(); root.style.setProperty('--page-notice-h', '0px'); };
  }, [renders]);

  if (!renders) return null;

  const canSave = form != null && form.path.trim() !== '' && (form.bodyZh.trim() !== '' || form.bodyEn.trim() !== '');

  return (
    <div className="page-notice-wrap" ref={wrapRef}>
      {visible.map((n) => {
        const Icon = LEVEL_ICON[n.level];
        return (
          <div key={n.id} className="page-notice" data-level={n.level} role="status">
            {isAdmin && (
              <button type="button" className="page-notice-btn page-notice-edit" onClick={() => openEdit(n)}
                aria-label={tr({ en: 'Edit notice', zh: '编辑通知' })}>
                <Pencil size={15} aria-hidden />
              </button>
            )}
            <Icon className="page-notice-icon" size={17} aria-hidden />
            <div className="page-notice-body">{pick(n)}</div>
            {!isAdmin && n.dismissible && (
              <div className="page-notice-actions">
                <button type="button" className="page-notice-btn" onClick={() => dismiss(n)}
                  aria-label={tr({ en: 'Dismiss', zh: '关闭' })}>
                  <X size={16} aria-hidden />
                </button>
              </div>
            )}
          </div>
        );
      })}

      {isAdmin && !form && (
        <div className="page-notice-adminbar">
          {!hasExact && (
            <button type="button" className="page-notice-add" onClick={openNew}>
              <Plus size={13} aria-hidden />
              <T en="Add notice for this page" zh="添加本页通知" />
            </button>
          )}
          <EnvSwitch />
        </div>
      )}

      {isAdmin && form && (
        <div className="page-notice-editor">
          <label className="page-notice-field">
            <span><T en="Applies to path (use /* for whole site)" zh="作用路径(填 /* 覆盖全站)" /></span>
            <input className="page-notice-input" value={form.path} onChange={(e) => setForm({ ...form, path: e.target.value })} placeholder="/scramble/stats" />
          </label>

          <div className="page-notice-editor-row">
            <label className="page-notice-field">
              <select className="page-notice-input" value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value as NoticeLevel })}
                aria-label={tr({ en: 'Level', zh: '级别' })}>
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

          <p className="page-notice-hint">
            <T
              en="Enabled: whether this notice shows at all (off = saved but hidden from everyone). Dismissible: whether visitors can click × to close it (off = always shown, cannot be dismissed)."
              zh="启用:这条通知是否显示(关掉则保存但不展示给任何人)。可关闭:访客能否点 × 关掉它(关掉则常驻,访客无法关闭)。"
            />
          </p>

          <div className="page-notice-field">
            <div className="page-notice-presets">
              {PRESETS.map((p) => (
                <button key={p.label.en} type="button" className="page-notice-preset"
                  onClick={() => setForm({ ...form, level: p.level, bodyZh: p.bodyZh, bodyEn: p.bodyEn })}>
                  {tr(p.label)}
                </button>
              ))}
            </div>
          </div>

          <label className="page-notice-field">
            <span><T en="Chinese text" zh="中文" /></span>
            <textarea className="page-notice-input" value={form.bodyZh} onChange={(e) => setForm({ ...form, bodyZh: e.target.value })}
              placeholder={tr({ en: 'e.g. This page is under maintenance', zh: '例:本页正在维护,稍后恢复' })} />
          </label>
          <label className="page-notice-field">
            <span><T en="English text" zh="英文" /></span>
            <textarea className="page-notice-input" value={form.bodyEn} onChange={(e) => setForm({ ...form, bodyEn: e.target.value })}
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
              <button type="button" className="page-notice-delete" onClick={remove} disabled={saving}
                aria-label={tr({ en: 'Delete notice', zh: '删除通知' })}>
                <Trash2 size={15} aria-hidden />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

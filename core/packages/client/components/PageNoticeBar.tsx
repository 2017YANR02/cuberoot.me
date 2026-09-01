'use client';

// 每页顶部管理员通知条(维护中 / WIP / 已知 bug)。全站注入(见 app/[lang]/layout.tsx)。
//   - 访客:看到匹配当前页的 enabled 通知,可关闭(内容变更后重新出现)。
//   - 管理员:从桌宠打开新增编辑器;已有通知仍可在顶部直接编辑 / 删除。
// 数据走 /v1/page-notices(公开读 + admin 写),鉴权 authHeaders(WCA OAuth / X-Admin-Key)。
import { useCallback, useEffect, useRef, useState, type ReactNode, type CSSProperties } from 'react';
import { usePathname } from 'next/navigation';
import { X, Pencil, Trash2 } from 'lucide-react';
import { useIsAdmin } from '@/lib/auth-store';
import { tr, T, useLang } from '@/i18n/tr';
import BoolToggle from './BoolToggle';
import { persistItem } from '@/lib/safe-storage';
import {
  type PageNotice, type NoticeLevel, type NoticePlacement, type PageNoticeInput,
  fetchPageNotices, fetchAllPageNotices, savePageNotice, deletePageNotice,
  PAGE_NOTICE_EDITOR_EVENT, pageKeyFromPathname, matchNotices,
} from '@/lib/page-notices-api';
import {
  ICONS, ICON_KEYS, LEVEL_ICON, COLOR_KEYS, isColorKey as isColor, colorVar, iconFor,
} from '@/lib/page-notice-visuals';
import './PageNoticeBar.css';

const DISMISS_KEY = 'pn-dismissed';

// 常用模板:点一下填 级别 + 图标 + 颜色 + 中英文,填完仍可自由改。
// 颜色刻意八个各不相同(红/蓝/琥珀/青/紫/赤陶/绿/粉),让通知一眼能按语义区分,不再清一色蓝。
const PRESETS: { label: { en: string; zh: string }; level: NoticeLevel; icon: string; color: string; bodyZh: string; bodyEn: string }[] = [
  { label: { en: 'Maintenance', zh: '维护中' }, level: 'maintenance', icon: 'wrench', color: 'red',
    bodyZh: '本页正在维护,稍后恢复,给你带来不便敬请谅解。',
    bodyEn: 'This page is under maintenance and will be back shortly. Sorry for the inconvenience.' },
  { label: { en: 'Work in progress', zh: '开发中' }, level: 'info', icon: 'hammer', color: 'blue',
    bodyZh: '本页仍在开发中,功能尚不完整,后续会持续完善。',
    bodyEn: 'This page is still under development; some features are incomplete and will keep improving.' },
  { label: { en: 'Known issue', zh: '已知问题' }, level: 'warning', icon: 'bug', color: 'amber',
    bodyZh: '本页存在已知问题,我们正在修复,感谢反馈与耐心。',
    bodyEn: 'This page has a known issue we are working to fix. Thanks for your patience.' },
  { label: { en: 'Data updating', zh: '数据更新中' }, level: 'info', icon: 'refresh', color: 'cyan',
    bodyZh: '数据正在更新,部分内容可能暂不准确,稍后刷新即可。',
    bodyEn: 'Data is currently updating; some content may be temporarily inaccurate. Please check back soon.' },
  { label: { en: 'Experimental', zh: '实验性功能' }, level: 'warning', icon: 'flask', color: 'purple',
    bodyZh: '实验性功能,行为可能随时变化,请谨慎使用。',
    bodyEn: 'Experimental feature — behavior may change at any time. Use with caution.' },
  { label: { en: 'Beta / preview', zh: '预览版' }, level: 'info', icon: 'eye', color: 'terracotta',
    bodyZh: '本页为预览版,仅供体验,数据与样式后续可能调整。',
    bodyEn: 'This is a preview build for early access; data and layout may still change.' },
  { label: { en: 'New feature', zh: '新功能' }, level: 'info', icon: 'sparkles', color: 'green',
    bodyZh: '本页上线了新功能,欢迎体验。',
    bodyEn: 'A new feature just landed on this page — give it a try.' },
  { label: { en: 'Retiring soon', zh: '即将退役' }, level: 'warning', icon: 'archive', color: 'pink',
    bodyZh: '本页即将退役,后续将不再维护,请尽早迁移到新页面。',
    bodyEn: 'This page is retiring soon and will no longer be maintained. Please migrate to its replacement.' },
];

// 通知正文里的裸 http/https URL 自动变成可点链接(正文由管理员撰写,可信;只认 http/https,
// 天然排除 javascript:/data:)。URL 结尾紧贴的中英句读 / 右括号不算进链接。
const URL_RE = /https?:\/\/\S+/g;
const URL_TRAIL_RE = /[.,;:!?'")\]}，。;：！？、）】》]+$/;

function linkifyText(text: string): ReactNode {
  const out: ReactNode[] = [];
  let last = 0;
  let key = 0;
  URL_RE.lastIndex = 0;
  for (let m = URL_RE.exec(text); m; m = URL_RE.exec(text)) {
    let url = m[0];
    const trail = url.match(URL_TRAIL_RE)?.[0] ?? '';
    if (trail) url = url.slice(0, -trail.length);
    if (m.index > last) out.push(text.slice(last, m.index));
    out.push(
      <a key={key++} className="page-notice-link" href={url} target="_blank" rel="noopener noreferrer">{url}</a>,
    );
    if (trail) out.push(trail);
    last = m.index + m[0].length;
  }
  if (out.length === 0) return text;          // 没有 URL:原样返回,避免多包一层
  if (last < text.length) out.push(text.slice(last));
  return out;
}

interface FormState {
  id: number | null;   // null = 新建
  path: string;
  placement: NoticePlacement;
  level: NoticeLevel;
  icon: string;        // '' = 按 level 回退
  color: string;       // '' = 按 level 回退
  bodyZh: string;
  bodyEn: string;
  href: string;
  enabled: boolean;
  dismissible: boolean;
  startsAt: string;
  endsAt: string;
}

function dateTimeInputValue(value: string | null | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function formForNotice(n: PageNotice): FormState {
  return {
    id: n.id,
    path: n.path,
    placement: n.placement ?? 'page_top',
    level: n.level,
    icon: n.icon ?? '',
    color: n.color ?? '',
    bodyZh: n.bodyZh,
    bodyEn: n.bodyEn,
    href: n.href ?? '',
    enabled: n.enabled,
    dismissible: n.dismissible,
    startsAt: dateTimeInputValue(n.startsAt),
    endsAt: dateTimeInputValue(n.endsAt),
  };
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
      const rest = prev.filter((n) => n.id !== row.id && !(
        n.path === row.path && (n.placement ?? 'page_top') === (row.placement ?? 'page_top')
      ));
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

  const openNew = useCallback(async () => {
    setErr(null);
    // 拉 manage(含 disabled)看本页 key 是否已有被关掉的通知,有则预填避免重复。
    let existing: PageNotice | undefined;
    try {
      existing = (await fetchAllPageNotices()).find(
        (n) => n.path === key && (n.placement ?? 'page_top') === 'page_top',
      );
    } catch { /* 拿不到就当全新 */ }
    setForm(existing
      ? formForNotice(existing)
      : { id: null, path: key, placement: 'page_top', level: 'info', icon: '', color: '', bodyZh: '', bodyEn: '', href: '', enabled: true, dismissible: true, startsAt: '', endsAt: '' });
  }, [key]);

  const openFeatured = useCallback(async () => {
    setErr(null);
    let existing: PageNotice | undefined;
    try {
      existing = (await fetchAllPageNotices()).find(
        (n) => n.path === '/' && n.placement === 'home_featured',
      );
    } catch { /* 拿不到就当全新 */ }
    setForm(existing
      ? formForNotice(existing)
      : { id: null, path: '/', placement: 'home_featured', level: 'info', icon: 'megaphone', color: 'terracotta', bodyZh: '', bodyEn: '', href: '', enabled: true, dismissible: false, startsAt: '', endsAt: '' });
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    const openEditor = (event: Event) => {
      const placement = (event as CustomEvent<NoticePlacement>).detail;
      void (placement === 'home_featured' ? openFeatured() : openNew());
    };
    window.addEventListener(PAGE_NOTICE_EDITOR_EVENT, openEditor);
    return () => window.removeEventListener(PAGE_NOTICE_EDITOR_EVENT, openEditor);
  }, [isAdmin, openFeatured, openNew]);

  const openEdit = (n: PageNotice) => {
    setErr(null);
    setForm(formForNotice(n));
  };

  const save = async () => {
    if (!form) return;
    setSaving(true);
    setErr(null);
    try {
      const body: PageNoticeInput = {
        id: form.id ?? undefined,
        path: form.path.trim(),
        placement: form.placement,
        level: form.level,
        icon: form.icon,
        color: form.color,
        bodyZh: form.bodyZh.trim(),
        bodyEn: form.bodyEn.trim(),
        href: form.href.trim(),
        enabled: form.enabled,
        dismissible: form.placement === 'home_featured' ? false : form.dismissible,
        startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : null,
        endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : null,
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
  const renders = form != null || visible.length > 0;

  // 把本条实际高度写进 --page-notice-h,供全屏页(position:fixed;inset:0,如 /sim /paint)
  // 顶部让位——否则那些页会盖住通知或编辑器。无内容时置 0。
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

  const canSave = form != null
    && form.path.trim() !== ''
    && (form.bodyZh.trim() !== '' || form.bodyEn.trim() !== '')
    && (form.placement !== 'home_featured' || form.href.trim() !== '');

  return (
    <div className="page-notice-wrap" ref={wrapRef}>
      {visible.map((n) => {
        const Icon = iconFor(n);
        return (
          <div key={n.id} className="page-notice" data-level={n.level}
            data-color={isColor(n.color) ? n.color : undefined} role="status">
            {isAdmin && (
              <button type="button" className="page-notice-btn page-notice-edit" onClick={() => openEdit(n)}
                aria-label={tr({ en: 'Edit notice', zh: '编辑通知' })}>
                <Pencil size={15} aria-hidden />
              </button>
            )}
            <Icon className="page-notice-icon" size={17} aria-hidden />
            <div className="page-notice-body">{linkifyText(pick(n))}</div>
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

      {isAdmin && form && (
        <div className="page-notice-editor">
          <div className="page-notice-editor-row">
            <label className="page-notice-field">
              <span><T en="Placement" zh="展示位" /></span>
              <select className="page-notice-input" value={form.placement}
                onChange={(e) => {
                  const placement = e.target.value as NoticePlacement;
                  setForm({
                    ...form,
                    placement,
                    path: placement === 'home_featured' ? '/' : form.path,
                    dismissible: placement === 'home_featured' ? false : form.dismissible,
                  });
                }}>
                <option value="page_top">{tr({ en: 'Page top', zh: '页面顶部' })}</option>
                <option value="home_featured">{tr({ en: 'Homepage feature', zh: '首页焦点' })}</option>
              </select>
            </label>
          </div>
          <label className="page-notice-field">
            <span><T en="Applies to path (use /* for whole site)" zh="作用路径(填 /* 覆盖全站)" /></span>
            <input className="page-notice-input" value={form.path} disabled={form.placement === 'home_featured'}
              onChange={(e) => setForm({ ...form, path: e.target.value })} placeholder="/scramble/stats" />
          </label>

          <label className="page-notice-field">
            <span><T en="Target link (required for homepage feature)" zh="目标链接(首页焦点必填)" /></span>
            <input className="page-notice-input" value={form.href}
              onChange={(e) => setForm({ ...form, href: e.target.value })}
              placeholder="/regulation/news#4-pad-2027" />
          </label>

          <div className="page-notice-editor-row">
            <label className="page-notice-field">
              <span><T en="Starts (optional)" zh="开始时间(可选)" /></span>
              <input type="datetime-local" className="page-notice-input" value={form.startsAt}
                onChange={(e) => setForm({ ...form, startsAt: e.target.value })} />
            </label>
            <label className="page-notice-field">
              <span><T en="Ends (optional)" zh="结束时间(可选)" /></span>
              <input type="datetime-local" className="page-notice-input" value={form.endsAt}
                onChange={(e) => setForm({ ...form, endsAt: e.target.value })} />
            </label>
          </div>

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
            {form.placement === 'page_top' && (
              <BoolToggle value={form.dismissible} onChange={(v) => setForm({ ...form, dismissible: v })}
                label={<T en="Dismissible" zh="可关闭" />} ariaLabel={tr({ en: 'Dismissible', zh: '可关闭' })} />
            )}
          </div>

          <div className="page-notice-field">
            <span><T en="Icon" zh="图标" /></span>
            <div className="page-notice-iconpicker">
              {(() => {
                const AutoIcon = LEVEL_ICON[form.level];
                return (
                  <button type="button"
                    className={`page-notice-iconbtn${form.icon === '' ? ' is-active' : ''}`}
                    onClick={() => setForm({ ...form, icon: '' })}
                    title={tr({ en: 'Auto (by level)', zh: '自动(按级别)' })}
                    aria-label={tr({ en: 'Auto icon by level', zh: '按级别自动图标' })}
                    aria-pressed={form.icon === ''}>
                    <AutoIcon size={16} aria-hidden />
                  </button>
                );
              })()}
              {ICON_KEYS.map((k) => {
                const KIcon = ICONS[k];
                return (
                  <button key={k} type="button"
                    className={`page-notice-iconbtn${form.icon === k ? ' is-active' : ''}`}
                    onClick={() => setForm({ ...form, icon: k })}
                    title={k} aria-label={k} aria-pressed={form.icon === k}>
                    <KIcon size={16} aria-hidden />
                  </button>
                );
              })}
            </div>
          </div>

          <div className="page-notice-field">
            <span><T en="Banner color" zh="横幅颜色" /></span>
            <div className="page-notice-colorpicker">
              <button type="button"
                className={`page-notice-swatch is-auto${form.color === '' ? ' is-active' : ''}`}
                onClick={() => setForm({ ...form, color: '' })}
                title={tr({ en: 'Auto (by level)', zh: '自动(按级别)' })}
                aria-label={tr({ en: 'Auto color by level', zh: '按级别自动配色' })}
                aria-pressed={form.color === ''} />
              {COLOR_KEYS.map((c) => (
                <button key={c} type="button"
                  className={`page-notice-swatch${form.color === c ? ' is-active' : ''}`}
                  style={{ '--pn-swatch-c': colorVar(c) } as CSSProperties}
                  onClick={() => setForm({ ...form, color: c })}
                  title={c} aria-label={c} aria-pressed={form.color === c} />
              ))}
            </div>
          </div>

          <p className="page-notice-hint">
            {form.placement === 'home_featured'
              ? <T en="Enabled: whether this feature is shown during its active window." zh="启用:这条焦点新闻是否在生效时间窗内展示。" />
              : (
                  <T
                    en="Enabled: whether this notice shows at all (off = saved but hidden from everyone). Dismissible: whether visitors can click × to close it (off = always shown, cannot be dismissed)."
                    zh="启用:这条通知是否显示(关掉则保存但不展示给任何人)。可关闭:访客能否点 × 关掉它(关掉则常驻,访客无法关闭)。"
                  />
                )}
          </p>

          <div className="page-notice-field">
            <div className="page-notice-presets">
              {PRESETS.map((p) => {
                const PIcon = ICONS[p.icon] ?? LEVEL_ICON[p.level];
                return (
                  <button key={p.label.en} type="button" className="page-notice-preset"
                    style={{ '--pn-preset-c': colorVar(p.color) } as CSSProperties}
                    onClick={() => setForm({ ...form, level: p.level, icon: p.icon, color: p.color, bodyZh: p.bodyZh, bodyEn: p.bodyEn })}>
                    <PIcon size={13} aria-hidden />
                    {tr(p.label)}
                  </button>
                );
              })}
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

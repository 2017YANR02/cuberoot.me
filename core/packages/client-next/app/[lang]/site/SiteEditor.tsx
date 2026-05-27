'use client';

/**
 * 弹窗编辑/新增一个网址条目。create 时 site=null;edit 时传入现有 site。
 * 保存调用 nav_sites_api,成功后调 onSaved(updated) 由父组件刷新本地列表。
 *
 * 1:1 port from packages/client/src/pages/sites/SiteEditor.tsx.
 */
import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { GROUPS } from './data/categories';
import type { GroupId, Site } from './data/types';
import { createSite, updateSite, type SiteInput } from './nav_sites_api';

interface Props {
  initial: Site | null;
  defaultGroup: GroupId;
  lang: 'en' | 'zh';
  onClose: () => void;
  onSaved: (s: Site) => void;
}

const TXT = {
  titleNew:    { en: 'Add Site',    zh: '新增网站' },
  titleEdit:   { en: 'Edit Site',   zh: '编辑网站' },
  group:       { en: 'Group',       zh: '分组' },
  name:        { en: 'Name',        zh: '名称' },
  nameEn:      { en: 'Name (EN)',   zh: '英文名（可选）' },
  nameZh:      { en: 'Name (ZH)',   zh: '中文名（可选）' },
  url:         { en: 'URL',         zh: '主网址' },
  altUrls:     { en: 'Mirrors (one per line)', zh: '镜像网址（每行一条）' },
  author:      { en: 'Author',      zh: '作者' },
  descEn:      { en: 'Description (EN)', zh: '英文简介' },
  descZh:      { en: 'Description (ZH)', zh: '中文简介' },
  youtube:     { en: 'YouTube link', zh: 'YouTube 链接' },
  tags:        { en: 'Tags (comma)', zh: '标签（逗号分隔）' },
  status:      { en: 'Offline?',    zh: '是否失效' },
  cancel:      { en: 'Cancel',      zh: '取消' },
  save:        { en: 'Save',        zh: '保存' },
} as const;

function emptyDraft(group: GroupId) {
  return {
    group,
    name: '',
    name_en: '',
    name_zh: '',
    url: '',
    alt_urls_text: '',
    author: '',
    desc_en: '',
    desc_zh: '',
    youtube: '',
    tags_text: '',
    dead: false,
  };
}

function siteToDraft(s: Site) {
  return {
    group: s.group,
    name: s.name,
    name_en: s.name_en ?? '',
    name_zh: s.name_zh ?? '',
    url: s.url,
    alt_urls_text: (s.alt_urls ?? []).join('\n'),
    author: s.author ?? '',
    desc_en: s.desc_en ?? '',
    desc_zh: s.desc_zh ?? '',
    youtube: s.youtube ?? '',
    tags_text: (s.tags ?? []).join(', '),
    dead: s.status === 'dead',
  };
}

export default function SiteEditor({ initial, defaultGroup, lang, onClose, onSaved }: Props) {
  const [draft, setDraft] = useState(() => initial ? siteToDraft(initial) : emptyDraft(defaultGroup));
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setDraft(initial ? siteToDraft(initial) : emptyDraft(defaultGroup));
  }, [initial, defaultGroup]);

  function set<K extends keyof typeof draft>(k: K, v: (typeof draft)[K]) {
    setDraft((d) => ({ ...d, [k]: v }));
  }

  async function handleSave() {
    setErr(null);
    if (!draft.name.trim()) { setErr('name required'); return; }
    if (!draft.url.trim()) { setErr('url required'); return; }
    const body: SiteInput = {
      group: draft.group,
      name: draft.name.trim(),
      name_en: draft.name_en.trim() || null,
      name_zh: draft.name_zh.trim() || null,
      url: draft.url.trim(),
      alt_urls: draft.alt_urls_text.split('\n').map((s) => s.trim()).filter(Boolean),
      author: draft.author.trim() || null,
      desc_en: draft.desc_en.trim() || null,
      desc_zh: draft.desc_zh.trim() || null,
      youtube: draft.youtube.trim() || null,
      tags: draft.tags_text.split(/[,，]/).map((s) => s.trim()).filter(Boolean),
      status: draft.dead ? 'dead' : null,
    };
    setSaving(true);
    try {
      const saved = initial ? await updateSite(initial.id, body) : await createSite(body);
      onSaved(saved);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="site-editor-backdrop" onClick={onClose}>
      <div className="site-editor" onClick={(e) => e.stopPropagation()}>
        <div className="site-editor-head">
          <h2>{(initial ? TXT.titleEdit : TXT.titleNew)[lang]}</h2>
          <button className="site-editor-close" onClick={onClose} aria-label="close"><X size={18} /></button>
        </div>

        <div className="site-editor-body">
          <label className="site-editor-row">
            <span>{TXT.group[lang]}</span>
            <select value={draft.group} onChange={(e) => set('group', e.target.value as GroupId)}>
              {GROUPS.map((g) => (
                <option key={g.id} value={g.id}>{lang === 'zh' ? g.label_zh : g.label_en}</option>
              ))}
            </select>
          </label>

          <label className="site-editor-row">
            <span>{TXT.name[lang]} *</span>
            <input value={draft.name} onChange={(e) => set('name', e.target.value)} />
          </label>
          <div className="site-editor-row-2">
            <label>
              <span>{TXT.nameEn[lang]}</span>
              <input value={draft.name_en} onChange={(e) => set('name_en', e.target.value)} />
            </label>
            <label>
              <span>{TXT.nameZh[lang]}</span>
              <input value={draft.name_zh} onChange={(e) => set('name_zh', e.target.value)} />
            </label>
          </div>

          <label className="site-editor-row">
            <span>{TXT.url[lang]} *</span>
            <input value={draft.url} onChange={(e) => set('url', e.target.value)} />
          </label>
          <label className="site-editor-row">
            <span>{TXT.altUrls[lang]}</span>
            <textarea rows={2} value={draft.alt_urls_text} onChange={(e) => set('alt_urls_text', e.target.value)} />
          </label>

          <label className="site-editor-row">
            <span>{TXT.author[lang]}</span>
            <input value={draft.author} onChange={(e) => set('author', e.target.value)} />
          </label>

          <label className="site-editor-row">
            <span>{TXT.descEn[lang]}</span>
            <textarea rows={2} value={draft.desc_en} onChange={(e) => set('desc_en', e.target.value)} />
          </label>
          <label className="site-editor-row">
            <span>{TXT.descZh[lang]}</span>
            <textarea rows={2} value={draft.desc_zh} onChange={(e) => set('desc_zh', e.target.value)} />
          </label>

          <label className="site-editor-row">
            <span>{TXT.youtube[lang]}</span>
            <input value={draft.youtube} onChange={(e) => set('youtube', e.target.value)} />
          </label>
          <label className="site-editor-row">
            <span>{TXT.tags[lang]}</span>
            <input value={draft.tags_text} onChange={(e) => set('tags_text', e.target.value)} />
          </label>

          <label className="site-editor-row site-editor-row-inline">
            <input type="checkbox" checked={draft.dead} onChange={(e) => set('dead', e.target.checked)} />
            <span>{TXT.status[lang]}</span>
          </label>

          {err && <div className="site-editor-err">{err}</div>}
        </div>

        <div className="site-editor-foot">
          <button className="site-editor-cancel" onClick={onClose} disabled={saving}>{TXT.cancel[lang]}</button>
          <button className="site-editor-save" onClick={handleSave} disabled={saving}>
            {saving ? '…' : TXT.save[lang]}
          </button>
        </div>
      </div>
    </div>
  );
}

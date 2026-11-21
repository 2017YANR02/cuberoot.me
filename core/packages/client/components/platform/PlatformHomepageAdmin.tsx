'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { ArrowDown, ArrowUp, Plus, Trash2 } from '@app-foundation/icons/lucide';
import { PLATFORM_HOME_AUTO_SECTIONS, PLATFORM_HOME_CONTENT_TYPES, type PlatformHomeContentType, type PlatformHomeContent, type PlatformHomepageSettings, type PlatformHomeFeaturedItem } from '@cuberoot/shared/platform';
import { useT } from '@/hooks/useT';
import BoolToggle from '@/components/BoolToggle';
import SearchInput from '@/components/SearchInput';
import AppLink from '@/components/AppLink';
import { homeContentKey, homeContentHref, homeContentLabels, homeSectionLabels, loadHomepageSettings, saveHomepageSettings } from '@/lib/platform-homepage';
import { PlatformState } from './PlatformState';
import { platformLocalDateTime } from '@/lib/platform-commerce-fields';

function move<T>(items: T[], index: number, delta: number): T[] {
  const next = index + delta;
  if (next < 0 || next >= items.length) return items;
  const result = [...items];
  [result[index], result[next]] = [result[next], result[index]];
  return result;
}

export function PlatformHomepageAdmin() {
  const t = useT();
  const [settings, setSettings] = useState<PlatformHomepageSettings | null>(null);
  const [content, setContent] = useState<PlatformHomeContent[]>([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const [type, setType] = useState<PlatformHomeContentType>('course');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    setError(''); setSettings(null);
    void loadHomepageSettings(controller.signal).then(result => {
      if (!controller.signal.aborted) { setSettings(result.settings); setContent(result.content); }
    }).catch(reason => { if (!controller.signal.aborted) setError(String(reason.message || reason)); });
    return () => controller.abort();
  }, [revision]);
  if (!settings) return error ? <PlatformState kind="error" message={error} onRetry={() => setRevision(value => value + 1)} /> : <PlatformState kind="loading" />;
  const update = (next: PlatformHomepageSettings) => { setSettings(next); setMessage(''); };
  const titleOf = (item: PlatformHomeContent) => t(item.titleZh || item.titleEn, item.titleEn || item.titleZh);
  const enabled = new Set(settings.featuredItems.map(homeContentKey));
  const candidates = content.filter(item => item.type === type && !enabled.has(homeContentKey(item))
    && `${item.titleZh} ${item.titleEn}`.toLowerCase().includes(query.trim().toLowerCase()));
  const selectedItem = candidates.find(item => item.id === selected);
  const patchItem = (index: number, patch: Partial<PlatformHomeFeaturedItem>) => update({ ...settings,
    featuredItems: settings.featuredItems.map((item, i) => i === index ? { ...item, ...patch } : item) });
  const add = () => {
    if (!selectedItem || settings.featuredItems.length >= 12) return;
    update({ ...settings, featuredItems: [...settings.featuredItems, { type, id: selectedItem.id, coverUrl: null, startsAt: null, endsAt: null }] });
    setSelected(''); setQuery('');
  };
  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusy(true); setError(''); setMessage('');
    try { const result = await saveHomepageSettings(settings); setSettings(result.settings); setMessage(t('已保存首页推荐。', 'Homepage recommendations saved.')); }
    catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setBusy(false); }
  };
  const orderedSections = [...settings.sections, ...PLATFORM_HOME_AUTO_SECTIONS.filter(section => !settings.sections.includes(section))];
  return (
  // allow-manual-search: Candidate filtering already updates onChange; this form submits recommendation settings to persist an explicit Save.
  <form className="platform-homepage-admin" onSubmit={event => { void save(event); }}>
    <fieldset disabled={busy} className="platform-homepage-admin-section">
      <legend>{t('精选内容', 'Featured content')}</legend>
      <p>{t('按顺序置顶显示。只可推荐已发布课程、公开讲师或机构，以及尚未结束的已发布活动。', 'Featured items appear first in order. Only published courses, public instructors or schools, and upcoming or ongoing published events are eligible.')}</p>
      <div className="platform-homepage-add">
        <label>{t('内容类型', 'Content type')}<select className="platform-field-control" value={type} onChange={event => { setType(event.target.value as PlatformHomeContentType); setSelected(''); setQuery(''); }}>
          {PLATFORM_HOME_CONTENT_TYPES.map(kind => <option key={kind} value={kind}>{t(homeContentLabels[kind].zh, homeContentLabels[kind].en)}</option>)}
        </select></label>
        <label>{t('搜索内容', 'Search content')}<SearchInput value={query} onChange={value => { setQuery(value); setSelected(''); }} inputClassName="platform-field-control" placeholder={t('按名称搜索', 'Search by name')} /></label>
        <label>{t('选择内容', 'Choose content')}<select className="platform-field-control" value={selected} onChange={event => setSelected(event.target.value)}>
          <option value="">{candidates.length ? t('请选择', 'Select an item') : t('暂无可选内容', 'No available items')}</option>
          {candidates.map(item => <option key={item.id} value={item.id}>{titleOf(item)}</option>)}
        </select></label>
        <button type="button" className="platform-button" onClick={add} disabled={!selectedItem || settings.featuredItems.length >= 12}><Plus aria-hidden />{t('添加推荐', 'Add recommendation')}</button>
      </div>
      {settings.featuredItems.map((item, index) => {
        const source = content.find(entry => homeContentKey(entry) === homeContentKey(item));
        const kind = homeContentLabels[item.type];
        return <div key={homeContentKey(item)} className="platform-homepage-featured-row">
          <header className="platform-homepage-featured-heading">
            <div><small>{t(kind.zh, kind.en)}</small><strong>{index + 1}. {source ? titleOf(source) : t('内容已不可用', 'Content is unavailable')}</strong></div>
            <div className="platform-homepage-row-actions">
              {source && <AppLink className="platform-button" href={homeContentHref(source)} prefetch={false}>{t('查看', 'View')}</AppLink>}
              <button className="platform-button" type="button" disabled={index === 0} aria-label={t('上移', 'Move up')} onClick={() => update({ ...settings, featuredItems: move(settings.featuredItems, index, -1) })}><ArrowUp aria-hidden /></button>
              <button className="platform-button" type="button" disabled={index === settings.featuredItems.length - 1} aria-label={t('下移', 'Move down')} onClick={() => update({ ...settings, featuredItems: move(settings.featuredItems, index, 1) })}><ArrowDown aria-hidden /></button>
              <button className="platform-button" type="button" aria-label={t('移除推荐', 'Remove recommendation')} onClick={() => update({ ...settings, featuredItems: settings.featuredItems.filter((_, i) => i !== index) })}><Trash2 aria-hidden /></button>
            </div>
          </header>
          <div className="platform-form-grid">
            <label className="platform-form-wide">{t('自定义封面（可选）', 'Custom cover (optional)')}<input autoComplete="off" className="platform-field-control" value={item.coverUrl ?? ''} maxLength={2048} onChange={event => patchItem(index, { coverUrl: event.target.value || null })} placeholder={source?.coverUrl ?? t('站内路径或图片网址', 'Site path or image URL')} /></label>
            <label>{t('开始时间（本地时间，可选）', 'Start (local time, optional)')}<input type="datetime-local" className="platform-field-control" value={platformLocalDateTime(item.startsAt)} onChange={event => patchItem(index, { startsAt: event.target.value ? new Date(event.target.value).toISOString() : null })} /></label>
            <label>{t('结束时间（本地时间，可选）', 'End (local time, optional)')}<input type="datetime-local" className="platform-field-control" value={platformLocalDateTime(item.endsAt)} onChange={event => patchItem(index, { endsAt: event.target.value ? new Date(event.target.value).toISOString() : null })} /></label>
          </div>
        </div>;
      })}
    </fieldset>
    <fieldset disabled={busy} className="platform-homepage-admin-section">
      <legend>{t('自动推荐', 'Automatic recommendations')}</legend>
      <p>{t('人气按有效解锁人数去重，本周热门按北京时间本周新增解锁人数，最新按首次发布时间。讲师和机构从公开精选资料选取，活动按开始时间推荐。', 'Popularity counts unique active learners, weekly trends count new unlocks this week in Asia/Shanghai, and newest uses the first publication date. Instructors and schools come from curated public profiles, and events are ordered by start time.')}</p>
      {orderedSections.map(section => {
        const index = settings.sections.indexOf(section), active = index !== -1, label = homeSectionLabels[section];
        return <div key={section} className="platform-homepage-auto-row">
          <BoolToggle label={t(label.zh, label.en)} value={active} onChange={next => update({ ...settings, sections: next ? [...settings.sections, section] : settings.sections.filter(value => value !== section) })} />
          <div className="platform-homepage-row-actions">
            <button className="platform-button" type="button" disabled={!active || index === 0} aria-label={t('上移', 'Move up')} onClick={() => update({ ...settings, sections: move(settings.sections, index, -1) })}><ArrowUp aria-hidden /></button>
            <button className="platform-button" type="button" disabled={!active || index === settings.sections.length - 1} aria-label={t('下移', 'Move down')} onClick={() => update({ ...settings, sections: move(settings.sections, index, 1) })}><ArrowDown aria-hidden /></button>
          </div>
        </div>;
      })}
    </fieldset>
    <div className="platform-homepage-row-actions"><button className="platform-button platform-button-primary" type="submit" disabled={busy}>{busy ? t('保存中…', 'Saving…') : t('保存推荐设置', 'Save recommendations')}</button><AppLink className="platform-button" href="/platform" prefetch={false}>{t('查看首页', 'View homepage')}</AppLink></div>
    {error && <p role="alert">{error}</p>}{message && <p role="status">{message}</p>}
  </form>);
}

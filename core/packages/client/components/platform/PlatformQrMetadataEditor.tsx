'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { ArrowDown, ArrowUp, ExternalLink, Plus, Trash2 } from 'lucide-react';
import AppLink from '@/components/AppLink';
import BoolToggle from '@/components/BoolToggle';
import { useT } from '@/hooks/useT';
import { getPlatformQrCard, savePlatformQrCard } from '@/lib/platform-qr-card';
import {
  PLATFORM_QR_LINK_LIMIT,
  normalizePlatformQrLinks,
  platformQrCardStudioHref,
  platformQrLinksProblem,
  platformQrTargetProblem,
  type PlatformQrLink,
} from '@/lib/platform-qr-landing';
import type { PlatformActionResult, PlatformEntity } from '@/lib/platform-types';
import styles from './PlatformQrMetadataEditor.module.css';

interface QrMetadataValues {
  code: string;
  label: string;
  type: 'redirect' | 'landing';
  targetKind: 'internal_path' | 'external_url' | 'content';
  targetValue: string;
  titleZh: string;
  titleEn: string;
  intro: string;
  term: string;
  isPrinted: boolean;
  links: PlatformQrLink[];
}

function string(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function valuesFromEntity(entity: PlatformEntity): QrMetadataValues {
  const data = entity.data ?? {};
  return {
    code: string(data.code) || entity.id,
    label: string(data.label),
    type: data.type === 'landing' ? 'landing' : 'redirect',
    targetKind: data.targetKind === 'external_url' || data.targetKind === 'content' ? data.targetKind : 'internal_path',
    targetValue: string(data.targetValue) || string(data.target) || '/',
    titleZh: string(data.titleZh),
    titleEn: string(data.titleEn),
    intro: string(data.intro),
    term: string(data.term),
    isPrinted: Boolean(data.isPrinted),
    links: normalizePlatformQrLinks(data.links),
  };
}

function move<T>(items: readonly T[], index: number, delta: -1 | 1): T[] {
  const nextIndex = index + delta;
  if (nextIndex < 0 || nextIndex >= items.length) return [...items];
  const next = [...items];
  [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
  return next;
}

export function PlatformQrMetadataEditor({ entity, resourceId, busy, runAction }: {
  entity: PlatformEntity;
  resourceId: string;
  busy: string | null;
  runAction: (id: string, payload: Record<string, unknown>) => Promise<PlatformActionResult | undefined>;
}) {
  const t = useT();
  const [values, setValues] = useState(() => valuesFromEntity(entity));
  const [savingCard, setSavingCard] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => {
    setValues(valuesFromEntity(entity));
    setMessage(null);
  }, [entity]);

  const updateLink = (index: number, key: keyof PlatformQrLink, value: string) => {
    setValues((current) => ({
      ...current,
      links: current.links.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item),
    }));
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const linkProblem = platformQrLinksProblem(values.links);
    if (linkProblem) {
      setMessage(linkProblem === 'limit'
        ? t(`一个二维码最多有 ${PLATFORM_QR_LINK_LIMIT} 个链接。`, `A QR code can have up to ${PLATFORM_QR_LINK_LIMIT} links.`)
        : linkProblem === 'label'
          ? t('每个链接都需要名称，且不能超过 160 个字符。', 'Every link needs a label of no more than 160 characters.')
          : linkProblem === 'href'
            ? t('链接必须是站内绝对路径，或不含账号密码的 http(s) 网址。', 'Links must be site-absolute paths or credential-free HTTP(S) URLs.')
            : t('链接说明不能超过 240 个字符。', 'Link notes cannot exceed 240 characters.'));
      return;
    }
    const targetProblem = platformQrTargetProblem(values.targetKind, values.targetValue);
    if (targetProblem) {
      setMessage(targetProblem === 'required'
        ? t('请填写目标值。', 'Enter a target value.')
        : targetProblem === 'internal'
          ? t('站内目标必须是以一个斜线开头的路径。', 'An internal destination must be a path beginning with one slash.')
          : t('外部目标必须是不含账号密码的 http(s) 网址。', 'An external destination must be a credential-free HTTP(S) URL.'));
      return;
    }
    setMessage(null);
    setSavingCard(true);
    try {
      const initial = valuesFromEntity(entity);
      if (values.intro !== initial.intro || values.term !== initial.term) {
        const current = await getPlatformQrCard(entity.id);
        await savePlatformQrCard(entity.id, { ...current.card, intro: values.intro, term: values.term });
      }
      await runAction(resourceId, {
        code: values.code.trim() || null,
        label: values.label.trim(),
        type: values.type,
        targetKind: values.targetKind,
        targetValue: values.targetValue.trim(),
        titleZh: values.titleZh.trim() || null,
        titleEn: values.titleEn.trim() || null,
        isPrinted: values.isPrinted,
        links: values.links.map((item) => ({
          label: item.label.trim(),
          href: item.href.trim(),
          ...(item.note?.trim() ? { note: item.note.trim() } : {}),
        })),
      });
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : t('保存二维码资料失败。', 'Could not save QR details.'));
    } finally {
      setSavingCard(false);
    }
  };

  const working = savingCard || busy === `admin-save:${resourceId}`;
  return (
    <form className="platform-domain-form" onSubmit={submit}>
      <h2>{t('维护二维码', 'Maintain QR code')}</h2>
      <div className="platform-form-grid">
        <label>
          <span>{t('编码', 'Code')}</span>
          <input className="platform-field-control" value={values.code} pattern="[a-z0-9][a-z0-9_-]{5,79}" minLength={6} maxLength={80} onChange={(event) => setValues((current) => ({ ...current, code: event.target.value }))} />
        </label>
        <label>
          <span>{t('内部名称', 'Internal label')}</span>
          <input className="platform-field-control" value={values.label} required maxLength={160} onChange={(event) => setValues((current) => ({ ...current, label: event.target.value }))} />
        </label>
        <label>
          <span>{t('页面行为', 'Page behavior')}</span>
          <select className="platform-field-control" value={values.type} onChange={(event) => setValues((current) => ({ ...current, type: event.target.value as QrMetadataValues['type'] }))}>
            <option value="redirect">{t('直接跳转', 'Redirect')}</option>
            <option value="landing">{t('聚合落地页', 'Landing page')}</option>
          </select>
        </label>
        <label>
          <span>{t('目标类型', 'Target kind')}</span>
          <select className="platform-field-control" value={values.targetKind} onChange={(event) => setValues((current) => ({ ...current, targetKind: event.target.value as QrMetadataValues['targetKind'] }))}>
            <option value="internal_path">{t('站内路径', 'Internal path')}</option>
            <option value="external_url">{t('外部网址', 'External URL')}</option>
            <option value="content">{t('文字内容', 'Content')}</option>
          </select>
        </label>
        <label className="platform-form-wide">
          <span>{values.targetKind === 'content' ? t('文字内容', 'Content') : t('目标值', 'Target value')}</span>
          <textarea className="platform-field-control platform-field-textarea" rows={values.targetKind === 'content' ? 4 : 2} required maxLength={4000} value={values.targetValue} onChange={(event) => setValues((current) => ({ ...current, targetValue: event.target.value }))} />
        </label>
        <label>
          <span>{t('中文标题', 'Chinese title')}</span>
          <input className="platform-field-control" value={values.titleZh} maxLength={240} onChange={(event) => setValues((current) => ({ ...current, titleZh: event.target.value }))} />
        </label>
        <label>
          <span>{t('英文标题', 'English title')}</span>
          <input className="platform-field-control" value={values.titleEn} maxLength={240} onChange={(event) => setValues((current) => ({ ...current, titleEn: event.target.value }))} />
        </label>
        <label className="platform-form-wide">
          <span>{t('落地页介绍与卡片背面副文案', 'Landing introduction and card back subline')}</span>
          <textarea className="platform-field-control platform-field-textarea" rows={4} maxLength={1000} value={values.intro} onChange={(event) => setValues((current) => ({ ...current, intro: event.target.value }))} />
        </label>
        <label className="platform-form-wide">
          <span>{t('卡片术语', 'Card term')}</span>
          <input className="platform-field-control" maxLength={160} value={values.term} onChange={(event) => setValues((current) => ({ ...current, term: event.target.value }))} />
        </label>
        <BoolToggle value={values.isPrinted} onChange={(isPrinted) => setValues((current) => ({ ...current, isPrinted }))} label={t('已经印刷', 'Already printed')} />
      </div>

      <section className={styles.linksEditor} aria-labelledby="platform-qr-links-title">
        <div className={styles.linksHeading}>
          <div>
            <h3 id="platform-qr-links-title">{t('落地页链接', 'Landing links')}</h3>
            <p>{t('第一项会作为主入口。支持站内路径和 http(s) 网址。', 'The first item is the primary destination. Site paths and HTTP(S) URLs are supported.')}</p>
          </div>
          <button type="button" className="platform-button" disabled={values.links.length >= PLATFORM_QR_LINK_LIMIT} onClick={() => setValues((current) => ({ ...current, links: [...current.links, { label: '', href: '/' }] }))}><Plus aria-hidden />{t('添加链接', 'Add link')}</button>
        </div>
        {values.links.length ? (
          <ol className={styles.linkList}>
            {values.links.map((item, index) => (
              <li key={index}>
                <div className={styles.linkFields}>
                  <label><span>{t('名称', 'Label')}</span><input value={item.label} maxLength={160} onChange={(event) => updateLink(index, 'label', event.target.value)} /></label>
                  <label><span>{t('链接', 'URL')}</span><input value={item.href} maxLength={4000} inputMode="url" onChange={(event) => updateLink(index, 'href', event.target.value)} /></label>
                  <label className={styles.noteField}><span>{t('说明（可选）', 'Note (optional)')}</span><input value={item.note ?? ''} maxLength={240} onChange={(event) => updateLink(index, 'note', event.target.value)} /></label>
                </div>
                <div className={styles.linkActions}>
                  <button type="button" disabled={index === 0} aria-label={t('上移链接', 'Move link up')} onClick={() => setValues((current) => ({ ...current, links: move(current.links, index, -1) }))}><ArrowUp aria-hidden /></button>
                  <button type="button" disabled={index === values.links.length - 1} aria-label={t('下移链接', 'Move link down')} onClick={() => setValues((current) => ({ ...current, links: move(current.links, index, 1) }))}><ArrowDown aria-hidden /></button>
                  <button type="button" aria-label={t('删除链接', 'Delete link')} onClick={() => setValues((current) => ({ ...current, links: current.links.filter((_, itemIndex) => itemIndex !== index) }))}><Trash2 aria-hidden /></button>
                </div>
              </li>
            ))}
          </ol>
        ) : <p className={styles.empty}>{t('还没有自定义链接；公开页会显示默认的首页和社群入口。', 'No custom links yet; the public page will show the default home and community destinations.')}</p>}
      </section>

      {message ? <p className="platform-form-error" role="alert">{message}</p> : null}
      <div className={styles.footer}>
        <button type="submit" className="platform-button platform-button-primary" disabled={working}>{working ? t('保存中…', 'Saving…') : t('保存二维码', 'Save QR code')}</button>
        <AppLink href={`/platform/qr/${encodeURIComponent(values.code || resourceId)}?stay=1`} target="_blank" rel="noreferrer" prefetch={false}>{t('预览落地页', 'Preview landing page')}<ExternalLink aria-hidden /></AppLink>
        <AppLink href={platformQrCardStudioHref(values.code || resourceId)} prefetch={false}>{t('打开卡片工作室', 'Open card studio')}</AppLink>
      </div>
    </form>
  );
}

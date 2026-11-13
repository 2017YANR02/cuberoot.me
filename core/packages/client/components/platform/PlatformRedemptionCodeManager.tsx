'use client';

import MoreToggle from '@/components/MoreToggle';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { toLocalIsoDate } from '@cuberoot/shared/iso-date';
import { useT } from '@/hooks/useT';
import { useLang } from '@/i18n/tr';
import { loadPlatformResource } from '@/lib/platform-gateway';
import type { PlatformEntity } from '@/lib/platform-types';
import { PLATFORM_COURSE_SECTIONS, platformCourseSectionsIncludedBy } from '@/lib/platform-routes';
import { PlatformState } from './PlatformState';
import { text, option, field } from './PlatformFormDefinitions';
import { InviteExpiryField, DomainForm, ActionButton } from './PlatformForm';
import { editableEntity } from './PlatformFormValues';
import { type CommonProps } from './PlatformActionTypes';

function escapeCsv(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

function directInviteSectionIds(course: PlatformEntity | null | undefined, slug: string): string[] {
  const section = PLATFORM_COURSE_SECTIONS.find(item => item.slug === slug);
  const lessons = Array.isArray(course?.data?.lessons) ? course.data.lessons : [];
  if (!section) return [];
  return lessons.flatMap((lesson) => {
    if (!lesson || typeof lesson !== 'object' || Array.isArray(lesson)) return [];
    const item = lesson as Record<string, unknown>;
    return typeof item.id === 'string' && String(item.titleZh ?? '').startsWith(section.title.zh) ? [item.id] : [];
  });
}

function inviteSectionIds(course: PlatformEntity | null | undefined, slug: string): string[] {
  return platformCourseSectionsIncludedBy(slug).flatMap(section => directInviteSectionIds(course, section.slug));
}

function preferredInviteScope(course: PlatformEntity | null | undefined): string {
  if (directInviteSectionIds(course, 'core').length) return 'core';
  return PLATFORM_COURSE_SECTIONS.find(section => section.slug !== 'introduction' && directInviteSectionIds(course, section.slug).length)?.slug ?? 'all';
}

interface GeneratedRedemptionCode {
  id: string;
  code: string;
  courseId: string;
}

interface GeneratedRedemptionCodes {
  batchReference?: string;
  codes: GeneratedRedemptionCode[];
}

function platformCourseUrl(courseId: string, lang: 'en' | 'zh'): string {
  const langPrefix = lang === 'zh' ? '/zh' : '';
  return `https://cuberoot.me${langPrefix}/platform/courses/${encodeURIComponent(courseId)}`;
}

export function PlatformRedemptionCodeManager({ definition, entities = [], busy, runAction }: CommonProps) {
  const t = useT();
  const lang = useLang();
  // Ordinary invitation DELETE archives the code; retain physical-bundle audit management.
  const visibleEntities = entities.filter(entity => entity.status !== 'archived' || entity.data?.distributionType === 'physical_bundle');
  const [courses, setCourses] = useState<PlatformEntity[] | null>(null);
  const [courseError, setCourseError] = useState<Error | null>(null);
  const [generated, setGenerated] = useState<GeneratedRedemptionCodes | null>(null);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);
  const [courseId, setCourseId] = useState('');
  const [scope, setScope] = useState('core');
  const [expiresAt, setExpiresAt] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const shareTextRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    setCourseError(null);
    void loadPlatformResource('admin-courses', { routeId: 'admin-courses', params: {}, signal: controller.signal })
      .then((result) => {
        const available = result.items.filter((item) => item.status === 'published' || item.status === 'unlisted');
        setCourses(available);
        setCourseId(available[0]?.id ?? '');
        setScope(preferredInviteScope(available[0]));
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) setCourseError(reason instanceof Error ? reason : new Error(String(reason)));
      });
    return () => controller.abort();
  }, []);

  const courseDetail = courses?.find(course => course.id === courseId) ?? null;
  // Match the course directory's section names; never infer permissions from an invite's label.
  const sectionIds = (slug: string) => inviteSectionIds(courseDetail, slug);
  const hasDirectSection = (slug: string) => directInviteSectionIds(courseDetail, slug).length > 0;
  const generateCode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    const values = new FormData(event.currentTarget);
    const lessonIds = sectionIds(scope);
    if (!courseDetail || courseDetail.id !== courseId || (scope !== 'all' && !hasDirectSection(scope))) {
      setFormError(t('请选择课程中已有的课时范围。', 'Choose an available lesson section.'));
      return;
    }
    const expires = String(values.get('expiresAt') ?? '');
    const maximum = String(values.get('maxRedemptions') ?? '1');
    if (maximum && (!Number.isInteger(Number(maximum)) || Number(maximum) < 1 || Number(maximum) > 1000000000)) {
      setFormError(t('可用人数请填写正整数。', 'Enter a positive whole number of learners.'));
      return;
    }
    if (expires && (!Number.isFinite(Date.parse(expires)) || Date.parse(expires) <= Date.now())) {
      setFormError(t('请选择将来的到期时间。', 'Choose an expiry time in the future.'));
      return;
    }
    const section = PLATFORM_COURSE_SECTIONS.find(item => item.slug === scope);
    const label = String(values.get('label') ?? '').trim()
      || `${courseDetail.title} ${section ? t(section.title.zh, section.title.en) : t('全部课程', 'Full course')}`;
    setFormError(null);
    const response = await runAction('admin-save', undefined, {
      label, status: 'active', maxRedemptions: maximum ? Number(maximum) : null,
      expiresAt: expires ? new Date(expires).toISOString() : null,
      benefit: { courseId, ...(scope === 'all' ? {} : { lessonIds }) },
    });
    if (response?.code) {
      const generatedCode = response.code;
      setGenerated(current => ({
        batchReference: current?.batchReference,
        codes: [...(current?.codes ?? []), { id: response.id ?? '', code: generatedCode, courseId }],
      }));
      setCopyMessage(null);
    }
  };

  const shareText = generated?.codes.map(item => [
    `${t('兑换码：', 'Redemption code:')} ${item.code}`,
    `${t('课程链接：', 'Course link:')} ${platformCourseUrl(item.courseId, lang)}`,
  ].join('\n')).join('\n\n') ?? '';
  useEffect(() => {
    const textarea = shareTextRef.current;
    if (!textarea) return;
    const fitContent = () => {
      const style = window.getComputedStyle(textarea);
      const borderHeight = Number.parseFloat(style.borderTopWidth) + Number.parseFloat(style.borderBottomWidth);
      textarea.style.height = '0px';
      textarea.style.height = `${textarea.scrollHeight + borderHeight}px`;
    };
    fitContent();
    window.addEventListener('resize', fitContent);
    return () => window.removeEventListener('resize', fitContent);
  }, [shareText]);
  const downloadCsv = () => {
    if (!generated?.codes?.length) return;
    const csv = [
      [escapeCsv(t('兑换码', 'Redemption code')), escapeCsv(t('课程链接', 'Course link'))].join(','),
      ...generated.codes.map(item => [escapeCsv(item.code), escapeCsv(platformCourseUrl(item.courseId, lang))].join(',')),
    ].join('\r\n');
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `redemption-codes-${(generated.batchReference ?? 'batch').replace(/[^A-Za-z0-9_-]+/g, '-')}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };
  const copyCodes = async () => {
    try {
      await navigator.clipboard.writeText(shareText);
      setCopyMessage(t('兑换码和课程链接已复制。', 'Redemption codes and course links copied.'));
    } catch {
      setCopyMessage(t('复制失败，请手动选择文本。', 'Copy failed; select the text manually.'));
    }
  };

  const courseOptions = (courses ?? []).map((course) => ({ value: course.id, label: text(course.title, course.title) }));
  return (
    <div className="platform-invite-manager">
      {courseError ? <PlatformState kind="error" message={courseError.message} /> : courses === null ? <PlatformState kind="loading" /> : courseOptions.length === 0 ? (
        <p className="platform-domain-note">{t('还没有可发码的课程，请先发布课程。', 'Publish a course before generating codes.')}</p>
      ) : (
        <form className="platform-invite-create" onSubmit={event => void generateCode(event)}>
          <h2>{t('生成兑换码', 'Create a code')}</h2>
          <div className="platform-form-grid">
            <label><span>{t('课程', 'Course')}</span>
              <select className="platform-field-control" value={courseId} onChange={event => {
                const nextCourseId = event.target.value;
                const nextCourse = courses?.find(course => course.id === nextCourseId);
                setCourseId(nextCourseId);
                setScope(preferredInviteScope(nextCourse));
                setFormError(null);
              }}>
                {courseOptions.map(course => <option key={course.value} value={course.value}>{t(course.label.zh, course.label.en)}</option>)}
              </select>
            </label>
            <label><span>{t('开放内容', 'Access to')}</span>
              <select className="platform-field-control" value={scope} onChange={event => setScope(event.target.value)}>
                {PLATFORM_COURSE_SECTIONS.filter(section => section.slug !== 'introduction').map(section => (
                  <option key={section.slug} value={section.slug} disabled={!hasDirectSection(section.slug)}>{t(section.title.zh, section.title.en)}</option>
                ))}
                <option value="all">{t('全部课程', 'Full course')}</option>
              </select>
            </label>
          </div>
          <p className="platform-domain-note">{t('引言免费公开，不需要兑换。默认每个码供 1 人使用，不限兑换日期。', 'Introductions are free. Each code is for one learner, with no expiry by default.')}</p>
          <details className="platform-invite-options">
            <MoreToggle as="summary">{t('更多设置', 'More options')}</MoreToggle>
            <div className="platform-form-grid">
              <label><span>{t('备注（选填）', 'Note (optional)')}</span><input name="label" className="platform-field-control" maxLength={160} /></label>
              <label><span>{t('可用人数（留空不限）', 'Learners (blank for unlimited)')}</span><input name="maxRedemptions" className="platform-field-control" type="number" min={1} max={1000000000} step={1} defaultValue={1} /></label>
              <InviteExpiryField label={t('兑换截止时间（选填）', 'Redeem by (optional)')} name="expiresAt" value={expiresAt} onChange={setExpiresAt} />
            </div>
          </details>
          {formError ? <p role="alert" className="platform-form-error">{formError}</p> : null}
          <button className="platform-button platform-button-primary" type="submit" disabled={Boolean(busy) || !courseDetail || (scope !== 'all' && !hasDirectSection(scope))}>{busy === 'admin-save' ? t('生成中…', 'Creating…') : t('生成一个兑换码', 'Create one code')}</button>
        </form>
      )}
      {generated?.codes?.length ? (
        <section className="platform-invite-result" aria-label={t('新生成的兑换码', 'New codes')}>
          <h2>{t('复制后发给买家', 'Copy and send to your buyer')}</h2>
          <textarea ref={shareTextRef} className="platform-field-control platform-invite-code-lines" rows={1} readOnly value={shareText} aria-label={t('可转发的兑换信息', 'Shareable redemption details')} />
          <div className="platform-write-actions">
            <button type="button" className="platform-button platform-button-primary" onClick={() => void copyCodes()}>{t('复制', 'Copy')}</button>
            <button type="button" className="platform-button" onClick={downloadCsv}>{t('下载', 'Download')}</button>
          </div>
          {copyMessage ? <p className="platform-domain-note" role="status">{copyMessage}</p> : null}
        </section>
      ) : null}
      {courseOptions.length ? <details className="platform-invite-options">
        <MoreToggle as="summary">{t('随实体魔方批量发码', 'Bulk codes for physical cube packages')}</MoreToggle>
        <DomainForm
          definition={definition}
          busy={busy}
          runAction={async (action, id, payload) => {
            const result = await runAction(action, id, { ...payload, expiresAt: payload?.expiresAt ? new Date(String(payload.expiresAt)).toISOString() : null });
            const batchCourseId = typeof payload?.courseId === 'string' ? payload.courseId : '';
            if (result?.codes?.length && batchCourseId) {
              setGenerated(current => ({
                batchReference: result.batchReference ?? current?.batchReference,
                codes: [...(current?.codes ?? []), ...result.codes!.map(item => ({ ...item, courseId: batchCourseId }))],
              }));
              setCopyMessage(null);
            }
            return result;
          }}
          spec={{
            title: text('批量生成', 'Create multiple codes'),
            action: 'admin-invite-batch',
            fields: [
              field('courseId', '赠送整门课程', 'Gifted full course', { kind: 'select', required: true, options: courseOptions }),
              field('count', '生成数量', 'Quantity', { kind: 'number', min: 1, max: 200, step: 1, required: true, defaultValue: 20 }),
              field('batchReference', '这批码的名称', 'Name for this batch', { required: true, maxLength: 160, placeholder: text('例如：九月赠课', 'For example: September gifts') }),
              field('label', '备注', 'Label', { maxLength: 160 }),
              field('expiresAt', '有效期至', 'Expires at', { kind: 'datetime-local' }),
            ],
          }}
        />
        <p className="platform-domain-note">{t('每个码限 1 人使用，开放整门课程，可登记订单和退款撤销。', 'Each code unlocks the full course for one learner and supports order references and refund revocation.')}</p>
      </details> : null}
      <section className="platform-invite-records">
      <h2>{t('已有兑换码', 'Existing codes')}</h2>
      {!visibleEntities.length ? <p className="platform-domain-note">{t('还没有兑换码。', 'No codes yet.')}</p> : null}
      {visibleEntities.map((raw) => {
        const entity = editableEntity(raw);
        const physical = entity.data?.distributionType === 'physical_bundle';
        const revoked = entity.status === 'revoked';
        const used = Number(entity.data?.redemptionCount ?? 0);
        const maximum = Number(entity.data?.maxRedemptions ?? 0);
        const expires = entity.data?.expiresAt ? new Date(String(entity.data.expiresAt)) : null;
        const validExpiry = expires && Number.isFinite(expires.getTime()) ? expires : null;
        const editEntity = validExpiry ? { ...entity, data: { ...entity.data, expiresAt: new Date(validExpiry.getTime() - validExpiry.getTimezoneOffset() * 60000).toISOString().slice(0, 16) } } : entity;
        const expired = entity.status === 'expired' || Boolean(validExpiry && validExpiry.getTime() <= Date.now());
        const available = entity.status === 'active' && !expired && !(maximum > 0 && used >= maximum);
        const expiryLabel = validExpiry ? `${toLocalIsoDate(validExpiry)} ${validExpiry.toTimeString().slice(0, 5)}` : '';
        const status = revoked ? t('已撤销', 'Revoked') : entity.status === 'archived' ? t('已归档', 'Archived')
          : entity.status === 'paused' ? t('已暂停', 'Paused') : expired ? t('已过期', 'Expired')
          : maximum > 0 && used >= maximum ? t('已用完', 'Used up') : entity.status === 'active' ? t('可用', 'Available') : t('不可用', 'Unavailable');
        const benefit = entity.data?.benefit as Record<string, unknown> | undefined;
        const linkedCourse = courses?.find(course => course.id === benefit?.courseId);
        const ids = Array.isArray(benefit?.lessonIds) ? benefit.lessonIds : null;
        const matchedSection = linkedCourse && ids?.length
          ? PLATFORM_COURSE_SECTIONS.find(section => {
            const matching = inviteSectionIds(linkedCourse, section.slug);
            return matching.length === ids.length && matching.every(id => ids.includes(id));
          }) : undefined;
        const scopeLabel = matchedSection ? t(matchedSection.title.zh, matchedSection.title.en) : ids
          ? t(`指定的 ${ids.length} 节课`, `${ids.length} selected lessons`) : benefit?.membershipPlanId ? t('会员权益', 'Membership') : t('全部课程', 'Full course');
        const courseLabel = [linkedCourse?.title, scopeLabel].filter(Boolean).join(' ');
        return (
          <article className="platform-invite-record" key={entity.id}>
            <div className="platform-invite-record-title"><h3>{entity.title === entity.id ? t('未备注的兑换码', 'Code without a note') : entity.title}</h3><span className="platform-invite-status" data-available={available}>{status}</span></div>
            {entity.title !== courseLabel ? <p className="platform-domain-note">{courseLabel}</p> : null}
            <div className="platform-invite-meta">
              <span>{maximum ? t(`已用 ${used} / ${maximum} 次`, `Used ${used} / ${maximum} times`) : t(`已用 ${used} 次，不限人数`, `Used ${used} times, unlimited learners`)}</span>
              <span>{validExpiry ? t(`${expiryLabel} 到期`, `Expires ${expiryLabel}`) : t('不限兑换日期', 'No expiry')}</span>
            </div>
            <details className="platform-invite-options">
            <MoreToggle as="summary">{t('管理', 'Manage')}</MoreToggle>
            <p className="platform-domain-note">{t('旧码无法再次查看，请从生成时保存的记录中复制。', 'Existing codes cannot be shown again. Use your saved copy.')}</p>
            {!physical ? <>
              <DomainForm definition={definition} entity={editEntity} resourceId={entity.id} busy={busy} runAction={async (action, id, payload) => {
                const expiry = payload?.expiresAt;
                return runAction(action, id, { ...payload, expiresAt: expiry ? new Date(String(expiry)).toISOString() : null });
              }} spec={{ title: text('修改设置', 'Edit settings'), action: 'admin-save', submit: text('保存', 'Save'), fields: [
                field('label', '备注', 'Note', { maxLength: 160 }),
                field('status', '状态', 'Status', { kind: 'select', options: [option('active', '启用', 'Active'), option('paused', '暂停', 'Paused'), option('expired', '已过期', 'Expired')] }),
                field('maxRedemptions', '可用人数', 'Learners', { kind: 'number', min: 1, max: 1000000000, step: 1 }),
                field('expiresAt', '兑换截止时间（留空不限）', 'Redeem by (blank for no expiry)', { kind: 'datetime-local' }),
              ] }} secondaryAction={<ActionButton action="admin-delete" resourceId={entity.id} label={text('删除', 'Delete')} confirm={text(`删除“${entity.title}”？此码将停止兑换并从列表移除，已兑换的课程不受影响。兑换记录会保留。`, `Delete “${entity.title}”? This code will stop working and leave this list. Previously redeemed course access and redemption records will be kept.`)} disabled={Boolean(busy)} busy={busy} runAction={runAction} />} />
            </> : <>
            {!revoked ? <DomainForm definition={definition} entity={entity} resourceId={entity.id} busy={busy} runAction={runAction} spec={{
              title: text('登记订单', 'Record order'),
              action: 'admin-invite-order',
              fields: [field('externalOrderReference', '订单号（留空可解除）', 'Order reference (clear to unbind)', { maxLength: 240 })],
            }} /> : null}
            {!revoked ? <DomainForm definition={definition} resourceId={entity.id} busy={busy} runAction={runAction} spec={{
              title: text('售后撤销', 'After-sales revocation'),
              action: 'admin-invite-revoke',
              fields: [field('reason', '撤销原因', 'Revocation reason', { kind: 'textarea', rows: 3, required: true, maxLength: 500 })],
              submit: text('撤销兑换码并收回对应权益', 'Revoke code and reverse its entitlement'),
            }} /> : <p className="platform-domain-note">{t(`撤销原因：${String(entity.data?.revokedReason ?? '')}`, `Revocation reason: ${String(entity.data?.revokedReason ?? '')}`)}</p>}
            </>}
            </details>
          </article>
        );
      })}
      </section>
    </div>
  );
}

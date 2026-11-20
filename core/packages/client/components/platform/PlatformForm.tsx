'use client';

import MoreToggle from '@/components/MoreToggle';
import { Fragment, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { ArrowLeft, ArrowRight, Check, Star } from '@app-foundation/icons/lucide';
import BoolToggle from '@/components/BoolToggle';
import { CompactSelect } from '@/components/CompactSelect';
import { DateInput } from '@/components/DateInput';
import { useT } from '@/hooks/useT';
import { PLATFORM_ACTION_LABELS } from '@/lib/platform-gateway';
import type { PlatformActionId, PlatformActionResult, PlatformEntity, PlatformLocaleText, PlatformRouteDefinition } from '@/lib/platform-types';
import { PlatformReferenceField } from './PlatformReferenceField';
import { PlatformStructuredField, type CoursePresentationPart } from './PlatformStructuredField';
import { renderArticleMarkdown } from '@/lib/article-markdown';
import { persistItem } from '@/lib/safe-storage';
import { type DomainFormSpec, type RunAction } from './PlatformActionTypes';
import { initialValue, payloadValue, validatePayload } from './PlatformFormValues';
import { usePlatformFormDraft } from './usePlatformFormDraft';

const COURSE_STEPS = [
  { title: { zh: '基本信息', en: 'Basic information' }, fields: ['titleZh', 'titleEn', 'slug'] },
  { title: { zh: '课程定位', en: 'Course positioning' }, fields: ['presentation'], part: 'positioning' },
  { title: { zh: '课程介绍', en: 'Course introduction' }, fields: ['summaryZh', 'summaryEn', 'descriptionZh', 'descriptionEn', 'presentation'], part: 'introduction' },
  { title: { zh: '课程封面', en: 'Course cover' }, fields: ['presentation'], part: 'cover' },
  { title: { zh: '课程大纲', en: 'Course outline' }, fields: ['presentation'], part: 'outline' },
  { title: { zh: '报名与定价', en: 'Enrollment and pricing' }, fields: ['enrollmentMode', 'currency', 'baseAmountMinor', 'memberAmountMinor'] },
  { title: { zh: '确认创建', en: 'Review and create' }, fields: ['status'] },
] satisfies readonly { title: PlatformLocaleText; fields: string[]; part?: CoursePresentationPart }[];

type FormValues = Record<string, string | boolean>;
type CourseDraft = { step: number; values: FormValues };

function readCourseDraft(key?: string): CourseDraft | null {
  if (!key || typeof window === 'undefined') return null;
  try {
    const draft = JSON.parse(window.localStorage.getItem(key) ?? 'null');
    if (!draft || !Number.isInteger(draft.step) || draft.step < 0 || draft.step >= COURSE_STEPS.length || !draft.values || typeof draft.values !== 'object') return null;
    return draft;
  } catch { return null; }
}

function coursePresentation(value: string | boolean | undefined): Record<string, unknown> {
  try {
    const result = JSON.parse(String(value || '{}'));
    return result && typeof result === 'object' && !Array.isArray(result) ? result : {};
  } catch { return {}; }
}

export function InviteExpiryField({ label, value, onChange, name }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  name?: string;
}) {
  const t = useT();
  const [date = '', time = ''] = value.split('T');
  return <div className="platform-invite-expiry">
    <span>{label}</span>
    <div className="platform-invite-datetime">
      <DateInput value={date} aria-label={label} onChange={next => onChange(next ? `${next}T${time || '00:00'}` : '')} />
      <input className="platform-field-control" type="time" aria-label={t('截止时刻', 'Expiry time')} value={time} disabled={!date}
        required={Boolean(date)} onChange={event => onChange(`${date}T${event.target.value}`)} />
    </div>
    {name ? <input type="hidden" name={name} value={value} /> : null}
  </div>;
}

export function DomainForm({ spec, definition, entity, resourceId, busy, runAction, onResult, secondaryAction, courseDraftKey }: {
  spec: DomainFormSpec;
  definition: PlatformRouteDefinition;
  entity?: PlatformEntity;
  resourceId?: string;
  busy: string | null;
  runAction: RunAction;
  onResult?: (result: PlatformActionResult) => void;
  secondaryAction?: ReactNode;
  courseDraftKey?: string;
}) {
  const t = useT();
  const courseWizard = definition.id === 'instructor-course-new';
  const [storedDraft] = useState(() => readCourseDraft(courseDraftKey));
  const [step, setStep] = useState(storedDraft?.step ?? 0);
  const [copyLanguage, setCopyLanguage] = useState<'Zh' | 'En'>(() => t('zh', 'en') === 'zh' ? 'Zh' : 'En');
  const [draftSaved, setDraftSaved] = useState<boolean | null>(null);
  const completed = useRef(false);
  const hasSavedDraft = useRef(Boolean(storedDraft));
  const initial = useMemo(() => Object.fromEntries(spec.fields.map((item) => {
    const restored = storedDraft?.values[item.key];
    return [item.key, typeof restored === 'string' || typeof restored === 'boolean' ? restored : initialValue(item, entity)];
  })), [entity, spec.fields, storedDraft]);
  const { values, setValues, submission, accept } = usePlatformFormDraft(`${definition.id}:${resourceId ?? entity?.id ?? ''}`, initial);
  const [validation, setValidation] = useState<string | null>(null);
  const [pendingUploads, setPendingUploads] = useState<ReadonlySet<string>>(() => new Set());
  const submittedResourceId = spec.resourceIdField ? String(values[spec.resourceIdField] ?? '').trim() : resourceId;
  const actionKey = submittedResourceId ? `${spec.action}:${submittedResourceId}` : spec.action;

  useEffect(() => {
    setValidation(null);
  }, [initial]);

  useEffect(() => {
    if (!courseDraftKey || completed.current) return;
    if (!hasSavedDraft.current && step === 0 && Object.keys(initial).every(key => values[key] === initial[key])) return;
    const saved = persistItem(courseDraftKey, JSON.stringify({ step, values } satisfies CourseDraft));
    hasSavedDraft.current ||= saved;
    setDraftSaved(saved);
  }, [courseDraftKey, step, values, initial]);

  const changeStep = (next: number) => {
    setValidation(null);
    setStep(next);
  };

  const wizardProblem = (index: number) => {
    const fields = spec.fields.filter(item => COURSE_STEPS[index].fields.includes(item.key));
    for (const item of fields) {
      const value = String(values[item.key] ?? '').trim();
      const label = t(item.label.zh, item.label.en);
      if (item.required && !value) return t(`请填写${item.label.zh}。`, `Enter ${item.label.en}.`);
      if (value && ((item.pattern && !new RegExp(`^(?:${item.pattern})$`).test(value)) || (item.maxLength && value.length > item.maxLength) || (item.minLength && value.length < item.minLength))) {
        return t(`请检查${label}的格式或长度。`, `Check the format or length of ${label}.`);
      }
    }
    if (index === 4) {
      const outline = coursePresentation(values.presentation).outline;
      if (Array.isArray(outline) && outline.some(row => !row || typeof row.label !== 'string' || !row.label.trim())) return t('请填写所有章节的名称。', 'Enter a name for every outline section.');
    }
    if (index === 5) {
      try {
        const prices = Object.fromEntries(fields.map(item => [item.key, payloadValue(item, values[item.key] ?? '')]));
        return validatePayload(definition.id, prices, t);
      } catch { return t('请检查价格格式和金额。', 'Check the price format and amounts.'); }
    }
    return null;
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pendingUploads.size || busy === actionKey) return;
    if (courseWizard) {
      const last = COURSE_STEPS.length - 1;
      const stepsToCheck = step === last ? COURSE_STEPS.map((_, index) => index) : [step];
      for (const index of stepsToCheck) {
        const problem = wizardProblem(index);
        if (problem) { setStep(index); setValidation(problem); return; }
      }
      if (step < last) { changeStep(step + 1); return; }
    }
    const missingSelect = spec.fields.find(item => item.kind === 'select' && item.required && !values[item.key]);
    if (missingSelect) {
      setValidation(t(`请选择${missingSelect.label.zh}。`, `Select ${missingSelect.label.en}.`));
      return;
    }
    let payload: Record<string, unknown>;
    try {
      payload = { ...spec.payloadBase, ...Object.fromEntries(spec.fields.map((item) => [item.key, payloadValue(item, values[item.key] ?? '')])) };
      for (const item of spec.fields.filter(item => item.kind === 'markdown')) { const original=entity?.data?.[item.key]; if (original && typeof original === 'object' && !Array.isArray(original)) payload[item.key]={...original,...payload[item.key] as Record<string,unknown>}; }
      if (spec.fields.some((item) => item.kind === 'rating' && (!Number.isInteger(payload[item.key]) || Number(payload[item.key]) < 1 || Number(payload[item.key]) > 5))) {
        setValidation(t('请先选择星级评分。', 'Choose a star rating first.'));
        return;
      }
      if (spec.resourceIdField) delete payload[spec.resourceIdField];
      const problem = validatePayload(definition.id, payload, t);
      if (problem) { setValidation(problem); return; }
      setValidation(null);
    } catch {
      setValidation(t('请检查金额、日期和内容格式。', 'Check the amount, date, and content formats.'));
      return;
    }
    const token = submission();
    const result = await runAction(spec.action, submittedResourceId || undefined, payload);
    if (result) {
      accept(token);
      if (courseDraftKey) {
        completed.current = true;
        try { window.localStorage.removeItem(courseDraftKey); } catch { /* Storage may be unavailable. */ }
      }
      onResult?.(result);
    }
  };

  const renderField = (item: DomainFormSpec['fields'][number], coursePart?: CoursePresentationPart) => {
          const value = values[item.key] ?? '';
          if (item.kind === 'boolean') {
            return (
              <BoolToggle
                key={item.key}
                value={Boolean(value)}
                onChange={(next) => setValues((current) => ({ ...current, [item.key]: next }))}
                label={t(item.label.zh, item.label.en)}
              />
            );
          }
          const label = values.currency === 'USD' && item.key === 'baseAmountMinor' ? t('基础价格（美元）', 'Base price (USD)')
            : values.currency === 'USD' && item.key === 'memberAmountMinor' ? t('权益价格（美元）', 'Entitlement price (USD)')
            : t(item.label.zh, item.label.en);
          if (item.key === 'instructorId') return <PlatformReferenceField key={item.key} source="instructorId" label={t('讲师','Instructor')} multiple={false} selected={value?[String(value)]:[]} onChange={ids=>setValues(current=>({...current,[item.key]:ids[0]??''}))}/>;
          if (item.kind === 'structured') return <PlatformStructuredField key={`${resourceId ?? entity?.id ?? ''}:${item.key}:${coursePart ?? ''}`} fieldKey={item.key} label={label} routeId={definition.id} value={String(value)} coursePart={coursePart} onChange={next => setValues(current=>({...current,[item.key]:next}))} onUploadPending={(key, pending) => setPendingUploads(current => { const next = new Set(current); if (pending) next.add(key); else next.delete(key); return next; })} />;
          if (item.kind === 'markdown') return <label key={item.key} className="platform-form-wide"><span>{label}</span><textarea className="platform-field-control platform-field-textarea" rows={item.rows??8} required={item.required} value={String(value)} onChange={event=>setValues(current=>({...current,[item.key]:event.target.value}))}/><details><MoreToggle as="summary">{t('预览正文','Preview content')}</MoreToggle><div className="platform-prose">{renderArticleMarkdown(String(value))}</div></details></label>;
          if (item.kind === 'datetime-local' && definition.id === 'admin-invites') {
            return <InviteExpiryField key={item.key} label={label} value={String(value)}
              onChange={next => setValues(current => ({ ...current, [item.key]: next }))} />;
          }
          if (item.kind === 'select') {
            const items = (item.options ?? []).map(choice => ({ value: choice.value, label: t(choice.label.zh, choice.label.en) }));
            const current = items.find(choice => choice.value === String(value))?.label ?? (String(value) || t('请选择', 'Select'));
            return <div key={item.key} className="platform-form-select-field">
              <span>{label}</span>
              <CompactSelect className="platform-form-select" triggerClassName="platform-field-control" unstyledTrigger showArrow
                label={current} ariaLabel={label} valueText={current} value={String(value)} items={items}
                onChange={next => setValues(previous => ({ ...previous, [item.key]: next }))} />
              {item.key === 'currency' && value === 'USD' && values.enrollmentMode === 'purchase' && <small role="status">{t('美元课程暂未接入在线支付。', 'Online payment is not yet available for USD courses.')}</small>}
            </div>;
          }
          if (item.kind === 'rating') {
            return (
              <fieldset key={item.key} className="platform-star-rating platform-form-wide" disabled={busy === actionKey}>
                <legend>{label}</legend>
                <div className="platform-rating-stars">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <label key={star} className="platform-rating-star" data-filled={star <= Number(value)}>
                      <input className="platform-rating-input" type="radio" name={item.key} value={star} checked={Number(value) === star} required={item.required}
                        aria-label={t(`${star} 星`, `${star} ${star === 1 ? 'star' : 'stars'}`)}
                        onChange={() => setValues((current) => ({ ...current, [item.key]: String(star) }))} />
                      <Star size={32} strokeWidth={1.5} aria-hidden="true" />
                    </label>
                  ))}
                </div>
              </fieldset>
            );
          }
          return (
            <label key={item.key} className={item.kind === 'textarea' || item.kind === 'lines' || item.kind === 'json' ? 'platform-form-wide' : undefined}>
              <span className={spec.action === 'redeem-invite' ? 'sr-only' : undefined}>{label}</span>
              {item.kind === 'textarea' || item.kind === 'lines' || item.kind === 'json' ? (
                <textarea className="platform-field-control platform-field-textarea" value={String(value)} rows={courseWizard && item.key.startsWith('description') ? 4 : item.rows ?? 4} required={item.required} maxLength={item.maxLength} onChange={(event) => setValues((current) => ({ ...current, [item.key]: event.target.value }))} />
              ) : item.kind === 'date' ? (
                <DateInput
                  value={String(value)}
                  required={item.required}
                  aria-label={label}
                  onChange={(nextValue) => setValues((current) => ({ ...current, [item.key]: nextValue }))}
                />
              ) : (
                <input
                  className="platform-field-control"
                  value={String(value)}
                  type={item.kind === 'money' ? 'number' : item.kind ?? 'text'}
                  required={item.required}
                  min={item.min}
                  max={item.max}
                  step={item.step}
                  pattern={item.pattern}
                  minLength={item.minLength}
                  maxLength={item.maxLength}
                  placeholder={item.placeholder ? t(item.placeholder.zh, item.placeholder.en) : undefined}
                  onChange={(event) => setValues((current) => ({ ...current, [item.key]: event.target.value }))}
                />
              )}
            </label>
          );
  };
  if (courseWizard) {
    const currentStep = COURSE_STEPS[step];
    const last = step === COURSE_STEPS.length - 1;
    const blocked = busy === actionKey || pendingUploads.size > 0;
    const presentation = coursePresentation(values.presentation);
    const summaryValue = (key: string) => {
      const field = spec.fields.find(item => item.key === key);
      const option = field?.options?.find(item => item.value === values[key]);
      return option ? t(option.label.zh, option.label.en) : String(values[key] || '—');
    };
    const reviewItems = [
      { label: t('中文标题', 'Chinese title'), value: summaryValue('titleZh') },
      { label: t('英文标题', 'English title'), value: summaryValue('titleEn') },
      { label: t('课程定位', 'Course positioning'), value: [presentation.level, presentation.format].filter(Boolean).join(' · ') || '—' },
      { label: t('课程大纲', 'Course outline'), value: t(`${Array.isArray(presentation.outline) ? presentation.outline.length : 0} 个章节`, `${Array.isArray(presentation.outline) ? presentation.outline.length : 0} sections`) },
      { label: t('课程介绍', 'Course introduction'), value: String(values[t('summaryZh', 'summaryEn')] || values[t('descriptionZh', 'descriptionEn')] || '—') },
      { label: t('报名方式', 'Enrollment mode'), value: summaryValue('enrollmentMode') },
      { label: t('基础价格', 'Base price'), value: `${values.currency} ${summaryValue('baseAmountMinor')}` },
      { label: t('权益价格', 'Entitlement price'), value: values.memberAmountMinor !== '' ? `${values.currency} ${summaryValue('memberAmountMinor')}` : '—' },
    ];
    const visibleFields = spec.fields.filter(item => currentStep.fields.includes(item.key) && (step !== 2 || item.key === 'presentation' || item.key.endsWith(copyLanguage)));
    return <form className="platform-domain-form platform-course-wizard" onSubmit={submit}>
      <ol className="platform-wizard-progress" aria-label={t('课程创建进度', 'Course creation progress')}>
        {COURSE_STEPS.map((item, index) => <li key={item.title.en} aria-label={t(item.title.zh, item.title.en)} aria-current={index === step ? 'step' : undefined} data-complete={index < step}>
          <span className="platform-wizard-step-number">{index < step ? <Check size={16} aria-hidden /> : index + 1}</span><span className="platform-wizard-step-label">{t(item.title.zh, item.title.en)}</span>
        </li>)}
      </ol>
      <div className="platform-wizard-step-heading"><h2>{t(currentStep.title.zh, currentStep.title.en)}</h2>{step === 2 && <div className="platform-filter-chips platform-wizard-copy-languages" role="group" aria-label={t('课程介绍语言', 'Course introduction language')}>
        <button type="button" className="platform-filter-option" aria-pressed={copyLanguage === 'Zh'} onClick={() => setCopyLanguage('Zh')}>中文</button>
        <button type="button" className="platform-filter-option" aria-pressed={copyLanguage === 'En'} onClick={() => setCopyLanguage('En')}>English</button>
      </div>}</div>
      {last && <div className="platform-wizard-review">
        <dl>{reviewItems.map(item => <div key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}</dl>
        {typeof presentation.coverUrl === 'string' && presentation.coverUrl && <img className="platform-wizard-review-cover" src={presentation.coverUrl} alt={t('课程封面', 'Course cover')} />}
      </div>}
      <div className="platform-form-grid" data-step={step} key={step}>
        {visibleFields.map(item => renderField(item, 'part' in currentStep ? currentStep.part : undefined))}
      </div>
      {validation && <p className="platform-form-error" role="alert">{validation}</p>}
      <div className="platform-wizard-footer">
        <button type="button" className="platform-button" disabled={step === 0 || blocked} onClick={() => changeStep(step - 1)}><ArrowLeft aria-hidden />{t('上一步', 'Previous')}</button>
        <span className="platform-wizard-draft-status" role="status">{draftSaved === true ? t('草稿已自动保存到此设备', 'Draft saved on this device') : draftSaved === false ? t('无法自动保存草稿', 'Draft could not be saved') : t('自动保存草稿', 'Autosave enabled')}</span>
        <button type="submit" className="platform-button platform-button-primary" disabled={blocked}>{pendingUploads.size ? t('正在上传封面…', 'Uploading covers…') : busy === actionKey ? t('正在创建…', 'Creating…') : last ? t('创建课程', 'Create course') : t('下一步', 'Next')}{!last && <ArrowRight aria-hidden />}</button>
      </div>
    </form>;
  }
  return (
    <form className="platform-domain-form" onSubmit={submit}>
      <h2 className={spec.titleHidden ? 'sr-only' : undefined}>{t(spec.title.zh, spec.title.en)}</h2>
      <div className="platform-form-grid">
        {spec.fields.map(item => <Fragment key={item.key}>
          {item.sectionTitle && <h3 className="platform-form-section-title">{t(item.sectionTitle.zh, item.sectionTitle.en)}</h3>}
          {renderField(item)}
        </Fragment>)}
      </div>
      {validation ? <p className="platform-form-error" role="alert">{validation}</p> : null}
      <div className="platform-write-actions">
      <button type="submit" className="platform-button platform-button-primary" disabled={busy === actionKey || pendingUploads.size > 0}>
        {pendingUploads.size ? t('正在上传封面…', 'Uploading covers…') : busy === actionKey ? t('处理中…', 'Working…') : t(spec.submit?.zh ?? PLATFORM_ACTION_LABELS[spec.action].zh, spec.submit?.en ?? PLATFORM_ACTION_LABELS[spec.action].en)}
      </button>
      {secondaryAction}
      </div>
    </form>
  );
}

export function ActionButton({ action, resourceId, payload, label, confirm, secondary = false, disabled = false, busy, runAction }: {
  action: PlatformActionId;
  resourceId?: string;
  payload?: Record<string, unknown>;
  label?: PlatformLocaleText;
  confirm?: PlatformLocaleText;
  secondary?: boolean;
  disabled?: boolean;
  busy: string | null;
  runAction: RunAction;
}) {
  const t = useT();
  const key = resourceId ? `${action}:${resourceId}` : action;
  const buttonLabel = label ?? PLATFORM_ACTION_LABELS[action];
  return <button type="button" className={`platform-button${secondary ? '' : ' platform-button-primary'}`} disabled={disabled || !resourceId || busy === key} onClick={() => {
    if (confirm && !window.confirm(t(confirm.zh, confirm.en))) return;
    void runAction(action, resourceId, payload);
  }}>{busy === key ? t('处理中…', 'Working…') : t(buttonLabel.zh, buttonLabel.en)}</button>;
}

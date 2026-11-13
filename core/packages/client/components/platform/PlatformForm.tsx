'use client';

import MoreToggle from '@/components/MoreToggle';
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Star } from '@app-foundation/icons/lucide';
import BoolToggle from '@/components/BoolToggle';
import { DateInput } from '@/components/DateInput';
import { useT } from '@/hooks/useT';
import { PLATFORM_ACTION_LABELS } from '@/lib/platform-gateway';
import type { PlatformActionId, PlatformActionResult, PlatformEntity, PlatformLocaleText, PlatformRouteDefinition } from '@/lib/platform-types';
import { PlatformReferenceField } from './PlatformReferenceField';
import { PlatformStructuredField } from './PlatformStructuredField';
import { renderArticleMarkdown } from '@/lib/article-markdown';
import { type DomainFormSpec, type RunAction } from './PlatformActionTypes';
import { initialValue, payloadValue, validatePayload } from './PlatformFormValues';
import { usePlatformFormDraft } from './usePlatformFormDraft';

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

export function DomainForm({ spec, definition, entity, resourceId, busy, runAction, onResult, secondaryAction }: {
  spec: DomainFormSpec;
  definition: PlatformRouteDefinition;
  entity?: PlatformEntity;
  resourceId?: string;
  busy: string | null;
  runAction: RunAction;
  onResult?: (result: PlatformActionResult) => void;
  secondaryAction?: ReactNode;
}) {
  const t = useT();
  const initial = useMemo(() => Object.fromEntries(spec.fields.map((item) => [item.key, initialValue(item, entity)])), [entity, spec.fields]);
  const { values, setValues, submission, accept } = usePlatformFormDraft(`${definition.id}:${resourceId ?? entity?.id ?? ''}`, initial);
  const [validation, setValidation] = useState<string | null>(null);
  const submittedResourceId = spec.resourceIdField ? String(values[spec.resourceIdField] ?? '').trim() : resourceId;
  const actionKey = submittedResourceId ? `${spec.action}:${submittedResourceId}` : spec.action;

  useEffect(() => {
    setValidation(null);
  }, [initial]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
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
    if (result) { accept(token); onResult?.(result); }
  };

  return (
    <form className="platform-domain-form" onSubmit={submit}>
      <h2>{t(spec.title.zh, spec.title.en)}</h2>
      <div className="platform-form-grid">
        {spec.fields.map((item) => {
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
          const label = t(item.label.zh, item.label.en);
          if (item.key === 'instructorId') return <PlatformReferenceField key={item.key} source="instructorId" label={t('讲师','Instructor')} multiple={false} selected={value?[String(value)]:[]} onChange={ids=>setValues(current=>({...current,[item.key]:ids[0]??''}))}/>;
          if (item.kind === 'structured') return <PlatformStructuredField key={item.key} fieldKey={item.key} label={label} routeId={definition.id} value={String(value)} onChange={next => setValues(current=>({...current,[item.key]:next}))} />;
          if (item.kind === 'markdown') return <label key={item.key} className="platform-form-wide"><span>{label}</span><textarea className="platform-field-control platform-field-textarea" rows={item.rows??8} required={item.required} value={String(value)} onChange={event=>setValues(current=>({...current,[item.key]:event.target.value}))}/><details><MoreToggle as="summary">{t('预览正文','Preview content')}</MoreToggle><div className="platform-prose">{renderArticleMarkdown(String(value))}</div></details></label>;
          if (item.kind === 'datetime-local' && definition.id === 'admin-invites') {
            return <InviteExpiryField key={item.key} label={label} value={String(value)}
              onChange={next => setValues(current => ({ ...current, [item.key]: next }))} />;
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
              {item.kind === 'select' ? (
                <select className="platform-field-control" value={String(value)} required={item.required} onChange={(event) => setValues((current) => ({ ...current, [item.key]: event.target.value }))}>
                  {item.options?.map((choice) => <option key={choice.value} value={choice.value}>{t(choice.label.zh, choice.label.en)}</option>)}
                </select>
              ) : item.kind === 'textarea' || item.kind === 'lines' || item.kind === 'json' ? (
                <textarea className="platform-field-control platform-field-textarea" value={String(value)} rows={item.rows ?? 4} required={item.required} maxLength={item.maxLength} onChange={(event) => setValues((current) => ({ ...current, [item.key]: event.target.value }))} />
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
        })}
      </div>
      {validation ? <p className="platform-form-error" role="alert">{validation}</p> : null}
      <div className="platform-write-actions">
      <button type="submit" className="platform-button platform-button-primary" disabled={busy === actionKey}>
        {busy === actionKey ? t('处理中…', 'Working…') : t(spec.submit?.zh ?? PLATFORM_ACTION_LABELS[spec.action].zh, spec.submit?.en ?? PLATFORM_ACTION_LABELS[spec.action].en)}
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

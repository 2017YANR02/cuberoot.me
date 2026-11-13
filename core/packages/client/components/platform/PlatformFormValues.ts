import type { useT } from '@/hooks/useT';
import { platformQrLinksProblem, platformQrTargetProblem, type PlatformQrLink, type PlatformQrTargetKind } from '@/lib/platform-qr-landing';
import type { PlatformEntity } from '@/lib/platform-types';
import { platformLocalDateTime, platformMajorToMinor, platformMinorToMajor } from '@/lib/platform-commerce-fields';
import { type FieldSpec } from './PlatformActionTypes';

export function initialValue(spec: FieldSpec, entity?: PlatformEntity): string | boolean {
  const value = entity?.data?.[spec.key] ?? spec.defaultValue ?? (spec.kind === 'boolean' ? false : spec.kind === 'select' ? spec.options?.[0]?.value ?? '' : '');
  if (spec.kind === 'boolean') return Boolean(value);
  if (spec.kind === 'money') return entity?.data?.[spec.key] == null ? String(spec.defaultValue ?? '') : platformMinorToMajor(value);
  if (spec.kind === 'datetime-local') return platformLocalDateTime(value);
  if (spec.kind === 'markdown') { if (typeof value === 'string') return value; const body=value && typeof value === 'object' ? value as Record<string, unknown> : {}; return String(body.markdown ?? body.text ?? body.content ?? ''); }
  if (spec.kind === 'lines' && Array.isArray(value)) return value.map(String).join('\n');
  if ((spec.kind === 'json' || spec.kind === 'structured') && typeof value !== 'string' && value != null) return JSON.stringify(value, null, 2);
  return String(value ?? '');
}

export function payloadValue(spec: FieldSpec, value: string | boolean): unknown {
  if (spec.kind === 'boolean') return Boolean(value);
  const string = String(value).trim();
  if (spec.kind === 'money') return platformMajorToMinor(string);
  if (spec.kind === 'markdown') return { markdown: String(value) };
  if (spec.kind === 'datetime-local') return string ? new Date(string).toISOString() : null;
  if (spec.kind === 'number' || spec.kind === 'rating') return string === '' ? null : Number(string);
  if (spec.kind === 'lines') return string ? string.split(/\r?\n/).map((item) => item.trim()).filter(Boolean) : [];
  if (spec.kind === 'json' || spec.kind === 'structured') return string ? JSON.parse(string) : null;
  // Empty editable copy must clear the saved value; null means leave unchanged in PATCH.
  if (/^(?:title|name|description|summary|excerpt|bio|category)/.test(spec.key)) return string;
  return string || null;
}

export function validatePayload(routeId: string, payload: Record<string, unknown>, t: ReturnType<typeof useT>): string | null {
  if (routeId === 'admin-qr') {
    const rawLinks = payload.links;
    if (!Array.isArray(rawLinks)) return t('落地页链接必须是 JSON 数组。', 'Landing links must be a JSON array.');
    const links = rawLinks.map((raw) => {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
      const item = raw as Record<string, unknown>;
      return {
        label: typeof item.label === 'string' ? item.label : '',
        href: typeof item.href === 'string' ? item.href : '',
        ...(typeof item.note === 'string' ? { note: item.note } : {}),
      } satisfies PlatformQrLink;
    });
    if (links.some((item) => item === null)) return t('每个落地页链接都必须是对象。', 'Every landing link must be an object.');
    const problem = platformQrLinksProblem(links as PlatformQrLink[]);
    if (problem) return problem === 'limit'
      ? t('一个二维码最多有 20 个链接。', 'A QR code can have up to 20 links.')
      : problem === 'label'
        ? t('每个链接都需要名称，且不能超过 160 个字符。', 'Every link needs a label of no more than 160 characters.')
        : problem === 'href'
          ? t('链接必须是站内绝对路径，或不含账号密码的 http(s) 网址。', 'Links must be site-absolute paths or credential-free HTTP(S) URLs.')
          : t('链接说明不能超过 240 个字符。', 'Link notes cannot exceed 240 characters.');
    const targetKind = payload.targetKind as PlatformQrTargetKind;
    const target = typeof payload.targetValue === 'string' ? payload.targetValue : '';
    const targetProblem = platformQrTargetProblem(targetKind, target);
    if (targetProblem === 'required') return t('请填写目标值。', 'Enter a target value.');
    if (targetProblem === 'internal') return t('站内目标必须是以一个斜线开头的路径。', 'An internal destination must be a path beginning with one slash.');
    if (targetProblem === 'external') return t('外部目标必须是不含账号密码的 http(s) 网址。', 'An external destination must be a credential-free HTTP(S) URL.');
  }
  if (routeId === 'admin-coupons' && payload.discountType === 'percent'
    && (!Number.isInteger(Number(payload.discountBps)) || Number(payload.discountBps) < 1 || Number(payload.discountBps) > 10000)) {
    return t('百分比优惠必须是 1 到 10000 的万分制整数。', 'Percentage discounts must be an integer from 1 to 10000 basis points.');
  }
  if (routeId === 'admin-coupons' && payload.discountType === 'fixed'
    && (!Number.isInteger(Number(payload.discountAmountMinor)) || Number(payload.discountAmountMinor) < 0)) {
    return t('固定优惠金额必须是非负整数。', 'The fixed discount must be a non-negative integer.');
  }
  if (routeId === 'admin-coupons' && payload.startsAt && payload.endsAt && String(payload.endsAt) <= String(payload.startsAt)) {
    return t('结束时间必须晚于开始时间。', 'The end time must be later than the start time.');
  }
  if ((routeId === 'admin-event' || routeId === 'admin-event-new') && String(payload.endsAt ?? '') < String(payload.startsAt ?? '')) {
    return t('结束日期不能早于开始日期。', 'End date cannot be earlier than start date.');
  }
  if ((routeId === 'admin-course' || routeId === 'admin-course-new' || routeId === 'instructor-course')
    && payload.memberAmountMinor != null && Number(payload.memberAmountMinor) > Number(payload.baseAmountMinor)) {
    return t('权益价格不能高于基础价格。', 'The entitlement amount cannot exceed the base amount.');
  }
  return null;
}

export function editableEntity(entity: PlatformEntity): PlatformEntity {
  if (entity.data?.benefitSnapshot && entity.data.benefit == null) {
    return { ...entity, data: { ...entity.data, benefit: entity.data.benefitSnapshot } };
  }
  return entity;
}

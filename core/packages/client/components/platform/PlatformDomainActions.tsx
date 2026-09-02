'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import AppLink from '@/components/AppLink';
import BoolToggle from '@/components/BoolToggle';
import { DateInput } from '@/components/DateInput';
import { useT } from '@/hooks/useT';
import { apiUrl } from '@/lib/api-base';
import { useAuthUser } from '@/lib/auth-store';
import { platformQrLinksProblem, platformQrTargetProblem, type PlatformQrLink, type PlatformQrTargetKind } from '@/lib/platform-qr-landing';
import { loadPlatformManagedQuizzes, loadPlatformMembershipPlans, loadPlatformMemberships, loadPlatformResource, loadPlatformShippingAddresses, PLATFORM_ACTION_LABELS } from '@/lib/platform-gateway';
import type {
  PlatformCourseWrite,
  PlatformEventWrite,
  PlatformNewsWrite,
  PlatformPathWrite,
  PlatformProductWrite,
} from '@cuberoot/shared';
import type {
  PlatformActionId,
  PlatformActionResult,
  PlatformEntity,
  PlatformLocaleText,
  PlatformMembership,
  PlatformMembershipPlan,
  PlatformRouteDefinition,
  PlatformPaymentAttemptResult,
} from '@/lib/platform-types';
import { isPlatformPaymentAttemptResult } from '@/lib/platform-types';
import { PlatformState } from './PlatformState';
import { PlatformQrMetadataEditor } from './PlatformQrMetadataEditor';

type FieldKind = 'text' | 'textarea' | 'number' | 'date' | 'datetime-local' | 'tel' | 'url' | 'select' | 'boolean' | 'lines' | 'json';

interface FieldSpec<Key extends string = string> {
  key: Key;
  label: PlatformLocaleText;
  kind?: FieldKind;
  required?: boolean;
  min?: number;
  max?: number;
  step?: number;
  rows?: number;
  options?: readonly { value: string; label: PlatformLocaleText }[];
  defaultValue?: string | number | boolean;
  placeholder?: PlatformLocaleText;
  pattern?: string;
  minLength?: number;
  maxLength?: number;
}

interface DomainFormSpec {
  title: PlatformLocaleText;
  action: PlatformActionId;
  fields: readonly FieldSpec[];
  submit?: PlatformLocaleText;
  resourceIdField?: string;
  payloadBase?: Readonly<Record<string, unknown>>;
}

type ContractFields<T> = readonly FieldSpec<Extract<keyof T, string>>[];

type RunAction = (action: PlatformActionId, id?: string, payload?: Record<string, unknown>) => Promise<PlatformActionResult | undefined>;

interface PlatformInstructorApplicationPayload {
  experience: string;
  specialties: string[];
  contact: string;
}

interface PlatformLessonPayload {
  slug: string;
  ordinal: number;
  titleZh: string;
  titleEn: string;
  bodyZh: Record<string, unknown>;
  bodyEn: Record<string, unknown>;
  durationSeconds?: number | null;
  status: 'draft' | 'published' | 'archived';
  accessScope: 'public' | 'entitled';
}

interface PlatformQuizPayload {
  slug: string;
  titleZh: string;
  titleEn: string;
  passingScoreBps: number;
  maxAttempts?: number | null;
  status: 'draft' | 'published' | 'archived';
  questions: Array<Record<string, unknown>>;
}

interface PlatformShippingAddressPayload {
  label?: string | null;
  isDefault?: boolean;
  recipientName: string;
  phone: string;
  countryCode: string;
  region: string;
  city: string;
  postalCode?: string | null;
  addressLine1: string;
  addressLine2?: string | null;
}

const text = (zh: string, en: string): PlatformLocaleText => ({ zh, en });
const option = (value: string, zh: string, en: string) => ({ value, label: text(zh, en) });
const field = <const Key extends string>(key: Key, zh: string, en: string, input: Omit<FieldSpec<Key>, 'key' | 'label'> = {}): FieldSpec<Key> => ({ key, label: text(zh, en), ...input });

const COURSE_FIELDS = [
  field('slug', 'Slug', 'Slug', { required: true, pattern: '[a-z0-9][a-z0-9_-]{0,119}', maxLength: 120 }),
  field('titleZh', '中文标题', 'Chinese title', { required: true, maxLength: 240 }),
  field('titleEn', '英文标题', 'English title', { required: true, maxLength: 240 }),
  field('summaryZh', '中文摘要', 'Chinese summary', { kind: 'textarea', rows: 3, maxLength: 4000 }),
  field('summaryEn', '英文摘要', 'English summary', { kind: 'textarea', rows: 3, maxLength: 4000 }),
  field('descriptionZh', '中文说明', 'Chinese description', { kind: 'textarea', rows: 7 }),
  field('descriptionEn', '英文说明', 'English description', { kind: 'textarea', rows: 7 }),
  field('status', '状态', 'Status', { kind: 'select', options: [option('draft', '草稿', 'Draft'), option('published', '已发布', 'Published'), option('unlisted', '不公开列出', 'Unlisted'), option('archived', '已归档', 'Archived')] }),
  field('enrollmentMode', '报名方式', 'Enrollment mode', { kind: 'select', options: [option('free', '免费', 'Free'), option('purchase', '购买', 'Purchase'), option('invite', '邀请', 'Invite'), option('admin_grant', '管理员授予', 'Administrator grant')] }),
  field('baseAmountMinor', '基础价格（分）', 'Base amount (minor units)', { kind: 'number', min: 0, step: 1, required: true }),
  field('memberAmountMinor', '权益价格（分）', 'Entitlement amount (minor units)', { kind: 'number', min: 0, step: 1 }),
  field('currency', '币种', 'Currency', { required: true, pattern: '[A-Z]{3}', minLength: 3, maxLength: 3, defaultValue: 'CNY' }),
] satisfies ContractFields<PlatformCourseWrite>;

const INSTRUCTOR_COURSE_FIELDS = COURSE_FIELDS;

const EVENT_FIELDS = [
  field('slug', 'Slug', 'Slug', { required: true, pattern: '[a-z0-9][a-z0-9_-]{0,119}', maxLength: 120 }),
  field('titleZh', '中文标题', 'Chinese title', { required: true, maxLength: 240 }),
  field('titleEn', '英文标题', 'English title', { required: true, maxLength: 240 }),
  field('descriptionZh', '中文说明', 'Chinese description', { kind: 'textarea', rows: 5 }),
  field('descriptionEn', '英文说明', 'English description', { kind: 'textarea', rows: 5 }),
  field('status', '状态', 'Status', { kind: 'select', options: [option('draft', '草稿', 'Draft'), option('published', '已发布', 'Published'), option('cancelled', '已取消', 'Cancelled'), option('completed', '已结束', 'Completed'), option('archived', '已归档', 'Archived')] }),
  field('startsAt', '开始时间', 'Starts at', { kind: 'datetime-local', required: true }),
  field('endsAt', '结束时间', 'Ends at', { kind: 'datetime-local', required: true }),
  field('timezone', '时区', 'Timezone', { required: true, defaultValue: 'Asia/Shanghai' }),
  field('venue', '场地 JSON', 'Venue JSON', { kind: 'json', rows: 5, required: true }),
  field('tickets', '票种 JSON 数组', 'Ticket JSON array', { kind: 'json', rows: 8, required: true }),
] satisfies ContractFields<PlatformEventWrite>;

const NEWS_FIELDS = [
  field('slug', 'Slug', 'Slug', { required: true, pattern: '[a-z0-9][a-z0-9_-]{0,159}', maxLength: 160 }),
  field('titleZh', '中文标题', 'Chinese title', { required: true, maxLength: 240 }),
  field('titleEn', '英文标题', 'English title', { required: true, maxLength: 240 }),
  field('bodyZh', '中文正文 JSON', 'Chinese body JSON', { kind: 'json', rows: 10, required: true }),
  field('bodyEn', '英文正文 JSON', 'English body JSON', { kind: 'json', rows: 10, required: true }),
  field('status', '状态', 'Status', { kind: 'select', options: [option('draft', '草稿', 'Draft'), option('published', '已发布', 'Published'), option('archived', '已归档', 'Archived')] }),
] satisfies ContractFields<PlatformNewsWrite>;

const PRODUCT_FIELDS = [
  field('slug', 'Slug', 'Slug', { required: true, pattern: '[a-z0-9][a-z0-9_-]{0,119}', maxLength: 120 }),
  field('productType', '商品类型', 'Product type', { kind: 'select', options: [option('physical', '实物', 'Physical'), option('digital', '数字内容', 'Digital')] }),
  field('titleZh', '中文标题', 'Chinese title', { required: true, maxLength: 240 }),
  field('titleEn', '英文标题', 'English title', { required: true, maxLength: 240 }),
  field('descriptionZh', '中文说明', 'Chinese description', { kind: 'textarea', rows: 6 }),
  field('descriptionEn', '英文说明', 'English description', { kind: 'textarea', rows: 6 }),
  field('status', '状态', 'Status', { kind: 'select', options: [option('draft', '草稿', 'Draft'), option('active', '销售中', 'Active'), option('archived', '已归档', 'Archived')] }),
  field('variants', '规格 JSON 数组', 'Variant JSON array', { kind: 'json', rows: 10, required: true }),
] satisfies ContractFields<PlatformProductWrite>;

const PATH_FIELDS = [
  field('slug', 'Slug', 'Slug', { required: true, pattern: '[a-z0-9][a-z0-9_-]{0,119}', maxLength: 120 }),
  field('titleZh', '中文标题', 'Chinese title', { required: true, maxLength: 240 }),
  field('titleEn', '英文标题', 'English title', { required: true, maxLength: 240 }),
  field('descriptionZh', '中文说明', 'Chinese description', { kind: 'textarea', rows: 6 }),
  field('descriptionEn', '英文说明', 'English description', { kind: 'textarea', rows: 6 }),
  field('status', '状态', 'Status', { kind: 'select', options: [option('draft', '草稿', 'Draft'), option('published', '已发布', 'Published'), option('archived', '已归档', 'Archived')] }),
  field('items', '课程与课次 JSON 数组', 'Course and lesson JSON array', { kind: 'json', rows: 8, required: true }),
] satisfies ContractFields<PlatformPathWrite>;

const INSTRUCTOR_APPLICATION_FIELDS = [
  field('experience', '教学经历', 'Teaching experience', { kind: 'textarea', rows: 7, required: true, maxLength: 20000 }),
  field('specialties', '擅长方向（每行一项）', 'Specialties (one per line)', { kind: 'lines', required: true }),
  field('contact', '联系方式', 'Contact details', { kind: 'textarea', rows: 3, required: true, maxLength: 500 }),
] satisfies ContractFields<PlatformInstructorApplicationPayload>;

const LESSON_FIELDS = [
  field('slug', '课时 Slug', 'Lesson slug', { required: true, pattern: '[a-z0-9][a-z0-9_-]{0,119}', maxLength: 120 }),
  field('ordinal', '顺序', 'Order', { kind: 'number', min: 0, max: 1000000, step: 1, required: true }),
  field('titleZh', '中文标题', 'Chinese title', { required: true, maxLength: 240 }),
  field('titleEn', '英文标题', 'English title', { required: true, maxLength: 240 }),
  field('bodyZh', '中文课时内容 JSON', 'Chinese lesson content JSON', { kind: 'json', rows: 9, required: true, defaultValue: '{}' }),
  field('bodyEn', '英文课时内容 JSON', 'English lesson content JSON', { kind: 'json', rows: 9, required: true, defaultValue: '{}' }),
  field('durationSeconds', '时长（秒）', 'Duration (seconds)', { kind: 'number', min: 0, max: 86400, step: 1 }),
  field('status', '状态', 'Status', { kind: 'select', defaultValue: 'draft', options: [option('draft', '草稿', 'Draft'), option('published', '已发布', 'Published'), option('archived', '已归档', 'Archived')] }),
  field('accessScope', '访问范围', 'Access scope', { kind: 'select', defaultValue: 'entitled', options: [option('public', '公开', 'Public'), option('entitled', '需课程权益', 'Entitled learners')] }),
] satisfies ContractFields<PlatformLessonPayload>;

const QUIZ_FIELDS = [
  field('slug', '测验 Slug', 'Quiz slug', { required: true, pattern: '[a-z0-9][a-z0-9_-]{0,119}', maxLength: 120 }),
  field('titleZh', '中文标题', 'Chinese title', { required: true, maxLength: 240 }),
  field('titleEn', '英文标题', 'English title', { required: true, maxLength: 240 }),
  field('passingScoreBps', '及格分（万分制）', 'Passing score (basis points)', { kind: 'number', min: 0, max: 10000, step: 1, required: true, defaultValue: 6000 }),
  field('maxAttempts', '最多尝试次数', 'Maximum attempts', { kind: 'number', min: 1, max: 1000000, step: 1 }),
  field('status', '状态', 'Status', { kind: 'select', defaultValue: 'draft', options: [option('draft', '草稿', 'Draft'), option('published', '已发布', 'Published'), option('archived', '已归档', 'Archived')] }),
  field('questions', '题目 JSON 数组', 'Question JSON array', { kind: 'json', rows: 12, required: true, defaultValue: '[]' }),
] satisfies ContractFields<PlatformQuizPayload>;

const SHIPPING_ADDRESS_FIELDS = [
  field('label', '地址名称', 'Address label', { maxLength: 80 }),
  field('isDefault', '设为默认地址', 'Set as default', { kind: 'boolean' }),
  field('recipientName', '收件人', 'Recipient', { required: true, maxLength: 120 }),
  field('phone', '联系电话', 'Phone', { kind: 'tel', required: true, maxLength: 40 }),
  field('countryCode', '国家或地区代码', 'Country or region code', { required: true, minLength: 2, maxLength: 2, defaultValue: 'CN' }),
  field('region', '省/州', 'Region', { required: true, maxLength: 120 }),
  field('city', '城市', 'City', { required: true, maxLength: 120 }),
  field('postalCode', '邮编', 'Postal code', { maxLength: 32 }),
  field('addressLine1', '详细地址', 'Address line 1', { required: true, maxLength: 240 }),
  field('addressLine2', '补充地址', 'Address line 2', { maxLength: 240 }),
] satisfies ContractFields<PlatformShippingAddressPayload>;

const LESSON_EDIT_FIELDS = LESSON_FIELDS.filter((item) => !['bodyZh', 'bodyEn', 'durationSeconds'].includes(item.key));

const ADMIN_FORMS: Readonly<Record<string, DomainFormSpec>> = {
  'admin-course-new': { title: text('课程资料', 'Course details'), action: 'admin-save', fields: COURSE_FIELDS },
  'admin-event-new': { title: text('活动资料', 'Event details'), action: 'admin-save', fields: EVENT_FIELDS },
  'admin-teacher-new': { title: text('讲师账号', 'Instructor account'), action: 'admin-save', fields: [
    field('userId', '主站用户 ID', 'Main-site user ID', { kind: 'number', min: 1, step: 1, required: true }),
    field('displayName', '显示名称', 'Display name', { required: true, maxLength: 200 }),
    field('teacherEntryId', '公开讲师资料 ID', 'Public teacher profile ID', { kind: 'number', min: 1, step: 1 }),
    field('bioZh', '中文简介', 'Chinese biography', { kind: 'textarea', rows: 6, maxLength: 50000 }),
    field('bioEn', '英文简介', 'English biography', { kind: 'textarea', rows: 6, maxLength: 50000 }),
  ] },
  'admin-teacher': { title: text('讲师资料', 'Instructor profile'), action: 'admin-save', fields: [
    field('displayName', '显示名称', 'Display name', { required: true, maxLength: 200 }),
    field('teacherEntryId', '公开讲师资料 ID', 'Public teacher profile ID', { kind: 'number', min: 1, step: 1 }),
    field('status', '状态', 'Status', { kind: 'select', options: [option('active', '启用', 'Active'), option('suspended', '暂停', 'Suspended'), option('archived', '归档', 'Archived')] }),
    field('bioZh', '中文简介', 'Chinese biography', { kind: 'textarea', rows: 6, maxLength: 50000 }),
    field('bioEn', '英文简介', 'English biography', { kind: 'textarea', rows: 6, maxLength: 50000 }),
  ] },
  'admin-news-new': { title: text('资讯正文', 'Article content'), action: 'admin-save', fields: NEWS_FIELDS },
  'admin-product-new': { title: text('商品资料', 'Product details'), action: 'admin-save', fields: PRODUCT_FIELDS },
  'admin-paths': { title: text('创建学习路径', 'Create learning path'), action: 'admin-save', fields: PATH_FIELDS },
  'admin-coupons': { title: text('创建优惠券', 'Create coupon'), action: 'admin-save', fields: [
    field('code', '优惠码', 'Coupon code', { required: true, minLength: 2, maxLength: 80 }),
    field('status', '状态', 'Status', { kind: 'select', defaultValue: 'draft', options: [option('draft', '草稿', 'Draft'), option('active', '启用', 'Active'), option('paused', '暂停', 'Paused'), option('expired', '已过期', 'Expired'), option('archived', '已归档', 'Archived')] }),
    field('discountType', '优惠类型', 'Discount type', { kind: 'select', options: [option('fixed', '固定金额', 'Fixed amount'), option('percent', '百分比', 'Percentage')] }),
    field('discountAmountMinor', '固定优惠金额（分）', 'Fixed discount (minor units)', { kind: 'number', min: 0, step: 1 }),
    field('discountBps', '百分比（万分制）', 'Percentage (basis points)', { kind: 'number', min: 1, max: 10000, step: 1 }),
    field('currency', '币种', 'Currency', { pattern: '[A-Z]{3}', minLength: 3, maxLength: 3, defaultValue: 'CNY' }),
    field('minimumOrderAmountMinor', '最低订单金额（分）', 'Minimum order amount', { kind: 'number', min: 0, step: 1, defaultValue: 0 }),
    field('maxRedemptions', '总兑换上限', 'Maximum redemptions', { kind: 'number', min: 1, step: 1 }),
    field('perUserLimit', '每人上限', 'Per-user limit', { kind: 'number', min: 1, step: 1, defaultValue: 1 }),
    field('startsAt', '开始时间', 'Starts at', { kind: 'datetime-local' }),
    field('endsAt', '结束时间', 'Ends at', { kind: 'datetime-local' }),
    field('eligibility', '适用范围 JSON', 'Eligibility JSON', { kind: 'json', rows: 7, required: true, defaultValue: '{}' }),
  ] },
  'admin-invites': { title: text('创建邀请', 'Create invitation'), action: 'admin-save', fields: [
    field('code', '邀请码（留空自动生成）', 'Invitation code (leave blank to generate)', { minLength: 3, maxLength: 128 }),
    field('label', '名称', 'Label', { maxLength: 160 }),
    field('status', '状态', 'Status', { kind: 'select', defaultValue: 'active', options: [option('active', '启用', 'Active'), option('paused', '暂停', 'Paused'), option('expired', '已过期', 'Expired'), option('archived', '已归档', 'Archived')] }),
    field('maxRedemptions', '最多兑换次数', 'Maximum redemptions', { kind: 'number', min: 1, max: 1000000000, step: 1 }),
    field('expiresAt', '有效期至（ISO 时间）', 'Expires at (ISO timestamp)'),
    field('benefit', '权益 JSON', 'Benefit JSON', { kind: 'json', rows: 4, required: true, placeholder: text('{"courseId":"..."}', '{"courseId":"..."}') }),
  ] },
  'admin-qr': { title: text('创建二维码', 'Create QR code'), action: 'admin-save', fields: [
    field('code', '编码（留空自动生成）', 'Code (leave blank to generate)', { pattern: '[a-z0-9][a-z0-9_-]{5,79}', minLength: 6, maxLength: 80 }),
    field('count', '生成数量', 'Quantity to create', { kind: 'number', min: 1, max: 200, step: 1, defaultValue: 1 }),
    field('prefix', '批量编码前缀', 'Batch code prefix', { pattern: '[a-z0-9][a-z0-9_-]{0,47}', maxLength: 48, defaultValue: 'qr' }),
    field('label', '内部名称', 'Internal label', { required: true, maxLength: 160 }),
    field('type', '页面行为', 'Page behavior', { kind: 'select', required: true, defaultValue: 'redirect', options: [option('redirect', '直接跳转', 'Redirect'), option('landing', '聚合落地页', 'Landing page')] }),
    field('targetKind', '目标类型', 'Target kind', { kind: 'select', required: true, defaultValue: 'internal_path', options: [option('internal_path', '站内路径', 'Internal path'), option('external_url', '外部网址', 'External URL'), option('content', '文字内容', 'Content')] }),
    field('targetValue', '目标值', 'Target value', { required: true, defaultValue: '/' }),
    field('titleZh', '中文标题', 'Chinese title'), field('titleEn', '英文标题', 'English title'),
    field('links', '落地页链接 JSON 数组', 'Landing links JSON array', { kind: 'json', rows: 7, required: true, defaultValue: '[]' }),
    field('isPrinted', '已经印刷', 'Already printed', { kind: 'boolean', defaultValue: false }),
  ] },
  'admin-qr-detail': { title: text('维护二维码', 'Maintain QR code'), action: 'admin-save', fields: [
    field('code', '编码', 'Code', { pattern: '[a-z0-9][a-z0-9_-]{5,79}', minLength: 6, maxLength: 80 }),
    field('status', '状态', 'Status', { kind: 'select', options: [option('active', '启用', 'Active'), option('disabled', '停用', 'Disabled'), option('archived', '已归档', 'Archived')] }),
    field('targetKind', '目标类型', 'Target kind', { kind: 'select', options: [option('internal_path', '站内路径', 'Internal path'), option('external_url', '外部网址', 'External URL'), option('content', '文字内容', 'Content')] }), field('targetValue', '目标值', 'Target value'),
    field('titleZh', '中文标题', 'Chinese title'), field('titleEn', '英文标题', 'English title'),
    field('isPrinted', '已经印刷', 'Already printed', { kind: 'boolean' }),
  ] },
  'admin-qr-prompts': { title: text('创建二维码提示词', 'Create QR prompt'), action: 'admin-save', fields: [
    field('templateKey', '模板键', 'Template key', { required: true, pattern: '[a-z0-9][a-z0-9_.-]{0,119}', maxLength: 120 }),
    field('nameZh', '中文名称', 'Chinese name'), field('nameEn', '英文名称', 'English name'),
    field('sortOrder', '排序', 'Sort order', { kind: 'number', min: -1000000, max: 1000000, step: 1, defaultValue: 0 }),
    field('template', '提示词模板 JSON', 'Prompt template JSON', { kind: 'json', rows: 8, required: true }),
  ] },
};

for (const [editId, newId] of [
  ['admin-course', 'admin-course-new'], ['admin-event', 'admin-event-new'],
  ['admin-news-detail', 'admin-news-new'], ['admin-product', 'admin-product-new'],
] as const) {
  (ADMIN_FORMS as Record<string, DomainFormSpec>)[editId] = ADMIN_FORMS[newId];
}

function initialValue(spec: FieldSpec, entity?: PlatformEntity): string | boolean {
  const value = entity?.data?.[spec.key] ?? spec.defaultValue ?? (spec.kind === 'boolean' ? false : '');
  if (spec.kind === 'boolean') return Boolean(value);
  if (spec.kind === 'lines' && Array.isArray(value)) return value.map(String).join('\n');
  if (spec.kind === 'json' && typeof value !== 'string' && value != null) return JSON.stringify(value, null, 2);
  return String(value ?? '');
}

function payloadValue(spec: FieldSpec, value: string | boolean): unknown {
  if (spec.kind === 'boolean') return Boolean(value);
  const string = String(value).trim();
  if (spec.kind === 'number') return string === '' ? null : Number(string);
  if (spec.kind === 'lines') return string ? string.split(/\r?\n/).map((item) => item.trim()).filter(Boolean) : [];
  if (spec.kind === 'json') return string ? JSON.parse(string) : null;
  return string || null;
}

function validatePayload(routeId: string, payload: Record<string, unknown>, t: ReturnType<typeof useT>): string | null {
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

function DomainForm({ spec, definition, entity, resourceId, busy, runAction, onResult }: {
  spec: DomainFormSpec;
  definition: PlatformRouteDefinition;
  entity?: PlatformEntity;
  resourceId?: string;
  busy: string | null;
  runAction: RunAction;
  onResult?: (result: PlatformActionResult) => void;
}) {
  const t = useT();
  const initial = useMemo(() => Object.fromEntries(spec.fields.map((item) => [item.key, initialValue(item, entity)])), [entity, spec.fields]);
  const [values, setValues] = useState<Record<string, string | boolean>>(initial);
  const [validation, setValidation] = useState<string | null>(null);
  const submittedResourceId = spec.resourceIdField ? String(values[spec.resourceIdField] ?? '').trim() : resourceId;
  const actionKey = submittedResourceId ? `${spec.action}:${submittedResourceId}` : spec.action;

  useEffect(() => {
    setValues(initial);
    setValidation(null);
  }, [initial]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    let payload: Record<string, unknown>;
    try {
      payload = { ...spec.payloadBase, ...Object.fromEntries(spec.fields.map((item) => [item.key, payloadValue(item, values[item.key] ?? '')])) };
      if (spec.resourceIdField) delete payload[spec.resourceIdField];
      const problem = validatePayload(definition.id, payload, t);
      if (problem) { setValidation(problem); return; }
      setValidation(null);
    } catch {
      setValidation(t('JSON 字段格式不正确。', 'A JSON field is not valid.'));
      return;
    }
    const result = await runAction(spec.action, submittedResourceId || undefined, payload);
    if (result) onResult?.(result);
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
          return (
            <label key={item.key} className={item.kind === 'textarea' || item.kind === 'lines' || item.kind === 'json' ? 'platform-form-wide' : undefined}>
              <span>{label}</span>
              {item.kind === 'select' ? (
                <select className="platform-field-control" value={String(value)} required={item.required} onChange={(event) => setValues((current) => ({ ...current, [item.key]: event.target.value }))}>
                  {item.options?.map((choice) => <option key={choice.value} value={choice.value}>{t(choice.label.zh, choice.label.en)}</option>)}
                </select>
              ) : item.kind === 'textarea' || item.kind === 'lines' || item.kind === 'json' ? (
                <textarea className="platform-field-control platform-field-textarea" value={String(value)} rows={item.rows ?? 4} required={item.required} onChange={(event) => setValues((current) => ({ ...current, [item.key]: event.target.value }))} />
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
                  type={item.kind ?? 'text'}
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
      <button type="submit" className="platform-button platform-button-primary" disabled={busy === actionKey}>
        {busy === actionKey ? t('处理中…', 'Working…') : t(spec.submit?.zh ?? PLATFORM_ACTION_LABELS[spec.action].zh, spec.submit?.en ?? PLATFORM_ACTION_LABELS[spec.action].en)}
      </button>
    </form>
  );
}

function ActionButton({ action, resourceId, payload, label, confirm, disabled = false, busy, runAction }: {
  action: PlatformActionId;
  resourceId?: string;
  payload?: Record<string, unknown>;
  label?: PlatformLocaleText;
  confirm?: PlatformLocaleText;
  disabled?: boolean;
  busy: string | null;
  runAction: RunAction;
}) {
  const t = useT();
  const key = resourceId ? `${action}:${resourceId}` : action;
  const buttonLabel = label ?? PLATFORM_ACTION_LABELS[action];
  return <button type="button" className="platform-button platform-button-primary" disabled={disabled || !resourceId || busy === key} onClick={() => {
    if (confirm && !window.confirm(t(confirm.zh, confirm.en))) return;
    void runAction(action, resourceId, payload);
  }}>{busy === key ? t('处理中…', 'Working…') : t(buttonLabel.zh, buttonLabel.en)}</button>;
}

function entityFromRecord(value: unknown, fallbackId: string): PlatformEntity | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const data = value as Record<string, unknown>;
  const id = typeof data.id === 'string' ? data.id : fallbackId;
  return {
    id,
    title: typeof data.titleZh === 'string' ? data.titleZh : typeof data.titleEn === 'string' ? data.titleEn : id,
    status: typeof data.status === 'string' ? data.status : null,
    data,
  };
}

function PlatformManagedQuizPanel({ definition, courseId, lessonId, busy, runAction }: {
  definition: PlatformRouteDefinition;
  courseId: string;
  lessonId: string;
  busy: string | null;
  runAction: RunAction;
}) {
  const t = useT();
  const [result, setResult] = useState<PlatformEntity[] | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [revision, setRevision] = useState(0);
  const scope = definition.area === 'admin' ? 'admin' : 'instructor';

  useEffect(() => {
    const controller = new AbortController();
    setResult(null);
    setError(null);
    void loadPlatformManagedQuizzes({ scope, courseId, lessonId, signal: controller.signal })
      .then((response) => setResult(response.items))
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason : new Error(String(reason)));
      });
    return () => controller.abort();
  }, [courseId, lessonId, revision, scope]);

  const refreshingAction: RunAction = async (action, id, payload) => {
    const actionResult = await runAction(action, id, payload);
    setRevision((value) => value + 1);
    return actionResult;
  };

  return (
    <section className="platform-course-editor-section">
      <h3>{t('课时测验', 'Lesson quizzes')}</h3>
      {error instanceof Error ? (
        <PlatformState kind="error" message={error.message} onRetry={() => setRevision((value) => value + 1)} />
      ) : result === null ? <PlatformState kind="loading" /> : result.length === 0 ? <PlatformState kind="empty" /> : (
        <div className="platform-domain-stack">
          {result.map((quiz) => (
            <div className="platform-course-editor-item" key={quiz.id}>
              <DomainForm
                definition={definition}
                entity={quiz}
                resourceId={courseId}
                busy={busy}
                runAction={refreshingAction}
                spec={{
                  title: text(`编辑测验：${quiz.title}`, `Edit quiz: ${quiz.title}`),
                  action: 'save-course-quiz',
                  payloadBase: { lessonId, quizId: quiz.id },
                  fields: QUIZ_FIELDS,
                }}
              />
              <ActionButton
                action="delete-course-quiz"
                resourceId={courseId}
                payload={{ lessonId, quizId: quiz.id }}
                label={text('归档测验', 'Archive quiz')}
                confirm={text('确定归档这个测验吗？', 'Archive this quiz?')}
                busy={busy}
                runAction={refreshingAction}
              />
            </div>
          ))}
        </div>
      )}
      <DomainForm
        definition={definition}
        resourceId={courseId}
        busy={busy}
        runAction={refreshingAction}
        spec={{
          title: text('新建测验', 'Create quiz'),
          action: 'save-course-quiz',
          payloadBase: { lessonId },
          fields: QUIZ_FIELDS,
        }}
      />
    </section>
  );
}

function PlatformCourseContentManager(props: CommonProps) {
  const { definition, params, entity, busy, runAction } = props;
  const t = useT();
  const courseId = entity?.id ?? params.id;
  if (!courseId) return null;
  const lessons = (Array.isArray(entity?.data?.lessons) ? entity.data.lessons : [])
    .map((item, index) => entityFromRecord(item, `lesson-${index + 1}`))
    .filter((item): item is PlatformEntity => item !== null);
  return (
    <section className="platform-course-editor">
      <div className="platform-course-editor-heading">
        <h2>{t('课时与测验', 'Lessons and quizzes')}</h2>
        <ActionButton
          action="delete-course"
          resourceId={courseId}
          label={text('归档课程', 'Archive course')}
          confirm={text('确定归档整门课程吗？', 'Archive this entire course?')}
          busy={busy}
          runAction={runAction}
        />
      </div>
      {lessons.length === 0 ? <PlatformState kind="empty" /> : (
        <div className="platform-domain-stack">
          {lessons.map((lesson) => (
            <section className="platform-course-editor-section" key={lesson.id}>
              <DomainForm
                definition={definition}
                entity={lesson}
                resourceId={courseId}
                busy={busy}
                runAction={runAction}
                spec={{
                  title: text(`编辑课时：${lesson.title}`, `Edit lesson: ${lesson.title}`),
                  action: 'save-course-lesson',
                  payloadBase: { lessonId: lesson.id },
                  fields: LESSON_EDIT_FIELDS,
                }}
              />
              <ActionButton
                action="delete-course-lesson"
                resourceId={courseId}
                payload={{ lessonId: lesson.id }}
                label={text('归档课时', 'Archive lesson')}
                confirm={text('确定归档这个课时吗？', 'Archive this lesson?')}
                busy={busy}
                runAction={runAction}
              />
              <PlatformManagedQuizPanel
                definition={definition}
                courseId={courseId}
                lessonId={lesson.id}
                busy={busy}
                runAction={runAction}
              />
            </section>
          ))}
        </div>
      )}
      <DomainForm
        definition={definition}
        resourceId={courseId}
        busy={busy}
        runAction={runAction}
        spec={{ title: text('新建课时', 'Create lesson'), action: 'save-course-lesson', fields: LESSON_FIELDS }}
      />
    </section>
  );
}

function PlatformQuizAttemptForm({ entity, lessonId, busy, runAction }: {
  entity?: PlatformEntity;
  lessonId: string;
  busy: string | null;
  runAction: RunAction;
}) {
  const t = useT();
  const questions = Array.isArray(entity?.data?.questions)
    ? entity.data.questions.filter((value): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value)))
    : [];
  const quizId = typeof entity?.data?.quizId === 'string' ? entity.data.quizId : '';
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  if (!quizId || questions.length === 0) return <p className="platform-domain-note">{t('这个课时当前没有已发布测验。', 'This lesson has no published quiz.')}</p>;
  const english = t('zh', 'en') === 'en';
  const setAnswer = (id: string, value: unknown) => setAnswers((current) => ({ ...current, [id]: value }));
  return (
    <form className="platform-domain-form" onSubmit={(event) => {
      event.preventDefault();
      void runAction('submit-quiz', lessonId, { quizId, answers });
    }}>
      <h2>{t('课后测验', 'Lesson quiz')}</h2>
      <div className="platform-quiz-questions">
        {questions.map((question, index) => {
          const id = typeof question.id === 'string' ? question.id : String(index);
          const type = typeof question.type === 'string' ? question.type : 'text';
          const prompt = String(question[english ? 'promptEn' : 'promptZh'] ?? question[english ? 'promptZh' : 'promptEn'] ?? id);
          const choices = Array.isArray(question.choices) ? question.choices : [];
          return (
            <fieldset key={id}>
              <legend>{index + 1}. {prompt}</legend>
              {type === 'text' ? (
                <input className="platform-field-control" required value={String(answers[id] ?? '')} onChange={(event) => setAnswer(id, event.target.value)} />
              ) : type === 'boolean' ? (
                <select className="platform-field-control" required value={answers[id] === undefined ? '' : String(answers[id])} onChange={(event) => setAnswer(id, event.target.value === 'true')}>
                  <option value="">{t('请选择', 'Choose')}</option>
                  <option value="true">{t('正确', 'True')}</option>
                  <option value="false">{t('错误', 'False')}</option>
                </select>
              ) : type === 'single_choice' ? (
                <select className="platform-field-control" required value={String(answers[id] ?? '')} onChange={(event) => setAnswer(id, event.target.value)}>
                  <option value="">{t('请选择', 'Choose')}</option>
                  {choices.map((choice, choiceIndex) => {
                    const record = choice && typeof choice === 'object' && !Array.isArray(choice) ? choice as Record<string, unknown> : null;
                    const value = String(record?.value ?? record?.id ?? choiceIndex);
                    const label = String(record?.[english ? 'labelEn' : 'labelZh'] ?? record?.label ?? choice);
                    return <option key={value} value={value}>{label}</option>;
                  })}
                </select>
              ) : (
                <div className="platform-answer-options">
                  {choices.map((choice, choiceIndex) => {
                    const record = choice && typeof choice === 'object' && !Array.isArray(choice) ? choice as Record<string, unknown> : null;
                    const value = String(record?.value ?? record?.id ?? choiceIndex);
                    const label = String(record?.[english ? 'labelEn' : 'labelZh'] ?? record?.label ?? choice);
                    const selected = Array.isArray(answers[id]) && answers[id].includes(value);
                    return <button className="platform-answer-option" key={value} type="button" aria-pressed={selected} onClick={() => setAnswer(id, selected ? (answers[id] as unknown[]).filter((item) => item !== value) : [...(Array.isArray(answers[id]) ? answers[id] as unknown[] : []), value])}>{label}</button>;
                  })}
                </div>
              )}
            </fieldset>
          );
        })}
      </div>
      <button type="submit" className="platform-button platform-button-primary" disabled={busy === `submit-quiz:${lessonId}`}>
        {busy === `submit-quiz:${lessonId}` ? t('处理中…', 'Working…') : t('提交测验', 'Submit quiz')}
      </button>
    </form>
  );
}

function editableEntity(entity: PlatformEntity): PlatformEntity {
  if (entity.data?.benefitSnapshot && entity.data.benefit == null) {
    return { ...entity, data: { ...entity.data, benefit: entity.data.benefitSnapshot } };
  }
  return entity;
}

function PlatformAdminCollectionManager({ definition, entities = [], busy, runAction }: CommonProps) {
  const t = useT();
  const base = ADMIN_FORMS[definition.id];
  if (!base || !['admin-paths', 'admin-coupons', 'admin-invites', 'admin-qr-prompts'].includes(definition.id)) return null;
  const qrTemplates = definition.id === 'admin-qr-prompts';
  return (
    <div className="platform-domain-stack">
      <DomainForm definition={definition} busy={busy} runAction={runAction} spec={base} />
      {entities.map((raw) => {
        const entity = editableEntity(raw);
        const archived = entity.status === 'archived';
        return (
          <section className="platform-domain-actions" key={entity.id}>
            <DomainForm definition={definition} entity={entity} resourceId={entity.id} busy={busy} runAction={runAction} spec={{ ...base, title: text(`编辑：${entity.title}`, `Edit: ${entity.title}`) }} />
            <div className="platform-write-actions">
              {archived && qrTemplates ? <ActionButton action="qr-template-restore" resourceId={entity.id} label={text('恢复模板', 'Restore template')} busy={busy} runAction={runAction} /> : (
                <ActionButton action="admin-delete" resourceId={entity.id} label={text('归档', 'Archive')} confirm={text('确定归档这条记录吗？', 'Archive this record?')} busy={busy} runAction={runAction} />
              )}
              {archived && qrTemplates ? <ActionButton action="qr-template-purge" resourceId={entity.id} label={text('永久删除', 'Permanently delete')} confirm={text('这会永久删除模板，确定继续吗？', 'This permanently deletes the template. Continue?')} busy={busy} runAction={runAction} /> : null}
            </div>
          </section>
        );
      })}
      {qrTemplates && entities.length ? (
        <DomainForm definition={definition} busy={busy} runAction={runAction} spec={{
          title: text('保存当前排序', 'Save current order'),
          action: 'qr-template-reorder',
          fields: [],
          payloadBase: { items: entities.map((item, index) => ({ id: item.id, sortOrder: index })) },
        }} />
      ) : null}
      {entities.length === 0 ? <p className="platform-domain-note">{t('创建第一条记录后，可在此逐项编辑和归档。', 'After creating the first record, it can be edited and archived here.')}</p> : null}
    </div>
  );
}

function escapeCsv(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

function PlatformRedemptionCodeManager({ definition, entities = [], busy, runAction }: CommonProps) {
  const t = useT();
  const [courses, setCourses] = useState<PlatformEntity[] | null>(null);
  const [courseError, setCourseError] = useState<Error | null>(null);
  const [generated, setGenerated] = useState<PlatformActionResult | null>(null);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setCourseError(null);
    void loadPlatformResource('admin-courses', { routeId: 'admin-courses', params: {}, signal: controller.signal })
      .then((result) => setCourses(result.items.filter((item) => item.status === 'published' || item.status === 'unlisted')))
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) setCourseError(reason instanceof Error ? reason : new Error(String(reason)));
      });
    return () => controller.abort();
  }, []);

  const codeLines = generated?.codes?.map((item) => item.code).join('\n') ?? '';
  const downloadCsv = () => {
    if (!generated?.codes?.length) return;
    const csv = ['code,internal_id', ...generated.codes.map((item) => `${escapeCsv(item.code)},${escapeCsv(item.id)}`)].join('\r\n');
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `redemption-codes-${(generated.batchReference ?? 'batch').replace(/[^A-Za-z0-9_-]+/g, '-')}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };
  const copyCodes = async () => {
    try {
      await navigator.clipboard.writeText(codeLines);
      setCopyMessage(t('兑换码已复制。', 'Redemption codes copied.'));
    } catch {
      setCopyMessage(t('复制失败，请手动选择文本。', 'Copy failed; select the text manually.'));
    }
  };

  const base = ADMIN_FORMS['admin-invites'];
  const courseOptions = (courses ?? []).map((course) => ({ value: course.id, label: text(course.title, course.title) }));
  return (
    <div className="platform-domain-stack">
      {courseError ? <PlatformState kind="error" message={courseError.message} /> : courses === null ? <PlatformState kind="loading" /> : courseOptions.length === 0 ? (
        <p className="platform-domain-note">{t('请先发布或设为不公开列出的课程，再生成实体捆绑兑换码。', 'Publish or unlist a course before generating physical-bundle codes.')}</p>
      ) : (
        <DomainForm
          definition={definition}
          busy={busy}
          runAction={runAction}
          onResult={(result) => { setGenerated(result); setCopyMessage(null); }}
          spec={{
            title: text('生成实体魔方随包兑换码', 'Generate physical-bundle redemption codes'),
            action: 'admin-invite-batch',
            fields: [
              field('courseId', '赠送课程', 'Gifted course', { kind: 'select', required: true, options: courseOptions }),
              field('count', '生成数量', 'Quantity', { kind: 'number', min: 1, max: 200, step: 1, required: true, defaultValue: 20 }),
              field('batchReference', '批次编号', 'Batch reference', { required: true, maxLength: 160, placeholder: text('例如：DY-20260829-A', 'For example: DY-20260829-A') }),
              field('label', '备注', 'Label', { maxLength: 160 }),
              field('expiresAt', '有效期至', 'Expires at', { kind: 'datetime-local' }),
            ],
          }}
        />
      )}
      <p className="platform-domain-note">{t('明文兑换码只在生成成功后显示一次。离开页面前请复制或下载 CSV，并把兑换卡随实体魔方放入包裹。', 'Plaintext codes are shown only after creation. Copy or download the CSV before leaving, then place a redemption card inside the physical cube package.')}</p>
      {generated?.codes?.length ? (
        <section className="platform-domain-actions">
          <h2>{t(`已生成 ${generated.codes.length} 个兑换码`, `${generated.codes.length} redemption codes generated`)}</h2>
          <textarea className="platform-field-control platform-field-textarea" rows={Math.min(12, generated.codes.length + 1)} readOnly value={codeLines} aria-label={t('新生成的兑换码', 'New redemption codes')} />
          <div className="platform-write-actions">
            <button type="button" className="platform-button platform-button-primary" onClick={() => void copyCodes()}>{t('复制全部兑换码', 'Copy all codes')}</button>
            <button type="button" className="platform-button" onClick={downloadCsv}>{t('下载 CSV', 'Download CSV')}</button>
          </div>
          {copyMessage ? <p className="platform-domain-note" role="status">{copyMessage}</p> : null}
        </section>
      ) : null}
      {entities.map((raw) => {
        const entity = editableEntity(raw);
        const physical = entity.data?.distributionType === 'physical_bundle';
        if (!physical) {
          return (
            <section className="platform-domain-actions" key={entity.id}>
              <DomainForm definition={definition} entity={entity} resourceId={entity.id} busy={busy} runAction={runAction} spec={{ ...base, title: text(`编辑：${entity.title}`, `Edit: ${entity.title}`) }} />
              <ActionButton action="admin-delete" resourceId={entity.id} label={text('归档', 'Archive')} confirm={text('确定归档这条记录吗？', 'Archive this record?')} busy={busy} runAction={runAction} />
            </section>
          );
        }
        const revoked = entity.status === 'revoked';
        return (
          <section className="platform-domain-actions" key={entity.id}>
            <h2>{entity.title}</h2>
            <p className="platform-domain-note">{t(
              `批次：${String(entity.data?.batchReference ?? '—')}，状态：${entity.status ?? '—'}，兑换次数：${String(entity.data?.redemptionCount ?? 0)}`,
              `Batch: ${String(entity.data?.batchReference ?? '—')}, status: ${entity.status ?? '—'}, redemptions: ${String(entity.data?.redemptionCount ?? 0)}`,
            )}</p>
            {!revoked ? <DomainForm definition={definition} entity={entity} resourceId={entity.id} busy={busy} runAction={runAction} spec={{
              title: text('绑定抖店订单号', 'Bind Douyin order reference'),
              action: 'admin-invite-order',
              fields: [field('externalOrderReference', '订单号（留空可解除）', 'Order reference (clear to unbind)', { maxLength: 240 })],
            }} /> : null}
            {!revoked ? <DomainForm definition={definition} resourceId={entity.id} busy={busy} runAction={runAction} spec={{
              title: text('售后撤销', 'After-sales revocation'),
              action: 'admin-invite-revoke',
              fields: [field('reason', '撤销原因', 'Revocation reason', { kind: 'textarea', rows: 3, required: true, maxLength: 500 })],
              submit: text('撤销兑换码并收回对应权益', 'Revoke code and reverse its entitlement'),
            }} /> : <p className="platform-domain-note">{t(`撤销原因：${String(entity.data?.revokedReason ?? '')}`, `Revocation reason: ${String(entity.data?.revokedReason ?? '')}`)}</p>}
          </section>
        );
      })}
      <DomainForm definition={definition} busy={busy} runAction={runAction} spec={base} />
    </div>
  );
}

function PlatformPayoutManager({ definition, entities = [], busy, runAction }: CommonProps) {
  return (
    <div className="platform-domain-stack">
      <DomainForm definition={definition} busy={busy} runAction={runAction} spec={{
        title: text('生成结算单', 'Generate payout'),
        action: 'admin-payout-generate',
        fields: [field('instructorId', '讲师 ID', 'Instructor ID', { required: true }), field('currency', '币种', 'Currency', { required: true, pattern: '[A-Z]{3}', defaultValue: 'CNY' })],
      }} />
      {entities.map((entity) => entity.status === 'draft' ? (
        <section key={entity.id} className="platform-domain-actions">
          <h2>{entity.title}</h2>
          <ActionButton action="admin-payout-approve" resourceId={entity.id} confirm={text('批准这张结算单吗？', 'Approve this payout?')} busy={busy} runAction={runAction} />
        </section>
      ) : entity.status === 'approved' || entity.status === 'processing' ? (
        <DomainForm key={entity.id} definition={definition} entity={entity} resourceId={entity.id} busy={busy} runAction={runAction} spec={{
          title: text(`登记付款：${entity.title}`, `Record payment: ${entity.title}`),
          action: 'admin-payout',
          fields: [field('providerReference', '付款凭证编号', 'Provider reference', { required: true, maxLength: 240 })],
        }} />
      ) : null)}
    </div>
  );
}

export function PlatformLearningActions(props: CommonProps) {
  const { definition, params, entity, busy, runAction } = props;
  const t = useT();
  if (definition.id === 'course-detail') {
    const mode = entity?.data?.enrollmentMode;
    return (
      <div className="platform-domain-stack">
        <section className="platform-domain-actions">
          <h2>{t('课程操作', 'Course actions')}</h2>
          <div className="platform-write-actions">
            {mode === 'free' ? <ActionButton action="enroll" resourceId={params.id} busy={busy} runAction={runAction} /> : null}
            <ActionButton action="favorite" resourceId={params.id} payload={{ targetType: 'course', active: true }} busy={busy} runAction={runAction} />
            {mode === 'invite' ? <AppLink className="platform-button platform-button-primary" href="/platform/account/invites">{t('兑换课程邀请', 'Redeem course invitation')}</AppLink> : null}
          </div>
          {mode === 'admin_grant' ? <p>{t('这门课程由管理员或机构授予，请联系课程运营方。', 'This course is granted by an administrator or organization; contact the course operator.')}</p> : null}
        </section>
        {mode === 'purchase' ? (
          <DomainForm definition={definition} entity={entity} busy={busy} runAction={runAction} spec={{
            title: text('购买课程', 'Purchase course'),
            action: 'create-order',
            payloadBase: { sellableType: 'course', sellableId: entity?.id ?? params.id },
            fields: [field('quantity', '数量', 'Quantity', { kind: 'number', min: 1, max: 1, step: 1, required: true, defaultValue: 1 }), field('couponCode', '优惠券', 'Coupon code')],
          }} />
        ) : null}
        <DomainForm definition={definition} entity={entity} resourceId={entity?.id ?? params.id} busy={busy} runAction={runAction} spec={{
          title: text('课程评价', 'Course review'),
          action: 'submit-review',
          fields: [field('rating', '评分', 'Rating', { kind: 'number', min: 1, max: 5, step: 1, required: true }), field('title', '标题', 'Title', { maxLength: 160 }), field('body', '评价内容', 'Review', { kind: 'textarea', rows: 5, maxLength: 4000 })],
        }} />
      </div>
    );
  }
  if (definition.id === 'account-invites') {
    return <DomainForm definition={definition} entity={entity} busy={busy} runAction={runAction} spec={{ title: text('兑换课程码', 'Redeem course code'), action: 'redeem-invite', fields: [field('code', '兑换码', 'Redemption code', { required: true, minLength: 3, maxLength: 128 })] }} />;
  }
  if (definition.id === 'progress') {
    return <DomainForm definition={definition} busy={busy} runAction={runAction} spec={{ title: text('每日签到', 'Daily check-in'), action: 'check-in', fields: [field('localDate', '本地日期（留空使用今天）', 'Local date (leave blank for today)', { kind: 'date' })] }} />;
  }
  if (definition.id !== 'course-lesson') return null;
  const lessonId = params.lessonId;
  return (
    <div className="platform-domain-stack">
      <DomainForm definition={definition} entity={entity} resourceId={lessonId} busy={busy} runAction={runAction} spec={{ title: text('学习记录', 'Learning record'), action: 'update-progress', fields: [field('progressPercent', '完成进度', 'Completion', { kind: 'number', min: 0, max: 100, step: 1, required: true }), field('status', '学习状态', 'Learning status', { kind: 'select', options: [option('in_progress', '学习中', 'In progress'), option('completed', '已完成', 'Completed')] }), field('lastPositionSeconds', '视频位置（秒）', 'Video position (seconds)', { kind: 'number', min: 0, step: 1 })] }} />
      <DomainForm definition={definition} entity={entity} resourceId={lessonId} busy={busy} runAction={runAction} spec={{ title: text('课程笔记', 'Lesson note'), action: 'save-note', fields: [field('noteId', '笔记 ID（修改时填写）', 'Note ID (when editing)'), field('contentMarkdown', '笔记', 'Note', { kind: 'textarea', rows: 6, required: true }), field('positionSeconds', '对应视频位置（秒）', 'Video position (seconds)', { kind: 'number', min: 0, step: 1 })] }} />
      <PlatformQuizAttemptForm entity={entity} lessonId={lessonId} busy={busy} runAction={runAction} />
    </div>
  );
}

function PlatformShippingAddressManager({ definition, busy, runAction, onAddresses }: CommonProps & {
  onAddresses?: (addresses: PlatformEntity[]) => void;
}) {
  const [addresses, setAddresses] = useState<PlatformEntity[] | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setError(null);
    void loadPlatformShippingAddresses(controller.signal).then((result) => {
      setAddresses(result.items);
      onAddresses?.(result.items);
    }).catch((reason: unknown) => {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason : new Error(String(reason)));
    });
    return () => controller.abort();
  }, [onAddresses, revision]);
  const refreshingAction: RunAction = async (...args) => {
    const actionResult = await runAction(...args);
    setRevision((value) => value + 1);
    return actionResult;
  };
  return (
    <section className="platform-domain-actions">
      {error ? <PlatformState kind="error" message={error.message} onRetry={() => setRevision((value) => value + 1)} /> : addresses === null ? <PlatformState kind="loading" /> : (
        <div className="platform-domain-stack">
          {addresses.map((address) => (
            <div className="platform-course-editor-item" key={address.id}>
              <DomainForm definition={definition} entity={address} resourceId={address.id} busy={busy} runAction={refreshingAction} spec={{ title: text(`编辑地址：${address.title}`, `Edit address: ${address.title}`), action: 'save-shipping-address', fields: SHIPPING_ADDRESS_FIELDS }} />
              <ActionButton action="delete-shipping-address" resourceId={address.id} confirm={text('确定删除这个收货地址吗？', 'Delete this shipping address?')} busy={busy} runAction={refreshingAction} />
            </div>
          ))}
          <DomainForm definition={definition} busy={busy} runAction={refreshingAction} spec={{ title: text('新建收货地址', 'Add shipping address'), action: 'save-shipping-address', fields: SHIPPING_ADDRESS_FIELDS }} />
        </div>
      )}
    </section>
  );
}

function formatMinor(amountMinor: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amountMinor / 100);
  } catch {
    return `${currency} ${(amountMinor / 100).toFixed(2)}`;
  }
}

function membershipPlanFromEntity(entity: PlatformEntity): PlatformMembershipPlan | null {
  const data = entity.data;
  if (!data || typeof data.id !== 'string' || typeof data.slug !== 'string'
    || typeof data.nameZh !== 'string' || typeof data.nameEn !== 'string'
    || !['day', 'month', 'year', 'lifetime'].includes(String(data.periodUnit))
    || typeof data.periodCount !== 'number' || typeof data.amountMinor !== 'number'
    || typeof data.currency !== 'string' || data.status !== 'active') return null;
  return {
    id: data.id,
    slug: data.slug,
    nameZh: data.nameZh,
    nameEn: data.nameEn,
    descriptionZh: typeof data.descriptionZh === 'string' ? data.descriptionZh : null,
    descriptionEn: typeof data.descriptionEn === 'string' ? data.descriptionEn : null,
    periodUnit: data.periodUnit as PlatformMembershipPlan['periodUnit'],
    periodCount: data.periodCount,
    amountMinor: data.amountMinor,
    currency: data.currency,
    status: 'active',
  };
}

function membershipFromEntity(entity: PlatformEntity): PlatformMembership | null {
  const data = entity.data;
  if (!data || typeof data.id !== 'string' || typeof data.planId !== 'string'
    || typeof data.planSlug !== 'string' || typeof data.planNameZh !== 'string'
    || typeof data.planNameEn !== 'string' || typeof data.isActive !== 'boolean'
    || typeof data.validFrom !== 'string'
    || !['active', 'expired', 'cancelled', 'revoked'].includes(String(data.status))) return null;
  return {
    id: data.id,
    planId: data.planId,
    planSlug: data.planSlug,
    planNameZh: data.planNameZh,
    planNameEn: data.planNameEn,
    status: data.status as PlatformMembership['status'],
    isActive: data.isActive,
    validFrom: data.validFrom,
    validUntil: typeof data.validUntil === 'string' ? data.validUntil : null,
  };
}

function PlatformMembershipCatalog({ definition, entities, busy, runAction }: CommonProps) {
  const t = useT();
  const user = useAuthUser();
  const routeEntities = entities ?? [];
  const [plans, setPlans] = useState<PlatformMembershipPlan[] | null>(null);
  const [memberships, setMemberships] = useState<PlatformMembership[] | null>(null);
  const [planError, setPlanError] = useState<Error | null>(null);
  const [membershipError, setMembershipError] = useState<Error | null>(null);
  const [createdOrderId, setCreatedOrderId] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setPlanError(null);
    if (definition.id === 'membership') {
      setPlans(routeEntities.map(membershipPlanFromEntity).filter((plan): plan is PlatformMembershipPlan => plan !== null));
    } else {
      setPlans(null);
      void loadPlatformMembershipPlans(controller.signal)
        .then(setPlans)
        .catch((reason: unknown) => {
          if (!controller.signal.aborted) setPlanError(reason instanceof Error ? reason : new Error(String(reason)));
        });
    }
    return () => controller.abort();
  }, [definition.id, revision, routeEntities]);
  useEffect(() => {
    setMembershipError(null);
    if (definition.id === 'me-membership') {
      setMemberships(routeEntities.map(membershipFromEntity).filter((membership): membership is PlatformMembership => membership !== null));
      return;
    }
    if (!user) {
      setMemberships([]);
      return;
    }
    const controller = new AbortController();
    setMemberships(null);
    void loadPlatformMemberships(controller.signal)
      .then(setMemberships)
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) setMembershipError(reason instanceof Error ? reason : new Error(String(reason)));
      });
    return () => controller.abort();
  }, [definition.id, revision, routeEntities, user]);
  const activePlanIds = new Set((memberships ?? []).filter((membership) => membership.isActive).map((membership) => membership.planId));
  const purchase = async (plan: PlatformMembershipPlan) => {
    const response = await runAction('create-order', undefined, {
      sellableType: 'platform_membership',
      sellableId: plan.id,
      quantity: 1,
    });
    if (typeof response?.id === 'string') setCreatedOrderId(response.id);
  };
  return (
    <div className="platform-domain-stack">
      {definition.id === 'me-membership' ? (
        <section className="platform-domain-actions">
          <h2>{t('当前课程会员', 'Current course memberships')}</h2>
          {memberships === null ? <PlatformState kind="loading" /> : memberships.length === 0 ? <PlatformState kind="empty" message={t('当前没有课程会员，可从下面的套餐开始购买。', 'You do not have a course membership yet. Choose a plan below to get started.')} /> : (
            <div className="platform-detail-list">
              {memberships.map((membership) => (
                <div key={membership.id}>
                  <strong>{t(membership.planNameZh, membership.planNameEn)}</strong>
                  <span>{membership.isActive ? t('生效中', 'Active') : t('已失效', 'Inactive')}</span>
                  <span>{t('有效期', 'Validity')}: {membership.validFrom.slice(0, 10)} – {membership.validUntil?.slice(0, 10) ?? t('永久', 'Lifetime')}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      ) : null}
      <section className="platform-domain-actions">
        <h2>{t('课程权益套餐', 'Course entitlement plans')}</h2>
        {membershipError ? <PlatformState kind="error" message={t('暂时无法确认现有会员状态，购买操作已停用。', 'Your current membership status could not be confirmed, so purchasing is temporarily disabled.')} onRetry={() => setRevision((value) => value + 1)} /> : null}
        {planError ? <PlatformState kind="error" message={planError.message} onRetry={() => setRevision((value) => value + 1)} /> : plans === null ? <PlatformState kind="loading" /> : plans.length === 0 ? <PlatformState kind="empty" message={t('当前没有在售课程权益套餐。', 'There are no course entitlement plans on sale.')} /> : (
          <div className="platform-detail-list">
            {plans.map((plan) => {
              const active = activePlanIds.has(plan.id);
              const name = t(plan.nameZh, plan.nameEn);
              const description = t(plan.descriptionZh ?? '', plan.descriptionEn ?? '');
              const period = plan.periodUnit === 'lifetime'
                ? t('永久', 'Lifetime')
                : plan.periodUnit === 'day'
                  ? t(`${plan.periodCount} 天`, `${plan.periodCount} day${plan.periodCount === 1 ? '' : 's'}`)
                  : plan.periodUnit === 'month'
                    ? t(`${plan.periodCount} 个月`, `${plan.periodCount} month${plan.periodCount === 1 ? '' : 's'}`)
                    : t(`${plan.periodCount} 年`, `${plan.periodCount} year${plan.periodCount === 1 ? '' : 's'}`);
              return (
                <div key={plan.id}>
                  <strong>{name}</strong>
                  {description ? <span>{description}</span> : null}
                  <span>{period}　{formatMinor(plan.amountMinor, plan.currency)}</span>
                  {user ? (
                    <button
                      type="button"
                      className="platform-button platform-button-primary"
                      disabled={busy === 'create-order' || memberships === null || membershipError !== null}
                      onClick={() => { void purchase(plan); }}
                    >
                      {busy === 'create-order' ? t('处理中…', 'Working…') : active ? t('续期', 'Renew') : t('购买', 'Purchase')}
                    </button>
                  ) : <AppLink className="platform-button platform-button-primary" href="/platform/login" prefetch={false}>{t('登录后购买', 'Sign in to purchase')}</AppLink>}
                </div>
              );
            })}
          </div>
        )}
        {createdOrderId ? <AppLink className="platform-button" href={`/platform/orders/${encodeURIComponent(createdOrderId)}`} prefetch={false}>{t('继续支付新订单', 'Continue to payment')}</AppLink> : null}
      </section>
    </div>
  );
}

function PlatformOrderPayment({ entity, orderId, busy, runAction }: {
  entity?: PlatformEntity;
  orderId: string;
  busy: string | null;
  runAction: RunAction;
}) {
  const t = useT();
  const [attempt, setAttempt] = useState<PlatformPaymentAttemptResult | null>(null);
  const status = typeof entity?.data?.status === 'string' ? entity.data.status : entity?.status;
  const totalAmountMinor = Number(entity?.data?.totalAmountMinor ?? 0);
  const canPay = status === 'pending_payment' && totalAmountMinor > 0;
  const canCancel = status === 'pending_payment';
  const start = async (provider: 'wechat' | 'alipay') => {
    const response = await runAction('start-payment', orderId, { provider });
    if (!response || !isPlatformPaymentAttemptResult(response)) return;
    setAttempt(response);
    if (response.checkoutUrl) window.location.assign(response.checkoutUrl);
  };
  return (
    <section className="platform-domain-actions">
      <h2>{t('支付与订单状态', 'Payment and order status')}</h2>
      <p className="platform-domain-note">{canPay
        ? t('订单待支付。选择支付渠道后，将跳转到渠道页面或显示支付二维码。', 'This order is awaiting payment. Choose a provider to continue by checkout URL or QR code.')
        : status === 'pending_payment'
          ? t('零金额订单不需要发起支付。', 'Zero-value orders do not require a payment attempt.')
          : t('当前订单状态不允许再次发起支付或取消。', 'The current order state does not allow another payment attempt or cancellation.')}</p>
      <div className="platform-write-actions">
        <button type="button" className="platform-button platform-button-primary" disabled={!canPay || busy === `start-payment:${orderId}`} onClick={() => { void start('wechat'); }}>{t('微信支付', 'WeChat Pay')}</button>
        <button type="button" className="platform-button platform-button-primary" disabled={!canPay || busy === `start-payment:${orderId}`} onClick={() => { void start('alipay'); }}>{t('支付宝', 'Alipay')}</button>
        <ActionButton action="cancel-order" resourceId={orderId} disabled={!canCancel} confirm={text('确定取消这笔未支付订单吗？', 'Cancel this unpaid order?')} busy={busy} runAction={runAction} />
      </div>
      {attempt?.qrCodeDataUrl ? (
        <div className="platform-payment-result" role="status">
          <img src={attempt.qrCodeDataUrl} alt={t('支付二维码', 'Payment QR code')} />
          <p>{t('请使用对应支付应用扫码。支付结果以订单状态为准。', 'Scan with the matching payment app. The order status remains the source of truth.')}</p>
        </div>
      ) : null}
      {attempt && !attempt.checkoutUrl && !attempt.qrCodeDataUrl ? <p className="platform-domain-note">{t('支付请求已创建，请刷新订单确认支付状态。', 'The payment attempt was created. Refresh the order to confirm its status.')}</p> : null}
    </section>
  );
}

export function PlatformCommerceActions(props: CommonProps) {
  const { definition, params, entity, busy, runAction } = props;
  const t = useT();
  const [addresses, setAddresses] = useState<PlatformEntity[]>([]);
  if (definition.id === 'membership' || definition.id === 'me-membership') return <PlatformMembershipCatalog {...props} />;
  if (definition.id === 'product-detail') {
    const variants = Array.isArray(entity?.data?.variants) ? entity.data.variants : [];
    const choices = variants.flatMap((raw) => {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return [];
      const variant = raw as Record<string, unknown>;
      if (typeof variant.id !== 'string') return [];
      const zh = typeof variant.titleZh === 'string' ? variant.titleZh : typeof variant.sku === 'string' ? variant.sku : variant.id;
      const en = typeof variant.titleEn === 'string' ? variant.titleEn : typeof variant.sku === 'string' ? variant.sku : variant.id;
      return [option(variant.id, zh, en)];
    });
    const variantField = choices.length
      ? field('sellableId', '商品规格', 'Product variant', { kind: 'select', required: true, options: choices, defaultValue: choices[0].value })
      : field('sellableId', '商品规格 ID', 'Product variant ID', { required: true });
    const physical = entity?.data?.productType === 'physical';
    const orderFields: FieldSpec[] = [variantField, field('quantity', '数量', 'Quantity', { kind: 'number', min: 1, max: 99, step: 1, required: true, defaultValue: 1 }), field('couponCode', '优惠券', 'Coupon code')];
    if (physical) orderFields.push(field('shippingAddressId', '收货地址', 'Shipping address', {
      kind: 'select', required: true, options: addresses.map((address) => option(address.id, address.title, address.title)),
    }));
    return (
      <div className="platform-domain-stack">
        {physical ? <PlatformShippingAddressManager {...props} onAddresses={setAddresses} /> : null}
        {physical && addresses.length === 0 ? <p className="platform-domain-note">{t('请先保存收货地址，再创建实物商品订单。', 'Save a shipping address before creating a physical-product order.')}</p> : (
          <DomainForm definition={definition} entity={entity} busy={busy} runAction={runAction} spec={{ title: text('购买商品', 'Purchase product'), action: 'create-order', payloadBase: { sellableType: 'product_variant' }, fields: orderFields }} />
        )}
        <section className="platform-domain-actions">
          <h2>{t('稍后购买', 'Save for later')}</h2>
          <ActionButton action="wishlist" resourceId={entity?.id ?? params.id} payload={{ active: true }} busy={busy} runAction={runAction} />
        </section>
      </div>
    );
  }
  if (definition.id !== 'order-detail') return null;
  return <PlatformOrderPayment entity={entity} orderId={params.id} busy={busy} runAction={runAction} />;
}

export function PlatformEventActions(props: CommonProps) {
  const { definition, params, entity, busy, runAction } = props;
  const t = useT();
  if (definition.id !== 'event-detail') return null;
  const tickets = Array.isArray(entity?.data?.tickets) ? entity.data.tickets : [];
  const choices = tickets.flatMap((raw) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return [];
    const ticket = raw as Record<string, unknown>;
    if (typeof ticket.id !== 'string' || ticket.status !== 'active' || Number(ticket.available) < 1) return [];
    const zh = typeof ticket.titleZh === 'string' ? ticket.titleZh : typeof ticket.code === 'string' ? ticket.code : ticket.id;
    const en = typeof ticket.titleEn === 'string' ? ticket.titleEn : typeof ticket.code === 'string' ? ticket.code : ticket.id;
    return [option(ticket.id, zh, en)];
  });
  return (
    <div className="platform-domain-stack">
      <section className="platform-domain-actions">
        <h2>{t('活动收藏', 'Event favorite')}</h2>
        <ActionButton action="favorite" resourceId={entity?.id ?? params.id} payload={{ targetType: 'event', active: true }} busy={busy} runAction={runAction} />
      </section>
      {choices.length ? (
        <DomainForm definition={definition} entity={entity} busy={busy} runAction={runAction} spec={{
          title: text('购买活动票', 'Purchase event ticket'),
          action: 'create-order',
          payloadBase: { sellableType: 'event_ticket' },
          fields: [field('sellableId', '票种', 'Ticket type', { kind: 'select', required: true, options: choices, defaultValue: choices[0].value }), field('quantity', '数量', 'Quantity', { kind: 'number', min: 1, max: 99, step: 1, required: true, defaultValue: 1 }), field('couponCode', '优惠券', 'Coupon code')],
        }} />
      ) : <p className="platform-domain-note">{t('当前没有可购买的票种。', 'There are no ticket types currently available for purchase.')}</p>}
    </div>
  );
}

export function PlatformInstructorActions(props: CommonProps) {
  const { definition, params, entity, busy, runAction } = props;
  if (definition.id === 'teacher-apply') {
    return <DomainForm definition={definition} entity={entity} busy={busy} runAction={runAction} spec={{ title: text('申请资料', 'Application'), action: 'apply-instructor', fields: INSTRUCTOR_APPLICATION_FIELDS }} />;
  }
  if (definition.id === 'instructor-course') {
    return (
      <div className="platform-domain-stack">
        <DomainForm definition={definition} entity={entity} resourceId={params.id} busy={busy} runAction={runAction} spec={{ title: text('讲师课程资料', 'Instructor course details'), action: 'save-instructor-course', fields: INSTRUCTOR_COURSE_FIELDS }} />
        <PlatformCourseContentManager {...props} />
      </div>
    );
  }
  if (definition.id === 'instructor-courses') {
    return <DomainForm definition={definition} busy={busy} runAction={runAction} spec={{ title: text('创建讲师课程', 'Create instructor course'), action: 'save-instructor-course', fields: INSTRUCTOR_COURSE_FIELDS }} />;
  }
  if (definition.id === 'instructor-students') {
    return <DomainForm definition={definition} busy={busy} runAction={runAction} spec={{ title: text('签发课程证书', 'Issue course certificate'), action: 'issue-certificate', fields: [field('entitlementId', '学员课程权益 ID', 'Learner entitlement ID', { required: true })] }} />;
  }
  return null;
}

function fulfillmentProgress(item: Record<string, unknown>) {
  const raw = item.fulfillment && typeof item.fulfillment === 'object' && !Array.isArray(item.fulfillment)
    ? item.fulfillment as Record<string, unknown>
    : {};
  return {
    shipped: Number(raw.shippedQuantity ?? 0),
    delivered: Number(raw.deliveredQuantity ?? 0),
    returned: Number(raw.returnedQuantity ?? 0),
  };
}

function shipmentFields(max: number): FieldSpec[] {
  return [
    field('quantity', '数量', 'Quantity', { kind: 'number', required: true, min: 1, max, step: 1, defaultValue: max }),
    field('externalReference', '外部操作编号', 'External reference', { required: true, maxLength: 240 }),
    field('carrier', '承运商', 'Carrier', { maxLength: 120 }),
    field('trackingNumber', '物流单号', 'Tracking number', { maxLength: 200 }),
    field('note', '履约备注', 'Fulfillment note', { kind: 'textarea', rows: 3, maxLength: 1000 }),
  ];
}

function PlatformAdminOrderActions(props: CommonProps) {
  const { definition, params, entity, busy, runAction } = props;
  const t = useT();
  const orderId = params.id;
  const status = typeof entity?.data?.status === 'string' ? entity.data.status : entity?.status;
  const rawItems = Array.isArray(entity?.data?.items) ? entity.data.items : [];
  const items = rawItems.flatMap((raw) => raw && typeof raw === 'object' && !Array.isArray(raw) ? [raw as Record<string, unknown>] : []);
  const canFulfill = status === 'paid' || status === 'partially_fulfilled';
  const canReturn = status === 'partially_refunded' || status === 'refunded';
  const canRefund = ['paid', 'partially_fulfilled', 'fulfilled'].includes(status ?? '');
  return (
    <div className="platform-domain-stack">
      {canRefund ? <DomainForm definition={definition} entity={entity} resourceId={orderId} busy={busy} runAction={runAction} spec={{
        title: text('全额退款', 'Full refund'),
        action: 'admin-refund',
        fields: [
          field('reasonCode', '退款原因代码', 'Reason code', { required: true, maxLength: 64 }),
          field('providerRefundId', '支付渠道退款编号', 'Provider refund ID', { required: true, maxLength: 200 }),
          field('evidenceReference', '凭证说明', 'Evidence reference', { required: true, maxLength: 240 }),
        ],
      }} /> : null}
      <section className="platform-domain-actions">
        <h2>{t('逐项履约', 'Item fulfillment')}</h2>
        {items.length === 0 ? <PlatformState kind="empty" /> : (
          <div className="platform-domain-stack">
            {items.map((item, index) => {
              const itemId = typeof item.id === 'string' ? item.id : '';
              const quantity = Number(item.quantity ?? 0);
              const progress = fulfillmentProgress(item);
              const shipment = item.fulfillmentType === 'shipment';
              const shippable = Math.max(0, quantity - progress.shipped);
              const deliverable = Math.max(0, progress.shipped - progress.delivered);
              const returnable = Math.max(0, progress.shipped - progress.returned);
              return (
                <div className="platform-course-editor-item" key={itemId || String(index)}>
                  <h3>{t('订单项目', 'Order item')} {index + 1}</h3>
                  <p className="platform-domain-note">{shipment
                    ? t(`共 ${quantity}，已发 ${progress.shipped}，已送达 ${progress.delivered}，已退回 ${progress.returned}`, `${quantity} total, ${progress.shipped} shipped, ${progress.delivered} delivered, ${progress.returned} returned`)
                    : t('数字权益在支付成功后自动发放，无需物流操作。', 'Digital entitlement is granted after successful payment and does not require shipment actions.')}</p>
                  {shipment && canFulfill && shippable > 0 ? <DomainForm definition={definition} resourceId={orderId} busy={busy} runAction={runAction} spec={{ title: text('登记发货', 'Record shipment'), action: 'admin-ship-order-item', payloadBase: { itemId }, fields: shipmentFields(shippable) }} /> : null}
                  {shipment && canFulfill && deliverable > 0 ? <DomainForm definition={definition} resourceId={orderId} busy={busy} runAction={runAction} spec={{ title: text('确认送达', 'Confirm delivery'), action: 'admin-deliver-order-item', payloadBase: { itemId }, fields: shipmentFields(deliverable) }} /> : null}
                  {shipment && canReturn && returnable > 0 ? <DomainForm definition={definition} resourceId={orderId} busy={busy} runAction={runAction} spec={{ title: text('确认退货并入库', 'Confirm return and restock'), action: 'admin-return-order-item', payloadBase: { itemId }, fields: shipmentFields(returnable) }} /> : null}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

export function PlatformAdminActions(props: CommonProps) {
  const { definition, params, entity, busy, runAction, entities } = props;
  const t = useT();
  if (definition.id === 'admin-order') return <PlatformAdminOrderActions {...props} />;
  if (definition.id === 'admin-invites') return <PlatformRedemptionCodeManager {...props} />;
  if (['admin-paths', 'admin-coupons', 'admin-qr-prompts'].includes(definition.id)) {
    return <PlatformAdminCollectionManager {...props} />;
  }
  if (definition.id === 'admin-payouts') return <PlatformPayoutManager {...props} />;
  const form = ADMIN_FORMS[definition.id];
  if (form) {
    if (definition.id === 'admin-qr-detail') {
      if (!entity) return null;
      return (
        <div className="platform-domain-stack">
          <PlatformQrMetadataEditor
            entity={entity}
            resourceId={entity.id}
            busy={busy}
            runAction={(id, payload) => runAction('admin-save', id, payload)}
          />
          <DomainForm definition={definition} busy={busy} runAction={runAction} resourceId={entity.id} spec={{
            title: text('复制二维码', 'Duplicate QR code'),
            action: 'qr-duplicate',
            fields: [field('code', '新编码（留空自动生成）', 'New code (leave blank to generate)', { pattern: '[a-z0-9][a-z0-9_-]{5,79}', minLength: 6, maxLength: 80 })],
          }} />
          <section className="platform-domain-actions">
            <h2>{t('可用状态', 'Availability')}</h2>
            <ActionButton
              action="qr-toggle"
              resourceId={entity.id}
              payload={{ disabled: entity.data?.status !== 'disabled' }}
              label={entity.data?.status === 'disabled' ? text('重新启用', 'Enable') : text('停用', 'Disable')}
              confirm={text('确定更新这个二维码的可用状态吗？', 'Update this QR code availability?')}
              busy={busy}
              runAction={runAction}
            />
          </section>
        </div>
      );
    }
    const editor = <DomainForm definition={definition} entity={entity} resourceId={params.id ?? params.code} busy={busy} runAction={runAction} spec={form} />;
    if (definition.id === 'admin-course') {
      return <div className="platform-domain-stack">{editor}<PlatformCourseContentManager {...props} /></div>;
    }
    if (definition.id === 'admin-teacher') {
      return (
        <div className="platform-domain-stack">
          {editor}
          <ActionButton
            action="admin-delete"
            resourceId={params.id}
            label={text('归档讲师', 'Archive instructor')}
            confirm={text('确定归档这个讲师账号吗？', 'Archive this instructor account?')}
            busy={busy}
            runAction={runAction}
          />
        </div>
      );
    }
    return editor;
  }
  if (definition.id === 'admin-application') {
    return <DomainForm definition={definition} entity={entity} resourceId={params.id} busy={busy} runAction={runAction} spec={{ title: text('审核决定', 'Review decision'), action: 'admin-review', fields: [field('decision', '审核结果', 'Decision', { kind: 'select', options: [option('approved', '通过', 'Approve'), option('rejected', '拒绝', 'Reject')] }), field('note', '审核备注', 'Review note', { kind: 'textarea', rows: 5 })] }} />;
  }
  if (definition.id === 'admin-reconcile') {
    return (
      <div className="platform-domain-stack">
        <DomainForm definition={definition} busy={busy} runAction={runAction} spec={{
          title: text('导入渠道对账单', 'Import provider statement'),
          action: 'admin-reconcile-run',
          fields: [
            field('provider', '支付渠道', 'Payment provider', { kind: 'select', options: [option('wechat', '微信支付', 'WeChat Pay'), option('alipay', '支付宝', 'Alipay')] }),
            field('merchantAccount', '商户账号', 'Merchant account', { required: true, maxLength: 160 }),
            field('statementDate', '账单日期', 'Statement date', { kind: 'date', required: true }),
            field('records', '交易记录 JSON 数组', 'Transaction record JSON array', { kind: 'json', rows: 10, required: true, placeholder: text('[{"providerTransactionId":"…","amountMinor":100,"currency":"CNY"}]', '[{"providerTransactionId":"…","amountMinor":100,"currency":"CNY"}]') }),
          ],
        }} />
        <DomainForm definition={definition} busy={busy} runAction={runAction} spec={{
          title: text('解决对账差异', 'Resolve reconciliation item'),
          action: 'admin-reconcile',
          resourceIdField: 'recordId',
          fields: [field('recordId', '对账记录 ID', 'Reconciliation record ID', { required: true }), field('resolutionNote', '处理说明', 'Resolution note', { kind: 'textarea', rows: 5, required: true, maxLength: 4000 })],
        }} />
      </div>
    );
  }
  void entities;
  return null;
}

export function PlatformQrCertificateActions(props: CommonProps) {
  const t = useT();
  if (props.definition.resource !== 'qr' || !props.params.code) return null;
  const code = encodeURIComponent(props.params.code);
  return (
    <section className="platform-domain-actions">
      <h2>{t('二维码资源', 'QR resources')}</h2>
      <div className="platform-write-actions">
        <a className="platform-button platform-button-primary" href={apiUrl(`/v1/platform/qr/${code}/redirect`)}>{t('打开目标', 'Open target')}</a>
        <a className="platform-button" href={apiUrl(`/v1/platform/qr/${code}/svg`)}>{t('下载 SVG', 'Download SVG')}</a>
        <a className="platform-button" href={apiUrl(`/v1/platform/qr/${code}/card`)}>{t('查看卡片', 'View card')}</a>
      </div>
    </section>
  );
}

interface CommonProps {
  definition: PlatformRouteDefinition;
  params: Record<string, string>;
  entity?: PlatformEntity;
  entities?: PlatformEntity[];
  busy: string | null;
  runAction: RunAction;
}

export function PlatformDomainActions(props: CommonProps) {
  if (props.definition.id === 'account-shipping') return <PlatformShippingAddressManager {...props} />;
  if (props.definition.id === 'account-invites') return <PlatformLearningActions {...props} />;
  if (props.definition.id === 'event-detail') return <PlatformEventActions {...props} />;
  if (props.definition.area === 'learning') return <PlatformLearningActions {...props} />;
  if (props.definition.area === 'commerce') return <PlatformCommerceActions {...props} />;
  if (props.definition.area === 'instructor') return <PlatformInstructorActions {...props} />;
  if (props.definition.area === 'admin') return <PlatformAdminActions {...props} />;
  if (props.definition.resource === 'qr' || props.definition.resource === 'certificate') return <PlatformQrCertificateActions {...props} />;
  return null;
}

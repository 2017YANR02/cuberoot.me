import type { PlatformCourseWrite, PlatformEventWrite, PlatformNewsWrite, PlatformPathWrite, PlatformProductWrite } from '@cuberoot/shared/platform';
import type { PlatformLocaleText } from '@/lib/platform-types';
import { SHOP_CATEGORIES, SHOP_CATEGORY } from '@/lib/shop';
import { type FieldSpec, type DomainFormSpec, type ContractFields } from './PlatformActionTypes';

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
  driveVideo?: string | null;
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

export const text = (zh: string, en: string): PlatformLocaleText => ({ zh, en });

export const option = (value: string, zh: string, en: string) => ({ value, label: text(zh, en) });

export const field = <const Key extends string>(key: Key, zh: string, en: string, input: Omit<FieldSpec<Key>, 'key' | 'label'> = {}): FieldSpec<Key> => {
  const fractional = /(?:AmountMinor|amountMinor|Bps)$/.test(key);
  const structured = ['variants','tickets','venue','items','questions','presentation','eligibility','records'].includes(key);
  const markdown = key === 'bodyZh' || key === 'bodyEn';
  const label = text(zh.replace('（分）','（元）').replace('（万分制）','（%）').replace(' JSON 数组','').replace(' JSON',''),en.replace('(minor units)','(major units)').replace('(basis points)','(%)').replace(' JSON array','').replace(' JSON',''));
  return {key,label,...input,...(structured?{kind:'structured' as const}:markdown?{kind:'markdown' as const}:{}),...(fractional?{kind:'money' as const,min:input.min==null?undefined:input.min/100,max:input.max==null?undefined:input.max/100,step:0.01,defaultValue:input.defaultValue==null?undefined:Number(input.defaultValue)/100}:{})};
};

const COURSE_FIELDS = [
  field('presentation', '课程介绍与大纲', 'Course presentation and outline', { kind: 'structured' }),
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

export const INSTRUCTOR_COURSE_FIELDS = COURSE_FIELDS;

const EVENT_FIELDS = [
  field('slug', 'Slug', 'Slug', { required: true, pattern: '[a-z0-9][a-z0-9_-]{0,119}', maxLength: 120 }),
  field('titleZh', '中文标题', 'Chinese title', { required: true, maxLength: 240 }),
  field('titleEn', '英文标题', 'English title', { required: true, maxLength: 240 }),
  field('descriptionZh', '中文说明', 'Chinese description', { kind: 'textarea', rows: 5 }),
  field('descriptionEn', '英文说明', 'English description', { kind: 'textarea', rows: 5 }),
  field('status', '状态', 'Status', { kind: 'select', options: [option('draft', '草稿', 'Draft'), option('published', '已发布', 'Published'), option('cancelled', '已取消', 'Cancelled'), option('completed', '已结束', 'Completed'), option('archived', '已归档', 'Archived')] }),
  field('startsAt', '开始时间', 'Starts at', { kind: 'datetime-local', required: true }),
  field('endsAt', '结束时间', 'Ends at', { kind: 'datetime-local', required: true }),
  field('category', '活动分类', 'Event category'),
  field('program', '活动项目（每行一项）', 'Program (one per line)', { kind: 'lines' }),
  field('timezone', '时区', 'Timezone', { required: true, defaultValue: 'Asia/Shanghai' }),
  field('venue', '场地 JSON', 'Venue JSON', { kind: 'json', rows: 5, required: true }),
  field('tickets', '票种 JSON 数组', 'Ticket JSON array', { kind: 'json', rows: 8, required: true }),
] satisfies ContractFields<PlatformEventWrite>;

const NEWS_FIELDS = [
  field('category', '资讯分类', 'Category'),
  field('excerptZh', '中文摘要', 'Chinese summary', { kind: 'textarea', rows: 3 }),
  field('excerptEn', '英文摘要', 'English summary', { kind: 'textarea', rows: 3 }),
  field('slug', 'Slug', 'Slug', { required: true, pattern: '[a-z0-9][a-z0-9_-]{0,159}', maxLength: 160 }),
  field('titleZh', '中文标题', 'Chinese title', { required: true, maxLength: 240 }),
  field('titleEn', '英文标题', 'English title', { required: true, maxLength: 240 }),
  field('bodyZh', '中文正文 JSON', 'Chinese body JSON', { kind: 'json', rows: 10, required: true }),
  field('bodyEn', '英文正文 JSON', 'English body JSON', { kind: 'json', rows: 10, required: true }),
  field('status', '状态', 'Status', { kind: 'select', options: [option('draft', '草稿', 'Draft'), option('published', '已发布', 'Published'), option('archived', '已归档', 'Archived')] }),
] satisfies ContractFields<PlatformNewsWrite>;

const PRODUCT_FIELDS = [
  field('category', '商品分类', 'Category', { kind: 'select', defaultValue: SHOP_CATEGORY, options: SHOP_CATEGORIES.map(category => option(category.id, category.zh, category.en)) }),
  field('memberOnly', '仅限会员购买', 'Members only', { kind: 'boolean' }),
  field('presentation', '商品介绍', 'Product presentation', { kind: 'structured' }),
  field('slug', 'Slug', 'Slug', { required: true, pattern: '[a-z0-9][a-z0-9_-]{0,119}', maxLength: 120 }),
  field('productType', '商品类型', 'Product type', { kind: 'select', options: [option('physical', '实物', 'Physical'), option('digital', '数字内容', 'Digital')] }),
  field('titleZh', '中文标题', 'Chinese title', { required: true, maxLength: 240 }),
  field('titleEn', '英文标题', 'English title', { required: true, maxLength: 240 }),
  field('descriptionZh', '中文说明', 'Chinese description', { kind: 'textarea', rows: 6 }),
  field('descriptionEn', '英文说明', 'English description', { kind: 'textarea', rows: 6 }),
  field('status', '状态', 'Status', { kind: 'select', options: [option('draft', '草稿', 'Draft'), option('active', '销售中', 'Active'), option('archived', '已归档', 'Archived')] }),
  field('variants', '规格、价格与库存', 'Variants, prices & stock', { kind: 'structured', defaultValue: '[]' }),
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

export const INSTRUCTOR_APPLICATION_FIELDS = [
  field('experience', '教学经历', 'Teaching experience', { kind: 'textarea', rows: 7, required: true, maxLength: 20000 }),
  field('specialties', '擅长方向（每行一项）', 'Specialties (one per line)', { kind: 'lines', required: true }),
  field('contact', '联系方式', 'Contact details', { kind: 'textarea', rows: 3, required: true, maxLength: 500 }),
] satisfies ContractFields<PlatformInstructorApplicationPayload>;

export const LESSON_FIELDS = [
  field('slug', '课时 Slug', 'Lesson slug', { required: true, pattern: '[a-z0-9][a-z0-9_-]{0,119}', maxLength: 120 }),
  field('ordinal', '顺序', 'Order', { kind: 'number', min: 0, max: 1000000, step: 1, required: true }),
  field('titleZh', '中文标题', 'Chinese title', { required: true, maxLength: 240 }),
  field('titleEn', '英文标题', 'English title', { required: true, maxLength: 240 }),
  field('bodyZh', '中文课时内容 JSON', 'Chinese lesson content JSON', { kind: 'json', rows: 9, required: true, defaultValue: '{}' }),
  field('bodyEn', '英文课时内容 JSON', 'English lesson content JSON', { kind: 'json', rows: 9, required: true, defaultValue: '{}' }),
  field('driveVideo', '网盘视频（文件 ID 或预览网址）', 'Drive video (file ID or preview URL)', { maxLength: 2048, placeholder: text('在网盘打开视频预览后，复制地址栏网址', 'Open the video preview in Drive, then copy the address-bar URL') }),
  field('durationSeconds', '时长（秒）', 'Duration (seconds)', { kind: 'number', min: 0, max: 86400, step: 1 }),
  field('status', '状态', 'Status', { kind: 'select', defaultValue: 'draft', options: [option('draft', '草稿', 'Draft'), option('published', '已发布', 'Published'), option('archived', '已归档', 'Archived')] }),
  field('accessScope', '访问范围', 'Access scope', { kind: 'select', defaultValue: 'entitled', options: [option('public', '公开', 'Public'), option('entitled', '需课程权益', 'Entitled learners')] }),
] satisfies ContractFields<PlatformLessonPayload>;

export const QUIZ_FIELDS = [
  field('slug', '测验 Slug', 'Quiz slug', { required: true, pattern: '[a-z0-9][a-z0-9_-]{0,119}', maxLength: 120 }),
  field('titleZh', '中文标题', 'Chinese title', { required: true, maxLength: 240 }),
  field('titleEn', '英文标题', 'English title', { required: true, maxLength: 240 }),
  field('passingScoreBps', '及格分（万分制）', 'Passing score (basis points)', { kind: 'number', min: 0, max: 10000, step: 1, required: true, defaultValue: 6000 }),
  field('maxAttempts', '最多尝试次数', 'Maximum attempts', { kind: 'number', min: 1, max: 1000000, step: 1 }),
  field('status', '状态', 'Status', { kind: 'select', defaultValue: 'draft', options: [option('draft', '草稿', 'Draft'), option('published', '已发布', 'Published'), option('archived', '已归档', 'Archived')] }),
  field('questions', '题目 JSON 数组', 'Question JSON array', { kind: 'json', rows: 12, required: true, defaultValue: '[]' }),
] satisfies ContractFields<PlatformQuizPayload>;

export const SHIPPING_ADDRESS_FIELDS = [
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

export const LESSON_EDIT_FIELDS = LESSON_FIELDS.filter((item) => !['bodyZh', 'bodyEn', 'durationSeconds'].includes(item.key));

export const ADMIN_FORMS: Readonly<Record<string, DomainFormSpec>> = {
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

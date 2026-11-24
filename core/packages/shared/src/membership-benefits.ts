/** Public presentation content only; never used to grant paid access or quotas. */
export type MembershipBenefitGroup = 'common' | 'enterprise' | 'plan';
export interface MembershipBenefit {
  id: string;
  zh: string;
  en: string;
  group: MembershipBenefitGroup;
  enabled: boolean;
}
export interface MembershipBenefits {
  revision: number;
  items: MembershipBenefit[];
}
/** Bootstrap/offline fallback, matching the curated purchase-page copy. Published edits live in PG. */
export const DEFAULT_MEMBERSHIP_BENEFITS: MembershipBenefit[] = [
  {
    "en": "Unlimited cloud-based 3×3 optimal solves",
    "id": "unlimited_333_cloud_optimal",
    "zh": "不限次数使用三阶云端最少步求解",
    "group": "common",
    "enabled": true
  },
  {
    "en": "Get 10 expert solve reconstructions per month",
    "id": "expert_recon_10_monthly",
    "zh": "每月获取 10 把高手解法复盘",
    "group": "common",
    "enabled": true
  },
  {
    "en": "Display a Pro badge and opt in to the supporters list",
    "id": "badge",
    "zh": "展示 Pro 徽章，可在致谢名单署名",
    "group": "common",
    "enabled": true
  },
  {
    "en": "Request a follow from CubeRoot on social media",
    "id": "platform_follow",
    "zh": "可联系魔方根关注你的社交账号",
    "group": "common",
    "enabled": true
  },
  {
    "en": "Join the CubeRoot member group and share QR codes there",
    "id": "vip_group",
    "zh": "加入魔方根会员群，可在群内分享二维码",
    "group": "common",
    "enabled": true
  },
  {
    "en": "Pay once, valid forever",
    "id": "lifetime",
    "zh": "一次付费,永久有效",
    "group": "plan",
    "enabled": true
  },
  {
    "en": "Show teacher–student links on profiles and teachers in rankings",
    "id": "teacher_student_profile_ranking",
    "zh": "在个人主页展示师生关系，在排名页展示老师",
    "group": "enterprise",
    "enabled": true
  },
  {
    "en": "Publish a business profile",
    "id": "enterprise_profile",
    "zh": "展示企业介绍页",
    "group": "enterprise",
    "enabled": true
  },
  {
    "en": "Store teaching materials and videos, and request a custom course plan",
    "id": "enterprise_content_storage_custom_course",
    "zh": "存储教学图文和视频，可联系定制企业课程方案",
    "group": "enterprise",
    "enabled": true
  },
  {
    "en": "Use your own logo in the simulator",
    "id": "custom_sim_logo",
    "zh": "在模拟器中使用自己的 Logo",
    "group": "common",
    "enabled": true
  },
  {
    "en": "Submit 2 solve videos per month for personal review: 3×3, 2×2, Square-1, Pyraminx or Skewb",
    "id": "personal_video_review_2_monthly",
    "zh": "每月提交 2 把个人视频供人工复盘，支持三阶、二阶、SQ1、金字塔和斜转",
    "group": "common",
    "enabled": true
  },
  {
    "en": "Upload solve videos and gallery photos, and upload, manage and download music",
    "id": "custom_ed32bcc401a04b218e21d18cdd564a83",
    "zh": "上传复盘视频和图库照片，上传、管理和下载音乐",
    "group": "common",
    "enabled": true
  },
  {
    "en": "Republish site content on your website or platform",
    "id": "custom_9e2c10c0b8194dd39ef8b854ecffab50",
    "zh": "可在自己的网站或平台转载本站内容",
    "group": "common",
    "enabled": true
  }
];

export function benefitCopy(item: MembershipBenefit): { zh: string; en: string } {
  return { zh: item.zh, en: item.en.trim() || item.zh };
}

export function validateMembershipBenefits(value: unknown): MembershipBenefit[] | null {
  if (!Array.isArray(value) || value.length > 100) return null;
  const ids = new Set<string>();
  const items: MembershipBenefit[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') return null;
    const { id, zh, en, group, enabled } = entry;
    if (typeof id !== 'string' || !/^[a-z][a-z0-9_]{0,79}$/.test(id) || ids.has(id)
      || typeof zh !== 'string' || !zh.trim() || zh.length > 1000
      || typeof en !== 'string' || en.length > 2000
      || !['common', 'enterprise', 'plan'].includes(group) || typeof enabled !== 'boolean') return null;
    ids.add(id);
    items.push({ id, zh: zh.trim(), en: en.trim(), group, enabled });
  }
  return items;
}

/** A changed Chinese source invalidates an unchanged English translation. */
export function invalidateBenefitTranslations(items: MembershipBenefit[], previous: MembershipBenefit[]): MembershipBenefit[] {
  const old = new Map(previous.map(item => [item.id, item]));
  return items.map(item => {
    const before = old.get(item.id);
    return before && before.zh !== item.zh && before.en === item.en ? { ...item, en: '' } : item;
  });
}

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
/** Bootstrap/offline fallback, matching migration 0257. Published edits live in PG. */
export const DEFAULT_MEMBERSHIP_BENEFITS: MembershipBenefit[] = [
  {
    "id": "unlimited_333_cloud_optimal",
    "zh": "不限量三阶魔方云端最少步快速求解",
    "en": "Unlimited cloud-based 3×3 optimal solving",
    "group": "common",
    "enabled": true
  },
  {
    "id": "expert_recon_10_monthly",
    "zh": "获取高手的解法复盘（每月 10 把）",
    "en": "Expert solve reconstructions (10 per month)",
    "group": "common",
    "enabled": true
  },
  {
    "id": "badge",
    "zh": "专属会员徽章",
    "en": "Exclusive member badge",
    "group": "common",
    "enabled": true
  },
  {
    "id": "early",
    "zh": "新功能抢先体验",
    "en": "Early access to new features",
    "group": "common",
    "enabled": true
  },
  {
    "id": "thanks",
    "zh": "致谢名单署名",
    "en": "Listed in the acknowledgments",
    "group": "common",
    "enabled": true
  },
  {
    "id": "platform_follow",
    "zh": "获得魔方根在各平台的关注",
    "en": "Get followed by CubeRoot across platforms",
    "group": "common",
    "enabled": true
  },
  {
    "id": "vip_group",
    "zh": "进入魔方根 VIP 群",
    "en": "Join the CubeRoot VIP group",
    "group": "common",
    "enabled": true
  },
  {
    "id": "group_qr_sharing",
    "zh": "允许在魔方根群分享二维码",
    "en": "Share QR codes in CubeRoot groups",
    "group": "common",
    "enabled": true
  },
  {
    "id": "custom_sim_logo",
    "zh": "在魔方模拟器中使用自定义 logo",
    "en": "Use a custom logo in the cube simulator",
    "group": "common",
    "enabled": true
  },
  {
    "id": "personal_video_review_2_monthly",
    "zh": "每月可发送 2 把视频给我进行复盘（仅限三阶、二阶、SQ1、金字塔和斜转）",
    "en": "Send me up to 2 solve videos per month for review (3×3, 2×2, SQ1, Pyraminx, and Skewb only)",
    "group": "common",
    "enabled": true
  },
  {
    "id": "lifetime",
    "zh": "一次付费,永久有效",
    "en": "Pay once, valid forever",
    "group": "plan",
    "enabled": true
  },
  {
    "id": "teacher_student_profile_ranking",
    "zh": "老师主页展示学生，学生主页展示老师，排名页展示老师",
    "en": "Show students on teacher profiles, teachers on student profiles, and teachers in rankings",
    "group": "enterprise",
    "enabled": true
  },
  {
    "id": "enterprise_profile",
    "zh": "企业专属介绍页面",
    "en": "Dedicated enterprise profile page",
    "group": "enterprise",
    "enabled": true
  },
  {
    "id": "enterprise_content_storage_custom_course",
    "zh": "教程、图文资料和视频等云端存储，以及企业课程方案定制",
    "en": "Cloud storage for tutorials, articles, images, and videos, plus customized enterprise course plans",
    "group": "enterprise",
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

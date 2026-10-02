import type { LocalizedText } from '@/lib/infrastructure-costs';

// Short visual labels explain the full chapters; the complete copy stays in
// bp-content.ts and remains available in the expandable reading view and print.
export const CHAPTER_VISUALS: Record<string, {
  style: 'audience' | 'flow' | 'timeline' | 'system' | 'metrics' | 'finance' | 'risks';
  captions: LocalizedText[];
  tags: LocalizedText[];
}> = {
  'bp-customers': {
    style: 'audience',
    captions: [
      { zh: '日常训练，专业进阶', en: 'Daily practice, specialist progress' },
      { zh: '课程、资料与教学管理', en: 'Courses, resources and teaching' },
      { zh: '看懂练习，看见反馈', en: 'Understand practice and feedback' },
      { zh: '中英双语，逐步拓展', en: 'Bilingual, progressive expansion' },
    ],
    tags: [{ zh: '个人订阅', en: 'Individual' }, { zh: '企业订阅', en: 'Enterprise' }, { zh: '服务使用者', en: 'Learners' }, { zh: '长期方向', en: 'Long term' }],
  },
  'bp-growth': {
    style: 'flow',
    captions: [
      { zh: '专题内容 → 真实练习', en: 'Focused content → real practice' },
      { zh: '顺利上手 → 反复使用', en: 'Easy onboarding → repeat use' },
      { zh: '专业帮助 → 订阅续费', en: 'Specialist help → renewal' },
      { zh: '教学示范 → 机构服务', en: 'Teaching demos → educator services' },
    ],
    tags: [{ zh: '触达', en: 'Discover' }, { zh: '激活', en: 'Practise' }, { zh: '续费', en: 'Renew' }, { zh: '拓展', en: 'Extend' }],
  },
  'bp-roadmap': {
    style: 'timeline',
    captions: [
      { zh: '可靠工具 · 清楚权益 · 审核上线', en: 'Reliable tools · benefits · launch' },
      { zh: '会员运营 · 专业内容 · 机构交付', en: 'Membership · content · educator delivery' },
      { zh: '续费模型 · 服务标准 · 成本核算', en: 'Renewal · standards · cost accounting' },
      { zh: '双语内容 · 多端体验 · 合作网络', en: 'Bilingual content · platforms · partnerships' },
    ],
    tags: [{ zh: '首个季度', en: 'First quarter' }, { zh: '后续季度', en: 'Next quarters' }, { zh: '一年内', en: 'Within a year' }, { zh: '长期', en: 'Long term' }],
  },
  'bp-operations': {
    style: 'system',
    captions: [
      { zh: '原创研究 + 专业整合', en: 'Original work + specialist integration' },
      { zh: 'AI 辅助 + 质量负责', en: 'AI assistance + accountable quality' },
      { zh: '排期管理 + 服务标准', en: 'Scheduling + service standards' },
      { zh: '访问权限 + 稳定维护', en: 'Access control + reliable maintenance' },
    ],
    tags: [{ zh: '技术', en: 'Technology' }, { zh: '研发', en: 'Development' }, { zh: '交付', en: 'Delivery' }, { zh: '保障', en: 'Reliability' }],
  },
  'bp-metrics': {
    style: 'metrics',
    captions: [
      { zh: '练习天数 · 复练 · 核心功能', en: 'Practice days · repeat use · core tasks' },
      { zh: '权益使用 · 服务完成 · 续费', en: 'Benefits used · delivery · renewal' },
      { zh: '老师与学员 · 教学流程 · 续约', en: 'Teachers & learners · workflow · renewal' },
      { zh: '实际回款 · 直接成本 · 单位贡献', en: 'Receipts · direct costs · contribution' },
    ],
    tags: [{ zh: '使用', en: 'Usage' }, { zh: '会员', en: 'Members' }, { zh: '企业', en: 'Enterprise' }, { zh: '经营', en: 'Operations' }],
  },
  'bp-financial': {
    style: 'finance',
    captions: [
      { zh: '个人会员 × 订阅周期', en: 'Individual members × subscription period' },
      { zh: '企业订阅 + 明确范围的服务', en: 'Enterprise subscriptions + scoped services' },
      { zh: '收入 − 直接成本 = 单位贡献', en: 'Revenue − direct costs = contribution' },
      { zh: '保守维持 → 稳定经营 → 扩展投入', en: 'Maintain → stabilise → expand' },
    ],
    tags: [{ zh: '收入来源 01', en: 'Revenue 01' }, { zh: '收入来源 02', en: 'Revenue 02' }, { zh: '单位经济', en: 'Unit economics' }, { zh: '经营情景', en: 'Scenarios' }],
  },
  'bp-risks': {
    style: 'risks',
    captions: [
      { zh: '持续改善体验与专业服务', en: 'Improve experience and specialist delivery' },
      { zh: '分渠道看练习、购买与续费', en: 'Measure practice, purchase and renewal' },
      { zh: '排期、质量与协作匹配容量', en: 'Match scheduling, quality and capacity' },
      { zh: '监控计算、存储与交付成本', en: 'Monitor compute, storage and delivery' },
      { zh: '授权、导出、恢复与来源管理', en: 'Consent, export, recovery and attribution' },
      { zh: '推广节奏与实际开放能力对齐', en: 'Align promotion with launch readiness' },
    ],
    tags: [{ zh: '竞争', en: 'Competition' }, { zh: '转化', en: 'Conversion' }, { zh: '容量', en: 'Capacity' }, { zh: '成本', en: 'Costs' }, { zh: '信任', en: 'Trust' }, { zh: '上线', en: 'Launch' }],
  },
};

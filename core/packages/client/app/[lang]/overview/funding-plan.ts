// Proposed 12-month allocations, not historical spending or vendor quotes.
// Amounts in CNY; totals are derived from these rows.
export const FUNDING_ALLOCATIONS = [
  { name: { zh: '产品开发与维护', en: 'Development & maintenance' }, purpose: { zh: '创始人开发劳动报酬、必要协作与核心工具交付', en: 'Founder development compensation, targeted collaboration and core delivery' }, amounts: [120000, 210000, 300000] },
  { name: { zh: 'AI、服务器与发布', en: 'AI, hosting & distribution' }, purpose: { zh: '现有固定服务、用量增长与数据计算', en: 'Recurring services, usage growth and data computation' }, amounts: [25000, 35000, 50000] },
  { name: { zh: '教学与内容制作', en: 'Teaching & content' }, purpose: { zh: '课程整理、视频制作、翻译与内容更新', en: 'Course editing, video production, translation and updates' }, amounts: [25000, 45000, 65000] },
  { name: { zh: '用户与机构试点', en: 'User & organisation pilots' }, purpose: { zh: '招募、访谈、教学试用与合作交付', en: 'Recruitment, interviews, teaching pilots and partner delivery' }, amounts: [15000, 35000, 50000] },
  { name: { zh: '机动与风险储备', en: 'Contingency reserve' }, purpose: { zh: '故障恢复、支出波动与必要设备维修', en: 'Recovery, cost fluctuations and essential equipment repairs' }, amounts: [15000, 25000, 35000] },
] as const;

export const FUNDING_SCENARIOS = [
  { title: { zh: '基础推进', en: 'Focused delivery' }, body: { zh: '集中保障核心工具、创始人持续开发和一轮用户试点。', en: 'Focus on core tools, sustained founder development and an initial user pilot.' } },
  { title: { zh: '协作加速', en: 'Targeted collaboration' }, body: { zh: '增加开发与内容协作，扩大机构试点和付费服务验证。', en: 'Add development and content support; broaden teaching pilots and paid-service validation.' } },
  { title: { zh: '扩大验证', en: 'Broader validation' }, body: { zh: '并行推进多端体验、教学内容和品牌合作，仍按阶段验收。', en: 'Validate cross-platform use, teaching content and brand partnerships in parallel, with staged reviews.' } },
].map((scenario, index) => ({ ...scenario, amount: FUNDING_ALLOCATIONS.reduce((sum, row) => sum + row.amounts[index], 0) }));

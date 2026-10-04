import { EVENT_GROSS_PER_MONTH } from './bp-data';
import type { LocalizedText } from '@/lib/infrastructure-costs';

export type BpSection = {
  id: string;
  number: string;
  label: LocalizedText;
  title: LocalizedText;
  intro: LocalizedText;
  cards: { title: LocalizedText; body: LocalizedText; reference?: { href: string; label: LocalizedText } }[];
  conclusion?: LocalizedText;
};

// Strategic proposals are deliberately separate from existing membership rights.
// Industry forecasts and founder planning assumptions are labelled explicitly.
export const BUSINESS_SECTIONS: BpSection[] = [
  {
    id: 'bp-customers', number: '07',
    label: { zh: '客户与市场切入', en: 'Customers & market entry' },
    title: { zh: '先服务练习者，再连接教学机构。', en: 'Start with practitioners. Connect educators.' },
    intro: { zh: '优先进入自己最了解、能够直接接触的速拧与进阶训练人群，再把相同的训练能力延伸到老师、工作室和培训机构。个人市场与机构市场共用专业工具，但购买理由和交付方式分别设计。', en: 'Start with speedcubers and improving practitioners the founder understands and can reach, then extend the same training capabilities to teachers, studios and schools. Individuals and organisations share tools but need different purchase reasons and delivery models.' },
    cards: [
      { reference: { href: '/timer', label: { zh: '体验日常计时与训练', en: 'Try timing and practice' } }, title: { zh: '持续练习的个人选手', en: 'Regular individual practitioners' }, body: { zh: '他们反复计时、练习公式、分析解法，并关注成绩稳定性与效率。免费工具形成日常使用入口；会员提供更深入的求解、复盘与支持服务。重点经营经常训练且愿意为专业帮助付费的人群，按实际功能使用和续费衡量价值。', en: 'These users repeatedly time solves, train algorithms and analyse execution. Free tools support daily use; membership adds deeper solving, reconstruction and support. Focus on regular practitioners who value specialist help, measuring feature use and renewal.' } },
      { reference: { href: '/membership#enterprise-plans-title', label: { zh: '查看现有企业权益', en: 'View current enterprise benefits' } }, title: { zh: '老师、工作室与培训机构', en: 'Teachers, studios & schools' }, body: { zh: '他们需要展示教学能力、组织资料、制定课程，并让学生的课后训练与教学反馈连接起来。企业会员先提供公开展示、师生关系、资料存储和课程方案服务；更深入的任务、反馈与管理系统按实际教学流程完善。', en: 'Educators need professional visibility, organised resources, course plans and links between practice and feedback. Enterprise membership starts with profiles, teacher–student visibility, storage and course planning. Assignment and management workflows develop around real teaching needs.' } },
      { reference: { href: '/courses', label: { zh: '查看课程内容', en: 'Explore course content' } }, title: { zh: '学员与家长', en: 'Learners & parents' }, body: { zh: '在个人场景中，家长可能是付款者；在机构场景中，学员与家长是服务使用者。产品应帮助他们理解学了什么、练了什么、下一步怎么做。报告以真实训练记录和老师反馈为基础，不能保证比赛名次或成绩提升。', en: 'Parents may pay for individual services; learners and parents also use services funded by schools. Explain what was learned, practised and planned next, using real records and teacher feedback rather than guaranteeing results or rankings.' } },
      { title: { zh: '可逐步拓展的全球用户', en: 'A progressively wider audience' }, body: { zh: '魔方有共同的动作记号与跨地区赛事体系，中英双语工具具备向海外拓展的基础。先把现有用户的核心任务做好，再依据自然访问、服务成本和本地支持能力决定地区优先级，不把全球爱好者直接视作可获得客户。', en: 'Shared notation and international competition support bilingual expansion. First solve existing users’ core tasks; use organic interest, delivery costs and support capacity to prioritise regions. The global hobby population is not automatically an addressable customer base.' } },
    ],
    conclusion: { zh: '市场规模采用自下而上的经营模型：能够实际触达的训练用户、愿意购买的会员、能够交付和续约的机构。付费人数与机构数量逐步积累，不用比赛人数或粉丝数直接推算收入。', en: 'Size the opportunity from the bottom up: reachable practitioners, paying members and organisations the business can serve and renew. Build these counts through operations rather than extrapolating revenue from followers or event attendance.' },
  },
  {
    id: 'bp-growth', number: '08',
    label: { zh: '获客、转化与续费', en: 'Acquisition, conversion & renewal' },
    title: { zh: '内容带来触达，训练带来反复使用。', en: 'Content creates discovery. Practice creates repeat use.' },
    intro: { zh: '约 50 万平台合计关注，以及创始人运营的约 500 人魔方老师群，使项目具备个人与机构两类触达渠道。现阶段已有人经创始人介绍使用计时器和网站，下一步重点是扩大推广、改善使用路径，并把已有使用转化为持续会员关系。不同平台的关注合计按本人确认口径，不作为活跃客户数。', en: 'Approximately 500,000 aggregate follows and a founder-led group of about 500 cubing teachers provide individual and institutional distribution channels. People introduced by the founder already use the timer and site. The next step is broader promotion, better onboarding and membership conversion. Owner-confirmed aggregate follows are not active customer counts.' },
    cards: [
      { title: { zh: '以具体训练问题组织内容', en: 'Content built around practice tasks' }, body: { zh: '教程、短视频与直播直接展示一个问题及其练法，例如公式熟练度、成绩波动或解法选择。内容中的入口链接到对应训练工具，让用户当场完成练习。按来源记录到访和练习完成情况，逐步判断哪些内容带来长期用户。', en: 'Lessons, videos and livestreams explain a specific task such as algorithm fluency, consistency or solution choice. Link directly to the matching tool and measure source visits and completed practice to identify content that brings lasting users.' } },
      { title: { zh: '让首次使用顺利进入日常训练', en: 'Make first use lead to a routine' }, body: { zh: '优先保证计时、公式训练、记录与复盘的使用稳定性。减少重复输入与入口寻找，让同一个账号持续积累记录，在需要专业帮助时清楚看到会员价值。保留数据导出与透明权益说明，依靠体验争取长期选择。', en: 'Prioritise reliable timing, algorithm practice, records and reconstruction. Reduce repeated input and navigation, preserve a coherent history and make premium help understandable. Keep export and entitlement transparency so users stay for the experience.' } },
      { title: { zh: '在真实需要出现时解释付费价值', en: 'Explain paid value when a need arises' }, body: { zh: '云端求解、高手解法复盘和个人视频反馈与具体训练需求对应。用户应能看懂免费范围、会员服务、交付节奏与额度。先确认服务被实际使用，再比较不同内容渠道带来的购买与续费，减少只靠短期促销的增长。', en: 'Cloud solving, expert reconstructions and personal review address concrete practice needs. Make free access, premium services, cadence and allowances clear. Measure delivery and renewal by acquisition source rather than relying on short-term promotions.' } },
      { title: { zh: '机构通过示范、试用与复用进入', en: 'Bring educators in through practical demonstrations' }, body: { zh: '通过已有教师社群与正在洽谈的机构联系，用企业介绍页、师生展示和课程资料说明现有价值，再围绕实际课程安排组织试用。记录老师配置所需时间、学员使用情况与服务工作量。将反复出现的需求沉淀为标准服务，避免每家客户都变成无法复制的定制项目。', en: 'Reach educators through the existing teacher community and ongoing institutional discussions. Demonstrate profiles, teacher–student visibility and resources, then pilot around actual courses. Track teacher setup time, learner use and delivery effort. Standardise repeated needs instead of turning every client into an unrepeatable custom project.' } },
    ],
    conclusion: { zh: '获客路径：内容与推荐 → 使用计时器或训练器 → 留下练习记录 → 使用专业会员服务 → 持续训练与续费 → 用户反馈改善内容和产品。每一步都能分别观察，逐步提高整条路径的效率。', en: 'The path is content and referral → timing or training → practice records → specialist membership → continued use and renewal → feedback improving content and tools. Measure each step separately to improve the whole path.' },
  },
  {
    id: 'bp-roadmap', number: '09',
    label: { zh: '短期、中期与长期规划', en: 'Near, medium & long-term roadmap' },
    title: { zh: '从现有产品出发，逐步扩大经营能力。', en: 'Build operating capability from the existing product.' },
    intro: { zh: '近期把已有计时、训练和会员服务打磨成可靠的日常产品；中期形成个人订阅与机构服务的经营闭环；长期将内容、工具、教学与赛事连接为面向全球的魔方平台。课程持续推进；线上赛事按每月 4 场的目标准备，商城暂列后续待办。', en: 'Near term: reliable daily tools and membership delivery. Medium term: working individual and educator subscription operations. Long term: a global platform linking content, tools, teaching and events. Course work continues; prepare for a target of four online events per month. Commerce stays on the later backlog.' },
    cards: [
      { title: { zh: '首个季度：稳定产品与明确会员交付', en: 'First quarter: reliability & clear service delivery' }, body: { zh: '围绕现有用户整理计时器和训练器最常用的路径，解决影响持续练习的问题；公开清楚的会员权益、使用方式与交付规则；组织已有渠道的集中推广，建立来源、复练、会员使用与服务成本报表。通过已有教师社群开展机构需求沟通与试用，并准备线上赛事规则、普通与智能魔方成绩审核和首场报名。', en: 'Improve common timing and training paths for existing users; fix obstacles to continued practice. Clarify member entitlements, access and delivery. Run focused promotion through existing channels and report sources, repeat practice, premium use and costs. Use the existing teacher community for educator discussions and trials, and prepare online-event rules, conventional and smart-cube result review, and first-event registration.' } },
      { title: { zh: '后续两个季度：续费与机构服务', en: 'Following quarters: renewal & educator delivery' }, body: { zh: '持续推进课程、复盘资源和进阶训练内容，形成会员反馈和续费运营；线上赛事根据每场报名、完成率、争议与成本逐步形成固定节奏；完善企业页面、资料组织与课程方案交付；将老师任务、学生练习和反馈连接到现有工具。依据使用效果决定开发顺序，避免同时铺开所有端和所有机构功能。', en: 'Maintain courses, reconstructions, member feedback and renewal operations. Establish an online-event cadence based on entries, completion, disputes and costs per event. Improve profiles, resources and course-plan delivery. Connect teacher tasks, learner practice and feedback to existing tools. Prioritise demonstrated value rather than launching every platform and workflow at once.' } },
      { title: { zh: '一年内：形成可以复核的经营模型', en: 'Within a year: an inspectable operating model' }, body: { zh: '分别报告个人订阅的新增、续费、服务使用与贡献情况，以及机构客户的上线、持续使用、续约与交付成本。课程按实际交付核算，线上赛事按实际报名与成本核算；商城是否启动留待后续评估。把有效的内容推广方式和机构服务流程标准化；持续优化多端体验，以真实收入和支出判断是否扩大投入。', en: 'Report individual acquisition, renewal, service use and contribution; track institutional onboarding, use, renewal and delivery costs. Account for course delivery and actual event entries and costs separately; assess commerce later. Standardise effective promotion and educator workflows. Improve cross-platform access and use actual revenue and costs to decide expansion.' } },
      { title: { zh: '长期：面向全球的魔方平台', en: 'Long term: a global cubing platform' }, body: { zh: '长期愿景是成为全球最大的魔方网站，并以持续使用、专业内容和可持续经营推进这一目标。逐步扩展中英双语资源、合作老师和机构网络，使学习、训练、复盘、教学与赛事信息在同一平台协同。规模扩张以产品稳定性、服务能力与现金流为前提。', en: 'The long-term ambition is to become the largest global cubing website through lasting use, specialist content and sustainable operations. Expand bilingual resources and educator partnerships so learning, practice, analysis, teaching and events work together. Scale only with reliability, delivery capacity and cash flow.' } },
    ],
  },
  {
    id: 'bp-operations', number: '10',
    label: { zh: '技术、团队与服务交付', en: 'Technology, team & delivery' },
    title: { zh: '把专业积累变成稳定、可交付的服务。', en: 'Turn specialist work into reliable delivery.' },
    intro: { zh: '创始人牵头连接产品开发、专业内容与用户沟通。现有网站和技术积累提供基础；下一阶段按实际任务引入开发、内容和服务协作，让每项会员权益都有明确责任人与交付流程。', en: 'Founder-led work connects development, specialist content and users. Existing tools provide the foundation. Add development, editorial and service collaborators according to real tasks, with an owner and workflow for each member entitlement.' },
    cards: [
      { reference: { href: '/achievements', label: { zh: '查看原创成果与工具', en: 'Inspect original work and tools' } }, title: { zh: '自有能力与开放资源各有边界', en: 'Clear boundaries for original and open resources' }, body: { zh: '原创求解、训练交互、复盘与数据产品持续积累；公开 WCA 数据和开源工具保留来源与授权边界。竞争优势来自专业整合和持续交付，不能把公开数据或通用 AI 当作独占资产。', en: 'Continue original solving, training interaction, reconstruction and data work. Credit public WCA data and open-source tools and respect their licences. Defensibility comes from specialist integration and delivery, not claiming public data or general AI as exclusive assets.' } },
      { reference: { href: '/dev/infrastructure#infra-expenses-title', label: { zh: '查看开发工具与运行支出', en: 'View tooling and operating expenses' } }, title: { zh: 'AI 提高研发效率，质量仍由产品负责', en: 'AI helps development; quality stays accountable' }, body: { zh: 'Codex 用于开发与维护，已有计算设备用于求解、统计和多端测试。代码生成不能代替算法正确性、真实任务验证和线上维护。用户侧的分析服务按功能成熟度推进，并核算调用成本与实际帮助，避免把开发工具使用直接等同于用户产品壁垒。', en: 'Codex assists development; existing computers support solving, statistics and platform testing. Generated code does not replace correctness checks, real-task validation or maintenance. User-facing analysis develops according to maturity, usefulness and unit costs.' } },
      { reference: { href: '/membership#universal-perks-title', label: { zh: '查看复盘服务权益', en: 'View review-service benefits' } }, title: { zh: '人工复盘必须有容量管理', en: 'Human review needs capacity management' }, body: { zh: '个人视频复盘与课程定制具有专业价值，也消耗人工时间。根据权益约定安排提交、排期、回复和质量复核；记录每项服务的耗时与完成率。新增会员与机构数量应匹配可用服务时间，需要协作时先明确质量标准，再扩大销售。', en: 'Personal review and course customisation create value but consume expert time. Define submission, scheduling, response and review workflows within agreed entitlements; measure delivery time and completion. Match sales to capacity and establish quality standards before adding collaborators.' } },
      { reference: { href: '/dev/infrastructure#infra-ops-title', label: { zh: '查看公开运行与恢复说明', en: 'Read the operations and recovery overview' } }, title: { zh: '数据、稳定性与多端维护', en: 'Data, reliability & platform maintenance' }, body: { zh: '训练记录与机构资料需要清楚的归属、访问权限、导出和恢复安排。优先保证关键训练入口可用，机构服务避免跨机构访问。Web 是现有核心入口，移动端和桌面端持续推进，发布和使用体验按各平台实际完成情况说明。', en: 'Practice records and organisational materials require clear ownership, access, export and recovery. Keep core training paths reliable and organisations isolated. Web is the established core; mobile and desktop work continues, with platform status described by actual release evidence.' } },
    ],
  },
  {
    id: 'bp-metrics', number: '11',
    label: { zh: '经营指标与阶段验收', en: 'Operating metrics & milestone review' },
    title: { zh: '让用户使用、服务交付和经营结果相互对应。', en: 'Connect usage, delivery and business outcomes.' },
    intro: { zh: '已有使用和真实付费会员是经营起点，持续增长与订阅效果需要统一口径记录。本版不披露实际活跃人数、付费人数或已实现收入；线上赛事另列计划测算。以下指标用于后续月度运营复核。', en: 'Existing use and real paid members are the operating starting point. Growth and subscription outcomes need consistent definitions. This version does not disclose actual active-user counts, paid counts or realised revenue; online events have a separate planning scenario. These metrics support monthly operating reviews.' },
    cards: [
      { title: { zh: '个人用户：看实际练习', en: 'Individuals: actual practice' }, body: { zh: '统计完成计时或训练的用户、训练天数、次月回访、记录积累和核心功能使用。把首次访问、注册和实际练习分开；跨设备在合适的账号口径下去重。高频需求用真实复练记录展示，而不是仅用页面访问量说明。', en: 'Track users who complete timed solves or training, practice days, next-month return, accumulated records and core-feature use. Separate visits, registration and practice; deduplicate appropriately across devices. Demonstrate frequency with actual repeated practice.' } },
      { title: { zh: '会员：看交付和续费', en: 'Membership: delivery & renewal' }, body: { zh: '按个人与企业分别记录新增会员、权益使用、服务完成、到期续费、退款和客服问题。续费率以当期到期、可续费的订阅为分母；永久会员另列，不纳入周期订阅的续费率和经常性收入。', en: 'Track personal and enterprise acquisitions, entitlement use, completed services, due renewals, refunds and support issues separately. Renewal rates use subscriptions due and eligible to renew; lifetime membership is reported separately from recurring revenue and renewal.' } },
      { title: { zh: '企业：看教学流程是否运转', en: 'Enterprise: working educator workflows' }, body: { zh: '记录已上线机构、实际使用的老师与学员、资料与课程服务交付、训练任务和反馈使用，以及机构续约。演示账号、意向客户与正式使用机构分别统计；功能实现不等于机构签约或成功上线。', en: 'Track onboarded organisations, active teachers and learners, resource and course delivery, assignment and feedback use, and renewal. Separate demos, leads and real deployments; implemented functions are not signed clients or completed onboarding.' } },
      { title: { zh: '经营：看每类服务能否持续', en: 'Operations: service sustainability' }, body: { zh: '按月记录实际回款、支付费用、算力与存储、内容和人工交付，以及固定支出。用来源归因评估获客，把免费工具使用、个人订阅和企业服务分别核算。阶段报告同时展示产品进展、用户使用与资金用途。', en: 'Report receipts, payment costs, compute, storage, content, human delivery and fixed costs monthly. Attribute acquisition sources and account separately for free use, personal subscriptions and enterprise services. Show product progress, use and spending together.' } },
    ],
  },
  {
    id: 'bp-financial', number: '12',
    label: { zh: '收入结构与经营测算', en: 'Revenue structure & operating scenarios' },
    title: { zh: '四类收入分开核算，服务成本逐项对应。', en: 'Four revenue lines, each matched to delivery costs.' },
    intro: { zh: '个人订阅、机构订阅、课程和计划中的线上赛事分别记录收入与交付。订阅提供周期性服务，课程按实际销售与教学交付核算，赛事按场次核算；商城暂不计入近期经营计划。', en: 'Account separately for individual subscriptions, institutional subscriptions, courses and planned online events. Subscriptions provide periodic service, courses follow actual sales and teaching delivery, and events are accounted for per competition. Commerce is excluded from near-term plans.' },
    cards: [
      { reference: { href: '/membership#personal-plans-title', label: { zh: '查看个人订阅套餐', en: 'View individual subscription plans' } }, title: { zh: '个人订阅', en: 'Individual subscriptions' }, body: { zh: '按月度、年度等周期记录有效订阅、实际回款与续费。预收年费按服务期分摊观察，永久会员另列；专业求解、复盘和人工服务分别记录使用量与直接成本。', en: 'Track active subscriptions, receipts and renewals by period. Allocate annual receipts across service periods and report lifetime memberships separately. Track solving, reconstruction and human-delivery usage and direct costs.' } },
      { reference: { href: '/membership#enterprise-plans-title', label: { zh: '查看机构订阅套餐', en: 'View institutional subscription plans' } }, title: { zh: '机构订阅', en: 'Institutional subscriptions' }, body: { zh: '按实际订阅与服务周期核算。标准机构权益与额外课程方案、资料整理等服务明确区分；洽谈中的机构不计收入，一次性定制不计入经常性订阅收入。', en: 'Account by actual subscriptions and service periods. Separate standard benefits from extra course planning or resource work. Institutions in discussion generate no booked revenue; one-off customisation is not recurring subscription revenue.' } },
      { reference: { href: '/courses', label: { zh: '查看已发布课程', en: 'Explore published courses' } }, title: { zh: '课程收入', en: 'Course revenue' }, body: { zh: '按实际课程订单、教学交付与退款核算，单独记录备课、内容制作、授课和答疑成本。课程与会员是否打包以实际发布的权益为准，同一笔订单不重复计入两类收入。', en: 'Account for actual course orders, teaching delivery and refunds, with preparation, production, teaching and support costs recorded separately. Bundles follow published terms; do not count an order in two revenue categories.' } },
      { title: { zh: '线上赛事报名费', en: 'Online-event entry fees' }, body: { zh: `每月 4 场、每场 200 人、每人每场 20 元的计划，对应月报名费毛收入 ¥${EVENT_GROSS_PER_MONTH.toLocaleString('en-US')}。实际收入随报名与退款变化，逐场扣除支付、奖品、裁判审核、客服及技术成本。该测算不代表净利润或已实现收入。`, en: `The plan of four monthly events, 200 entrants each and CNY 20 per entry implies CNY ${EVENT_GROSS_PER_MONTH.toLocaleString('en-US')} in monthly gross fees. Actual receipts depend on entries and refunds, with payment, prize, review, support and technical costs recorded per event. This is neither profit nor realised revenue.` } },
    ],
    conclusion: { zh: '各业务收入扣除直接服务成本后，才形成对固定开发、服务器、工具订阅与内容维护的贡献。机构意向、教师群成员和平台关注用于说明触达基础，经营结果以实际订单、交付与回款衡量。', en: 'Revenue contributes to fixed development, hosting, tooling and content only after direct delivery costs. Institutional interest, teacher-group membership and follows describe distribution; orders, delivery and receipts measure business results.' },
  },
  {
    id: 'bp-risks', number: '14',
    label: { zh: '主要风险与应对', en: 'Principal risks & responses' },
    title: { zh: '把关键风险纳入日常经营。', en: 'Manage the key risks as part of operations.' },
    intro: { zh: '专业方向与获客基础提供起点，持续经营还需要解决竞争、交付与成本问题。每项风险对应观察信号和可执行的调整方式，持续复核项目如何应对变化。', en: 'Specialist work and distribution provide a starting point. Sustainable operations also require responses to competition, capacity and costs, with observable signals and practical adjustments for each risk.' },
    cards: [
      { title: { zh: '竞品持续迭代与免费供给', en: 'Competitor iteration & free alternatives' }, body: { zh: '观察核心用户的选择与会员续费原因，持续改善训练体验、内容和专业服务。基础免费功能不作为唯一收费理由；把独特的教学和复盘价值做成可持续交付的服务。', en: 'Observe user choice and renewal reasons; improve training, content and specialist services. Do not rely on charging for common free features. Make teaching and reconstruction value deliverable over time.' } },
      { title: { zh: '关注到付费的转化有限', en: 'Limited conversion from audience to subscription' }, body: { zh: '分别看各内容渠道的实际练习、会员权益使用与续费，不把粉丝总量当作销售承诺。优先保留能带来持续用户的内容路径，并让销售节奏匹配真实反馈。', en: 'Track actual practice, premium use and renewal by source rather than promising sales from follower totals. Keep paths that bring lasting users and match promotion to feedback.' } },
      { title: { zh: '创始人与人工交付容量', en: 'Founder dependence & human service capacity' }, body: { zh: '人工复盘、定制与客服记录耗时和积压，制定排期、交接文档与质量标准。按真实任务增加协作，在交付容量跟上之前控制新增服务承诺。', en: 'Measure review, customisation and support effort and backlog. Document scheduling, handover and quality standards; add help for real tasks and avoid selling beyond capacity.' } },
      { title: { zh: '计算、存储与免费流量成本', en: 'Compute, storage & free-traffic costs' }, body: { zh: '持续监控高成本求解、调用和存储，设置服务监控与异常处置。对新功能先核算成本再确定权益，已公布权益按约定履行；开发工具订阅与用户侧算力分别核算。', en: 'Monitor expensive solving, requests and storage, with incident response. Cost new features before defining benefits and honour published entitlements. Account for development tooling separately from user-serving compute.' } },
      { title: { zh: '数据、内容与交付信任', en: 'Data, content & delivery trust' }, body: { zh: '机构和个人记录按用途授权与访问范围管理；保留数据导出与恢复流程。第三方内容和开源项目核对许可并注明来源；不将未经授权的用户记录、姓名或推荐用作宣传。', en: 'Manage records by authorised purpose and access; maintain export and recovery. Check licences and credit third-party work. Do not use records, identities or endorsements in promotion without permission.' } },
      { title: { zh: '支付与线上赛事准备', en: 'Payments & online-event readiness' }, body: { zh: '会员推广与实际支付及服务能力对齐。线上赛事先明确普通与智能魔方的记录和审核标准、争议处理与退费规则，逐场跟踪报名及成本，再评估每月 4 场节奏。', en: 'Align membership promotion with payment and delivery readiness. Define conventional and smart-cube evidence, review, appeals and refunds before events. Track entries and costs per event before assessing a four-event monthly cadence.' } },
    ],
  },
];

export const BP_NAV = [
  ['bp-market-size', { zh: '市场规模', en: 'Market size' }],
  ['bp-summary', { zh: '执行摘要', en: 'Summary' }],
  ['bp-market', { zh: '行业与需求', en: 'Need' }],
  ['bp-competition', { zh: '竞争与优势', en: 'Competition' }],
  ['bp-product', { zh: '产品与创始人', en: 'Product' }],
  ['bp-business', { zh: '订阅模式', en: 'Subscriptions' }],
  ['bp-courses', { zh: '课程与机构渠道', en: 'Courses & educators' }],
  ['bp-events', { zh: '线上赛事', en: 'Online events' }],
  ['bp-customers', { zh: '客户与市场', en: 'Customers' }],
  ['bp-growth', { zh: '增长路径', en: 'Growth' }],
  ['bp-roadmap', { zh: '发展规划', en: 'Roadmap' }],
  ['bp-operations', { zh: '交付与指标', en: 'Delivery' }],
  ['bp-financial', { zh: '财务与成本', en: 'Financials' }],
  ['bp-risks', { zh: '风险应对', en: 'Risks' }],
  ['bp-cooperation', { zh: '合作机会', en: 'Partnerships' }],
  ['bp-sources', { zh: '资料来源', en: 'Sources' }],
] as const;

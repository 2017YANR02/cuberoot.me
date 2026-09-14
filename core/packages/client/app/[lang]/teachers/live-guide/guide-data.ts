export const chapters = [
  { id: 'skills', title: { zh: '核心技能', en: 'Core skills' } },
  { id: 'conversion', title: { zh: '留住观众与转化', en: 'Attention & conversion' } },
  { id: 'rundown', title: { zh: '开播准备与流程', en: 'Preparation & rundown' } },
  { id: 'techniques', title: { zh: '现场技巧', en: 'Live techniques' } },
  { id: 'retention', title: { zh: '买课后的留存', en: 'Student retention' } },
  { id: 'review', title: { zh: '数据与复盘', en: 'Metrics & review' } },
];

export const skills = [
  {
    title: { zh: '识别人群与问题', en: 'Understand the learner' },
    body: { zh: '先分清零基础、已会复原和想提速的人。本场只解决一个主要问题；学习者与付款人不同时，也要回答陪练时间、上课方式和如何看到进步。', en: 'Distinguish first-time learners, people who can already solve, and speedcubers. Pick one main problem per session. If the learner and buyer differ, explain support time, lesson format, and how progress is shown.' },
    practice: { zh: '开播前写一句：这场是给谁的，结束时他能做什么。', en: 'Write one sentence before going live: who is this for, and what will they be able to do?' },
  },
  {
    title: { zh: '把技术教明白', en: 'Teach a visible small win' },
    body: { zh: '把动作拆成“看哪里、怎么转、怎么检查”。先正常演示一次，再慢速分解，让观众动手后检查结果。技术水平要能转化成别人跟得上的教学。', en: 'Break a move into what to look at, what to turn, and how to check it. Demonstrate once, slow down, then let viewers try and verify. Make your expertise usable by a learner.' },
    practice: { zh: '用一分钟教会一个小步骤，让零基础的人复述，而不是问“听懂了吗”。', en: 'Teach one small step in a minute and ask a beginner to explain it back.' },
  },
  {
    title: { zh: '表达与节奏', en: 'Speak with structure' },
    body: { zh: '短句、明确指代、一次一个重点。看镜头讲结论，低头演示时说清动作；个人经历只保留能解释教学方法的一段。提词稿写提示词，避免整段低头念。', en: 'Use short sentences and one point at a time. Face the camera for the takeaway and narrate your hands during demonstrations. Keep only the personal story that explains your teaching approach; use cue words on the prompt sheet.' },
    practice: { zh: '回看三分钟录像，删掉口头禅、长铺垫和与本场目标无关的内容。', en: 'Review three minutes of video and remove filler, long introductions, and off-topic material.' },
  },
  {
    title: { zh: '互动与现场判断', en: 'Read the room' },
    body: { zh: '提观众容易回答的问题，等待回应，再根据答案调整。优先回答多数人卡住的地方；个别高阶问题先记下，在答疑段处理。人数少时也完整教完当前步骤。', en: 'Ask easy-to-answer questions, pause, and adjust to the answers. Address common sticking points first and park specialist questions for Q&A. Finish the current teaching step even with a small audience.' },
    practice: { zh: '为每个演示准备一道判断题和一个无人回应时的自答示例。', en: 'Prepare one check question per demo and a worked answer for a quiet chat.' },
  },
  {
    title: { zh: '课程说明与成交', en: 'Explain the course clearly' },
    body: { zh: '把目标、适合谁、课程安排、练习反馈、价格和售后说明白。观众应能判断是否适合自己，并知道下一步在哪里操作。案例要交代起点、练习时间和个体差异。', en: 'Explain the goal, audience, lesson plan, practice feedback, price, and after-sales terms. Viewers should be able to judge fit and find the next step. Give the starting level, practice time, and individual context for examples.' },
    practice: { zh: '录一段九十秒课程介绍，检查听完能否回答“我学什么、怎么学、谁帮我、怎么买”。', en: 'Record a ninety-second course introduction covering what, how, support, and enrolment.' },
  },
  {
    title: { zh: '交付与复盘', en: 'Deliver and improve' },
    body: { zh: '把直播承诺落实到真实课程服务；按场次记录问题与数据。成交后仍要关注能否进入课程、完成第一次练习，以及哪里需要帮助。', en: 'Match what you say live to what the course actually delivers. Record questions and metrics for each session. After enrolment, check access, the first practice task, and where students need help.' },
    practice: { zh: '每场只选一个主要问题改进，并在下一场记录同口径数据。', en: 'Pick one main improvement per session and measure it consistently next time.' },
  },
];

export const journey = [
  {
    title: { zh: '进来：立刻知道与自己有关', en: 'Arrive: recognise a relevant problem' },
    body: { zh: '标题、封面和第一段演示讲同一个问题。新观众进来时，简短补充正在教什么、适合谁，不必重讲全部自我介绍。', en: 'Align the title, cover, and first demo around one problem. Briefly recap the current lesson and intended learner for new arrivals.' },
    example: { zh: '“刚进来的朋友，今天给还不会复原的同学讲白色十字。现在先练这一块怎么对齐。”', en: '“If you have just joined, we are learning the white cross for a first solve. Right now we are aligning this piece.”' },
  },
  {
    title: { zh: '留下：先得到一个小成果', en: 'Stay: achieve a small result' },
    body: { zh: '尽早开始真实教学。把完整小步骤教完，再预告下一步；用具体成果吸引继续看，不反复拖延答案。', en: 'Start teaching early. Finish a useful small step before previewing the next one; give viewers progress rather than repeatedly delaying the answer.' },
    example: { zh: '“先看侧面颜色，转到和中心块一致。你这一块对上了吗？对上的我们再接下一块。”', en: '“Match the side colour to its centre. Does yours match? Once it does, we will add the next piece.”' },
  },
  {
    title: { zh: '相信：展示怎么发现并纠正错误', en: 'Trust: show useful feedback' },
    body: { zh: '展示真实教学片段、练习任务或经同意使用的进步案例。把常见错误和修正过程讲出来，让观众看见上课时会获得什么帮助。', en: 'Show a real lesson excerpt, practice task, or progress example used with permission. Demonstrate a common error and the feedback that fixes it.' },
    example: { zh: '“这一块虽然白色朝上，但侧面还没对齐。课程练习时，我们也会先检查这种错误，再往下做。”', en: '“The white sticker is facing up, but the side is not aligned yet. This is the kind of check to make before moving on in practice.”' },
  },
  {
    title: { zh: '考虑：说明课程能接住哪一步', en: 'Consider: connect the lesson to the course' },
    body: { zh: '从刚完成的体验自然过渡到学习路线。明确基础要求、阶段目标、课时与练习安排、反馈方式、有效期和费用；内容全部按当期真实课程填写。', en: 'Connect the small win to a learning path. Explain prerequisites, milestones, lesson and practice schedules, feedback, access duration, and cost using the actual current offer.' },
    example: { zh: '“刚才练的是十字中的一个步骤。想继续系统学，可以看课程页的学习顺序和试听，先确认起点适不适合你。”', en: '“That was one step of the cross. To continue systematically, look at the course sequence and sample lesson to check the starting level.”' },
  },
  {
    title: { zh: '行动：一次只给一个清楚的下一步', en: 'Act: give one clear next step' },
    body: { zh: '介绍课程时只引导查看课程详情或报名入口，并演示如何找到。把关注、点赞、进群和购买分开放到合适时机；优惠、名额和期限只说真实存在的。', en: 'When explaining the offer, point to the course details or enrolment entry and show how to find it. Separate that action from follows, likes, and community invitations. Mention only real offers, limits, and deadlines.' },
    example: { zh: '“想了解的先打开课程详情，看适合人群和试听。还有不确定的，把目前水平和想解决的问题发出来。”', en: '“Open the course details to check the audience and sample lesson. If you are unsure, tell me your level and the problem you want to solve.”' },
  },
];

export const objections = [
  { title: { zh: '“网上有免费教程，为什么买课？”', en: '“Why pay when tutorials are free?”' }, body: { zh: '先认可可以自学，再说明真实差别：学习顺序、练习安排、纠错和答疑中，你的课程实际提供哪些。能独立自学的观众可以先用免费资源；不要把未提供的陪练包装成服务。', en: 'Acknowledge that self-study is possible. Explain which structure, practice planning, corrections, and Q&A your course actually provides. Independent learners can start with free resources; never promise coaching that is not included.' } },
  { title: { zh: '“太贵了。”', en: '“It costs too much.”' }, body: { zh: '先问是预算不合适，还是还没看懂课程价值。用课程内容和服务范围解释价格；有更合适的真实选项再介绍，不临时虚构折扣，也不贬低低预算用户。', en: 'Ask whether the issue is budget or unclear value. Explain the content and service scope. Offer a genuinely suitable lower-cost option if one exists, without inventing discounts or judging the viewer.' } },
  { title: { zh: '“没时间，怕坚持不下来。”', en: '“I have little time and may not keep going.”' }, body: { zh: '了解能稳定安排的时间，再展示一份实际练习任务和课程节奏。把目标拆小；课程安排与对方时间明显冲突时，直接说明不适合当前报名。', en: 'Ask what practice time is realistic, then show an actual task and schedule. Break the goal down. If the schedule does not fit, say that enrolment may not be suitable right now.' } },
  { title: { zh: '“多久能学会？一定能提速吗？”', en: '“How soon will I learn? Will I get faster?”' }, body: { zh: '先确认起点、目标和练习条件。说明阶段验收方式，分享有上下文的真实案例；把能提供的教学支持说清楚，不给人人相同的时间或成绩保证。', en: 'Establish the starting point, goal, and practice conditions. Explain milestone checks and contextualised examples. Describe the support you can provide without universal time or performance guarantees.' } },
];

export const preparation = [
  { zh: '定主题：明确主要人群、一个教学成果和一个主要行动入口；用同主题短视频或预告告知开播时间。', en: 'Set the topic: one audience, one teaching result, and one main action. Announce the session with a matching preview.' },
  { zh: '核课程：确认价格、课时、有效期、反馈方式、退款说明与页面一致，亲自走一遍试听和报名路径。', en: 'Verify the offer: price, lessons, access duration, feedback, and refund terms must match the page. Walk through the sample and enrolment path.' },
  { zh: '备演示：准备两个同主题例子、常见错误状态和备用魔方；把本场话术缩成提示词。', en: 'Prepare two examples, a common mistake, and a spare cube. Reduce the script to speaking cues.' },
  { zh: '测设备：用观众端检查收音、网络、手部对焦、颜色和镜像方向，关闭无关通知，备好静态演示。', en: 'Check audio, connection, hand focus, colours, and mirroring from a viewer device. Silence notifications and prepare a static fallback.' },
  { zh: '分职责：独播先讲完步骤再看评论；有人协助时，由助播记录问题、核对课程入口和标记回放时间点。', en: 'If working alone, finish each step before checking chat. A helper can collect questions, verify the course entry, and mark replay timestamps.' },
];

export const rundown = [
  { time: '00–03', title: { zh: '欢迎与定位', en: 'Welcome & focus' }, body: { zh: '一句介绍 + 今日成果 + 水平提问，尽快拿起魔方开始。', en: 'Brief introduction, today’s result, and a level check. Start using the cube promptly.' } },
  { time: '03–13', title: { zh: '第一轮小教学', en: 'First teaching loop' }, body: { zh: '示范、拆解、跟做、检查，完整交付一个小成果。', en: 'Demonstrate, break down, practise, and check one complete small result.' } },
  { time: '13–18', title: { zh: '课程如何接续', en: 'Introduce the learning path' }, body: { zh: '用当前问题说明课程顺序、支持方式和适合人群，给出详情入口。', en: 'Connect the problem to the course sequence, support, and audience; show the details entry.' } },
  { time: '18–30', title: { zh: '第二轮教学与纠错', en: 'Second demo & corrections' }, body: { zh: '换例子重复关键方法，简短照顾新观众，处理高频错误。', en: 'Use a new example, recap for newcomers, and correct common mistakes.' } },
  { time: '30–40', title: { zh: '集中答疑与适配', en: 'Q&A & course fit' }, body: { zh: '先答共同学习问题，再答价格、时间和服务问题，帮助观众判断。', en: 'Answer shared learning questions, then clarify price, time, and support.' } },
  { time: '40–45', title: { zh: '回顾与下次预告', en: 'Recap & next session' }, body: { zh: '复述今天学会什么，给一个课后练习，说明课程入口和下次主题。', en: 'Recap the result, give one practice task, and mention the course entry and next topic.' } },
];

export const techniques = [
  { title: { zh: '镜头与手部演示', en: 'Camera and hand demonstrations' }, body: { zh: '脸部镜头用于沟通，手部近景用于教学；只有一台设备时，先保证观众能看清魔方。使用稳定支架和均匀光线，避免反光。说“右面”时保持朝向一致，镜像要提前核对。关键状态停住，让观众有时间对照。', en: 'Use your face for communication and a close hand view for teaching. With one device, prioritise a clearly visible cube. Keep the camera steady and lighting even. Verify mirroring and orientation, and pause at key states for viewers to compare.' } },
  { title: { zh: '声音、语速与停顿', en: 'Audio, pace, and pauses' }, body: { zh: '先保证人声清楚，再考虑背景音乐。讲动作时放慢，完成后停一下等跟做；每段先讲结论，再示范。直播前录一小段，检查转动声是否盖过说话声。', en: 'Prioritise clear speech before adding music. Slow down for moves and pause for practice. State the point before demonstrating it. Record a short test to check that cube sounds do not drown out your voice.' } },
  { title: { zh: '让新观众随时跟上', en: 'Help late arrivals join in' }, body: { zh: '在自然转场时重复“适合谁、正在做什么、下一步是什么”。复述关键结构时换一个例子；老观众继续有收获，新观众也能进入。不要每来一个人就重启整场。', en: 'At natural transitions, recap who the lesson is for, what you are doing, and what comes next. Reuse the structure with a new example so returning viewers still learn something.' } },
  { title: { zh: '没人回应或人数下降', en: 'Quiet chat or falling viewer counts' }, body: { zh: '把问题缩小成可观察的结果，例如“侧面颜色对上了吗”。仍无人回应就自己示范两种情况，继续讲。看到人数下降先标记时间点，回放检查是否讲太久、画面不清或偏题；不能只凭在线人数判断原因。', en: 'Ask about an observable result, such as whether the side colours match. If chat stays quiet, show both outcomes and continue. Mark a viewer drop for replay review; check pace, clarity, and topic drift rather than inferring the cause from the count alone.' } },
  { title: { zh: '问题太多或话题跑偏', en: 'Too many questions or topic drift' }, body: { zh: '先回应“这个问题我记下了”，合并同类问题，在答疑段集中处理。正在教入门时，遇到盲拧等高阶问题先约定后续专题。合理质疑正面回答，人身攻击按平台管理工具处理。', en: 'Acknowledge questions, group similar ones, and answer them in Q&A. Save advanced topics such as blindfold solving for a suitable later session. Address reasonable criticism and use platform moderation for personal abuse.' } },
  { title: { zh: '演示失误、卡顿或断线', en: 'Demo mistakes and connection trouble' }, body: { zh: '失误时说清哪里错、如何检查和恢复，能变成教学就接着教。工具故障先切实体魔方或静态步骤；断线恢复后用一句话交代当前位置。不要让观众长时间看调试界面。', en: 'Explain what went wrong and how to diagnose and recover. Switch to a physical cube or static steps if a tool fails. After reconnecting, recap your place in the lesson without a long debugging interlude.' } },
  { title: { zh: '展示证据与课程价值', en: 'Show evidence and course value' }, body: { zh: '演示一份真实课程片段、作业或反馈，比反复说“专业”具体。展示成绩进步时说明测量条件和练习背景，个人资料取得同意后再用。涉及智力、升学等效果，不把个人感受说成确定结果。', en: 'Show an actual lesson, task, or feedback example. For progress results, explain measurement conditions and practice context, and obtain permission before using personal material. Do not turn personal impressions about intelligence or academic outcomes into promises.' } },
  { title: { zh: '成交语气与行动提示', en: 'Sales tone and calls to action' }, body: { zh: '用“适合你的话可以看详情”，配一次清楚的操作演示。给思考和提问时间。避免虚假倒计时、编造名额和用焦虑催单；课程限制、额外费用和售后说明不要藏到付款之后。', en: 'Invite suitable viewers to open the details and demonstrate the step clearly. Allow time to think and ask. Avoid invented countdowns or availability, and disclose course limits, extra costs, and after-sales terms before payment.' } },
];

export const retention = [
  { title: { zh: '下单后：顺利开始', en: 'After payment: make starting easy' }, body: { zh: '确认课程入口、开课方式、设备要求和求助渠道。按实际服务安排欢迎信息，让学员知道第一步做什么；不要只发一个群链接就结束。', en: 'Clarify course access, how lessons start, equipment, and where to get help. Within the actual service offered, give a welcome message with the first concrete step.' } },
  { title: { zh: '首次学习：完成一个小任务', en: 'First lesson: finish one small task' }, body: { zh: '安排符合起点的练习和自查标准。若课程提供反馈，明确提交方式与响应时间；若不提供，也要让学员能自行核对结果。', en: 'Give a level-appropriate task with a self-check. If feedback is included, explain submission and response times; otherwise provide a way to check the result independently.' } },
  { title: { zh: '持续学习：看见进步并解决卡点', en: 'Ongoing practice: progress and support' }, body: { zh: '按阶段记录能完成的动作、错误减少或稳定性改善。对中断学习者先了解原因，再提供与问题对应的练习建议；提醒频率由学员选择，不用高频催促代替教学帮助。', en: 'Track completed skills, fewer errors, or improved consistency by milestone. Ask why an inactive learner stopped and offer relevant practice guidance. Let students choose reminder frequency.' } },
  { title: { zh: '阶段结束：回顾与适合的下一步', en: 'Milestone review: choose the next step' }, body: { zh: '对照入课目标总结成果，说明还需练什么。达到当前阶段再讨论进阶课程；邀请满意学员自愿分享具体体验，把退款与投诉中的真实问题反馈到课程和直播说明。', en: 'Review progress against the original goal and explain what still needs practice. Discuss further courses when appropriate. Invite voluntary, specific feedback and use refund or complaint themes to improve teaching and the offer explanation.' } },
];

export const metrics = [
  { title: { zh: '一分钟观看留存', en: 'One-minute viewer retention' }, formula: { zh: '停留至少 60 秒的进入人数 ÷ 可完整观察 60 秒的进入人数', en: 'Entrants who stay ≥60 seconds ÷ entrants with a full 60-second observation window' }, action: { zh: '看开场与入场承接。按平台口径记录，无法取得就记“不可得”，不拿在线人数比值代替。', en: 'Review the opening and newcomer recap. Use a documented platform definition; mark unavailable data as unavailable.' } },
  { title: { zh: '平均观看时长', en: 'Average watch time' }, formula: { zh: '沿用平台的人次或去重人数口径，并记录单位', en: 'Use the platform’s visit- or viewer-based definition and record the unit' }, action: { zh: '结合回放时间点检查流失，区分流量来源与内容变化。', en: 'Check replay timestamps and separate traffic-source changes from content changes.' } },
  { title: { zh: '课程点击率', en: 'Course click-through rate' }, formula: { zh: '点击课程入口的去重人数 ÷ 看到该入口的去重人数', en: 'Unique course-entry clickers ÷ unique viewers exposed to that entry' }, action: { zh: '低时查课程是否相关、入口是否清楚。拿不到曝光人数时，可另记“点击人数 ÷ 本场观看人数”，标为观看到点击率。', en: 'Check relevance and visibility. If exposure is unavailable, label clickers ÷ session viewers separately as viewer-to-click rate.' } },
  { title: { zh: '点击后购买率', en: 'Click-to-purchase rate' }, formula: { zh: '课程点击者中，在指定归因窗口内付款的去重人数 ÷ 去重课程点击人数', en: 'Unique course clickers who buy within the attribution window ÷ unique course clickers' }, action: { zh: '低时查课程适配、价格说明、详情页与支付路径，不只改口播。', en: 'Check course fit, pricing explanation, the detail page, and checkout.' } },
  { title: { zh: '首次学习完成率', en: 'First-task completion' }, formula: { zh: '固定期限内完成首次任务的新学员数 ÷ 已满该观察期限的新学员数', en: 'New students finishing the first task within the window ÷ new students with a complete observation window' }, action: { zh: '例如统一观察购课后 7 天。低时查课程入口、任务难度和求助路径。', en: 'For example, use seven days after purchase consistently. Check access, difficulty, and support.' } },
  { title: { zh: '次周学习留存', en: 'Second-week learning retention' }, formula: { zh: '购课后第 8–14 天有有效学习行为的人数 ÷ 已满 14 天观察期的同批购课人数', en: 'Buyers with meaningful learning activity on days 8–14 ÷ buyers in that cohort with 14 days of observation' }, action: { zh: '先定义有效学习，如完成练习或提交作业；进群和打开页面单独记录。', en: 'Define meaningful activity, such as finishing practice or submitting work. Track joining a group or opening a page separately.' } },
  { title: { zh: '退款与投诉', en: 'Refunds and complaints' }, formula: { zh: '固定观察期内退款订单数 ÷ 同批付款订单数；投诉原因另记', en: 'Refunded orders ÷ paid orders in the same cohort and observation window; record complaint reasons separately' }, action: { zh: '检查是否承诺不符、课程不适合或交付不顺。不要只看成交额而忽略后续体验。', en: 'Check expectation mismatch, poor fit, and delivery issues alongside sales.' } },
];

export const reviewTemplate = {
  zh: `直播复盘
日期 / 平台 / 时段 / 时长：
主要人群 / 本场教学成果 / 主推课程：
流量来源 / 是否投流及成本：

数据（写明来源、分子、分母与观察窗口；无法取得填不可得）
进入人数 / 平均观看时长 / 一分钟观看留存：
课程曝光人数 / 课程点击人数 / 付款人数：
观看到点击率或课程点击率 / 点击后购买率：
后续补记：首次任务完成 / 次周学习 / 退款与投诉：

回放证据
表现好的片段（时间点 + 观众反应）：
明显流失或卡住的片段（时间点 + 当时在做什么）：
最常见的三个问题：

下一场
最需要改善的问题：
原因假设与证据：
只改的一件事：
主要观察指标 / 同时关注的退款或学习指标：
对比条件（时段、人群、流量来源、课程与价格）：
下次复核日期：`,
  en: `Livestream review
Date / platform / time slot / duration:
Audience / teaching result / featured course:
Traffic sources / paid promotion and cost:

Metrics (source, numerator, denominator, and observation window; mark unavailable data)
Entrants / average watch time / one-minute retention:
Course exposures / clickers / buyers:
Viewer-to-click or course click-through rate / click-to-purchase rate:
Follow-up: first task / second-week learning / refunds and complaints:

Replay evidence
Strong segment (timestamp and audience response):
Drop-off or difficulty (timestamp and what was happening):
Three most common questions:

Next session
Main problem to improve:
Hypothesis and evidence:
One change to make:
Primary metric / refund or learning metric to monitor:
Comparison conditions (time, audience, traffic, course, price):
Review date:`,
};

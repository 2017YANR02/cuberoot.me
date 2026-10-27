import type { CareerPositionId } from '@cuberoot/shared/careers';

export type CareerText = { zh: string; en: string };
export type CareerPosition = {
  id: CareerPositionId;
  title: CareerText;
  category: CareerText;
  summary: CareerText;
  responsibilities: CareerText[];
  requirements: CareerText[];
  advantages: CareerText[];
};

// Employment terms have not yet been confirmed.
export const careerPositions: CareerPosition[] = [
  {
    id: 'engineering',
    title: { zh: '全栈工程师', en: 'Full-stack engineer' },
    category: { zh: '技术研发', en: 'Engineering' },
    summary: { zh: '与团队一起建设魔方根的网站、工具和产品。', en: 'Build CubeRoot’s website, tools and products with the team.' },
    responsibilities: [
      { zh: '参与产品需求拆解、方案设计与全栈开发，持续改进已有功能。', en: 'Turn product needs into designs and full-stack implementations, and improve existing features.' },
      { zh: '使用 AI 编程工具推进开发，同时审查、测试和维护生成的代码。', en: 'Use AI coding tools to move work forward while reviewing, testing and maintaining the resulting code.' },
      { zh: '定位并解决体验、性能与稳定性问题，与产品和运营协作交付。', en: 'Investigate usability, performance and reliability issues and deliver work with product and operations.' },
    ],
    requirements: [
      { zh: '熟练使用 Vibe Coding，能清晰表达需求、引导 AI 迭代，并独立判断和验证结果。', en: 'Strong Vibe Coding skills: communicate requirements, guide AI iterations, and independently assess and verify results.' },
      { zh: '具备实际软件开发经验，理解 Web 前后端、Git 和基本工程实践。', en: 'Practical software development experience and an understanding of web frontends, backends, Git and engineering fundamentals.' },
      { zh: '重视代码质量、用户体验和问题的完整解决，能够主动沟通。', en: 'Care about code quality, user experience and resolving problems thoroughly; communicate proactively.' },
    ],
    advantages: [
      { zh: '熟悉 TypeScript、React、Next.js 或移动应用开发。', en: 'Experience with TypeScript, React, Next.js or mobile applications.' },
      { zh: '了解魔方、速拧社区或相关工具。', en: 'Familiarity with cubing, speedcubing communities or related tools.' },
    ],
  },
  {
    id: 'content-operations',
    title: { zh: '内容运营与视频剪辑', en: 'Content operations and video editor' },
    category: { zh: '运营与内容', en: 'Operations and content' },
    summary: { zh: '把选手素材制作成视频，持续运营魔方根的各平台内容。', en: 'Turn footage of cubers into videos and grow CubeRoot’s content across platforms.' },
    responsibilities: [
      { zh: '整理选手及比赛素材，完成选题、剪辑、字幕、封面和成片交付。', en: 'Organize footage of cubers and competitions, develop ideas, edit videos, and deliver captions and covers.' },
      { zh: '根据平台特点制作和发布内容，维护小红书、快手、微博、YouTube、TikTok、B 站等账号。', en: 'Adapt and publish content for Xiaohongshu, Kuaishou, Weibo, YouTube, TikTok, Bilibili and other channels.' },
      { zh: '跟进内容表现与评论反馈，复盘选题并持续改进；配合其他内容和运营工作。', en: 'Review content performance and audience feedback, improve future ideas, and support other content and operations work.' },
      { zh: '运用 AI 工具和 Vibe Coding，制作或改进内容生产、发布与运营所需的小工具。', en: 'Use AI tools and Vibe Coding to create or improve small tools for content production, publishing and operations.' },
    ],
    requirements: [
      { zh: '女性；希望寻找愿意长期合作的伙伴。', en: 'Women applicants; seeking someone interested in a long-term collaboration.' },
      { zh: '会 Vibe Coding，能借助 AI 将工作需求转化为可用的小工具，并验证和迭代结果。', en: 'Able to use Vibe Coding and AI to turn work needs into useful small tools, then verify and iterate on them.' },
      { zh: '具备视频剪辑能力，能独立完成素材整理、剪辑、字幕和封面。', en: 'Able to independently organize footage, edit videos, and create captions and covers.' },
      { zh: '理解不同内容平台的发布方式，沟通主动、做事细致，尊重选手和素材授权。', en: 'Understand publishing across content platforms, communicate proactively, work carefully and respect participants and footage permissions.' },
    ],
    advantages: [
      { zh: '熟悉魔方或速拧文化，有账号运营或赛事内容制作经验。', en: 'Familiarity with cubing or speedcubing, or experience running accounts or producing event content.' },
      { zh: '能根据中英文平台受众调整标题、文案和视频形式。', en: 'Ability to adapt titles, copy and video formats for Chinese- and English-speaking audiences.' },
    ],
  },
];

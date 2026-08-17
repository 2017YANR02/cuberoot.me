export type CourseLevel = "入门" | "进阶" | "高阶" | "竞速";
export type CourseFormat = "录播系统课" | "线上直播" | "一对一私教" | "线下家教";

export type Course = {
  id: string;
  title: string;
  subtitle: string;
  level: CourseLevel;
  format: CourseFormat;
  instructor: string;
  durationHours: number;
  lessons: number;
  price: number;
  studentsEnrolled: number;
  rating: number;
  highlights: string[];
  outline: { week: string; topic: string }[];
  tags: string[];
  videoUrl?: string | null;
  coverUrl?: string | null;
  nextLiveAt?: number | null;
};

export const COURSES: Course[] = [
  {
    id: "cfop-foundation",
    title: "CFOP 系统化基础课",
    subtitle: "从层先法跨越到 CFOP,夯实 sub-20 的底层能力。",
    level: "进阶",
    format: "录播系统课",
    instructor: "陈思远",
    durationHours: 14,
    lessons: 24,
    price: 399,
    studentsEnrolled: 1248,
    rating: 4.9,
    highlights: ["全套 41 OLL / 21 PLL 公式拆解", "20 节复盘 + 4 节专项突破", "配套训练计划与进度跟踪"],
    outline: [
      { week: "Week 1", topic: "Cross 高效十字与色块预判" },
      { week: "Week 2", topic: "F2L 直觉化思路与 41 种公式" },
      { week: "Week 3", topic: "OLL 完整体系与识别加速" },
      { week: "Week 4", topic: "PLL 全公式 + 双层 AUF" },
      { week: "Week 5", topic: "整合训练与瓶颈分析" },
    ],
    tags: ["CFOP", "公式", "训练"],
    videoUrl: "https://sample-videos.com/video321/mp4/720/big_buck_bunny_720p_1mb.mp4",
  },
  {
    id: "blind-cube",
    title: "盲拧从 0 到 1",
    subtitle: "三阶盲拧 Old Pochmann + M2/3-style 入门完整路径。",
    level: "高阶",
    format: "线上直播",
    instructor: "林哲",
    durationHours: 18,
    lessons: 12,
    price: 599,
    studentsEnrolled: 318,
    rating: 4.95,
    highlights: ["记忆系统训练 + 镜像练习", "贴码 / 字母对照法实战", "首次盲拧成功率保障"],
    outline: [
      { week: "Week 1", topic: "盲拧基本概念与编码体系" },
      { week: "Week 2", topic: "棱块 Old Pochmann 公式串" },
      { week: "Week 3", topic: "角块 Y-perm 串与方向" },
      { week: "Week 4", topic: "记忆法实战:故事法与宫殿法" },
      { week: "Week 5", topic: "M2 / 3-style 提速入门" },
    ],
    tags: ["盲拧", "记忆", "高阶"],
    videoUrl: "https://player.bilibili.com/player.html?bvid=BV1GJ411x7h7&page=1",
    nextLiveAt: 1781870400,
  },
  {
    id: "zbll-attack",
    title: "ZBLL 速攻训练营",
    subtitle: "全 493 套 ZBLL 分组训练,冲刺 sub-10。",
    level: "竞速",
    format: "录播系统课",
    instructor: "王朗",
    durationHours: 32,
    lessons: 48,
    price: 899,
    studentsEnrolled: 142,
    rating: 4.85,
    highlights: ["全 493 套分类训练数据", "识别加速 + 镜像扫描法", "60 天系统打卡计划"],
    outline: [
      { week: "Week 1", topic: "ZBLL 全图谱与 COLL 衔接" },
      { week: "Week 2", topic: "U / T 套手法精修" },
      { week: "Week 3", topic: "L / S 套与镜像识别" },
      { week: "Week 4", topic: "Pi / H 套综合训练" },
      { week: "Week 5", topic: "整套竞速实测与瓶颈分析" },
    ],
    tags: ["ZBLL", "竞速", "高阶"],
    videoUrl: "https://player.vimeo.com/video/76979871",
  },
  {
    id: "kids-starter",
    title: "少儿魔方启蒙课",
    subtitle: "面向 6–10 岁,用层先法建立成就感与空间思维。",
    level: "入门",
    format: "线上直播",
    instructor: "苏漫",
    durationHours: 10,
    lessons: 16,
    price: 299,
    studentsEnrolled: 2104,
    rating: 4.92,
    highlights: ["儿童友好语言与节奏", "家长同步陪练手册", "课程内打卡奖励机制"],
    outline: [
      { week: "Week 1", topic: "认识魔方与基本动作" },
      { week: "Week 2", topic: "底面十字与还原下层" },
      { week: "Week 3", topic: "中层棱块技巧" },
      { week: "Week 4", topic: "顶面十字与角块归位" },
      { week: "Week 5", topic: "完整还原与速度入门" },
    ],
    tags: ["启蒙", "少儿"],
  },
  {
    id: "1v1-coaching",
    title: "1 对 1 在线私教",
    subtitle: "教练点对点定制训练,针对你的瓶颈出方案。",
    level: "进阶",
    format: "一对一私教",
    instructor: "顶尖教练池",
    durationHours: 1,
    lessons: 1,
    price: 280,
    studentsEnrolled: 540,
    rating: 5,
    highlights: ["按节购买,定制训练大纲", "课后回放与作业批改", "全国顶尖教练自由匹配"],
    outline: [
      { week: "Session", topic: "训练目标与现状评估" },
      { week: "Session", topic: "公式 / 手法定制方案" },
      { week: "Session", topic: "实战陪练与录像复盘" },
    ],
    tags: ["1v1", "私教"],
  },
  {
    id: "competition-prep",
    title: "WCA 赛前突击营",
    subtitle: "考前 4 周冲刺 PB,涵盖心态、节奏与赛场策略。",
    level: "竞速",
    format: "线上直播",
    instructor: "周宇桐",
    durationHours: 16,
    lessons: 8,
    price: 499,
    studentsEnrolled: 86,
    rating: 4.88,
    highlights: ["模拟赛场环境完整流程", "失误率与心率管理训练", "选手 PB 实战分析"],
    outline: [
      { week: "Week 1", topic: "赛场流程与计时器规范" },
      { week: "Week 2", topic: "心态管理与呼吸节奏" },
      { week: "Week 3", topic: "盲项目专项强化" },
      { week: "Week 4", topic: "模拟赛与最后冲刺" },
    ],
    tags: ["WCA", "竞速", "赛前"],
    videoUrl: "https://sample-videos.com/video321/mp4/720/big_buck_bunny_720p_2mb.mp4",
    nextLiveAt: 1782473400,
  },
];

export function findCourse(id: string): Course | undefined {
  return COURSES.find((c) => c.id === id);
}

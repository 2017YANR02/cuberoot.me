export interface BilingualText {
  zh: string;
  en: string;
}

export interface EducationEntry {
  period: string;
  institution: BilingualText;
  program: BilingualText;
  note?: BilingualText;
}

export interface AwardEntry {
  id: string;
  date: string;
  title: BilingualText;
  detail: BilingualText;
  image: string;
  width: number;
  height: number;
}

export interface AwardGroup {
  id: 'university' | 'high-school';
  title: BilingualText;
  period: string;
  awards: AwardEntry[];
}

export const EDUCATION: EducationEntry[] = [
  {
    period: '2018.09–2021.01',
    institution: { zh: '乔治华盛顿大学数学系', en: 'The George Washington University, Department of Mathematics' },
    program: { zh: '数学硕士', en: "Master's degree in Mathematics" },
    note: {
      zh: '2018 年获校长奖学金，10,000 美元 / 年',
      en: "Received the university's Presidential Scholarship in 2018, valued at USD 10,000 per year",
    },
  },
  {
    period: '2017.07–2017.08',
    institution: { zh: '北京大学数学科学学院', en: 'Peking University, School of Mathematical Sciences' },
    program: { zh: '偏微分方程数值方法暑期学校', en: 'Summer School on Numerical Methods for Partial Differential Equations' },
  },
  {
    period: '2016.03–2016.08',
    institution: { zh: '中国科学院数学与系统科学研究院', en: 'Academy of Mathematics and Systems Science, Chinese Academy of Sciences' },
    program: { zh: '科学计算国际暑期学校', en: 'International Summer School in Scientific Computing' },
  },
  {
    period: '2013.09–2018.07',
    institution: { zh: '南开大学数学科学学院、物理科学学院', en: 'Nankai University, School of Mathematical Sciences and School of Physics' },
    program: { zh: '数学与金融数学学士、物理学学士', en: "Bachelor's degrees in Mathematics and Financial Mathematics, and Physics" },
  },
];

export const AWARD_GROUPS: AwardGroup[] = [
  {
    id: 'university',
    title: { zh: '大学阶段', en: 'University' },
    period: '2014–2015',
    awards: [
      {
        id: 'college-national-math-third-prize-2015',
        date: '2015',
        title: { zh: '全国大学生数学竞赛三等奖', en: 'Third Prize, Chinese Mathematics Competitions for College Students' },
        detail: { zh: '第七届，数学类', en: 'Seventh edition, Mathematics category' },
        image: '/images/ruimin/awards/college-national-math-third-prize-2015.webp',
        width: 3264,
        height: 2448,
      },
      {
        id: 'college-tianjin-math-grand-prize-2014',
        date: '2014',
        title: { zh: '天津市普通高校大学数学竞赛特等奖', en: 'Grand Prize, Tianjin Municipal Mathematics Competition for College Students' },
        detail: { zh: '本科理工类', en: 'Undergraduate Science and Engineering division' },
        image: '/images/ruimin/awards/college-tianjin-math-grand-prize-2014.webp',
        width: 3264,
        height: 2448,
      },
      {
        id: 'college-gongneng-scholarship-2014',
        date: '2014.10',
        title: { zh: '南开大学“公能”奖学金', en: 'Nankai University “Gongneng” Scholarship' },
        detail: { zh: '2013–2014 学年度', en: '2013–2014 academic year' },
        image: '/images/ruimin/awards/college-gongneng-scholarship-2014.webp',
        width: 3264,
        height: 2448,
      },
      {
        id: 'college-beauty-of-math-paper-second-prize-2014',
        date: '2014.12',
        title: { zh: '《数学之美》优秀论文二等奖', en: 'Second Prize, “Beauty of Mathematics” Outstanding Paper Competition' },
        detail: { zh: '获奖论文《Tupper 自我指涉》', en: 'For the paper “Tupper Self-Reference”' },
        image: '/images/ruimin/awards/college-beauty-of-math-paper-second-prize-2014.webp',
        width: 3264,
        height: 2448,
      },
    ],
  },
  {
    id: 'high-school',
    title: { zh: '高中阶段', en: 'High school' },
    period: '2011–2012',
    awards: [
      {
        id: 'high-school-chinese-mathematical-olympiad-third-prize-2012',
        date: '2012',
        title: { zh: '中国数学奥林匹克三等奖（铜牌）', en: 'Third Prize (bronze medal), Chinese Mathematical Olympiad' },
        detail: { zh: '2012 年中国数学奥林匹克', en: '2012 Chinese Mathematical Olympiad' },
        image: '/images/ruimin/awards/high-school-chinese-mathematical-olympiad-third-prize-2012.webp',
        width: 2400,
        height: 3600,
      },
      {
        id: 'high-school-math-league-first-prize-2012',
        date: '2012',
        title: { zh: '全国高中数学联赛一等奖', en: 'First Prize, National High School Mathematics League' },
        detail: { zh: '2012 年', en: '2012' },
        image: '/images/ruimin/awards/high-school-math-league-first-prize-2012.webp',
        width: 2400,
        height: 3600,
      },
      {
        id: 'high-school-physics-second-prize-2012',
        date: '2012',
        title: { zh: '全国中学生物理竞赛二等奖', en: 'Second Prize, National High School Physics Competition' },
        detail: { zh: '第 29 届', en: '29th edition' },
        image: '/images/ruimin/awards/high-school-physics-second-prize-2012.webp',
        width: 3600,
        height: 2400,
      },
      {
        id: 'high-school-yunnan-merit-student-2012',
        date: '2011–2012',
        title: { zh: '云南省级三好学生', en: 'Yunnan Provincial Outstanding Student' },
        detail: { zh: '2011–2012 学年度', en: '2011–2012 academic year' },
        image: '/images/ruimin/awards/high-school-yunnan-merit-student-2012.webp',
        width: 3600,
        height: 2400,
      },
      {
        id: 'high-school-math-league-first-prize-2011',
        date: '2011',
        title: { zh: '全国高中数学联赛一等奖', en: 'First Prize, National High School Mathematics League' },
        detail: { zh: '2011 年', en: '2011' },
        image: '/images/ruimin/awards/high-school-math-league-first-prize-2011.webp',
        width: 2400,
        height: 3600,
      },
      {
        id: 'high-school-western-math-olympiad-third-prize-2011',
        date: '2011',
        title: { zh: '中国西部数学奥林匹克三等奖', en: 'Third Prize, China Western Mathematical Olympiad' },
        detail: { zh: '第十一届', en: '11th edition' },
        image: '/images/ruimin/awards/high-school-western-math-olympiad-third-prize-2011.webp',
        width: 2400,
        height: 3600,
      },
    ],
  },
];

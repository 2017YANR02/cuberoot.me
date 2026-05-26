export type Instructor = {
  id: string;
  name: string;
  title: string;
  city: string;
  specialty: string[];
  studentsTaught: number;
  yearsTeaching: number;
  bestRecord: string;
  bio: string;
};

export const INSTRUCTORS: Instructor[] = [
  {
    id: "chen-siyuan",
    name: "陈思远",
    title: "CFOP 系统教练 · 平台首席",
    city: "上海",
    specialty: ["CFOP", "F2L 直觉化"],
    studentsTaught: 1248,
    yearsTeaching: 6,
    bestRecord: "3x3 PB 7.42s",
    bio: "前 WCA 区域冠军,擅长把直觉化的 F2L 拆解成可复用的训练流程。",
  },
  {
    id: "lin-zhe",
    name: "林哲",
    title: "盲拧专项 · 速记导师",
    city: "北京",
    specialty: ["盲拧", "记忆法"],
    studentsTaught: 318,
    yearsTeaching: 4,
    bestRecord: "盲拧 PB 22.6s",
    bio: "三阶盲拧多次进入全国前 20,提出 M2 衔接 3-style 的渐进式教学路径。",
  },
  {
    id: "wang-lang",
    name: "王朗",
    title: "ZBLL 高阶教练",
    city: "广州",
    specialty: ["ZBLL", "COLL"],
    studentsTaught: 142,
    yearsTeaching: 3,
    bestRecord: "3x3 PB 6.88s",
    bio: "国内最早将 493 套 ZBLL 完整数字化训练化的教练之一。",
  },
  {
    id: "su-man",
    name: "苏漫",
    title: "少儿魔方启蒙 · 一线教学",
    city: "成都",
    specialty: ["启蒙", "层先法"],
    studentsTaught: 2104,
    yearsTeaching: 5,
    bestRecord: "—",
    bio: "面向 6–10 岁少儿的启蒙体系作者,出版过两本面向小学课堂的教辅。",
  },
  {
    id: "zhou-yutong",
    name: "周宇桐",
    title: "WCA 赛前突击 · 心态教练",
    city: "杭州",
    specialty: ["竞速", "心态管理"],
    studentsTaught: 86,
    yearsTeaching: 2,
    bestRecord: "3x3 PB 6.55s",
    bio: "WCA 区域 Top 选手,专注赛前 4 周冲刺训练与心态管理。",
  },
];

export function findInstructor(id: string): Instructor | undefined {
  return INSTRUCTORS.find((i) => i.id === id);
}

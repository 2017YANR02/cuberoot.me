/**
 * 一次性种子:免费「三阶入门体验课」+ 5 节真实章节 + 每节一道测验。
 *
 * 目的:让「看课 → 测验 → 笔记 → 学习进度 → 结课证书」整条学习闭环在本地可
 * 一路点通(验收用)。课程 price=0,所有人可看;章节视频是 public/demo 下的
 * 短样片(testsrc),能播到结尾触发完成,跟着拿证。
 *
 * 幂等:课程/章节/测验都用确定性 id + onConflictDoUpdate,可反复运行不重复。
 * 运行:pnpm exec tsx db/seed-demo-course.ts
 */
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import path from "node:path";
import * as schema from "./schema";
import type { CourseInsert } from "./schema";
import { segmentCjk } from "../lib/search/segment";

const DB_PATH = process.env.DB_PATH ?? path.join(process.cwd(), "data.db");
const sqlite = new Database(DB_PATH);
sqlite.pragma("journal_mode = WAL");
// courses 的 FTS5 触发器会调用 cube_seg(...),upsert 前必须注册,否则失败。
sqlite.function("cube_seg", { deterministic: true }, (v: unknown) =>
  segmentCjk(v),
);
const db = drizzle(sqlite, { schema });

const now = Math.floor(Date.now() / 1000);
const COURSE_ID = "starter-3x3";

const course: CourseInsert = {
  id: COURSE_ID,
  title: "三阶魔方零基础入门(免费体验课)",
  subtitle: "五节短课,带你第一次独立还原三阶魔方",
  level: "入门",
  format: "录播系统课",
  instructor: "魔方开放社群教研组",
  instructorId: null,
  durationHours: 1,
  lessons: 5,
  price: 0,
  studentsEnrolled: 0,
  rating: 5,
  highlights: [
    "零基础友好,跟着五步练就能独立还原",
    "层先法拆解,每节聚焦一个动作",
    "每节配一道小测验,边学边巩固",
    "学满全部章节自动颁发结课证书",
  ],
  outline: [
    { week: "第 1 节", topic: "认识魔方结构与转动记法" },
    { week: "第 2 节", topic: "第一步:底层白色十字" },
    { week: "第 3 节", topic: "第二步:归位白色角块,完成第一层" },
    { week: "第 4 节", topic: "第三步:还原中间层棱块" },
    { week: "第 5 节", topic: "第四步:顶层十字与收尾还原" },
  ],
  tags: ["入门", "三阶", "免费", "层先法"],
  videoUrl: null,
  coverUrl: null,
  nextLiveAt: null,
};

const lessons: { idx: number; title: string; dur: number }[] = [
  { idx: 1, title: "认识魔方结构与转动记法", dur: 6 },
  { idx: 2, title: "第一步:做好底层白色十字", dur: 7 },
  { idx: 3, title: "第二步:归位白色角块,完成第一层", dur: 8 },
  { idx: 4, title: "第三步:还原中间层棱块", dur: 7 },
  { idx: 5, title: "第四步:顶层十字 + 顶面 + 收尾还原", dur: 9 },
];

const quizzes: {
  idx: number;
  question: string;
  options: string[];
  answerIdx: number;
  explain: string;
}[] = [
  {
    idx: 1,
    question: "转动记法里的字母 R 表示什么?",
    options: [
      "顺时针转右面",
      "顺时针转上面",
      "顺时针转前面",
      "逆时针转右面",
    ],
    answerIdx: 0,
    explain: "R = Right,顺时针转右面;带撇的 R' 才是逆时针。",
  },
  {
    idx: 2,
    question: "复原底层白色十字时,十字四个棱块的侧面颜色要满足什么?",
    options: [
      "与相邻中心块同色",
      "随意,只要顶面是白色",
      "四个都白色",
      "与角块同色",
    ],
    answerIdx: 0,
    explain: "棱块侧面要对齐相邻中心块,否则只是「伪十字」,后续会错位。",
  },
  {
    idx: 3,
    question: "归位白色角块最常用的右手基础口诀是?",
    options: ["R U R' U'", "U2 D2", "F2 B2", "L R L R"],
    answerIdx: 0,
    explain: "R U R' U' 按角块所在位置重复几次即可把它送回底层正确位置。",
  },
  {
    idx: 4,
    question: "还原中间层棱块前,要先把目标棱块对到哪里?",
    options: [
      "顶层,并让它正面颜色对齐对应中心块",
      "直接塞进中层",
      "放到底层",
      "随便哪里都行",
    ],
    answerIdx: 0,
    explain: "先在顶层把棱块正面色对齐中心,再用左/右插入公式送进中层。",
  },
  {
    idx: 5,
    question: "顶层十字阶段,顶面只有一个中心点(没有任何黄边)时应先做什么?",
    options: [
      "任选方向做一次 F R U R' U' F' 变出形态",
      "直接翻面收尾",
      "拆开重拼",
      "换一套配色",
    ],
    answerIdx: 0,
    explain:
      "点状态做一次 F R U R' U' F' 会变成 L 形或一字,再调整方向重复即可出十字。",
  },
];

function main() {
  // 课程 upsert(不覆盖主键 id)。
  const { id: _omit, ...courseSet } = course;
  void _omit;
  db.insert(schema.courses)
    .values(course)
    .onConflictDoUpdate({ target: schema.courses.id, set: courseSet })
    .run();

  for (const l of lessons) {
    const id = `l_demo_${l.idx}`;
    const videoUrl = `/demo/lesson-${l.idx}.mp4`;
    db.insert(schema.lessons)
      .values({
        id,
        courseId: COURSE_ID,
        idx: l.idx,
        title: l.title,
        durationSec: l.dur,
        videoKey: null,
        videoUrl,
        free: true,
        createdAt: now,
      })
      .onConflictDoUpdate({
        target: schema.lessons.id,
        set: {
          courseId: COURSE_ID,
          idx: l.idx,
          title: l.title,
          durationSec: l.dur,
          videoUrl,
          free: true,
        },
      })
      .run();
  }

  for (const q of quizzes) {
    const id = `qz_demo_${q.idx}`;
    const lessonId = `l_demo_${q.idx}`;
    db.insert(schema.quizzes)
      .values({
        id,
        lessonId,
        courseId: COURSE_ID,
        question: q.question,
        options: q.options,
        answerIdx: q.answerIdx,
        explain: q.explain,
        sortOrder: 0,
        createdAt: now,
      })
      .onConflictDoUpdate({
        target: schema.quizzes.id,
        set: {
          lessonId,
          courseId: COURSE_ID,
          question: q.question,
          options: q.options,
          answerIdx: q.answerIdx,
          explain: q.explain,
        },
      })
      .run();
  }

  console.log(
    `seeded course '${COURSE_ID}' + ${lessons.length} lessons + ${quizzes.length} quizzes`,
  );
}

main();

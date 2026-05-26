import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { eq } from "drizzle-orm";
import path from "node:path";
import * as schema from "./schema";
import { COURSES } from "../data/courses";
import { PRODUCTS } from "../data/products";
import { EVENTS } from "../data/events";
import { NEWS } from "../data/news";
import { INSTRUCTORS } from "../data/instructors";
import type { CircleId } from "./schema";

const DB_PATH = process.env.DB_PATH ?? path.join(process.cwd(), "data.db");

const sqlite = new Database(DB_PATH);
sqlite.pragma("journal_mode = WAL");
const db = drizzle(sqlite, { schema });

async function main() {
  for (const c of COURSES) {
    await db
      .insert(schema.courses)
      .values({
        ...c,
        videoUrl: c.videoUrl ?? null,
        coverUrl: c.coverUrl ?? null,
        nextLiveAt: c.nextLiveAt ?? null,
      })
      .onConflictDoUpdate({
        target: schema.courses.id,
        set: {
          title: c.title,
          subtitle: c.subtitle,
          level: c.level,
          format: c.format,
          instructor: c.instructor,
          durationHours: c.durationHours,
          lessons: c.lessons,
          price: c.price,
          studentsEnrolled: c.studentsEnrolled,
          rating: c.rating,
          highlights: c.highlights,
          outline: c.outline,
          tags: c.tags,
          videoUrl: c.videoUrl ?? null,
          coverUrl: c.coverUrl ?? null,
          nextLiveAt: c.nextLiveAt ?? null,
        },
      });
  }

  for (const p of PRODUCTS) {
    await db
      .insert(schema.products)
      .values({ ...p, originalPrice: p.originalPrice ?? null })
      .onConflictDoUpdate({
        target: schema.products.id,
        set: {
          name: p.name,
          category: p.category,
          brand: p.brand,
          price: p.price,
          originalPrice: p.originalPrice ?? null,
          rating: p.rating,
          reviews: p.reviews,
          description: p.description,
          features: p.features,
          inStock: p.inStock,
        },
      });
  }

  for (const e of EVENTS) {
    await db
      .insert(schema.events)
      .values({ ...e, endDate: e.endDate ?? null })
      .onConflictDoUpdate({
        target: schema.events.id,
        set: {
          title: e.title,
          type: e.type,
          status: e.status,
          startDate: e.startDate,
          endDate: e.endDate ?? null,
          city: e.city,
          venue: e.venue,
          capacity: e.capacity,
          registered: e.registered,
          fee: e.fee,
          events: e.events,
          description: e.description,
        },
      });
  }

  for (const n of NEWS) {
    await db
      .insert(schema.news)
      .values(n)
      .onConflictDoUpdate({
        target: schema.news.id,
        set: {
          title: n.title,
          date: n.date,
          category: n.category,
          excerpt: n.excerpt,
          body: n.body,
        },
      });
  }

  for (const i of INSTRUCTORS) {
    await db
      .insert(schema.instructors)
      .values(i)
      .onConflictDoUpdate({
        target: schema.instructors.id,
        set: {
          name: i.name,
          title: i.title,
          city: i.city,
          specialty: i.specialty,
          studentsTaught: i.studentsTaught,
          yearsTeaching: i.yearsTeaching,
          bestRecord: i.bestRecord,
          bio: i.bio,
        },
      });
  }

  const now = Math.floor(Date.now() / 1000);

  const TEST_USERS: Array<{
    id: string;
    phone: string;
    nickname: string;
  }> = [
    { id: "u_test_1", phone: "12345678901", nickname: "陈思远" },
    { id: "u_test_2", phone: "12345678902", nickname: "林哲" },
    { id: "u_test_3", phone: "12345678903", nickname: "王朗" },
    { id: "u_test_4", phone: "12345678904", nickname: "苏漫" },
    { id: "u_test_5", phone: "12345678905", nickname: "周宇桐" },
  ];

  for (const u of TEST_USERS) {
    await db
      .insert(schema.users)
      .values({
        id: u.id,
        phone: u.phone,
        nickname: u.nickname,
        avatar: null,
        role: "user",
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: schema.users.id,
        set: { nickname: u.nickname, updatedAt: now },
      });
  }

  type SeedPost = {
    id: string;
    authorId: string;
    circleId: CircleId;
    title: string;
    body: string;
    likes: number;
    ageHours: number;
    comments: Array<{ id: string; authorId: string; body: string; ageHours: number }>;
    likedBy: string[];
  };

  const SEED_POSTS: SeedPost[] = [
    {
      id: "p_seed_f2l",
      authorId: "u_test_1",
      circleId: "speed",
      title: "F2L 直觉化训练 4 周打卡总结",
      body: `# 四周下来的几点感受

练 F2L 的第四周,平均从 22 秒降到 16.8 秒。把这段时间踩的坑写一下。

## 三件最有用的事

- 每天先打 50 个 cross + 1st pair 的小练习,只看不还原
- 每个 case 不死记公式,只记 R U R' 几种基本 "插入手法"
- 录像复盘比单纯刷成绩有用十倍

> 直觉化不是不背公式,是把 41 种归纳成 6 个模式。

下周开始进入 OLL 完整训练。`,
      likes: 12,
      ageHours: 2,
      likedBy: ["u_test_2", "u_test_3"],
      comments: [
        {
          id: "cm_seed_1",
          authorId: "u_test_3",
          body: "F2L 直觉化的关键确实是模式归类,你这套节奏挺合理。",
          ageHours: 1,
        },
        {
          id: "cm_seed_2",
          authorId: "u_test_5",
          body: "录像复盘 +1,自己看回放能发现很多盲点。",
          ageHours: 0.5,
        },
      ],
    },
    {
      id: "p_seed_blind",
      authorId: "u_test_2",
      circleId: "blind",
      title: "盲拧记忆宫殿法实战:30 道镜像题分享",
      body: `# 盲拧记忆宫殿法实战

这两周整理了 30 道 **镜像题** 训练记忆速度,记录一下心得。

## 核心思路

1. 把房间里固定 12 个位置当字母对
2. 角块 / 棱块用两种不同的房间
3. 每天 10 道,逐步缩短记忆时长

> 镜像题最大的好处:强迫你检查自己的方向感。

[这里](/courses/blind-cube) 是配套课程入口。`,
      likes: 9,
      ageHours: 6,
      likedBy: ["u_test_1"],
      comments: [
        {
          id: "cm_seed_3",
          authorId: "u_test_4",
          body: "宫殿法对零基础不太友好,但熟悉之后效率确实高。",
          ageHours: 4,
        },
      ],
    },
    {
      id: "p_seed_race",
      authorId: "u_test_5",
      circleId: "speed",
      title: "WCA 赛前 4 周的心率与呼吸训练",
      body: `# WCA 赛前 4 周的心率管理

比赛和平时练习最大的差别是 **心率会冲到 130+**,手会抖。

## 我在做的事

- 每天 5 分钟 4-7-8 呼吸法
- 模拟赛环境(计时器 + 围观)
- 用智能手表记录 5 把成绩对应的心率峰值

> 心率管理对成绩的影响,不亚于公式熟练度。

下周会发一篇正式的训练日记。`,
      likes: 16,
      ageHours: 12,
      likedBy: ["u_test_1", "u_test_2", "u_test_3", "u_test_4"],
      comments: [
        {
          id: "cm_seed_4",
          authorId: "u_test_1",
          body: "4-7-8 呼吸法亲测有效,赛前 2 分钟做一组很顶。",
          ageHours: 8,
        },
        {
          id: "cm_seed_5",
          authorId: "u_test_2",
          body: "想知道你用的是哪款手表,数据可靠吗?",
          ageHours: 6,
        },
      ],
    },
    {
      id: "p_seed_kids",
      authorId: "u_test_4",
      circleId: "newbie",
      title: "8 岁少儿启蒙阶段最容易卡的 3 个坎",
      body: `# 少儿启蒙最容易卡的 3 个坎

带过 200+ 个小朋友之后,发现 8 岁阶段几乎都会卡在同样三个点。

## 三个坎

1. **中层棱块** 的方向感
2. **顶面十字** 的颜色辨识
3. **角块归位** 时手位混乱

> 启蒙阶段不追求速度,先把 "我能还原" 的成就感建立起来。

如果你家孩子卡在其中一个,欢迎在评论里贴录像,我会给具体建议。`,
      likes: 7,
      ageHours: 24,
      likedBy: ["u_test_1"],
      comments: [
        {
          id: "cm_seed_6",
          authorId: "u_test_5",
          body: "中层棱块那段太对了,家长很容易直接代劳,反而越教越糊。",
          ageHours: 20,
        },
      ],
    },
    {
      id: "p_seed_zbll",
      authorId: "u_test_3",
      circleId: "speed",
      title: "ZBLL U / T 套手法对照:60 套精修",
      body: `# ZBLL U / T 套手法对照

把 U / T 两套总共 60 套的手法整理了一份对照表,这里挑几个有代表性的。

## 选手法的几个原则

- 同向手法优先,减少 regrip
- 拒绝任何 D 层动作
- 同一套 case 留 2 个备选

> 公式不是越短越好,**手感顺** 才是关键。

完整表格我整理在 Notion 里,有需要可以评论留言。`,
      likes: 11,
      ageHours: 48,
      likedBy: ["u_test_1", "u_test_5"],
      comments: [
        {
          id: "cm_seed_7",
          authorId: "u_test_1",
          body: "想要完整对照,平时识别速度跟不上选 case。",
          ageHours: 40,
        },
        {
          id: "cm_seed_8",
          authorId: "u_test_2",
          body: "+1,手感顺这点很真,短公式经常 regrip 反而慢。",
          ageHours: 36,
        },
      ],
    },
  ];

  for (const p of SEED_POSTS) {
    const createdAt = now - Math.floor(p.ageHours * 3600);
    await db
      .insert(schema.posts)
      .values({
        id: p.id,
        authorId: p.authorId,
        circleId: p.circleId,
        title: p.title,
        body: p.body,
        likes: p.likes,
        createdAt,
      })
      .onConflictDoUpdate({
        target: schema.posts.id,
        set: {
          title: p.title,
          body: p.body,
          likes: p.likes,
          circleId: p.circleId,
        },
      });

    await db.delete(schema.comments).where(eq(schema.comments.postId, p.id));
    for (const c of p.comments) {
      await db.insert(schema.comments).values({
        id: c.id,
        postId: p.id,
        authorId: c.authorId,
        body: c.body,
        createdAt: now - Math.floor(c.ageHours * 3600),
      });
    }

    await db.delete(schema.postLikes).where(eq(schema.postLikes.postId, p.id));
    for (const uid of p.likedBy) {
      await db
        .insert(schema.postLikes)
        .values({ postId: p.id, userId: uid, createdAt });
    }
  }

  console.log("seeded:", DB_PATH);
}

main()
  .then(() => sqlite.close())
  .catch((err) => {
    console.error(err);
    sqlite.close();
    process.exit(1);
  });

import type { Metadata } from "next";
import type { SearchParams } from "nuqs/server";
import { Trophy, Medal } from "lucide-react";
import { Section } from "@/components/Section";
import { LeaderboardTabs } from "@/components/LeaderboardTabs";
import { loadLeaderboardParams } from "@/lib/search-params";
import { getCurrentUser } from "@/lib/auth-user";
import {
  speedBoard,
  studyBoard,
  pointsBoard,
  formatSolveMs,
  type LeaderRow,
} from "@/lib/db/leaderboard";
import { SCRAMBLE_EVENTS } from "@/lib/cube/scramble";
import type { CubeEventId } from "@/db/schema";

export const metadata: Metadata = {
  title: "排行榜 — 魔方开放社群",
  description:
    "速拧榜 / 学习榜 / 积分榜:看谁还原最快、谁学得最勤、谁积分最高。按 7 天 / 30 天 / 总榜切换,速拧榜可按三阶、二阶、单手、盲拧等项目排名。",
};

export const dynamic = "force-dynamic";

// event 参数是自由字符串,进 speedBoard 前先校验是真实项目 id,否则回落三阶。
function safeEvent(raw: string): CubeEventId {
  const hit = SCRAMBLE_EVENTS.find((e) => e.id === raw);
  return (hit?.id ?? "333") as CubeEventId;
}

function eventLabel(id: string): string {
  return SCRAMBLE_EVENTS.find((e) => e.id === id)?.label ?? "三阶 3x3";
}

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { board, period, event } = await loadLeaderboardParams(searchParams);
  const ev = safeEvent(event);
  const me = await getCurrentUser();

  let rows: LeaderRow[] = [];
  let valueHead = "成绩";
  let renderValue: (r: LeaderRow) => string = (r) => String(r.value);

  if (board === "speed") {
    rows = await speedBoard({ event: ev, period, limit: 50 });
    valueHead = "最快单次";
    renderValue = (r) => formatSolveMs(r.value);
  } else if (board === "study") {
    rows = await studyBoard({ period, limit: 50 });
    valueHead = "完成课时";
    renderValue = (r) => `${r.value} 节`;
  } else {
    rows = await pointsBoard({ period, limit: 50 });
    valueHead = "积分";
    renderValue = (r) => `+${r.value}`;
  }

  const subtitle =
    board === "speed"
      ? `当前展示 ${eventLabel(ev)} 的最快有效成绩,至少完成 5 次才进榜,排除 DNF。`
      : board === "study"
        ? "按时间范围内完成的课时数排名,边学边冲榜。"
        : "按时间范围内的积分净增排名,买课、打卡、发帖都算分。";

  return (
    <Section
      eyebrow="社群激励"
      title="排行榜"
      subtitle={subtitle}
    >
      <LeaderboardTabs board={board} period={period} event={ev} />

      {rows.length === 0 ? (
        <div className="rounded-[14px] border border-line bg-white p-12 text-center text-[14px] text-ink-3">
          这个范围还没有上榜的魔友,快去成为第一名。
        </div>
      ) : (
        <ol className="space-y-2">
          {rows.map((r) => {
            const isMe = me?.id === r.userId;
            return (
              <li
                key={r.userId}
                className={
                  "flex items-center gap-3 rounded-[14px] border px-4 py-3 transition sm:gap-4 " +
                  (isMe
                    ? "border-brand/50 bg-brand-soft"
                    : "border-line bg-white hover:border-brand/30")
                }
              >
                <RankBadge rank={r.rank} />
                <Avatar nickname={r.nickname} avatar={r.avatar} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-[15px] font-medium text-ink">
                      {r.nickname}
                    </span>
                    {isMe ? (
                      <span className="shrink-0 rounded-full bg-brand px-2 py-0.5 text-[11px] font-medium text-white">
                        我
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-[16px] font-semibold tabular-nums text-ink sm:text-[18px]">
                    {renderValue(r)}
                  </div>
                  <div className="text-[11px] text-ink-3">{valueHead}</div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </Section>
  );
}

// 前三名金银铜奖牌,其余显示名次数字。
function RankBadge({ rank }: { rank: number }) {
  if (rank <= 3) {
    const tone =
      rank === 1
        ? "text-amber-500"
        : rank === 2
          ? "text-zinc-400"
          : "text-amber-700";
    const Icon = rank === 1 ? Trophy : Medal;
    return (
      <div className="grid h-9 w-9 shrink-0 place-items-center">
        <Icon size={22} className={tone} aria-hidden />
        <span className="sr-only">第 {rank} 名</span>
      </div>
    );
  }
  return (
    <div className="grid h-9 w-9 shrink-0 place-items-center text-[14px] font-semibold tabular-nums text-ink-3">
      {rank}
    </div>
  );
}

function Avatar({
  nickname,
  avatar,
}: {
  nickname: string;
  avatar: string | null;
}) {
  if (avatar) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={avatar}
        alt=""
        className="h-9 w-9 shrink-0 rounded-full object-cover"
      />
    );
  }
  const initial = nickname.trim().charAt(0) || "魔";
  return (
    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-soft text-[15px] font-medium text-brand">
      {initial}
    </div>
  );
}

"use client";

import { useTransition } from "react";
import { useQueryStates } from "nuqs";
import {
  leaderboardParams,
  serializeLeaderboardParams,
  LEADERBOARD_BOARDS,
  LEADERBOARD_PERIODS,
  type LeaderboardBoard,
  type LeaderboardPeriod,
} from "@/lib/search-params";
import { SCRAMBLE_EVENTS } from "@/lib/cube/scramble";
import type { CubeEventId } from "@/db/schema";

const BOARD_LABEL: Record<LeaderboardBoard, string> = {
  speed: "速拧榜",
  study: "学习榜",
  points: "积分榜",
};

const PERIOD_LABEL: Record<LeaderboardPeriod, string> = {
  week: "近 7 天",
  month: "近 30 天",
  all: "总榜",
};

// URL 是唯一真源:nuqs 实时切(shallow:false 重跑 RSC),同时每个项都是真 <a>,
// 中键 / Ctrl 点能新开标签页。href 走 serializeLeaderboardParams 拼,和服务端解析同源。
export function LeaderboardTabs({
  board,
  period,
  event,
}: {
  board: LeaderboardBoard;
  period: LeaderboardPeriod;
  event: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [, setParams] = useQueryStates(leaderboardParams, {
    shallow: false,
    startTransition,
  });

  function hrefFor(next: {
    board?: LeaderboardBoard;
    period?: LeaderboardPeriod;
    event?: string;
  }): string {
    return serializeLeaderboardParams("/leaderboard", {
      board: next.board ?? board,
      period: next.period ?? period,
      event: next.event ?? event,
    });
  }

  const pillBase =
    "inline-flex items-center rounded-full px-3.5 py-1.5 text-[13px] font-medium transition";
  const pillOn = "bg-brand text-white";
  const pillOff = "text-ink-2 hover:bg-bg-soft hover:text-ink";

  return (
    <div
      className={`mb-8 flex flex-col gap-4 ${isPending ? "opacity-70" : ""}`}
      aria-busy={isPending}
    >
      {/* 榜单类型 */}
      <div className="flex flex-wrap items-center gap-2">
        {LEADERBOARD_BOARDS.map((b) => (
          <a
            key={b}
            href={hrefFor({ board: b })}
            aria-current={b === board ? "true" : undefined}
            onClick={(e) => {
              if (e.metaKey || e.ctrlKey || e.button !== 0) return;
              e.preventDefault();
              setParams({ board: b });
            }}
            className={`${pillBase} ${b === board ? pillOn : pillOff}`}
          >
            {BOARD_LABEL[b]}
          </a>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-4">
        {/* 时间范围 */}
        <div className="flex flex-wrap items-center gap-1.5">
          {LEADERBOARD_PERIODS.map((p) => (
            <a
              key={p}
              href={hrefFor({ period: p })}
              aria-current={p === period ? "true" : undefined}
              onClick={(e) => {
                if (e.metaKey || e.ctrlKey || e.button !== 0) return;
                e.preventDefault();
                setParams({ period: p });
              }}
              className={
                "inline-flex items-center rounded-md border px-3 py-1.5 text-[13px] transition " +
                (p === period
                  ? "border-brand/40 bg-brand-soft text-brand"
                  : "border-line text-ink-2 hover:border-brand/30 hover:text-ink")
              }
            >
              {PERIOD_LABEL[p]}
            </a>
          ))}
        </div>

        {/* 仅速拧榜显示项目下拉(三阶 / 二阶 / 单手 / 盲拧...) */}
        {board === "speed" ? (
          <label className="inline-flex items-center gap-2 text-[13px] text-ink-3">
            项目
            <select
              value={event}
              onChange={(e) =>
                setParams({ event: e.target.value as CubeEventId })
              }
              className="rounded-md border border-line bg-white px-2.5 py-1.5 text-[13px] text-ink outline-none focus:border-brand/60"
            >
              {SCRAMBLE_EVENTS.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>
    </div>
  );
}

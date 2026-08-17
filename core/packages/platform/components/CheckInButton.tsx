"use client";

import { useState, useTransition } from "react";
import { Flame, Check } from "lucide-react";
import { checkInAction } from "@/app/actions/checkin";

type Props = {
  // 服务端算好的初始态:今天是否已签到 + 当前连续天数
  checkedToday: boolean;
  current: number;
};

// 学习打卡按钮:今天未签到时可点(调 server action 幂等签到),
// 已签到显示「已连续 N 天」。乐观更新,失败回退。
export function CheckInButton({ checkedToday, current }: Props) {
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(checkedToday);
  const [streak, setStreak] = useState(current);

  if (done) {
    return (
      <div className="inline-flex items-center gap-2 rounded-md bg-brand-soft px-5 py-2.5 text-[14px] font-medium text-brand-dark">
        <Check size={16} />
        今日已打卡
        <span className="text-ink-3 font-normal">·</span>
        <span>已连续 {streak} 天</span>
      </div>
    );
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        // 乐观:立即显示已打卡 + 连续天数 +1
        const prevStreak = streak;
        setDone(true);
        setStreak((n) => n + 1);
        startTransition(async () => {
          try {
            await checkInAction("study");
          } catch {
            // 失败回退
            setDone(false);
            setStreak(prevStreak);
          }
        });
      }}
      className="inline-flex items-center gap-2 rounded-md bg-brand px-5 py-2.5 text-[14px] font-medium text-white transition hover:bg-brand-dark disabled:opacity-60"
    >
      <Flame size={16} />
      {pending ? "打卡中…" : "今日打卡"}
    </button>
  );
}

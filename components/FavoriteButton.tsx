"use client";

import { usePathname } from "next/navigation";
import { useOptimistic, useTransition } from "react";
import { Heart } from "lucide-react";
import { toggleFavoriteAction } from "@/app/actions/favorites";
import type { FavoriteTarget } from "@/db/schema";

type Props = {
  targetType: FavoriteTarget;
  targetId: string;
  initial: boolean;
  loggedIn: boolean;
  /** 回跳 / revalidate 路径,不传则用当前 pathname */
  next?: string;
};

/**
 * 心形收藏按钮。
 * 已登录:form 提交 server action,点击乐观切换实心/描边。
 * 未登录:渲染成链到 /login?next=... 的链接(真 <a>,中键可新开)。
 */
export function FavoriteButton({
  targetType,
  targetId,
  initial,
  loggedIn,
  next,
}: Props) {
  const pathname = usePathname();
  const back = next || pathname || "/";

  if (!loggedIn) {
    return (
      <a
        href={`/login?next=${encodeURIComponent(back)}`}
        className="inline-flex items-center gap-1.5 rounded-md border border-line bg-white px-4 py-2 text-[13px] text-ink-2 transition hover:border-brand/40 hover:text-brand"
      >
        <Heart size={14} />
        收藏
      </a>
    );
  }

  return (
    <FavoriteForm
      targetType={targetType}
      targetId={targetId}
      initial={initial}
      next={back}
    />
  );
}

function FavoriteForm({
  targetType,
  targetId,
  initial,
  next,
}: {
  targetType: FavoriteTarget;
  targetId: string;
  initial: boolean;
  next: string;
}) {
  const [, startTransition] = useTransition();
  const [favorited, setOptimistic] = useOptimistic(initial);

  return (
    <form
      action={(fd) => {
        setOptimistic(!favorited);
        startTransition(() => toggleFavoriteAction(fd));
      }}
    >
      <input type="hidden" name="targetType" value={targetType} />
      <input type="hidden" name="targetId" value={targetId} />
      <input type="hidden" name="next" value={next} />
      <button
        type="submit"
        aria-pressed={favorited}
        className={
          "inline-flex items-center gap-1.5 rounded-md border px-4 py-2 text-[13px] transition " +
          (favorited
            ? "border-brand bg-brand-soft text-brand-dark"
            : "border-line bg-white text-ink-2 hover:border-brand/40 hover:text-brand")
        }
      >
        <Heart size={14} className={favorited ? "fill-current" : ""} />
        {favorited ? "已收藏" : "收藏"}
      </button>
    </form>
  );
}

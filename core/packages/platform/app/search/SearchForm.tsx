"use client";

import { Search } from "lucide-react";
import { useTransition } from "react";
import { parseAsString, useQueryState } from "nuqs";

export function SearchPageForm() {
  const [isPending, startTransition] = useTransition();
  // URL `?q=` 即状态:边打字边出结果(shallow:false 重跑 RSC,300ms 节流)。
  const [q, setQ] = useQueryState(
    "q",
    parseAsString
      .withDefault("")
      .withOptions({ shallow: false, throttleMs: 300, startTransition }),
  );

  return (
    <form
      onSubmit={(e) => e.preventDefault()}
      className="flex items-center gap-2 rounded-[14px] border border-line bg-white pl-4 pr-2 py-2 focus-within:border-brand/60"
    >
      <Search
        size={16}
        className={`shrink-0 ${isPending ? "text-brand animate-pulse" : "text-ink-3"}`}
      />
      <input
        type="search"
        autoFocus
        value={q}
        onChange={(e) => setQ(e.target.value || null)}
        placeholder="搜索课程 商品 赛事 资讯 帖子"
        className="flex-1 bg-transparent text-[15px] text-ink placeholder:text-ink-3 outline-none"
      />
    </form>
  );
}

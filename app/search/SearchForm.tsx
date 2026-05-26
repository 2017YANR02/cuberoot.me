"use client";

import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function SearchPageForm({ defaultValue }: { defaultValue: string }) {
  const router = useRouter();
  const [value, setValue] = useState(defaultValue);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const q = value.trim();
    if (!q) {
      router.push("/search");
      return;
    }
    router.push(`/search?q=${encodeURIComponent(q)}`);
  }

  return (
    <form
      onSubmit={onSubmit}
      className="flex items-center gap-2 rounded-[14px] border border-line bg-white pl-4 pr-2 py-2 focus-within:border-brand/60"
    >
      <Search size={16} className="text-ink-3 shrink-0" />
      <input
        type="search"
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="搜索课程 商品 赛事 资讯 帖子"
        className="flex-1 bg-transparent text-[15px] text-ink placeholder:text-ink-3 outline-none"
      />
      <button
        type="submit"
        className="rounded-md bg-brand px-4 py-1.5 text-[14px] text-white hover:bg-brand-dark transition"
      >
        搜索
      </button>
    </form>
  );
}

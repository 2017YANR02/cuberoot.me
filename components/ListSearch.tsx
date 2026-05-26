"use client";

import { Search, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

type Props = {
  basePath: string;
  placeholder?: string;
};

export function ListSearch({ basePath, placeholder = "搜索..." }: Props) {
  const router = useRouter();
  const sp = useSearchParams();
  const initial = sp?.get("q") ?? "";
  const [value, setValue] = useState(initial);

  function submit(next: string) {
    const usp = new URLSearchParams();
    const trimmed = next.trim();
    if (trimmed) usp.set("q", trimmed);
    const qs = usp.toString();
    router.push(qs ? `${basePath}?${qs}` : basePath);
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    submit(value);
  }

  function clear() {
    setValue("");
    submit("");
  }

  return (
    <form
      onSubmit={onSubmit}
      className="mb-8 flex w-full max-w-md items-center gap-2 rounded-[14px] border border-line bg-white pl-3 pr-1.5 py-1.5 focus-within:border-brand/60"
    >
      <Search size={15} className="text-ink-3 shrink-0" />
      <input
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className="flex-1 bg-transparent text-[14px] text-ink placeholder:text-ink-3 outline-none"
        autoComplete="off"
      />
      {value ? (
        <button
          type="button"
          aria-label="清空"
          onClick={clear}
          className="grid h-7 w-7 place-items-center rounded-md text-ink-3 hover:bg-bg-soft hover:text-ink"
        >
          <X size={14} />
        </button>
      ) : null}
      <button
        type="submit"
        className="rounded-md bg-brand px-3 py-1.5 text-[13px] text-white hover:bg-brand-dark transition"
      >
        搜索
      </button>
    </form>
  );
}

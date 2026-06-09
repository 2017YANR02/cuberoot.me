"use client";

import { Search, X } from "lucide-react";
import { useTransition } from "react";
import { parseAsInteger, parseAsString, useQueryStates } from "nuqs";

type Props = {
  placeholder?: string;
};

export function ListSearch({ placeholder = "搜索..." }: Props) {
  const [isPending, startTransition] = useTransition();
  // URL is the single source of truth: `q` drives the server query, and a new
  // search resets `page` back to 1. shallow:false re-runs the RSC so results
  // update live; throttle keeps typing from hammering the server每个键.
  const [{ q }, setParams] = useQueryStates(
    {
      q: parseAsString.withDefault(""),
      page: parseAsInteger,
    },
    { shallow: false, throttleMs: 350, startTransition },
  );

  function setQuery(next: string) {
    setParams({ q: next || null, page: null });
  }

  return (
    <form
      onSubmit={(e) => e.preventDefault()}
      className="mb-8 flex w-full max-w-md items-center gap-2 rounded-[14px] border border-line bg-white pl-3 pr-1.5 py-1.5 focus-within:border-brand/60"
    >
      <Search
        size={15}
        className={`shrink-0 ${isPending ? "text-brand animate-pulse" : "text-ink-3"}`}
      />
      <input
        type="search"
        value={q}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        className="flex-1 bg-transparent text-[14px] text-ink placeholder:text-ink-3 outline-none"
        autoComplete="off"
      />
      {q ? (
        <button
          type="button"
          aria-label="清空"
          onClick={() => setQuery("")}
          className="grid h-7 w-7 place-items-center rounded-md text-ink-3 hover:bg-bg-soft hover:text-ink"
        >
          <X size={14} />
        </button>
      ) : null}
    </form>
  );
}

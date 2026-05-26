"use client";

import { Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type Variant = "desktop" | "mobile";

export function HeaderSearch({
  variant = "desktop",
  onSubmit,
}: {
  variant?: Variant;
  onSubmit?: () => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(variant === "mobile");
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (variant !== "desktop") return;
    if (!open) return;
    inputRef.current?.focus();
    function onDown(e: MouseEvent) {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, variant]);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const q = value.trim();
    if (!q) return;
    router.push(`/search?q=${encodeURIComponent(q)}`);
    setValue("");
    if (variant === "desktop") setOpen(false);
    onSubmit?.();
  }

  if (variant === "mobile") {
    return (
      <form
        onSubmit={submit}
        className="mt-3 flex items-center gap-2 rounded-md border border-line bg-white pl-3 pr-1 py-1.5 focus-within:border-brand/60"
      >
        <Search size={15} className="text-ink-3 shrink-0" />
        <input
          type="search"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="搜索课程 商品 赛事..."
          className="flex-1 bg-transparent text-[14px] text-ink placeholder:text-ink-3 outline-none"
        />
        <button
          type="submit"
          className="rounded-md bg-brand px-3 py-1 text-[13px] text-white hover:bg-brand-dark transition"
        >
          搜索
        </button>
      </form>
    );
  }

  return (
    <div ref={wrapRef} className="relative">
      {!open ? (
        <button
          type="button"
          aria-label="搜索"
          onClick={() => setOpen(true)}
          className="grid h-9 w-9 place-items-center rounded-md text-ink-2 hover:bg-bg-soft hover:text-ink transition"
        >
          <Search size={16} />
        </button>
      ) : (
        <form
          onSubmit={submit}
          className="flex items-center gap-1.5 rounded-md border border-line bg-white pl-2.5 pr-1 py-1 w-72 focus-within:border-brand/60"
        >
          <Search size={14} className="text-ink-3 shrink-0" />
          <input
            ref={inputRef}
            type="search"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="搜索课程 商品 赛事 资讯 帖子"
            className="flex-1 bg-transparent text-[14px] text-ink placeholder:text-ink-3 outline-none"
          />
          <button
            type="button"
            aria-label="关闭"
            onClick={() => {
              setOpen(false);
              setValue("");
            }}
            className="grid h-6 w-6 place-items-center rounded text-ink-3 hover:bg-bg-soft hover:text-ink"
          >
            <X size={13} />
          </button>
        </form>
      )}
    </div>
  );
}

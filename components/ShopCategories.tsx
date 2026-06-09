"use client";

import { useTransition } from "react";
import {
  parseAsInteger,
  parseAsString,
  parseAsStringLiteral,
  useQueryStates,
} from "nuqs";
import { PRODUCT_CATEGORIES } from "@/lib/search-params";

const CHIPS = ["全部", ...PRODUCT_CATEGORIES] as const;

export function ShopCategories() {
  const [isPending, startTransition] = useTransition();
  const [{ q, category }, setParams] = useQueryStates(
    {
      q: parseAsString.withDefault(""),
      category: parseAsStringLiteral(PRODUCT_CATEGORIES),
      page: parseAsInteger,
    },
    { shallow: false, startTransition },
  );

  // 搜索态分类不参与过滤(走 FTS 跨全部),高亮回「全部」
  const active = q ? "全部" : (category ?? "全部");

  function pick(label: (typeof CHIPS)[number]) {
    // 选分类即进入浏览态:清掉搜索词、回到第 1 页
    setParams({ category: label === "全部" ? null : label, q: null, page: null });
  }

  return (
    <div className="flex flex-wrap gap-2 mb-8" aria-busy={isPending}>
      {CHIPS.map((label) => {
        const on = label === active;
        return (
          <button
            key={label}
            type="button"
            onClick={() => pick(label)}
            aria-pressed={on}
            className={
              "rounded-full px-3 py-1.5 text-[13px] border transition " +
              (on
                ? "border-brand bg-brand-soft text-brand-dark"
                : "border-line text-ink-2 bg-white hover:border-brand/40")
            }
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

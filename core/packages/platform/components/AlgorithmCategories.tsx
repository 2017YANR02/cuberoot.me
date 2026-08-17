"use client";

import { useTransition } from "react";
import { parseAsString, useQueryStates } from "nuqs";

/**
 * 算法字典类目筛选 Tab。真链接由 page.tsx 用 serializeAlgorithmListParams 渲染(中键可新开);
 * 这里叠一层 nuqs 客户端交互,点选即实时重跑 RSC(shallow:false),不整页刷新。
 */
export function AlgorithmCategories({ categories }: { categories: string[] }) {
  const [isPending, startTransition] = useTransition();
  const [{ category }, setParams] = useQueryStates(
    { category: parseAsString, q: parseAsString },
    { shallow: false, startTransition },
  );

  const active = category ?? "全部";
  const chips = ["全部", ...categories];

  function pick(label: string) {
    // 选类目即进入浏览态:清掉搜索词
    setParams({ category: label === "全部" ? null : label, q: null });
  }

  return (
    <div className="flex flex-wrap gap-2 mb-8" aria-busy={isPending}>
      {chips.map((label) => {
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

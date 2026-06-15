"use client";

import { useTransition } from "react";
import { parseAsString, useQueryStates } from "nuqs";

/**
 * 讲师列表的专长标签筛选条。专长是讲师自填的自由文案,可选项由服务端从
 * 现有讲师数据汇总后传入(不是固定枚举),「全部」= 清掉 specialty 参数。
 */
export function InstructorSpecialties({ options }: { options: string[] }) {
  const [isPending, startTransition] = useTransition();
  const [{ specialty }, setParams] = useQueryStates(
    { specialty: parseAsString },
    { shallow: false, startTransition },
  );

  const active = specialty ?? "全部";
  const chips = ["全部", ...options];

  function pick(label: string) {
    setParams({ specialty: label === "全部" ? null : label });
  }

  if (options.length === 0) return null;

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

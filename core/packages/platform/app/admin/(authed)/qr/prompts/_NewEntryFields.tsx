"use client";

import { useState } from "react";
import { Field, Input, Select } from "../../../_components/Form";
import { PROMPT_DIMENSIONS } from "@/lib/qr/prompt";

// 新增表单的「维度 + 分组」联动:改维度即时提示新增后归入哪,选了维度就收起无用的「分组」。
export function NewEntryFields() {
  const [dim, setDim] = useState("");
  const label = PROMPT_DIMENSIONS.find((d) => d.key === dim)?.label;
  return (
    <>
      <Field
        label="维度"
        hint={
          dim
            ? `新增后归入「组合积木 · ${label}」(组合器里的一块)`
            : "新增后归入「整套模板」(完整一套风格)"
        }
      >
        <Select name="dimension" value={dim} onChange={(e) => setDim(e.target.value)}>
          <option value="">整套预设模板</option>
          {PROMPT_DIMENSIONS.map((d) => (
            <option key={d.key} value={d.key}>
              {d.label}
            </option>
          ))}
        </Select>
      </Field>
      {dim === "" ? (
        <Field label="分组(可选)" hint="整套模板的分组,如 大片 / 插画">
          <Input name="category" placeholder="通用" />
        </Field>
      ) : (
        <div className="flex items-center rounded-md border border-dashed border-line bg-bg-soft/50 px-3 text-[12px] text-ink-3">
          维度积木不用填分组,直接写下面的描述正文。
        </div>
      )}
    </>
  );
}

"use client";

import { useState, useTransition } from "react";
import { submitApplication, type ApplyResult } from "./actions";

const DIRECTIONS = [
  "入门 / 启蒙",
  "CFOP 系统",
  "ZBLL / 高阶",
  "盲拧 / 多盲",
  "异形",
  "WCA 赛前",
  "少儿",
];

const FORMATS = ["录播系统课", "线上直播", "一对一私教", "线下家教"];

type Status =
  | { kind: "idle" }
  | { kind: "error"; msg: string }
  | { kind: "ok"; id: string };

export function ApplyForm() {
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [pending, startTransition] = useTransition();
  const [direction, setDirection] = useState<string[]>([]);
  const [formats, setFormats] = useState<string[]>([]);

  function toggle(list: string[], set: (v: string[]) => void, v: string) {
    set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;
    const form = e.currentTarget;
    const f = new FormData(form);
    f.set("direction", direction.join(","));
    f.set("formats", formats.join(","));
    startTransition(async () => {
      const res: ApplyResult = await submitApplication(f);
      if (res.ok) {
        setStatus({ kind: "ok", id: res.id });
        form.reset();
        setDirection([]);
        setFormats([]);
      } else {
        setStatus({ kind: "error", msg: res.error });
      }
    });
  }

  if (status.kind === "ok") {
    return (
      <div className="rounded-[14px] border border-line bg-white p-8 text-center">
        <div className="text-[18px] font-semibold text-emerald-700">已收到你的申请</div>
        <div className="mt-2 text-[13px] text-ink-3">
          申请编号 <span className="font-mono text-ink">{status.id}</span>
        </div>
        <p className="mt-4 text-[14px] text-ink-2 leading-6">
          我们的运营会在 3 个工作日内通过手机与你联系。
        </p>
        <button
          type="button"
          onClick={() => setStatus({ kind: "idle" })}
          className="mt-6 rounded-md border border-line bg-white px-4 py-2 text-[13px] text-ink-2 hover:text-ink hover:border-brand/40 transition"
        >
          再提交一份
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-[14px] border border-line bg-white p-6 space-y-4"
    >
      <Field label="姓名 / 昵称" name="name" placeholder="请输入你的姓名或常用昵称" />
      <Field label="手机号" name="phone" type="tel" maxLength={11} placeholder="11 位手机号" />
      <Field label="所在城市" name="city" placeholder="如 上海 · 静安区" />
      <Field label="WCA ID（如有）" name="wcaId" placeholder="例如 2018ABCD01" required={false} />

      <CheckboxGroup
        label="希望授课方向"
        options={DIRECTIONS}
        value={direction}
        onChange={(v) => toggle(direction, setDirection, v)}
      />

      <CheckboxGroup
        label="希望授课形式"
        options={FORMATS}
        value={formats}
        onChange={(v) => toggle(formats, setFormats, v)}
      />

      <FieldTextarea
        label="个人简介"
        name="bio"
        placeholder="请简单介绍你的魔方背景、教学经验和 PB 成绩等(至少 10 字)"
      />

      {status.kind === "error" ? (
        <div className="text-[13px] text-red-600">{status.msg}</div>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-brand text-white py-2.5 text-[14px] font-medium hover:bg-brand-dark transition disabled:opacity-50"
      >
        {pending ? "提交中…" : "提交申请"}
      </button>
      <p className="text-[12px] text-ink-3 leading-5">
        点击提交即视为同意平台《讲师合作条款》。
      </p>
    </form>
  );
}

function Field({
  label,
  name,
  placeholder,
  type = "text",
  required = true,
  maxLength,
}: {
  label: string;
  name: string;
  placeholder: string;
  type?: string;
  required?: boolean;
  maxLength?: number;
}) {
  return (
    <label className="block">
      <span className="block text-[13px] font-medium text-ink mb-1.5">{label}</span>
      <input
        type={type}
        name={name}
        required={required}
        maxLength={maxLength}
        placeholder={placeholder}
        className="w-full rounded-md border border-line bg-white px-3 py-2 text-[14px] text-ink placeholder:text-ink-3 outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
      />
    </label>
  );
}

function FieldTextarea({
  label,
  name,
  placeholder,
}: {
  label: string;
  name: string;
  placeholder: string;
}) {
  return (
    <label className="block">
      <span className="block text-[13px] font-medium text-ink mb-1.5">{label}</span>
      <textarea
        name={name}
        rows={4}
        required
        placeholder={placeholder}
        className="w-full rounded-md border border-line bg-white px-3 py-2 text-[14px] text-ink placeholder:text-ink-3 outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
      />
    </label>
  );
}

function CheckboxGroup({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: string[];
  value: string[];
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <span className="block text-[13px] font-medium text-ink mb-1.5">{label}</span>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const checked = value.includes(o);
          return (
            <button
              type="button"
              key={o}
              onClick={() => onChange(o)}
              className={
                "rounded-md border px-3 py-1.5 text-[13px] transition " +
                (checked
                  ? "border-brand bg-brand-soft text-brand-dark"
                  : "border-line bg-white text-ink-2 hover:border-brand/40")
              }
            >
              {o}
            </button>
          );
        })}
      </div>
    </div>
  );
}

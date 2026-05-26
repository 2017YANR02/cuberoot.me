"use client";

import type { ReactNode } from "react";

export function DeleteButton({
  id,
  action,
  label = "删除",
  confirm = "确定删除?此操作不可撤销。",
}: {
  id: string;
  action: (formData: FormData) => Promise<void>;
  label?: ReactNode;
  confirm?: string;
}) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!window.confirm(confirm)) e.preventDefault();
      }}
      className="inline"
    >
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        className="text-[13px] text-red-600 hover:underline"
      >
        {label}
      </button>
    </form>
  );
}

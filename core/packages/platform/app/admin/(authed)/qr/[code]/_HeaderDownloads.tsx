"use client";

import { useEffect, useRef, useState } from "react";
import { Download, ChevronDown, Scissors } from "lucide-react";

// 折叠卡下载按钮:点击先提交表单保存(server action 重定向重载),
// 重载后读 sessionStorage 自动触发下载已存版本(dl=1 走 attachment,下文件不离开页面)。
const KEY = "qrPendingDownload";

function downloadUrl(code: string, variant: "card" | "nocrop") {
  return variant === "nocrop"
    ? `/api/qr/${code}/card?crop=0&dl=1`
    : `/api/qr/${code}/card?dl=1`;
}

export function HeaderDownloads({ code, formId }: { code: string; formId: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const v = sessionStorage.getItem(KEY);
    if (v !== "card" && v !== "nocrop") return;
    sessionStorage.removeItem(KEY);
    window.location.assign(downloadUrl(code, v));
  }, [code]);

  // 点外部关闭
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const saveThenDownload =
    (variant: "card" | "nocrop") => (e: React.MouseEvent) => {
      e.preventDefault();
      setOpen(false);
      sessionStorage.setItem(KEY, variant);
      const form = document.getElementById(formId) as HTMLFormElement | null;
      if (form) form.requestSubmit();
      else window.location.assign(downloadUrl(code, variant));
    };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-md border border-line bg-white px-3 py-2 text-[13px] text-ink-2 hover:border-brand/40 hover:text-brand transition"
      >
        <Download size={14} />
        折叠卡
        <ChevronDown size={13} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 min-w-[9rem] rounded-md border border-line bg-white shadow-md py-1 text-[13px]">
          <a
            href={`/api/qr/${code}/card`}
            onClick={saveThenDownload("card")}
            title="含 3mm 出血 + 四角裁切线,直接交印厂"
            className="flex items-center gap-2 px-3 py-2 text-ink-2 hover:bg-brand/5 hover:text-brand transition"
          >
            <Scissors size={13} /> 带裁切线
          </a>
          <a
            href={`/api/qr/${code}/card?crop=0`}
            onClick={saveThenDownload("nocrop")}
            title="无裁切线干净版,适合截图 / 预览 / 嵌入展示"
            className="flex items-center gap-2 px-3 py-2 text-ink-2 hover:bg-brand/5 hover:text-brand transition"
          >
            <Download size={13} /> 不带裁切线
          </a>
        </div>
      )}
    </div>
  );
}

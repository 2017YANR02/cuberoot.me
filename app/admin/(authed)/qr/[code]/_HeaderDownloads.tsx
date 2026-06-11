"use client";

import { useEffect } from "react";
import { Scissors, Download } from "lucide-react";

// 折叠卡下载按钮:点击先提交表单保存(server action 重定向重载),
// 重载后读 sessionStorage 自动触发下载已存版本(dl=1 走 attachment,下文件不离开页面)。
// 这样下载的永远是当前编辑后的最新卡面,不会下到旧数据。
const BTN =
  "inline-flex items-center justify-center gap-1.5 rounded-md border border-line bg-white px-3 py-2 text-[13px] text-ink-2 hover:border-brand/40 hover:text-brand transition";

const KEY = "qrPendingDownload";

function downloadUrl(code: string, variant: "card" | "nocrop") {
  return variant === "nocrop"
    ? `/api/qr/${code}/card?crop=0&dl=1`
    : `/api/qr/${code}/card?dl=1`;
}

export function HeaderDownloads({ code, formId }: { code: string; formId: string }) {
  // 保存重载后:若有挂起下载,触发它(code 用重载后的当前值,改过 code 也对)
  useEffect(() => {
    const v = sessionStorage.getItem(KEY);
    if (v !== "card" && v !== "nocrop") return;
    sessionStorage.removeItem(KEY);
    window.location.assign(downloadUrl(code, v));
  }, [code]);

  const saveThenDownload =
    (variant: "card" | "nocrop") => (e: React.MouseEvent) => {
      e.preventDefault();
      sessionStorage.setItem(KEY, variant);
      const form = document.getElementById(formId) as HTMLFormElement | null;
      if (form) form.requestSubmit();
      else window.location.assign(downloadUrl(code, variant)); // 兜底:无表单直接下
    };

  return (
    <>
      <a
        href={`/api/qr/${code}/card`}
        onClick={saveThenDownload("card")}
        title="先保存当前改动,再下载整张折叠卡印刷母版:含 3mm 出血 + 四角裁切线,直接交印厂"
        className={BTN}
      >
        <Scissors size={14} /> 下载折叠卡(带裁切线)
      </a>
      <a
        href={`/api/qr/${code}/card?crop=0`}
        onClick={saveThenDownload("nocrop")}
        title="先保存当前改动,再下载无裁切线干净版,适合截图 / 预览 / 嵌入展示"
        className={BTN}
      >
        <Download size={14} /> 不带裁切线
      </a>
    </>
  );
}

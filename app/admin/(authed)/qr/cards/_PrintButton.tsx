"use client";

import { Download, Printer } from "lucide-react";
import { useState } from "react";

// 浏览器原生打印当前网页:由页面的 @media print CSS 把 --s 设回 1(精确 mm)、
// 隐藏 .no-print 控件,只留卡片网格,A4 多卡平铺。走系统打印对话框。
export function BrowserPrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex items-center gap-1.5 rounded-md border border-line bg-white px-3 py-1.5 text-[13px] text-ink-2 hover:text-ink hover:border-brand/40 transition"
    >
      <Printer size={14} /> 打印
    </button>
  );
}

// 下载折叠卡的矢量印刷母版 SVG(含出血 + 裁切线),而非打印当前网页。
// 多张时逐个抓 blob 触发下载;idx 透传给接口控制正面艺术图轮换。
export function PrintButton({ codes }: { codes: string[] }) {
  const [busy, setBusy] = useState(false);

  async function download() {
    if (busy || codes.length === 0) return;
    setBusy(true);
    try {
      for (let i = 0; i < codes.length; i++) {
        const code = codes[i];
        const res = await fetch(`/api/qr/${code}/card?idx=${i}`);
        if (!res.ok) continue;
        const blob = await res.blob();
        const href = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = href;
        a.download = `card-${code}.svg`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(href);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={download}
      disabled={busy}
      className="inline-flex items-center gap-1.5 rounded-md bg-brand px-4 py-2 text-[13px] font-medium text-white hover:bg-brand-dark transition disabled:opacity-60"
    >
      <Download size={14} /> {busy ? "下载中…" : `下载 SVG (${codes.length})`}
    </button>
  );
}

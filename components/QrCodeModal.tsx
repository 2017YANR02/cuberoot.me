"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { X } from "lucide-react";

type Props = {
  orderId: string;
  codeUrl: string;
  providerLabel: string;
  closeHref: string;
};

export function QrCodeModal({
  orderId,
  codeUrl,
  providerLabel,
  closeHref,
}: Props) {
  const router = useRouter();
  const [dataUrl, setDataUrl] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [polling, setPolling] = useState<boolean>(true);
  const aborted = useRef<boolean>(false);

  useEffect(() => {
    let mounted = true;
    QRCode.toDataURL(codeUrl, { width: 480, margin: 1 })
      .then((url) => {
        if (mounted) setDataUrl(url);
      })
      .catch((e: unknown) => {
        if (mounted) setError(String(e));
      });
    return () => {
      mounted = false;
    };
  }, [codeUrl]);

  useEffect(() => {
    aborted.current = false;
    const tick = async () => {
      if (aborted.current) return;
      try {
        const res = await fetch(`/api/orders/${orderId}/status`, {
          cache: "no-store",
        });
        if (res.ok) {
          const data = (await res.json()) as { status?: string };
          if (data.status === "paid") {
            setPolling(false);
            router.replace(`/orders/${orderId}`);
            router.refresh();
            return;
          }
          if (data.status === "cancelled") {
            setPolling(false);
            router.replace(`/orders/${orderId}`);
            router.refresh();
            return;
          }
        }
      } catch {
        // 忽略单次失败
      }
    };
    const id = window.setInterval(tick, 3000);
    return () => {
      aborted.current = true;
      window.clearInterval(id);
    };
  }, [orderId, router]);

  const close = () => {
    router.replace(closeHref);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
      role="dialog"
      aria-modal="true"
      onClick={close}
    >
      <div
        className="w-full max-w-[360px] rounded-[14px] bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <div className="text-[15px] font-semibold text-ink">
              {providerLabel}
            </div>
            <div className="mt-1 text-[12px] text-ink-3">
              打开 {providerLabel} App 扫码完成支付
            </div>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="关闭"
            className="rounded-md p-1 text-ink-3 hover:bg-bg-soft hover:text-ink transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 flex items-center justify-center rounded-[14px] border border-line bg-white p-3">
          {dataUrl ? (
            <img
              src={dataUrl}
              alt="支付二维码"
              className="block h-auto w-full max-w-[240px]"
            />
          ) : error ? (
            <div className="py-12 text-[12px] text-red-600">
              二维码生成失败:{error}
            </div>
          ) : (
            <div className="py-12 text-[12px] text-ink-3">生成二维码中…</div>
          )}
        </div>

        <div className="mt-4 flex items-center justify-center gap-2 text-[12px] text-ink-3">
          <span
            className={`inline-block h-1.5 w-1.5 rounded-full ${polling ? "bg-emerald-500 animate-pulse" : "bg-ink-3"}`}
          />
          {polling ? "等待支付结果中,自动检测…" : "已停止检测"}
        </div>

        <button
          type="button"
          onClick={close}
          className="mt-4 w-full rounded-md border border-line bg-white py-2 text-[13px] text-ink-2 hover:text-ink hover:border-brand/40 transition"
        >
          取消支付
        </button>
      </div>
    </div>
  );
}

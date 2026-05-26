"use client";

import { useEffect } from "react";

// Root error boundary. Catches render errors anywhere under the app tree.
// We send a beacon to /api/track to record the failure server-side without
// pulling server-only modules into this client file.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    const payload = {
      name: "render_error",
      url: typeof location !== "undefined" ? location.pathname + location.search : null,
      payload: {
        message: error.message,
        digest: error.digest ?? null,
        stack: error.stack?.slice(0, 4000) ?? null,
      },
    };
    try {
      const body = JSON.stringify(payload);
      const blob = new Blob([body], { type: "application/json" });
      if (typeof navigator !== "undefined" && navigator.sendBeacon) {
        navigator.sendBeacon("/api/track", blob);
      } else {
        void fetch("/api/track", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body,
          keepalive: true,
        });
      }
    } catch {
      // ignore reporting failures
    }
  }, [error]);

  return (
    <html lang="zh-CN">
      <body className="min-h-[100vh] flex items-center justify-center bg-bg-soft px-6">
        <div className="max-w-md w-full rounded-[14px] border border-line bg-white p-8 text-center">
          <h1 className="text-[18px] font-semibold text-ink">页面出错了</h1>
          <p className="mt-2 text-[13px] text-ink-3 break-words">
            {error.message || "未知错误"}
          </p>
          <button
            type="button"
            onClick={() => reset()}
            className="mt-6 inline-flex items-center rounded-md bg-brand text-white px-4 py-2 text-[13px] font-medium hover:bg-brand-dark transition"
          >
            重试
          </button>
        </div>
      </body>
    </html>
  );
}

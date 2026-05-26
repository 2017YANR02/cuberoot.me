import Link from "next/link";
import { WifiOff, Home } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "离线",
  description: "当前网络不可用",
  robots: { index: false, follow: false },
};

export default function OfflinePage() {
  return (
    <div className="container-page py-20 flex flex-col items-center text-center">
      <div className="grid h-14 w-14 place-items-center rounded-full bg-brand-soft text-brand-dark">
        <WifiOff size={26} />
      </div>
      <h1 className="mt-6 text-[22px] font-semibold text-ink">当前网络不可用</h1>
      <p className="mt-2 max-w-md text-[14px] text-ink-3">
        部分页面无法访问。已经访问过的页面在恢复网络前仍可查看。请检查 Wi-Fi 或移动数据后重试。
      </p>
      <div className="mt-8 flex gap-3">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 rounded-md bg-brand px-4 py-2 text-[14px] text-white hover:bg-brand-dark transition"
        >
          <Home size={14} />
          返回首页
        </Link>
      </div>
    </div>
  );
}

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "管理后台 — 魔方开放社群",
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <div className="bg-bg-soft min-h-[80vh]">{children}</div>;
}

import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Sparkles } from "lucide-react";
import { findByCode, incrementScans } from "@/lib/db/qr";
import { TrackOnce } from "@/components/TrackOnce";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "扫码落地",
  robots: { index: false, follow: false },
};

export default async function QrLandingPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ stay?: string }>;
}) {
  const { code: rawCode } = await params;
  const code = String(rawCode ?? "").trim().toLowerCase().slice(0, 64);
  if (!code) redirect("/");
  const sp = await searchParams;
  const entry = await findByCode(code);

  if (entry) {
    await incrementScans(entry.code);
    if (entry.target && entry.target !== "/" && sp.stay !== "1") {
      const safe =
        entry.target.startsWith("/") && !entry.target.startsWith("//")
          ? entry.target
          : "/";
      redirect(safe);
    }
  }

  const label = entry?.label ?? "欢迎";

  return (
    <section className="container-page py-16 max-w-xl">
      <TrackOnce
        name="qr_landing"
        dedupeKey={code}
        payload={{ code, found: !!entry, label }}
      />
      <div className="rounded-[14px] border border-line bg-white p-8 text-center">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-brand-soft text-brand">
          <Sparkles size={20} />
        </div>
        <h1 className="mt-5 text-[24px] font-semibold text-ink">扫码成功</h1>
        <p className="mt-3 text-[14px] leading-7 text-ink-3">
          {entry
            ? `欢迎来自 ${entry.label} 的朋友,这里是魔方开放社群,集课程 / 商城 / 赛事 / 社群于一体。`
            : "欢迎来到魔方开放社群,集课程 / 商城 / 赛事 / 社群于一体。"}
        </p>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-md bg-brand px-5 py-2.5 text-[14px] font-medium text-white hover:bg-brand-dark transition"
          >
            立即体验
            <ArrowRight size={14} />
          </Link>
          <Link
            href="/community"
            className="inline-flex items-center gap-1.5 rounded-md border border-line bg-white px-5 py-2.5 text-[14px] text-ink-2 hover:border-brand hover:text-brand transition"
          >
            进入社群
          </Link>
        </div>
        <div className="mt-6 text-[12px] text-ink-3 font-mono">
          code: {code}
        </div>
      </div>
    </section>
  );
}

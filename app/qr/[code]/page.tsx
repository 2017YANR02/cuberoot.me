import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, ArrowUpRight, Sparkles } from "lucide-react";
import { findByCode, incrementScans, type QrLink } from "@/lib/db/qr";
import { recordEvent } from "@/lib/db/track";
import { TrackOnce } from "@/components/TrackOnce";
import { loadQrLandingParams } from "@/lib/search-params";
import type { SearchParams } from "nuqs/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "扫码落地",
  robots: { index: false, follow: false },
};

function safeInternal(t: string): string {
  return t.startsWith("/") && !t.startsWith("//") ? t : "/";
}

const DEFAULT_LINKS: QrLink[] = [
  { label: "立即体验", href: "/" },
  { label: "进入社群", href: "/community" },
];

export default async function QrLandingPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { code: rawCode } = await params;
  const code = String(rawCode ?? "").trim().toLowerCase().slice(0, 64);
  if (!code) redirect("/");
  const { stay } = await loadQrLandingParams(searchParams);
  const entry = await findByCode(code);

  if (entry) {
    await incrementScans(entry.code);
    const anonId = (await cookies()).get("cube_anon")?.value ?? null;
    await recordEvent({
      name: "qr_scan",
      payload: { code: entry.code, type: entry.type, label: entry.label },
      anonId,
      url: `/qr/${entry.code}`,
    });
    if (
      entry.type !== "landing" &&
      entry.target &&
      entry.target !== "/" &&
      stay !== "1"
    ) {
      redirect(safeInternal(entry.target));
    }
  }

  const term = entry?.term?.trim();
  const title =
    entry?.title?.trim() ||
    (entry ? `欢迎来自 ${entry.label} 的朋友` : "欢迎来到魔方开放社群");
  const intro =
    entry?.intro?.trim() ||
    "这里是魔方开放社群,集课程 / 商城 / 赛事 / 社群于一体。";
  const links =
    entry?.links && entry.links.length > 0 ? entry.links : DEFAULT_LINKS;

  return (
    <section className="container-page py-16 max-w-md">
      <TrackOnce
        name="qr_landing"
        dedupeKey={code}
        payload={{ code, found: !!entry, label: entry?.label ?? "" }}
      />
      <div className="rounded-[14px] border border-line bg-white p-8">
        <div className="flex items-center justify-center gap-2">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-brand-soft text-brand">
            <Sparkles size={18} />
          </span>
          {term ? (
            <span className="rounded-full bg-brand-soft px-2.5 py-1 text-[12px] font-medium text-brand">
              {term}
            </span>
          ) : null}
        </div>
        <h1 className="mt-5 text-center text-[22px] font-semibold text-ink">
          {title}
        </h1>
        <p className="mt-3 text-center text-[14px] leading-7 text-ink-3">
          {intro}
        </p>

        <div className="mt-7 flex flex-col gap-2.5">
          {links.map((l, i) => {
            const external = /^https?:\/\//i.test(l.href);
            const primary = i === 0;
            const cls = primary
              ? "bg-brand text-white hover:bg-brand-dark"
              : "border border-line bg-white text-ink-2 hover:border-brand/40 hover:text-brand";
            const Icon = external ? ArrowUpRight : ArrowRight;
            const inner = (
              <>
                <span className="flex flex-col items-start">
                  <span className="text-[14px] font-medium leading-5">
                    {l.label}
                  </span>
                  {l.note ? (
                    <span
                      className={
                        "text-[12px] leading-4 " +
                        (primary ? "text-white/80" : "text-ink-3")
                      }
                    >
                      {l.note}
                    </span>
                  ) : null}
                </span>
                <Icon size={16} className="shrink-0" />
              </>
            );
            const common =
              "flex items-center justify-between gap-3 rounded-md px-4 py-3 transition " +
              cls;
            return external ? (
              <a
                key={i}
                href={l.href}
                target="_blank"
                rel="noopener noreferrer"
                className={common}
              >
                {inner}
              </a>
            ) : (
              <Link key={i} href={safeInternal(l.href)} className={common}>
                {inner}
              </Link>
            );
          })}
        </div>

        <div className="mt-6 text-center text-[12px] text-ink-3 font-mono">
          code: {code}
        </div>
      </div>
    </section>
  );
}

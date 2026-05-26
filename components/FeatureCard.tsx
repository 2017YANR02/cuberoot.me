import type { LucideIcon } from "lucide-react";
import Link from "next/link";

type Props = {
  icon: LucideIcon;
  title: string;
  description: string;
  href?: string;
  tone?: "default" | "brand";
};

export function FeatureCard({ icon: Icon, title, description, href, tone = "default" }: Props) {
  const card = (
    <div
      className={
        "group h-full rounded-[14px] border p-6 transition " +
        (tone === "brand"
          ? "bg-brand text-white border-brand"
          : "bg-white border-line hover:border-brand/40 hover:shadow-[0_8px_28px_-12px_rgba(42,93,244,0.18)]")
      }
    >
      <div
        className={
          "mb-4 inline-flex h-10 w-10 items-center justify-center rounded-md " +
          (tone === "brand" ? "bg-white/15" : "bg-brand-soft text-brand")
        }
      >
        <Icon size={20} />
      </div>
      <div className={"text-[16px] font-semibold mb-2 " + (tone === "brand" ? "text-white" : "text-ink")}>
        {title}
      </div>
      <p className={"text-[14px] leading-6 " + (tone === "brand" ? "text-white/85" : "text-ink-3")}>
        {description}
      </p>
    </div>
  );

  return href ? <Link href={href} className="block h-full">{card}</Link> : card;
}

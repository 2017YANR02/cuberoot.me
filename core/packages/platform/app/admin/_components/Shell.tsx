import Link from "next/link";
import type { ReactNode } from "react";

// 数据表单元格抽到 components/DataTable,admin / instructor 共用;这里 re-export 保持旧 import 路径
export { Th, Td } from "@/components/DataTable";

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
      <div>
        <h1 className="text-[22px] font-semibold text-ink">{title}</h1>
        {subtitle ? <p className="mt-1 text-[13px] text-ink-3">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex gap-2">{actions}</div> : null}
    </div>
  );
}

export function PrimaryLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center justify-center rounded-md bg-brand text-white px-4 py-2 text-[13px] font-medium hover:bg-brand-dark transition"
    >
      {children}
    </Link>
  );
}

export function GhostLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center justify-center rounded-md border border-line bg-white px-3 py-1.5 text-[13px] text-ink-2 hover:text-ink hover:border-brand/40 transition"
    >
      {children}
    </Link>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={"rounded-[14px] border border-line bg-white " + className}>{children}</div>
  );
}

export function FormPanel({ children }: { children: ReactNode }) {
  return <Card className="p-6 grid gap-4 max-w-3xl">{children}</Card>;
}

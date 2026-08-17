"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function OrgNav({
  orgSlug,
  canReadStudents,
}: {
  orgSlug: string;
  canReadStudents: boolean;
}) {
  const pathname = usePathname();
  const base = `/org/${orgSlug}`;
  const items = [
    { href: base, label: "概览", exact: true },
    ...(canReadStudents ? [{ href: `${base}/students`, label: "学员" }] : []),
    { href: `${base}/members`, label: "成员与角色" },
  ];
  return (
    <nav aria-label="机构工作台" className="flex gap-1 overflow-x-auto pb-1">
      {items.map((item) => {
        const active = item.exact
          ? pathname === item.href
          : pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            prefetch={false}
            aria-current={active ? "page" : undefined}
            className={`whitespace-nowrap rounded-md px-3 py-2 text-[13px] transition ${
              active
                ? "bg-brand-soft text-brand-dark"
                : "text-ink-2 hover:bg-bg-soft hover:text-ink"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

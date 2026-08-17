"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function OrgNav({
  links,
}: {
  links: Array<{ href: string; label: string; exact?: boolean }>;
}) {
  const pathname = usePathname();
  return (
    <nav aria-label="机构工作台" className="flex gap-1 overflow-x-auto pb-1">
      {links.map((item) => {
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

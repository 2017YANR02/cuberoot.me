import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

type Props = {
  page: number;
  totalPages: number;
  basePath: string;
  // Extra query string params to preserve (encoded). E.g. { q: "abc" }
  params?: Record<string, string | undefined>;
};

function buildHref(
  basePath: string,
  page: number,
  params: Record<string, string | undefined>,
): string {
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") usp.set(k, v);
  }
  if (page > 1) usp.set("page", String(page));
  const qs = usp.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

function buildPageList(page: number, totalPages: number): (number | "...")[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const list: (number | "...")[] = [1];
  const left = Math.max(2, page - 1);
  const right = Math.min(totalPages - 1, page + 1);
  if (left > 2) list.push("...");
  for (let i = left; i <= right; i++) list.push(i);
  if (right < totalPages - 1) list.push("...");
  list.push(totalPages);
  return list;
}

export function Pagination({ page, totalPages, basePath, params = {} }: Props) {
  if (totalPages <= 1) return null;
  const pages = buildPageList(page, totalPages);
  const prev = Math.max(1, page - 1);
  const next = Math.min(totalPages, page + 1);

  const baseClass =
    "inline-flex h-9 min-w-9 items-center justify-center rounded-md px-2.5 text-[13px] transition";
  const inactive = "text-ink-2 hover:bg-bg-soft hover:text-ink";
  const active = "bg-brand text-white";
  const disabled = "text-ink-3 opacity-50 pointer-events-none";

  return (
    <nav
      aria-label="分页"
      className="mt-10 flex flex-wrap items-center justify-center gap-1"
    >
      <Link
        href={buildHref(basePath, prev, params)}
        aria-label="上一页"
        className={`${baseClass} ${page <= 1 ? disabled : inactive}`}
      >
        <ChevronLeft size={15} />
      </Link>
      {pages.map((p, i) =>
        p === "..." ? (
          <span
            key={`e-${i}`}
            className="inline-flex h-9 min-w-9 items-center justify-center px-1 text-[13px] text-ink-3"
          >
            …
          </span>
        ) : (
          <Link
            key={p}
            href={buildHref(basePath, p, params)}
            aria-current={p === page ? "page" : undefined}
            className={`${baseClass} ${p === page ? active : inactive}`}
          >
            {p}
          </Link>
        ),
      )}
      <Link
        href={buildHref(basePath, next, params)}
        aria-label="下一页"
        className={`${baseClass} ${page >= totalPages ? disabled : inactive}`}
      >
        <ChevronRight size={15} />
      </Link>
    </nav>
  );
}

import type { ReactNode } from "react";

export function MainSiteToolNotice({
  href,
  linkLabel,
  children,
}: {
  href: string;
  linkLabel: string;
  children: ReactNode;
}) {
  return (
    <div className="grid max-w-2xl gap-5">
      <p className="text-[14px] leading-7 text-ink-2">{children}</p>
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="inline-flex min-h-10 w-fit items-center rounded-md bg-brand px-4 py-2 text-[14px] font-medium text-white transition hover:bg-brand-dark"
      >
        {linkLabel}
      </a>
    </div>
  );
}

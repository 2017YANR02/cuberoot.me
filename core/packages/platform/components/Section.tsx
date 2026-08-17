import type { ReactNode } from "react";

type Props = {
  id?: string;
  eyebrow?: string;
  title?: ReactNode;
  subtitle?: ReactNode;
  align?: "left" | "center";
  tone?: "default" | "soft";
  children: ReactNode;
};

export function Section({ id, eyebrow, title, subtitle, align = "left", tone = "default", children }: Props) {
  return (
    <section
      id={id}
      className={
        "py-16 md:py-20 " + (tone === "soft" ? "bg-bg-soft" : "")
      }
    >
      <div className="container-page">
        {(eyebrow || title || subtitle) && (
          <header className={"mb-10 md:mb-12 " + (align === "center" ? "text-center" : "")}>
            {eyebrow && (
              <div className="text-[13px] font-medium text-brand mb-3 tracking-wide">{eyebrow}</div>
            )}
            {title && (
              <h2 className="text-[26px] md:text-[34px] font-semibold text-ink leading-tight">
                {title}
              </h2>
            )}
            {subtitle && (
              <p className={"mt-3 text-[15px] md:text-[16px] text-ink-3 leading-relaxed " + (align === "center" ? "mx-auto max-w-2xl" : "max-w-2xl")}>
                {subtitle}
              </p>
            )}
          </header>
        )}
        {children}
      </div>
    </section>
  );
}

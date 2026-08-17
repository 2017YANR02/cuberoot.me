import Link from "next/link";
import type { ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-brand text-white hover:bg-brand-dark",
  secondary: "border border-line bg-white text-ink hover:border-brand hover:text-brand",
  ghost: "text-ink-2 hover:text-ink hover:bg-bg-soft",
};

type Props = {
  href: string;
  variant?: Variant;
  size?: "md" | "lg";
  children: ReactNode;
  className?: string;
};

export function Button({ href, variant = "primary", size = "md", children, className = "" }: Props) {
  const sizeCls = size === "lg" ? "px-6 py-3 text-[15px]" : "px-4 py-2 text-[14px]";
  return (
    <Link
      href={href}
      className={
        "inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition " +
        sizeCls + " " + VARIANTS[variant] + " " + className
      }
    >
      {children}
    </Link>
  );
}

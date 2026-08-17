import "server-only";
import Link from "next/link";
import { MDXRemote } from "next-mdx-remote/rsc";
import type { ReactNode } from "react";

const components = {
  h1: (props: { children?: ReactNode }) => (
    <h1 className="mt-8 mb-4 text-[24px] md:text-[28px] font-semibold text-ink leading-tight">
      {props.children}
    </h1>
  ),
  h2: (props: { children?: ReactNode }) => (
    <h2 className="mt-8 mb-3 text-[20px] md:text-[22px] font-semibold text-ink leading-tight">
      {props.children}
    </h2>
  ),
  h3: (props: { children?: ReactNode }) => (
    <h3 className="mt-6 mb-2 text-[17px] font-semibold text-ink">
      {props.children}
    </h3>
  ),
  p: (props: { children?: ReactNode }) => (
    <p className="my-4 text-[15px] leading-7 text-ink-2">{props.children}</p>
  ),
  ul: (props: { children?: ReactNode }) => (
    <ul className="my-4 list-disc pl-6 space-y-1.5 text-[15px] leading-7 text-ink-2 marker:text-brand">
      {props.children}
    </ul>
  ),
  ol: (props: { children?: ReactNode }) => (
    <ol className="my-4 list-decimal pl-6 space-y-1.5 text-[15px] leading-7 text-ink-2 marker:text-ink-3">
      {props.children}
    </ol>
  ),
  li: (props: { children?: ReactNode }) => <li>{props.children}</li>,
  blockquote: (props: { children?: ReactNode }) => (
    <blockquote className="my-5 border-l-2 border-brand bg-brand-tint px-4 py-2 text-[14px] leading-7 text-ink-2 rounded-r-md">
      {props.children}
    </blockquote>
  ),
  strong: (props: { children?: ReactNode }) => (
    <strong className="font-semibold text-ink">{props.children}</strong>
  ),
  em: (props: { children?: ReactNode }) => (
    <em className="italic text-ink-2">{props.children}</em>
  ),
  hr: () => <hr className="my-8 border-line" />,
  code: (props: { children?: ReactNode }) => (
    <code className="rounded bg-bg-soft px-1.5 py-0.5 text-[13px] font-mono text-brand-dark">
      {props.children}
    </code>
  ),
  pre: (props: { children?: ReactNode }) => (
    <pre className="my-5 overflow-x-auto rounded-md border border-line bg-bg-soft p-4 text-[13px] leading-6 font-mono text-ink-2">
      {props.children}
    </pre>
  ),
  a: (props: { href?: string; children?: ReactNode }) => {
    const href = props.href ?? "#";
    const external = /^https?:\/\//i.test(href);
    if (external) {
      return (
        <a
          href={href}
          target="_blank"
          rel="noreferrer noopener"
          className="text-brand underline underline-offset-2 hover:text-brand-dark"
        >
          {props.children}
        </a>
      );
    }
    return (
      <Link
        href={href}
        className="text-brand underline underline-offset-2 hover:text-brand-dark"
      >
        {props.children}
      </Link>
    );
  },
};

export function Markdown({ source }: { source: string }) {
  return (
    <div className="max-w-none">
      <MDXRemote source={source} components={components} />
    </div>
  );
}

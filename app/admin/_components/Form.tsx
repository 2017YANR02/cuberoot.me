import type { ReactNode } from "react";

export function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block" htmlFor={htmlFor}>
      <span className="block text-[13px] text-ink-2 mb-1.5">{label}</span>
      {children}
      {hint ? <span className="block text-[12px] text-ink-3 mt-1">{hint}</span> : null}
    </label>
  );
}

const inputBase =
  "w-full rounded-md border border-line bg-white px-3 py-2 text-[14px] outline-none focus:border-brand transition";

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={inputBase + " " + (props.className ?? "")} />;
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={
        inputBase + " min-h-[100px] font-mono text-[13px] " + (props.className ?? "")
      }
    />
  );
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={inputBase + " " + (props.className ?? "")} />;
}

export function FormActions({ children }: { children: ReactNode }) {
  return <div className="mt-6 flex flex-wrap gap-3">{children}</div>;
}

export function Submit({ children = "保存" }: { children?: ReactNode }) {
  return (
    <button
      type="submit"
      className="rounded-md bg-brand text-white px-5 py-2 text-[14px] font-medium hover:bg-brand-dark transition"
    >
      {children}
    </button>
  );
}

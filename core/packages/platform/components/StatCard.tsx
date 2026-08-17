import type { LucideIcon } from "lucide-react";

type Props = {
  icon: LucideIcon;
  label: string;
  value: string;
  hint?: string;
};

export function StatCard({ icon: Icon, label, value, hint }: Props) {
  return (
    <div className="rounded-[14px] border border-line bg-white p-6">
      <div className="flex items-center gap-2 text-[13px] text-ink-3 mb-4">
        <Icon size={16} className="text-brand" />
        <span>{label}</span>
      </div>
      <div className="text-[34px] md:text-[40px] font-semibold text-brand leading-none">{value}</div>
      {hint && <div className="mt-3 text-[13px] leading-5 text-ink-3">{hint}</div>}
    </div>
  );
}

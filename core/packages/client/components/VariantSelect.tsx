'use client';

// 打乱「方法 / 阶段」下拉:首页 RecentScrambles 与 /scramble/stats 共用同一个组件,
// 保证选项标签 + 渲染完全一致。纯展示:选项数组 + onChange 由各页自己算(块折叠 /
// 阶段联动等逻辑各页保留);label 默认 variantLabel(方法),阶段下拉传 stageLabel。
import { variantLabel } from '@/lib/scramble-variants';

export function VariantSelect({ value, options, groups, onChange, isZh, className, ariaLabel, label = variantLabel }: {
  value: string;
  /** 平铺选项。传了 groups 时忽略本项。 */
  options?: readonly string[];
  /** 分组选项(<optgroup>):选项分属不同语义轴时用,免得读者以为一长串是并列的。 */
  groups?: readonly { label: string; options: readonly string[] }[];
  onChange: (v: string) => void;
  isZh: boolean;
  className?: string;
  ariaLabel?: string;
  /** 选项 key → 显示名;默认 variantLabel(方法下拉),阶段下拉传 stageLabel。 */
  label?: (key: string, isZh: boolean) => string;
}) {
  return (
    <select className={className} value={value} onChange={(e) => onChange(e.target.value)} aria-label={ariaLabel}>
      {groups
        ? groups.map((g) => (
          <optgroup key={g.label} label={g.label}>
            {g.options.map((v) => <option key={v} value={v}>{label(v, isZh)}</option>)}
          </optgroup>
        ))
        : (options ?? []).map((v) => (
          <option key={v} value={v}>{label(v, isZh)}</option>
        ))}
    </select>
  );
}

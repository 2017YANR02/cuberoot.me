// 全站统一的表头排序指示箭头。单一来源,禁各页再用 ChevronUp/ChevronDown(^ 形)或
// ChevronsUpDown 自造排序指示。约定:
//   - 默认仅在「当前排序列」显示;图标按钮可用 showInactive 展示上下双箭头;
//   - 方向由 dir 决定(asc=↑ / desc=↓),放在表头文字「右侧」;
//   - 与 cuberoot.me/zh/wca/persons 的成绩表(ByEventView)同款观感。
import { ArrowUp, ArrowDown, ArrowUpDown } from '@app-foundation/icons/lucide';

export function SortArrow({
  active,
  dir,
  size = 12,
  showInactive = false,
}: {
  active: boolean;
  dir: 'asc' | 'desc';
  size?: number;
  showInactive?: boolean;
}) {
  if (!active) return showInactive ? <ArrowUpDown size={size} className="sort-arrow" aria-hidden /> : null;
  return dir === 'asc'
    ? <ArrowUp size={size} className="sort-arrow" aria-hidden />
    : <ArrowDown size={size} className="sort-arrow" aria-hidden />;
}

export default SortArrow;

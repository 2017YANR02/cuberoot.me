// 全站统一的表头排序指示箭头。单一来源,禁各页再用 ChevronUp/ChevronDown(^ 形)或
// ChevronsUpDown 自造排序指示。约定:
//   - 仅在「当前排序列」显示(inactive 列不出箭头,可排序感由列头 hover / 文字色提示);
//   - 方向由 dir 决定(asc=↑ / desc=↓),放在表头文字「右侧」;
//   - 与 cuberoot.me/zh/wca/persons 的成绩表(ByEventView)同款观感。
import { ArrowUp, ArrowDown } from 'lucide-react';

export function SortArrow({
  active,
  dir,
  size = 12,
}: {
  active: boolean;
  dir: 'asc' | 'desc';
  size?: number;
}) {
  if (!active) return null;
  return dir === 'asc'
    ? <ArrowUp size={size} className="sort-arrow" aria-hidden />
    : <ArrowDown size={size} className="sort-arrow" aria-hidden />;
}

export default SortArrow;

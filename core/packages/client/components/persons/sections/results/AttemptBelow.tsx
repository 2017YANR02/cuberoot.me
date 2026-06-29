// 被改那把成绩「下方」叠放块:被划旧值。
// 绝对定位(.wp-att-below,见 persons.css)脱离把数网格流,不撑列宽。旧值本身是干净
// 数字(如 ~~4.43~~),小数点对齐「同列的干净成绩」(如同列 6.72)而非当前带罚时的 base:
// 故只补透明右括号占位(.wp-att-old-pad,与 trimmed 成绩尾部 ) 等宽)。
// 判罚原因不再在此显示(原悬停 ⓘ 已移除)→ 改由 AttemptPopover 点击弹窗展示。
// 仅 AttemptPopover 用,且仅选手页(showOldBelow=true);comp 直播页表格行高紧,传 showOldBelow=false 不渲染本块。

import { tr } from '@/i18n/tr';

export function AttemptBelow({ oldValues, format }: {
  oldValues: number[];
  format: (v: number) => string;
}) {
  if (oldValues.length === 0) return null;
  const oldTitle = tr({ zh: '此前成绩(已变更)', en: 'previous mark (changed)' });
  return (
    <span className="wp-att-below">
      {oldValues.map((ov, k) => (
        <span key={k} className="wp-att-old-line">
          <s className="wp-old-result" title={oldTitle}>{format(ov)}</s>
          {/* 透明占位:补 trimmed 成绩尾部的 ),使干净旧值 4.43 右缘=同列干净成绩
              (如 6.72)右缘 → 小数点对齐;不带底色,所以红框只套在 4.43 上、不被占位撑长。 */}
          <span className="wp-att-old-pad" aria-hidden="true">{')'}</span>
        </span>
      ))}
    </span>
  );
}

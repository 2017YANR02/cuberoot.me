import type { ReactNode } from "react";

// 后台数据表通用表头/单元格(admin + instructor 共用)
// 窄屏:单元格不换行,整表在外层 overflow-x-auto 容器里横向滚动
export function Th({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <th className={"px-4 py-3 text-left font-medium whitespace-nowrap " + className}>
      {children}
    </th>
  );
}

export function Td({
  children,
  className = "",
  colSpan,
}: {
  children: ReactNode;
  className?: string;
  colSpan?: number;
}) {
  return (
    <td className={"px-4 py-3 align-middle whitespace-nowrap " + className} colSpan={colSpan}>
      {children}
    </td>
  );
}

import type { ReactNode } from 'react';

// 平均列一行,按小数点拆成 整数 / 小数 两个网格项(整数右对齐、小数左对齐)→ 小数点落在
// .wp-avg-cell 网格的列分界线上,跨行对齐(见 components/wca-results/attempts-grid.css)。
// /recon/[id] 同场比赛表 与 /wca/persons 详细成绩「平均 STM / 平均 TPS」共用同一份。
// 末位 '.' 切分,兼容 M:SS.dd(按秒的小数点对齐);无小数点(如 FMC 步数)整串进整数格。
// variant='main' 平均成绩(角标内联跟在小数之后);'sub' 平均 STM / TPS(小一号 + 更淡)。
export function AvgDec({ text, badge, variant }: { text: string; badge?: ReactNode; variant: 'main' | 'sub' }) {
  const dot = text.lastIndexOf('.');
  const intPart = dot >= 0 ? text.slice(0, dot) : text;
  const fracPart = dot >= 0 ? text.slice(dot) : '';
  return (
    <span className={`wp-avg-dec wp-avg-dec-${variant}`}>
      <span className="wp-avg-int">{intPart}</span>
      <span className="wp-avg-frac">{fracPart}{badge}</span>
    </span>
  );
}

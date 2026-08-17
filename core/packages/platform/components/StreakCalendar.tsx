// GitHub 风学习打卡热力图:纯 div 网格,无第三方依赖。
// 列 = 周(周日起),行 = 周一..周日;有签到的格子按蓝色 token 着色。
// 移动端 <480px 横向滚动(外层 overflow-x-auto)。
// 接收 dates:string[](YYYY-MM-DD,已签到日期),纯展示、无状态。

type Props = {
  dates: string[];
  weeks?: number; // 展示多少周,默认 17(约 4 个月,移动端友好)
};

const WEEKDAY_LABELS = ["周一", "", "周三", "", "周五", "", "周日"];
const MONTH_LABELS = [
  "1月", "2月", "3月", "4月", "5月", "6月",
  "7月", "8月", "9月", "10月", "11月", "12月",
];

function localToday(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// 纯算术按天偏移,绕开时区解析。
function shift(dateStr: string, deltaDays: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const t = Date.UTC(y, m - 1, d) + deltaDays * 86400_000;
  const nd = new Date(t);
  const yy = nd.getUTCFullYear();
  const mm = String(nd.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(nd.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

// 该日期是星期几(0=周日 .. 6=周六),纯算术。
function weekdayOf(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function StreakCalendar({ dates, weeks = 17 }: Props) {
  const set = new Set(dates);
  const today = localToday();

  // 网格最后一列含今天;把起点对齐到「本周周日」往前推 (weeks-1) 周。
  const todayWeekday = weekdayOf(today); // 0=周日
  const lastSunday = shift(today, -todayWeekday); // 本周周日(网格最后一列首格)
  const gridStart = shift(lastSunday, -(weeks - 1) * 7);

  // 逐列(周)逐行(周日..周六)排格子。
  type Cell = { date: string; future: boolean; checked: boolean };
  const columns: Cell[][] = [];
  for (let w = 0; w < weeks; w++) {
    const col: Cell[] = [];
    for (let dow = 0; dow < 7; dow++) {
      const date = shift(gridStart, w * 7 + dow);
      col.push({
        date,
        future: date > today,
        checked: set.has(date),
      });
    }
    columns.push(col);
  }

  // 顶部月份标签:每列首格(周日)若是该月第一次出现,就在该列上方标月份。
  const monthLabels: { col: number; label: string }[] = [];
  let lastMonth = -1;
  for (let w = 0; w < weeks; w++) {
    const firstCell = columns[w][0];
    const month = Number(firstCell.date.split("-")[1]) - 1;
    if (month !== lastMonth) {
      monthLabels.push({ col: w, label: MONTH_LABELS[month] });
      lastMonth = month;
    }
  }

  const CELL = 13; // 格子边长(px)
  const GAP = 3; // 间距(px)
  const LABEL_W = 28; // 左侧周标签宽

  return (
    <div className="overflow-x-auto">
      <div
        className="inline-block"
        style={{ paddingLeft: LABEL_W }}
        role="img"
        aria-label="学习打卡热力图"
      >
        {/* 月份标签行 */}
        <div className="relative h-4" style={{ marginLeft: 0 }}>
          {monthLabels.map(({ col, label }) => (
            <span
              key={`${col}-${label}`}
              className="absolute text-[10px] text-ink-3"
              style={{ left: col * (CELL + GAP) }}
            >
              {label}
            </span>
          ))}
        </div>

        <div className="flex" style={{ gap: GAP }}>
          {/* 左侧周几标签(绝对覆盖到 paddingLeft 区) */}
          <div
            className="flex flex-col"
            style={{ gap: GAP, marginLeft: -LABEL_W, width: LABEL_W }}
          >
            {/* 网格按 周日..周六 排;标签按习惯显示 周一/三/五/日,空格占位对齐 */}
            {[0, 1, 2, 3, 4, 5, 6].map((dow) => {
              // dow: 0=周日.. 这里映射成 周一..周日 的标签数组索引
              const labelIdx = dow === 0 ? 6 : dow - 1;
              return (
                <span
                  key={dow}
                  className="text-[10px] text-ink-3 leading-none flex items-center justify-end pr-1"
                  style={{ height: CELL }}
                >
                  {WEEKDAY_LABELS[labelIdx]}
                </span>
              );
            })}
          </div>

          {/* 周列 */}
          {columns.map((col, w) => (
            <div key={w} className="flex flex-col" style={{ gap: GAP }}>
              {col.map((cell) => {
                const isToday = cell.date === today;
                const bg = cell.future
                  ? "transparent"
                  : cell.checked
                    ? "var(--color-brand)"
                    : "var(--color-line-soft)";
                return (
                  <div
                    key={cell.date}
                    title={
                      cell.future
                        ? cell.date
                        : `${cell.date} ${cell.checked ? "已打卡" : "未打卡"}`
                    }
                    style={{
                      width: CELL,
                      height: CELL,
                      borderRadius: 3,
                      background: bg,
                      boxShadow: isToday
                        ? "0 0 0 1.5px var(--color-brand)"
                        : undefined,
                      opacity: cell.future ? 0.35 : 1,
                    }}
                  />
                );
              })}
            </div>
          ))}
        </div>

        {/* 图例 */}
        <div className="mt-3 flex items-center gap-1.5 text-[10px] text-ink-3">
          <span>无</span>
          <span
            style={{
              width: CELL,
              height: CELL,
              borderRadius: 3,
              background: "var(--color-line-soft)",
            }}
          />
          <span
            style={{
              width: CELL,
              height: CELL,
              borderRadius: 3,
              background: "var(--color-brand)",
            }}
          />
          <span>已打卡</span>
        </div>
      </div>
    </div>
  );
}

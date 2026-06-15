/**
 * 讲师头像占位:取姓名末字 + 由姓名哈希出的稳定渐变色。
 * 列表卡与讲师主页共用,避免两处各写一份。
 */
type Props = {
  name: string;
  size?: number;
  className?: string;
};

export function InstructorAvatar({ name, size = 48, className = "" }: Props) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  const hue = h % 360;
  return (
    <div
      className={
        "shrink-0 rounded-full grid place-items-center text-white font-semibold " +
        className
      }
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.32),
        background: `linear-gradient(135deg, hsl(${hue} 65% 55%), hsl(${(hue + 30) % 360} 70% 45%))`,
      }}
    >
      {name.slice(-1)}
    </div>
  );
}

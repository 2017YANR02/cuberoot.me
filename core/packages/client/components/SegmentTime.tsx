'use client';

/**
 * 七段计时读数 —— 把时间串里的分钟冒号 `:` 换成 CSS 画的两点冒号。
 * Segment7 字体把 `:` 画成横杠,所以拆掉 `:`,在两段数字之间插一个 `.timer-colon`
 * (样式见 app/globals.css,尺寸用 em 相对当前字号,自动适配 /timer 与训练器)。
 * /timer(SoloView)与 /alg 训练器(TimerDisplay)共用这一份。
 */
export function SegmentTime({ text }: { text: string }) {
  return (
    <>
      {text.split(':').map((part, i) => (
        <span key={i}>
          {i > 0 && <span className="timer-colon" aria-hidden="true" />}
          {part}
        </span>
      ))}
    </>
  );
}

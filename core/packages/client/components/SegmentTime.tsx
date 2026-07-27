'use client';

/**
 * 七段计时读数 —— 把 Segment7 画不出来的两个字符从字体里摘出来单独画。
 *
 *  · 分钟冒号 `:`:Segment7 画成横杠(`1-23.456`)。拆掉 `:`,在两段数字之间插一个
 *    `.timer-colon`(样式见 app/globals.css,尺寸用 em 相对当前字号)。
 *  · +2 罚时的尾巴 `+`:Segment7 根本没这个字形,画出来是个**长得像数字的方块**——
 *    `2.403+` 看上去就是「2.4034」,凭空多一位小数(issue: 计时出现万分位)。
 *    同样摘出来,用站内等宽字体画成上标,一眼是标注而不是位数。
 *
 * /timer(SoloView / NetBattleView)与 /alg 训练器(TimerDisplay)共用这一份。
 */
export function SegmentTime({ text }: { text: string }) {
  const plus = text.endsWith('+');
  const body = plus ? text.slice(0, -1) : text;
  return (
    <>
      {body.split(':').map((part, i) => (
        <span key={i}>
          {i > 0 && <span className="timer-colon" aria-hidden="true" />}
          {part}
        </span>
      ))}
      {plus && <span className="timer-plus2">+</span>}
    </>
  );
}

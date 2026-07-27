/**
 * 千分位分组 —— 全站唯一实现。
 *
 * 收十进制**字符串**而不是 number:本站好几处的计数超过 2^53(整个 3x3 状态空间是
 * 4.3e19),`toLocaleString()` 那条路一律先经过 number,会静默丢精度。BigInt 调用方
 * 自己 `String(n)` 进来。
 */
export function groupDigits(s: string, sep = ','): string {
  return s.replace(/\B(?=(\d{3})+(?!\d))/g, sep);
}

/** Shuang Chen (qq280833822), 2017-11-19, published complete Redi distribution:
 * https://www.speedsolving.com/threads/redi-cube-discussion-and-help.65452/post-1263980
 * 12!/2 × 3^8 = 1,571,364,748,800 states, eight real corner axes with ±120° cost one.
 * The author's 48 symmetries compress the computation; the reported counts retain
 * the full fixed-corner state space and must not be divided by 24 or 48.
 * All bins and cumulative counts checked against the post. The author independently
 * cross-checked depths 0–8 and proposed further checks for deeper states; this import
 * does not claim an independent full-graph proof. No state/solution records are included. */

export const REDI_PUBLISHED_HISTOGRAM = [
  1, 16, 160, 1_408, 11_808, 95_712, 754_732, 5_793_810, 43_183_952,
  310_137_312, 2_115_556_475, 13_329_858_542, 72_848_819_814,
  298_247_080_974, 671_767_938_009, 473_215_625_205, 39_395_024_521,
  84_824_763, 41_254, 332,
] as const;

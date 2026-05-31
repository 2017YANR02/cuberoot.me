//! dist_xxcross_1col_0f: 单色底不固定槽 XXCross 0 步状态数
//!
//! 至少 2 槽 F2L 完成。"at-least-k of n" 公式:
//!   |≥k| = ∑_{j=k..n} (-1)^(j-k) C(j-1, k-1) S_j
//! 对 k=2, n=4: S2 - 2*S3 + 3*S4, 其中 S_j = C(4,j) * W(j)
//!
//! Ground truth: 193,203

use cube_solver::dist::combo::{binom, w_sub};

fn s_k(k: usize) -> u128 {
    binom(4, k) * w_sub(k)
}

fn main() {
    let result: i128 = s_k(2) as i128 - 2 * s_k(3) as i128 + 3 * s_k(4) as i128;
    let result = result as u128;
    println!("Result: {}", result);
    println!("Target: 193203");
    assert_eq!(result, 193203, "mismatch");
}

//! dist_xxxcross_1col_0f: 单色底不固定槽 XXXCross 0 步状态数
//!
//! 至少 3 槽 F2L 完成。at-least-k=3 of n=4:
//!   S3 - 3*S4 = (E3 + 4*E4) - 3*E4 = E3 + E4
//!
//! Ground truth: 597

use cube_solver::dist::combo::{binom, w_sub};

fn s_k(k: usize) -> u128 {
    binom(4, k) * w_sub(k)
}

fn main() {
    let result: i128 = s_k(3) as i128 - 3 * s_k(4) as i128;
    let result = result as u128;
    println!("Result: {}", result);
    println!("Target: 597");
    assert_eq!(result, 597, "mismatch");
}

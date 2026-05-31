//! dist_xcross_1col_0f: 单色底不固定槽 XCross 0 步状态数
//!
//! 子空间: cross (4 棱已固定) + 8 free 棱 + 8 free 角中, 至少 1 槽 F2L 完成
//! Inclusion-Exclusion: |∪ A_i| = ∑_{k=1..4} (-1)^(k-1) C(4,k) W(k)
//!
//! Ground truth: 37,908,599 (= xcross_1_col 完整分布 d=0 行)

use cube_solver::dist::combo::{binom, w_sub};

fn main() {
    let mut signed: i128 = 0;
    for k in 1..=4 {
        let term = (binom(4, k) * w_sub(k)) as i128;
        if k % 2 == 1 { signed += term; } else { signed -= term; }
    }
    let result = signed as u128;
    println!("Result: {}", result);
    println!("Target: 37908599");
    assert_eq!(result, 37908599, "mismatch");
}

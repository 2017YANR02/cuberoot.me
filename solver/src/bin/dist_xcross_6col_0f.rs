//! dist_xcross_6col_0f: 六色底不固定槽 XCross 0 步状态数 (全空间)
//!
//! 24 基本集合 = 6 面 × 4 槽。遍历 2^24 - 1 mask,IEP。
//! 面顺序 = U, L, F, R, B, D (对应 cpp xcross_6_col_0f)

use rayon::prelude::*;

use cube_solver::dist::combo::count_legal_states;

// 每个面 cross 包含的 4 棱索引 (U, L, F, R, B, D)
const CROSS_EDGES: [[u8; 4]; 6] = [
    [4, 7, 6, 5],   // U: UB, UL, UF, UR
    [7, 0, 11, 3],  // L: UL, BL, DL, FL
    [6, 3, 10, 2],  // F: UF, FL, DF, FR
    [5, 2, 9, 1],   // R: UR, FR, DR, BR
    [4, 1, 8, 0],   // B: UB, BR, DB, BL
    [10, 9, 8, 11], // D: DF, DR, DB, DL
];
// 每面 4 槽对应角块
const SLOT_CORNERS: [[u8; 4]; 6] = [
    [0, 1, 2, 3], [0, 3, 7, 4], [3, 2, 6, 7],
    [1, 2, 6, 5], [0, 1, 5, 4], [4, 5, 6, 7],
];
// 每面 4 槽对应 F2L 棱块
const SLOT_EDGES: [[u8; 4]; 6] = [
    [0, 1, 2, 3], [4, 6, 10, 8], [7, 5, 9, 11],
    [4, 6, 10, 8], [7, 5, 9, 11], [0, 1, 2, 3],
];

fn main() {
    let total: i128 = (1u32..(1 << 24))
        .into_par_iter()
        .with_min_len(1 << 14)
        .map(|mask| {
            let mut fixed_e: u16 = 0;
            let mut fixed_c: u8 = 0;
            for f in 0..6usize {
                let f_mask = (mask >> (f * 4)) & 0xF;
                if f_mask == 0 { continue; }
                // cross 棱
                for &e in &CROSS_EDGES[f] { fixed_e |= 1 << e; }
                // 槽
                for s in 0..4 {
                    if (f_mask >> s) & 1 == 1 {
                        fixed_c |= 1 << SLOT_CORNERS[f][s];
                        fixed_e |= 1 << SLOT_EDGES[f][s];
                    }
                }
            }
            let count = count_legal_states(
                fixed_e.count_ones() as usize,
                fixed_c.count_ones() as usize,
            ) as i128;
            if mask.count_ones() % 2 == 1 { count } else { -count }
        })
        .sum();
    println!("Result: {}", total as u128);
}

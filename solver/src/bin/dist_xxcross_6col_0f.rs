//! dist_xxcross_6col_0f: 六色底不固定槽 XXCross 0 步状态数 (全空间)
//!
//! "≥ 2 of 4 slots solved" per face, ∪ 6 faces。2^36 太大,
//! 用 cpp 的 beta-coefficient DFS 展开: 每面只迭代有效 mask (popcount=0 或 ≥2)
//! beta_coeffs[k] = [1, 0, -1, 2, -3]  对应 face 上 popcount(slot mask)=k
//! 公式: Result = -∑_{non-empty} Π beta * count_legal_states

use cube_solver::dist::combo::count_legal_states;

// 面顺序 U, L, F, R, B, D
const CROSS_EDGES: [[u8; 4]; 6] = [
    [4, 7, 6, 5], [7, 0, 11, 3], [6, 3, 10, 2],
    [5, 2, 9, 1], [4, 1, 8, 0], [10, 9, 8, 11],
];
const SLOT_CORNERS: [[u8; 4]; 6] = [
    [0, 1, 2, 3], [0, 3, 7, 4], [3, 2, 6, 7],
    [1, 2, 6, 5], [0, 1, 5, 4], [4, 5, 6, 7],
];
const SLOT_EDGES: [[u8; 4]; 6] = [
    [0, 1, 2, 3], [4, 6, 10, 8], [7, 5, 9, 11],
    [4, 6, 10, 8], [7, 5, 9, 11], [0, 1, 2, 3],
];

const BETA: [i128; 5] = [1, 0, -1, 2, -3];
const VALID_MASKS: [u8; 12] = [0, 3, 5, 6, 9, 10, 12, 7, 11, 13, 14, 15];

fn dfs(face_idx: usize, weight: i128, fixed_e: u16, fixed_c: u8, all_empty: bool, total: &mut i128) {
    if face_idx == 6 {
        if all_empty { return; }
        let count = count_legal_states(
            fixed_e.count_ones() as usize,
            fixed_c.count_ones() as usize,
        ) as i128;
        *total += -weight * count;
        return;
    }
    for &m in &VALID_MASKS {
        let k = m.count_ones() as usize;
        let next_w = weight * BETA[k];
        if next_w == 0 { continue; }
        let mut next_e = fixed_e;
        let mut next_c = fixed_c;
        if m > 0 {
            for &e in &CROSS_EDGES[face_idx] { next_e |= 1 << e; }
            for s in 0..4 {
                if (m >> s) & 1 == 1 {
                    next_c |= 1 << SLOT_CORNERS[face_idx][s];
                    next_e |= 1 << SLOT_EDGES[face_idx][s];
                }
            }
        }
        if next_e.count_ones() > 12 || next_c.count_ones() > 8 { continue; }
        dfs(face_idx + 1, next_w, next_e, next_c, all_empty && m == 0, total);
    }
}

fn main() {
    let mut total: i128 = 0;
    dfs(0, 1, 0, 0, true, &mut total);
    println!("Result: {}", total as u128);
}

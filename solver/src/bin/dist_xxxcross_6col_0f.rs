//! dist_xxxcross_6col_0f: 六色底不固定槽 XXXCross 0 步状态数 (全空间)
//!
//! 24 基本集合 = 6 面 × 4 triplet (每面 "≥3 of 4 slots solved" 拆成 4 个 triplet)
//! Triplets: {0,1,2}=7, {0,1,3}=11, {0,2,3}=13, {1,2,3}=14
//! cpp xxxcross_6_col_0f 用了 D/U/F/B/L/R 面顺序

use rayon::prelude::*;

use cube_solver::dist::combo::count_legal_states;

const CROSS_EDGES: [[u8; 4]; 6] = [
    [8, 9, 10, 11], // D
    [4, 5, 6, 7],   // U
    [6, 2, 10, 3],  // F
    [4, 1, 8, 0],   // B
    [7, 3, 11, 0],  // L
    [5, 2, 9, 1],   // R
];
// SLOT_DEFS[face][slot] = (corner_id, edge_id)
const SLOT_DEFS: [[(u8, u8); 4]; 6] = [
    [(4, 0), (5, 1), (6, 2), (7, 3)],     // D
    [(0, 0), (1, 1), (2, 2), (3, 3)],     // U
    [(3, 7), (2, 5), (6, 9), (7, 11)],    // F
    [(1, 5), (0, 7), (4, 11), (5, 9)],    // B
    [(0, 4), (3, 6), (7, 10), (4, 8)],    // L
    [(1, 4), (2, 6), (6, 10), (5, 8)],    // R
];

const TRIPLET_MASKS: [u8; 4] = [7, 11, 13, 14];

fn main() {
    // 预计算 24 base sets 的 (edge_mask, corner_mask)
    let mut base_e = [0u16; 24];
    let mut base_c = [0u8; 24];
    for f in 0..6usize {
        let mut cross_mask = 0u16;
        for &e in &CROSS_EDGES[f] { cross_mask |= 1 << e; }
        for t in 0..4usize {
            let tm = TRIPLET_MASKS[t];
            let mut e_mask = cross_mask;
            let mut c_mask = 0u8;
            for s in 0..4 {
                if (tm >> s) & 1 == 1 {
                    let (cid, eid) = SLOT_DEFS[f][s];
                    c_mask |= 1 << cid;
                    e_mask |= 1 << eid;
                }
            }
            base_e[f * 4 + t] = e_mask;
            base_c[f * 4 + t] = c_mask;
        }
    }

    let total: i128 = (1u32..(1u32 << 24))
        .into_par_iter()
        .with_min_len(1 << 14)
        .map(|mask| {
            let mut fixed_e: u16 = 0;
            let mut fixed_c: u8 = 0;
            let mut m = mask;
            while m != 0 {
                let bit = m.trailing_zeros() as usize;
                fixed_e |= base_e[bit];
                fixed_c |= base_c[bit];
                m &= m - 1;
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

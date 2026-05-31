//! dist_xxxxcross_6col_0f: 六色底 XXXXCross (= 任一面 F2L 完整还原) 0 步状态数 (全空间)
//!
//! 6 基本集合 = 每面"F2L 全部 4 槽完成"。2^6 - 1 = 63 mask。
//! 每个 base set i 把该面 cross 4 棱 + 4 个 F2L 槽对应 4 棱 + 4 角全固定。

use cube_solver::dist::combo::count_legal_states;

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

fn main() {
    // 预算每面 base set 的 (e, c) mask
    let mut be = [0u16; 6];
    let mut bc = [0u8; 6];
    for f in 0..6usize {
        let mut e = 0u16;
        for &x in &CROSS_EDGES[f] { e |= 1 << x; }
        for s in 0..4 { e |= 1 << SLOT_EDGES[f][s]; bc[f] |= 1 << SLOT_CORNERS[f][s]; }
        be[f] = e;
    }

    let mut total: i128 = 0;
    for mask in 1u32..64 {
        let mut fe: u16 = 0;
        let mut fc: u8 = 0;
        for f in 0..6 {
            if (mask >> f) & 1 == 1 { fe |= be[f]; fc |= bc[f]; }
        }
        let count = count_legal_states(fe.count_ones() as usize, fc.count_ones() as usize) as i128;
        if mask.count_ones() % 2 == 1 { total += count; } else { total -= count; }
    }
    println!("Result: {}", total as u128);
}

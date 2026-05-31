//! dist_xcross_2col_0f: 双色底不固定槽 XCross 0 步状态数 (全空间)
//!
//! 8 个基本集合 = 4 白槽 ∪ 4 黄槽 (全空间 ≈ 4.32e19)
//! 槽位索引 0..3 = BL, BR, FR, FL
//! 容斥: 遍历 1..256 mask, 拆 white_part (bits 0..3) + yellow_part (bits 4..7)
//!
//! Ground truth: 4,716,424,212,835 (cpp 注释)

use cube_solver::dist::combo::count_legal_states;

fn main() {
    let mut total: i128 = 0;
    for mask in 1u32..256 {
        let w = (mask & 0x0F) as u8;
        let y = ((mask >> 4) & 0x0F) as u8;

        let mut fixed_edges = 0usize;
        let mut fixed_corners = 0usize;
        if w > 0 { fixed_edges += 4; }   // 白 cross
        if y > 0 { fixed_edges += 4; }   // 黄 cross
        // F2L 棱 (E 层): 白槽 i 和 黄槽 i 对应同一物理棱, 取并
        fixed_edges += (w | y).count_ones() as usize;
        // F2L 角: 白用 D 层, 黄用 U 层, 不相交
        fixed_corners += w.count_ones() as usize + y.count_ones() as usize;

        let count = count_legal_states(fixed_edges, fixed_corners) as i128;
        if (mask as u32).count_ones() % 2 == 1 {
            total += count;
        } else {
            total -= count;
        }
    }
    let result = total as u128;
    println!("Result: {}", result);
    println!("Target: 4716424212835");
    assert_eq!(result, 4_716_424_212_835u128, "mismatch");
}

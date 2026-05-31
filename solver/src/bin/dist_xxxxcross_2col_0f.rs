//! dist_xxxxcross_2col_0f: 双色底 XXXXCross (= F2L) 0 步状态数 (全空间)
//!
//! 2 集 = 白底 F2L 完成 + 黄底 F2L 完成。全部 8 棱 + 8 角 都固定。
//! 容斥范围 mask ∈ {1, 2, 3}: 单白 / 单黄 / 都完成

use cube_solver::dist::combo::count_legal_states;

fn main() {
    let mut total: i128 = 0;
    for mask in 1u32..4 {
        let w = mask & 1 != 0;
        let y = mask & 2 != 0;
        // 单色 F2L: 该色 cross 4 + F2L 4 = 8 棱, F2L 4 角
        let mut fixed_edges = 0usize;
        let mut fixed_corners = 0usize;
        if w { fixed_edges += 4 + 4; fixed_corners += 4; }   // 白 cross + 白 F2L 棱 + 白 F2L 角
        if y { fixed_edges += 4 + 4; fixed_corners += 4; }
        // 重叠: 白 F2L 棱 (E层) 与 黄 F2L 棱 共享同 4 物理棱
        if w && y { fixed_edges -= 4; }

        let count = count_legal_states(fixed_edges, fixed_corners) as i128;
        if mask.count_ones() % 2 == 1 { total += count; } else { total -= count; }
    }
    println!("Result: {}", total as u128);
}

//! dist_xxcross_2col_0f: 双色底不固定槽 XXCross 0 步状态数 (全空间)
//!
//! 12 集 = 6 白底 F2L 对 + 6 黄底 F2L 对
//! 对组合 (slot pair masks):
//!   {0,1}=0b0011, {1,2}=0b0110, {2,3}=0b1100, {3,0}=0b1001, {0,2}=0b0101, {1,3}=0b1010

use cube_solver::dist::combo::count_legal_states;

const PAIR_MASKS: [u8; 6] = [0b0011, 0b0110, 0b1100, 0b1001, 0b0101, 0b1010];

fn main() {
    let mut total: i128 = 0;
    for mask in 1u32..(1 << 12) {
        let w_pairs = (mask & 0x3F) as u32;
        let y_pairs = ((mask >> 6) & 0x3F) as u32;

        let mut active_w: u8 = 0;
        let mut active_y: u8 = 0;
        for i in 0..6 {
            if (w_pairs >> i) & 1 == 1 { active_w |= PAIR_MASKS[i]; }
            if (y_pairs >> i) & 1 == 1 { active_y |= PAIR_MASKS[i]; }
        }

        let mut fixed_edges = 0usize;
        let mut fixed_corners = 0usize;
        if w_pairs > 0 { fixed_edges += 4; }
        if y_pairs > 0 { fixed_edges += 4; }
        fixed_edges += (active_w | active_y).count_ones() as usize;
        fixed_corners += active_w.count_ones() as usize + active_y.count_ones() as usize;

        let count = count_legal_states(fixed_edges, fixed_corners) as i128;
        if mask.count_ones() % 2 == 1 { total += count; } else { total -= count; }
    }
    println!("Result: {}", total as u128);
}

//! dist_xxxcross_2col_0f: 双色底不固定槽 XXXCross 0 步状态数 (全空间)
//!
//! 8 集 = 4 白 triplet + 4 黄 triplet
//! Triplet masks: {0,1,2}=7, {0,1,3}=11, {0,2,3}=13, {1,2,3}=14

use cube_solver::dist::combo::count_legal_states;

const TRIPLET_MASKS: [u8; 4] = [7, 11, 13, 14];

fn main() {
    let mut total: i128 = 0;
    for mask in 1u32..(1 << 8) {
        let w = (mask & 0x0F) as u32;
        let y = ((mask >> 4) & 0x0F) as u32;

        let mut active_w: u8 = 0;
        let mut active_y: u8 = 0;
        for i in 0..4 {
            if (w >> i) & 1 == 1 { active_w |= TRIPLET_MASKS[i]; }
            if (y >> i) & 1 == 1 { active_y |= TRIPLET_MASKS[i]; }
        }

        let mut fixed_edges = 0usize;
        let mut fixed_corners = 0usize;
        if w > 0 { fixed_edges += 4; }
        if y > 0 { fixed_edges += 4; }
        fixed_edges += (active_w | active_y).count_ones() as usize;
        fixed_corners += active_w.count_ones() as usize + active_y.count_ones() as usize;

        let count = count_legal_states(fixed_edges, fixed_corners) as i128;
        if mask.count_ones() % 2 == 1 { total += count; } else { total -= count; }
    }
    println!("Result: {}", total as u128);
}

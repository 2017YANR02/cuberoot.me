//! dist_cross_2col: 双色底 (白+黄) Cross 深度分布
//!
//! 算法 (cpp cross_2_col.cpp 直译):
//! 1. 各算 W (D 面) / Y (U 面) 单色 cross 的 BFS 分布,按 position-mask 分组
//!    (495 = C(12,4) 个 mask,每个内部 384 = 24·16 个状态)
//! 2. min(d_W, d_Y) 分布通过独立性聚合:对所有不相交 (mw, my) mask 对,
//!    count_ge_k = ge_w[mw][k] · ge_y[my][k];count_at_k = ge[k] - ge[k+1]
//!
//! Ground truth (cpp,0.3s,total = 5,109,350,400):
//!   d=0:53759  d=1:806253  d=2:8484602  d=3:74437062  d=4:506855983
//!   d=5:2031420585  d=6:2311536662  d=7:175751822  d=8:3672

use std::time::Instant;

use cube_solver::cube_common::{array_to_index, state_space};
use cube_solver::dist::bfs::{bfs_byte, N_NEIGHBORS};
use cube_solver::move_tables;

const SZ_CR: usize = state_space::CROSS;
const MAX_D: usize = 9;
const TOTAL_THEORETICAL: u64 = 5_109_350_400;

const GOLDEN: [u64; 9] = [
    53759, 806253, 8484602, 74437062, 506855983,
    2031420585, 2311536662, 175751822, 3672,
];

/// solve_single_cross: BFS 单色 cross,按 mask (4 个棱位的 12-bit popcount=4 mask)
/// 分组成 hist[mid][d] = 该 mask 下深度为 d 的状态数。
///
/// 返回 (hist, mask_to_id, id_to_mask)。mid in [0,495)。
fn solve_single_cross(
    mt_multi: &[i32],
    target_pos: [usize; 4],
) -> (Vec<[u64; MAX_D + 1]>, Vec<i32>, Vec<u16>) {
    // 起点:E8..E11 (或 E4..E7) at target_pos 各自,ori=0 → 综合值 = 2*pos+0
    let target: [i32; 4] = [
        2 * target_pos[0] as i32,
        2 * target_pos[1] as i32,
        2 * target_pos[2] as i32,
        2 * target_pos[3] as i32,
    ];
    let start_idx = array_to_index(&target, 4, 2, 12) as usize;

    let (table, max_depth) = bfs_byte(SZ_CR, start_idx, |i, out: &mut [usize; N_NEIGHBORS]| {
        for j in 0..18 {
            out[j] = (mt_multi[i * 24 + j] / 24) as usize;
        }
    });

    // mask_to_id / id_to_mask
    let mut mask_to_id = vec![-1i32; 1 << 12];
    let mut id_to_mask: Vec<u16> = Vec::with_capacity(495);
    let mut cnt = 0i32;
    for m in 0u32..(1 << 12) {
        if m.count_ones() == 4 {
            mask_to_id[m as usize] = cnt;
            id_to_mask.push(m as u16);
            cnt += 1;
        }
    }
    debug_assert_eq!(cnt, 495);

    // 反解每个 cross index 的 mask:从 index 还原 4 个棱的位置
    // perm 部分 = i / 16,ori 部分 = i % 16
    // perm = idx_p,可通过 base_array[2] = {1, 12, 132, 1320} 反解
    // 但简单做法:解出 4 棱位置 → mask
    use cube_solver::cube_common::index_to_array;
    let mut hist: Vec<[u64; MAX_D + 1]> = vec![[0u64; MAX_D + 1]; 495];
    let mut p = vec![0i32; 4];
    for i in 0..SZ_CR {
        let d = table[i];
        if d > max_depth { continue; }
        index_to_array(&mut p, i as i32, 4, 2, 12);
        // p[k] = 18 * (2*pos + ori) — 抽出 pos
        let mut mask = 0u32;
        for k in 0..4 {
            let raw = p[k] / 18;
            let pos = (raw / 2) as u32;
            mask |= 1 << pos;
        }
        debug_assert_eq!(mask.count_ones(), 4);
        let mid = mask_to_id[mask as usize] as usize;
        hist[mid][d as usize] += 1;
    }

    (hist, mask_to_id, id_to_mask)
}

fn main() {
    let t0 = Instant::now();
    let mgr = move_tables::instance();
    let mt_multi: Vec<i32> = mgr.ensure_edge4().as_u32().iter().map(|&x| x as i32).collect();

    // 位置索引 (cube_common 约定):0..3=F2L,4..7=U 层,8..11=D 层
    eprintln!("[1/3] White Cross BFS (D 层 8..11)...");
    let (white_hist, _, id_to_mask) = solve_single_cross(&mt_multi, [8, 9, 10, 11]);
    eprintln!("[2/3] Yellow Cross BFS (U 层 4..7)...");
    let (yellow_hist, _, _) = solve_single_cross(&mt_multi, [4, 5, 6, 7]);

    eprintln!("[3/3] Aggregating dual cross...");
    // ge_w[mid][k] = sum_{d>=k} white_hist[mid][d]
    let mut ge_w = vec![[0u64; MAX_D + 2]; 495];
    let mut ge_y = vec![[0u64; MAX_D + 2]; 495];
    for mid in 0..495 {
        for d in (0..=MAX_D).rev() {
            ge_w[mid][d] = ge_w[mid][d + 1] + white_hist[mid][d];
            ge_y[mid][d] = ge_y[mid][d + 1] + yellow_hist[mid][d];
        }
    }

    let mut total_counts = [0u64; MAX_D + 1];
    // 对所有不相交 (mw, my) mask 对累加。容量 495*495 = 245025,串行即可
    for i in 0..495 {
        let mw = id_to_mask[i] as u32;
        for j in 0..495 {
            let my = id_to_mask[j] as u32;
            if (mw & my) != 0 { continue; }
            for k in 0..=MAX_D {
                let ge_k = ge_w[i][k] * ge_y[j][k];
                let ge_k1 = ge_w[i][k + 1] * ge_y[j][k + 1];
                total_counts[k] += ge_k - ge_k1;
            }
        }
    }

    println!();
    println!("=== Opposite Color Cross Exact Distribution (Dual Solving) ===");
    println!("Depth     Count          Percentage");
    println!("--------------------------------------------");
    let mut total: u64 = 0;
    for (d, &c) in total_counts.iter().enumerate() {
        if c == 0 && d > 8 { continue; }
        total += c;
        let pct = c as f64 / TOTAL_THEORETICAL as f64 * 100.0;
        println!("{:<10}{:<15}{:.4}%", d, c, pct);
    }
    println!("--------------------------------------------");
    println!("Total States: {}", total);
    println!("Theoretical:  {}", TOTAL_THEORETICAL);
    let avg: f64 = total_counts.iter().enumerate().map(|(d, &c)| d as f64 * c as f64).sum::<f64>() / total as f64;
    println!("Average Dist: {:.4}", avg);
    eprintln!("[Done] {:.3}s", t0.elapsed().as_secs_f64());

    // bit-exact 校验
    for (i, &exp) in GOLDEN.iter().enumerate() {
        assert_eq!(total_counts[i], exp, "d={} got {} expected {}", i, total_counts[i], exp);
    }
    assert_eq!(total, TOTAL_THEORETICAL);
    eprintln!("[OK] bit-exact vs cpp golden");
}

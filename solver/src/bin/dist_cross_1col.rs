//! dist_cross_1col: 单色底 Cross 深度分布
//!
//! 状态空间 = P(12,4)·2^4 = 190,080 (state_space::CROSS)
//! BFS 起点 = solved cross (E8..E11 at pos 8..11, ori=0)
//!
//! Ground truth (cpp cross_1_col,0.03s):
//!   d=0:1  d=1:15  d=2:158  d=3:1394  d=4:9809  d=5:46381
//!   d=6:97254  d=7:34966  d=8:102
//!   total = 190,080

use std::time::Instant;

use cube_solver::cube_common::{array_to_index, state_space};
use cube_solver::dist::bfs::{bfs_byte, N_NEIGHBORS};
use cube_solver::move_tables;

const SZ_CR: usize = state_space::CROSS;
const GOLDEN: [u64; 9] = [1, 15, 158, 1394, 9809, 46381, 97254, 34966, 102];

fn main() {
    let t0 = Instant::now();
    let mgr = move_tables::instance();
    let mt_multi: Vec<i32> = mgr.ensure_edge4().as_u32().iter().map(|&x| x as i32).collect();

    // target: E8..E11 at D 棱位 8..11,ori=0 → 综合值 16,18,20,22
    let target = [16i32, 18, 20, 22];
    let start_idx = array_to_index(&target, 4, 2, 12) as usize;

    let (table, max_depth) = bfs_byte(SZ_CR, start_idx, |i, out: &mut [usize; N_NEIGHBORS]| {
        for j in 0..18 {
            // mt_edge4 stride=24 且预乘 24,除回得 raw cross index
            out[j] = (mt_multi[i * 24 + j] / 24) as usize;
        }
    });

    let mut dist = vec![0u64; max_depth as usize + 1];
    for &d in &table {
        if d <= max_depth {
            dist[d as usize] += 1;
        }
    }

    println!();
    println!("=== Single Color Cross Distribution ===");
    println!("Depth     Count          Percentage");
    println!("--------------------------------------------");
    let mut total: u64 = 0;
    for (d, &c) in dist.iter().enumerate() {
        total += c;
        let pct = c as f64 / SZ_CR as f64 * 100.0;
        println!("{:<10}{:<15}{:.4}%", d, c, pct);
    }
    println!("--------------------------------------------");
    println!("Total States: {}", total);
    let avg: f64 = dist.iter().enumerate().map(|(d, &c)| d as f64 * c as f64).sum::<f64>() / total as f64;
    println!("Average Distance: {:.4}", avg);
    eprintln!("[Done] {:.3}s", t0.elapsed().as_secs_f64());

    assert_eq!(dist.len(), GOLDEN.len());
    for (i, (&got, &exp)) in dist.iter().zip(GOLDEN.iter()).enumerate() {
        assert_eq!(got, exp, "d={} got {} expected {}", i, got, exp);
    }
    assert_eq!(total, SZ_CR as u64);
    eprintln!("[OK] bit-exact vs cpp golden");
}

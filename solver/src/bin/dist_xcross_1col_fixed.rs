//! dist_xcross_1col_fixed: 单色底固定槽 XCross 深度分布
//!
//! 固定 BL 槽 (cn=12 = C4 在 DBL, ed=0 = E0 在 BL),无 4-槽 min 折叠。
//! 状态空间 = 190080 × 24 × 24 = 109,486,080;reachable = 72,990,720。
//!
//! Ground truth (cpp):
//!   d=0:1  d=1:15  d=2:172  d=3:1950  d=4:21535  d=5:220368
//!   d=6:1989591  d=7:13431990  d=8:40963892  d=9:16325184  d=10:36022
//!   total = 72,990,720

use std::time::Instant;

use rayon::prelude::*;

use cube_solver::cube_common::state_space;
use cube_solver::dist::bfs::bfs_byte;
use cube_solver::move_tables;

const SZ_CR: usize = state_space::CROSS;
const SZ_CN: usize = state_space::CORNER;
const SZ_ED: usize = state_space::EDGE;
const STRIDE: usize = SZ_CN * SZ_ED;
const TOTAL: usize = SZ_CR * STRIDE;

const GOLDEN: [u64; 11] = [
    1, 15, 172, 1950, 21535, 220368, 1989591, 13431990, 40963892, 16325184, 36022,
];

fn main() {
    let t0 = Instant::now();
    let mgr = move_tables::instance();
    let mt_edge: Vec<i32> = mgr.ensure_edge().as_u32().iter().map(|&x| x as i32).collect();
    let mt_corn: Vec<i32> = mgr.ensure_corn().as_u32().iter().map(|&x| x as i32).collect();
    let mt_multi: Vec<i32> = mgr.ensure_edge4().as_u32().iter().map(|&x| x as i32).collect();

    let start = (187520 * SZ_CN + 12) * SZ_ED + 0;
    let (table, max_depth) = bfs_byte(TOTAL, start, |i, out| {
        let cur_ed = i % SZ_ED;
        let tmp = i / SZ_ED;
        let cur_cn = tmp % SZ_CN;
        let cur_cr = tmp / SZ_CN;
        for j in 0..18 {
            let new_cr = (mt_multi[cur_cr * 24 + j] / 24) as usize;
            let new_cn = mt_corn[cur_cn * 18 + j] as usize;
            let new_ed = mt_edge[cur_ed * 18 + j] as usize;
            out[j] = (new_cr * SZ_CN + new_cn) * SZ_ED + new_ed;
        }
    });

    // 按深度统计 (single par_iter 一次遍历,reduce 累加每个深度桶)
    let counts: Vec<u64> = table
        .par_iter()
        .fold(
            || vec![0u64; max_depth as usize + 1],
            |mut acc, &v| {
                if v <= max_depth {
                    acc[v as usize] += 1;
                }
                acc
            },
        )
        .reduce(
            || vec![0u64; max_depth as usize + 1],
            |mut a, b| {
                for i in 0..a.len() {
                    a[i] += b[i];
                }
                a
            },
        );

    println!("=== Fixed Slot X-Cross Distribution ===");
    let mut total: u64 = 0;
    for (d, &c) in counts.iter().enumerate() {
        println!("{:2}\t{}", d, c);
        total += c;
    }
    println!("total\t{}", total);
    eprintln!("[Done] {:.3}s", t0.elapsed().as_secs_f64());

    // ground truth 对齐检查
    assert_eq!(counts.len(), GOLDEN.len(), "depth count mismatch");
    for (i, (&got, &exp)) in counts.iter().zip(GOLDEN.iter()).enumerate() {
        assert_eq!(got, exp, "d={} got {} expected {}", i, got, exp);
    }
    assert_eq!(total, 72_990_720);
    eprintln!("[OK] bit-exact vs golden");
}

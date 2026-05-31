//! dist_xxcross_1col_adj: 单色底固定相邻槽 XXCross (BL + BR) 深度分布
//!
//! 状态空间 = P(12,6)·2^6 × P(8,2)·3^2 = 42,577,920 × 504 = 21,459,271,680
//! visited 4-bit packed = ~10.0 GB,mt_edge6 = ~3.07 GB,总 RAM 峰值 ~13.1 GB
//!
//! Ground truth (cpp adj):
//!   d=0:1  d=1:15  d=2:182  d=3:2286  d=4:28611  d=5:349811
//!   d=6:4169855  d=7:47547352  d=8:491359384  d=9:3873872622
//!   d=10:12836210229  d=11:4203640870  d=12:2090462
//!   total = 21,459,271,680

use std::time::Instant;

use cube_solver::cube_common::{array_to_index, state_space};
use cube_solver::dist::packed4::bfs_xxcross_packed4;
use cube_solver::move_tables;

const SZ_EDGES: usize = state_space::EDGE6;     // 42_577_920
const SZ_CORNERS: usize = state_space::CORNER2; // 504
const TOTAL_STATES: u64 = SZ_EDGES as u64 * SZ_CORNERS as u64;

const GOLDEN: [u64; 13] = [
    1, 15, 182, 2286, 28611, 349811, 4169855, 47547352, 491359384,
    3873872622, 12836210229, 4203640870, 2090462,
];

fn main() {
    let t0 = Instant::now();
    if std::env::var("CUBE_ALLOW_HUGE_TABLES").ok().as_deref() != Some("1") {
        eprintln!("set CUBE_ALLOW_HUGE_TABLES=1 to allow mt_edge6 (~3 GB) generation");
        std::process::exit(1);
    }

    eprintln!("[1/3] loading mt_edge6 ({} entries, ~3 GB)...", SZ_EDGES);
    let mgr = move_tables::instance();
    let mt_edges: Vec<i32> = mgr.ensure_edge6().as_u32().iter().map(|&x| x as i32).collect();
    eprintln!("      done @ {:.1}s", t0.elapsed().as_secs_f64());

    eprintln!("[2/3] loading mt_corn2 ({} entries)...", SZ_CORNERS);
    let mt_corns: Vec<i32> = mgr.ensure_corn2().as_u32().iter().map(|&x| x as i32).collect();
    eprintln!("      done @ {:.1}s", t0.elapsed().as_secs_f64());

    // target_edges = {0, 2, 16, 18, 20, 22} = E0,E1(BL,BR) + E8..E11(cross)
    let target_edges = [0i32, 2, 16, 18, 20, 22];
    let start_e = array_to_index(&target_edges, 6, 2, 12) as usize;
    // target_corners = {12, 15} = C4(DBL ori=0), C5(DBR ori=0)
    let target_corners = [12i32, 15];
    let start_c = array_to_index(&target_corners, 2, 3, 8) as usize;

    eprintln!("[3/3] BFS (~10 GB visited)...");
    let (_table, dist) = bfs_xxcross_packed4(
        SZ_EDGES, SZ_CORNERS, start_e, start_c, &mt_edges, &mt_corns,
    );

    println!();
    println!(" Depth |      Count     |   Percent   | Cumul %");
    println!("-------|----------------|-------------|--------");
    let mut total: u64 = 0;
    for (d, &c) in dist.iter().enumerate() {
        total += c;
        let pct = c as f64 / TOTAL_STATES as f64 * 100.0;
        let cum = total as f64 / TOTAL_STATES as f64 * 100.0;
        println!(" {:>5} | {:>14} |  {:>8.4}% | {:>6.2}%", d, c, pct, cum);
    }
    println!("---------------------------------------------");
    println!(" Total : {:>14} / {}", total, TOTAL_STATES);
    let avg: f64 = dist.iter().enumerate().map(|(d, &c)| d as f64 * c as f64).sum::<f64>() / total as f64;
    println!(" Avg   : {:.2}", avg);
    eprintln!("[Done] {:.1}s", t0.elapsed().as_secs_f64());

    // bit-exact 对齐 cpp golden
    assert_eq!(dist.len(), GOLDEN.len(), "depth count mismatch");
    for (i, (&got, &exp)) in dist.iter().zip(GOLDEN.iter()).enumerate() {
        assert_eq!(got, exp, "d={} got {} expected {}", i, got, exp);
    }
    assert_eq!(total, TOTAL_STATES);
    eprintln!("[OK] bit-exact vs cpp golden");
}

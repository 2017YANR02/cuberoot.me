//! lsll_poc: LSLL 最优求解器测速 PoC。
//!
//! 建 4 张投影 PDB(计时)→ 生成 N 个随机合法 LSLL 态 → 逐个测「找全部最优解」耗时
//! + 最优步数 + 候选数;再测「最优+2」候选数(生产要 ≥100 候选/case)。汇总单 case
//! 耗时分布 + 外推 583,284 case 总时长(单线程 / 14 线程)。
//!
//! 用法:cargo run --release --bin lsll_poc -- [N]   (默认 50)

use std::io::Write;
use std::time::Instant;

use cube_solver::cube_common::{Move, State};
use cube_solver::lsll_solver::{random_lsll_state, LsllSolver};

const TOTAL_LSLL_CASES: u64 = 583_284;
/// 单 case 超时哨兵默认值(可用第 2 个命令行参数覆盖)。
const NODE_CAP: u64 = 20_000_000;

fn pct(sorted_ms: &[f64], p: f64) -> f64 {
    if sorted_ms.is_empty() {
        return 0.0;
    }
    let idx = ((sorted_ms.len() as f64 - 1.0) * p).round() as usize;
    sorted_ms[idx]
}

fn main() {
    let n: usize = std::env::args()
        .nth(1)
        .and_then(|s| s.parse().ok())
        .unwrap_or(50);
    let node_cap: u64 = std::env::args()
        .nth(2)
        .and_then(|s| s.parse().ok())
        .unwrap_or(NODE_CAP);

    println!("== LSLL 最优求解器 PoC ==\n");

    // ---- 建表 ----
    let t0 = Instant::now();
    let s = LsllSolver::new();
    let build_s = t0.elapsed().as_secs_f64();
    println!("PDB 构建:{:.2}s", build_s);
    let names = ["5 LSLL 角", "3 底角", "5 LSLL 棱", "5 非LSLL棱"];
    for i in 0..4 {
        println!(
            "  [{}] 可达态 {:>9}  最大深度 {}",
            names[i], s.reached[i], s.pdb_depth[i]
        );
    }
    println!();

    // ---- 逐 case 测速 ----
    println!("跑 {} 个随机 LSLL case(找全部最优解,extra=0):\n", n);
    let mut times_ms: Vec<f64> = Vec::new();
    let mut lens: Vec<u32> = Vec::new();
    let mut opt_counts: Vec<usize> = Vec::new();
    let mut cand2: Vec<usize> = Vec::new(); // 最优+2 候选数
    let mut timeouts = 0usize;
    let mut verify_fail = 0usize;

    for seed in 0..n as u64 {
        let st = random_lsll_state(seed * 2_654_435_761 + 12345);

        print!("  seed {:>3}: ", seed);
        let _ = std::io::stdout().flush();
        let t = Instant::now();
        let res = s.enumerate(&st, 0, 4096, node_cap);
        let ms = t.elapsed().as_secs_f64() * 1000.0;

        match res {
            None => {
                timeouts += 1;
                println!("TIMEOUT (>{} 节点)", node_cap);
            }
            Some((best, sols, _nodes)) => {
                // 校验:每个最优解回放整方还原。
                let mut ok = true;
                for sol in &sols {
                    let mut c = st;
                    for &m in sol {
                        c.apply(Move::from_index(m as usize));
                    }
                    if c != State::SOLVED {
                        ok = false;
                    }
                }
                if !ok {
                    verify_fail += 1;
                }
                // 最优+2 候选数(不计时,量候选池规模)。
                let c2 = s
                    .enumerate(&st, 2, 4096, node_cap)
                    .map(|(_, v, _)| v.len())
                    .unwrap_or(0);

                times_ms.push(ms);
                lens.push(best);
                opt_counts.push(sols.len());
                cand2.push(c2);
                println!(
                    "最优 {:>2} 步 | {:>4} 条最优 | 最优+2 {:>4} 条 | {:>8.1} ms{}",
                    best,
                    sols.len(),
                    c2,
                    ms,
                    if ok { "" } else { "  ⚠ 校验失败" }
                );
            }
        }
        let _ = std::io::stdout().flush();
    }

    // ---- 汇总 ----
    println!("\n== 汇总 ==");
    if verify_fail > 0 {
        println!("⚠ 校验失败 {} 个(解回放未还原)", verify_fail);
    } else {
        println!("✓ 全部解回放整方还原");
    }
    if timeouts > 0 {
        println!("⚠ 超时 {} 个(未计入统计)", timeouts);
    }
    if times_ms.is_empty() {
        println!("无有效样本。");
        return;
    }

    let solved = times_ms.len();
    let mut sorted = times_ms.clone();
    sorted.sort_by(|a, b| a.partial_cmp(b).unwrap());
    let sum: f64 = times_ms.iter().sum();
    let mean = sum / solved as f64;

    // 步数分布。
    let lmax = *lens.iter().max().unwrap();
    let lmin = *lens.iter().min().unwrap();
    print!("最优步数分布 [{}..{}]: ", lmin, lmax);
    for l in lmin..=lmax {
        let c = lens.iter().filter(|&&x| x == l).count();
        if c > 0 {
            print!("{}步×{} ", l, c);
        }
    }
    println!();

    let cand2_min = cand2.iter().min().copied().unwrap_or(0);
    let cand2_med = {
        let mut v = cand2.clone();
        v.sort_unstable();
        v[v.len() / 2]
    };
    println!(
        "候选池:最优解 {}~{} 条;最优+2 {}~{} 条(中位 {})",
        opt_counts.iter().min().unwrap(),
        opt_counts.iter().max().unwrap(),
        cand2_min,
        cand2.iter().max().unwrap(),
        cand2_med
    );

    println!(
        "\n单 case 耗时(找全部最优):均值 {:.1} ms | 中位 {:.1} | p90 {:.1} | p99 {:.1} | max {:.1}",
        mean,
        pct(&sorted, 0.5),
        pct(&sorted, 0.9),
        pct(&sorted, 0.99),
        pct(&sorted, 1.0),
    );

    // ---- 外推 583,284 ----
    let total_1t_s = mean / 1000.0 * TOTAL_LSLL_CASES as f64;
    println!("\n== 外推 {} case(按均值)==", TOTAL_LSLL_CASES);
    println!(
        "单线程:{:.0}s = {:.2}h",
        total_1t_s,
        total_1t_s / 3600.0
    );
    println!(
        "14 线程:{:.0}s = {:.2}h",
        total_1t_s / 14.0,
        total_1t_s / 14.0 / 3600.0
    );
    println!(
        "\n(样本 N={},node_cap={};生产还要 MCC 排序 + 存表,量级参考。)",
        n, node_cap
    );
}

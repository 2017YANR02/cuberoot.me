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

/// 管道实际要跑的量:两步可达路线 302 × 494 去重后的 canonical key 数
/// (149,188 条路线 → 148,384 个不同局面,见 client 的 lsll/PLAN.md)。
const PIPELINE_CASES: u64 = 148_384;
/// 全量 LSLL case 数(对照用,管道不做)。
const TOTAL_LSLL_CASES: u64 = 583_284;
/// 单 case 节点预算默认值(可用第 2 个命令行参数覆盖)。
const NODE_CAP: u64 = 20_000_000;
/// 枚举到 opt+2 的树约是最优搜索的 13.34² ≈ 178 倍,预算按 200 倍给。
const ENUM_BUDGET_FACTOR: u64 = 200;
/// 候选池上限。顶到就是截断,下面会单独计数 —— 截断样本不进 min/max/中位。
const CAND_CAP: usize = 4096;

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
    let mut cand2: Vec<usize> = Vec::new(); // 最优+2 候选数(**仅完整样本**)
    let mut timeouts = 0usize;
    let mut verify_fail = 0usize;
    let mut opt_truncated = 0usize; // extra=0 就被 cap 截断(最优解多于 CAND_CAP)
    let mut c2_cap = 0usize; // 最优+2 顶到 cap
    let mut c2_budget = 0usize; // 最优+2 撞节点预算
    let mut c2_timeout = 0usize; // 最优+2 连最优步数都没算出来

    let enum_budget = node_cap.saturating_mul(ENUM_BUDGET_FACTOR);

    for seed in 0..n as u64 {
        let st = random_lsll_state(seed * 2_654_435_761 + 12345);

        print!("  seed {:>3}: ", seed);
        let _ = std::io::stdout().flush();
        let t = Instant::now();
        let res = s.enumerate(&st, 0, CAND_CAP, node_cap);
        let ms = t.elapsed().as_secs_f64() * 1000.0;

        match res {
            None => {
                timeouts += 1;
                println!("TIMEOUT (>{} 节点)", node_cap);
            }
            Some(r) => {
                // 校验:每个最优解回放整方还原。
                let mut ok = true;
                for sol in &r.sols {
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
                if !r.complete() {
                    opt_truncated += 1;
                }
                // 最优+2 候选池规模(不计时)。截断的样本只计数,不进分布统计 ——
                // 顶到 cap 的「4096」不是候选数,是天花板。
                let c2 = s.enumerate(&st, 2, CAND_CAP, enum_budget);
                let c2_txt = match &c2 {
                    None => {
                        c2_timeout += 1;
                        "  --".to_string()
                    }
                    Some(e) => {
                        if e.hit_cap {
                            c2_cap += 1;
                        }
                        if e.hit_node_cap {
                            c2_budget += 1;
                        }
                        if e.complete() {
                            cand2.push(e.sols.len());
                            format!("{:>4}", e.sols.len())
                        } else {
                            format!("≥{:>3}", e.sols.len())
                        }
                    }
                };

                times_ms.push(ms);
                lens.push(r.best);
                opt_counts.push(r.sols.len());
                println!(
                    "最优 {:>2} 步 | {:>4} 条最优{} | 最优+2 {} 条 | {:>8.1} ms{}",
                    r.best,
                    r.sols.len(),
                    if r.complete() { " " } else { "*" },
                    c2_txt,
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

    print!(
        "候选池:最优解 {}~{} 条",
        opt_counts.iter().min().unwrap(),
        opt_counts.iter().max().unwrap()
    );
    if opt_truncated > 0 {
        print!("(其中 {} 个顶到 cap={},实际更多)", opt_truncated, CAND_CAP);
    }
    if cand2.is_empty() {
        println!(";最优+2 无完整样本(cap {} / 预算 {} / 超时 {})", c2_cap, c2_budget, c2_timeout);
    } else {
        let mut v = cand2.clone();
        v.sort_unstable();
        println!(
            ";最优+2 {}~{} 条(中位 {};{} 个完整样本)",
            v[0],
            v[v.len() - 1],
            v[v.len() / 2],
            v.len()
        );
    }
    // 截断的样本一律单列 —— 不报的话,上面那串 min/max 会被当成「候选就这么多」。
    if c2_cap + c2_budget + c2_timeout > 0 {
        println!(
            "  ⚠ 最优+2 有 {}/{} 个样本不完整:顶到 cap={} 的 {} 个、撞节点预算({})的 {} 个、算不出最优的 {} 个",
            c2_cap + c2_budget + c2_timeout,
            solved,
            CAND_CAP,
            c2_cap,
            enum_budget,
            c2_budget,
            c2_timeout
        );
        println!("     (不完整样本未计入上面的 min/max/中位。cap 截断是按 move 序的偏样本,不能直接喂 MCC。)");
    }

    println!(
        "\n单 case 耗时(找全部最优):均值 {:.1} ms | 中位 {:.1} | p90 {:.1} | p99 {:.1} | max {:.1}",
        mean,
        pct(&sorted, 0.5),
        pct(&sorted, 0.9),
        pct(&sorted, 0.99),
        pct(&sorted, 1.0),
    );

    // ---- 外推 ----
    // 均值只来自「找全部最优」那一次;生产每 case 还要加深到 ≥100 条候选,比这贵。
    println!("\n== 外推(按上面的均值,只含找全部最优那一步)==");
    for (label, cases) in [("管道范围", PIPELINE_CASES), ("全量(不做)", TOTAL_LSLL_CASES)] {
        let s1 = mean / 1000.0 * cases as f64;
        println!(
            "{} {} case:单线程 {:.0}s = {:.2}h | 14 线程 {:.0}s = {:.2}h",
            label,
            cases,
            s1,
            s1 / 3600.0,
            s1 / 14.0,
            s1 / 14.0 / 3600.0
        );
    }
    println!(
        "\n(样本 N={},node_cap={}(枚举 ×{});生产还要加深到 ≥100 候选 + MCC 排序 + 存表,量级参考。)",
        n, node_cap, ENUM_BUDGET_FACTOR
    );
}

//! pair_analyzer binary:对应 C++ `pair_analyzer.cpp`。
//!
//! 输出 25 列 CSV(id + 4 阶段 × 6 视角,后缀与 std 统一为 _z0/_z2/_z3/_z1/_x3/_x1):
//!   - cross_pair_{suf}
//!   - xcross_pair_{suf}
//!   - xxcross_pair_{suf}
//!   - xxxcross_pair_{suf}
//!
//! 表依赖(全部必需,无 env 跳过分支):
//!   - mt_edge4 / mt_corn / mt_edge / mt_edge6 (~3 GB) / mt_corn2
//!   - pt_cross_ins_C4 (~2.18 MB)
//!   - pt_pair_C4E0 (288 B)
//!   - pt_cross_C4E0 (~52 MB)
//!   - pt_cross_C4C5E0E1 (~10 GB)
//!   - pt_cross_C4C6E0E2 (~10 GB,默认开;`CUBE_PAIR_NO_DIAG=1` 跳过)
//!
//! 因 mt_edge6 + 大表必需,binary 启动会强制要求 `CUBE_ALLOW_HUGE_TABLES=1`。

use cube_solver::cube_common::Move;
use cube_solver::executor::{run_analyzer_app, SolverWrapper};
use cube_solver::pair_solver::PairSolver;

const ROTS: [&str; 6] = ["", "z2", "z'", "z", "x'", "x"];
// 表头后缀与 std/eo/pseudo 统一(按 ROTS 同序对应):'' z2 z' z x' x = z0 z2 z3 z1 x3 x1
const SUFFIXES: [&str; 6] = ["_z0", "_z2", "_z3", "_z1", "_x3", "_x1"];

struct PairWrapper;

impl SolverWrapper for PairWrapper {
    fn global_init() {
        let huge_ok = std::env::var("CUBE_ALLOW_HUGE_TABLES")
            .map(|v| v == "1")
            .unwrap_or(false);
        if !huge_ok {
            eprintln!(
                "[ERROR] pair_analyzer requires CUBE_ALLOW_HUGE_TABLES=1 \
                 (needs mt_edge6 ~3GB + pt_cross_C4C5E0E1 ~10GB + \
                 pt_cross_C4C6E0E2 ~10GB). Aborting."
            );
            std::process::exit(1);
        }
        // 表 ensure 在 PairSolver::new 时触发,这里不预 ensure,避免重复管理
        let no_diag = std::env::var("CUBE_PAIR_NO_DIAG")
            .map(|v| v == "1")
            .unwrap_or(false);
        if no_diag {
            eprintln!(
                "[INFO] CUBE_PAIR_NO_DIAG=1: skipping pt_cross_C4C6E0E2 (10GB), \
                 diagonal slot pairs will have h_huge=0 (slower search, same correctness)."
            );
        }
    }

    fn get_csv_header() -> String {
        let mut s = String::from("id");
        for prefix in ["cross_pair", "xcross_pair", "xxcross_pair", "xxxcross_pair"] {
            for suf in SUFFIXES {
                s.push(',');
                s.push_str(prefix);
                s.push_str(suf);
            }
        }
        s
    }

    fn solve(alg: &[Move], id: &str) -> String {
        let with_diag = std::env::var("CUBE_PAIR_NO_DIAG")
            .map(|v| v != "1")
            .unwrap_or(true);
        let solver = PairSolver::new(with_diag);
        let stats = solver.get_stats(alg, &ROTS);
        let mut out = String::new();
        out.push_str(id);
        for v in &stats {
            out.push(',');
            out.push_str(&v.to_string());
        }
        out
    }
}

fn main() {
    cube_solver::logo::print_logo_block();
    run_analyzer_app::<PairWrapper>("_pair");
}

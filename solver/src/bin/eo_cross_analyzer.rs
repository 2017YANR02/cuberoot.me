//! eo_cross_analyzer binary:对应 C++ `eo_cross_analyzer.cpp`。
//!
//! 输出 31 列 CSV(id + 5 阶段 × 6 视角):
//!   - eo_cross_{rots}
//!   - eo_xcross_{rots}
//!   - eo_xxcross_{rots}
//!   - eo_xxxcross_{rots}
//!   - eo_xxxxcross_{rots}
//!
//! 表依赖巨大,binary 启动强制要求 `CUBE_ALLOW_HUGE_TABLES=1`(mt_edge6 + 10GB
//! cross_C4C5E0E1)。`CUBE_EO_NO_DIAG=1` 跳过 pt_cross_C4C6E0E2(再省 10GB)。

use cube_solver::cube_common::Move;
use cube_solver::eo_cross_solver::eo_cross_get_stats;
use cube_solver::executor::{run_analyzer_app, SolverWrapper};

const SUFFIXES: [&str; 6] = ["_z0", "_z2", "_z3", "_z1", "_x3", "_x1"];

struct EoCrossWrapper;

impl SolverWrapper for EoCrossWrapper {
    fn global_init() {
        let huge_ok = std::env::var("CUBE_ALLOW_HUGE_TABLES")
            .map(|v| v == "1")
            .unwrap_or(false);
        if !huge_ok {
            eprintln!(
                "[ERROR] eo_cross_analyzer requires CUBE_ALLOW_HUGE_TABLES=1 \
                 (needs mt_edge6 ~3GB + pt_cross_C4C5E0E1 ~10GB + optional \
                 pt_cross_C4C6E0E2 ~10GB + EOCross-specific CEE/CCE/ep4eo12). \
                 Aborting."
            );
            std::process::exit(1);
        }
    }

    fn get_csv_header() -> String {
        let mut s = String::from("id");
        for prefix in ["eo_cross", "eo_xcross", "eo_xxcross", "eo_xxxcross", "eo_xxxxcross"] {
            for suf in SUFFIXES {
                s.push(',');
                s.push_str(prefix);
                s.push_str(suf);
            }
        }
        s
    }

    fn solve(alg: &[Move], id: &str) -> String {
        let with_diag = std::env::var("CUBE_EO_NO_DIAG")
            .map(|v| v != "1")
            .unwrap_or(true);
        let stats = eo_cross_get_stats(alg, with_diag);
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
    run_analyzer_app::<EoCrossWrapper>("_eo");
}

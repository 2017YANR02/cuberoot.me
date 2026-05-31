//! pseudo_pair_analyzer binary:对应 C++ `pseudo_pair_analyzer.cpp`。
//!
//! 输出 25 列 CSV(id + 4 阶段 × 6 视角),C++ 头名:
//!   - pseudo_cross_pseudo_pair_{rots}    (实际是 XCross+Pair search_1)
//!   - pseudo_xcross_pseudo_pair_{rots}   (XXCross+Pair search_2)
//!   - pseudo_xxcross_pseudo_pair_{rots}  (XXXCross+Pair search_3)
//!   - pseudo_xxxcross_pseudo_pair_{rots} (XXXXCross+Pair search_4)
//!
//! 强制 `CUBE_ALLOW_HUGE_TABLES=1`(需 pscross_E0E1E2 957MB + C4C5C6 822MB)。

use cube_solver::cube_common::Move;
use cube_solver::executor::{run_analyzer_app, SolverWrapper};
use cube_solver::pseudo_pair_solver::PseudoPairSolver;

const ROTS: [&str; 6] = ["", "z2", "z'", "z", "x'", "x"];
const SUFFIXES: [&str; 6] = ["_z0", "_z2", "_z3", "_z1", "_x3", "_x1"];

struct PseudoPairWrapper;

impl SolverWrapper for PseudoPairWrapper {
    fn global_init() {
        let huge_ok = std::env::var("CUBE_ALLOW_HUGE_TABLES")
            .map(|v| v == "1")
            .unwrap_or(false);
        if !huge_ok {
            eprintln!(
                "[ERROR] pseudo_pair_analyzer requires CUBE_ALLOW_HUGE_TABLES=1 \
                 (needs pt_pscross_E0E1E2 ~957MB + pt_pscross_C4C5C6 ~822MB + \
                 16 × ins_C_diff + 16 × pspair_CE). Aborting."
            );
            std::process::exit(1);
        }
    }

    fn get_csv_header() -> String {
        let mut s = String::from("id");
        for prefix in [
            "pseudo_cross_pseudo_pair",
            "pseudo_xcross_pseudo_pair",
            "pseudo_xxcross_pseudo_pair",
            "pseudo_xxxcross_pseudo_pair",
        ] {
            for suf in SUFFIXES {
                s.push(',');
                s.push_str(prefix);
                s.push_str(suf);
            }
        }
        s
    }

    fn solve(alg: &[Move], id: &str) -> String {
        let solver = PseudoPairSolver::new();
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
    run_analyzer_app::<PseudoPairWrapper>("_pseudo_pair");
}

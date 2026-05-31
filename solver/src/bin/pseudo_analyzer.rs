//! pseudo_analyzer binary:对应 C++ `pseudo_analyzer.cpp`。
//!
//! 当前实现:
//!   - PseudoCross 6 列(默认可跑,~140 KB pt_pscross)
//!   - PseudoXCross 6 列(默认可跑,需 4 × ~52 MB pt_pscross_C4E[0..3])
//!   - PseudoXXCross 6 列(默认可跑,需 + E0E1/E0E2/C4C5/C4C6 = ~200 MB)
//!   - PseudoXXXCross 6 列(需 CUBE_ALLOW_HUGE_TABLES=1,
//!     需 + E0E1E2(957MB) + C4C5C6(822MB) + mt_edge3/corn3)
//!
//! 环境变量:
//!   - `CUBE_PSEUDO_SKIP_XCROSS=1`:跳过 PseudoXCross + 下游,均输出 0
//!   - `CUBE_PSEUDO_SKIP_XXCROSS=1`:跳过 PseudoXXCross + 下游
//!   - `CUBE_PSEUDO_SKIP_XXXCROSS=1`:仅跳过 PseudoXXXCross(默认 skip,
//!     需 huge env 才会启用)
//!   - `CUBE_ALLOW_HUGE_TABLES=1`:解锁 PseudoXXXCross 所需的 ~1.8 GB 大表生成
//!
//! CSV 表头与 C++ 完全一致(25 列:id + 4 阶段 × 6 视角)。

use std::sync::OnceLock;

use cube_solver::cross_solver::CrossSolver;
use cube_solver::cube_common::Move;
use cube_solver::executor::{run_analyzer_app, SolverWrapper};
use cube_solver::move_tables;
use cube_solver::prune_tables;
use cube_solver::pseudo_xcross_solver::PseudoXCrossSolver;
use cube_solver::pseudo_xxcross_solver::PseudoXXCrossSolver;
use cube_solver::pseudo_xxxcross_solver::PseudoXXXCrossSolver;

const ROTS: [&str; 6] = ["", "z2", "z'", "z", "x'", "x"];
const SUFFIXES: [&str; 6] = ["_z0", "_z2", "_z3", "_z1", "_x3", "_x1"];

struct EnabledFlags {
    xcross: bool,
    xxcross: bool,
    xxxcross: bool,
}

fn flags() -> &'static EnabledFlags {
    static F: OnceLock<EnabledFlags> = OnceLock::new();
    F.get_or_init(|| {
        let xcross = std::env::var("CUBE_PSEUDO_SKIP_XCROSS")
            .map(|v| v != "1")
            .unwrap_or(true);
        let xxcross = xcross
            && std::env::var("CUBE_PSEUDO_SKIP_XXCROSS")
                .map(|v| v != "1")
                .unwrap_or(true);
        // XXXCross 需 huge tables(~1.8GB),默认只有 CUBE_ALLOW_HUGE_TABLES=1
        // 才会启用;可用 CUBE_PSEUDO_SKIP_XXXCROSS=1 强制 skip
        let huge_ok = std::env::var("CUBE_ALLOW_HUGE_TABLES")
            .map(|v| v == "1")
            .unwrap_or(false);
        let xxxcross_skip = std::env::var("CUBE_PSEUDO_SKIP_XXXCROSS")
            .map(|v| v == "1")
            .unwrap_or(false);
        let xxxcross = xxcross && huge_ok && !xxxcross_skip;
        EnabledFlags {
            xcross,
            xxcross,
            xxxcross,
        }
    })
}

struct PseudoSolver;

impl SolverWrapper for PseudoSolver {
    fn global_init() {
        let mt = move_tables::instance();
        let pt = prune_tables::instance();

        // PseudoCross 必须的表
        mt.ensure_edge2();
        pt.ensure_pt_pscross();

        let f = flags();
        if f.xcross {
            mt.ensure_edge4();
            mt.ensure_corn();
            mt.ensure_edge();
            for i in 0..4 {
                pt.ensure_pt_pscross_c4e(i);
            }
        } else {
            eprintln!(
                "[INFO] PseudoXCross skipped (CUBE_PSEUDO_SKIP_XCROSS=1); \
                 xcross 6 cols output 0."
            );
        }

        if f.xxcross {
            mt.ensure_corn2();
            pt.ensure_pt_pscross_e0e1();
            pt.ensure_pt_pscross_e0e2();
            pt.ensure_pt_pscross_c4c5();
            pt.ensure_pt_pscross_c4c6();
        } else {
            eprintln!(
                "[INFO] PseudoXXCross skipped (CUBE_PSEUDO_SKIP_XXCROSS=1 or no xcross); \
                 xxcross 6 cols output 0."
            );
        }

        if f.xxxcross {
            mt.ensure_edge3();
            mt.ensure_corn3();
            pt.ensure_pt_pscross_e0e1e2();
            pt.ensure_pt_pscross_c4c5c6();
        } else {
            eprintln!(
                "[INFO] PseudoXXXCross skipped (need CUBE_ALLOW_HUGE_TABLES=1, \
                 ~1.8GB tables); xxxcross 6 cols output 0."
            );
        }
    }

    fn get_csv_header() -> String {
        let mut s = String::from("id");
        for prefix in ["pseudo_cross", "pseudo_xcross", "pseudo_xxcross", "pseudo_xxxcross"] {
            for suf in SUFFIXES {
                s.push(',');
                s.push_str(prefix);
                s.push_str(suf);
            }
        }
        s
    }

    fn solve(alg: &[Move], id: &str) -> String {
        let f = flags();

        // --- PseudoCross 6 列(必跑,复用 CrossSolver is_pseudo=true)---
        let cross = CrossSolver::new(true);
        let cross_stats: Vec<u32> = cross.get_stats(alg, &ROTS);

        // --- PseudoXCross 6 列(默认开,可由 CUBE_PSEUDO_SKIP_XCROSS=1 跳过)---
        let zero6: Vec<u32> = vec![0; 6];
        let xcross_stats: Vec<u32> = if f.xcross {
            let xc = PseudoXCrossSolver::new();
            xc.get_stats(alg, &ROTS, &cross_stats)
        } else {
            zero6.clone()
        };

        // --- PseudoXXCross 6 列(默认开,可由 CUBE_PSEUDO_SKIP_XXCROSS=1 跳过)---
        let xxcross_stats: Vec<u32> = if f.xxcross {
            let xxc = PseudoXXCrossSolver::new();
            xxc.get_stats(alg, &ROTS, &xcross_stats)
        } else {
            zero6.clone()
        };

        // --- PseudoXXXCross 6 列(默认 skip,需 CUBE_ALLOW_HUGE_TABLES=1)---
        let xxxcross_stats: Vec<u32> = if f.xxxcross {
            let xxxc = PseudoXXXCrossSolver::new();
            xxxc.get_stats(alg, &ROTS, &xxcross_stats)
        } else {
            zero6
        };

        let mut out = String::new();
        out.push_str(id);
        for v in &cross_stats {
            out.push(',');
            out.push_str(&v.to_string());
        }
        for v in &xcross_stats {
            out.push(',');
            out.push_str(&v.to_string());
        }
        for v in &xxcross_stats {
            out.push(',');
            out.push_str(&v.to_string());
        }
        for v in &xxxcross_stats {
            out.push(',');
            out.push_str(&v.to_string());
        }
        out
    }
}

fn main() {
    cube_solver::logo::print_logo_block();
    run_analyzer_app::<PseudoSolver>("_pseudo");
}

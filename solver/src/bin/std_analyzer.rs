//! std_analyzer binary:对应 C++ `std_analyzer.cpp`。
//!
//! 当前实现:
//!   - Cross 6 列(默认可跑,~140 KB pt_cross)
//!   - XCross 6 列(需 env `CUBE_RUN_FULL_STD=1`,~52 MB 表 `pt_cross_C4E0`)
//!   - XXCross / XXXCross / XXXXCross 18 列(需再设 `CUBE_ALLOW_HUGE_TABLES=1`,
//!     依赖 `pt_cross_C4C5E0E1` + `pt_cross_C4C6E0E2`(各 ~10 GB)+
//!     `mt_edge6`(~3 GB);均 mmap 载入)。
//!
//! CSV 表头与 C++ 完全一致(30 列),没启用的阶段输出 0。

#[cfg(not(feature = "wasm-small"))]
use std::sync::OnceLock;

use cube_solver::cross_solver::CrossSolver;
use cube_solver::cube_common::Move;
use cube_solver::executor::{run_analyzer_app, SolverWrapper};
use cube_solver::move_tables;
use cube_solver::prune_tables;
use cube_solver::xcross_solver::XCrossSolver;

const ROTS: [&str; 6] = ["", "z2", "z'", "z", "x'", "x"];
const SUFFIXES: [&str; 6] = ["_z0", "_z2", "_z3", "_z1", "_x3", "_x1"];

#[cfg(not(feature = "wasm-small"))]
struct EnabledFlags {
    xcross: bool,
    huge: bool,
}

#[cfg(not(feature = "wasm-small"))]
fn flags() -> &'static EnabledFlags {
    static F: OnceLock<EnabledFlags> = OnceLock::new();
    F.get_or_init(|| {
        let full = std::env::var("CUBE_RUN_FULL_STD")
            .map(|v| v == "1")
            .unwrap_or(false);
        let huge_ok = std::env::var("CUBE_ALLOW_HUGE_TABLES")
            .map(|v| v == "1")
            .unwrap_or(false);
        EnabledFlags {
            xcross: full,
            huge: full && huge_ok,
        }
    })
}

struct StdSolver;

impl SolverWrapper for StdSolver {
    fn global_init() {
        let mt = move_tables::instance();
        let pt = prune_tables::instance();

        // Cross 阶段必须的表
        mt.ensure_edge2();
        pt.ensure_pt_cross();

        // wasm-small:全 cascade 仅靠 pt_cross_C4E0(52MB)+ 小 move 表,绝不碰 huge。
        #[cfg(feature = "wasm-small")]
        {
            mt.ensure_edge();
            mt.ensure_corn();
            mt.ensure_edge4();
            pt.ensure_pt_cross_c4e0();
            eprintln!(
                "[INFO] wasm-small build: XXCross+ via 52MB single-slot admissible \
                 heuristic (no huge tables, optimal output)."
            );
        }

        #[cfg(not(feature = "wasm-small"))]
        {
            let f = flags();
            if f.xcross {
                // XCross 需要 mt_edge4 / mt_corn / mt_edge,以及 pt_cross_C4E0 (~52 MB)
                mt.ensure_edge();
                mt.ensure_corn();
                mt.ensure_edge4();
                pt.ensure_pt_cross_c4e0();
            } else {
                eprintln!(
                    "[INFO] XCross+ disabled by default; set CUBE_RUN_FULL_STD=1 \
                     (+ CUBE_ALLOW_HUGE_TABLES=1 for XXCross+) to enable. \
                     Disabled columns will output 0."
                );
            }
            if f.huge {
                mt.ensure_edge6();
                mt.ensure_corn2();
                pt.ensure_pt_cross_c4c5e0e1();
                pt.ensure_pt_cross_c4c6e0e2();
            }
        }
    }

    fn get_csv_header() -> String {
        let mut s = String::from("id");
        for prefix in ["cross", "xcross", "xxcross", "xxxcross", "xxxxcross"] {
            for suf in SUFFIXES {
                s.push(',');
                s.push_str(prefix);
                s.push_str(suf);
            }
        }
        s
    }

    fn solve(alg: &[Move], id: &str) -> String {
        // --- Cross 6 列(必跑)---
        let cross = CrossSolver::new(false);
        let cross_stats: Vec<u32> = cross.get_stats(alg, &ROTS);

        // --- XCross / XXCross / XXXCross / XXXXCross(24 列)---
        // wasm-small:全 24 列走 52MB 单槽启发式(最优,bit-exact)。
        #[cfg(feature = "wasm-small")]
        let xcross_stats: Vec<u32> = XCrossSolver::new(false).get_stats_small(alg, &ROTS, 3);

        // big-tables:f.xcross 开 XCross 6 列(52MB),f.huge 再补 XXC/XXXC/F2L 18 列
        // (~25GB huge 表);huge 关闭时后 18 列输出 0。
        #[cfg(not(feature = "wasm-small"))]
        let xcross_stats: Vec<u32> = {
            let f = flags();
            if f.xcross {
                XCrossSolver::new(f.huge).get_stats(alg, &ROTS)
            } else {
                vec![0; 24]
            }
        };

        let mut out = String::new();
        out.push_str(id);
        for v in cross_stats.iter().chain(xcross_stats.iter()) {
            out.push(',');
            out.push_str(&v.to_string());
        }
        out
    }
}

fn main() {
    cube_solver::logo::print_logo_block();
    run_analyzer_app::<StdSolver>("_std");
}

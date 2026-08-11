//! daisy_analyzer:三阶小花精确步数统计分析器。
//!
//! 输出 id + 6 底色列；每列是该底色四条棱围绕对面中心且朝向正确的 HTM 最优步数。

use std::sync::OnceLock;

use cube_solver::block222_solver::ROTS6;
use cube_solver::cube_common::Move;
use cube_solver::daisy_solver::DaisySolver;
use cube_solver::executor::{run_analyzer_app, SolverWrapper};

const SUFFIXES: [&str; 6] = ["_z0", "_z2", "_z3", "_z1", "_x3", "_x1"];
static SOLVER: OnceLock<DaisySolver> = OnceLock::new();

struct DaisyWrapper;

impl SolverWrapper for DaisyWrapper {
    fn global_init() {
        let solver = SOLVER.get_or_init(DaisySolver::new);
        eprintln!(
            "[INFO] daisy table ready (states {}, goals 24, max depth {}, histogram {:?})",
            cube_solver::cube_common::state_space::CROSS,
            solver.max_depth(),
            solver.histogram()
        );
    }

    fn get_csv_header() -> String {
        let mut out = String::from("id");
        for suffix in SUFFIXES {
            out.push_str(",daisy");
            out.push_str(suffix);
        }
        out
    }

    fn solve(alg: &[Move], id: &str) -> String {
        let mut out = String::from(id);
        for value in SOLVER.get().unwrap().get_stats(alg, &ROTS6) {
            out.push(',');
            out.push_str(&value.to_string());
        }
        out
    }
}

fn main() {
    cube_solver::logo::print_logo_block();
    run_analyzer_app::<DaisyWrapper>("_daisy");
}

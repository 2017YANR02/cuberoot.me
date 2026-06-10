//! dr_analyzer binary:DR(Kociemba phase-1 最优)统计分析器。
//!
//! 输出 7 列 CSV(id + 1 阶段 × 6 视角):
//!   - dr_{z0,z2,z3,z1,x3,x1}:把魔方降到该底色 UD 轴的 ⟨U,D,L2,R2,F2,B2⟩ 陪集
//! IDA*,h = max(eo×slice, co×slice) 双精确表;DR 仅依赖轴:对面底色列天然同值。
//! 全自包含微表(三张 move 表 + 两张 ~1M 距离表)启动现场 BFS。

use std::sync::OnceLock;

use cube_solver::block222_solver::ROTS6;
use cube_solver::cube_common::Move;
use cube_solver::dr_solver::DrSolver;
use cube_solver::executor::{run_analyzer_app, SolverWrapper};

const SUFFIXES: [&str; 6] = ["_z0", "_z2", "_z3", "_z1", "_x3", "_x1"];

static S: OnceLock<DrSolver> = OnceLock::new();

struct DrWrapper;

impl SolverWrapper for DrWrapper {
    fn global_init() {
        let s = S.get_or_init(DrSolver::new);
        let (a, b) = s.max_depths();
        eprintln!(
            "[INFO] dr tables ready (eo_slice max depth {}, co_slice max depth {})",
            a, b
        );
    }

    fn get_csv_header() -> String {
        let mut s = String::from("id");
        for suf in SUFFIXES {
            s.push(',');
            s.push_str("dr");
            s.push_str(suf);
        }
        s
    }

    fn solve(alg: &[Move], id: &str) -> String {
        let s = S.get().unwrap();
        let mut out = String::new();
        out.push_str(id);
        for v in s.get_stats(alg, &ROTS6) {
            out.push(',');
            out.push_str(&v.to_string());
        }
        out
    }
}

fn main() {
    cube_solver::logo::print_logo_block();
    run_analyzer_app::<DrWrapper>("_dr");
}

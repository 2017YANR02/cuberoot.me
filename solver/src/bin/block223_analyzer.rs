//! block223_analyzer binary:Petrus 2x2x3 块统计分析器。
//!
//! 输出 7 列 CSV(id + 1 阶段 × 6 视角):
//!   - block223_{z0,z2,z3,z1,x3,x1}
//! 每列 = 该底色 4 个 2x2x3 块的最小步数(IDA*,h = max(1x2x3 精确全表, 角2+DB/DF 表))。
//!
//! 表依赖:mt_corn2 + mt_edge3 + mt_edge2;启发式表(5.3M + 266K 态)启动时现场 BFS。

use std::sync::OnceLock;

use cube_solver::block222_solver::ROTS6;
use cube_solver::block223_solver::Block223Solver;
use cube_solver::cube_common::Move;
use cube_solver::executor::{run_analyzer_app, SolverWrapper};

const SUFFIXES: [&str; 6] = ["_z0", "_z2", "_z3", "_z1", "_x3", "_x1"];

static SOLVER: OnceLock<Block223Solver> = OnceLock::new();

struct Block223Wrapper;

impl SolverWrapper for Block223Wrapper {
    fn global_init() {
        let s = SOLVER.get_or_init(Block223Solver::new);
        eprintln!("[INFO] block223 tables ready (ce2 max depth {})", s.max_depth_ce2());
    }

    fn get_csv_header() -> String {
        let mut s = String::from("id");
        for suf in SUFFIXES {
            s.push_str(",block223");
            s.push_str(suf);
        }
        s
    }

    fn solve(alg: &[Move], id: &str) -> String {
        let stats = SOLVER.get().unwrap().get_stats(alg, &ROTS6);
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
    run_analyzer_app::<Block223Wrapper>("_223");
}

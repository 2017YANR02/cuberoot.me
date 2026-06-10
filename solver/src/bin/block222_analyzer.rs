//! block222_analyzer binary:2x2x2 块统计分析器。
//!
//! 输出 7 列 CSV(id + 1 阶段 × 6 视角):
//!   - block222_{z0,z2,z3,z1,x3,x1}
//! 每列 = 该底色 4 个贴底块的最小步数(精确距离表直查,无搜索)。
//!
//! 表依赖极小:mt_edge3 (~743KB) + mt_corn (~1.7KB),距离表启动时现场 BFS。

use std::sync::OnceLock;

use cube_solver::block222_solver::{Block222Solver, ROTS6};
use cube_solver::cube_common::Move;
use cube_solver::executor::{run_analyzer_app, SolverWrapper};

const SUFFIXES: [&str; 6] = ["_z0", "_z2", "_z3", "_z1", "_x3", "_x1"];

static SOLVER: OnceLock<Block222Solver> = OnceLock::new();

struct Block222Wrapper;

impl SolverWrapper for Block222Wrapper {
    fn global_init() {
        let s = SOLVER.get_or_init(Block222Solver::new);
        eprintln!("[INFO] block222 tables ready (max depth {})", s.max_depth());
    }

    fn get_csv_header() -> String {
        let mut s = String::from("id");
        for suf in SUFFIXES {
            s.push_str(",block222");
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
    run_analyzer_app::<Block222Wrapper>("_222");
}

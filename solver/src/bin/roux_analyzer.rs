//! roux_analyzer binary:Roux 第一块统计分析器。
//!
//! 输出 13 列 CSV(id + 2 阶段 × 6 视角):
//!   - fbsquare_{z0,z2,z3,z1,x3,x1}:FB 方块(1x2x2),每底色 8 个目标(4 位置 × 前/后)最小
//!   - rouxs1_{z0,z2,z3,z1,x3,x1}:1x2x3 块,每底色 4 个侧立块最小
//! 两者均为精确距离表直查,无搜索。(双 1x2x3 联合最优在独立的 f2b_analyzer。)
//!
//! 表依赖:mt_corn2 (~36KB) + mt_edge3 (~743KB) + mt_corn (~1.7KB) + mt_edge2 (~38KB),
//! 距离表(5.3M + 2×12.7K 态)启动时现场 BFS。

use std::sync::OnceLock;

use cube_solver::block222_solver::ROTS6;
use cube_solver::cube_common::Move;
use cube_solver::executor::{run_analyzer_app, SolverWrapper};
use cube_solver::roux_s1_solver::{FbSquareSolver, RouxS1Solver};

const SUFFIXES: [&str; 6] = ["_z0", "_z2", "_z3", "_z1", "_x3", "_x1"];

static SQ: OnceLock<FbSquareSolver> = OnceLock::new();
static S1: OnceLock<RouxS1Solver> = OnceLock::new();

struct RouxWrapper;

impl SolverWrapper for RouxWrapper {
    fn global_init() {
        let sq = SQ.get_or_init(FbSquareSolver::new);
        let s1 = S1.get_or_init(RouxS1Solver::new);
        eprintln!(
            "[INFO] roux tables ready (square max depth {}, s1 max depth {})",
            sq.max_depth(),
            s1.max_depth()
        );
    }

    fn get_csv_header() -> String {
        let mut s = String::from("id");
        for stage in ["fbsquare", "rouxs1"] {
            for suf in SUFFIXES {
                s.push(',');
                s.push_str(stage);
                s.push_str(suf);
            }
        }
        s
    }

    fn solve(alg: &[Move], id: &str) -> String {
        let sq = SQ.get().unwrap().get_stats(alg, &ROTS6);
        let s1 = S1.get().unwrap().get_stats(alg, &ROTS6);
        let mut out = String::new();
        out.push_str(id);
        for v in sq.iter().chain(s1.iter()) {
            out.push(',');
            out.push_str(&v.to_string());
        }
        out
    }
}

fn main() {
    cube_solver::logo::print_logo_block();
    run_analyzer_app::<RouxWrapper>("_roux");
}

//! f2b_analyzer binary:双 1x2x3(F2B)联合最优统计分析器。
//!
//! 输出 7 列 CSV(id + 1 阶段 × 6 视角):
//!   - f2b_{z0,z2,z3,z1,x3,x1}:双 1x2x3 联合最优(IDA*),每底色 2 个块对最小
//!
//! 默认 heavy:6 棱联合表(111.5M 现场 BFS)+ {块+2角} 盘缓存表
//! (`pt_f2b_be3c2.bin` 1.34GB,首跑 BFS 数分钟落盘,后续 mmap 秒开)。
//! 设 `CUBE_F2B_LIGHT=1` 走轻版(免大表,慢 ~100×,e2e 测试用)。

use std::sync::OnceLock;

use cube_solver::block222_solver::ROTS6;
use cube_solver::cube_common::Move;
use cube_solver::executor::{run_analyzer_app, SolverWrapper};
use cube_solver::f2b_solver::F2BSolver;

const SUFFIXES: [&str; 6] = ["_z0", "_z2", "_z3", "_z1", "_x3", "_x1"];

static S: OnceLock<F2BSolver> = OnceLock::new();

struct F2bWrapper;

impl SolverWrapper for F2bWrapper {
    fn global_init() {
        let light = std::env::var("CUBE_F2B_LIGHT").is_ok_and(|v| v == "1");
        let s = S.get_or_init(|| if light { F2BSolver::new() } else { F2BSolver::new_heavy() });
        eprintln!(
            "[INFO] f2b tables ready (s1 max depth {}, mode {})",
            s.max_depth_s1(),
            if light { "light" } else { "heavy" }
        );
    }

    fn get_csv_header() -> String {
        let mut s = String::from("id");
        for suf in SUFFIXES {
            s.push(',');
            s.push_str("f2b");
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
    run_analyzer_app::<F2bWrapper>("_f2b");
}

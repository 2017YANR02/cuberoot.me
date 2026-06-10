//! eoline_analyzer binary:ZZ EOLine 统计分析器。
//!
//! 输出 13 列 CSV(id + 2 阶段 × 6 视角):
//!   - eo_{z0,z2,z3,z1,x3,x1}:全 12 棱定向,每底色 2 条水平轴最小
//!   - eoline_{z0,z2,z3,z1,x3,x1}:EO + 线棱(DB/DF)归位,每底色 2 条线取向最小
//! 全自包含微表(2048 + 2048×144)启动现场 BFS,精确表直查,无搜索。
//! 注意 EO 仅依赖轴:z0≡z2 / z3≡z1 / x3≡x1 列天然同值(对面底色同轴)。

use std::sync::OnceLock;

use cube_solver::block222_solver::ROTS6;
use cube_solver::cube_common::Move;
use cube_solver::eoline_solver::EOLineSolver;
use cube_solver::executor::{run_analyzer_app, SolverWrapper};

const SUFFIXES: [&str; 6] = ["_z0", "_z2", "_z3", "_z1", "_x3", "_x1"];

static S: OnceLock<EOLineSolver> = OnceLock::new();

struct EOLineWrapper;

impl SolverWrapper for EOLineWrapper {
    fn global_init() {
        let s = S.get_or_init(EOLineSolver::new);
        let (eo_god, line_god) = s.max_depths();
        eprintln!(
            "[INFO] eoline tables ready (EO max depth {}, EOLine max depth {})",
            eo_god, line_god
        );
    }

    fn get_csv_header() -> String {
        let mut s = String::from("id");
        for stage in ["eo", "eoline"] {
            for suf in SUFFIXES {
                s.push(',');
                s.push_str(stage);
                s.push_str(suf);
            }
        }
        s
    }

    fn solve(alg: &[Move], id: &str) -> String {
        let s = S.get().unwrap();
        let eo = s.get_stats_eo(alg, &ROTS6);
        let line = s.get_stats(alg, &ROTS6);
        let mut out = String::new();
        out.push_str(id);
        for v in eo.iter().chain(line.iter()) {
            out.push(',');
            out.push_str(&v.to_string());
        }
        out
    }
}

fn main() {
    cube_solver::logo::print_logo_block();
    run_analyzer_app::<EOLineWrapper>("_eoline");
}

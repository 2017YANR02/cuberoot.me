//! pseudo_f2leo_analyzer binary:Pseudo F2LEO 的 count-only 批处理。
//!
//! 忠实移植上游 `RubiksSolverDemo` 的 Pseudo F2LEO 分析器(见 `pseudo_f2leo_solver`)。
//! 输出 4 阶段 × 6 朝向 = 24 列(无 xxxxcross),每阶段取 (棱槽×角槽) 组合最优、每朝向 min。
//!
//! 全程仅小/中表(mt_edge2/edge4/corn/edge + 自建 ~18 MB xcross + ~272 KB cross 剪枝表),
//! **不需要** `CUBE_ALLOW_HUGE_TABLES`,常驻 ~40 MB。

use cube_solver::cube_common::Move;
use cube_solver::executor::{run_analyzer_app, SolverWrapper};
use cube_solver::pseudo_f2leo_solver::PseudoF2leoSolver;

const SUFFIXES: [&str; 6] = ["_z0", "_z2", "_z3", "_z1", "_x3", "_x1"];

struct PseudoF2leoWrapper;

impl SolverWrapper for PseudoF2leoWrapper {
    fn global_init() {
        let _ = PseudoF2leoSolver::new();
    }

    fn get_csv_header() -> String {
        let mut s = String::from("id");
        for prefix in [
            "pseudo_f2leo_cross",
            "pseudo_f2leo_xcross",
            "pseudo_f2leo_xxcross",
            "pseudo_f2leo_xxxcross",
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
        let solver = PseudoF2leoSolver::new();
        let stats = solver.get_stats(alg);
        let mut out = String::with_capacity(id.len() + stats.len() * 3);
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
    run_analyzer_app::<PseudoF2leoWrapper>("_pseudo_f2leo");
}

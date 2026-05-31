//! f2leo_analyzer binary:F2LEO(cross 进度 + 自由 F2L 棱 EO 门控)的 count-only 批处理。
//!
//! 忠实移植上游 `RubiksSolverDemo` 的 F2LEO 分析器(见 `f2leo_solver`)。
//! 输出 4 阶段 × 6 朝向 = 24 列(**无 xxxxcross**):每阶段取多槽组合最优、每朝向 min。
//!
//! 全程仅用小/中表(mt_edge2/edge4/corn/edge + pt_cross + 自建 ~18 MB xcross 剪枝表),
//! **不需要** `CUBE_ALLOW_HUGE_TABLES`,常驻 ~40 MB。

use cube_solver::cube_common::Move;
use cube_solver::executor::{run_analyzer_app, SolverWrapper};
use cube_solver::f2leo_solver::F2leoSolver;

const SUFFIXES: [&str; 6] = ["_z0", "_z2", "_z3", "_z1", "_x3", "_x1"];

struct F2leoWrapper;

impl SolverWrapper for F2leoWrapper {
    fn global_init() {
        // 进程级 warm:ensure 全部 move/prune 表 + 一次性建 4 张 xcross 剪枝表,
        // 避免 rayon 各线程并发首建。
        let _ = F2leoSolver::new();
    }

    fn get_csv_header() -> String {
        let mut s = String::from("id");
        for prefix in ["f2leo_cross", "f2leo_xcross", "f2leo_xxcross", "f2leo_xxxcross"] {
            for suf in SUFFIXES {
                s.push(',');
                s.push_str(prefix);
                s.push_str(suf);
            }
        }
        s
    }

    fn solve(alg: &[Move], id: &str) -> String {
        let solver = F2leoSolver::new();
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
    run_analyzer_app::<F2leoWrapper>("_f2leo");
}

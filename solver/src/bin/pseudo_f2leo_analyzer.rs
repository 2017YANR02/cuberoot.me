//! pseudo_f2leo_analyzer binary:Pseudo F2LEO 的 count-only 批处理。
//!
//! 忠实移植上游 `RubiksSolverDemo` 的 Pseudo F2LEO 分析器(见 `pseudo_f2leo_solver`)。
//! 输出 4 阶段 × 6 朝向 = 24 列(无 xxxxcross),每阶段取 (棱槽×角槽) 组合最优、每朝向 min。
//!
//! 默认(快):`CUBE_ALLOW_HUGE_TABLES=1` 时走 `PseudoF2leoBigSolver` —— std-`pseudo` 的整套
//! 大表电池(per-pair pt_pscross_C4E + corner2/edge2 + corner3/edge3 = C4C5C6 862MB/E0E1E2 1GB),
//! combo 启发式取 max + 叶子门控自由棱 EO。与小表版逐格 bit-exact,但节点远少(实测真实打乱快 ~8×)。
//! 常驻 mmap ~2.2GB。未设该 env(或 CUBE_F2LEO_FORCE_SMALL=1)回退小表版(慢,~3/s)。

use std::sync::OnceLock;

use cube_solver::cube_common::Move;
use cube_solver::executor::{run_analyzer_app, SolverWrapper};
use cube_solver::pseudo_f2leo_solver::{pseudo_f2leo_big_instance, PseudoF2leoSolver};

const SUFFIXES: [&str; 6] = ["_z0", "_z2", "_z3", "_z1", "_x3", "_x1"];

/// 大表电池是否可用(CUBE_ALLOW_HUGE_TABLES=1 且未强制小表)。决定走大表快路径。
fn use_big() -> bool {
    static F: OnceLock<bool> = OnceLock::new();
    *F.get_or_init(|| {
        let huge = std::env::var("CUBE_ALLOW_HUGE_TABLES").map(|v| v == "1").unwrap_or(false);
        let force_small = std::env::var("CUBE_F2LEO_FORCE_SMALL").map(|v| v == "1").unwrap_or(false);
        huge && !force_small
    })
}

struct PseudoF2leoWrapper;

impl SolverWrapper for PseudoF2leoWrapper {
    fn global_init() {
        if use_big() {
            // 进程级 warm:ensure 大表电池(含 huge E0E1E2/C4C5C6 mmap)+ move 表 + cross 剪枝。
            let _ = pseudo_f2leo_big_instance();
            eprintln!("[INFO] pseudo_f2leo: huge-table battery fast path (C4E + corner2/3 + edge2/3).");
        } else {
            let _ = PseudoF2leoSolver::new();
            eprintln!(
                "[INFO] pseudo_f2leo: small-table fallback (slow). \
                 Set CUBE_ALLOW_HUGE_TABLES=1 for the big-table battery fast path."
            );
        }
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
        let stats = if use_big() {
            pseudo_f2leo_big_instance().get_stats(alg)
        } else {
            PseudoF2leoSolver::new().get_stats(alg)
        };
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

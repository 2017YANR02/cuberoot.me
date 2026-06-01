//! f2leo_analyzer binary:F2LEO(cross 进度 + 自由 F2L 棱 EO 门控)的 count-only 批处理。
//!
//! 忠实移植上游 `RubiksSolverDemo` 的 F2LEO 分析器(见 `f2leo_solver`)。
//! 输出 4 阶段 × 6 朝向 = 24 列(**无 xxxxcross**):每阶段取多槽组合最优、每朝向 min。
//!
//! 两条路径(输出逐格 bit-exact,仅速度不同):
//!   - **默认(快)**:`CUBE_ALLOW_HUGE_TABLES=1` 时走 `F2leoBigSolver` —— 复用 std
//!     的联合大表 cross 进度启发式(pt_cross_C4E0 52MB + 两张 ~10GB pair huge 表),
//!     叶子门控自由棱 EO。常驻 mmap ~21GB(零拷贝,RAM ~1-3GB)。
//!   - **回退(慢)**:未设该 env 时走 `F2leoSolver`(自建 ~18MB 弱剪枝小表),
//!     常驻 ~40 MB。结果完全相同,仅 ~3.5 例/s。

use std::sync::OnceLock;

use cube_solver::cube_common::Move;
use cube_solver::executor::{run_analyzer_app, SolverWrapper};
use cube_solver::f2leo_solver::{f2leo_big_instance, F2leoSolver};

const SUFFIXES: [&str; 6] = ["_z0", "_z2", "_z3", "_z1", "_x3", "_x1"];

/// huge 表是否可用(CUBE_ALLOW_HUGE_TABLES=1) —— 进程级缓存,决定走大表快路径。
fn use_big() -> bool {
    static F: OnceLock<bool> = OnceLock::new();
    *F.get_or_init(|| {
        std::env::var("CUBE_ALLOW_HUGE_TABLES")
            .map(|v| v == "1")
            .unwrap_or(false)
    })
}

struct F2leoWrapper;

impl SolverWrapper for F2leoWrapper {
    fn global_init() {
        // 进程级 warm:大表路径 ensure 联合大表(含 huge mmap);否则 ensure 小表 +
        // 一次性建 4 张 xcross 剪枝表,避免 rayon 各线程并发首建。
        if use_big() {
            let _ = f2leo_big_instance();
            eprintln!("[INFO] f2leo: huge-table fast path (pt_cross_C4E0 + 2x pair huge).");
        } else {
            let _ = F2leoSolver::new();
            eprintln!(
                "[INFO] f2leo: small-table fallback (~18MB, slow). \
                 Set CUBE_ALLOW_HUGE_TABLES=1 for the huge-table fast path."
            );
        }
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
        let stats = if use_big() {
            f2leo_big_instance().get_stats(alg)
        } else {
            F2leoSolver::new().get_stats(alg)
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
    run_analyzer_app::<F2leoWrapper>("_f2leo");
}

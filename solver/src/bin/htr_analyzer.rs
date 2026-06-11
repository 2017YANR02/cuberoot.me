//! htr_analyzer binary:HTR(Thistlethwaite DR→HTR)统计分析器。
//!
//! 输出 7 列 CSV(id + 1 阶段 × 6 视角):
//!   - htr_{z0,z2,z3,z1,x3,x1}:该底色 UD 轴下从 DR 态降到 HTR(G3 陪集)的最优步数
//!
//! 输入语义与 htr_solver 一致(条件式阶段):该视角必须已处于 DR,
//! 非 DR 视角输出 `-`(下游 build.ts 对含非数值 cell 的行整行跳过)。
//! HTR 仅依赖轴:对面底色列天然同值(z0≡z2 / z3≡z1 / x3≡x1),且对 y 不变。
//! 全空间 2,822,400 态精确表(~2.8MB)启动现场 BFS,查表零搜索,零盘表。

use std::sync::OnceLock;

use cube_solver::block222_solver::ROTS6;
use cube_solver::cube_common::Move;
use cube_solver::executor::{run_analyzer_app, SolverWrapper};
use cube_solver::htr_solver::HtrSolver;

const SUFFIXES: [&str; 6] = ["_z0", "_z2", "_z3", "_z1", "_x3", "_x1"];

static S: OnceLock<HtrSolver> = OnceLock::new();

struct HtrWrapper;

impl SolverWrapper for HtrWrapper {
    fn global_init() {
        let s = S.get_or_init(HtrSolver::new);
        eprintln!("[INFO] htr table ready (max depth {})", s.max_depth());
    }

    fn get_csv_header() -> String {
        let mut s = String::from("id");
        for suf in SUFFIXES {
            s.push(',');
            s.push_str("htr");
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
            match v {
                Some(d) => out.push_str(&d.to_string()),
                None => out.push('-'),
            }
        }
        out
    }
}

fn main() {
    cube_solver::logo::print_logo_block();
    run_analyzer_app::<HtrWrapper>("_htr");
}

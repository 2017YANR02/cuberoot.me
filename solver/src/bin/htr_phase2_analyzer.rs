//! htr_phase2_analyzer binary:HTR phase-2(Thistlethwaite G3→G4)统计分析器。
//!
//! 输出 7 列 CSV(id + 1 阶段 × 6 视角):
//!   - htr2_{z0,z2,z3,z1,x3,x1}:该底色 UD 轴下从 HTR 态(G3 陪集)降到 solved
//!     (G4 = identity)的最优步数(只用 6 种双转 U2 D2 L2 R2 F2 B2)。
//!
//! 输入语义与 htr_analyzer 一致(条件式阶段):该视角必须已处于 HTR(G3),
//! 非 HTR 视角输出 `-`(下游 build.ts 对含非数值 cell 的行整行跳过)。
//! HTR phase-2 仅依赖轴:对面底色列天然同值(z0≡z2 / z3≡z1 / x3≡x1),且对 y 不变。
//! 全空间 663,552 态精确表(~648KB)启动现场 BFS,查表零搜索,零盘表。

use std::sync::OnceLock;

use cube_solver::block222_solver::ROTS6;
use cube_solver::cube_common::Move;
use cube_solver::executor::{run_analyzer_app, SolverWrapper};
use cube_solver::htr_phase2_solver::HtrPhase2Solver;

const SUFFIXES: [&str; 6] = ["_z0", "_z2", "_z3", "_z1", "_x3", "_x1"];

static S: OnceLock<HtrPhase2Solver> = OnceLock::new();

struct HtrPhase2Wrapper;

impl SolverWrapper for HtrPhase2Wrapper {
    fn global_init() {
        let s = S.get_or_init(HtrPhase2Solver::new);
        eprintln!("[INFO] htr2 table ready (max depth {})", s.max_depth());
    }

    fn get_csv_header() -> String {
        let mut s = String::from("id");
        for suf in SUFFIXES {
            s.push(',');
            s.push_str("htr2");
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
    run_analyzer_app::<HtrPhase2Wrapper>("_htr2");
}

//! First Face / First Layer 两阶段精确 HTM 分析器。
//!
//! 输出 id + 12 列：first_face 六底色，随后 first_layer 六底色。

use std::sync::OnceLock;

use cube_solver::block222_solver::ROTS6;
use cube_solver::cube_common::Move;
use cube_solver::executor::{run_analyzer_app, SolverWrapper};
use cube_solver::first_layer_solver::{FirstLayerSolver, FirstLayerStage, FIRST_LAYER_UPPER_BOUND};

const SUFFIXES: [&str; 6] = ["_z0", "_z2", "_z3", "_z1", "_x3", "_x1"];
static SOLVER: OnceLock<FirstLayerSolver> = OnceLock::new();

struct FirstLayerWrapper;

impl SolverWrapper for FirstLayerWrapper {
    fn global_init() {
        let solver = SOLVER.get_or_init(FirstLayerSolver::new);
        eprintln!(
            "[INFO] first-layer tables ready (first-face states {}, histogram {:?}, first-layer states {}, proven diameter interval {}..={})",
            cube_solver::first_layer_solver::FIRST_FACE_STATES,
            solver.first_face_histogram(),
            cube_solver::first_layer_solver::FIRST_LAYER_STATES,
            solver.first_layer_known_lower_bound(),
            FIRST_LAYER_UPPER_BOUND,
        );
    }

    fn get_csv_header() -> String {
        let mut out = String::from("id");
        for stage in FirstLayerStage::ALL {
            for suffix in SUFFIXES {
                out.push(',');
                out.push_str(stage.key());
                out.push_str(suffix);
            }
        }
        out
    }

    fn solve(alg: &[Move], id: &str) -> String {
        let solver = SOLVER.get().unwrap();
        let mut out = String::from(id);
        for value in solver.get_stats(alg, &ROTS6) {
            out.push(',');
            out.push_str(&value.to_string());
        }
        out
    }
}

fn main() {
    cube_solver::logo::print_logo_block();
    run_analyzer_app::<FirstLayerWrapper>("_first_layer");
}

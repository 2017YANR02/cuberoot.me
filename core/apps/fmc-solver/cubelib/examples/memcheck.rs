use std::str::FromStr;

use cubelib::algs::Algorithm;
use cubelib::cube::Cube333;
use cubelib::defs::{NissSwitchType, StepKind};
use cubelib::solver::df_search::CancelToken;
use cubelib::steps::solver;
use cubelib::steps::step::StepConfig;
use cubelib::steps::tables::PruningTables333;

fn cfg(kind: StepKind, niss: NissSwitchType) -> StepConfig {
    let mut c = StepConfig::new(kind);
    c.niss = Some(niss);
    c
}

fn main() {
    // Full default pipeline (no DRFIN): generate every table mallard's chain needs.
    let configs = vec![
        cfg(StepKind::EO, NissSwitchType::Always),
        cfg(StepKind::RZP, NissSwitchType::Never),
        cfg(StepKind::DR, NissSwitchType::Before),
        cfg(StepKind::HTR, NissSwitchType::Before),
        cfg(StepKind::FR, NissSwitchType::Before),
        cfg(StepKind::FIN, NissSwitchType::Never),
    ];
    let mut tables = PruningTables333::new();
    let t0 = std::time::Instant::now();
    solver::gen_tables(&configs, &mut tables);
    eprintln!("gen_tables (full pipeline) took {}ms", t0.elapsed().as_millis());

    // sanity solve
    let scramble = Algorithm::from_str("R U F R'").unwrap();
    let cube: Cube333 = scramble.into();
    let steps = solver::build_steps(configs, &tables).unwrap();
    let cancel = CancelToken::default();
    let n = cubelib::solver::solve_steps(cube, &steps, &cancel).take(1).count();
    eprintln!("solved ({} solution), tables held in memory; parking 90s for RSS sampling", n);
    std::thread::sleep(std::time::Duration::from_secs(90));
}

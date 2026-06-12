use std::str::FromStr;

use cubelib::algs::Algorithm;
use cubelib::cube::Cube333;
use cubelib::defs::{NissSwitchType, StepKind};
use cubelib::solver::df_search::CancelToken;
use cubelib::steps::solver;
use cubelib::steps::step::StepConfig;
use cubelib::steps::tables::PruningTables333;

fn cfg(kind: StepKind, max: Option<u8>, niss: NissSwitchType) -> StepConfig {
    let mut c = StepConfig::new(kind);
    c.max = max;
    c.niss = Some(niss);
    c
}

fn main() {
    let scramble = Algorithm::from_str("R U F R'").unwrap();
    let cube: Cube333 = scramble.into();

    let configs = vec![
        cfg(StepKind::EO, Some(5), NissSwitchType::Always),
        cfg(StepKind::DR, None, NissSwitchType::Before),
        cfg(StepKind::HTR, None, NissSwitchType::Before),
        cfg(StepKind::FIN, None, NissSwitchType::Never),
    ];

    let mut tables = PruningTables333::new();
    let t0 = std::time::Instant::now();
    solver::gen_tables(&configs, &mut tables);
    eprintln!("gen_tables took {}ms", t0.elapsed().as_millis());

    let steps = solver::build_steps(configs, &tables).expect("build_steps");
    let cancel = CancelToken::default();
    let t1 = std::time::Instant::now();
    let sols: Vec<_> = cubelib::solver::solve_steps(cube, &steps, &cancel).take(5).collect();
    eprintln!("solve took {}ms, {} solutions", t1.elapsed().as_millis(), sols.len());

    for (i, sol) in sols.iter().enumerate() {
        let plain: Algorithm = sol.clone().into();
        println!("--- solution #{} (len {}) ---", i + 1, plain.len());
        println!("DETAILED:\n{}", sol);
        println!("PLAIN: {}", plain);
        println!();
    }
}

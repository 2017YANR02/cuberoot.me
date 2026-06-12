use std::str::FromStr;
use std::time::Instant;

use cubelib::algs::Algorithm;
use cubelib::cube::Cube333;
use cubelib::defs::{NissSwitchType, StepKind};
use cubelib::solver::df_search::CancelToken;
use cubelib::steps::solver;
use cubelib::steps::step::StepConfig;
use cubelib::steps::tables::PruningTables333;

fn cfg(kind: StepKind, niss: NissSwitchType, q: usize) -> StepConfig {
    let mut c = StepConfig::new(kind);
    c.niss = Some(niss);
    c.quality = q;
    c
}

// 部署默认管道:EO(always) > RZP > DR(before) > HTR(before) > FR(before) > FIN
fn pipeline(q: usize) -> Vec<StepConfig> {
    vec![
        cfg(StepKind::EO, NissSwitchType::Always, q),
        cfg(StepKind::RZP, NissSwitchType::Never, 100), // deployed: RZP keeps default quality
        cfg(StepKind::DR, NissSwitchType::Before, q),
        cfg(StepKind::HTR, NissSwitchType::Before, q),
        cfg(StepKind::FR, NissSwitchType::Before, q),
        cfg(StepKind::FIN, NissSwitchType::Never, q),
    ]
}

fn solve_best(cube: Cube333, tables: &PruningTables333, q: usize, n: usize) -> usize {
    let steps = solver::build_steps(pipeline(q), tables).unwrap();
    let cancel = CancelToken::default();
    let sols: Vec<_> = cubelib::solver::solve_steps(cube, &steps, &cancel).take(n).collect();
    sols.into_iter().next().map(|s| Into::<Algorithm>::into(s).len()).unwrap_or(0)
}

fn main() {
    let scrambles = [
        ("trivial", "R U F R'"),
        ("wca-1", "R' U' F D2 L2 F R2 U2 R2 B D2 L B2 L' B D' U R2 D L2 U' R' U' F"),
        ("wca-2", "D B U B2 R2 U' L2 D2 R2 D' L D2 B D' L2 F' D L' D'"),
        ("wca-3", "D R2 F2 U R2 U B2 L2 U' F2 D' L B F2 R D2 B' D L' U2"),
    ];

    let mut tables = PruningTables333::new();
    // gen for all qualities (table set identical; quality only affects search breadth)
    solver::gen_tables(&pipeline(100000), &mut tables);

    println!("{:<10} | {:>22} | {:>22}", "scramble", "q=1000 (fast default)", "q=100000 (mallard-depth)");
    println!("{}", "-".repeat(62));
    for (name, scr) in scrambles {
        let cube: Cube333 = Algorithm::from_str(scr).unwrap().into();
        let _ = solve_best(cube, &tables, 1000, 10); // warm pages
        let t1 = Instant::now();
        let b1 = solve_best(cube, &tables, 1000, 10);
        let ms1 = t1.elapsed().as_millis();
        let t2 = Instant::now();
        let b2 = solve_best(cube, &tables, 100000, 10);
        let ms2 = t2.elapsed().as_millis();
        println!("{:<10} | {:>12} HTM {:>5}ms | {:>12} HTM {:>5}ms", name, b1, ms1, b2, ms2);
    }
}

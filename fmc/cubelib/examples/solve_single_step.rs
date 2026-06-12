use std::str::FromStr;

use cubelib::algs::Algorithm;
use cubelib::solver_new::eo::EOStep;

fn main() {
    let cube = Algorithm::from_str("R' U' F L' B L' B2 U B2 D U2 L2 F2 L2 R2 D' L2 B' F' R' F L' F' U' R' U' F").unwrap().into();
    let eo_step = EOStep::builder()
        .max_length(4)
        .build();
    if let Some(solution) = eo_step.into_worker(cube).next() {
        let alg: Algorithm = solution.into();
        println!("EO: {alg}");
    } else {
        println!("No EO found with <= 4 moves");
    }
}
use std::str::FromStr;

use cubelib::algs::Algorithm;
use cubelib::solver_new::dr::DRStep;
use cubelib::solver_new::eo::EOStep;
use cubelib::solver_new::finish::HTRFinishStep;
use cubelib::solver_new::group::StepGroup;
use cubelib::solver_new::htr::HTRStep;

fn main() {
    let eo_step = EOStep::builder().build();
    let dr_step = DRStep::builder().build();
    let htr_step = HTRStep::builder().build();
    let finish_step = HTRFinishStep::builder().build();

    let mut steps = StepGroup::sequential(vec![eo_step, dr_step, htr_step, finish_step]);
    steps.apply_step_limit(10); // We don't need an optimal solution here

    let cube = Algorithm::from_str("R' U' F L' B L' B2 U B2 D U2 L2 F2 L2 R2 D' L2 B' F' R' F L' F' U' R' U' F").unwrap().into();

    let mut worker = steps.into_worker(cube);

    if let Some(solution) = worker.next() {
        println!("{solution}");
    } else {
        println!("No solution found");
    }
}
use std::str::FromStr;

use cubelib::algs::Algorithm;
use cubelib::defs::NissSwitchType;
use cubelib::solver_new::dr::{DRStep, RZPStep};
use cubelib::solver_new::eo::EOStep;
use cubelib::solver_new::group::StepGroup;
use cubelib::solver_new::htr::HTRStep;
use cubelib::solver_new::util_steps::FilterLastMoveNotPrime;

fn main() {
    let eo_step = StepGroup::parallel(vec![
        // Niss EOs up to length 4
        EOStep::builder()
            .max_length(4)
            .niss(NissSwitchType::Always)
            .build(),
        // Linear EOs of length 5
        EOStep::builder()
            .min_length(5)
            .max_length(5)
            .niss(NissSwitchType::Before)
            .build()
    ]);

    let dr_step = StepGroup::parallel(vec![
        // Find direct DRs with up to 5 moves
        DRStep::builder()
            .max_length(5)
            .niss(NissSwitchType::Before)
            .build(),
        // Find longer DRs with certain triggers
        DRStep::builder()
            .max_absolute_length(13)
            .niss(NissSwitchType::Before)
            .triggers(vec![
                Algorithm::from_str("R").unwrap(),
                Algorithm::from_str("R U2 R").unwrap(),
                Algorithm::from_str("R U R").unwrap(),
                Algorithm::from_str("R U' R").unwrap(),
            ])
            .rzp(RZPStep::builder()
                .max_length(2)
                .max_absolute_length(6)
                .niss(NissSwitchType::Never)
                .build()
            )
            .build()
    ]);

    // Default HTR settings
    let htr_step = HTRStep::builder()
        .build();

    // Predicates are filters that run after a step. This one removes all solutions ending in a counter-clockwise move, because they are not interesting up to HTR.
    let mut steps = StepGroup::sequential_with_predicates(vec![eo_step, dr_step, htr_step], vec![FilterLastMoveNotPrime::new()]);

    let cube = Algorithm::from_str("R' U' F D2 R' D2 U2 R D2 L F2 R' F2 U2 D' B D R U' R B' L' R2 U R' U' F").unwrap().into();

    // Finding all solution optimally can take a while. It's usually recommended to set the 'quality' to limit the number of paths that are considered
    // steps.apply_step_limit(10000);

    // The worker can be used as an Iterator of Solution structs
    steps.into_worker(cube)
        .take_while(|x|x.len() <= 13) // This could and should have been configured on the HTR step using .max_absolute_length(13)
        .for_each(|s|println!("{s}"));
}
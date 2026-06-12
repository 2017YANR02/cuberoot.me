use itertools::Itertools;

use crate::algs::Algorithm;
use crate::cube::*;
use crate::defs::*;
use crate::solver::moveset::TransitionTable333;
use crate::solver::solution::Solution;
use crate::steps::{dr, MoveSet333, Step333};
use crate::steps::eo::coords::BadEdgeCount;
use crate::steps::step::{DefaultStepOptions, PostStepCheck, PreStepCheck, Step, StepConfig, StepVariant};

const QT_MOVES: [Turn333; 12] = [
    Turn333::new(CubeFace::Up, Direction::Clockwise),
    Turn333::new(CubeFace::Up, Direction::CounterClockwise),
    Turn333::new(CubeFace::Down, Direction::Clockwise),
    Turn333::new(CubeFace::Down, Direction::CounterClockwise),
    Turn333::new(CubeFace::Front, Direction::Clockwise),
    Turn333::new(CubeFace::Front, Direction::CounterClockwise),
    Turn333::new(CubeFace::Back, Direction::Clockwise),
    Turn333::new(CubeFace::Back, Direction::CounterClockwise),
    Turn333::new(CubeFace::Left, Direction::Clockwise),
    Turn333::new(CubeFace::Left, Direction::CounterClockwise),
    Turn333::new(CubeFace::Right, Direction::Clockwise),
    Turn333::new(CubeFace::Right, Direction::CounterClockwise),
];

pub const RZP_EO_FB_STATE_CHANGE_MOVES: &[Turn333] = &[
    Turn333::new(CubeFace::Up, Direction::Clockwise),
    Turn333::new(CubeFace::Up, Direction::CounterClockwise),
    Turn333::new(CubeFace::Down, Direction::Clockwise),
    Turn333::new(CubeFace::Down, Direction::CounterClockwise),
    Turn333::new(CubeFace::Right, Direction::Clockwise),
    Turn333::new(CubeFace::Right, Direction::CounterClockwise),
    Turn333::new(CubeFace::Left, Direction::Clockwise),
    Turn333::new(CubeFace::Left, Direction::CounterClockwise),
];

pub const RZP_EO_FB_AUX_MOVES: &[Turn333] = &[
    Turn333::new(CubeFace::Up, Direction::Half),
    Turn333::new(CubeFace::Down, Direction::Half),
    Turn333::new(CubeFace::Right, Direction::Half),
    Turn333::new(CubeFace::Left, Direction::Half),
    Turn333::new(CubeFace::Front, Direction::Half),
    Turn333::new(CubeFace::Back, Direction::Half),
];

pub const RZP_EO_FB_MOVESET: MoveSet333 = MoveSet333 {
    st_moves: RZP_EO_FB_STATE_CHANGE_MOVES,
    aux_moves: RZP_EO_FB_AUX_MOVES,
    transitions: &rzp_transitions(CubeFace::Left),
};

pub const RZP_ANY: MoveSet333 = MoveSet333 {
    st_moves: &QT_MOVES,
    aux_moves: dr::dr_config::HTR_MOVES,
    transitions: &rzp_transitions_any(),
};

pub struct RZPStep<'a> {
    move_set: &'a MoveSet333,
    pre_trans: Vec<Transformation333>,
    variant: crate::defs::StepVariant,
    is_any: bool,
}

pub fn from_step_config<'a>(config: StepConfig) -> Result<(Step333<'a>, DefaultStepOptions), String> {
    // let step = rzp_any();
    let step = rzp(vec![CubeAxis::X, CubeAxis::Y, CubeAxis::Z]);

    if !config.params.is_empty() {
        return Err(format!("Unreognized parameters: {:?}", config.params.keys()))
    }

    let search_opts = DefaultStepOptions::new(
        config.min.unwrap_or(0),
        config.max.unwrap_or(3),
        config.absolute_min,
        config.absolute_max,
        config.niss.unwrap_or(NissSwitchType::Never),
        if config.quality == 0 {
            None
        } else {
            config.step_limit.or(Some(config.quality * 10))
        }
    );
    Ok((step, search_opts))
}

pub fn rzp<'a>(eo_axis: Vec<CubeAxis>) -> Step333<'a> {
    let step_variants = eo_axis
        .into_iter()
        .map(move |x| {
            let x: Box<dyn StepVariant> = match x {
                CubeAxis::UD => Box::new(RZPStep::new_ud()),
                CubeAxis::FB => Box::new(RZPStep::new_fb()),
                CubeAxis::LR => Box::new(RZPStep::new_lr()),
            };
            x
        })
        .collect_vec();
    Step::new(step_variants, StepKind::RZP, false)
}

impl<'a> RZPStep<'a> {
    fn new_ud() -> Self {
        RZPStep {
            move_set: &RZP_EO_FB_MOVESET,
            pre_trans: vec![Transformation333::X],
            variant: crate::defs::StepVariant::RZP {
                eo_axis: CubeAxis::FB,
                dr_axis: CubeAxis::UD,
            },
            is_any: false,
        }
    }

    fn new_fb() -> Self {
        RZPStep {
            move_set: &RZP_EO_FB_MOVESET,
            pre_trans: vec![],
            variant: crate::defs::StepVariant::RZP {
                eo_axis: CubeAxis::LR,
                dr_axis: CubeAxis::FB,
            },
            is_any: false,
        }
    }

    fn new_lr() -> Self {
        RZPStep {
            move_set: &RZP_EO_FB_MOVESET,
            pre_trans: vec![Transformation333::Y],
            variant: crate::defs::StepVariant::RZP {
                eo_axis: CubeAxis::UD,
                dr_axis: CubeAxis::LR,
            },
            is_any: false,
        }
    }
}

impl<'a> PreStepCheck for RZPStep<'a> {
    fn is_cube_ready(&self, cube: &Cube333, _: Option<&Solution>) -> bool {
        if self.is_any {
            cube.edges.count_bad_edges_ud() == 0 || cube.edges.count_bad_edges_fb() == 0 || cube.edges.count_bad_edges_lr() == 0
        } else {
            cube.edges.count_bad_edges_fb() == 0
        }
    }
}

impl<'a> PostStepCheck for RZPStep<'a> {
    fn is_solution_admissible(&self, _: &Cube333, _: &Algorithm) -> bool {
        true
    }
}

impl<'a> StepVariant for RZPStep<'a> {
    fn move_set(&self, _: &Cube333, _: u8) -> &'a MoveSet333 {
        self.move_set
    }

    fn pre_step_trans(&self) -> &'_ Vec<Transformation333> {
        &self.pre_trans
    }

    fn heuristic(&self, _: &Cube333, depth_left: u8, _: bool) -> u8 {
        depth_left //RZP is a special step without a real goal. Filtering by bad edge/corner count is done in subsequent DR steps
    }

    fn get_variant(&self) -> crate::defs::StepVariant {
        self.variant
    }
}

const fn rzp_transitions(axis_face: CubeFace) -> [TransitionTable333; 18] {
    let mut transitions = [TransitionTable333::new(0, 0); 18];
    let mut i = 0;

    let can_end_mask = TransitionTable333::moves_to_mask([
        Turn333::U, Turn333::Ui,
        Turn333::D, Turn333::Di,
        Turn333::F, Turn333::Fi,
        Turn333::B, Turn333::Bi,
        Turn333::L, Turn333::Li,
        Turn333::R, Turn333::Ri]);

    while i < CubeFace::ALL.len() {
        transitions[Turn333::new(CubeFace::ALL[i], Direction::Clockwise).to_id()] = TransitionTable333::new(
            TransitionTable333::DEFAULT_ALLOWED_AFTER[CubeFace::ALL[i] as usize],
            can_end_mask,
        );
        transitions[Turn333::new(CubeFace::ALL[i], Direction::Half).to_id()] = TransitionTable333::new(
            TransitionTable333::DEFAULT_ALLOWED_AFTER[CubeFace::ALL[i] as usize],
            can_end_mask,
        );
        transitions[Turn333::new(CubeFace::ALL[i], Direction::CounterClockwise).to_id()] = TransitionTable333::new(
            TransitionTable333::DEFAULT_ALLOWED_AFTER[CubeFace::ALL[i] as usize],
            can_end_mask,
        );
        i += 1;
    }
    transitions[Turn333::new(axis_face, Direction::Half).to_id()] = TransitionTable333::new(
        TransitionTable333::DEFAULT_ALLOWED_AFTER[axis_face as usize],
        TransitionTable333::NONE,
    );
    transitions[Turn333::new(axis_face.opposite(), Direction::Half).to_id()] = TransitionTable333::new(
        TransitionTable333::DEFAULT_ALLOWED_AFTER[axis_face.opposite() as usize],
        TransitionTable333::NONE,
    );
    transitions
}

const fn rzp_transitions_any() -> [TransitionTable333; 18] {
    let mut transitions = [TransitionTable333::new(0, 0); 18];
    let mut i = 0;
    let can_end_mask = TransitionTable333::moves_to_mask(QT_MOVES);
    while i < CubeFace::ALL.len() {
        transitions[Turn333::new(CubeFace::ALL[i], Direction::Clockwise).to_id()] = TransitionTable333::new(
            TransitionTable333::DEFAULT_ALLOWED_AFTER[CubeFace::ALL[i] as usize],
            can_end_mask,
        );
        transitions[Turn333::new(CubeFace::ALL[i], Direction::Half).to_id()] = TransitionTable333::new(
            TransitionTable333::DEFAULT_ALLOWED_AFTER[CubeFace::ALL[i] as usize],
            can_end_mask,
        );
        transitions[Turn333::new(CubeFace::ALL[i], Direction::CounterClockwise).to_id()] = TransitionTable333::new(
            TransitionTable333::DEFAULT_ALLOWED_AFTER[CubeFace::ALL[i] as usize],
            can_end_mask,
        );
        i += 1;
    }
    transitions
}

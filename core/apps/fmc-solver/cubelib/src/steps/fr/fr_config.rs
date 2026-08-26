use std::rc::Rc;
use std::vec;

use itertools::Itertools;
use crate::cube::*;
use crate::defs::*;
use crate::solver::lookup_table::InMemoryIndexTable;
use crate::solver::moveset::TransitionTable333;
use crate::steps::fr::coords::{FRUD_NO_SLICE_SIZE, FRUD_WITH_SLICE_SIZE, FRUDNoSliceCoord, FRUDWithSliceCoord};
use crate::steps::htr::coords::{HTRDRUD_SIZE, HTRDRUDCoord};
use crate::steps::{MoveSet333, Step333};
use crate::steps::step::{DefaultPruningTableStep, DefaultStepOptions, Step, StepConfig, StepVariant};

pub const FR_UD_STATE_CHANGE_MOVES: &[Turn333] = &[
    Turn333::new(CubeFace::Up, Direction::Half),
    Turn333::new(CubeFace::Down, Direction::Half),
];

pub const FR_UD_AUX_MOVES: &[Turn333] = &[
    Turn333::new(CubeFace::Right, Direction::Half),
    Turn333::new(CubeFace::Left, Direction::Half),
    Turn333::new(CubeFace::Front, Direction::Half),
    Turn333::new(CubeFace::Back, Direction::Half),
];

pub const FR_UD_MOVESET: MoveSet333 = MoveSet333 {
    st_moves: FR_UD_STATE_CHANGE_MOVES,
    aux_moves: FR_UD_AUX_MOVES,
    transitions: &fr_transitions(CubeFace::Up),
};

pub type FRLeaveSlicePruningTable = InMemoryIndexTable<{ FRUD_NO_SLICE_SIZE }, FRUDNoSliceCoord>;
pub type FRPruningTable = InMemoryIndexTable<{ FRUD_WITH_SLICE_SIZE }, FRUDWithSliceCoord>;
pub type FRLeaveSlicePruningTableStep<'a> = DefaultPruningTableStep::<'a, {FRUD_NO_SLICE_SIZE}, FRUDNoSliceCoord, { HTRDRUD_SIZE }, HTRDRUDCoord>;
pub type FRPruningTableStep<'a> = DefaultPruningTableStep::<'a, {FRUD_WITH_SLICE_SIZE}, FRUDWithSliceCoord, { HTRDRUD_SIZE }, HTRDRUDCoord>;

pub fn from_step_config(table: &FRPruningTable, config: StepConfig) -> Result<(Step333<'_>, DefaultStepOptions), String> {
    let step = if let Some(substeps) = config.substeps {
        let axis: Result<Vec<CubeAxis>, String> = substeps.into_iter().map(|step| match step.to_lowercase().as_str() {
            "frud" | "ud" => Ok(CubeAxis::UD),
            "frfb" | "fb" => Ok(CubeAxis::FB),
            "frlr" | "lr" => Ok(CubeAxis::LR),
            x => Err(format!("Invalid FR substep {x}"))
        }).collect();
        fr(table, axis?)
    } else {
        fr_any(table)
    };

    if !config.params.is_empty() {
        return Err(format!("Unreognized parameters: {:?}", config.params.keys()))
    }

    let search_opts = DefaultStepOptions::new(
        config.min.unwrap_or(0),
        config.max.unwrap_or(10),
        config.absolute_min,
        config.absolute_max,
        config.niss.unwrap_or(NissSwitchType::Before),
        if config.quality == 0 {
            None
        } else {
            config.step_limit.or(Some(config.quality * 1))
        }
    );
    Ok((step, search_opts))
}

pub fn from_step_config_no_slice(table: &FRLeaveSlicePruningTable, config: StepConfig) -> Result<(Step333<'_>, DefaultStepOptions), String> {
    let step = if let Some(substeps) = config.substeps {
        let axis: Result<Vec<CubeAxis>, String> = substeps.into_iter().map(|step| match step.to_lowercase().as_str() {
            "frud" | "ud" => Ok(CubeAxis::UD),
            "frfb" | "fb" => Ok(CubeAxis::FB),
            "frlr" | "lr" => Ok(CubeAxis::LR),
            x => Err(format!("Invalid FRLS substep {x}"))
        }).collect();
        fr_no_slice(table, axis?)
    } else {
        fr_no_slice_any(table)
    };

    if !config.params.is_empty() {
        return Err(format!("Unreognized parameters fr: {:?}", config.params.keys()))
    }

    let search_opts = DefaultStepOptions::new(
        config.min.unwrap_or(0),
        config.max.unwrap_or(10),
        config.absolute_min,
        config.absolute_max,
        config.niss.unwrap_or(NissSwitchType::Before),
        if config.quality == 0 {
            None
        } else {
            config.step_limit.or(Some(config.quality * 1))
        }
    );
    Ok((step, search_opts))
}

pub fn fr_no_slice_any(table: &FRLeaveSlicePruningTable) -> Step333<'_> {
    fr_no_slice(table, vec![CubeAxis::UD, CubeAxis::FB, CubeAxis::LR])
}

pub fn fr_any(table: &FRPruningTable) -> Step333<'_> {
    fr(table, vec![CubeAxis::UD, CubeAxis::FB, CubeAxis::LR])
}

pub fn fr_no_slice<'a>(table: &'a FRLeaveSlicePruningTable, fr_axis: Vec<CubeAxis>) -> Step333<'a> {
    let step_variants = fr_axis
        .into_iter()
        .flat_map(move |x| {
            let variant = crate::defs::StepVariant::FRLS(x);
            let x: Option<Box<dyn StepVariant + 'a>> = match x {
                CubeAxis::UD => Some(Box::new(FRLeaveSlicePruningTableStep::new(&FR_UD_MOVESET, vec![], table, Rc::new(vec![]), variant))),
                CubeAxis::FB => Some(Box::new(FRLeaveSlicePruningTableStep::new(&FR_UD_MOVESET, vec![Transformation333::new(CubeAxis::X, Direction::Clockwise)], table, Rc::new(vec![]), variant))),
                CubeAxis::LR => Some(Box::new(FRLeaveSlicePruningTableStep::new(&FR_UD_MOVESET, vec![Transformation333::new(CubeAxis::Z, Direction::Clockwise)], table, Rc::new(vec![]), variant))),
            };
            x
        })
        .collect_vec();
    Step::new(step_variants, StepKind::FRLS, true)
}

pub fn fr<'a>(table: &'a FRPruningTable, fr_axis: Vec<CubeAxis>) -> Step333<'a> {
    let step_variants = fr_axis
        .into_iter()
        .flat_map(move |x| {
            let variant = crate::defs::StepVariant::FR(x);
            let x: Option<Box<dyn StepVariant + 'a>> = match x {
                CubeAxis::UD => Some(Box::new(FRPruningTableStep::new(&FR_UD_MOVESET, vec![], table, Rc::new(vec![]), variant))),
                CubeAxis::FB => Some(Box::new(FRPruningTableStep::new(&FR_UD_MOVESET, vec![Transformation333::new(CubeAxis::X, Direction::Clockwise)], table, Rc::new(vec![]), variant))),
                CubeAxis::LR => Some(Box::new(FRPruningTableStep::new(&FR_UD_MOVESET, vec![Transformation333::new(CubeAxis::Z, Direction::Clockwise)], table, Rc::new(vec![]), variant))),
            };
            x
        })
        .collect_vec();
    Step::new(step_variants, StepKind::FR, true)
}

const fn fr_transitions(axis_face: CubeFace) -> [TransitionTable333; 18] {
    let mut transitions = [TransitionTable333::new(0, 0); 18];
    let mut i = 0;
    let can_end_mask = TransitionTable333::moves_to_mask([
        Turn333::new(axis_face, Direction::Half),
        Turn333::new(axis_face.opposite(), Direction::Half),
    ]);
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

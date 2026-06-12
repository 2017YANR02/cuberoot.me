use std::rc::Rc;

use itertools::Itertools;

use crate::cube::*;
use crate::defs::*;
use crate::solver::lookup_table::InMemoryIndexTable;
use crate::solver::moveset::TransitionTable333;
use crate::steps::{fr, MoveSet333, Step333};
use crate::steps::dr::dr_config::DR_UD_EO_FB_MOVES;
use crate::steps::finish::coords::{FR_FINISH_SIZE, FRUDFinishCoord, HTR_FINISH_SIZE, HTR_LEAVE_SLICE_FINISH_SIZE, HTRFinishCoord, HTRLeaveSliceFinishCoord};
use crate::steps::fr::coords::{FRUD_NO_SLICE_SIZE, FRUD_WITH_SLICE_SIZE, FRUDNoSliceCoord, FRUDWithSliceCoord};
use crate::steps::htr::coords::{HTRDRUD_SIZE, HTRDRUDCoord};
use crate::steps::step::{DefaultPruningTableStep, DefaultStepOptions, Step, StepConfig, StepVariant};

pub const FRUD_FINISH_MOVESET: MoveSet333 = MoveSet333 {
    st_moves: fr::fr_config::FR_UD_AUX_MOVES,
    aux_moves: &[],
    transitions: &finish_transitions(),
};

pub const DR_UD_FINISH_MOVESET: MoveSet333 = MoveSet333 {
    st_moves: DR_UD_EO_FB_MOVES,
    aux_moves: &[],
    transitions: &finish_transitions(),
};

pub const HTR_FINISH_MOVESET: MoveSet333 = MoveSet333 {
    aux_moves: &[],
    st_moves: &[
        Turn333::new(CubeFace::Up, Direction::Half),
        Turn333::new(CubeFace::Down, Direction::Half),
        Turn333::new(CubeFace::Right, Direction::Half),
        Turn333::new(CubeFace::Left, Direction::Half),
        Turn333::new(CubeFace::Front, Direction::Half),
        Turn333::new(CubeFace::Back, Direction::Half),
    ],
    transitions: &finish_transitions(),
};
pub type FRFinishPruningTable = InMemoryIndexTable<{ FR_FINISH_SIZE }, FRUDFinishCoord>;
pub type FRFinishPruningTableStep<'a> = DefaultPruningTableStep::<'a, { FR_FINISH_SIZE }, FRUDFinishCoord, {FRUD_WITH_SLICE_SIZE}, FRUDWithSliceCoord>;

pub type FRFinishLeaveSlicePruningTableStep<'a> = DefaultPruningTableStep::<'a, { FR_FINISH_SIZE }, FRUDFinishCoord, {FRUD_NO_SLICE_SIZE}, FRUDNoSliceCoord>;

pub type HTRFinishPruningTable = InMemoryIndexTable<{ HTR_FINISH_SIZE }, HTRFinishCoord>;
pub type HTRFinishPruningTableStep<'a> = DefaultPruningTableStep::<'a, { HTR_FINISH_SIZE }, HTRFinishCoord, { HTRDRUD_SIZE }, HTRDRUDCoord>;

pub type HTRLeaveSliceFinishPruningTable = InMemoryIndexTable<{ HTR_LEAVE_SLICE_FINISH_SIZE }, HTRLeaveSliceFinishCoord>;
pub type HTRLeaveSliceFinishPruningTableStep<'a> = DefaultPruningTableStep::<'a, { HTR_LEAVE_SLICE_FINISH_SIZE }, HTRLeaveSliceFinishCoord, { HTRDRUD_SIZE }, HTRDRUDCoord>;

pub fn from_step_config_fr(table: &FRFinishPruningTable, config: StepConfig) -> Result<(Step333<'_>, DefaultStepOptions), String> {
    let step = if let Some(substeps) = config.substeps {
        let axis: Result<Vec<CubeAxis>, String> = substeps.into_iter().map(|step| match step.to_lowercase().as_str() {
            "finishud" | "finud" | "ud" => Ok(CubeAxis::UD),
            "finishfb" | "finfb" | "fb" => Ok(CubeAxis::FB),
            "finishlr" | "finlr" | "lr" => Ok(CubeAxis::LR),
            x => Err(format!("Invalid HTR substep {x}"))
        }).collect();
        fr_finish(table, axis?)
    } else {
        fr_finish_any(table)
    };

    if !config.params.is_empty() {
        return Err(format!("Unreognized parameters: {:?}", config.params.keys()))
    }

    let search_opts = DefaultStepOptions::new(
        config.min.unwrap_or(0),
        config.max.unwrap_or(10),
        config.absolute_min,
        config.absolute_max,
        NissSwitchType::Never,
        if config.quality == 0 {
            None
        } else {
            config.step_limit.or(Some(config.quality * 1))
        }
    );
    Ok((step, search_opts))
}

pub fn from_step_config_fr_leave_slice(table: &FRFinishPruningTable, config: StepConfig) -> Result<(Step333<'_>, DefaultStepOptions), String> {
    let step = if let Some(substeps) = config.substeps {
        let axis: Result<Vec<CubeAxis>, String> = substeps.into_iter().map(|step| match step.to_lowercase().as_str() {
            "finishud" | "finud" | "ud" => Ok(CubeAxis::UD),
            "finishfb" | "finfb" | "fb" => Ok(CubeAxis::FB),
            "finishlr" | "finlr" | "lr" => Ok(CubeAxis::LR),
            x => Err(format!("Invalid HTR substep {x}"))
        }).collect();
        fr_finish_leave_slice(table, axis?)
    } else {
        fr_finish_leave_slice_any(table)
    };

    if !config.params.is_empty() {
        return Err(format!("Unreognized parameters: {:?}", config.params.keys()))
    }

    let search_opts = DefaultStepOptions::new(
        config.min.unwrap_or(0),
        config.max.unwrap_or(10),
        config.absolute_min,
        config.absolute_max,
        NissSwitchType::Never,
        if config.quality == 0 {
            None
        } else {
            config.step_limit.or(Some(config.quality * 1))
        }
    );
    Ok((step, search_opts))
}

pub fn from_step_config_htr(table: &HTRFinishPruningTable, config: StepConfig) -> Result<(Step333<'_>, DefaultStepOptions), String> {
    let search_opts = DefaultStepOptions::new(
        config.min.unwrap_or(0),
        config.max.unwrap_or(10),
        config.absolute_min,
        config.absolute_max,
        NissSwitchType::Never,
        if config.quality == 0 {
            None
        } else {
            config.step_limit.or(Some(config.quality * 1))
        }
    );
    Ok((htr_finish(table), search_opts))
}

pub fn from_step_config_htr_leave_slice(table: &HTRLeaveSliceFinishPruningTable, config: StepConfig) -> Result<(Step333<'_>, DefaultStepOptions), String> {
    let step = if let Some(substeps) = config.substeps {
        let axis: Result<Vec<CubeAxis>, String> = substeps.into_iter().map(|step| match step.to_lowercase().as_str() {
            "finishud" | "finud" | "ud" => Ok(CubeAxis::UD),
            "finishfb" | "finfb" | "fb" => Ok(CubeAxis::FB),
            "finishlr" | "finlr" | "lr" => Ok(CubeAxis::LR),
            x => Err(format!("Invalid leave slice finish axis {x}"))
        }).collect();
        htr_finish_leave_slice(table, axis?)
    } else {
        htr_finish_leave_slice_any(table)
    };

    if !config.params.is_empty() {
        return Err(format!("Unreognized parameters: {:?}", config.params.keys()))
    }

    let search_opts = DefaultStepOptions::new(
        config.min.unwrap_or(0),
        config.max.unwrap_or(10),
        config.absolute_min,
        config.absolute_max,
        NissSwitchType::Never,
        if config.quality == 0 {
            None
        } else {
            config.step_limit.or(Some(config.quality * 1))
        }
    );
    Ok((step, search_opts))
}

pub fn fr_finish_any(table: &FRFinishPruningTable) -> Step333<'_> {
    fr_finish(table, vec![CubeAxis::UD, CubeAxis::FB, CubeAxis::LR])
}

pub fn fr_finish<'a>(table: &'a FRFinishPruningTable, fr_axis: Vec<CubeAxis>) -> Step333<'a> {
    let step_variants = fr_axis
        .into_iter()
        .flat_map(move |x| {
            let variant = crate::defs::StepVariant::FRFIN(x);
            let x: Option<Box<dyn StepVariant + 'a>> = match x {
                CubeAxis::UD => Some(Box::new(FRFinishPruningTableStep::new(&FRUD_FINISH_MOVESET, vec![], table, Rc::new(vec![]), variant))),
                CubeAxis::FB => Some(Box::new(FRFinishPruningTableStep::new(&FRUD_FINISH_MOVESET, vec![Transformation333::new(CubeAxis::X, Direction::Clockwise)], table, Rc::new(vec![]), variant))),
                CubeAxis::LR => Some(Box::new(FRFinishPruningTableStep::new(&FRUD_FINISH_MOVESET, vec![Transformation333::new(CubeAxis::Z, Direction::Clockwise)], table, Rc::new(vec![]), variant))),
            };
            x
        })
        .collect_vec();
    Step::new(step_variants, StepKind::FIN, true)
}

pub fn htr_finish(table: &HTRFinishPruningTable) -> Step333<'_> {
    Step::new(vec![
        Box::new(HTRFinishPruningTableStep::new(&HTR_FINISH_MOVESET, vec![], table, Rc::new(vec![]), crate::defs::StepVariant::HTRFIN))
    ], StepKind::FIN, true)
}

pub fn htr_finish_leave_slice_any(table: &HTRLeaveSliceFinishPruningTable) -> Step333<'_> {
    htr_finish_leave_slice(table, vec![CubeAxis::UD, CubeAxis::FB, CubeAxis::LR])
}

pub fn htr_finish_leave_slice<'a>(table: &'a HTRLeaveSliceFinishPruningTable, slice_axis: Vec<CubeAxis>) -> Step333<'a> {
    let step_variants = slice_axis
        .into_iter()
        .flat_map(move |x| {
            let variant = crate::defs::StepVariant::HTRFINLS(x);
            let x: Option<Box<dyn StepVariant + 'a>> = match x {
                CubeAxis::UD => Some(Box::new(HTRLeaveSliceFinishPruningTableStep::new(&HTR_FINISH_MOVESET, vec![], table, Rc::new(vec![]), variant))),
                CubeAxis::FB => Some(Box::new(HTRLeaveSliceFinishPruningTableStep::new(&HTR_FINISH_MOVESET, vec![Transformation333::new(CubeAxis::X, Direction::Clockwise)], table, Rc::new(vec![]), variant))),
                CubeAxis::LR => Some(Box::new(HTRLeaveSliceFinishPruningTableStep::new(&HTR_FINISH_MOVESET, vec![Transformation333::new(CubeAxis::Z, Direction::Clockwise)], table, Rc::new(vec![]), variant))),
            };
            x
        })
        .collect_vec();
    Step::new(step_variants, StepKind::FINLS, true)
}


pub fn fr_finish_leave_slice_any(table: &FRFinishPruningTable) -> Step333<'_> {
    fr_finish_leave_slice(table, vec![CubeAxis::UD, CubeAxis::FB, CubeAxis::LR])
}

pub fn fr_finish_leave_slice<'a>(table: &'a FRFinishPruningTable, fr_axis: Vec<CubeAxis>) -> Step333<'a> {
    let step_variants = fr_axis
        .into_iter()
        .flat_map(move |x| {
            let variant = crate::defs::StepVariant::FRFINLS(x);
            let x: Option<Box<dyn StepVariant + 'a>> = match x {
                CubeAxis::UD => Some(Box::new(FRFinishLeaveSlicePruningTableStep::new(&FRUD_FINISH_MOVESET, vec![], table, Rc::new(vec![]), variant))),
                CubeAxis::FB => Some(Box::new(FRFinishLeaveSlicePruningTableStep::new(&FRUD_FINISH_MOVESET, vec![Transformation333::new(CubeAxis::X, Direction::Clockwise)], table, Rc::new(vec![]), variant))),
                CubeAxis::LR => Some(Box::new(FRFinishLeaveSlicePruningTableStep::new(&FRUD_FINISH_MOVESET, vec![Transformation333::new(CubeAxis::Z, Direction::Clockwise)], table, Rc::new(vec![]), variant))),
            };
            x
        })
        .collect_vec();
    Step::new(step_variants, StepKind::FIN, true)
}

const fn finish_transitions() -> [TransitionTable333; 18] {
    let mut transitions = [TransitionTable333::new(0, 0); 18];
    let mut i = 0;
    let can_end_mask = TransitionTable333::ANY;
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

use std::rc::Rc;
use std::vec;

use itertools::Itertools;

use crate::cube::*;
use crate::defs::*;
use crate::solver::lookup_table::InMemoryIndexTable;
use crate::solver::moveset::TransitionTable333;
use crate::steps::{MoveSet333, Step333};
use crate::steps::dr::coords::{DRUD_SIZE, DRUDCoord, DRUDEOFB_SIZE, DRUDEOFBCoord};
use crate::steps::eo::coords::EOCoordFB;
#[cfg(feature = "333htr")]
use crate::steps::htr::htr_config::HTRSubsetTable;
use crate::steps::step::{DefaultPruningTableStep, DefaultStepOptions, PostStepCheck, Step, StepConfig, StepVariant};

pub const HTR_DR_UD_STATE_CHANGE_MOVES: &[Turn333] = &[
    Turn333::new(CubeFace::Up, Direction::Clockwise),
    Turn333::new(CubeFace::Up, Direction::CounterClockwise),
    Turn333::new(CubeFace::Down, Direction::Clockwise),
    Turn333::new(CubeFace::Down, Direction::CounterClockwise),
];

pub const HTR_MOVES: &[Turn333] = &[
    Turn333::new(CubeFace::Up, Direction::Half),
    Turn333::new(CubeFace::Down, Direction::Half),
    Turn333::new(CubeFace::Right, Direction::Half),
    Turn333::new(CubeFace::Left, Direction::Half),
    Turn333::new(CubeFace::Front, Direction::Half),
    Turn333::new(CubeFace::Back, Direction::Half),
];

pub const HTR_DR_UD_MOVESET: MoveSet333 = MoveSet333 {
    st_moves: HTR_DR_UD_STATE_CHANGE_MOVES,
    aux_moves: HTR_MOVES,
    transitions: &dr_transitions(CubeFace::Up),
};

pub const DR_UD_EO_FB_STATE_CHANGE_MOVES: &[Turn333] = &[
    Turn333::new(CubeFace::Right, Direction::Clockwise),
    Turn333::new(CubeFace::Right, Direction::CounterClockwise),
    Turn333::new(CubeFace::Left, Direction::Clockwise),
    Turn333::new(CubeFace::Left, Direction::CounterClockwise),
];

pub const DR_UD_EO_FB_MOVES: &[Turn333] = &[
    Turn333::new(CubeFace::Up, Direction::Clockwise),
    Turn333::new(CubeFace::Up, Direction::CounterClockwise),
    Turn333::new(CubeFace::Up, Direction::Half),
    Turn333::new(CubeFace::Down, Direction::Clockwise),
    Turn333::new(CubeFace::Down, Direction::CounterClockwise),
    Turn333::new(CubeFace::Down, Direction::Half),
    Turn333::new(CubeFace::Right, Direction::Half),
    Turn333::new(CubeFace::Left, Direction::Half),
    Turn333::new(CubeFace::Front, Direction::Half),
    Turn333::new(CubeFace::Back, Direction::Half),
];

pub const PRE_ARD_UD_EO_FB_AUX_MOVES: &[Turn333] = &[
    Turn333::U2,
    Turn333::D2,
    Turn333::F2,
    Turn333::B2,
    Turn333::L, Turn333::Li, Turn333::L2,
    Turn333::R, Turn333::Ri, Turn333::R2
];

pub const ARM_UD_EO_FB_MOVESET: MoveSet333 = MoveSet333 {
    st_moves: DR_UD_EO_FB_STATE_CHANGE_MOVES,
    aux_moves: HTR_MOVES,
    transitions: &dr_transitions(CubeFace::Left),
};

pub const PRE_AR_UD_EO_FB_MOVESET: MoveSet333 = MoveSet333 {
    st_moves: HTR_DR_UD_STATE_CHANGE_MOVES,
    aux_moves: PRE_ARD_UD_EO_FB_AUX_MOVES,
    transitions: &dr_transitions(CubeFace::Left),
};

pub const DR_UD_EO_FB_MOVESET: MoveSet333 = MoveSet333 {
    st_moves: DR_UD_EO_FB_STATE_CHANGE_MOVES,
    aux_moves: DR_UD_EO_FB_MOVES,
    transitions: &dr_transitions(CubeFace::Left),
};

pub type DRDirectPruningTable = InMemoryIndexTable<{ DRUD_SIZE }, DRUDCoord>;
pub type DRPruningTable = InMemoryIndexTable<{ DRUDEOFB_SIZE }, DRUDEOFBCoord>;
pub type DRPruningTableStep<'a> = DefaultPruningTableStep<'a, {DRUDEOFB_SIZE}, DRUDEOFBCoord, 2048, EOCoordFB>;
pub type EOARPruningTable = InMemoryIndexTable<{ DRUDEOFB_SIZE }, DRUDEOFBCoord>;
pub type ARDRPruningTable = InMemoryIndexTable<{ DRUDEOFB_SIZE }, DRUDEOFBCoord>;

pub fn from_step_config<'a>(table: &'a DRPruningTable, #[cfg(feature = "333htr")] subset_table: &'a HTRSubsetTable, mut config: StepConfig) -> Result<(Step333<'a>, DefaultStepOptions), String> {
    #[cfg(feature = "333htr")]
    let post_step_filters: Vec<Box<dyn PostStepCheck>> = config.params.remove("subsets")
        .map(|x|x.split(",").map(|x|x.to_string()).collect_vec())
        .and_then(|subsets| crate::steps::htr::subsets::dr_subset_filter(subset_table, &subsets))
        .map(|filter|{
            let b: Box<dyn PostStepCheck> = Box::new(filter);
            vec![b]
        })
        .unwrap_or(vec![]);
    #[cfg(not(feature = "333htr"))]
    let post_step_filters: Vec<Box<dyn PostStepCheck>> = vec![];

    let psc = Rc::new(post_step_filters);

    let step = if let Some(substeps) = config.substeps {
        let variants: Result<Vec<Vec<Box<dyn StepVariant>>>, String> = substeps.into_iter().map(|step| match step.to_lowercase().as_str() {
            "ud" | "drud" => Ok(dr_step_variants(table, vec![CubeAxis::FB, CubeAxis::LR], vec![CubeAxis::UD], psc.clone())),
            "fb" | "drfb" => Ok(dr_step_variants(table, vec![CubeAxis::UD, CubeAxis::LR], vec![CubeAxis::FB], psc.clone())),
            "lr" | "drlr" => Ok(dr_step_variants(table, vec![CubeAxis::UD, CubeAxis::FB], vec![CubeAxis::LR], psc.clone())),

            "eoud" => Ok(dr_step_variants(table, vec![CubeAxis::UD], vec![CubeAxis::FB, CubeAxis::LR], psc.clone())),
            "eofb" => Ok(dr_step_variants(table, vec![CubeAxis::FB], vec![CubeAxis::UD, CubeAxis::LR], psc.clone())),
            "eolr" => Ok(dr_step_variants(table, vec![CubeAxis::LR], vec![CubeAxis::UD, CubeAxis::FB], psc.clone())),

            "drud-eofb" => Ok(dr_step_variants(table, vec![CubeAxis::FB], vec![CubeAxis::UD], psc.clone())),
            "drud-eolr" => Ok(dr_step_variants(table, vec![CubeAxis::LR], vec![CubeAxis::UD], psc.clone())),
            "drfb-eoud" => Ok(dr_step_variants(table, vec![CubeAxis::UD], vec![CubeAxis::FB], psc.clone())),
            "drfb-eolr" => Ok(dr_step_variants(table, vec![CubeAxis::LR], vec![CubeAxis::FB], psc.clone())),
            "drlr-eoud" => Ok(dr_step_variants(table, vec![CubeAxis::UD], vec![CubeAxis::LR], psc.clone())),
            "drlr-eofb" => Ok(dr_step_variants(table, vec![CubeAxis::FB], vec![CubeAxis::LR], psc.clone())),

            x => Err(format!("Invalid DR substep {x}"))
        }).collect();
        let variants = variants?.into_iter().flat_map(|v|v).collect_vec();
        Step333::new(variants, StepKind::DR, true)
    } else {
        dr_any(table, psc)
    };

    if !config.params.is_empty() {
        return Err(format!("Unreognized parameters: {:?}", config.params.keys()))
    }

    let search_opts = DefaultStepOptions::new(
        config.min.unwrap_or(0),
        config.max.unwrap_or(12),
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

fn dr_step_variants<'a>(table: &'a DRPruningTable, eo_axis: Vec<CubeAxis>, dr_axis: Vec<CubeAxis>, psc: Rc<Vec<Box<dyn PostStepCheck + 'a>>>) -> Vec<Box<dyn StepVariant + 'a>> {
    eo_axis
        .into_iter()
        .flat_map(|eo| dr_axis.clone().into_iter().map(move |dr| (dr, eo)))
        .flat_map(move |(dr, eo)| {
            let variant = crate::defs::StepVariant::DR{
                eo_axis: eo,
                dr_axis: dr,
            };
            let x: Option<Box<dyn StepVariant>> = match (eo, dr) {
                (CubeAxis::UD, CubeAxis::FB) => Some(Box::new(DRPruningTableStep::new(&DR_UD_EO_FB_MOVESET, vec![Transformation333::X], table, psc.clone(), variant))),
                (CubeAxis::UD, CubeAxis::LR) => Some(Box::new(DRPruningTableStep::new(&DR_UD_EO_FB_MOVESET, vec![Transformation333::X, Transformation333::Z], table, psc.clone(), variant))),
                (CubeAxis::FB, CubeAxis::UD) => Some(Box::new(DRPruningTableStep::new(&DR_UD_EO_FB_MOVESET, vec![], table, psc.clone(), variant))),
                (CubeAxis::FB, CubeAxis::LR) => Some(Box::new(DRPruningTableStep::new(&DR_UD_EO_FB_MOVESET, vec![Transformation333::Z], table, psc.clone(), variant))),
                (CubeAxis::LR, CubeAxis::UD) => Some(Box::new(DRPruningTableStep::new(&DR_UD_EO_FB_MOVESET, vec![Transformation333::Y], table, psc.clone(), variant))),
                (CubeAxis::LR, CubeAxis::FB) => Some(Box::new(DRPruningTableStep::new(&DR_UD_EO_FB_MOVESET, vec![Transformation333::Y, Transformation333::Z], table, psc.clone(), variant))),
                (_eo, _dr) => None,
            };
            x
        })
        .collect_vec()
}

pub fn dr<'a>(table: &'a DRPruningTable, eo_axis: Vec<CubeAxis>, dr_axis: Vec<CubeAxis>, post_step_checks: Rc<Vec<Box<dyn PostStepCheck + 'a>>>) -> Step333<'a> {
    let step_variants = dr_step_variants(table, eo_axis, dr_axis, post_step_checks);
    Step::new(step_variants, StepKind::DR, true)
}

pub fn dr_any<'a>(table: &'a DRPruningTable, post_step_checks: Rc<Vec<Box<dyn PostStepCheck + 'a>>>) -> Step333<'a> {
    dr(table, vec![CubeAxis::UD, CubeAxis::FB, CubeAxis::LR], vec![CubeAxis::UD, CubeAxis::FB, CubeAxis::LR], post_step_checks)
}

const fn dr_transitions(axis_face: CubeFace) -> [TransitionTable333; 18] {
    crate::steps::eo::eo_config::eo_transitions(axis_face)
}

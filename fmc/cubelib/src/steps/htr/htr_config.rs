use std::rc::Rc;

use itertools::Itertools;
use crate::cube::*;
use crate::defs::*;
use crate::solver::lookup_table::{InMemoryIndexTable, InMemoryNissIndexTable};
use crate::steps::dr::coords::{DRUDEOFB_SIZE, DRUDEOFBCoord};
pub(crate) use crate::steps::dr::dr_config::HTR_DR_UD_MOVESET;
use crate::steps::htr::coords::{HTRDRUD_SIZE, HTRDRUDCoord};
use crate::steps::step::{DefaultPruningTableStep, DefaultStepOptions, Step, StepConfig, StepVariant};
use crate::steps::Step333;

pub type HTRPruningTable = InMemoryNissIndexTable<{ HTRDRUD_SIZE }, HTRDRUDCoord>;
pub type HTRSubsetTable = InMemoryIndexTable<{ HTRDRUD_SIZE }, HTRDRUDCoord>;
pub type HTRPruningTableStep<'a> = DefaultPruningTableStep<'a, {HTRDRUD_SIZE}, HTRDRUDCoord, {DRUDEOFB_SIZE}, DRUDEOFBCoord>;

pub fn from_step_config(table: &HTRPruningTable, config: StepConfig) -> Result<(Step333<'_>, DefaultStepOptions), String> {
    let step = if let Some(substeps) = config.substeps {
        let axis: Result<Vec<CubeAxis>, String> = substeps.into_iter().map(|step| match step.to_lowercase().as_str() {
            "htrud" | "ud" => Ok(CubeAxis::UD),
            "htrfb" | "fb" => Ok(CubeAxis::FB),
            "htrlr" | "lr" => Ok(CubeAxis::LR),
            x => Err(format!("Invalid HTR substep {x}"))
        }).collect();
        htr(table, axis?)
    } else {
        htr_any(table)
    };

    if !config.params.is_empty() {
        return Err(format!("Unreognized parameters: {:?}", config.params.keys()))
    }

    let search_opts = DefaultStepOptions::new(
        config.min.unwrap_or(0),
        config.max.unwrap_or(14),
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

pub fn htr_any(table: &HTRPruningTable) -> Step333<'_> {
    htr(table, vec![CubeAxis::UD, CubeAxis::FB, CubeAxis::LR])
}

pub fn htr<'a>(table: &'a HTRPruningTable, dr_axis: Vec<CubeAxis>) -> Step333<'a> {
    let step_variants = dr_axis
        .into_iter()
        .flat_map(move |x| {
            let variant = crate::defs::StepVariant::HTR(x);
            let x: Option<Box<dyn StepVariant + 'a>> = match x {
                CubeAxis::UD => Some(Box::new(HTRPruningTableStep::new_niss_table(&HTR_DR_UD_MOVESET, vec![], table, Rc::new(vec![]), variant))),
                CubeAxis::FB => Some(Box::new(HTRPruningTableStep::new_niss_table(&HTR_DR_UD_MOVESET, vec![Transformation333::new(CubeAxis::X, Direction::Clockwise)], table, Rc::new(vec![]), variant))),
                CubeAxis::LR => Some(Box::new(HTRPruningTableStep::new_niss_table(&HTR_DR_UD_MOVESET, vec![Transformation333::new(CubeAxis::Z, Direction::Clockwise)], table, Rc::new(vec![]), variant))),
            };
            x
        })
        .collect_vec();
    Step::new(step_variants, StepKind::HTR, true)
}

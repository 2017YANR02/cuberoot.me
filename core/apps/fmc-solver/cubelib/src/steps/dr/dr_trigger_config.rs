use std::cmp::min;
use std::collections::HashMap;
use std::rc::Rc;
use std::str::FromStr;
use std::vec;

use itertools::Itertools;
use log::{debug, warn, error};

use crate::algs::Algorithm;
use crate::steps::dr::co::COCountUD;
use crate::defs::*;
use crate::cube::*;
use crate::cube::turn::{TransformableMut, TurnableMut};
#[cfg(feature = "333htr")]
use crate::steps::htr::htr_config::HTRSubsetTable;
use crate::solver::lookup_table::DepthEstimate;
use crate::solver::moveset::TransitionTable333;
use crate::solver::solution::Solution;
use crate::steps::dr::dr_config::{DR_UD_EO_FB_MOVES, DR_UD_EO_FB_MOVESET, DR_UD_EO_FB_STATE_CHANGE_MOVES, DRPruningTable, HTR_DR_UD_MOVESET};
use crate::steps::{MoveSet333, Step333};
use crate::steps::coord::Coord;
use crate::steps::dr::coords::DRUDEOFBCoord;
use crate::steps::eo::coords::{BadEdgeCount, EOCoordFB};
use crate::steps::step::{DefaultStepOptions, PostStepCheck, PreStepCheck, Step, StepConfig, StepVariant};

pub const DR_UD_EO_FB_TRIGGER_MOVESET: MoveSet333 = MoveSet333 {
    st_moves: DR_UD_EO_FB_STATE_CHANGE_MOVES,
    aux_moves: DR_UD_EO_FB_MOVES,
    transitions: &TransitionTable333::all_unordered(),
};

pub struct DRTriggerStepTable<'a> {
    pre_trigger_move_set: &'a MoveSet333,
    trigger_move_set: &'a MoveSet333,
    pre_trans: Vec<Transformation333>,
    table: &'a DRPruningTable,
    trigger_types: HashMap<(u8, u8), u8>,
    trigger_variants: Vec<Vec<Turn333>>,
    post_step_checks: Rc<Vec<Box<dyn PostStepCheck + 'a>>>,
    variant: crate::defs::StepVariant,
}

pub fn from_step_config<'a>(table: &'a DRPruningTable, #[cfg(feature = "333htr")] subset_table: &'a HTRSubsetTable, mut config: StepConfig) -> Result<(Step333<'a>, DefaultStepOptions), String> {
    #[cfg(feature = "333htr")]
    let post_step_filters: Vec<Box<dyn PostStepCheck>> = config.params.remove("subsets")
        .map(|x|x.split(",").map(|x|x.to_string()).collect_vec())
        .and_then(|subsets| crate::steps::htr::subsets::dr_subset_filter(subset_table, &subsets))
        .map(|filter|{
            let b: Box<dyn PostStepCheck + 'a> = Box::new(filter);
            vec![b]
        })
        .unwrap_or(vec![]);
    #[cfg(not(feature = "333htr"))]
    let post_step_filters: Vec<Box<dyn PostStepCheck>> = vec![];

    let psc = Rc::new(post_step_filters);

    let triggers = config.params
        .remove("triggers")
        .iter()
        .flat_map(move |trig|trig.split(","))
        .filter_map(move |trig|{
            let alg = Algorithm::from_str(trig.to_uppercase().as_str());
            match alg {
                Err(_) => {
                    error!("Unable to parse trigger {trig}.");
                    None
                },
                Ok(alg) => Some(alg)
            }
        })
        .collect_vec();

    let step = if let Some(substeps) = config.substeps {
        let variants: Result<Vec<Vec<Box<dyn StepVariant>>>, String> = substeps.into_iter().map(|step| match step.to_lowercase().as_str() {
            "ud" | "drud" => Ok(dr_step_variants(table, vec![CubeAxis::FB, CubeAxis::LR], vec![CubeAxis::UD], triggers.clone(), psc.clone())),
            "fb" | "drfb" => Ok(dr_step_variants(table, vec![CubeAxis::UD, CubeAxis::LR], vec![CubeAxis::FB], triggers.clone(), psc.clone())),
            "lr" | "drlr" => Ok(dr_step_variants(table, vec![CubeAxis::UD, CubeAxis::FB], vec![CubeAxis::LR], triggers.clone(), psc.clone())),

            "eoud" => Ok(dr_step_variants(table, vec![CubeAxis::UD], vec![CubeAxis::FB, CubeAxis::LR], triggers.clone(), psc.clone())),
            "eofb" => Ok(dr_step_variants(table, vec![CubeAxis::FB], vec![CubeAxis::UD, CubeAxis::LR], triggers.clone(), psc.clone())),
            "eolr" => Ok(dr_step_variants(table, vec![CubeAxis::LR], vec![CubeAxis::UD, CubeAxis::FB], triggers.clone(), psc.clone())),

            "drud-eofb" => Ok(dr_step_variants(table, vec![CubeAxis::FB], vec![CubeAxis::UD], triggers.clone(), psc.clone())),
            "drud-eolr" => Ok(dr_step_variants(table, vec![CubeAxis::LR], vec![CubeAxis::UD], triggers.clone(), psc.clone())),
            "drfb-eoud" => Ok(dr_step_variants(table, vec![CubeAxis::UD], vec![CubeAxis::FB], triggers.clone(), psc.clone())),
            "drfb-eolr" => Ok(dr_step_variants(table, vec![CubeAxis::LR], vec![CubeAxis::FB], triggers.clone(), psc.clone())),
            "drlr-eoud" => Ok(dr_step_variants(table, vec![CubeAxis::UD], vec![CubeAxis::LR], triggers.clone(), psc.clone())),
            "drlr-eofb" => Ok(dr_step_variants(table, vec![CubeAxis::FB], vec![CubeAxis::LR], triggers.clone(), psc.clone())),

            x => Err(format!("Invalid DR substep {x}"))
        }).collect();
        let variants = variants?.into_iter().flat_map(|v|v).collect_vec();
        Step::new(variants, StepKind::DR, true)
    } else {
        dr_any(table, triggers, psc)
    };

    if !config.params.is_empty() {
        return Err(format!("Unreognized parameters dr: {:?}", config.params.keys()))
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

pub fn dr<'a>(
    table: &'a DRPruningTable,
    eo_axis: Vec<CubeAxis>,
    dr_axis: Vec<CubeAxis>,
    triggers: Vec<Algorithm>,
    psc: Rc<Vec<Box<dyn PostStepCheck + 'a>>>)
-> Step333<'a> {
    let step_variants = dr_step_variants(table, eo_axis, dr_axis, triggers, psc);
    Step::new(step_variants, StepKind::DR, true)
}

pub fn dr_any<'a>(table: &'a DRPruningTable, triggers: Vec<Algorithm>, psc: Rc<Vec<Box<dyn PostStepCheck + 'a>>>) -> Step333<'a> {
    dr(table, vec![CubeAxis::UD, CubeAxis::FB, CubeAxis::LR], vec![CubeAxis::UD, CubeAxis::FB, CubeAxis::LR], triggers, psc)
}

fn dr_step_variants<'a>(
    table: &'a DRPruningTable,
    eo_axis: Vec<CubeAxis>,
    dr_axis: Vec<CubeAxis>,
    triggers: Vec<Algorithm>,
    psc: Rc<Vec<Box<dyn PostStepCheck + 'a>>>
) -> Vec<Box<dyn StepVariant + 'a>> {
    eo_axis
        .into_iter()
        .flat_map(|eo| dr_axis.clone().into_iter().map(move |dr| (eo, dr)))
        .flat_map(move |(eo, dr)| {
            let variant = crate::defs::StepVariant::DR { eo_axis: eo, dr_axis: dr };
            let x: Option<Box<dyn StepVariant>> = match (eo, dr) {
                (CubeAxis::UD, CubeAxis::FB) => Some(Box::new(DRTriggerStepTable::new(vec![Transformation333::X], table, triggers.clone(), psc.clone(), variant))),
                (CubeAxis::UD, CubeAxis::LR) => Some(Box::new(DRTriggerStepTable::new(vec![Transformation333::X, Transformation333::Z], table, triggers.clone(), psc.clone(), variant))),
                (CubeAxis::FB, CubeAxis::UD) => Some(Box::new(DRTriggerStepTable::new(vec![], table, triggers.clone(), psc.clone(), variant))),
                (CubeAxis::FB, CubeAxis::LR) => Some(Box::new(DRTriggerStepTable::new(vec![Transformation333::Z], table, triggers.clone(), psc.clone(), variant))),
                (CubeAxis::LR, CubeAxis::UD) => Some(Box::new(DRTriggerStepTable::new(vec![Transformation333::Y], table, triggers.clone(), psc.clone(), variant))),
                (CubeAxis::LR, CubeAxis::FB) => Some(Box::new(DRTriggerStepTable::new(vec![Transformation333::Y, Transformation333::Z], table, triggers.clone(), psc.clone(), variant))),
                _ => None,
            };
            x
        })
        .collect_vec()
}

impl<'a> DRTriggerStepTable<'a> {

    fn new(pre_trans: Vec<Transformation333>, table: &'a DRPruningTable, triggers: Vec<Algorithm>, post_step_checks: Rc<Vec<Box<dyn PostStepCheck + 'a>>>, variant: crate::defs::StepVariant) -> Self {
        let mut trigger_variants = vec![];
        let mut trigger_types: HashMap<(u8, u8), u8> = HashMap::new();
        for trigger in triggers.into_iter() {
            let mut cube = Cube333::default();
            for (m, len) in trigger.normal_moves.iter().rev().zip(1..) {
                cube.turn(m.clone());
                if DR_UD_EO_FB_MOVESET.st_moves.contains(m) {
                    let rzp_state = calc_rzp_state(&cube);
                    trigger_types.insert(rzp_state, len);
                    debug!("Registering {}c/{}e trigger with length {}", rzp_state.0, rzp_state.1, len);
                }
            }
            trigger_variants.append(&mut generate_trigger_variations(trigger));
        }

        DRTriggerStepTable {
            pre_trigger_move_set: &HTR_DR_UD_MOVESET,
            trigger_move_set: &DR_UD_EO_FB_TRIGGER_MOVESET,
            pre_trans,
            table,
            trigger_types,
            trigger_variants,
            post_step_checks,
            variant
        }
    }
}

fn calc_rzp_state(cube: &Cube333) -> (u8, u8) {
    let eo_count_lr = cube.edges.count_bad_edges_lr();
    let co_count_ud = COCountUD::co_count(cube);
    (co_count_ud, eo_count_lr as u8)
}

impl<'a> PreStepCheck for DRTriggerStepTable<'a> {
    fn is_cube_ready(&self, c: &Cube333, _: Option<&Solution>) -> bool {
        if EOCoordFB::from(c).val() != 0 {
            return false;
        }
        if DRUDEOFBCoord::from(c).val() == 0 {
            return true;
        }
        let trigger_state = calc_rzp_state(c);
        self.trigger_types.contains_key(&trigger_state)
    }
}

impl <'a> PostStepCheck for DRTriggerStepTable<'a> {
    fn is_solution_admissible(&self, cube: &Cube333, alg: &Algorithm) -> bool {
        if alg.len() > 0 && !filter_dr_trigger(alg, &self.trigger_variants) {
            false
        } else {
            self.post_step_checks.iter()
                .all(|psc| psc.is_solution_admissible(cube, alg))
        }
    }
}

impl<'a> StepVariant for DRTriggerStepTable<'a> {
    fn move_set(&self, cube: &Cube333, depth_left: u8) -> &'a MoveSet333 {
        let rzp_state = calc_rzp_state(cube);
        if let Some(trigger_length) = self.trigger_types.get(&rzp_state) {
            if *trigger_length >= depth_left {
                self.trigger_move_set
            } else {
                self.pre_trigger_move_set
            }
        } else {
            self.pre_trigger_move_set
        }
    }

    fn pre_step_trans(&self) -> &'_ Vec<Transformation333> {
        &self.pre_trans
    }

    fn heuristic(&self, cube: &Cube333, _: u8, can_niss: bool) -> u8 {
        let coord = DRUDEOFBCoord::from(cube);
        let heuristic = self.table.get(coord);
        if can_niss {
            min(1, heuristic)
        } else {
            heuristic
        }
    }

    fn get_variant(&self) -> crate::defs::StepVariant {
        self.variant
    }
}

fn generate_trigger_variations(mut trigger: Algorithm) -> Vec<Vec<Turn333>> {
    if !trigger.inverse_moves.is_empty() {
        error!("Triggers with inverse components are not supported");
        return vec![];
    }
    if let Some(last) = trigger.normal_moves.last() {
        if !last.face.is_on_axis(CubeAxis::LR) || last.dir == Direction::Half {
            warn!("Ignoring DRUD triggers that don't end with R R' L or L'");
            return vec![];
        }
    } else {
        warn!("Ignoring empty triggers");
        return vec![];
    };
    let mut triggers: Vec<Vec<Turn333>> = vec![];
    triggers.push(trigger.normal_moves.clone());
    trigger.transform(Transformation333::new(CubeAxis::UD, Direction::Half));
    triggers.push(trigger.normal_moves.clone());
    trigger.transform(Transformation333::new(CubeAxis::FB, Direction::Half));
    triggers.push(trigger.normal_moves.clone());
    trigger.transform(Transformation333::new(CubeAxis::UD, Direction::Half));
    triggers.push(trigger.normal_moves.clone());
    trigger.transform(Transformation333::new(CubeAxis::FB, Direction::Half));
    trigger.mirror(CubeAxis::LR);
    triggers.push(trigger.normal_moves.clone());
    trigger.transform(Transformation333::new(CubeAxis::UD, Direction::Half));
    triggers.push(trigger.normal_moves.clone());
    trigger.transform(Transformation333::new(CubeAxis::FB, Direction::Half));
    triggers.push(trigger.normal_moves.clone());
    trigger.transform(Transformation333::new(CubeAxis::UD, Direction::Half));
    triggers.push(trigger.normal_moves.clone());

    triggers.into_iter()
        .map(|mut moves| {
            let last = moves.len() - 1;
            moves[last] = Turn333::new(moves[last].face, Direction::Clockwise);
            moves
        })
        .unique()
        .collect_vec()
}

pub fn filter_dr_trigger(alg: &Algorithm, triggers: &Vec<Vec<Turn333>>) -> bool {
    if alg.len() == 0 {
        return true;
    }
    let mut temp_alg = alg.clone();
    if !temp_alg.normal_moves.is_empty() {
        let last_id = temp_alg.normal_moves.len() - 1;
        let last = temp_alg.normal_moves[last_id];
        temp_alg.normal_moves[last_id] = Turn333::new(last.face, if last.dir == Direction::Half { Direction::Half } else {Direction::Clockwise});
        let normal_match = triggers.iter()
            .any(|trigger|temp_alg.normal_moves.ends_with(trigger));
        if normal_match {
            return true;
        }
    }
    if !temp_alg.inverse_moves.is_empty() {
        let last_id = temp_alg.inverse_moves.len() - 1;
        let last = temp_alg.inverse_moves[last_id];
        temp_alg.inverse_moves[last_id] = Turn333::new(last.face, if last.dir == Direction::Half { Direction::Half } else {Direction::Clockwise});
        let inverse_match = triggers.iter()
            .any(|trigger|temp_alg.inverse_moves.ends_with(trigger));
        if inverse_match {
            return true;
        }
    }
    return false;
}
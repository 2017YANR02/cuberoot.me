use itertools::Itertools;

use crate::algs::Algorithm;
use crate::defs::*;
use crate::solver::lookup_table::InMemoryIndexTable;
use crate::solver::lookup_table::DepthEstimate;
use crate::solver::moveset::TransitionTable333;
use crate::cube::*;
use crate::solver::solution::Solution;
use crate::steps::{MoveSet333, Step333};
use crate::steps::eo::coords::{BadEdgeCount, EOCoordFB};
use crate::steps::step::{DefaultStepOptions, PostStepCheck, PreStepCheck, Step, StepConfig, StepVariant};

const FB_EO_STATE_CHANGE_MOVES: &[Turn333] = &[
    Turn333::new(CubeFace::Front, Direction::Clockwise),
    Turn333::new(CubeFace::Front, Direction::CounterClockwise),
    Turn333::new(CubeFace::Back, Direction::Clockwise),
    Turn333::new(CubeFace::Back, Direction::CounterClockwise),
];

const FB_EO_MOVES: &[Turn333] = &[
    Turn333::new(CubeFace::Up, Direction::Clockwise),
    Turn333::new(CubeFace::Up, Direction::CounterClockwise),
    Turn333::new(CubeFace::Up, Direction::Half),
    Turn333::new(CubeFace::Down, Direction::Clockwise),
    Turn333::new(CubeFace::Down, Direction::CounterClockwise),
    Turn333::new(CubeFace::Down, Direction::Half),
    Turn333::new(CubeFace::Front, Direction::Half),
    Turn333::new(CubeFace::Back, Direction::Half),
    Turn333::new(CubeFace::Left, Direction::Clockwise),
    Turn333::new(CubeFace::Left, Direction::CounterClockwise),
    Turn333::new(CubeFace::Left, Direction::Half),
    Turn333::new(CubeFace::Right, Direction::Clockwise),
    Turn333::new(CubeFace::Right, Direction::CounterClockwise),
    Turn333::new(CubeFace::Right, Direction::Half),
];

pub const EO_FB_MOVESET: MoveSet333 = MoveSet333 {
    st_moves: FB_EO_STATE_CHANGE_MOVES,
    aux_moves: FB_EO_MOVES,
    transitions: &eo_transitions(CubeFace::Front),
};

const BAD_EDGE_HEURISTIC: [u8; 7] = [0, 2, 1, 2, 2, 3, 3];

pub type EOPruningTable = InMemoryIndexTable<2048, EOCoordFB>;

pub struct EOStepTable<'a> {
    move_set: &'a MoveSet333,
    pre_trans: Vec<Transformation333>,
    table: &'a EOPruningTable,
    variant: crate::defs::StepVariant,
}

pub fn from_step_config(table: &EOPruningTable, config: StepConfig) -> Result<(Step333<'_>, DefaultStepOptions), String> {
    let step = if let Some(substeps) = config.substeps {
        let axis: Result<Vec<CubeAxis>, String> = substeps.into_iter().map(|step| match step.to_lowercase().as_str() {
            "eoud" | "ud" => Ok(CubeAxis::UD),
            "eofb" | "fb" => Ok(CubeAxis::FB),
            "eolr" | "lr" => Ok(CubeAxis::LR),
            x => Err(format!("Invalid EO substep {x}"))
        }).collect();
        eo(table, axis?)
    } else {
        eo_any(table)
    };

    if !config.params.is_empty() {
        return Err(format!("Unreognized parameters: {:?}", config.params.keys()))
    }

    let search_opts = DefaultStepOptions::new(
        config.min.unwrap_or(0),
        config.max.unwrap_or(5),
        config.absolute_min,
        config.absolute_max,
        config.niss.unwrap_or(NissSwitchType::Always),
        if config.quality == 0 {
            None
        } else {
            config.step_limit.or(Some(config.quality * 1))
        }
    );
    Ok((step, search_opts))
}

pub fn eo_any(table: &EOPruningTable) -> Step333<'_> {
    eo(table, vec![CubeAxis::UD, CubeAxis::FB, CubeAxis::LR])
}

pub fn eo(table: &EOPruningTable, eo_axis: Vec<CubeAxis>) -> Step333<'_> {
    let step_variants = eo_axis
        .into_iter()
        .map(move |x| {
            let x: Box<dyn StepVariant> = match x {
                CubeAxis::UD => Box::new(EOStepTable::new_ud(&table)),
                CubeAxis::FB => Box::new(EOStepTable::new_fb(&table)),
                CubeAxis::LR => Box::new(EOStepTable::new_lr(&table)),
            };
            x
        })
        .collect_vec();
    Step::new(step_variants, StepKind::EO, true)
}

impl<'a> EOStepTable<'a> {
    fn new_ud(table: &'a EOPruningTable) -> Self {
        EOStepTable {
            move_set: &EO_FB_MOVESET,
            pre_trans: vec![Transformation333::new(CubeAxis::X, Direction::Clockwise)],
            table,
            variant: crate::defs::StepVariant::EO(CubeAxis::UD),
        }
    }

    fn new_lr(table: &'a EOPruningTable) -> Self {
        EOStepTable {
            move_set: &EO_FB_MOVESET,
            pre_trans: vec![Transformation333::new(CubeAxis::Y, Direction::Clockwise)],
            table,
            variant: crate::defs::StepVariant::EO(CubeAxis::LR),
        }
    }

    fn new_fb(table: &'a EOPruningTable) -> Self {
        EOStepTable {
            move_set: &EO_FB_MOVESET,
            pre_trans: vec![],
            table,
            variant: crate::defs::StepVariant::EO(CubeAxis::FB),
        }
    }
}

impl PreStepCheck for EOStepTable<'_> {
    fn is_cube_ready(&self, _: &Cube333, _: Option<&Solution>) -> bool {
        true
    }
}

impl PostStepCheck for EOStepTable<'_> {
    fn is_solution_admissible(&self, _: &Cube333, _: &Algorithm) -> bool {
        true
    }
}

impl StepVariant for EOStepTable<'_> {
    fn move_set(&self, _: &Cube333, _: u8) -> &MoveSet333 {
        self.move_set
    }

    fn pre_step_trans(&self) -> &Vec<Transformation333> {
        &self.pre_trans
    }

    fn heuristic(&self, cube: &Cube333, _: u8, can_niss: bool) -> u8 {
        if can_niss {
            let fb_edges = cube.edges.count_bad_edges_fb();
            BAD_EDGE_HEURISTIC[(fb_edges >> 1) as usize]
        } else {
            let coord = EOCoordFB::from(cube);
            self.table.get(coord)
        }
    }

    fn get_variant(&self) -> crate::defs::StepVariant {
        self.variant
    }
}

pub fn filter_eo_last_moves_pure(alg: &Algorithm) -> bool {
    filter_last_moves_pure(&alg.normal_moves) && filter_last_moves_pure(&alg.inverse_moves)
}

fn filter_last_moves_pure(vec: &Vec<Turn333>) -> bool {
    match vec.len() {
        0 => true,
        1 => vec[0].dir != Direction::CounterClockwise,
        n => {
            if vec[n - 1].dir == Direction::CounterClockwise {
                false
            } else {
                if vec[n - 1].face.opposite() == vec[n - 2].face {
                    vec[n - 2].dir != Direction::CounterClockwise
                } else {
                    true
                }
            }
        }
    }
}

pub(crate) const fn eo_transitions(axis_face: CubeFace) -> [TransitionTable333; 18] {
    let mut transitions = [TransitionTable333::new(0, 0); 18];
    let mut i = 0;
    let can_end_mask = TransitionTable333::moves_to_mask([
        Turn333::new(axis_face, Direction::Clockwise),
        Turn333::new(axis_face, Direction::CounterClockwise),
        Turn333::new(axis_face.opposite(), Direction::Clockwise),
        Turn333::new(axis_face.opposite(), Direction::CounterClockwise),
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

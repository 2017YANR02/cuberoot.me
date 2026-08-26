use std::cmp::min;
use std::collections::{HashMap, HashSet};
use std::marker::PhantomData;
use std::rc::Rc;

use log::trace;

use crate::algs::Algorithm;
use crate::cube::turn::ApplyAlgorithm;
use crate::defs::*;
use crate::cube::*;
use crate::solver::df_search::{CancelToken, dfs_iter};
use crate::solver::lookup_table::{DepthEstimate, InMemoryIndexTable, InMemoryNissIndexTable, NissDepthEstimate};
use crate::solver::moveset::MoveSet;
use crate::solver::solution::{Solution, SolutionStep};
use crate::solver::stream;
use crate::steps::coord::Coord;

#[derive(Debug, Clone, Eq, PartialEq)]
#[cfg_attr(feature = "serde_support", derive(serde::Serialize, serde::Deserialize))]
pub struct StepConfig {
    pub kind: StepKind,
    #[cfg_attr(feature = "serde_support", serde(skip_serializing_if = "Option::is_none"))]
    pub substeps: Option<Vec<String>>,
    #[cfg_attr(feature = "serde_support", serde(skip_serializing_if = "Option::is_none"))]
    pub min: Option<u8>,
    #[cfg_attr(feature = "serde_support", serde(skip_serializing_if = "Option::is_none"))]
    pub max: Option<u8>,
    #[cfg_attr(feature = "serde_support", serde(skip_serializing_if = "Option::is_none"))]
    pub absolute_min: Option<u8>,
    #[cfg_attr(feature = "serde_support", serde(skip_serializing_if = "Option::is_none"))]
    pub absolute_max: Option<u8>,
    #[cfg_attr(feature = "serde_support", serde(skip_serializing_if = "Option::is_none"))]
    pub step_limit: Option<usize>,
    pub quality: usize,
    #[cfg_attr(feature = "serde_support", serde(skip_serializing_if = "Option::is_none"))]
    pub niss: Option<NissSwitchType>,
    pub excluded: HashSet<Algorithm>,
    pub params: HashMap<String, String>,
}

impl StepConfig {
    pub fn new(kind: StepKind) -> StepConfig {
        StepConfig {
            kind,
            substeps: None,
            min: None,
            max: None,
            absolute_min: None,
            absolute_max: None,
            step_limit: None,
            niss: None,
            quality: 100,
            params: Default::default(),
            excluded: HashSet::default(),
        }
    }
}

#[derive(Clone, Copy, Debug)]
pub struct DefaultStepOptions {
    pub niss_type: NissSwitchType,
    pub min_moves: u8,
    pub max_moves: u8,
    pub absolute_min_moves: Option<u8>,
    pub absolute_max_moves: Option<u8>,
    pub step_limit: Option<usize>
}

impl DefaultStepOptions {
    pub fn new(min_moves: u8, max_moves: u8, absolute_min_moves: Option<u8>, absolute_max_moves: Option<u8>, niss_type: NissSwitchType, step_limit: Option<usize>) -> Self {
        DefaultStepOptions {
            min_moves,
            max_moves,
            absolute_min_moves,
            absolute_max_moves,
            niss_type,
            step_limit,
        }
    }
}

pub trait StepVariant: PreStepCheck + PostStepCheck
{
    fn move_set(&self, cube: &Cube333, depth_left: u8) -> &'_ MoveSet;
    fn pre_step_trans(&self) -> &'_ Vec<Transformation333>;
    fn heuristic(&self, cube: &Cube333, depth_left: u8, can_niss: bool) -> u8;
    fn get_variant(&self) -> crate::defs::StepVariant;
}

pub trait PreStepCheck {
    fn is_cube_ready(&self, cube: &Cube333, solution: Option<&Solution>) -> bool;
}

pub trait PostStepCheck {
    fn is_solution_admissible(&self, cube: &Cube333, alg: &Algorithm) -> bool;
}

trait Heuristic {
    fn heuristic(&self, cube: &Cube333, can_niss: bool) -> u8;
}

struct NissPruningTableHeuristic<'a, const HC_SIZE: usize, HC: Coord<HC_SIZE> + 'a>(&'a InMemoryNissIndexTable<HC_SIZE, HC>);
struct PruningTableHeuristic<'a, const HC_SIZE: usize, HC: Coord<HC_SIZE> + 'a>(&'a InMemoryIndexTable<HC_SIZE, HC>);

impl <'a, const HC_SIZE: usize, HC: Coord<HC_SIZE>> NissPruningTableHeuristic<'a, HC_SIZE, HC> {
    fn new(table: &'a InMemoryNissIndexTable<HC_SIZE, HC>) -> Self {
        Self(table)
    }
}

impl <'a, const HC_SIZE: usize, HC: Coord<HC_SIZE>> PruningTableHeuristic<'a, HC_SIZE, HC> {
    fn new(table: &'a InMemoryIndexTable<HC_SIZE, HC>) -> Self {
        Self(table)
    }
}

impl <const HC_SIZE: usize, HC: Coord<HC_SIZE>> Heuristic for PruningTableHeuristic<'_, HC_SIZE, HC> where HC: for<'a> From<&'a Cube333> {
    fn heuristic(&self, cube: &Cube333, can_niss: bool) -> u8 {
        let coord = HC::from(cube);
        let heuristic = self.0.get(coord);
        if can_niss {
            min(1, heuristic)
        } else {
            heuristic
        }
    }
}

impl <const HC_SIZE: usize, HC: Coord<HC_SIZE>> Heuristic for NissPruningTableHeuristic<'_, HC_SIZE, HC> where HC: for<'a> From<&'a Cube333> {
    fn heuristic(&self, cube: &Cube333, can_niss: bool) -> u8 {
        let coord = HC::from(cube);
        let (val, niss) = self.0.get_niss_estimate(coord);
        if can_niss && val != 0 {
            niss
        } else {
            val
        }
    }
}

pub struct DefaultPruningTableStep<
    'a,
    const HC_SIZE: usize,
    HC: Coord<HC_SIZE>,
    const PC_SIZE: usize,
    PC: Coord<PC_SIZE>,
>
{
    move_set: &'a MoveSet,
    pre_trans: Vec<Transformation333>,
    heuristic: Box<dyn Heuristic + 'a>,
    variant: crate::defs::StepVariant,
    post_step_checks: Rc<Vec<Box<dyn PostStepCheck + 'a>>>,
    _hc: PhantomData<HC>,
    _pc: PhantomData<PC>,
}

impl <'a, const HC_SIZE: usize, HC: Coord<HC_SIZE>, const PC_SIZE: usize, PC: Coord<PC_SIZE>> PreStepCheck for DefaultPruningTableStep<'a, HC_SIZE, HC, PC_SIZE, PC> where PC: for<'b> From<&'b Cube333> {

    fn is_cube_ready(&self, cube: &Cube333, _: Option<&Solution>) -> bool {
        PC::from(cube).val() == 0
    }
}

impl <'a, const HC_SIZE: usize, HC: Coord<HC_SIZE>, const PC_SIZE: usize, PC: Coord<PC_SIZE>> PostStepCheck for DefaultPruningTableStep<'a, HC_SIZE, HC, PC_SIZE, PC> where PC: for<'b> From<&'b Cube333> {

    fn is_solution_admissible(&self, cube: &Cube333, alg: &Algorithm) -> bool {
        self.post_step_checks.iter()
            .all(|psc| psc.is_solution_admissible(cube, alg))
    }
}

impl <
    'a,
    const HC_SIZE: usize,
    HC: Coord<HC_SIZE>,
    const PC_SIZE: usize,
    PC: Coord<PC_SIZE>>
StepVariant for DefaultPruningTableStep<'a, HC_SIZE, HC, PC_SIZE, PC> where PC: for<'b> From<&'b Cube333>, HC: for<'b> From<&'b Cube333> {

    fn move_set(&self, _: &Cube333, _: u8) -> &'_ MoveSet {
        self.move_set
    }

    fn pre_step_trans(&self) -> &'_ Vec<Transformation333> {
        &self.pre_trans
    }

    fn heuristic(&self, cube: &Cube333, _: u8, can_niss: bool) -> u8 {
        self.heuristic.heuristic(cube, can_niss)
    }

    fn get_variant(&self) -> crate::defs::StepVariant {
        self.variant
    }
}

impl <
    'a,
    const HC_SIZE: usize,
    HC: Coord<HC_SIZE>,
    const PC_SIZE: usize,
    PC: Coord<PC_SIZE>
>
DefaultPruningTableStep<'a, HC_SIZE, HC, PC_SIZE, PC> where PC: for<'b> From<&'b Cube333>, HC: for<'b> From<&'b Cube333>{

    pub fn new(move_set: &'a MoveSet,
               pre_trans: Vec<Transformation333>,
               table: &'a InMemoryIndexTable<HC_SIZE, HC>,
               post_step_checker: Rc<Vec<Box<dyn PostStepCheck + 'a>>>,
               variant: crate::defs::StepVariant) -> Self {
        DefaultPruningTableStep {
            move_set,
            pre_trans,
            heuristic: Box::new(PruningTableHeuristic::new(table)),
            variant,
            post_step_checks: post_step_checker,
            _hc: PhantomData::default(),
            _pc: PhantomData::default(),
        }
    }

    pub fn new_niss_table(move_set: &'a MoveSet,
               pre_trans: Vec<Transformation333>,
               table: &'a InMemoryNissIndexTable<HC_SIZE, HC>,
               post_step_checker: Rc<Vec<Box<dyn PostStepCheck + 'a>>>,
               variant: crate::defs::StepVariant) -> Self {
        DefaultPruningTableStep {
            move_set,
            pre_trans,
            heuristic: Box::new(NissPruningTableHeuristic::new(table)),
            variant,
            post_step_checks: post_step_checker,
            _hc: PhantomData::default(),
            _pc: PhantomData::default(),
        }
    }
}

pub struct Step<'a> {
    step_variants: Vec<Box<dyn StepVariant + 'a>>,
    is_major: bool,
    kind: StepKind,
}

impl<'a> Step<'a> {
    pub fn new(
        step_variants: Vec<Box<dyn StepVariant + 'a>>,
        kind: StepKind,
        is_major: bool,
    ) -> Self {
        Step { step_variants, kind, is_major }
    }

    pub fn kind(&self) -> StepKind {
        self.kind.clone()
    }
}

pub fn first_step<
    'a,
    'b
>(
    step: &'a Step<'b>,
    search_opts: DefaultStepOptions,
    cube: Cube333,
    cancel_token: &'a CancelToken
) -> impl Iterator<Item = Solution> + 'a {
    next_step(vec![Solution::new()].into_iter(), step, search_opts, cube, cancel_token)
}

//TODO once we have a better way to merge alg iterators, we should invoke df_search with the full bounds immediately.
//It's not significantly more efficient yet, but in the future it probably will be
pub fn next_step<
    'a,
    'b,
    IN: Iterator<Item = Solution> + 'a,
>(
    algs: IN,
    step: &'a Step<'b>,
    search_opts: DefaultStepOptions,
    cube: Cube333,
    cancel_token: &'a CancelToken,
) -> impl Iterator<Item = Solution> + 'a {
    stream::iterated_dfs(algs, cancel_token, move |solution, depth, cancel_token| {
        let absolute_target_length = solution.len() as u8 + depth;
        let result: Box<dyn Iterator<Item = Solution>> =
            if depth < search_opts.min_moves ||
                depth > search_opts.max_moves ||
                search_opts.absolute_min_moves.map(|m| m > absolute_target_length).unwrap_or(false) ||
                search_opts.absolute_max_moves.map(|m| m < absolute_target_length).unwrap_or(false) {
                Box::new(vec![].into_iter())
            } else {
                let mut cube = cube.clone();
                let alg: Algorithm = solution.clone().into();
                let ends_on_normal = solution.ends_on_normal();
                cube.apply_alg(&alg);
                let stage_opts = DefaultStepOptions::new(depth, depth, None, None, search_opts.niss_type, search_opts.step_limit);
                let previous_normal = alg.normal_moves.last().cloned();
                let previous_inverse = alg.inverse_moves.last().cloned();

                trace!("Current solution step {}, depth {depth}, {alg}, normal {}, {previous_normal:?}, {previous_inverse:?} {}", step.kind, solution.ends_on_normal, stage_opts.niss_type);
                //Only allow the first variant to use the empty solution, otherwise we get lots of duplicates
                let values = step
                    .step_variants
                    .iter()
                    .flat_map(move |step_variant| {
                        dfs_iter(
                            step_variant.as_ref(),
                            cube.clone(),
                            stage_opts.clone(),
                            previous_normal,
                            previous_inverse,
                            ends_on_normal,
                            cancel_token,
                        )
                        .map(|alg| (step_variant.get_variant(), alg))
                    })
                    .flat_map(|(variant, iter)| iter.map(move |alg| (variant, alg)))
                    .map(move |(variant, step_alg)| {
                        let mut sol = solution.clone();
                        if step.is_major || step_alg.len() > 0 {
                            let sol_step = SolutionStep {
                                alg: step_alg,
                                variant,
                                comment: String::default(),
                                e_insertions: Default::default(),
                            };
                            sol.add_step(sol_step);
                        }
                        sol
                    });
                Box::new(values)
            };
        result
    })
}

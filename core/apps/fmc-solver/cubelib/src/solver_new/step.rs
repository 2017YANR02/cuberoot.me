use std::cell::RefCell;
use std::cmp::min;
use std::fmt::Debug;
use std::marker::PhantomData;
use std::sync::Arc;

use std::thread::JoinHandle;
use log::trace;
use sorted_insert::{SortedInsertBinaryBy};
use crate::algs::Algorithm;
use crate::cube::{Cube333, Transformation333, Turn333};
use crate::cube::turn::*;
use crate::defs::{NissSwitchType, StepVariant};
use crate::solver::df_search::CancelToken;
use crate::solver::lookup_table::{DepthEstimate, NissDepthEstimate};
use crate::solver::solution::{Solution, SolutionStep};
use crate::solver_new::*;
use crate::solver_new::finish::DRFinishStep;
use crate::solver_new::group::{StepPredicate, StepPredicateResult};
use crate::solver_new::thread_util::*;
use crate::steps::coord::Coord;
use crate::steps::step::{PostStepCheck, PreStepCheck};

pub struct PruningTableStep<'a, 'b, const C_SIZE: usize, C: Coord<C_SIZE> + 'static, const PC_SIZE: usize, PC: Coord<PC_SIZE> + 'static> {
    pub table: &'b Box<dyn DepthEstimate<C_SIZE, C>>,
    pub options: DFSParameters,
    pub pre_step_trans: Vec<Transformation333>,
    pub variant: StepVariant,
    pub post_step_check: Vec<Box<dyn PostStepCheck + Send + 'static>>,
    pub pre_step_check: Vec<Box<dyn PreStepCheck + Send + 'static>>,
    pub move_set: &'a MoveSet,
    pub _pc: PhantomData<PC>,
}

pub struct NissPruningTableStep<'a, 'b, const C_SIZE: usize, C: Coord<C_SIZE> + 'static, const PC_SIZE: usize, PC: Coord<PC_SIZE> + 'static> {
    pub table: &'b Box<dyn NissDepthEstimate<C_SIZE, C>>,
    pub options: DFSParameters,
    pub pre_step_trans: Vec<Transformation333>,
    pub variant: StepVariant,
    pub post_step_check: Vec<Box<dyn PostStepCheck + Send + 'static>>,
    pub move_set: &'a MoveSet,
    pub _pc: PhantomData<PC>,
}

impl<'a, 'b, const C_SIZE: usize, C: Coord<C_SIZE>, const PC_SIZE: usize, PC: Coord<PC_SIZE>> PreStepCheck for PruningTableStep<'a, 'b, C_SIZE, C, PC_SIZE, PC> where PC: for<'c> From<&'c Cube333> {
    fn is_cube_ready(&self, cube: &Cube333, previous: Option<&Solution>) -> bool {
        if let Some(previous) = previous.and_then(|x|x.steps.last().map(|x|x.variant)) {
            if !previous.can_solve_next(&self.variant) {
                return false
            }
        }
        if PC::from(cube).val() == 0 {
            self.pre_step_check.iter().all(|x|x.is_cube_ready(cube, previous.clone()))
        } else {
            false
        }
    }
}

impl<'a, 'b,const C_SIZE: usize, C: Coord<C_SIZE>, const PC_SIZE: usize, PC: Coord<PC_SIZE>> PostStepCheck for PruningTableStep<'a, 'b, C_SIZE, C, PC_SIZE, PC> {
    fn is_solution_admissible(&self, cube: &Cube333, alg: &Algorithm) -> bool {
        self.post_step_check.iter()
            .all(|psc|psc.is_solution_admissible(cube, alg))
    }
}

impl <'a, 'b, const C_SIZE: usize, C: Coord<C_SIZE>, const PC_SIZE: usize, PC: Coord<PC_SIZE>> Step for PruningTableStep<'a, 'b, C_SIZE, C, PC_SIZE, PC> where C: for<'c> From<&'c Cube333>, PC: for<'d> From<&'d Cube333>  {
    fn get_dfs_parameters(&self) -> DFSParameters {
        self.options.clone()
    }

    fn get_moveset(&self, _: &Cube333, _: usize) -> &'a MoveSet {
        self.move_set
    }

    fn heuristic(&self, state: &Cube333, can_niss_switch: bool, _: usize) -> usize {
        let coord = C::from(state);
        let heuristic = self.table.get(coord) as usize;
        if can_niss_switch {
            min(1, heuristic)
        } else {
            heuristic
        }
    }

    fn pre_step_trans(&self) -> &'_ Vec<Transformation333> {
        &self.pre_step_trans
    }

    fn get_variant(&self) -> StepVariant {
        self.variant
    }
}

impl<'a, 'b, const C_SIZE: usize, C: Coord<C_SIZE>, const PC_SIZE: usize, PC: Coord<PC_SIZE>> PreStepCheck for NissPruningTableStep<'a, 'b, C_SIZE, C, PC_SIZE, PC> where PC: for<'c> From<&'c Cube333> {
    fn is_cube_ready(&self, cube: &Cube333, previous: Option<&Solution>) -> bool {
        if let Some(previous) = previous.and_then(|x|x.steps.last().map(|x|x.variant)) {
            if !previous.can_solve_next(&self.variant) {
                return false
            }
        }
        PC::from(cube).val() == 0
    }
}

impl<'a, 'b,const C_SIZE: usize, C: Coord<C_SIZE>, const PC_SIZE: usize, PC: Coord<PC_SIZE>> PostStepCheck for NissPruningTableStep<'a, 'b, C_SIZE, C, PC_SIZE, PC> {
    fn is_solution_admissible(&self, cube: &Cube333, alg: &Algorithm) -> bool {
        self.post_step_check.iter()
            .all(|psc|psc.is_solution_admissible(cube, alg))
    }
}

impl <'a, 'b, const C_SIZE: usize, C: Coord<C_SIZE>, const PC_SIZE: usize, PC: Coord<PC_SIZE>> Step for NissPruningTableStep<'a, 'b, C_SIZE, C, PC_SIZE, PC> where C: for<'c> From<&'c Cube333>, PC: for<'d> From<&'d Cube333>  {
    fn get_dfs_parameters(&self) -> DFSParameters {
        self.options.clone()
    }

    fn get_moveset(&self, _: &Cube333, _: usize) -> &'a MoveSet {
        self.move_set
    }

    fn heuristic(&self, state: &Cube333, can_niss_switch: bool, _: usize) -> usize {
        let coord = C::from(state);
        let (val, niss) = self.table.get_niss_estimate(coord);
        if can_niss_switch && val != 0 {
            niss as usize
        } else {
            val as usize
        }
    }

    fn pre_step_trans(&self) -> &'_ Vec<Transformation333> {
        &self.pre_step_trans
    }

    fn get_variant(&self) -> StepVariant {
        self.variant
    }
}

pub struct StepWorker {
    pub(crate) join_handle: Option<JoinHandle<()>>,
    pub(crate) cancel_token: Arc<CancelToken>,
    pub(crate) step_runner: ThreadState<()>,
}

impl Worker<()> for StepWorker {
    fn start(&mut self) {
        self.step_runner.start();
    }

    fn stop(&mut self) -> Option<JoinHandle<()>> {
        self.cancel_token.cancel();
        self.join_handle.take()
    }
}

struct StepIORunner {
    rc: Option<Receiver<Solution>>,
    tx: Option<Sender<Solution>>,
    input: Vec<Solution>,
    output_buffer: RefCell<Vec<Solution>>, // Only used for steps that produce solutions out of order
    dfs_parameters: DFSParameters,
    current_length: usize,
    current_position: usize,
    step: Box<dyn Step + Send>,
    cancel_token: Arc<CancelToken>,
    cube_state: Cube333,
    predicates: Vec<Box<dyn StepPredicate>>,
}

impl Run<()> for StepIORunner {
    fn run(&mut self) -> () {
        if let Some(rc) = self.rc.take() {
            trace!("[{}] Started", self.step.get_variant());
            self.run_internal(rc);
            trace!("[{}] Terminated", self.step.get_variant());
        }
        drop(self.tx.take());
    }
}

impl StepIORunner {
    fn run_internal(&mut self, rc: Receiver<Solution>) {
        let next = if let Ok(next) = rc.recv() {
            next
        } else {
            return;
        };
        self.input.push(next);
        self.current_length = self.input[0].len();
        while !self.cancel_token.is_cancelled() && self.current_length <= self.dfs_parameters.absolute_max_moves.unwrap_or(100) {
            loop {
                let output_buffer = self.output_buffer.get_mut();
                if let Some(sol) = output_buffer.pop_if(|x|x.len() < self.current_length) {
                    trace!("[{}] Flushed buffered solution of length {}\nTest: {}", self.step.get_variant(), sol.len(), sol);
                    if let Err(_) = self.process_solution(sol) {
                        return
                    }
                } else {
                    break
                }
            }
            match self.process_fetched() {
                Ok(Some(full_fetch_required_length)) => {
                    while !self.cancel_token.is_cancelled() {
                        match rc.recv() {
                            Ok(next) => {
                                let len = next.len();
                                self.input.push(next);
                                if len > full_fetch_required_length {
                                    break
                                } else {
                                    _ = self.process_fetched();
                                }
                            }
                            Err(_) => {
                                break
                            }
                        }
                    }
                },
                Ok(None) => {}
                Err(_) => {
                    return;
                }
            };
            _ = self.process_fetched();
            self.current_position = 0;
            self.current_length += 1;
        }
    }

    fn process_fetched(&mut self) -> Result<Option<usize>, SendError<Solution>> {
        let mut drain_until = 0;
        while !self.cancel_token.is_cancelled() && self.current_position < self.input.len() {
            let len = self.input[self.current_position].len();
            if len > self.current_length {
                break;
            }
            let depth = self.current_length - len;
            if depth > self.dfs_parameters.max_moves {
                drain_until += 1;
                self.current_position += 1;
                continue
            } else if depth < self.dfs_parameters.min_moves {
                self.current_position += 1;
                continue
            }
            let input = &self.input[self.current_position];
            let dr_fin_axis = match self.step.get_variant() {
                StepVariant::DRFIN(axis) | StepVariant::DRFINLS(axis) => Some(axis),
                 _ => None,
            };
            let cancel_previous_count = if let Some(dr_axis) = dr_fin_axis {
                DRFinishStep::get_possible_cancellation_count(input, dr_axis).min(4)
            } else {
                0
            };
            if depth == 0 {
                for additional_depth in 0..=cancel_previous_count {
                    self.find_solutions(self.cube_state.clone(), input, depth + additional_depth, self.dfs_parameters.niss_type)?;
                }
            } else {
                self.find_solutions(self.cube_state.clone(), input, depth + cancel_previous_count, self.dfs_parameters.niss_type)?;
            }
            self.current_position += 1;
        }

        if drain_until > 0 {
            self.input.drain(0..drain_until);
        }
        if self.current_position >= self.input.len() + drain_until {
            Ok(Some(self.current_length))
        } else {
            Ok(None)
        }
    }

    fn submit_solution(&self, input: &Solution, result: Algorithm) -> Result<(), SendError<Solution>>{
        let mut input = input.clone();
        input.add_step(SolutionStep {
            variant: self.step.get_variant(),
            alg: result.clone(),
            comment: "".to_string(),
            e_insertions: Default::default(),
        });
        if self.current_length < input.len() {
            self.output_buffer.borrow_mut().sorted_insert_binary_by(input.clone(), |a, b|b.len().cmp(&a.len()));
            trace!("Received solution of length {} out of order (current length: {})", input.len(), self.current_length);
            return Ok(())
        }

        self.process_solution(input)
    }

    fn process_solution(&self, input: Solution) -> Result<(), SendError<Solution>>{
        for p in self.predicates.iter() {
            match p.check_solution(&input) {
                StepPredicateResult::Accepted => {}
                StepPredicateResult::Rejected => {
                    return Ok(())
                }
                StepPredicateResult::Closed => {
                    return Err(crossbeam::channel::SendError(input))
                }
            }
        }
        if let Some(tx) = self.tx.as_ref() {
            tx.send(input)
        } else {
            Err(crossbeam::channel::SendError(input))
        }
    }

    // Finds solutions that exactly match the depth parameter. Does _not_ look for shorter ones
    pub fn find_solutions(&self, mut cube: Cube333, input: &Solution, depth: usize, niss_type: NissSwitchType) -> Result<(), SendError<Solution>> {
        let alg: Algorithm = input.clone().into();
        cube.apply_alg(&alg);

        let (mut previous_normal, mut previous_inverse) = if self.dfs_parameters.ignore_previous_step_restrictions {
            (None, None)
        } else {
            (alg.normal_moves.last().cloned(), alg.inverse_moves.last().cloned())
        };
        let start_on_normal = input.ends_on_normal;

        for t in self.step.pre_step_trans().iter().cloned() {
            cube.transform(t);
            previous_normal = previous_normal.map(|m|m.transform(t));
            previous_inverse = previous_inverse.map(|m|m.transform(t));
        }
        if !self.step.is_cube_ready(&cube, Some(input)) {
            return Ok(());
        }

        //trace!("[{}{}] \t{alg} is solvable in {}, depth is {depth}", self.step.get_name().0, self.step.get_name().1, heuristic);
        if self.step.heuristic(&cube, niss_type != NissSwitchType::Never, depth) == 0 {
            //Only return a solution if we are allowed to return zero length solutions
            if depth == 0 {
                if self.step.is_solution_admissible(&cube, &alg) {
                    self.submit_solution(input, Algorithm::new())?;
                }
            }
            return Ok(());
        }

        let cancel_token = self.cancel_token.as_ref();
        previous_normal = None;
        previous_inverse = None;
        let iter: Box<dyn Iterator<Item = Algorithm>> = match niss_type {
            NissSwitchType::Never if start_on_normal => {
                Box::new(self.find_solutions_dfs(cube, depth, false, previous_normal, previous_inverse, cancel_token))
            },
            NissSwitchType::Never => {
                let mut cube = cube.clone();
                cube.invert();
                Box::new(self.find_solutions_dfs(cube, depth, false, previous_inverse, previous_normal, cancel_token)
                    .map(|alg| {
                        Algorithm {
                            normal_moves: alg.inverse_moves,
                            inverse_moves: alg.normal_moves
                        }
                    }))
            },
            NissSwitchType::Before => {
                let mut cube = cube.clone();
                let normal = self.find_solutions_dfs(cube.clone(), depth, false, previous_normal, previous_inverse, cancel_token);
                cube.invert();
                let inverse = self.find_solutions_dfs(cube, depth, false, previous_inverse, previous_normal, cancel_token)
                    .map(|alg| {
                        Algorithm {
                            normal_moves: alg.inverse_moves,
                            inverse_moves: alg.normal_moves
                        }
                    });
                Box::new(normal.chain(inverse))
            }
            NissSwitchType::Always => {
                let normal = self.find_solutions_dfs(cube.clone(), depth, true, previous_normal, previous_inverse, cancel_token);
                let mut cube = cube.clone();
                cube.invert();
                let inverse = self.find_solutions_dfs(cube, depth, false, previous_inverse, previous_normal, cancel_token)
                    .map(|alg| {
                        Algorithm {
                            normal_moves: alg.inverse_moves,
                            inverse_moves: alg.normal_moves
                        }
                    });
                Box::new(normal.chain(inverse))
            }
        };

        for alg in iter {
            let mut alg = alg.reverse();
            if !self.step.is_solution_admissible(&cube, &alg) {
                continue;
            }
            for t in self.step.pre_step_trans().iter().cloned().rev() {
                alg.transform(t.invert());
            }
            self.submit_solution(input, alg)?;
        }
        Ok(())
    }

    fn find_solutions_dfs<'a>(&'a self, mut cube: Cube333, depth: usize, niss_available: bool, prev: Option<Turn333>, prev_inv: Option<Turn333>, cancel_token: &'a CancelToken) -> Box<dyn Iterator<Item = Algorithm> + 'a> {
        if cancel_token.is_cancelled() {
            return Box::new(vec![].into_iter());
        }
        let lower_bound = self.step.heuristic(&cube, niss_available, depth);
        if depth == 0 && lower_bound == 0 {
            return Box::new(vec![Algorithm::new()].into_iter());
        } else if lower_bound == 0 || lower_bound > depth {
            return Box::new(vec![].into_iter());
        }
        let values: Box<dyn Iterator<Item = Algorithm>> = Box::new(self.step.get_moveset(&cube, depth).get_allowed_moves(prev, depth)
            .flat_map(move |(turn, can_invert)|{
                cube.turn(turn);
                let normal_results = self.find_solutions_dfs(cube, depth - 1, niss_available, Some(turn), prev_inv, cancel_token)
                    .map(move |mut alg|{
                        alg.normal_moves.push(turn);
                        alg
                    });
                let results: Box<dyn Iterator<Item = Algorithm>> = if niss_available && can_invert && depth > 1 {
                    let mut cube = cube.clone();
                    cube.invert();
                    let inverse_results = self.find_solutions_dfs(cube, depth - 1, false, prev_inv, Some(turn), cancel_token)
                        .map(move |mut alg|{
                            alg.inverse_moves.push(turn);
                            Algorithm {
                                normal_moves: alg.inverse_moves,
                                inverse_moves: alg.normal_moves,
                            }
                        });
                    Box::new(normal_results.chain(inverse_results))
                } else {
                    Box::new(normal_results)
                };
                cube.turn(turn.invert());
                results
            }));
        values
    }
}

impl <S: Step + Send + 'static> ToWorker for S {
    fn to_worker_box(self: Box<Self>, cube_state: Cube333, rc: Receiver<Solution>, tx: Sender<Solution>, additional_predicates: Vec<Box<dyn StepPredicate>>) -> Box<dyn Worker<()> + Send> {
        let cancel_token = Arc::new(CancelToken::default());
        Box::new(StepWorker {
            join_handle: None,
            cancel_token: cancel_token.clone(),
            step_runner: ThreadState::PreStart(Box::new(StepIORunner {
                rc: Some(rc),
                tx: Some(tx),
                input: vec![],
                output_buffer: RefCell::new(vec![]),
                dfs_parameters: self.get_dfs_parameters(),
                current_length: 0,
                current_position: 0,
                step: self,
                cancel_token: cancel_token.clone(),
                predicates: additional_predicates,
                cube_state
            })),
        })
    }
}

#[derive(Clone, Copy, Debug)]
pub struct DFSParameters {
    pub niss_type: NissSwitchType,
    pub min_moves: usize,
    pub max_moves: usize,
    pub absolute_max_moves: Option<usize>,
    pub ignore_previous_step_restrictions: bool,
}

pub struct MoveSet {
    pub st_moves: &'static [Turn333],
    pub aux_moves: &'static [Turn333],
    pub transitions: [[bool; 18]; 18],
}

impl MoveSet {
    pub const fn new(st_moves: &'static [Turn333], aux_moves: &'static [Turn333]) -> Self {
        Self {
            st_moves,
            aux_moves,
            transitions: Self::new_default_transitions(true, false),
        }
    }

    pub const fn new_qt_ht_ordered(st_moves: &'static [Turn333], aux_moves: &'static [Turn333]) -> Self {
        Self {
            st_moves,
            aux_moves,
            transitions: Self::new_default_transitions(true, true),
        }
    }

    pub const fn new_unordered(st_moves: &'static [Turn333], aux_moves: &'static [Turn333]) -> Self {
        Self {
            st_moves,
            aux_moves,
            transitions: Self::new_default_transitions(false, false),
        }
    }

    pub const fn new_default_transitions(ordered: bool, qt_first: bool) -> [[bool; 18]; 18] {
        let mut transitions = [[true; 18]; 18];
        let dirs = [Direction::Clockwise, Direction::CounterClockwise, Direction::Half];
        // No repeated moves on the same face
        let mut idx = 0;
        while idx < CubeFace::ALL.len() {
            let face = CubeFace::ALL[idx];
            idx += 1;
            let mut idx = 0;
            while idx < dirs.len() {
                let dir_first = dirs[idx];
                idx += 1;
                let mut idx = 0;
                while idx < dirs.len() {
                    let dir_last = dirs[idx];
                    idx += 1;
                    transitions[Turn333::new(face, dir_first).to_id()][Turn333::new(face, dir_last).to_id()] = false;
                }
            }
        }
        if ordered {
            let priority_faces = [CubeFace::Up, CubeFace::Front, CubeFace::Left];
            let mut idx = 0;
            while idx < priority_faces.len() {
                let face = priority_faces[idx];
                idx += 1;
                if qt_first {
                    // Enforce order within qt/ht
                    transitions[Turn333::new(face.opposite(), Direction::Half).to_id()][Turn333::new(face, Direction::Half).to_id()] = false;
                    transitions[Turn333::new(face.opposite(), Direction::Clockwise).to_id()][Turn333::new(face, Direction::Clockwise).to_id()] = false;
                    transitions[Turn333::new(face.opposite(), Direction::Clockwise).to_id()][Turn333::new(face, Direction::CounterClockwise).to_id()] = false;
                    transitions[Turn333::new(face.opposite(), Direction::CounterClockwise).to_id()][Turn333::new(face, Direction::Clockwise).to_id()] = false;
                    transitions[Turn333::new(face.opposite(), Direction::CounterClockwise).to_id()][Turn333::new(face, Direction::CounterClockwise).to_id()] = false;
                } else {
                    // Enforce order globally
                    let mut idx = 0;
                    while idx < dirs.len() {
                        let dir_first = dirs[idx];
                        idx += 1;
                        let mut idx = 0;
                        while idx < dirs.len() {
                            let dir_last = dirs[idx];
                            idx += 1;
                            transitions[Turn333::new(face.opposite(), dir_first).to_id()][Turn333::new(face, dir_last).to_id()] = false;
                        }
                    }
                }
            }
        }
        if qt_first {
            let mut idx = 0;
            while idx < CubeFace::ALL.len() {
                let face = CubeFace::ALL[idx];
                idx += 1;
                transitions[Turn333::new(face, Direction::Half).to_id()][Turn333::new(face.opposite(), Direction::Clockwise).to_id()] = false;
                transitions[Turn333::new(face, Direction::Half).to_id()][Turn333::new(face.opposite(), Direction::CounterClockwise).to_id()] = false;
            }
        }
        transitions
    }

    // In order of importance:
    // - No subsequent moves on the same face
    // - For moves on the same axis, quarter moves before half moves
    // - U before D, F before B, L before R
    pub const fn new_default_transitions_(ordered: bool) -> [[bool; 18]; 18] {
        let mut transitions = [[true; 18]; 18];
        let dirs = [Direction::Clockwise, Direction::CounterClockwise, Direction::Half];
        let priority_faces = [CubeFace::Up, CubeFace::Front, CubeFace::Left];
        let mut idx_first = 0;
        while idx_first < dirs.len() {
            let dir_first = dirs[idx_first];
            let mut idx_last = 0;
            while idx_last < dirs.len() {
                let dir_last = dirs[idx_last];
                // Enforce face order
                if ordered {
                    let mut idx = 0;
                    while idx < priority_faces.len() {
                        let face = priority_faces[idx];
                        let opposite = face.opposite();
                        transitions[Turn333::new(face, dir_first).to_id()][Turn333::new(opposite, dir_last).to_id()] = false;
                        idx += 1;
                    }
                }
                let mut idx = 0;
                while idx < CubeFace::ALL.len() {
                    let face = CubeFace::ALL[idx];
                    transitions[Turn333::new(face, dir_first).to_id()][Turn333::new(face, dir_last).to_id()] = false;
                    idx += 1;
                }
                idx_last += 1;
            }
            idx_first += 1;
        }
        transitions
    }

    pub fn get_allowed_moves(&self, previous: Option<Turn333>, depth_left: usize) -> impl Iterator<Item = (Turn333, bool)> + use<'_> {
        self.st_moves.iter().cloned().map(|t|(t, true))
            .chain(self.aux_moves.iter().cloned().map(|t|(t, false)))
            .filter(move |t|t.1 || depth_left > 1)
            .filter(move |t|previous.map_or(true, |tp|self.transitions[tp.to_id()][t.0.to_id()]))
    }
}
#[cfg(feature = "multi-path-channel-solver")]
pub use implementation::VRStep;
use crate::cube::Direction;
use std::collections::HashMap;
use crate::defs::StepVariant;
use crate::cube::Transformation333;

#[derive(Debug, Clone, Eq, PartialEq)]
#[cfg_attr(feature = "serde_support", derive(serde::Serialize, serde::Deserialize))]
pub struct VRInsertions(
    pub(crate) HashMap<StepVariant, Vec<(usize, Direction)>>,
    pub(crate) Option<Transformation333>);

#[cfg(feature = "multi-path-channel-solver")]
mod implementation {
    use crate::solver_new::vr::VRInsertions;
    use std::collections::{HashMap};
    use std::fmt::{Debug, Display, Formatter};
    use std::simd::prelude::*;
    use std::sync::Arc;
    use itertools::Itertools;
    use log::trace;
    use crate::algs::Algorithm;
    use crate::cube::{Cube333, CubeFace, EdgeCube333, Transformation333, Turn333};
    use crate::cube::turn::{ApplyAlgorithm, CubeAxis, CubeTransformation, Direction, Invertible, Transformable, TransformableMut, TurnableMut};
    use crate::defs::{NissSwitchType, StepKind, StepVariant};
    use crate::solver::df_search::CancelToken;
    use crate::solver::solution::{Solution, SolutionStep};
    use crate::solver_new::finish::DRFinishStep;
    use crate::solver_new::{Receiver, Sender, SendError};
    use crate::solver_new::group::{StepGroup, StepPredicate, StepPredicateResult};
    use crate::solver_new::step::{DFSParameters, StepWorker};
    use crate::solver_new::thread_util::{Run, ThreadState, ToWorker, Worker};
    use crate::solver_new::util_cube::CubeState;
    use crate::steps::coord::Coord;
    use crate::steps::dr::coords::DRUDEOFBCoord;
    use crate::steps::finish::coords::HTRLeaveSliceFinishCoord;

    pub struct VRStep {
        vr_in: usize,
        to_solved: bool,
    }

    impl VRStep {
        pub fn new(vr_in: usize, to_solved: bool) -> StepGroup {
            StepGroup::single(Box::new(Self { vr_in, to_solved }))
        }
    }

    struct VRStepRunner {
        rc: Option<Receiver<Solution>>,
        tx: Option<Sender<Solution>>,
        output_buffer: HashMap<usize, Vec<Solution>>,
        cancel_token: Arc<CancelToken>,
        cube_state: Cube333,
        current_length: usize,
        predicates: Vec<Box<dyn StepPredicate>>,
        step: Box<VRStep>,
    }

    impl ToWorker for VRStep {
        fn to_worker_box(self: Box<Self>, cube_state: Cube333, rc: Receiver<Solution>, tx: Sender<Solution>, additional_predicates: Vec<Box<dyn StepPredicate>>) -> Box<dyn Worker<()> + Send> {
            let cancel_token = Arc::new(CancelToken::default());
            Box::new(StepWorker {
                join_handle: None,
                cancel_token: cancel_token.clone(),
                step_runner: ThreadState::PreStart(Box::new(VRStepRunner {
                    rc: Some(rc),
                    tx: Some(tx),
                    output_buffer: HashMap::new(),
                    current_length: 0,
                    step: self.into(),
                    cancel_token: cancel_token.clone(),
                    predicates: additional_predicates,
                    cube_state
                })),
            })
        }
    }

    impl Run<()> for VRStepRunner {
        fn run(&mut self) -> () {
            if let Some(rc) = self.rc.take() {
                trace!("[vr] Started");
                self.run_internal(rc);
                trace!("[vr] Terminated");
            }
            drop(self.tx.take());
        }
    }

    impl VRStepRunner {
        fn run_internal(&mut self, rc: Receiver<Solution>) {
            while !self.cancel_token.is_cancelled() {
                match rc.recv() {
                    Ok(next) => {
                        let len = next.len();
                        if let Some(sol) = solve_slice(&self.cube_state, &next, self.step.vr_in, self.step.to_solved) {
                            self.output_buffer.entry(sol.len())
                                .or_default()
                                .push(sol);
                        }
                        if self.send_up_to(len).is_err() {
                            break
                        }
                    }
                    Err(_) => {
                        let _ = self.send_up_to(usize::MAX);
                        break
                    }
                }
            }
        }

        fn send_up_to(&mut self, max_len: usize) -> Result<(), SendError<Solution>> {
            while !self.output_buffer.is_empty() {
                for sol in self.output_buffer.remove(&self.current_length)
                    .into_iter()
                    .flat_map(|x|x) {
                    self.process_solution(sol)?;
                }
                if self.current_length >= max_len {
                    return Ok(())
                } else {
                    self.current_length += 1;
                }
            }
            Ok(())
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
                let x = tx.send(input);
                x
            } else {
                Err(crossbeam::channel::SendError(input))
            }
        }
    }


    #[derive(Debug, Clone, Eq, PartialEq)]
    struct VRSegment {
        alg: Vec<Turn333>,
        pop: usize,
        dr_breaking: bool,
    }

    #[derive(Debug, Clone, Eq, PartialEq)]
    struct VRSegments {
        segments: Vec<VRSegment>,
        boundaries: Vec<Vec<Turn333>>,
    }

    #[derive(Copy, Debug, Clone)]
    struct BoundaryMetadata(usize, usize, usize);
    impl BoundaryMetadata {
        fn cost(&self) -> usize {
            self.0
        }
        fn real_boundary_index(&self) -> usize {
            self.1
        }
        fn boundary_start_turn_index(&self) -> usize {
            self.2
        }
    }

    #[derive(Debug)]
    struct SegmentMetadata(usize);
    impl SegmentMetadata {
        fn pop_value(&self) -> usize {
            self.0
        }
    }

    #[derive(Debug)]
    struct AggregatedVRSegments<'a> {
        segments: Vec<SegmentMetadata>,
        boundaries: Vec<BoundaryMetadata>,
        vr_segments: &'a VRSegments
    }

    #[derive(Debug, Clone, Eq, PartialEq)]
    pub(crate) struct VR {
        vr_segments: VRSegments,
        e_insertions: HashMap<usize, Direction>,
        // toggled_boundaries: HashSet<usize>,
        cost: usize,
    }

    #[derive(Debug, Clone, Eq, PartialEq)]
    pub(crate) struct VRSolution {
        pub(crate) e_insertions: HashMap<usize, Direction>,
        length: usize,
    }

    impl VRSolution {
        pub(crate) fn vr_step_insertions(self, steps: &Vec<&SolutionStep>, trans: Option<Transformation333>) -> VRInsertions {
            let mut e_insertions: HashMap<StepVariant, Vec<(usize, Direction)>> = HashMap::new();
            let normal_length = steps.iter()
                .map(|x|x.alg.normal_moves.len())
                .sum::<usize>();
            for (index, direction) in self.e_insertions.iter() {
                let mut offset = 0;
                if *index <= normal_length && normal_length > 0 {
                    for step in steps {
                        if step.alg.len() == 0 {
                            continue
                        }
                        if index - offset <= step.alg.normal_moves.len() {
                            e_insertions.entry(step.variant.clone())
                                .or_default()
                                .push((index - offset, *direction));
                            break
                        }
                        offset += step.alg.normal_moves.len();
                    }
                } else {
                    let index = *index - normal_length;
                    for step in steps.iter().rev() {
                        if step.alg.len() == 0 {
                            continue
                        }
                        if index - offset <= step.alg.inverse_moves.len() {
                            e_insertions.entry(step.variant.clone())
                                .or_default()
                                .push((index - offset, *direction));
                            break
                        }
                        offset += step.alg.inverse_moves.len();
                    }
                }
            }
            VRInsertions(e_insertions, trans.or(Some(Transformation333::Y)))
        }
    }

    #[derive(Copy, Clone)]
    struct WideTurn333(Turn333, bool);

    impl WideTurn333 {
        pub fn turn_cube(&self, cube: &mut Cube333) {
            if self.1 {
                let turn = Turn333 {
                    face: self.0.face.opposite(),
                    dir: self.0.dir,
                };
                cube.turn(turn);
                let dir = if self.0.face == CubeFace::Up || self.0.face == CubeFace::Front || self.0.face == CubeFace::Right {
                    self.0.dir
                } else {
                    self.0.dir.invert()
                };
                let trans = Transformation333::new(self.0.face.get_axis(), dir);
                cube.transform(trans);
            } else {
                cube.turn(self.0);
            }
        }
    }

    pub fn solve_slice(cube: &Cube333, solution: &Solution, vr_in: usize, to_solved: bool) -> Option<Solution> {
        let post_dr_steps = solution.steps.iter()
            .skip_while(|x|Into::<StepKind>::into(x.variant) < StepKind::HTR)
            .collect_vec();
        let mut dr_cube = cube.clone();
        solution.steps.iter()
            .take_while(|x|Into::<StepKind>::into(x.variant) < StepKind::HTR)
            .for_each(|x|dr_cube.apply_alg(&x.alg));
        let mut post_dr = normalize_post_dr(&solution);
        let mut post_dr_cube = dr_cube.clone();
        for turn in &post_dr {
            post_dr_cube.turn(*turn);
        }
        let axis = if post_dr_cube.get_cube_state() == CubeState::Solved {
            if DRUDEOFBCoord::from(&dr_cube).val() == 0 {
                CubeAxis::UD
            } else {
                dr_cube.transform(Transformation333::X);
                let ls_axis = DRUDEOFBCoord::from(&dr_cube).val() == 0;
                dr_cube.transform(Transformation333::Xi);
                if ls_axis {
                    CubeAxis::FB
                } else {
                    dr_cube.transform(CubeTransformation::Z);
                    let ls_axis = DRUDEOFBCoord::from(&dr_cube).val() == 0;
                    dr_cube.transform(Transformation333::Zi);
                    if ls_axis {
                        CubeAxis::LR
                    } else {
                        return None
                    }
                }
            }
        } else {
            if HTRLeaveSliceFinishCoord::from(&post_dr_cube).val() == 0 {
                CubeAxis::UD
            } else {
                post_dr_cube.transform(Transformation333::X);
                let ls_axis = HTRLeaveSliceFinishCoord::from(&post_dr_cube).val() == 0;
                post_dr_cube.transform(Transformation333::Xi);
                if ls_axis {
                    CubeAxis::FB
                } else {
                    post_dr_cube.transform(Transformation333::Z);
                    let ls_axis = HTRLeaveSliceFinishCoord::from(&post_dr_cube).val() == 0;
                    post_dr_cube.transform(Transformation333::Zi);
                    if ls_axis {
                        CubeAxis::LR
                    } else {
                        return None
                    }
                }
            }
        };
        let transformations = match axis {
            CubeAxis::UD => None,
            CubeAxis::FB => Some(Transformation333::X),
            CubeAxis::LR => Some(Transformation333::Z),
        };
        transformations.iter().for_each(|t|{
            post_dr_cube.transform(*t);
            dr_cube.transform(*t);
            post_dr.iter_mut()
                .for_each(|x|*x = x.transform(*t));
        });
        let vr_segments = to_segments(&post_dr);
        let aggregated = match vr_in {
            0 => vr_segments.aggregate_vr_in_0(),
            1 => vr_segments.aggregate_vr_in_1(),
            _ => vr_segments.aggregate_vr_in_2()
        };
        let target_number = get_target_num(&post_dr_cube);

        if !to_solved {
            aggregated.find_vrs(target_number).into_iter()
                .map(|x|VRSolution {
                    e_insertions: x.e_insertions,
                    length: 0,
                })
                .map(|mut x|{
                    if axis != CubeAxis::UD {
                        x.e_insertions.values_mut().for_each(|x|{
                            *x = x.invert();
                        });
                    }
                    x.vr_step_insertions(&post_dr_steps, transformations)
                })
                .map(|x|{
                    let mut solution = solution.clone();
                    solution.set_vr_insertions(x);
                    solution
                })
                .min_by(|a, b|{
                    fn insertion_count(sol: &Solution) -> usize {
                        sol.steps.iter().map(|x|x.e_insertions.len()).sum()
                    }
                    a.len().cmp(&b.len())
                        .then(insertion_count(&a).cmp(&insertion_count(&b)))
                })
        } else {
            aggregated.find_vrs(target_number).into_iter()
                .filter_map(|vr|vr.solve(&dr_cube))
                .map(|mut x|{
                    if axis != CubeAxis::UD {
                        x.e_insertions.values_mut().for_each(|x|{
                            *x = x.invert();
                        });
                    }
                    x.vr_step_insertions(&post_dr_steps, transformations)
                })
                .map(|x|{
                    let mut solution = solution.clone();
                    solution.set_vr_insertions(x);
                    solution
                })
                .min_by(|a, b|{
                    fn insertion_count(sol: &Solution) -> usize {
                        sol.steps.iter().map(|x|x.e_insertions.len()).sum()
                    }
                    a.len().cmp(&b.len())
                        .then(insertion_count(&a).cmp(&insertion_count(&b)))
                })
        }
    }

    #[derive(Clone, Hash, Eq, PartialEq)]
    enum VRSwapType {
        FB,
        LR,
        Diagonal,
    }

    impl Display for VRSwapType {
        fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
            match self {
                VRSwapType::FB => write!(f, "f"),
                VRSwapType::LR => write!(f, "r"),
                VRSwapType::Diagonal => write!(f, "g")
            }
        }
    }

    impl Debug for VRSwapType {
        fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
            write!(f, "{self}")
        }
    }

    impl VR {
        fn get_e_slice_direction(boundary: &Vec<Turn333>) -> Direction {
            boundary.iter()
                .find(|x|x.dir != Direction::Half)
                .map(|x|if x.face == CubeFace::Down {
                    x.dir
                } else {
                    x.dir.invert()
                }).unwrap_or(Direction::Clockwise)
        }

        fn solves_centers(&self) -> bool {
            self.e_insertions.values()
                .map(|x|x.to_qt())
                .sum::<u8>() % 4 == 0
        }

        fn get_required_swaps(&self, cube: &Cube333) -> Vec<VRSwapType> {
            let centers_solved = self.solves_centers();
            let fl_edge = if centers_solved {
                (cube.get_edges_raw()[0] >> 36) & 0b11
            } else {
                (cube.get_edges_raw()[0] >> 60) & 0b11
            };
            match fl_edge {
                0 if centers_solved => vec![],
                0 => vec![VRSwapType::FB, VRSwapType::LR, VRSwapType::Diagonal],
                1 if centers_solved => vec![VRSwapType::LR, VRSwapType::Diagonal],
                1 => vec![VRSwapType::FB],
                2 if centers_solved => vec![VRSwapType::FB, VRSwapType::Diagonal],
                2 => vec![VRSwapType::LR],
                3 if centers_solved => vec![VRSwapType::FB, VRSwapType::LR],
                3 => vec![VRSwapType::Diagonal],
                _ => unreachable!()
            }
        }

        fn get_current_e2_swap(cube: &Cube333, center_parity: bool) -> VRSwapType {
            let edge0 = match (cube.get_edges_raw()[0] >> 36) & 0b11 {
                2 => 3,
                3 => 2,
                x => x
            };
            let edge1 = match (cube.get_edges_raw()[0] >> 60) & 0b11 {
                2 => 3,
                3 => 2,
                x => x
            };
            let swap = if (edge0 + edge1) % 2 == 0 {
                VRSwapType::Diagonal
            } else if edge0 >> 1 == edge1 >> 1 {
                VRSwapType::FB
            } else {
                VRSwapType::LR
            };
            if center_parity {
                match swap {
                    VRSwapType::FB => VRSwapType::LR,
                    VRSwapType::LR => VRSwapType::FB,
                    VRSwapType::Diagonal => VRSwapType::Diagonal,
                }
            } else {
                swap
            }
        }

        pub fn get_e_slice_insertion_cost(boundary: &Vec<Turn333>, e_direction: Direction) -> isize {
            if boundary.is_empty() {
                return 2
            }
            let (total_u, total_d) = boundary.iter()
                .fold((0, 0), |(total_u, total_d), turn|{
                    if turn.face == CubeFace::Up {
                        ((total_u + turn.dir.to_qt()) % 4, total_d)
                    } else {
                        (total_u, (total_d + turn.dir.to_qt()) % 4)
                    }
                });
            let mut cost = 0;
            if total_u == 0 {
                cost += 1;
            } else if total_u == e_direction.invert().to_qt() {
                cost -= 1;
            }
            if total_d == 0 {
                cost += 1;
            } else if total_d == e_direction.to_qt() {
                cost -= 1;
            }
            cost
        }

        pub(crate) fn solve(&self, dr_cube: &Cube333) -> Option<VRSolution> {
            let mut dr_cube = dr_cube.clone();
            let mut best_swap: HashMap<VRSwapType, (usize, isize)> = HashMap::new();
            let mut boundaries = self.vr_segments.boundaries.iter().cloned();
            let mut turn_index = 0;
            let e_direction = Direction::from_qt(self.e_insertions.get(&turn_index).map(|x|x.to_qt()).unwrap_or(0) + 2).unwrap();
            let boundary_turns = boundaries.next().unwrap_or(vec![]);
            let cost = Self::get_e_slice_insertion_cost(&boundary_turns, e_direction);
            let mut center_qt_parity = false;
            let swap = Self::get_current_e2_swap(&dr_cube, false);
            if let Some((_, cost_old)) = best_swap.get(&swap) {
                if *cost_old > cost {
                    best_swap.insert(swap, (turn_index, cost));
                }
            } else {
                best_swap.insert(swap, (turn_index, cost));
            }
            let mut insertions = self.e_insertions.clone();
            if let Some(e_dir) = insertions.remove(&turn_index) {
                WideTurn333(Turn333::new(CubeFace::Down, e_dir), true).turn_cube(&mut dr_cube);
                WideTurn333(Turn333::new(CubeFace::Down, e_dir.invert()), false).turn_cube(&mut dr_cube);
                center_qt_parity = !center_qt_parity;
            }
            turn_index += boundary_turns.len();

            for turn in boundary_turns {
                dr_cube.turn(turn);
            }
            for (segment, boundary) in self.vr_segments.segments.iter().cloned().zip(boundaries) {
                for (idx, turn) in segment.alg.into_iter().enumerate() {
                    if segment.dr_breaking && idx > 0 {
                        dr_cube.turn(turn);
                        turn_index += 1;
                        continue
                    }
                    let cost = 2;
                    let swap = Self::get_current_e2_swap(&dr_cube, center_qt_parity);
                    if let Some((_, cost_old)) = best_swap.get(&swap) {
                        if *cost_old > cost {
                            best_swap.insert(swap, (turn_index, cost));
                        }
                    } else {
                        best_swap.insert(swap, (turn_index, cost));
                    }
                    if let Some(e_dir) = insertions.remove(&turn_index) {
                        WideTurn333(Turn333::new(CubeFace::Down, e_dir), true).turn_cube(&mut dr_cube);
                        WideTurn333(Turn333::new(CubeFace::Down, e_dir.invert()), false).turn_cube(&mut dr_cube);
                        center_qt_parity = !center_qt_parity;
                    }
                    dr_cube.turn(turn);
                    turn_index += 1;
                }
                let e_direction = Direction::from_qt(self.e_insertions.get(&turn_index).map(|x|x.to_qt()).unwrap_or(0) + 2).unwrap();
                let cost = Self::get_e_slice_insertion_cost(&boundary, e_direction);
                let swap = Self::get_current_e2_swap(&dr_cube, center_qt_parity);
                if let Some((_, cost_old)) = best_swap.get(&swap) {
                    if *cost_old > cost {
                        best_swap.insert(swap, (turn_index, cost));
                    }
                } else {
                    best_swap.insert(swap, (turn_index, cost));
                }
                if let Some(e_dir) = insertions.remove(&turn_index) {
                    WideTurn333(Turn333::new(CubeFace::Down, e_dir), true).turn_cube(&mut dr_cube);
                    WideTurn333(Turn333::new(CubeFace::Down, e_dir.invert()), false).turn_cube(&mut dr_cube);
                    center_qt_parity = !center_qt_parity;
                }
                turn_index += boundary.len();
                for turn in boundary {
                    dr_cube.turn(turn);
                }
            }
            let req_swap_types = self.get_required_swaps(&dr_cube);
            let mut vr_solution = VRSolution {
                length: turn_index + self.cost,
                e_insertions: self.e_insertions.clone(),
            };
            for swap in req_swap_types {
                if let Some((position, cost)) = best_swap.get(&swap) {
                    if let Some(direction) = vr_solution.e_insertions.remove(position) {
                        if direction != Direction::Half {
                            vr_solution.e_insertions.insert(*position, direction.invert());
                        }
                    } else {
                        vr_solution.e_insertions.insert(*position, Direction::Half);
                    }
                    vr_solution.length = (vr_solution.length as isize + *cost) as usize;
                } else {
                    return None
                }
            }
            Some(vr_solution)
        }
    }

    impl <'a, 'b> AggregatedVRSegments<'b> {
        pub fn find_vrs(&'a self, goal: isize) -> Vec<VR>{
            let goal = if goal == -1 {
                2 as usize
            } else {
                goal as usize
            };
            let segments_0: Vec<usize> = self.segments.iter()
                .enumerate()
                .filter(|(_, x)|x.pop_value() == 0)
                .map(|(idx, _)|idx)
                .collect();
            let segments_1: Vec<usize> = self.segments.iter()
                .enumerate()
                .filter(|(_, x)|x.pop_value() == 1)
                .map(|(idx, _)|idx)
                .collect();
            let segments_2: Vec<usize> = self.segments.iter()
                .enumerate()
                .filter(|(_, x)|x.pop_value() == 2)
                .map(|(idx, _)|idx)
                .collect();
            let mut to_check: Vec<(usize, usize)> = match goal {
                0 => vec![(0usize, 0)].into_iter(),
                1 => vec![(1, 0), (0, 2)].into_iter(),
                2 => vec![(0, 1), (2, 0)].into_iter(),
                _ => unreachable!()
            }.filter(|(one, two)|*one <= segments_1.len() && *two <= segments_2.len())
                .collect();
            let mut possible_configurations = vec![];
            while !to_check.is_empty() {
                let mut to_check_next = vec![];
                for (one, two) in to_check.iter().cloned() {
                    if segments_1.len() >= one + 3 {
                        to_check_next.push((one + 3, two));
                    }
                    if segments_2.len() >= two + 3 {
                        to_check_next.push((one, two + 3));
                    }
                    if segments_1.len() >= one + 1 && segments_2.len() >= two + 1 {
                        to_check_next.push((one + 1, two + 1));
                    }
                }
                possible_configurations.append(&mut to_check);
                to_check_next.sort_by(|(a1, a2), (b1, b2)|a1.cmp(b1).then(a2.cmp(b2)));
                to_check_next.dedup();
                to_check = to_check_next;
            }
            possible_configurations.sort_by(|(a1, a2), (b1, b2)|a1.cmp(b1).then(a2.cmp(b2)));
            possible_configurations.dedup();
            possible_configurations.into_iter()
                .flat_map(|(one, two)|
                segments_0.iter().cloned().powerset().cartesian_product(
                    segments_1.iter().cloned().combinations(one)
                        .cartesian_product(segments_2.iter().cloned().combinations(two))
                )
                )
                .map(|(mut zeros, (mut ones, mut twos))|{
                    zeros.append(&mut ones);
                    zeros.append(&mut twos);
                    zeros.sort();
                    zeros
                })
                .map(|sections| {
                    let mut toggled_boundaries = vec![];
                    let mut previous_section = None;
                    for section in &sections {
                        let section = section.clone();
                        if let Some(previous) = previous_section {
                            previous_section = Some(section);
                            if previous != section - 1 {
                                toggled_boundaries.push(previous + 1);
                                toggled_boundaries.push(section);
                            }
                        } else {
                            previous_section = Some(section);
                            toggled_boundaries.push(section);
                        }
                    }
                    if let Some(previous) = previous_section {
                        if previous == *sections.last().unwrap() {
                            toggled_boundaries.push(previous + 1);
                        }
                    }
                    let cost = toggled_boundaries.iter()
                        .map(|x|self.boundaries[*x].cost())
                        .sum();
                    VR {
                        vr_segments: self.vr_segments.clone(),
                        e_insertions: toggled_boundaries.into_iter()
                            .map(|x|self.boundaries[x])
                            .map(|boundary|(boundary.boundary_start_turn_index(), VR::get_e_slice_direction(&self.vr_segments.boundaries[boundary.real_boundary_index()])))
                            .collect(),
                        cost
                    }
                })
                .sorted_by(|a, b|a.cost.cmp(&b.cost))
                .collect()
        }
    }

    impl VRSegments {
        pub fn aggregate_vr_in_0(&self) -> AggregatedVRSegments<'_> {
            fn is_qt_boundary(boundary: &Vec<Turn333>) -> bool {
                boundary.iter().any(|x|x.dir.to_qt() % 2 == 1)
            }
            let mut aggregated = AggregatedVRSegments {
                segments: vec![],
                boundaries: vec![],
                vr_segments: self
            };
            let mut first_real_boundary = false;
            let mut boundaries = self.boundaries.iter().enumerate();
            let mut turn_count = 0;
            if self.boundaries.len() > self.segments.len() {
                let (b_idx, boundary) = boundaries.next().unwrap();
                turn_count += boundary.len();
                if is_qt_boundary(boundary) {
                    aggregated.boundaries.push(BoundaryMetadata(0, b_idx, 0));
                    first_real_boundary = true;
                }
            }
            let mut current_pop = 0;
            for (segment, (b_idx, boundary)) in self.segments.iter().zip(boundaries) {
                current_pop = (current_pop + segment.pop) % 3;
                turn_count += segment.alg.len();
                if !is_qt_boundary(boundary) {
                    turn_count += boundary.len();
                    continue;
                }
                if first_real_boundary {
                    aggregated.segments.push(SegmentMetadata(current_pop));
                }
                aggregated.boundaries.push(BoundaryMetadata(0, b_idx, turn_count));
                turn_count += boundary.len();
                first_real_boundary = true;
                current_pop = 0;
            }
            aggregated
        }
        pub fn aggregate_vr_in_1(&self) -> AggregatedVRSegments<'_> {
            fn get_boundary_type(boundary: &Vec<Turn333>) -> usize {
                boundary.iter()
                    .map(|x|if x.dir == Direction::Half {
                        1
                    } else {
                        0
                    })
                    .max()
                    .unwrap_or(2)
            }
            let mut aggregated = AggregatedVRSegments {
                segments: vec![],
                boundaries: vec![],
                vr_segments: self
            };
            let mut first_real_boundary = false;
            let mut boundaries = self.boundaries.iter().enumerate();
            let mut turn_count = 0;
            if self.boundaries.len() > self.segments.len() {
                let (b_idx, boundary) = boundaries.next().unwrap();
                let boundary_type = get_boundary_type(boundary);
                if boundary_type != 2 {
                    aggregated.boundaries.push(BoundaryMetadata(boundary_type, b_idx, 0));
                    first_real_boundary = true;
                }
                turn_count += boundary.len();
            }
            let mut current_pop = 0;
            for (segment, (b_idx, boundary)) in self.segments.iter().zip(boundaries) {
                current_pop = (current_pop + segment.pop) % 3;
                turn_count += segment.alg.len();
                if get_boundary_type(boundary) == 2 {
                    turn_count += boundary.len();
                    continue;
                }
                if first_real_boundary {
                    aggregated.segments.push(SegmentMetadata(current_pop));
                }
                aggregated.boundaries.push(BoundaryMetadata(get_boundary_type(boundary), b_idx, turn_count));
                turn_count += boundary.len();
                first_real_boundary = true;
                current_pop = 0;
            }
            aggregated
        }
        pub fn aggregate_vr_in_2(&self) -> AggregatedVRSegments<'_> {
            let mut aggregated = AggregatedVRSegments {
                segments: vec![],
                boundaries: vec![],
                vr_segments: self
            };
            let mut boundaries = self.boundaries.iter().enumerate();
            let mut turn_count = 0;
            if self.boundaries.len() > self.segments.len() {
                let (b_idx, boundary) = boundaries.next().unwrap();
                let boundary_type = boundary.iter()
                    .map(|x|if x.dir == Direction::Half {
                        1
                    } else {
                        0
                    })
                    .max()
                    .unwrap_or(2);
                aggregated.boundaries.push(BoundaryMetadata(boundary_type, b_idx, turn_count));
                turn_count += boundary.len();
            }
            for (segment, (b_idx, boundary)) in self.segments.iter().zip(boundaries) {
                aggregated.segments.push(SegmentMetadata(segment.pop));
                turn_count += segment.alg.len();
                let boundary_type = boundary.iter()
                    .map(|x|if x.dir == Direction::Half {
                        1
                    } else {
                        0
                    })
                    .max()
                    .unwrap_or(2);
                aggregated.boundaries.push(BoundaryMetadata(boundary_type, b_idx, turn_count));
                turn_count += boundary.len();
            }
            aggregated
        }
    }

    impl Display for AggregatedVRSegments<'_> {
        fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
            let mut boundaries = self.boundaries.iter();
            if self.boundaries.len() > self.segments.len() {
                match boundaries.next().unwrap().cost() {
                    0 => write!(f, "| ")?,
                    1 => write!(f, "$ ")?,
                    2 => write!(f, "")?,
                    _ => unreachable!()
                }
            }
            for (segment, boundary) in self.segments.iter().zip(boundaries) {
                write!(f, "{} ", match segment.pop_value() {
                    0 => "0",
                    1 => "+1",
                    2 => "-1",
                    _ => unreachable!()
                })?;
                match boundary.cost() {
                    0 => write!(f, "| ")?,
                    1 => write!(f, "$ ")?,
                    2 => write!(f, "")?,
                    _ => unreachable!()
                }
            }
            Ok(())
        }
    }

    fn find_dr_preserving_alternative(turns: &Vec<Turn333>) -> Vec<Turn333> {
        let alternative: Algorithm = {
            let dr_step = DRFinishStep::new(DFSParameters {
                niss_type: NissSwitchType::Never,
                min_moves: 0,
                max_moves: 20,
                absolute_max_moves: None,
                ignore_previous_step_restrictions: false,
            }, vec![CubeAxis::UD], false);
            let mut dr_cube = Cube333::default();
            for t in turns.iter().rev() {
                dr_cube.turn(t.invert());
            }
            dr_step.into_worker(dr_cube)
                .next()
                .expect("Cube has to be solvable")
                .into()
        };
        alternative.normal_moves
    }

    fn to_segments(post_dr: &Vec<Turn333>) -> VRSegments {
        let mut even = true;
        let mut segments = VRSegments {
            segments: vec![],
            boundaries: vec![],
        };
        let mut current_boundary = vec![];
        let mut cube = Cube333::default();
        let mut dr_breaking = vec![];
        for turn in post_dr.iter().rev() {
            cube.turn(*turn);
            if cube.get_cube_state() >= CubeState::DR(CubeAxis::UD) {
                if !dr_breaking.is_empty() {
                    dr_breaking.push(*turn);
                    dr_breaking.reverse();
                    let alternative = find_dr_preserving_alternative(&dr_breaking);
                    let mut total_pop = 0;
                    for turn in alternative.iter().rev() {
                        if turn.face.is_on_axis(CubeAxis::UD) {
                            continue;
                        }
                        total_pop += if even == turn.face.is_on_axis(CubeAxis::FB) {
                            1
                        } else {
                            2
                        };
                        even = !even;
                    }
                    current_boundary.reverse();
                    segments.boundaries.push(current_boundary);
                    current_boundary = vec![];
                    segments.segments.push(VRSegment {
                        alg: dr_breaking,
                        pop: total_pop % 3,
                        dr_breaking: true,
                    });
                    dr_breaking = vec![];
                    continue
                }
                if turn.face.get_axis() == CubeAxis::UD {
                    current_boundary.push(turn.clone());
                } else {
                    current_boundary.reverse();
                    segments.boundaries.push(current_boundary);
                    current_boundary = vec![];
                    let pop = if even == turn.face.is_on_axis(CubeAxis::FB) {
                        1
                    } else {
                        2
                    };
                    segments.segments.push(VRSegment {
                        alg: vec![turn.clone()],
                        pop,
                        dr_breaking: false,
                    });
                    even = !even;
                }
            } else {
                dr_breaking.push(*turn);
            }
        }
        current_boundary.reverse();
        segments.boundaries.push(current_boundary);
        segments.segments.reverse();
        segments.boundaries.reverse();
        assert_eq!(segments.segments.len() + 1, segments.boundaries.len());
        segments
    }

    fn normalize_post_dr(solution: &Solution) -> Vec<Turn333> {
        let alg = solution.steps.iter()
            .skip_while(|x|Into::<StepKind>::into(x.variant) < StepKind::HTR)
            .fold(Algorithm::new(), |mut acc, step|{
                acc = acc + step.alg.clone();
                acc
            });
        alg.to_uninverted().normal_moves
    }

    fn get_target_num(ec: &EdgeCube333) -> isize {
        if correct_eslice_count(ec) % 4 == 0 {
            return 0
        }
        let mut ec = ec.clone();
        ec.turn(Turn333::F2);
        ec.turn(Turn333::R2);
        if correct_eslice_count(&ec) % 4 == 0 {
            1
        } else {
            -1
        }
    }

    fn correct_eslice_count(ec: &EdgeCube333) -> u8 {
        let ec: u8x16 = ec.0.into();
        ec.simd_eq(u8x16::from_array([0xFF, 0xFF, 0xFF, 0xFF, 0x40, 0x50, 0x60, 0x70, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF]))
            .to_bitmask().count_ones() as u8
    }
}
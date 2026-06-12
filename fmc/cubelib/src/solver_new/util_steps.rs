use std::cell::RefCell;
use std::collections::{HashMap, HashSet};
use std::sync::atomic::{AtomicUsize, Ordering};
use crate::algs::Algorithm;
use crate::cube::{Cube333, Turn333};
use crate::cube::turn::Direction;
use crate::defs::StepKind;
use crate::solver::solution::Solution;
use crate::solver_new::group::{StepPredicate, StepPredicateResult};

pub struct FilterDup(RefCell<HashSet<Algorithm>>);
pub struct FilterLastMoveNotPrime;
pub struct Filter(pub Box<dyn Fn(&Solution, &Cube333) -> bool + Send>);
pub struct FilterFirstN(AtomicUsize);
pub struct FilterFirstNStepVariant {
    kind: StepKind,
    n: usize,
    found: RefCell<HashMap<Algorithm, usize>>,
}

pub struct FilterExcluded(HashSet<Algorithm>);

impl FilterExcluded {
    pub fn new(excluded: HashSet<Algorithm>) -> Box<dyn StepPredicate> {
        Box::new(Self(excluded.into_iter()
            .map(to_last_move_non_prime_alg)
            .map(Algorithm::canonicalize)
            .collect()))
    }
}

impl StepPredicate for FilterExcluded {
    fn check_solution(&self, solution: &Solution) -> StepPredicateResult {
        let qt_filter = if let Some(kind) = solution.steps.last().map(|x|StepKind::from(x.variant)) {
            match kind {
                StepKind::EO | StepKind::RZP | StepKind::DR | StepKind::HTR => true,
                _ => false,
            }
        } else {
            false
        };
        let solution_alg: Algorithm = solution.clone().into();
        let solution_alg = if qt_filter {
            to_last_move_non_prime_alg(solution_alg)
        } else {
            solution_alg
        };

        if self.0.contains(&solution_alg) {
            StepPredicateResult::Rejected
        } else {
            StepPredicateResult::Accepted
        }
    }
}

impl FilterDup {
    pub fn new() -> Box<dyn StepPredicate> {
        Box::new(Self(RefCell::new(Default::default())))
    }
}

impl FilterLastMoveNotPrime {
    pub fn new() -> Box<dyn StepPredicate> {
        Box::new(Self)
    }
}

impl FilterFirstN {
    pub fn new(n: usize) -> Box<dyn StepPredicate> {
        Box::new(Self(AtomicUsize::new(n)))
    }
}

impl FilterFirstNStepVariant {
    pub fn new(kind: StepKind, n: usize) -> Box<dyn StepPredicate> {
        Box::new(Self {
            kind,
            n,
            found: RefCell::new(Default::default()),
        })
    }
}

impl StepPredicate for FilterDup {
    fn check_solution(&self, solution: &Solution) -> StepPredicateResult {
        let uninverted = solution.steps.last().map(|x|StepKind::from(x.variant) == StepKind::FIN).is_some();
        let mut alg: Algorithm = solution.clone().into();
        if uninverted {
            alg = alg.to_uninverted();
        }

        if self.0.borrow_mut().insert(alg.canonicalize()) {
            StepPredicateResult::Accepted
        } else {
            StepPredicateResult::Rejected
        }
    }
}

impl StepPredicate for FilterLastMoveNotPrime {
    fn check_solution(&self, solution: &Solution) -> StepPredicateResult {
        fn non_prime_end(vec: &Vec<Turn333>) -> bool {
            if vec.is_empty() {
                return true;
            }
            let last = vec.last().unwrap();
            if last.dir == Direction::CounterClockwise {
                return false;
            }
            if vec.len() > 1 {
                if vec[vec.len() - 2].face == last.face.opposite() {
                    return vec[vec.len() - 2].dir != Direction::CounterClockwise;
                }
            }
            return true;
        }
        let alg: Algorithm = solution.clone().into();
        if non_prime_end(&alg.normal_moves) && non_prime_end(&alg.inverse_moves) {
            StepPredicateResult::Accepted
        } else {
            StepPredicateResult::Rejected
        }
    }
}

impl StepPredicate for FilterFirstN {
    fn check_solution(&self, _: &Solution) -> StepPredicateResult {
        let mut v = self.0.load(Ordering::Relaxed);
        if v == 0 {
            return StepPredicateResult::Closed;
        }
        loop {
            match self.0.compare_exchange(v, v - 1, Ordering::Relaxed, Ordering::Relaxed) {
                Ok(_) => {
                    return StepPredicateResult::Accepted;
                }
                Err(old) => {
                    if old == 0 {
                        return StepPredicateResult::Closed;
                    }
                    v = old;
                }
            }
        }
    }
}

impl StepPredicate for FilterFirstNStepVariant {
    fn check_solution(&self, solution: &Solution) -> StepPredicateResult {
        if self.kind == StepKind::FIN {
            return StepPredicateResult::Accepted;
        }
        let mut alg_up_to_kind = Algorithm::new();
        let mut found = false;
        for step in &solution.steps {
            alg_up_to_kind = alg_up_to_kind + step.alg.clone();
            if StepKind::from(step.variant) == self.kind {
                found = true;
                break;
            }
        }
        if !found {
            return StepPredicateResult::Accepted;
        }
        let normalized_alg = match self.kind {
            StepKind::FR | StepKind::FIN | StepKind::Other(_) => alg_up_to_kind,
            _ => to_last_move_non_prime_alg(alg_up_to_kind)
        };
        let mut found = self.found.borrow_mut();
        let entry = found.entry(normalized_alg);
        let entry = entry.or_insert(0);
        *entry += 1;
        if *entry <= self.n {
            StepPredicateResult::Accepted
        } else {
            StepPredicateResult::Rejected
        }
    }
}

fn to_last_move_non_prime_alg(mut alg: Algorithm) -> Algorithm {
    fn to_non_prime(vec: &mut Vec<Turn333>) {
        if vec.is_empty() {
            return;
        }
        let len = vec.len();
        let last = vec.last_mut().unwrap();
        if last.dir == Direction::CounterClockwise {
            last.dir = Direction::Clockwise;
        }
        if len > 1 {
            let last_face = last.face;
            let before_last = &mut vec[len - 2];
            if before_last.face == last_face.opposite() && before_last.dir == Direction::CounterClockwise{
                before_last.dir = Direction::Clockwise;
            }
        }
    }
    to_non_prime(&mut alg.normal_moves);
    to_non_prime(&mut alg.inverse_moves);
    alg
}
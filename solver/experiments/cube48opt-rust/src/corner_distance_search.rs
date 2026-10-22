//! A deliberately simple bounded full-cube IDA* consumer of d_C. It does not
//! reuse the H-specific masks, opposite-side caches, or NISS fields in search.rs.

use crate::corner_oracle::FullCornerDistanceOracle;
use crate::cube::Cube;
use std::collections::HashMap;

#[derive(Clone, Copy, Debug)]
pub struct Options {
    pub max_depth: u8,
    /// Zero is rejected: this research entry always has a finite node budget.
    pub max_nodes: u64,
    /// Zero disables the cache. Entries include the previous-face context.
    pub failed_cache_capacity: usize,
}

impl Default for Options {
    fn default() -> Self {
        Self { max_depth: 10, max_nodes: 1_000_000, failed_cache_capacity: 100_000 }
    }
}

#[derive(Debug)]
pub struct Outcome {
    pub solution: Option<Vec<u8>>,
    pub completed_depth: Option<u8>,
    pub cancelled: bool,
    pub nodes: u64,
    pub cache_hits: u64,
}

#[derive(Clone, Copy, Hash, Eq, PartialEq)]
struct FailureKey {
    // A corner orbit is NOT a valid full-cube DFS failure key: edges matter.
    cube: Cube,
    previous_face: u8,
}

enum Visit { Found, Exhausted, Cancelled }

struct Search<'a, 'b> {
    oracle: &'a FullCornerDistanceOracle<'b>,
    options: Options,
    nodes: u64,
    cache_hits: u64,
    // Value r certifies failure of every permitted same-face-normal-form
    // continuation of length <= r in this previous-face context. It is not an
    // unconditional D(cube)>r certificate. Cancelled nodes never enter.
    failures: HashMap<FailureKey, u8>,
    path: Vec<u8>,
}

impl Search<'_, '_> {
    fn visit(&mut self, cube: Cube, remaining: u8, previous_face: u8) -> Result<Visit, String> {
        if self.nodes >= self.options.max_nodes { return Ok(Visit::Cancelled); }
        self.nodes += 1;
        if cube.is_solved() { return Ok(Visit::Found); }
        if remaining == 0 || (remaining < self.oracle.max_distance()
            && self.oracle.lower_bound(&cube)?.get() > remaining) {
            return Ok(Visit::Exhausted);
        }
        let key = FailureKey { cube, previous_face };
        if self.failures.get(&key).is_some_and(|&depth| depth >= remaining) {
            self.cache_hits += 1;
            return Ok(Visit::Exhausted);
        }
        for movement in 0..18u8 {
            // Any adjacent same-face pair reduces to <=1 HTM move. Therefore
            // at least one optimal solution survives this normal form.
            if movement / 3 == previous_face { continue; }
            self.path.push(movement);
            match self.visit(cube.moved(movement), remaining - 1, movement / 3)? {
                Visit::Found => return Ok(Visit::Found),
                Visit::Cancelled => { self.path.pop(); return Ok(Visit::Cancelled); }
                Visit::Exhausted => { self.path.pop(); }
            }
        }
        if self.options.failed_cache_capacity > 0 {
            if let Some(depth) = self.failures.get_mut(&key) {
                *depth = (*depth).max(remaining);
            } else if self.failures.len() < self.options.failed_cache_capacity {
                self.failures.insert(key, remaining);
            }
        }
        Ok(Visit::Exhausted)
    }
}

/// Returns an optimal solution if one is found before either bound stops the
/// search. `cancelled=true` does not certify failure at the interrupted depth.
pub fn solve(start: Cube, oracle: &FullCornerDistanceOracle<'_>, options: Options)
    -> Result<Outcome, String> {
    start.validate()?;
    if options.max_depth > 20 || options.max_nodes == 0
        || options.failed_cache_capacity > 1_000_000 {
        return Err("require depth <=20, positive node budget, and cache capacity <=1000000".into());
    }
    let initial = oracle.lower_bound(&start)?.get();
    let mut search = Search { oracle, options, nodes: 0, cache_hits: 0,
        failures: HashMap::new(), path: Vec::with_capacity(options.max_depth as usize) };
    let mut outcome = Outcome { solution: None, completed_depth: None, cancelled: false,
        nodes: 0, cache_hits: 0 };
    if initial > 0 { outcome.completed_depth = Some((initial - 1).min(options.max_depth)); }
    for depth in initial..=options.max_depth {
        match search.visit(start, depth, 6)? {
            Visit::Found => { outcome.solution = Some(search.path.clone()); break; }
            Visit::Exhausted => outcome.completed_depth = Some(depth),
            Visit::Cancelled => { outcome.cancelled = true; break; }
        }
    }
    outcome.nodes = search.nodes;
    outcome.cache_hits = search.cache_hits;
    Ok(outcome)
}

//! Single-cube native parallelism. Workers borrow one oracle and keep their
//! prefix rankings between depths; the coordinator is the depth barrier.
use cube48opt_research::{
    cube::Cube,
    search::{self, DepthSearch, PruningOracle, SearchOptions, SearchOutcome, SearchShard, SearchStats},
};
use std::sync::{atomic::{AtomicBool, Ordering}, mpsc};

pub const MAX_SEARCH_THREADS: usize = 16;

pub fn validate(options: SearchOptions, threads: usize) -> Result<(), String> {
    if threads == 0 || threads > MAX_SEARCH_THREADS {
        return Err("search threads must be 1..16".into());
    }
    if options.contexts != 1 && options.contexts != 8 {
        return Err("contexts must be 1 or 8".into());
    }
    if options.max_depth > 20 { return Err("max_depth must be at most 20".into()); }
    if threads > 1 && options.max_nodes != 0 {
        return Err("parallel single-cube search requires MAX_NODES=0; finite node budgets remain available with CUBEOPT_SEARCH_THREADS=1".into());
    }
    Ok(())
}

struct Cancellable<'a, O> { oracle: &'a O, stopped: &'a AtomicBool }
impl<O: PruningOracle> PruningOracle for Cancellable<'_, O> {
    type Query = O::Query;
    #[inline(always)] fn prepare(&self, cube: &Cube, remaining: u8) -> Result<Self::Query, u8> {
        self.oracle.prepare(cube, remaining)
    }
    #[inline(always)] fn lookup(&self, query: Self::Query) -> u8 { self.oracle.lookup(query) }
    #[inline(always)] fn max_bound(&self) -> u8 { self.oracle.max_bound() }
    #[inline(always)] fn allow_parent_propagation(&self) -> bool { self.oracle.allow_parent_propagation() }
    #[inline(always)] fn cancelled(&self) -> bool {
        self.stopped.load(Ordering::Relaxed) || self.oracle.cancelled()
    }
    fn conjugate(&self, cube: &Cube, symmetry: u8) -> Option<Cube> { self.oracle.conjugate(cube, symmetry) }
}

fn add_stats(total: &mut SearchStats, part: SearchStats) {
    total.nodes += part.nodes;
    total.probes += part.probes;
    total.inverse_probes += part.inverse_probes;
    total.cache_reuses += part.cache_reuses;
    total.splits += part.splits;
    total.face_prunes += part.face_prunes;
    total.face_siblings_removed += part.face_siblings_removed;
    total.jobs += part.jobs;
}

pub fn solve<O: PruningOracle + Sync>(
    start: Cube, oracle: &O, options: SearchOptions, threads: usize,
) -> Result<SearchOutcome, String> {
    validate(options, threads)?;
    if threads == 1 { return search::solve(start, oracle, options); }
    let stopped = AtomicBool::new(false);
    let oracle = Cancellable { oracle, stopped: &stopped };
    // Validate all shards before starting workers. No PDB allocation or clone.
    let searches = (0..threads).map(|index|
        DepthSearch::new(start, &oracle, SearchShard { index, count: threads })
    ).collect::<Result<Vec<_>, _>>()?;
    std::thread::scope(|scope| {
        let (results_tx, results_rx) = mpsc::channel();
        let mut commands = Vec::with_capacity(threads);
        let mut handles = Vec::with_capacity(threads);
        for (index, mut search) in searches.into_iter().enumerate() {
            let (depth_tx, depth_rx) = mpsc::sync_channel(1);
            let results_tx = results_tx.clone();
            let oracle = &oracle;
            let handle = std::thread::Builder::new().name(format!("cubeopt-search-{index}"))
                .spawn_scoped(scope, move || {
                    while let Ok(depth) = depth_rx.recv() {
                        // A panic/error must be reported to the barrier, not leave
                        // other workers searching while the coordinator waits.
                        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(||
                            search.run_depth_with_options(oracle, depth, options)
                        )).unwrap_or_else(|_| Err("search worker panicked".into()));
                        if match &result { Ok(result) => result.solution.is_some() || result.cancelled, Err(_) => true } {
                            oracle.stopped.store(true, Ordering::Relaxed);
                        }
                        if results_tx.send((index, result)).is_err() { break; }
                    }
                }).map_err(|error| format!("cannot spawn search worker: {error}"))?;
            handles.push(handle);
            commands.push(depth_tx);
        }
        drop(results_tx);
        let result = (|| {
            let mut total = SearchOutcome { solution: None, completed_depth: None,
                cancelled: false, stats: SearchStats::default() };
            for depth in 0..=options.max_depth {
                stopped.store(false, Ordering::Relaxed);
                for sender in &commands {
                    sender.send(depth).map_err(|_| "search worker exited before depth dispatch")?;
                }
                let mut error = None;
                let mut seen = vec![false; threads];
                for _ in 0..threads {
                    let (index, result) = results_rx.recv().map_err(|_| "search worker exited without a result")?;
                    if index >= threads || seen[index] { return Err("duplicate search worker result".into()); }
                    seen[index] = true;
                    match result {
                        Err(message) => { error.get_or_insert(message); }
                        Ok(part) => {
                            add_stats(&mut total.stats, part.stats);
                            total.cancelled |= part.cancelled;
                            if let Some(solution) = part.solution {
                                if solution.len() != usize::from(depth)
                                    || !solution.iter().fold(start, |cube, &movement| cube.moved(movement)).is_solved() {
                                    error.get_or_insert("parallel solution replay failed".into());
                                } else if total.solution.is_none() { total.solution = Some(solution); }
                            } else if !part.cancelled && part.completed_depth != Some(depth) {
                                error.get_or_insert("worker did not exhaust the requested depth".into());
                            }
                        }
                    }
                }
                // All workers have stopped using this depth's cancellation word.
                // Errors take precedence over a result from an incomplete pool.
                if let Some(error) = error { return Err(error); }
                if total.solution.is_some() { total.cancelled = false; return Ok(total); }
                if total.cancelled { return Ok(total); }
                total.completed_depth = Some(depth);
            }
            Ok(total)
        })();
        stopped.store(true, Ordering::Relaxed);
        drop(commands);
        for handle in handles {
            if handle.join().is_err() { return Err("search worker panicked outside its depth".into()); }
        }
        result
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::{HashMap, HashSet, VecDeque};
    use std::sync::Mutex;

    struct ZeroOracle { workers: Mutex<HashSet<std::thread::ThreadId>> }
    impl PruningOracle for ZeroOracle {
        type Query = ();
        fn prepare(&self, _: &Cube, _: u8) -> Result<(), u8> {
            self.workers.lock().unwrap().insert(std::thread::current().id()); Ok(())
        }
        fn lookup(&self, _: ()) -> u8 { 0 }
    }
    fn options(depth: u8, contexts: usize) -> SearchOptions {
        SearchOptions { max_depth: depth, max_nodes: 0, contexts }
    }

    #[test]
    fn every_shallow_state_matches_independent_bfs_with_one_and_eight_contexts() {
        let mut distances = HashMap::from([(Cube::SOLVED, 0u8)]);
        let mut queue = VecDeque::from([Cube::SOLVED]);
        while let Some(cube) = queue.pop_front() {
            let depth = distances[&cube];
            if depth == 2 { continue; }
            for movement in 0..18 {
                let child = cube.moved(movement);
                if let std::collections::hash_map::Entry::Vacant(entry) = distances.entry(child) {
                    entry.insert(depth + 1); queue.push_back(child);
                }
            }
        }
        assert_eq!(distances.len(), 262);
        let oracle = ZeroOracle { workers: Mutex::default() };
        for (&cube, &distance) in &distances {
            for contexts in [1, 8] {
                let result = solve(cube, &oracle, options(2, contexts), 4).unwrap();
                let moves = result.solution.unwrap();
                assert_eq!(moves.len(), distance as usize);
                assert!(moves.iter().fold(cube, |c, &m| c.moved(m)).is_solved());
                assert!(!result.cancelled);
                assert_eq!(result.completed_depth, distance.checked_sub(1));
            }
        }
        // Distinct OS workers actually executed oracle calls; contexts alone
        // would all run on the test's one thread.
        assert!(oracle.workers.lock().unwrap().len() >= 4);
        let hard = Cube::from_scramble("R U F").unwrap();
        let exhausted = solve(hard, &oracle, options(2, 8), 16).unwrap();
        assert!(exhausted.solution.is_none());
        assert_eq!(exhausted.completed_depth, Some(2));
        assert!(!exhausted.cancelled);
    }

    #[test]
    fn cancellation_and_panic_do_not_claim_a_completed_depth_or_poison_next_request() {
        struct Cancel;
        impl PruningOracle for Cancel {
            type Query = ();
            fn prepare(&self, _: &Cube, _: u8) -> Result<(), u8> { Ok(()) }
            fn lookup(&self, _: ()) -> u8 { 0 }
            fn cancelled(&self) -> bool { true }
        }
        let cube = Cube::from_scramble("R U").unwrap();
        let cancelled = solve(cube, &Cancel, options(2, 8), 4).unwrap();
        assert!(cancelled.cancelled);
        assert_eq!(cancelled.completed_depth, None);
        struct Panics;
        impl PruningOracle for Panics {
            type Query = ();
            fn prepare(&self, _: &Cube, _: u8) -> Result<(), u8> { panic!("fixture worker failure") }
            fn lookup(&self, _: ()) -> u8 { 0 }
        }
        assert!(solve(cube, &Panics, options(2, 8), 4).unwrap_err().contains("panicked"));
        let oracle = ZeroOracle { workers: Mutex::default() };
        assert_eq!(solve(cube, &oracle, options(2, 8), 4).unwrap().solution.unwrap().len(), 2);
    }

    #[test]
    fn finite_budget_is_preserved_for_one_thread_and_rejected_for_parallel_search() {
        let oracle = ZeroOracle { workers: Mutex::default() };
        let cube = Cube::from_scramble("R U").unwrap();
        let limited = SearchOptions { max_nodes: 1, ..options(2, 8) };
        let expected = search::solve(cube, &oracle, limited).unwrap();
        let actual = solve(cube, &oracle, limited, 1).unwrap();
        assert_eq!(actual.cancelled, expected.cancelled);
        assert_eq!(actual.completed_depth, expected.completed_depth);
        assert_eq!(actual.stats, expected.stats);
        assert!(solve(cube, &oracle, limited, 4).unwrap_err().contains("MAX_NODES=0"));
        for n in [0, 17] { assert!(solve(cube, &oracle, options(2, 8), n).is_err()); }
    }
}

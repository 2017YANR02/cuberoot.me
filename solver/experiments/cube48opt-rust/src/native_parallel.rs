//! Single-cube native parallelism. Workers borrow one oracle and keep their
//! prefix rankings between depths; the coordinator is the depth barrier.
use cube48opt_research::{
    cube::Cube,
    search::{self, DepthSearch, PruningOracle, SearchOptions, SearchOutcome, SearchShard, SearchStats},
};
use std::sync::{atomic::{AtomicBool, Ordering}, mpsc};
#[cfg(all(feature = "opt9-native-dynamic", not(target_family = "wasm")))]
use std::sync::Arc;
#[cfg(all(feature = "opt9-native-dynamic", not(target_family = "wasm")))]
use cube48opt_research::search::PrefixClaims;

pub const MAX_SEARCH_THREADS: usize = 18;

pub fn validate(options: SearchOptions, threads: usize) -> Result<(), String> {
    if threads == 0 || threads > MAX_SEARCH_THREADS {
        return Err(format!("search threads must be 1..{MAX_SEARCH_THREADS}"));
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
    #[cfg(any(feature = "wasm-batch-probes", all(feature = "opt10-native-batch", not(target_family = "wasm"))))]
    #[inline(always)] fn lookup_batch(&self, queries: &[Option<Self::Query>; 8]) -> [u8; 8] {
        self.oracle.lookup_batch(queries)
    }
    #[inline(always)] fn max_bound(&self) -> u8 { self.oracle.max_bound() }
    #[inline(always)] fn allow_parent_propagation(&self) -> bool { self.oracle.allow_parent_propagation() }
    #[inline(always)] fn allow_dynamic_prefixes(&self) -> bool { self.oracle.allow_dynamic_prefixes() }
    #[inline(always)] fn allow_quarter_pruning(&self) -> bool { self.oracle.allow_quarter_pruning() }
    #[inline(always)] fn allow_quarter_cache(&self) -> bool { self.oracle.allow_quarter_cache() }
    #[inline(always)] fn allow_root_bound(&self) -> bool { self.oracle.allow_root_bound() }
    #[inline(always)] fn allow_dual_rejection(&self) -> bool { self.oracle.allow_dual_rejection() }
    #[inline(always)] fn allow_backward_coset(&self) -> bool { self.oracle.allow_backward_coset() }
    #[inline(always)] fn allow_coset_chain(&self) -> bool { self.oracle.allow_coset_chain() }
    #[inline(always)] fn profile_search(&self) -> bool { self.oracle.profile_search() }
    #[inline(always)] fn lookahead_move(&self, cube: &Cube, remaining: u8, normal_bound: u8) -> Option<u8> {
        self.oracle.lookahead_move(cube, remaining, normal_bound)
    }
    #[inline(always)] fn alternative_query(&self, cube: &Cube, original_query: Self::Query, remaining: u8, normal_bound: u8) -> Option<Self::Query> {
        self.oracle.alternative_query(cube, original_query, remaining, normal_bound)
    }
    #[inline(always)] fn allow_niss_inverse_tie(&self) -> bool { self.oracle.allow_niss_inverse_tie() }
    #[inline(always)] fn allow_axis_pruning(&self) -> bool { self.oracle.allow_axis_pruning() }
    #[inline(always)] fn allow_global_prefix_ranking(&self) -> bool { self.oracle.allow_global_prefix_ranking() }
    #[inline(always)] fn cancelled(&self) -> bool {
        self.stopped.load(Ordering::Relaxed) || self.oracle.cancelled()
    }
    fn conjugate(&self, cube: &Cube, symmetry: u8) -> Option<Cube> { self.oracle.conjugate(cube, symmetry) }
}

fn add_stats(total: &mut SearchStats, part: SearchStats) {
    #[cfg(all(feature = "opt10-native-projection", not(target_family = "wasm")))]
    {
        total.projection_attempts += part.projection_attempts;
        total.projection_probes += part.projection_probes;
        total.projection_raises += part.projection_raises;
        total.projection_rejects += part.projection_rejects;
        for r in 0..2 {
            total.projection_attempts_by_remaining[r] += part.projection_attempts_by_remaining[r];
            total.projection_raises_by_remaining[r] += part.projection_raises_by_remaining[r];
            total.projection_rejects_by_remaining[r] += part.projection_rejects_by_remaining[r];
        }
    }
    #[cfg(all(feature = "opt10-native-lookahead", not(target_family = "wasm")))]
    {
        total.lookahead_attempts += part.lookahead_attempts;
        total.lookahead_probes += part.lookahead_probes;
        total.lookahead_raises += part.lookahead_raises;
        total.lookahead_rejects += part.lookahead_rejects;
        total.lookahead_tightened_at_budget += part.lookahead_tightened_at_budget;
        total.lookahead_half_prunes += part.lookahead_half_prunes;
        for r in 0..3 {
            total.lookahead_attempts_by_remaining[r] += part.lookahead_attempts_by_remaining[r];
            total.lookahead_raises_by_remaining[r] += part.lookahead_raises_by_remaining[r];
            total.lookahead_rejects_by_remaining[r] += part.lookahead_rejects_by_remaining[r];
        }
    }
    #[cfg(all(feature = "opt10-native-profile", not(target_family = "wasm")))]
    total.profile.add(part.profile);
    total.nodes += part.nodes;
    total.probes += part.probes;
    total.inverse_probes += part.inverse_probes;
    total.cache_reuses += part.cache_reuses;
    total.splits += part.splits;
    total.face_prunes += part.face_prunes;
    total.face_siblings_removed += part.face_siblings_removed;
    total.jobs += part.jobs;
    #[cfg(all(feature = "opt10-native-coset-chain", not(target_family = "wasm")))]
    {
        total.coset_chain_proofs += part.coset_chain_proofs;
        total.coset_chain_attempts += part.coset_chain_attempts;
        total.coset_chain_edges += part.coset_chain_edges;
        total.coset_chain_ancestor_cuts += part.coset_chain_ancestor_cuts;
        total.coset_chain_half_prunes += part.coset_chain_half_prunes;
    }
    #[cfg(all(feature = "opt10-native-coset", not(target_family = "wasm")))]
    {
        total.coset_parent_proofs += part.coset_parent_proofs;
        total.coset_half_prunes += part.coset_half_prunes;
    }
    #[cfg(all(feature = "opt10-native-dual", not(target_family = "wasm")))]
    {
        total.dual_attempts += part.dual_attempts;
        total.dual_raised += part.dual_raised;
        total.dual_parent_cuts += part.dual_parent_cuts;
    }
    #[cfg(all(feature = "opt9-native-quarter", not(target_family = "wasm")))]
    { total.quarter_siblings_removed += part.quarter_siblings_removed; }
    #[cfg(all(feature = "opt9-native-quarter-cache", not(target_family = "wasm")))]
    { total.quarter_cache_reuses += part.quarter_cache_reuses; }
    #[cfg(all(feature = "opt9-native-axis", not(target_family = "wasm")))]
    {
        total.axis_siblings_removed += part.axis_siblings_removed;
        total.axis_deferred_marks += part.axis_deferred_marks;
        total.axis_deferred_siblings_removed += part.axis_deferred_siblings_removed;
    }
}

/// Only an opted-in backend may prove the shallow depths unnecessary. This
/// reads the same two admissible bounds as a normal root visit, and records
/// actual lookup work. Cancellation before the complete proof is not a bound.
#[cfg(all(feature = "opt9-native-root-bound", not(target_family = "wasm")))]
fn initial_lower_bound<O: PruningOracle>(
    start: Cube, oracle: &O, stats: &mut SearchStats,
) -> Result<Option<u8>, String> {
    std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        let maximum = oracle.max_bound();
        if !(10..=13).contains(&maximum) { return Err("invalid subgroup bound".into()); }
        if oracle.cancelled() { return Ok(None); }
        stats.nodes += 1;
        #[cfg(all(feature = "opt10-native-profile", not(target_family = "wasm")))]
        if oracle.profile_search() { stats.profile.root_nodes += 1; }
        let mut lower_bound = 0;
        for (inverse, cube) in [start, start.inverse()].into_iter().enumerate() {
            if oracle.cancelled() { return Ok(None); }
            // u8::MAX cannot be rejected by a valid u8 bound. Do not treat a
            // backend contract error as a proof that a depth was exhausted.
            let query = oracle.prepare(&cube, u8::MAX)
                .map_err(|_| "root bound prepare rejected an unlimited budget".to_string())?;
            if oracle.cancelled() { return Ok(None); }
            let bound = oracle.lookup(query);
            stats.probes += 1;
            stats.inverse_probes += inverse as u64;
            #[cfg(all(feature = "opt10-native-profile", not(target_family = "wasm")))]
            if oracle.profile_search() {
                stats.profile.root_normal_probes += u64::from(inverse == 0);
                stats.profile.root_inverse_probes += inverse as u64;
            }
            if bound > maximum { return Err("root bound exceeds the oracle maximum".into()); }
            lower_bound = lower_bound.max(bound);
        }
        if oracle.cancelled() { Ok(None) } else { Ok(Some(lower_bound)) }
    })).unwrap_or_else(|_| Err("root bound evaluation panicked".into()))
}

pub fn solve<O: PruningOracle + Sync>(
    start: Cube, oracle: &O, options: SearchOptions, threads: usize,
) -> Result<SearchOutcome, String> {
    validate(options, threads)?;
    if threads == 1 { return search::solve(start, oracle, options); }
    let stopped = AtomicBool::new(false);
    let oracle = Cancellable { oracle, stopped: &stopped };
    #[cfg(all(feature = "opt9-native-root-bound", not(target_family = "wasm")))]
    let (initial_depth, mut initial_stats) = {
        let mut stats = SearchStats::default();
        let depth = if oracle.allow_root_bound() {
            let Some(depth) = initial_lower_bound(start, &oracle, &mut stats)? else {
                return Ok(SearchOutcome { solution: None, completed_depth: None, cancelled: true, stats });
            };
            depth
        } else { 0 };
        if depth > options.max_depth {
            // Every requested depth is below a proved admissible bound.
            return Ok(SearchOutcome { solution: None, completed_depth: Some(options.max_depth), cancelled: false, stats });
        }
        (depth, stats)
    };
    #[cfg(not(all(feature = "opt9-native-root-bound", not(target_family = "wasm"))))]
    let (initial_depth, initial_stats) = (0_u8, SearchStats::default());
    #[cfg(all(feature = "opt9-native-ranked", not(target_family = "wasm")))]
    if oracle.allow_global_prefix_ranking() && !oracle.allow_dynamic_prefixes() {
        return Err("global prefix ranking requires dynamic prefix ownership".into());
    }
    // Validate all shards before starting workers. No PDB allocation or clone.
    let mut searches = Vec::with_capacity(threads);
    for index in 0..threads {
        #[cfg(all(feature = "opt9-native-root-bound", not(target_family = "wasm")))]
        if oracle.allow_root_bound() && oracle.cancelled() {
            return Ok(SearchOutcome { solution: None, completed_depth: None, cancelled: true, stats: initial_stats });
        }
        let shard = SearchShard { index, count: threads };
        #[cfg(all(feature = "opt9-native-root-bound", not(target_family = "wasm")))]
        if initial_depth > 0 {
            let search = std::panic::catch_unwind(std::panic::AssertUnwindSafe(||
                DepthSearch::new_with_initial_depth(start, &oracle, shard, initial_depth)
            )).unwrap_or_else(|_| Err("root bound validation panicked".into()))?;
            // The checked constructor independently revalidates both root
            // queries before allowing next_depth to advance. Include those
            // actual reads rather than pretending the proof is free.
            initial_stats.nodes += 1;
            initial_stats.probes += 2;
            initial_stats.inverse_probes += 1;
            #[cfg(all(feature = "opt10-native-profile", not(target_family = "wasm")))]
            if oracle.profile_search() {
                initial_stats.profile.root_nodes += 1;
                initial_stats.profile.root_normal_probes += 1;
                initial_stats.profile.root_inverse_probes += 1;
            }
            searches.push(search);
            continue;
        }
        searches.push(DepthSearch::new(start, &oracle, shard)?);
    }
    #[cfg(all(feature = "opt9-native-root-bound", not(target_family = "wasm")))]
    if oracle.allow_root_bound() && oracle.cancelled() {
        return Ok(SearchOutcome { solution: None, completed_depth: None, cancelled: true, stats: initial_stats });
    }
    #[cfg(all(feature = "opt9-native-dynamic", not(target_family = "wasm")))]
    let claims = oracle.allow_dynamic_prefixes().then(|| {
        #[cfg(all(feature = "opt9-native-ranked", not(target_family = "wasm")))]
        if oracle.allow_global_prefix_ranking() { return Arc::new(PrefixClaims::new_ranked()); }
        Arc::new(PrefixClaims::new())
    });
    #[cfg(all(feature = "opt9-native-dynamic", not(target_family = "wasm")))]
    let searches = searches.into_iter().map(|mut search| {
        if let Some(claims) = &claims { search.set_prefix_claims(Arc::clone(claims)); }
        search
    }).collect::<Vec<_>>();
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
            let mut total = SearchOutcome { solution: None, completed_depth: initial_depth.checked_sub(1),
                cancelled: false, stats: initial_stats };
            for depth in initial_depth..=options.max_depth {
                stopped.store(false, Ordering::Relaxed);
                #[cfg(all(feature = "opt9-native-dynamic", not(target_family = "wasm")))]
                if let Some(claims) = &claims {
                    #[cfg(all(feature = "opt9-native-ranked", not(target_family = "wasm")))]
                    claims.begin_depth(depth)?;
                    #[cfg(not(all(feature = "opt9-native-ranked", not(target_family = "wasm"))))]
                    claims.reset();
                }
                #[cfg(all(feature = "opt9-native-ranked", not(target_family = "wasm")))]
                let nodes_before_depth = total.stats.nodes;
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
                #[cfg(all(feature = "opt9-native-ranked", not(target_family = "wasm")))]
                if let Some(claims) = &claims {
                    let exhausted = error.is_none() && total.solution.is_none() && !total.cancelled;
                    claims.complete_depth(depth, exhausted)?;
                    if oracle.allow_global_prefix_ranking() && error.is_none() {
                        let depth_nodes = total.stats.nodes - nodes_before_depth;
                        if total.solution.is_some() { total.stats.solution_depth_nodes += depth_nodes; }
                        else if exhausted { total.stats.exhausted_depth_nodes += depth_nodes; }
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

    #[cfg(all(feature = "opt10-native-projection", not(target_family = "wasm")))]
    #[test]
    fn projection_wrapper_forwards_and_aggregates_actual_queries() {
        use std::sync::atomic::AtomicU64;
        struct CountedZero { reads: AtomicU64, selected: AtomicU64 }
        impl PruningOracle for CountedZero {
            type Query = bool;
            fn prepare(&self, _: &Cube, _: u8) -> Result<bool, u8> { Ok(false) }
            fn lookup(&self, _: bool) -> u8 { self.reads.fetch_add(1, Ordering::Relaxed); 0 }
            fn allow_root_bound(&self) -> bool { true }
            fn alternative_query(&self, _: &Cube, original: bool, _: u8, _: u8) -> Option<bool> {
                assert!(!original);
                self.selected.fetch_add(1, Ordering::Relaxed);
                Some(true)
            }
        }
        let oracle = CountedZero { reads: AtomicU64::new(0), selected: AtomicU64::new(0) };
        let start = Cube::from_scramble("R F").unwrap();
        let outcome = solve(start, &oracle, options(2, 8), 2).unwrap();
        let solution = outcome.solution.unwrap();
        assert_eq!(solution.len(), 2);
        assert!(solution.iter().fold(start, |c, &m| c.moved(m)).is_solved());
        assert_eq!(outcome.stats.probes, oracle.reads.load(Ordering::Relaxed));
        assert_eq!(outcome.stats.projection_attempts, oracle.selected.load(Ordering::Relaxed));
        assert_eq!(outcome.stats.projection_attempts, outcome.stats.projection_probes);
        assert!(outcome.stats.projection_probes > 0);
        assert_eq!((outcome.stats.projection_raises, outcome.stats.projection_rejects), (0, 0));
    }

    #[cfg(all(feature = "opt10-native-lookahead", not(target_family = "wasm")))]
    #[test]
    fn lookahead_wrapper_forwards_and_aggregates_actual_queries() {
        use std::sync::atomic::AtomicU64;
        struct CountedZero { reads: AtomicU64, selected: AtomicU64 }
        impl PruningOracle for CountedZero {
            type Query = ();
            fn prepare(&self, _: &Cube, _: u8) -> Result<(), u8> { Ok(()) }
            fn lookup(&self, _: ()) -> u8 { self.reads.fetch_add(1, Ordering::Relaxed); 0 }
            fn allow_root_bound(&self) -> bool { true }
            fn lookahead_move(&self, _: &Cube, _: u8, _: u8) -> Option<u8> {
                self.selected.fetch_add(1, Ordering::Relaxed);
                Some(1)
            }
        }
        let oracle = CountedZero { reads: AtomicU64::new(0), selected: AtomicU64::new(0) };
        let start = Cube::from_scramble("R F").unwrap();
        let outcome = solve(start, &oracle, options(2, 8), 2).unwrap();
        let solution = outcome.solution.unwrap();
        assert_eq!(solution.len(), 2);
        assert!(solution.iter().fold(start, |c, &m| c.moved(m)).is_solved());
        assert_eq!(outcome.stats.probes, oracle.reads.load(Ordering::Relaxed));
        assert_eq!(outcome.stats.lookahead_attempts, oracle.selected.load(Ordering::Relaxed));
        assert_eq!(outcome.stats.lookahead_attempts, outcome.stats.lookahead_probes);
        assert!(outcome.stats.lookahead_probes > 0);
        assert_eq!((outcome.stats.lookahead_raises, outcome.stats.lookahead_rejects), (0, 0));
    }

    #[cfg(all(feature = "opt10-native-profile", not(target_family = "wasm")))]
    #[test]
    fn profile_worker_aggregation_and_root_queries_are_conserved() {
        struct ProfileOracle;
        impl PruningOracle for ProfileOracle {
            type Query = u8;
            fn prepare(&self, cube: &Cube, _: u8) -> Result<u8, u8> {
                Ok(cube.corners.iter().filter(|&&c| c >> 3 != 0).count().div_ceil(4) as u8)
            }
            fn lookup(&self, value: u8) -> u8 { value }
            fn allow_root_bound(&self) -> bool { true }
            fn profile_search(&self) -> bool { true }
        }
        for scramble in ["", "U", "R F"] { for contexts in [1, 8] {
            let start = Cube::from_scramble(scramble).unwrap();
            let outcome = solve(start, &ProfileOracle, options(2, contexts), 2).unwrap();
            assert!(outcome.stats.profile.matches_totals(&outcome.stats));
            assert_eq!(outcome.stats.profile.root_normal_probes, outcome.stats.profile.root_nodes);
            assert_eq!(outcome.stats.profile.root_inverse_probes, outcome.stats.profile.root_nodes);
            let solution = outcome.solution.unwrap();
            assert!(solution.iter().fold(start, |c, &m| c.moved(m)).is_solved());
        } }
        let a = SearchStats::default();
        let mut b = SearchStats::default();
        b.profile.visited[2] = 3;
        b.profile.pending[2] = 3;
        b.nodes = 3;
        let mut combined = a;
        add_stats(&mut combined, b);
        assert_eq!(combined, b);
        assert!(combined.profile.matches_totals(&combined));
    }

    #[cfg(all(any(feature = "opt8-native-batch", feature = "opt10-native-batch"), not(target_family = "wasm")))]
    #[test]
    fn cancellation_wrapper_forwards_the_batch_override() {
        struct BatchOnly;
        impl PruningOracle for BatchOnly {
            type Query = u8;
            fn prepare(&self, _: &Cube, _: u8) -> Result<u8, u8> { unreachable!() }
            fn lookup(&self, _: u8) -> u8 { panic!("batch override was lost") }
            fn lookup_batch(&self, queries: &[Option<u8>; 8]) -> [u8; 8] {
                queries.map(|query| query.unwrap_or(0))
            }
        }
        let stopped = AtomicBool::new(false);
        let oracle = Cancellable { oracle: &BatchOnly, stopped: &stopped };
        assert_eq!(oracle.lookup_batch(&[None, Some(0), Some(11), None, Some(12), None, Some(13), None]),
            [0, 0, 11, 0, 12, 0, 13, 0]);
        assert!(!oracle.cancelled());
        stopped.store(true, Ordering::Relaxed);
        assert!(oracle.cancelled());
    }

    struct ZeroOracle { workers: Mutex<HashSet<std::thread::ThreadId>> }
    impl PruningOracle for ZeroOracle {
        type Query = ();
        fn prepare(&self, _: &Cube, _: u8) -> Result<(), u8> {
            self.workers.lock().unwrap().insert(std::thread::current().id()); Ok(())
        }
        fn lookup(&self, _: ()) -> u8 { 0 }
        fn allow_dynamic_prefixes(&self) -> bool { cfg!(feature = "opt9-native-dynamic") }
    }
    fn options(depth: u8, contexts: usize) -> SearchOptions {
        SearchOptions { max_depth: depth, max_nodes: 0, contexts }
    }

    #[cfg(all(feature = "opt8-native-batch", not(target_family = "wasm")))]
    #[test]
    fn opt8_batch_parallel_search_reaches_grouped_override() {
        use std::sync::atomic::AtomicUsize;
        struct Counting { batch_queries: AtomicUsize }
        impl PruningOracle for Counting {
            type Query = u8;
            fn prepare(&self, cube: &Cube, _: u8) -> Result<u8, u8> {
                Ok(cube.corners.iter().filter(|&&corner| corner >> 3 != 0).count().div_ceil(4) as u8)
            }
            fn lookup(&self, query: u8) -> u8 { query }
            fn lookup_batch(&self, queries: &[Option<u8>; 8]) -> [u8; 8] {
                self.batch_queries.fetch_add(queries.iter().flatten().count(), Ordering::Relaxed);
                queries.map(|query| query.unwrap_or(0))
            }
            fn max_bound(&self) -> u8 { 13 }
            fn allow_parent_propagation(&self) -> bool { true }
            fn allow_dynamic_prefixes(&self) -> bool { true }
            fn allow_quarter_pruning(&self) -> bool { true }
            fn allow_root_bound(&self) -> bool { true }
        }
        let start = Cube::from_scramble("R U F").unwrap();
        let oracle = Counting { batch_queries: AtomicUsize::new(0) };
        let result = solve(start, &oracle, options(3, 8), 4).unwrap();
        let solution = result.solution.unwrap();
        assert_eq!(solution.len(), 3);
        assert!(solution.iter().fold(start, |cube, &movement| cube.moved(movement)).is_solved());
        assert_eq!(result.completed_depth, Some(2));
        assert!(!result.cancelled);
        assert!(oracle.batch_queries.load(Ordering::Relaxed) > 0);
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
                let result = solve(cube, &oracle, options(2, contexts), 18).unwrap();
                let moves = result.solution.unwrap();
                assert_eq!(moves.len(), distance as usize);
                assert!(moves.iter().fold(cube, |c, &m| c.moved(m)).is_solved());
                assert!(!result.cancelled);
                assert_eq!(result.completed_depth, distance.checked_sub(1));
            }
        }
        // Distinct OS workers actually executed oracle calls; contexts alone
        // would all run on the test's one thread.
        assert!(oracle.workers.lock().unwrap().len() >= 18);
        let hard = Cube::from_scramble("R U F").unwrap();
        let exhausted = solve(hard, &oracle, options(2, 8), 18).unwrap();
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
            fn allow_dynamic_prefixes(&self) -> bool { cfg!(feature = "opt9-native-dynamic") }
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
            fn allow_dynamic_prefixes(&self) -> bool { cfg!(feature = "opt9-native-dynamic") }
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
        for n in [0, 19] { assert!(solve(cube, &oracle, options(2, 8), n).is_err()); }
    }

    #[cfg(all(feature = "opt9-native-root-bound", not(target_family = "wasm")))]
    #[test]
    fn initial_bound_skips_only_proved_depths_and_counts_all_constructor_queries() {
        use std::sync::atomic::AtomicUsize;
        struct Twist {
            first: Mutex<HashMap<std::thread::ThreadId, u8>>,
            lookups: AtomicUsize,
        }
        impl Twist {
            fn new() -> Self { Self { first: Mutex::default(), lookups: AtomicUsize::new(0) } }
            fn bound(cube: &Cube) -> u8 {
                cube.corners.iter().filter(|&&corner| corner >> 3 != 0).count().div_ceil(4) as u8
            }
        }
        impl PruningOracle for Twist {
            type Query = u8;
            fn prepare(&self, cube: &Cube, remaining: u8) -> Result<u8, u8> {
                if remaining != u8::MAX {
                    self.first.lock().unwrap().entry(std::thread::current().id()).or_insert(remaining);
                }
                Ok(Self::bound(cube))
            }
            fn lookup(&self, query: u8) -> u8 { self.lookups.fetch_add(1, Ordering::Relaxed); query }
            fn allow_root_bound(&self) -> bool { true }
        }
        // Every turn twists at most four corners; this bound is admissible
        // and left-half-turn invariant, not a fixture-specific fake distance.
        let start = Cube::from_scramble("R F").unwrap();
        assert_eq!(Twist::bound(&start).max(Twist::bound(&start.inverse())), 2);
        for contexts in [1, 8] {
            let oracle = Twist::new();
            let result = solve(start, &oracle, options(2, contexts), 4).unwrap();
            let solution = result.solution.unwrap();
            assert_eq!(solution.len(), 2);
            assert!(solution.iter().fold(start, |cube, &movement| cube.moved(movement)).is_solved());
            assert_eq!(result.completed_depth, Some(1));
            assert!(!result.cancelled);
            let first = oracle.first.lock().unwrap();
            assert!(!first.is_empty());
            assert!(first.values().all(|&remaining| remaining == 2));
            assert_eq!(result.stats.probes, oracle.lookups.load(Ordering::Relaxed) as u64);
            assert!(result.stats.probes >= 2 + 4 * 2);
        }
        let oracle = Twist::new();
        let excluded = solve(start, &oracle, options(1, 8), 4).unwrap();
        assert!(excluded.solution.is_none());
        assert!(!excluded.cancelled);
        assert_eq!(excluded.completed_depth, Some(1));
        assert!(oracle.first.lock().unwrap().is_empty());
        assert_eq!((excluded.stats.nodes, excluded.stats.probes, excluded.stats.inverse_probes), (1, 2, 1));
        assert_eq!(oracle.lookups.load(Ordering::Relaxed), 2);
        let oracle = Twist::new();
        let solved = solve(Cube::SOLVED, &oracle, options(0, 8), 4).unwrap();
        assert_eq!(solved.solution, Some(vec![]));
        assert_eq!(solved.completed_depth, None);
        assert!(!solved.cancelled);
        assert_eq!(solved.stats.probes, 2);
    }

    #[cfg(all(feature = "opt9-native-root-bound", not(target_family = "wasm")))]
    #[test]
    fn initial_bound_cancellation_and_invalid_oracles_never_claim_skipped_depths() {
        use std::sync::atomic::AtomicUsize;
        struct Cancel {
            cancelled: AtomicBool,
            prepares: AtomicUsize,
            lookups: AtomicUsize,
            at_prepare: usize,
            at_lookup: usize,
        }
        impl PruningOracle for Cancel {
            type Query = u8;
            fn prepare(&self, cube: &Cube, _: u8) -> Result<u8, u8> {
                let count = self.prepares.fetch_add(1, Ordering::Relaxed) + 1;
                if count == self.at_prepare { self.cancelled.store(true, Ordering::Relaxed); }
                Ok(cube.corners.iter().filter(|&&corner| corner >> 3 != 0).count().div_ceil(4) as u8)
            }
            fn lookup(&self, query: u8) -> u8 {
                let count = self.lookups.fetch_add(1, Ordering::Relaxed) + 1;
                if count == self.at_lookup { self.cancelled.store(true, Ordering::Relaxed); }
                query
            }
            fn allow_root_bound(&self) -> bool { true }
            fn cancelled(&self) -> bool { self.cancelled.load(Ordering::Relaxed) }
        }
        let start = Cube::from_scramble("R F").unwrap();
        // Cancel before work, between prepare/lookup, after the two-query
        // root proof, and while a worker constructor revalidates that proof.
        for (already, at_prepare, at_lookup) in [(true, 0, 0), (false, 1, 0), (false, 0, 2), (false, 3, 0)] {
            let oracle = Cancel { cancelled: AtomicBool::new(already), prepares: AtomicUsize::new(0),
                lookups: AtomicUsize::new(0), at_prepare, at_lookup };
            let result = solve(start, &oracle, options(2, 8), 4).unwrap();
            assert!(result.cancelled);
            assert!(result.solution.is_none());
            assert_eq!(result.completed_depth, None);
            assert_eq!(result.stats.probes, oracle.lookups.load(Ordering::Relaxed) as u64);
        }
        struct Invalid(u8);
        impl PruningOracle for Invalid {
            type Query = u8;
            fn prepare(&self, _: &Cube, _: u8) -> Result<u8, u8> {
                match self.0 { 0 => Err(1), 1 => Ok(14), _ => panic!("root proof fixture panic") }
            }
            fn lookup(&self, query: u8) -> u8 { query }
            fn max_bound(&self) -> u8 { 13 }
            fn allow_root_bound(&self) -> bool { true }
        }
        assert!(solve(start, &Invalid(0), options(2, 8), 4).unwrap_err().contains("unlimited budget"));
        assert!(solve(start, &Invalid(1), options(2, 8), 4).unwrap_err().contains("oracle maximum"));
        assert!(solve(start, &Invalid(2), options(2, 8), 4).unwrap_err().contains("panicked"));
    }
}

#[cfg(all(test, feature = "opt9-native-ranked", not(target_family = "wasm")))]
mod ranked_barrier_tests {
    use super::*;
    use std::sync::atomic::AtomicUsize;
    struct Oracle { calls: AtomicUsize, cancel: bool }
    impl PruningOracle for Oracle {
        type Query = ();
        fn prepare(&self, _: &Cube, _: u8) -> Result<(), u8> {
            self.calls.fetch_add(1, Ordering::Relaxed); Ok(())
        }
        fn lookup(&self, _: ()) -> u8 { 0 }
        fn cancelled(&self) -> bool { self.cancel && self.calls.load(Ordering::Relaxed) > 0 }
        fn allow_dynamic_prefixes(&self) -> bool { true }
        fn allow_global_prefix_ranking(&self) -> bool { true }
    }
    #[test]
    fn ranked_barrier_attributes_success_and_ignores_cancelled_layer() {
        let options = SearchOptions { max_depth: 2, max_nodes: 0, contexts: 8 };
        let start = Cube::from_scramble("R F").unwrap();
        let result = solve(start, &Oracle { calls: AtomicUsize::new(0), cancel: false }, options, 16).unwrap();
        assert_eq!(result.solution.as_ref().unwrap().len(), 2);
        assert_eq!(result.completed_depth, Some(1));
        assert!(result.stats.exhausted_depth_nodes > 0 && result.stats.solution_depth_nodes > 0);
        assert_eq!(result.stats.exhausted_depth_nodes + result.stats.solution_depth_nodes, result.stats.nodes);
        let stopped = solve(start, &Oracle { calls: AtomicUsize::new(0), cancel: true }, options, 16).unwrap();
        assert!(stopped.cancelled && stopped.solution.is_none());
        assert_eq!(stopped.stats.solution_depth_nodes, 0);
        assert!(stopped.stats.exhausted_depth_nodes < stopped.stats.nodes);
    }

    #[cfg(feature = "opt9-native-root-bound")]
    #[test]
    fn ranked_barrier_keeps_initial_root_proof_separate() {
        struct Twist;
        impl PruningOracle for Twist {
            type Query = u8;
            fn prepare(&self, cube: &Cube, _: u8) -> Result<u8, u8> {
                Ok(cube.corners.iter().filter(|&&c| c >> 3 != 0).count().div_ceil(4) as u8)
            }
            fn lookup(&self, bound: u8) -> u8 { bound }
            fn allow_dynamic_prefixes(&self) -> bool { true }
            fn allow_global_prefix_ranking(&self) -> bool { true }
            fn allow_root_bound(&self) -> bool { true }
        }
        let result = solve(Cube::from_scramble("R F").unwrap(), &Twist,
            SearchOptions { max_depth: 2, max_nodes: 0, contexts: 8 }, 16).unwrap();
        assert_eq!(result.solution.as_ref().unwrap().len(), 2);
        assert_eq!(result.stats.nodes - result.stats.exhausted_depth_nodes - result.stats.solution_depth_nodes, 17);
    }
}

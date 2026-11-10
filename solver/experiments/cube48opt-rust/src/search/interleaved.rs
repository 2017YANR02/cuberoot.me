//! Native Opt8 experiment: a lookup waits a complete round of other contexts.
//! Reuses our existing coordinates, ownership, masks and rejection proofs.
//! Inspired by egg-solver's prefetch/yield scheduling; no upstream code copied.
use super::*;

#[derive(Clone, Copy)]
enum Pending<Q> { None, Inverse(Q), Normal(Q) }

fn reject(context: &mut Context, excess: u8, inverse: bool, quarter: bool, parent: bool, stats: &mut SearchStats) {
    if quarter && excess == 1 { context.reject_equivalent_quarter(inverse, stats); }
    context.reject_bound(excess, parent, stats);
    context.needs_query = false;
}

pub(super) fn search<O: PruningOracle, const N: usize>(start: Cube, oracle: &O, options: SearchOptions,
    depth: u8, stats: &mut SearchStats, symmetries: &RootSymmetries, jobs: &mut PrefixQueue) -> DepthResult {
    let mut contexts: [Context; N] = std::array::from_fn(|_| Context::empty());
    let mut pending = [Pending::None; N];
    let max_bound = oracle.max_bound();
    let scale = 1u32 << max_bound;
    let quarter = oracle.allow_quarter_pruning();
    let parent = oracle.allow_parent_propagation();
    debug_assert!(depth > max_bound, "shallow depths use the original shard path");
    jobs.prepare(depth, max_bound, symmetries);
    loop {
        if oracle.cancelled() { return DepthResult::Cancelled; }
        let mut active = false;
        for i in 0..N {
            let context = &mut contexts[i];
            match std::mem::replace(&mut pending[i], Pending::None) {
                Pending::Inverse(query) => {
                    stats.probes += 1;
                    stats.inverse_probes += 1;
                    let bound = oracle.lookup(query);
                    let remaining = context.remaining(depth);
                    context.stack.last_mut().unwrap().inverse_bound = bound;
                    if bound > remaining {
                        reject(context, bound - remaining, true, quarter, parent, stats);
                    } else {
                        // Do not decode another context's query immediately: this
                        // normal lookup gets the same complete round of slack.
                        let frame = context.stack.last().unwrap();
                        match oracle.prepare(&frame.cube, remaining) {
                            Ok(query) => { pending[i] = Pending::Normal(query); active = true; continue; }
                            Err(bound) => {
                                context.weight += u64::from(scale >> bound) + u64::from(scale >> frame.inverse_bound);
                                reject(context, bound - remaining, false, quarter, parent, stats);
                            }
                        }
                    }
                }
                Pending::Normal(query) => {
                    stats.probes += 1;
                    let bound = oracle.lookup(query);
                    let remaining = context.remaining(depth);
                    let frame = context.stack.last_mut().unwrap();
                    frame.normal_bound = bound;
                    context.weight += u64::from(scale >> bound) + u64::from(scale >> frame.inverse_bound);
                    if bound > remaining {
                        reject(context, bound - remaining, false, quarter, parent, stats);
                    } else {
                        frame.plan(remaining, max_bound);
                        context.needs_query = false;
                        if frame.normal_mask == 0 { context.reject(1, stats); }
                    }
                }
                Pending::None => {}
            }
            // Advance until this context has an outstanding query or no work.
            // Exhausted ancestors and cached half-turn bounds need no yield.
            loop {
                if oracle.cancelled() { return DepthResult::Cancelled; }
                if context.stack.is_empty() {
                    jobs.finish(context);
                    if !jobs.fetch_into(start, stats, context) { break; }
                }
                if !context.needs_query {
                    let child = context.stack.last_mut().unwrap().child();
                    context.stack.push(child);
                    context.needs_query = true;
                }
                if options.max_nodes != 0 && stats.nodes >= options.max_nodes { return DepthResult::Cancelled; }
                stats.nodes += 1;
                let remaining = context.remaining(depth);
                let frame = context.stack.last().unwrap();
                if remaining == 0 {
                    if frame.cube.is_solved() { return DepthResult::Found(context.solution()); }
                    context.reject(1, stats);
                    context.needs_query = false;
                    continue;
                }
                if frame.cached_inverse {
                    stats.cache_reuses += 1;
                    match oracle.prepare(&frame.cube, remaining) {
                        Ok(query) => { pending[i] = Pending::Normal(query); active = true; break; }
                        Err(bound) => {
                            context.weight += u64::from(scale >> bound) + u64::from(scale >> frame.inverse_bound);
                            reject(context, bound - remaining, false, quarter, parent, stats);
                        }
                    }
                } else {
                    match oracle.prepare(&frame.inverse, remaining) {
                        Ok(query) => { pending[i] = Pending::Inverse(query); active = true; break; }
                        Err(bound) => reject(context, bound - remaining, true, quarter, parent, stats),
                    }
                }
            }
        }
        #[cfg(feature = "opt8-native-interleaved32")]
        for empty in 0..N {
            if !contexts[empty].stack.is_empty() { continue; }
            debug_assert!(matches!(pending[empty], Pending::None));
            jobs.finish(&mut contexts[empty]);
            for donor in 0..N {
                if donor == empty { continue; }
                let split = if donor < empty {
                    let (before, after) = contexts.split_at_mut(empty);
                    before[donor].split_pending_into(&mut after[0])
                } else {
                    let (before, after) = contexts.split_at_mut(donor);
                    after[0].split_pending_into(&mut before[empty])
                };
                if split {
                    stats.splits += 1;
                    active = true;
                    break;
                }
            }
        }
        if !active { return DepthResult::Exhausted; }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::{HashMap, VecDeque};
    struct Zero;
    impl PruningOracle for Zero {
        type Query = ();
        fn prepare(&self, _: &Cube, _: u8) -> Result<(), u8> { Ok(()) }
        fn lookup(&self, _: ()) -> u8 { 0 }
        // Exercise prefix refills, pending lookups and depth exhaustion using
        // independent shallow states without loading any production table.
        fn max_bound(&self) -> u8 { 0 }
    }
    struct Twists;
    impl PruningOracle for Twists {
        type Query = u8;
        fn prepare(&self, cube: &Cube, _: u8) -> Result<u8, u8> {
            // A turn changes at most four twists. Half turns preserve their
            // count, satisfying the opposite-side subgroup requirement.
            Ok((cube.corners.iter().filter(|c| **c >> 3 != 0).count() as u8).div_ceil(4))
        }
        fn lookup(&self, query: u8) -> u8 { query }
        fn max_bound(&self) -> u8 { 2 }
        fn allow_quarter_pruning(&self) -> bool { true }
        fn allow_parent_propagation(&self) -> bool { true }
    }
    fn check_independent_bfs<const N: usize>() -> u64 {
        let mut distances = HashMap::from([(Cube::SOLVED, 0u8)]);
        let mut queue = VecDeque::from([Cube::SOLVED]);
        while let Some(cube) = queue.pop_front() {
            let depth = distances[&cube];
            if depth == 3 { continue; }
            for m in 0..18 {
                let next = cube.moved(m);
                if let std::collections::hash_map::Entry::Vacant(e) = distances.entry(next) {
                    e.insert(depth + 1); queue.push_back(next);
                }
            }
        }
        assert_eq!(distances.len(), 3502);
        let mut splits = 0;
        for (cube, distance) in distances {
            if distance == 0 { continue; }
            let symmetries = RootSymmetries::new(&cube, &Zero);
            let mut jobs = PrefixQueue::default();
            let options = SearchOptions { max_depth: 3, max_nodes: 0, contexts: 8 };
            let mut stats = SearchStats::default();
            for depth in 1..=distance {
                let result = search::<_, N>(cube, &Zero, options, depth, &mut stats, &symmetries, &mut jobs);
                if depth < distance { assert!(matches!(result, DepthResult::Exhausted)); }
                else {
                    let DepthResult::Found(moves) = result else { panic!("missed BFS state"); };
                    assert_eq!(moves.len(), distance as usize);
                    assert!(moves.iter().fold(cube, |c, &m| c.moved(m)).is_solved());
                }
            }
            if distance == 3 {
                let mut jobs = PrefixQueue::default();
                let result = search::<_, N>(cube, &Twists, options, 3, &mut stats, &symmetries, &mut jobs);
                let DepthResult::Found(moves) = result else { panic!("pruned a valid BFS solution"); };
                assert_eq!(moves.len(), 3);
                assert!(moves.iter().fold(cube, |c, &m| c.moved(m)).is_solved());
            }
            splits += stats.splits;
        }
        splits
    }

    #[test]
    fn interleaved_prefixes_match_independent_bfs() {
        check_independent_bfs::<8>();
    }

    #[test]
    #[cfg(feature = "opt8-native-interleaved32")]
    fn thirty_two_lanes_preserve_bfs_distances_with_pending_donations() {
        assert!(check_independent_bfs::<32>() > 0, "exercise actual pending ancestor donations");
    }

    #[test]
    fn pending_queries_respect_node_limit_and_exhaustion() {
        let cube = Cube::from_scramble("R U F D").unwrap();
        let symmetries = RootSymmetries::new(&cube, &Twists);
        for limit in [1, 5, 20] {
            let options = SearchOptions { max_depth: 3, max_nodes: limit, contexts: 8 };
            let mut stats = SearchStats::default();
            assert!(matches!(search::<_, 8>(cube, &Twists, options, 3, &mut stats, &symmetries,
                &mut PrefixQueue::default()), DepthResult::Cancelled));
            assert_eq!(stats.nodes, limit);
            #[cfg(feature = "opt8-native-interleaved32")]
            {
                let mut stats = SearchStats::default();
                assert!(matches!(search::<_, 32>(cube, &Twists, options, 3, &mut stats, &symmetries,
                    &mut PrefixQueue::default()), DepthResult::Cancelled));
                assert_eq!(stats.nodes, limit);
            }
        }
        let options = SearchOptions { max_depth: 3, max_nodes: 0, contexts: 1 };
        assert!(matches!(search::<_, 1>(cube, &Twists, options, 3, &mut SearchStats::default(),
            &symmetries, &mut PrefixQueue::default()), DepthResult::Exhausted));
        #[cfg(feature = "opt8-native-interleaved32")]
        {
            let mut stats = SearchStats::default();
            assert!(matches!(search::<_, 32>(cube, &Twists, options, 3, &mut stats,
                &symmetries, &mut PrefixQueue::default()), DepthResult::Exhausted));
            assert!(stats.splits > 0, "exhaustion must include donated ownership");
        }
    }

    #[test]
    #[cfg(feature = "opt8-native-interleaved32")]
    fn pending_split_preserves_query_and_never_donates_unproved_top() {
        for side in [false, true] {
            let mut donor = Context::empty();
            let mut root = Frame::root(Cube::from_scramble("R U F").unwrap());
            root.side = side;
            root.normal_mask = (1 << 0) | (1 << 6) | (1 << 12);
            let child = root.child();
            donor.stack.extend([root, child]);
            donor.job = Some(17);
            donor.weight = 42;
            donor.needs_query = true;
            let pending_cube = donor.stack[1].cube.to_bytes();
            let pending_inverse = donor.stack[1].inverse.to_bytes();
            let pending_mask = donor.stack[1].normal_mask;
            let owned = donor.stack[0].normal_mask;
            let mut recipient = Context::empty();
            assert!(donor.split_pending_into(&mut recipient));
            assert_eq!(recipient.stack.len(), 1);
            assert_eq!(donor.stack.len(), 2);
            assert_eq!(donor.stack[1].cube.to_bytes(), pending_cube);
            assert_eq!(donor.stack[1].inverse.to_bytes(), pending_inverse);
            assert_eq!(donor.stack[1].normal_mask, pending_mask);
            assert_eq!(donor.stack[0].normal_mask & recipient.stack[0].normal_mask, 0);
            assert_eq!(donor.stack[0].normal_mask | recipient.stack[0].normal_mask, owned);
            assert_eq!(recipient.stack[0].side, side);
            assert_eq!(recipient.stack[0].chosen_move, 0);
            assert_eq!((donor.job, donor.weight, donor.needs_query), (Some(17), 42, true));
            assert_eq!((recipient.job, recipient.weight, recipient.needs_query), (Some(17), 0, false));

            donor.stack[0].normal_mask = 0;
            let mut vacant = Context::empty();
            assert!(!donor.split_pending_into(&mut vacant), "the pending top has no proven children");
            assert!(vacant.stack.is_empty() && vacant.job.is_none());
        }
    }
}

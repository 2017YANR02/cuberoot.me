//! Bounded validation of local BPMX control, not a fake full-search oracle.
//! Exact distances come from an independent breadth-first enumeration to
//! radius three on each side. No pruning table or optimal solver is used.
use super::*;
use std::collections::BTreeMap;

fn require(ok: bool, message: &str) -> Result<(), String> {
    if ok { Ok(()) } else { Err(message.into()) }
}

fn context(frames: usize, flips: u8) -> Context {
    let moves = [0, 3, 6, 9, 12, 15];
    let mut context = Context::empty();
    context.stack.push(Frame::root(Cube::SOLVED));
    for i in 0..frames - 1 {
        let parent = context.stack.last_mut().unwrap();
        if flips & (1 << i) != 0 {
            parent.normal_mask = ALL_MOVES;
            parent.inverse_mask = 1 << moves[i];
            parent.plan(13, 13);
        }
        parent.normal_mask = 1 << moves[i];
        let child = parent.child();
        // Pending masks are deliberately broad: a whole-parent cut must not
        // accidentally pass this fixture just by skipping an empty mask.
        parent.normal_mask = ALL_MOVES;
        context.stack.push(child);
    }
    for frame in &mut context.stack {
        // Sentinels only, never supplied to a full search as an oracle.
        frame.normal_bound = 7;
        frame.inverse_bound = 5;
        frame.cached_inverse = true;
    }
    context.job = Some(17);
    context.weight = 73;
    context.needs_query = false;
    context
}

fn unchanged_except_normal_mask(before: &Frame, after: &Frame) -> bool {
    #[cfg(all(feature = "opt9-native-quarter-cache", not(target_family = "wasm")))]
    if before.quarter_cache != after.quarter_cache { return false; }
    #[cfg(all(feature = "opt9-native-axis", not(target_family = "wasm")))]
    if before.axis_quarter_cut != after.axis_quarter_cut { return false; }
    before.cube == after.cube && before.inverse == after.inverse
        && before.inverse_mask == after.inverse_mask
        && before.normal_bound == after.normal_bound
        && before.inverse_bound == after.inverse_bound
        && before.cached_inverse == after.cached_inverse
        && before.side == after.side && before.chosen_move == after.chosen_move
}

// Frozen V7 loop semantics, kept only in the bounded checker. No optimized
// branch calls this reference and no oracle/cube distance is invented here.
fn reject_loop_reference(context: &mut Context, mut excess: u8, propagate_parent: bool, stats: &mut SearchStats) {
    context.stack.pop();
    while propagate_parent && excess > 2 && !context.stack.is_empty() {
        context.stack.pop();
        excess -= 2;
    }
    if excess > 1 {
        if let Some(parent) = context.stack.last_mut() {
            let face_mask = 7 << (parent.chosen_move / 3 * 3);
            let removed = (parent.normal_mask & face_mask).count_ones();
            parent.normal_mask &= !face_mask;
            stats.face_prunes += u64::from(removed != 0);
            stats.face_siblings_removed += u64::from(removed);
        }
    }
    while context.stack.last().is_some_and(|frame| frame.normal_mask == 0) {
        context.stack.pop();
    }
}

fn loop_differential() -> Result<usize, String> {
    let mut checked = 0;
    for frames in 0..=21 {
        for layout in 0..3 {
            let mut original = Context::empty();
            let mut cube = Cube::SOLVED;
            for i in 0..frames {
                let movement = (i % 18) as u8;
                cube = cube.moved(movement);
                let mut frame = Frame::root(cube);
                frame.normal_mask = match layout {
                    0 => ALL_MOVES,
                    1 if i % 2 == 0 => 0,
                    1 => ALL_MOVES,
                    _ => 7 << (movement / 3 * 3),
                };
                frame.inverse_mask = (i + 1) as u32;
                frame.normal_bound = (i % 14) as u8;
                frame.inverse_bound = ((i + 3) % 14) as u8;
                frame.cached_inverse = i % 2 == 0;
                frame.side = i % 3 == 0;
                frame.chosen_move = movement;
                original.stack.push(frame);
            }
            original.job = Some(17);
            original.weight = 73;
            original.needs_query = false;
            for excess in 0..=255 {
                for enabled in [false, true] {
                    let mut reference = original.clone();
                    let mut candidate = original.clone();
                    let mut reference_stats = SearchStats { face_prunes: 11, face_siblings_removed: 17, ..SearchStats::default() };
                    let mut candidate_stats = reference_stats;
                    reject_loop_reference(&mut reference, excess, enabled, &mut reference_stats);
                    candidate.reject_bound(excess, enabled, &mut candidate_stats);
                    require(reference.stack.len() == candidate.stack.len(), "jump and loop stack lengths differ")?;
                    require(reference.stack.iter().zip(&candidate.stack).all(|(a,b)|
                        unchanged_except_normal_mask(a,b) && a.normal_mask == b.normal_mask),
                        "jump and loop retained frames differ")?;
                    require(reference.job == candidate.job && reference.weight == candidate.weight
                        && reference.needs_query == candidate.needs_query, "jump and loop ownership differs")?;
                    require(reference_stats == candidate_stats, "jump and loop statistics differ")?;
                    checked += 1;
                }
            }
        }
    }
    require(checked == 33_792, "jump/loop differential corpus incomplete")?;
    Ok(checked)
}

fn boundaries() -> Result<(), String> {
    for (excess, expected_len) in [(1, 3), (2, 3), (3, 2), (4, 2), (5, 1), (6, 1)] {
        let mut context = context(4, 0b101);
        let before = context.stack.clone();
        let mut stats = SearchStats::default();
        context.reject_bound(excess, true, &mut stats);
        require(context.stack.len() == expected_len, "excess threshold popped wrong ancestor")?;
        for (i, frame) in context.stack.iter().enumerate() {
            require(unchanged_except_normal_mask(&before[i], frame), "BPMX changed a bound/cache/side")?;
            let face_cut = excess % 2 == 0 && i + 1 == expected_len;
            let face = 7 << (before[i].chosen_move / 3 * 3);
            let expected = if face_cut { before[i].normal_mask & !face } else { before[i].normal_mask };
            require(frame.normal_mask == expected, "remaining excess did not preserve exact same-face rule")?;
        }
        require(stats.face_siblings_removed == if excess % 2 == 0 { 3 } else { 0 }, "same-face accounting changed")?;
        require(context.job == Some(17) && context.weight == 73, "reject lost job weight")?;
    }
    for excess in 3..=5 {
        let mut old = context(4, 0b101);
        old.reject(excess, &mut SearchStats::default());
        require(old.stack.len() == 3, "default reject enabled unrequested parent propagation")?;
        let face = 7 << (old.stack[2].chosen_move / 3 * 3);
        require(old.stack[2].normal_mask == ALL_MOVES & !face, "default same-face semantics changed")?;
    }
    for excess in 1..=5 {
        let mut root = context(1, 0);
        root.reject_bound(excess, true, &mut SearchStats::default());
        require(root.stack.is_empty() && root.job == Some(17) && root.weight == 73, "root boundary failed")?;
    }
    let mut empty_middle = context(4, 0b101);
    empty_middle.stack[1].normal_mask = 0;
    empty_middle.stack[2].normal_mask = 0;
    empty_middle.reject_bound(3, true, &mut SearchStats::default());
    require(empty_middle.stack.len() == 1 && empty_middle.stack[0].normal_mask == ALL_MOVES,
        "mask-zero skipping reused excess at the wrong depth")?;
    Ok(())
}

fn split_and_prefix() -> Result<(), String> {
    let mut donor = context(4, 0b101);
    donor.stack[0].normal_mask = 0;
    donor.stack[1].normal_mask = (1 << 0) | (1 << 3) | (1 << 6) | (1 << 9);
    let mut split = donor.split().ok_or("fixture did not split")?;
    let split_before = split.stack.clone();
    donor.reject_bound(5, true, &mut SearchStats::default());
    require(donor.stack.is_empty(), "BPMX did not exhaust donor")?;
    require(split.stack.len() == split_before.len() && split.stack.iter().zip(&split_before)
        .all(|(a,b)| unchanged_except_normal_mask(a,b) && a.normal_mask == b.normal_mask),
        "BPMX changed a different split owner")?;
    require(split.job == Some(17) && split.weight == 0 && donor.weight == 73, "split weight changed")?;
    let mut queue = PrefixQueue { jobs: vec![PrefixJob { moves: [0;4], len: 1, weight: 0 }; 18], next: 18, ..PrefixQueue::default() };
    queue.finish(&mut donor);
    queue.finish(&mut donor);
    require(queue.jobs[17].weight == 73 && split.job == Some(17), "finish duplicated/lost weight")?;
    split.reject_bound(3, true, &mut SearchStats::default());
    require(split.stack.is_empty(), "split exhaustion failed")?;
    queue.finish(&mut split);
    require(queue.jobs[17].weight == 73, "split re-added donor history")?;

    let mut queue = PrefixQueue { jobs: vec![
        PrefixJob { moves: [0,3,6,9], len: 4, weight: 0 },
        PrefixJob { moves: [3,6,9,12], len: 4, weight: 0 },
    ], next: 0, ..PrefixQueue::default() };
    let mut context = Context::empty();
    let mut stats = SearchStats::default();
    require(queue.fetch_into(Cube::SOLVED, &mut stats, &mut context), "prefix fetch failed")?;
    require(context.stack[..4].iter().all(|frame| frame.normal_mask == 0), "prefix ownership fixture invalid")?;
    context.weight = 29;
    context.reject_bound(5, true, &mut stats);
    require(context.stack.is_empty() && queue.next == 1 && queue.jobs[1].weight == 0, "BPMX escaped prefix ownership")?;
    queue.finish(&mut context);
    require(queue.jobs[0].weight == 29, "prefix finish lost real visits")?;
    require(queue.fetch_into(Cube::SOLVED, &mut stats, &mut context) && context.job == Some(1), "next prefix was discarded")?;
    require(context.weight == 0 && stats.jobs == 2, "prefix refill did not reset visits")?;
    Ok(())
}

fn ball(start: Cube) -> BTreeMap<[u8;20], u8> {
    let mut distances = BTreeMap::new();
    distances.insert(start.to_bytes(), 0);
    let mut queue = vec![(start, 0u8)];
    let mut next = 0;
    while next < queue.len() {
        let (cube, depth) = queue[next];
        next += 1;
        if depth == 3 { continue; }
        for movement in 0..18 {
            let child = cube.moved(movement);
            if let std::collections::btree_map::Entry::Vacant(entry) = distances.entry(child.to_bytes()) {
                entry.insert(depth + 1);
                queue.push((child, depth + 1));
            }
        }
    }
    distances
}

fn exact_distance(cube: Cube, solved: &BTreeMap<[u8;20],u8>) -> Result<u8,String> {
    ball(cube).iter().filter_map(|(state, depth)| solved.get(state).map(|other| depth + other))
        .min().ok_or_else(|| "fixture distance exceeds independently enumerated radius 3+3".into())
}

fn real_distances() -> Result<(usize,usize,usize),String> {
    let solved = ball(Cube::SOLVED);
    require(solved.len() < 10_000, "BFS exceeded small-data scope")?;
    let mut ancestors = 0;
    let mut siblings = 0;
    for length in 4..=6 {
        for flips in [0, 0b010101, 0b101010] {
            let mut context = context(length + 1, flips);
            let before = context.stack.clone();
            let h = exact_distance(before.last().unwrap().cube.into(), &solved)?;
            require(usize::from(h) == length, "short path fixture is not the asserted exact distance")?;
            let remaining = 1;
            let excess = h - remaining;
            require((3..=5).contains(&excess), "real fixture misses new BPMX thresholds")?;
            let extra = usize::from((excess - 1) / 2);
            for up in 1..=extra {
                let ancestor = &before[before.len() - 1 - up];
                let exact = exact_distance(ancestor.cube.into(), &solved)?;
                require(exact > remaining + up as u8, "BPMX would discard a solvable ancestor")?;
                require(ancestor.inverse == ancestor.cube.inverse(), "NISS fixture inverse mismatch")?;
                ancestors += 1;
            }
            context.reject_bound(excess, true, &mut SearchStats::default());
            require(context.stack.len() == before.len() - 1 - extra, "real fixture popped wrong count")?;
            for (old,new) in before.iter().zip(&context.stack) {
                require(unchanged_except_normal_mask(old,new), "real fixture changed side/cache")?;
            }
            if excess % 2 == 0 {
                let index = context.stack.len() - 1;
                let removed = before[index].normal_mask & !context.stack[index].normal_mask;
                for movement in 0..18 {
                    if removed & (1 << movement) != 0 {
                        let sibling = before[index].cube.moved(movement);
                        require(exact_distance(sibling, &solved)? > remaining + extra as u8,
                            "same-face propagation would discard a solvable sibling")?;
                        siblings += 1;
                    }
                }
            }
        }
    }
    Ok((solved.len(), ancestors, siblings))
}

pub fn run() -> Result<String,String> {
    boundaries()?;
    split_and_prefix()?;
    let differential = loop_differential()?;
    let (bfs, ancestors, siblings) = real_distances()?;
    Ok(format!("{{\"allEqual\":true,\"rejectLoopDifferentialCases\":{differential},\"thresholdCases\":6,\"disabledCapabilityCases\":3,\"rootCases\":5,\"emptyMaskDepthCase\":true,\"splitOwnership\":true,\"prefixOwnership\":true,\"rankWeightPreserved\":true,\"realCubeCases\":9,\"bfsRadiusEachSide\":3,\"solvedBallStates\":{bfs},\"independentlyRejectedAncestors\":{ancestors},\"independentlyRejectedSiblings\":{siblings},\"pdbAllocatedBytes\":0,\"fullSearchesRun\":0}}"))
}

#[test]
fn bpmx_boundaries_and_ownership() {
    boundaries().unwrap();
    split_and_prefix().unwrap();
}

#[test]
fn bpmx_real_cube_distances() {
    real_distances().unwrap();
}

#[cfg(all(test, feature = "opt9-native-quarter", not(target_family = "wasm")))]
#[test]
fn quarter_rejection_respects_side_masks_split_and_prefix_ownership() {
    let cube = Cube::from_scramble("R U F L D B").unwrap();
    for movement in 0..18_u8 {
        for parent_side in [false, true] {
            for swap_child in [false, true] {
                for inverse_rejected in [false, true] {
                    let mut parent = Frame::root(cube);
                    parent.side = parent_side;
                    parent.normal_mask = 1 << movement;
                    let mut child = parent.child();
                    parent.normal_mask = ALL_MOVES & !(1 << movement);
                    if swap_child {
                        child.normal_mask = ALL_MOVES;
                        child.inverse_mask = 1;
                        child.plan(5, 13);
                        assert_ne!(child.side, parent.side);
                    }
                    let mut candidate = Context::empty();
                    candidate.stack.extend([parent, child]);
                    candidate.job = Some(17);
                    candidate.weight = 73;
                    let before = candidate.clone();
                    let expected_cut = movement % 3 != 1
                        && inverse_rejected == !swap_child;
                    let expected_mask = if expected_cut {
                        parent.normal_mask & !(1 << (movement / 3 * 3 + 2 - movement % 3))
                    } else { parent.normal_mask };
                    let mut stats = SearchStats::default();
                    candidate.reject_equivalent_quarter(inverse_rejected, &mut stats);
                    assert_eq!(candidate.stack[0].normal_mask, expected_mask);
                    assert_eq!(candidate.stack[1].normal_mask, before.stack[1].normal_mask);
                    assert!(candidate.stack.iter().zip(&before.stack)
                        .all(|(after, old)| unchanged_except_normal_mask(after, old)));
                    assert_eq!(stats.quarter_siblings_removed, u64::from(expected_cut));
                    assert_eq!((candidate.job, candidate.weight, candidate.needs_query),
                        (before.job, before.weight, before.needs_query));
                    // Repeating the proof must not count or remove more moves.
                    candidate.reject_equivalent_quarter(inverse_rejected, &mut stats);
                    assert_eq!(stats.quarter_siblings_removed, u64::from(expected_cut));
                    candidate.reject_bound(1, true, &mut stats);
                    assert_eq!(candidate.stack.len(), 1);
                    assert_eq!(candidate.stack[0].normal_mask, expected_mask);
                }
            }
        }
    }

    let mut root_only = Context::empty();
    root_only.stack.push(Frame::root(cube));
    root_only.reject_equivalent_quarter(true, &mut SearchStats::default());
    assert_eq!(root_only.stack[0].normal_mask, ALL_MOVES);

    let mut donor = Context::empty();
    let mut root = Frame::root(cube);
    root.normal_mask = 1 << 3;
    let mut parent = root.child();
    parent.normal_mask = 1;
    let mut child = parent.child();
    parent.normal_mask = ALL_MOVES & !1;
    child.normal_mask = 0;
    donor.stack.extend([root, parent, child]);
    donor.needs_query = false;
    donor.job = Some(17);
    let other = donor.split().unwrap();
    let other_before = other.clone();
    let mut stats = SearchStats::default();
    donor.reject_equivalent_quarter(true, &mut stats);
    assert_eq!(stats.quarter_siblings_removed, 1);
    assert_eq!(donor.stack[1].normal_mask & 4, 0);
    assert!(other.stack.iter().zip(&other_before.stack)
        .all(|(after, old)| unchanged_except_normal_mask(after, old)
            && after.normal_mask == old.normal_mask));
    assert_eq!(other.job, Some(17));

    // A pre-executed prefix belongs to a separate queue job. Its zero mask
    // cannot remove an equivalent prefix already claimed by another worker.
    let mut prefix = Context::empty();
    let mut parent = Frame::root(cube);
    parent.normal_mask = 1;
    let child = parent.child();
    prefix.stack.extend([parent, child]);
    prefix.job = Some(17);
    let mut stats = SearchStats::default();
    prefix.reject_equivalent_quarter(true, &mut stats);
    prefix.reject_bound(1, true, &mut stats);
    assert!(prefix.stack.is_empty());
    assert_eq!(prefix.job, Some(17));
    assert_eq!(stats.quarter_siblings_removed, 0);
}

#[cfg(all(test, feature = "opt9-native-quarter", not(target_family = "wasm")))]
#[test]
fn quarter_pruned_search_matches_every_radius_three_bfs_distance() {
    struct TwistBound { early: bool }
    impl PruningOracle for TwistBound {
        type Query = u8;
        fn prepare(&self, cube: &Cube, remaining: u8) -> Result<u8, u8> {
            // A face turn twists at most four corners; left half turns only
            // relabel corners. This is a genuine admissible H48-style bound.
            let bound = cube.corners.iter().filter(|&&corner| corner >> 3 != 0)
                .count().div_ceil(4) as u8;
            if self.early && bound > remaining { Err(bound) } else { Ok(bound) }
        }
        fn lookup(&self, query: u8) -> u8 { query }
        fn allow_quarter_pruning(&self) -> bool { true }
        fn allow_quarter_cache(&self) -> bool { true }
        fn allow_parent_propagation(&self) -> bool { true }
    }
    let distances = ball(Cube::SOLVED);
    assert_eq!(distances.len(), 3502);
    let mut cuts = 0;
    #[cfg(all(feature = "opt9-native-quarter-cache", not(target_family = "wasm")))]
    let mut reuses = 0;
    for (state, distance) in &distances {
        let start = Cube::from_bytes(state).unwrap();
        for contexts in [1, 8] {
            for early in [false, true] {
                let result = solve(start, &TwistBound { early },
                    SearchOptions { max_depth: 3, max_nodes: 0, contexts }).unwrap();
                assert!(!result.cancelled);
                let solution = result.solution.unwrap();
                assert_eq!(solution.len(), usize::from(*distance));
                assert!(solution.into_iter().fold(start, |cube, movement| cube.moved(movement)).is_solved());
                assert_eq!(result.completed_depth, distance.checked_sub(1));
                cuts += result.stats.quarter_siblings_removed;
                #[cfg(all(feature = "opt9-native-quarter-cache", not(target_family = "wasm")))]
                { reuses += result.stats.quarter_cache_reuses; }
            }
        }
    }
    assert!(cuts > 0, "the fixtures must actually remove equivalent quarter siblings");
    #[cfg(all(feature = "opt9-native-quarter-cache", not(target_family = "wasm")))]
    assert!(reuses > 0, "the fixtures must actually reuse accepted quarter bounds");
    println!("quarter search: bfsStates=3502 searches=14008 removedSiblings={cuts} pdbBytes=0");
}

#[cfg(all(test, feature = "opt9-native-quarter-cache", not(target_family = "wasm")))]
#[test]
fn quarter_cache_zero_bounds_side_switch_and_split_ownership() {
    assert_eq!(std::mem::size_of::<Frame>(), if cfg!(all(feature = "wasm-padded-state", any(target_family = "wasm", test))) { 64 } else { 56 }, "the cache byte must fit existing frame storage");
    assert_eq!(std::mem::align_of::<Frame>(), 4);
    let cube = Cube::from_scramble("R U F L D B").unwrap();
    for face in 0..6_u8 {
        for bound in [0, 1, 13] {
            for side in [false, true] {
                let mut parent = Frame::root(cube);
                parent.side = side;
                parent.inverse_bound = 7;
                parent.normal_mask = 7 << (face * 3);
                let mut first = parent.child();
                assert!(!first.cached_inverse);
                first.inverse_bound = bound;
                let mut context = Context::empty();
                context.stack.extend([parent, first]);
                context.remember_successful_quarter(13);
                assert_eq!(context.stack[0].quarter_cache, face << 4 | bound);

                // The intervening half turn still uses its parent's own bound.
                let parent = &mut context.stack[0];
                let half = parent.child();
                assert_eq!((half.inverse_bound, half.cached_inverse), (7, true));
                let other = parent.child();
                assert_eq!((other.inverse_bound, other.cached_inverse), (bound, true));
                assert_eq!(other.quarter_cache, 0xff);
                parent.normal_mask = 1 << (((face + 1) % 6) * 3 + 2);
                assert!(!parent.child().cached_inverse, "another face cannot hit this cache");

                // Bounds from the child's switched side are not this proof.
                context.stack[0] = Frame::root(cube);
                context.stack[0].side = side;
                context.stack[0].normal_mask = 7 << (face * 3);
                context.stack[1] = context.stack[0].child();
                context.stack[1].inverse_bound = bound;
                context.stack[1].side = !side;
                context.remember_successful_quarter(13);
                assert_eq!(context.stack[0].quarter_cache, 0xff);

                let parent = &mut context.stack[0];
                parent.quarter_cache = face << 4 | bound;
                parent.normal_mask = ALL_MOVES;
                parent.inverse_mask = 1;
                parent.plan(13, 13);
                assert_ne!(parent.side, side);
                assert_eq!(parent.quarter_cache, 0xff, "a parent NISS swap invalidates its face key");
            }
        }
    }

    let mut donor = Context::empty();
    let mut parent = Frame::root(cube);
    parent.quarter_cache = 0; // face U, accepted bound zero, not an empty entry.
    parent.normal_mask = (1 << 2) | (1 << 3) | (1 << 6);
    donor.stack.push(parent);
    donor.needs_query = false;
    donor.job = Some(17);
    let mut other = donor.split().unwrap();
    assert_eq!(donor.stack[0].quarter_cache, 0);
    assert_eq!(other.stack[0].quarter_cache, 0);
    assert_eq!(donor.stack[0].normal_mask & other.stack[0].normal_mask, 0);
    assert_eq!(donor.stack[0].normal_mask | other.stack[0].normal_mask, parent.normal_mask);
    let owner = if donor.stack[0].normal_mask & 4 != 0 { &mut donor } else { &mut other };
    let child = owner.stack[0].child();
    assert_eq!((child.inverse_bound, child.cached_inverse), (0, true));
    owner.stack.push(child);
    assert!(owner.reuses_quarter_bound());
    owner.stack[1].side = !owner.stack[0].side;
    assert!(!owner.reuses_quarter_bound());

    // Prefix ancestors own no pending counterpart; no proof can escape a job.
    let mut prefix = Context::empty();
    let mut parent = Frame::root(cube);
    parent.normal_mask = 1;
    let child = parent.child();
    prefix.stack.extend([parent, child]);
    prefix.remember_successful_quarter(13);
    assert_eq!(prefix.stack[0].quarter_cache, 0xff);
}

#[cfg(all(test, feature = "opt9-native-root-bound", not(target_family = "wasm")))]
#[test]
fn initial_depth_requires_its_own_admissible_root_proof() {
    struct TwistBound(std::cell::Cell<usize>);
    impl PruningOracle for TwistBound {
        type Query = u8;
        fn prepare(&self, cube: &Cube, remaining: u8) -> Result<u8, u8> {
            assert_eq!(remaining, u8::MAX);
            self.0.set(self.0.get() + 1);
            Ok(cube.corners.iter().filter(|&&corner| corner >> 3 != 0).count().div_ceil(4) as u8)
        }
        fn lookup(&self, bound: u8) -> u8 { bound }
    }
    let oracle = TwistBound(std::cell::Cell::new(0));
    let shard = SearchShard { index: 0, count: 16 };
    for (state, distance) in ball(Cube::SOLVED) {
        let start = Cube::from_bytes(&state).unwrap();
        let root_bound = oracle.lookup(oracle.prepare(&start, u8::MAX).unwrap())
            .max(oracle.lookup(oracle.prepare(&start.inverse(), u8::MAX).unwrap()));
        assert!(root_bound <= distance);
        let before = oracle.0.get();
        let search = DepthSearch::new_with_initial_depth(start, &oracle, shard, root_bound).unwrap();
        assert_eq!(search.next_depth, root_bound);
        assert_eq!(oracle.0.get() - before, 2);
        assert!(DepthSearch::new_with_initial_depth(start, &oracle, shard, root_bound + 1).is_err());
        assert_eq!(DepthSearch::new(start, &oracle, shard).unwrap().next_depth, 0);
    }
    struct Invalid { early: bool }
    impl PruningOracle for Invalid {
        type Query = u8;
        fn prepare(&self, _: &Cube, _: u8) -> Result<u8, u8> {
            if self.early { Err(14) } else { Ok(14) }
        }
        fn lookup(&self, value: u8) -> u8 { value }
    }
    for early in [false, true] {
        assert!(DepthSearch::new_with_initial_depth(Cube::SOLVED, &Invalid { early }, shard, 0).is_err());
    }
}

#[cfg(all(test, feature = "opt9-native-niss", not(target_family = "wasm")))]
#[test]
fn niss_inverse_tie_changes_only_equal_width_side_order() {
    let cube = Cube::from_scramble("R U F L D B").unwrap();
    let mut changes = 0;
    for remaining in [1_u8, 2, 7, 13, 14] {
        for normal_bound in 0..=remaining.min(13) {
            for inverse_bound in 0..=remaining.min(13) {
                for normal_mask in [0, 1, 2, 7, NO_HALF_TURNS, ALL_MOVES] {
                    for inverse_mask in [0, 1, 2, 7, NO_HALF_TURNS, ALL_MOVES] {
                        let mut old = Frame::root(cube);
                        old.normal_bound = normal_bound;
                        old.inverse_bound = inverse_bound;
                        old.normal_mask = normal_mask;
                        old.inverse_mask = inverse_mask;
                        let mut candidate = old;
                        old.plan(remaining, 13);
                        candidate.plan_ordered::<true>(remaining, 13);
                        let changes_tie = remaining <= 13 && normal_bound != inverse_bound
                            && old.normal_mask.count_ones() == old.inverse_mask.count_ones();
                        if changes_tie {
                            changes += 1;
                            assert_ne!(old.side, candidate.side);
                            assert_eq!((old.cube, old.inverse), (candidate.inverse, candidate.cube));
                            assert_eq!((old.normal_mask, old.inverse_mask),
                                (candidate.inverse_mask, candidate.normal_mask));
                            assert_eq!((old.normal_bound, old.inverse_bound),
                                (candidate.inverse_bound, candidate.normal_bound));
                        } else {
                            assert!(unchanged_except_normal_mask(&old, &candidate));
                            assert_eq!(old.normal_mask, candidate.normal_mask);
                        }
                    }
                }
            }
        }
    }
    assert!(changes > 0);
}

#[cfg(all(test, feature = "opt9-native-niss", not(target_family = "wasm")))]
#[test]
fn niss_inverse_tie_matches_every_radius_three_bfs_distance() {
    // Unlike total twisted-corner count, this genuine bound need not equal
    // its inverse-state value. A move twists at most four corners; otherwise
    // a single observed twisted corner only proves that >=1 move is needed.
    // Left half turns relabel corner identities without changing orientations.
    fn bound(cube: &Cube) -> u8 {
        if cube.corners.iter().filter(|&&corner| corner >> 3 != 0).count() > 4 { 2 }
        else { u8::from(cube.corners[0] >> 3 != 0) }
    }
    struct Oracle { inverse_tie: bool }
    impl PruningOracle for Oracle {
        type Query = u8;
        fn prepare(&self, cube: &Cube, remaining: u8) -> Result<u8, u8> {
            let bound = bound(cube);
            if bound > remaining { Err(bound) } else { Ok(bound) }
        }
        fn lookup(&self, query: u8) -> u8 { query }
        fn allow_parent_propagation(&self) -> bool { true }
        fn allow_quarter_pruning(&self) -> bool { true }
        fn allow_niss_inverse_tie(&self) -> bool { self.inverse_tie }
    }
    let distances = ball(Cube::SOLVED);
    assert_eq!(distances.len(), 3502);
    let mut asymmetric_states = 0;
    let mut changed_searches = 0;
    for (state, distance) in distances {
        let start = Cube::from_bytes(&state).unwrap();
        assert!(bound(&start) <= distance);
        assert!(bound(&start.inverse()) <= distance);
        asymmetric_states += usize::from(bound(&start) != bound(&start.inverse()));
        for half_turn in (1..18).step_by(3) {
            assert_eq!(bound(&MOVES[half_turn].multiplied(&start)), bound(&start));
        }
        for contexts in [1, 8] {
            let mut previous = None;
            for inverse_tie in [false, true] {
                let outcome = solve(start, &Oracle { inverse_tie },
                    SearchOptions { max_depth: 3, max_nodes: 0, contexts }).unwrap();
                assert!(!outcome.cancelled);
                assert_eq!(outcome.completed_depth, distance.checked_sub(1));
                let solution = outcome.solution.unwrap();
                assert_eq!(solution.len(), usize::from(distance));
                assert!(solution.iter().fold(start, |cube, &movement| cube.moved(movement)).is_solved());
                if let Some((old_solution, old_stats)) = &previous {
                    changed_searches += usize::from(old_solution != &solution || old_stats != &outcome.stats);
                }
                previous = Some((solution, outcome.stats));
            }
        }
    }
    assert!(asymmetric_states > 0, "the bound must actually distinguish inverse states");
    assert!(changed_searches > 0, "the candidate must actually change full-search ordering");
    println!("NISS: bfsStates=3502 searches=14008 asymmetricStates={asymmetric_states} changedSearches={changed_searches} pdbBytes=0");
}

#[cfg(all(test, feature = "opt9-native-quarter", not(target_family = "wasm")))]
#[test]
#[ignore = "requires the local 818008-byte Opt9 small coordinate snapshot, never the PDB"]
fn quarter_real_opt9_coordinates_match_under_left_half_turns() {
    use crate::coord::CoordTables;
    let path = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../../../.tmp/cubeopt-reverse/opt9-generated/small-memory.bin");
    assert_eq!(std::fs::metadata(&path).unwrap().len(), 818_008);
    let tables = CoordTables::from_variant_bytes(&std::fs::read(path).unwrap(), 9).unwrap();
    let mut states: Vec<_> = ball(Cube::SOLVED).into_keys()
        .map(|bytes| Cube::from_bytes(&bytes).unwrap()).collect();
    let mut cube = Cube::SOLVED;
    let mut seed = 0x35f6_12d4_ae80_9b71_u64;
    for _ in 0..4096 {
        seed ^= seed << 13;
        seed ^= seed >> 7;
        seed ^= seed << 17;
        cube = cube.moved((seed % 18) as u8);
        states.push(cube);
    }
    let mut checked = 0;
    for cube in &states {
        for face in 0..6_u8 {
            let first = cube.moved(face * 3).inverse();
            let other = cube.moved(face * 3 + 2).inverse();
            assert_eq!(first.premoved(face * 3 + 1), other);
            let scalar = tables.index64_slow(&first);
            assert_eq!(tables.index64_slow(&other), scalar);
            assert_eq!(tables.index64_specialized(&first), scalar);
            assert_eq!(tables.index64_specialized(&other), scalar);
            checked += 1;
        }
    }
    assert_eq!(checked, (3502 + 4096) * 6);
    println!("quarter coordinates: states={} exactIndexEqualities={checked} pdbBytes=0", states.len());
}
#[cfg(all(test, feature = "opt9-native-axis", not(target_family = "wasm")))]
#[test]
fn axis_rejection_thresholds_sides_and_deferred_ownership() {
    assert_eq!(std::mem::size_of::<Frame>(), 56);
    let cube = Cube::from_scramble("R U F L D B").unwrap();
    for first in 0..18_u8 {
        for second in 0..18_u8 {
            for parent_swapped in [false, true] {
                for child_swapped in [false, true] {
                    for inverse_rejected in [false, true] {
                        for excess in 0..=4 {
                            let mut gp = Frame::root(cube);
                            gp.normal_mask = 1 << first;
                            let mut parent = gp.child();
                            gp.normal_mask = ALL_MOVES & !(1 << first);
                            if parent_swapped {
                                parent.normal_mask = ALL_MOVES;
                                parent.inverse_mask = 1;
                                parent.plan(13, 13);
                            }
                            parent.normal_mask = 1 << second;
                            let mut child = parent.child();
                            parent.normal_mask = ALL_MOVES & !(1 << second);
                            if child_swapped {
                                child.normal_mask = ALL_MOVES;
                                child.inverse_mask = 1;
                                child.plan(13, 13);
                            }
                            let mut candidate = Context::empty();
                            candidate.stack.extend([gp, parent, child]);
                            candidate.job = Some(17);
                            candidate.weight = 73;
                            let before = candidate.clone();
                            let valid_side = !parent_swapped && inverse_rejected != child_swapped;
                            let valid_axis = (first / 3 + 3) % 6 == second / 3 && second % 3 != 1;
                            let immediate = valid_side && valid_axis && first % 3 == 1 && excess >= 2;
                            let deferred = valid_side && valid_axis && first % 3 == 0 && excess >= 1;
                            let forbidden = if immediate { 5 << (second / 3 * 3) } else { 0 };
                            let mut expected = gp;
                            expected.normal_mask &= !forbidden;
                            if deferred { expected.axis_quarter_cut = first / 3; }
                            let mut stats = SearchStats::default();
                            candidate.reject_axis_equivalents(inverse_rejected, excess, &mut stats);
                            assert!(unchanged_except_normal_mask(&candidate.stack[0], &expected));
                            assert_eq!(candidate.stack[0].normal_mask, expected.normal_mask);
                            for index in 1..=2 {
                                assert!(unchanged_except_normal_mask(&candidate.stack[index], &before.stack[index]));
                                assert_eq!(candidate.stack[index].normal_mask, before.stack[index].normal_mask);
                            }
                            assert_eq!(stats.axis_siblings_removed, if immediate { 2 } else { 0 });
                            assert_eq!(stats.axis_deferred_marks, u64::from(deferred));
                            assert_eq!(stats.axis_deferred_siblings_removed, 0);
                            let once = stats;
                            candidate.reject_axis_equivalents(inverse_rejected, excess, &mut stats);
                            assert_eq!(stats, once, "identical proofs are idempotent");
                            assert_eq!((candidate.job, candidate.weight), (Some(17), 73));
                        }
                    }
                }
            }
        }
    }

    // A U-D rejection marks the still-pending U' child, then a split assigns
    // that child to exactly one owner. Its D/D' bits alone may be removed.
    let mut gp = Frame::root(cube);
    gp.normal_mask = 1;
    let mut parent = gp.child();
    gp.normal_mask = 2 | 4 | (1 << 3) | (1 << 6) | (1 << 9);
    parent.normal_mask = 1 << 9;
    let child = parent.child();
    let mut donor = Context::empty();
    donor.stack.extend([gp, parent, child]);
    donor.job = Some(17);
    let mut stats = SearchStats::default();
    donor.reject_axis_equivalents(true, 1, &mut stats);
    assert_eq!(stats.axis_deferred_marks, 1);
    assert_eq!(donor.stack[0].axis_quarter_cut, 0);
    donor.stack.truncate(1);
    donor.needs_query = false;
    let mut other = donor.split().unwrap();
    assert_eq!(donor.stack[0].axis_quarter_cut, 0);
    assert_eq!(other.stack[0].axis_quarter_cut, 0);
    assert_eq!(donor.stack[0].normal_mask & other.stack[0].normal_mask, 0);
    let (owner, nonowner) = if donor.stack[0].normal_mask & 4 != 0 {
        (&mut donor, &mut other)
    } else { (&mut other, &mut donor) };
    let untouched = nonowner.clone();
    while owner.stack[0].normal_mask != 0 {
        let child = owner.stack[0].child_counted(Some(&mut stats));
        let movement = owner.stack[0].chosen_move;
        if movement == 2 {
            assert_eq!(child.normal_mask, ALLOWED[0] & !(5 << 9));
            assert_eq!(child.inverse_mask, owner.stack[0].inverse_mask);
            assert_eq!(child.axis_quarter_cut, 0xff);
            break;
        }
        assert_eq!(child.normal_mask, ALLOWED[usize::from(movement / 3)]);
    }
    assert_eq!(stats.axis_deferred_siblings_removed, 2);
    assert!(nonowner.stack.iter().zip(&untouched.stack).all(|(a,b)|
        unchanged_except_normal_mask(a,b) && a.normal_mask == b.normal_mask));

    let mut swapped = Frame::root(cube);
    swapped.axis_quarter_cut = 0;
    swapped.normal_mask = ALL_MOVES;
    swapped.inverse_mask = 1;
    swapped.plan(13, 13);
    assert!(swapped.side);
    assert_eq!(swapped.axis_quarter_cut, 0xff);

    // Pre-executed prefixes have no owned alternative and cannot affect
    // another claimed queue job, whether the proof is immediate or deferred.
    for first in [0, 1] {
        let mut gp = Frame::root(cube);
        gp.normal_mask = 1 << first;
        let mut parent = gp.child();
        parent.normal_mask = 1 << 9;
        let child = parent.child();
        let mut prefix = Context::empty();
        prefix.stack.extend([gp, parent, child]);
        let mut stats = SearchStats::default();
        prefix.reject_axis_equivalents(true, 2, &mut stats);
        assert_eq!(prefix.stack[0].axis_quarter_cut, 0xff);
        assert_eq!(stats.axis_siblings_removed, 0);
        assert_eq!(stats.axis_deferred_marks, 0);
    }
}

#[cfg(all(test, feature = "opt9-native-axis", not(target_family = "wasm")))]
#[test]
fn axis_pruning_matches_every_radius_three_bfs_distance() {
    fn orientation(cube: &Cube) -> usize {
        cube.corners[..7].iter().rev().fold(0, |n, &corner| n * 3 + usize::from(corner >> 3))
    }
    // Exact distance on the 2187 corner-orientation states. This is an
    // independent tiny abstract BFS, not a main PDB or fabricated lower bound.
    let mut co = [u8::MAX; 2187];
    let mut queue = std::collections::VecDeque::from([Cube::SOLVED]);
    co[0] = 0;
    while let Some(cube) = queue.pop_front() {
        let next = co[orientation(&cube)] + 1;
        for movement in 0..18 {
            let child = cube.moved(movement);
            let key = orientation(&child);
            if co[key] == u8::MAX { co[key] = next; queue.push_back(child); }
        }
    }
    assert!(co.iter().all(|&n| n <= 10));
    struct Oracle<'a> { co: &'a [u8; 2187], axis: bool }
    impl PruningOracle for Oracle<'_> {
        type Query = u8;
        fn prepare(&self, cube: &Cube, remaining: u8) -> Result<u8, u8> {
            let bound = self.co[orientation(cube)];
            if bound > remaining { Err(bound) } else { Ok(bound) }
        }
        fn lookup(&self, query: u8) -> u8 { query }
        fn allow_parent_propagation(&self) -> bool { true }
        fn allow_quarter_pruning(&self) -> bool { true }
        fn allow_axis_pruning(&self) -> bool { self.axis }
    }
    let distances = ball(Cube::SOLVED);
    assert_eq!(distances.len(), 3502);
    let mut immediate = 0;
    let mut marked = 0;
    let mut deferred = 0;
    for (state, distance) in distances {
        let start = Cube::from_bytes(&state).unwrap();
        assert!(co[orientation(&start)] <= distance);
        for half in (1..18).step_by(3) {
            assert_eq!(co[orientation(&MOVES[half].multiplied(&start))], co[orientation(&start)]);
        }
        // Opposite faces commute and changing either quarter inserts a left
        // half turn in the inverse. Adjacent faces are deliberately excluded.
        for face in 0..3_u8 {
            let a = face * 3;
            let b = (face + 3) * 3;
            let first = start.moved(a).moved(b).inverse();
            assert_eq!(MOVES[usize::from(a + 1)].multiplied(&first), start.moved(a + 2).moved(b).inverse());
            assert_eq!(MOVES[usize::from(b + 1)].multiplied(&first), start.moved(a).moved(b + 2).inverse());
            assert_eq!(co[orientation(&start.moved(a + 1).moved(b).inverse())],
                co[orientation(&start.moved(b).inverse())]);
        }
        for contexts in [1, 8] {
            for axis in [false, true] {
                let result = solve(start, &Oracle { co: &co, axis },
                    SearchOptions { max_depth: 3, max_nodes: 0, contexts }).unwrap();
                assert!(!result.cancelled);
                let solution = result.solution.unwrap();
                assert_eq!(solution.len(), usize::from(distance));
                assert!(solution.into_iter().fold(start, |cube, movement| cube.moved(movement)).is_solved());
                assert_eq!(result.completed_depth, distance.checked_sub(1));
                if !axis {
                    assert_eq!((result.stats.axis_siblings_removed, result.stats.axis_deferred_marks,
                        result.stats.axis_deferred_siblings_removed), (0, 0, 0));
                }
                immediate += result.stats.axis_siblings_removed;
                marked += result.stats.axis_deferred_marks;
                deferred += result.stats.axis_deferred_siblings_removed;
            }
        }
    }
    assert!(immediate > 0 && marked > 0 && deferred > 0,
        "each new branch must execute: immediate={immediate} marked={marked} deferred={deferred}");
    println!("axis: bfsStates=3502 searches=14008 immediate={immediate} marked={marked} deferred={deferred} tinyOrientationBytes=2187 mainPdbBytes=0");
}

#[cfg(all(test, feature = "opt10-native-dual", not(target_family = "wasm")))]
#[test]
fn dual_gate_and_merge_preserve_side_cache_and_owned_masks() {
    // Synthetic control fixtures only; these bound sentinels are never used
    // as an admissible oracle. Independent real-cube distances follow below.
    let mut tree = context(2, 0);
    tree.stack[0].chosen_move = 0; // First quarter, counterpart 2, half turn 1.
    for (mask, excess, expected) in [
        (0, 1, false), (1 << 2, 1, false), (1 << 1, 1, true),
        (1 << 3, 1, true), ((1 << 2) | (1 << 3), 1, true),
        ((1 << 1) | (1 << 2), 2, false), (1 << 3, 2, true),
    ] {
        tree.stack[0].normal_mask = mask;
        let before = tree.stack.clone();
        assert_eq!(tree.dual_probe_has_owned_work(10, excess, true), expected);
        assert_eq!(tree.dual_probe_has_owned_work(1, excess, true), expected);
        for remaining in [0, 11, 12, 13, 20] {
            assert!(!tree.dual_probe_has_owned_work(remaining, excess, true));
        }
        for other_excess in [0, 3, 4, 13] {
            assert!(!tree.dual_probe_has_owned_work(10, other_excess, true));
        }
        for (a, b) in before.iter().zip(&tree.stack) {
            assert!(unchanged_except_normal_mask(a, b));
            assert_eq!(a.normal_mask, b.normal_mask);
        }
    }
    tree.stack[0].normal_mask = 1 << 2;
    assert!(tree.dual_probe_has_owned_work(10, 1, false));
    tree.stack[1].side = !tree.stack[0].side;
    assert!(tree.dual_probe_has_owned_work(10, 1, true), "after NISS, this query is not the parent's original inverse");
    tree.stack[0].chosen_move = 1;
    assert!(tree.dual_probe_has_owned_work(10, 1, true), "a half turn has no equivalent quarter counterpart");

    let mut prefix = context(3, 0);
    prefix.stack[1].normal_mask = 0;
    assert!(!prefix.dual_probe_has_owned_work(10, 1, true), "another ancestor/job does not supply owned sibling work");
    let root_only = Context { stack: vec![Frame::root(Cube::SOLVED)], job: None, weight: 0, needs_query: false };
    assert!(!root_only.dual_probe_has_owned_work(10, 1, true));

    for (old, bound, expected, raised, cut, inverse) in [
        (1, 0, 1, 0, 0, true), (1, 11, 1, 0, 0, true),
        (1, 12, 2, 1, 0, false), (1, 13, 3, 1, 1, false),
        (2, 12, 2, 0, 0, true), (2, 13, 3, 1, 1, false),
    ] {
        let mut excess = old;
        let mut inverse_rejected = true;
        let mut stats = SearchStats::default();
        merge_dual_rejection(10, bound, &mut excess, &mut inverse_rejected, &mut stats);
        assert_eq!((excess, inverse_rejected), (expected, inverse));
        assert_eq!((stats.dual_attempts, stats.dual_raised, stats.dual_parent_cuts), (0, raised, cut));
        assert_eq!((stats.nodes, stats.probes, stats.inverse_probes, stats.cache_reuses), (0, 0, 0, 0));
    }
}

#[cfg(all(test, feature = "opt10-native-dual", not(target_family = "wasm")))]
#[test]
fn dual_search_matches_every_radius_three_independent_distance() {
    fn orientation(cube: &Cube) -> usize {
        cube.corners[..7].iter().rev().fold(0, |n, &corner| n * 3 + usize::from(corner >> 3))
    }
    // Real, exact 2187-state corner-orientation distances are admissible and
    // invariant under LEFT half turns. No Opt10/H48 main table is loaded.
    let mut co = [u8::MAX; 2187];
    let mut queue = std::collections::VecDeque::from([Cube::SOLVED]);
    co[0] = 0;
    while let Some(cube) = queue.pop_front() {
        let next = co[orientation(&cube)] + 1;
        for movement in 0..18 {
            let child = cube.moved(movement);
            let key = orientation(&child);
            if co[key] == u8::MAX { co[key] = next; queue.push_back(child); }
        }
    }
    assert!(co.iter().all(|&bound| bound <= 10));
    fn lower_bound(co: &[u8; 2187], cube: &Cube) -> u8 {
        // Conservatively weaken a fixed orientation subset to exercise
        // asymmetric two-sided proofs. Only lowering an exact CO bound
        // preserves admissibility; the selector is also left-half-turn
        // invariant, so the existing half/quarter rules remain valid.
        let exact = co[orientation(cube)];
        if cube.corners[0] >> 3 != 0 { exact.min(2) } else { exact }
    }
    struct Oracle<'a> { co: &'a [u8; 2187], dual: bool, early: bool }
    impl PruningOracle for Oracle<'_> {
        type Query = u8;
        fn prepare(&self, cube: &Cube, remaining: u8) -> Result<u8, u8> {
            let bound = lower_bound(self.co, cube);
            if self.early && bound > remaining { Err(bound) } else { Ok(bound) }
        }
        fn lookup(&self, bound: u8) -> u8 { bound }
        fn max_bound(&self) -> u8 { 13 }
        fn allow_parent_propagation(&self) -> bool { true }
        fn allow_quarter_pruning(&self) -> bool { true }
        fn allow_dual_rejection(&self) -> bool { self.dual }
    }
    let distances = ball(Cube::SOLVED);
    assert_eq!(distances.len(), 3502);
    let (mut attempts, mut raised, mut parent_cuts) = (0, 0, 0);
    for (state, distance) in distances {
        let start = Cube::from_bytes(&state).unwrap();
        assert!(co[orientation(&start)] <= distance);
        assert!(lower_bound(&co, &start) <= distance);
        for half in (1..18).step_by(3) {
            assert_eq!(co[orientation(&MOVES[half].multiplied(&start))], co[orientation(&start)]);
            assert_eq!(lower_bound(&co, &MOVES[half].multiplied(&start)), lower_bound(&co, &start));
        }
        for contexts in [1, 8] { for early in [false, true] { for dual in [false, true] {
            let outcome = solve(start, &Oracle { co: &co, dual, early },
                SearchOptions { max_depth: 3, max_nodes: 0, contexts }).unwrap();
            assert!(!outcome.cancelled);
            assert_eq!(outcome.completed_depth, distance.checked_sub(1));
            let solution = outcome.solution.unwrap();
            assert_eq!(solution.len(), usize::from(distance));
            assert!(solution.into_iter().fold(start, |cube, movement| cube.moved(movement)).is_solved());
            let stats = outcome.stats;
            if !dual {
                assert_eq!((stats.dual_attempts, stats.dual_raised, stats.dual_parent_cuts), (0, 0, 0));
            }
            attempts += stats.dual_attempts;
            raised += stats.dual_raised;
            parent_cuts += stats.dual_parent_cuts;
        } } }
    }
    assert!(attempts > 0, "the genuine oracle must exercise dual prepare attempts");
    assert!(raised > 0, "the genuine oracle must supply a strictly stronger second-side proof");
    assert!(parent_cuts > 0, "the genuine oracle must exercise an additional parent cutoff");
    println!("dual: bfsStates=3502 searches=28016 attempts={attempts} raised={raised} parentCuts={parent_cuts} pdbBytes=0");
}

#[cfg(all(test, any(feature = "opt10-native-coset", feature = "wasm-coset-prune"), not(target_family = "wasm")))]
#[test]
fn backward_coset_changes_only_owned_inverse_masks() {
    assert_eq!(std::mem::size_of::<Frame>(), 56);
    // Control sentinels only. Genuine admissible bounds are exercised below.
    for parent_side in [false, true] { for child_side in [false, true] {
        for inverse in [false, true] { for excess in [0, 1, 2, 3, 4, 13] {
            for owned in [0, 1 << 2, 1 << 3, (1 << 2) | (1 << 3)] {
                let mut tree = context(2, 0);
                tree.stack[0].side = parent_side;
                tree.stack[1].side = child_side;
                tree.stack[0].chosen_move = 0;
                tree.stack[0].normal_mask = owned;
                let before = tree.stack.clone();
                let effective = excess == 2 && inverse != (parent_side == child_side) && owned & !7 != 0;
                let mut stats = SearchStats::default();
                tree.reject_backward_coset(inverse, excess, &mut stats);
                for (index, (old, new)) in before.iter().zip(&tree.stack).enumerate() {
                    let mut expected = *old;
                    if effective && index == 0 { expected.inverse_mask &= NO_HALF_TURNS; }
                    assert!(unchanged_except_normal_mask(&expected, new));
                    assert_eq!(expected.normal_mask, new.normal_mask);
                }
                assert_eq!((stats.coset_parent_proofs, stats.coset_half_prunes),
                    if effective { (1, 6) } else { (0, 0) });
                let once = stats;
                tree.reject_backward_coset(inverse, excess, &mut stats);
                assert_eq!(stats, once, "an already restricted mask has no new event");
            }
        } }
    } }
    let mut tree = context(3, 0);
    let mut sibling = Context::empty();
    assert!(tree.split_into(&mut sibling));
    let saved = sibling.stack.clone();
    tree.reject_backward_coset(false, 2, &mut SearchStats::default());
    for (old, new) in saved.iter().zip(&sibling.stack) {
        assert!(unchanged_except_normal_mask(old, new));
        assert_eq!(old.normal_mask, new.normal_mask);
    }
    let mut root_only = Context { stack: vec![Frame::root(Cube::SOLVED)], job: None, weight: 0, needs_query: false };
    let mut stats = SearchStats::default();
    root_only.reject_backward_coset(false, 2, &mut stats);
    assert_eq!(stats, SearchStats::default());
}

#[cfg(all(test, any(feature = "opt10-native-coset", feature = "wasm-coset-prune"), not(target_family = "wasm")))]
#[test]
fn backward_coset_matches_every_radius_three_distance() {
    fn orientation(cube: &Cube) -> usize {
        cube.corners[..7].iter().rev().fold(0, |n, &corner| n * 3 + usize::from(corner >> 3))
    }
    let mut co = [u8::MAX; 2187];
    let mut queue = std::collections::VecDeque::from([Cube::SOLVED]);
    co[0] = 0;
    while let Some(cube) = queue.pop_front() {
        let next = co[orientation(&cube)] + 1;
        for movement in 0..18 {
            let child = cube.moved(movement);
            let key = orientation(&child);
            if co[key] == u8::MAX { co[key] = next; queue.push_back(child); }
        }
    }
    assert!(co.iter().all(|&bound| bound <= 10));
    struct Oracle<'a> { co: &'a [u8; 2187], compressed: bool, coset: bool, chain: bool, early: bool }
    impl Oracle<'_> {
        fn bound(&self, cube: &Cube) -> u8 {
            // Only lower a genuine CO distance. This fixed orientation
            // selector remains left-half-turn invariant but loses consistency.
            if self.compressed && cube.corners[0] >> 3 != 0 { 0 }
            else { self.co[orientation(cube)] }
        }
    }
    impl PruningOracle for Oracle<'_> {
        type Query = u8;
        fn prepare(&self, cube: &Cube, remaining: u8) -> Result<u8, u8> {
            let bound = self.bound(cube);
            if self.early && bound > remaining { Err(bound) } else { Ok(bound) }
        }
        fn lookup(&self, bound: u8) -> u8 { bound }
        fn max_bound(&self) -> u8 { 13 }
        fn allow_parent_propagation(&self) -> bool { true }
        fn allow_quarter_pruning(&self) -> bool { true }
        fn allow_backward_coset(&self) -> bool { self.coset }
        fn allow_coset_chain(&self) -> bool { self.chain }
    }
    let distances = ball(Cube::SOLVED);
    assert_eq!(distances.len(), 3502);
    let (mut proofs, mut halves) = (0, 0);
    let variants = if cfg!(feature = "opt10-native-coset-chain") { 3 } else { 2 };
    let mut nodes = [[0_u64; 3]; 2];
    #[cfg(feature = "opt10-native-coset-chain")]
    let (mut chain_proofs, mut chain_cuts, mut chain_halves, mut cut_sample) = (0, 0, 0, None);
    for (state, distance) in distances {
        let start = Cube::from_bytes(&state).unwrap();
        for compressed in [false, true] {
            let oracle = Oracle { co: &co, compressed, coset: false, chain: false, early: false };
            assert!(oracle.bound(&start) <= distance);
            for half in (1..18).step_by(3) {
                assert_eq!(oracle.bound(&MOVES[half].multiplied(&start)), oracle.bound(&start));
            }
            for contexts in [1, 8] { for early in [false, true] {
                let mut before = None;
                for variant in 0..variants {
                    let coset = variant != 0;
                    let chain = variant == 2;
                    let result = solve(start, &Oracle { co: &co, compressed, coset, chain, early },
                        SearchOptions { max_depth: 3, max_nodes: 0, contexts }).unwrap();
                    assert!(!result.cancelled);
                    assert_eq!(result.completed_depth, distance.checked_sub(1));
                    let solution = result.solution.unwrap();
                    assert_eq!(solution.len(), usize::from(distance));
                    assert!(solution.into_iter().fold(start, |cube, movement| cube.moved(movement)).is_solved());
                    let stats = result.stats;
                    if !coset || !compressed {
                        assert_eq!((stats.coset_parent_proofs, stats.coset_half_prunes), (0, 0));
                    }
                    if !compressed {
                        #[allow(unused_mut)]
                        let mut equivalent_stats = stats;
                        #[cfg(feature = "opt10-native-coset-chain")]
                        {
                            assert_eq!((stats.coset_chain_proofs, stats.coset_chain_ancestor_cuts, stats.coset_chain_half_prunes), (0, 0, 0));
                            equivalent_stats.coset_chain_attempts = 0;
                            equivalent_stats.coset_chain_edges = 0;
                        }
                        if let Some(before) = before { assert_eq!(equivalent_stats, before, "consistent CO already propagated this restriction"); }
                        else { before = Some(equivalent_stats); }
                    }
                    nodes[usize::from(compressed)][variant] += stats.nodes;
                    proofs += stats.coset_parent_proofs;
                    halves += stats.coset_half_prunes;
                    #[cfg(feature = "opt10-native-coset-chain")]
                    {
                        if !chain {
                            assert_eq!((stats.coset_chain_proofs, stats.coset_chain_attempts, stats.coset_chain_edges,
                                stats.coset_chain_ancestor_cuts, stats.coset_chain_half_prunes), (0, 0, 0, 0, 0));
                        }
                        chain_proofs += stats.coset_chain_proofs;
                        chain_cuts += stats.coset_chain_ancestor_cuts;
                        chain_halves += stats.coset_chain_half_prunes;
                        if stats.coset_chain_ancestor_cuts != 0 && cut_sample.is_none() {
                            cut_sample = Some(format!("state={state:?} distance={distance} contexts={contexts} early={early} cuts={} halves={}",
                                stats.coset_chain_ancestor_cuts, stats.coset_chain_half_prunes));
                        }
                    }
                }
            } }
        }
    }
    println!("coset: bfsStates=3502 searches={} proofs={proofs} halfPrunes={halves} nodesExact={:?} nodesCompressed={:?} pdbBytes=0", 28016 * variants, nodes[0], nodes[1]);
    assert!(proofs > 0 && halves > 0, "the genuine lowered oracle must exercise backward coset restrictions");
    #[cfg(feature = "opt10-native-coset-chain")]
    {
        println!("chain: proofs={chain_proofs} ancestorCuts={chain_cuts} halfPrunes={chain_halves} firstCut={cut_sample:?}");
        #[cfg(feature = "opt10-native-coset-gated")]
        {
            // Frozen ungated-chain small-data result. Only the diagnostic
            // attempts/edges may differ after the first-edge gate.
            assert_eq!(nodes, [[1_579_040; 3], [8_166_842, 8_148_692, 8_147_776]]);
            assert_eq!((chain_proofs, chain_cuts, chain_halves), (1394, 0, 7792));
        }
        assert!(chain_halves > 0, "the genuine oracle must exercise new ancestor mask restrictions");
        // A zero-loss chain needs two queried edges while its ancestor is
        // truly outside the budget. Radius-three inputs cannot supply that
        // root proof. This fixed four-move state was found by a bounded
        // small-data search; radius 3+3 BFS independently proves its distance.
        let solved = ball(Cube::SOLVED);
        for moves in [[12, 6, 2, 3]] {
            let start = moves.into_iter().fold(Cube::SOLVED, |cube, movement| cube.moved(movement));
            let distance = exact_distance(start, &solved).unwrap();
            assert_eq!(distance, 4);
            let mut deep_nodes = [0_u64; 2];
            for contexts in [1, 8] { for early in [false, true] { for chain in [false, true] {
                let result = solve(start, &Oracle { co: &co, compressed: true, coset: true, chain, early },
                    SearchOptions { max_depth: distance, max_nodes: 2_000_000, contexts }).unwrap();
                assert!(!result.cancelled, "bounded deep fixture exceeded its explicit small-search budget");
                assert_eq!(result.completed_depth, distance.checked_sub(1));
                let solution = result.solution.unwrap();
                assert_eq!(solution.len(), usize::from(distance));
                assert!(solution.into_iter().fold(start, |cube, movement| cube.moved(movement)).is_solved());
                deep_nodes[usize::from(chain)] += result.stats.nodes;
                if chain {
                    chain_proofs += result.stats.coset_chain_proofs;
                    chain_cuts += result.stats.coset_chain_ancestor_cuts;
                    chain_halves += result.stats.coset_chain_half_prunes;
                    if result.stats.coset_chain_ancestor_cuts != 0 && cut_sample.is_none() {
                        cut_sample = Some(format!("moves={moves:?} distance={distance} contexts={contexts} early={early} cuts={} halves={}",
                            result.stats.coset_chain_ancestor_cuts, result.stats.coset_chain_half_prunes));
                    }
                }
            } } }
            let name = moves.map(|movement| crate::cube::MOVE_NAMES[usize::from(movement)]).join(" ");
            println!("chain fixed: scramble={name} distance={distance} nodesDirectAndChain={deep_nodes:?}");
            #[cfg(feature = "opt10-native-coset-gated")]
            assert_eq!(deep_nodes, [5780, 5812]);
        }
        println!("chain deep: proofs={chain_proofs} ancestorCuts={chain_cuts} halfPrunes={chain_halves} firstCut={cut_sample:?}");
        assert!(chain_cuts > 0, "extra whole-frame cuts must exercise zero-loss half-turn transport");
        #[cfg(feature = "opt10-native-coset-gated")]
        assert_eq!((chain_proofs, chain_cuts, chain_halves), (1404, 2, 7840));
    }
}

#[cfg(all(test, feature = "opt10-native-coset-gated", not(target_family = "wasm")))]
#[test]
fn coset_chain_first_edge_gate_preserves_every_proof() {
    // Control-only states: this compares the new gate to the original walk,
    // not an invented heuristic to true distances. The genuine CO fixture
    // above separately locks all search results and effective cuts.
    let mut skipped = 0;
    for sides in 0..8 {
        for previous in [0, 1, 3, 4] {
            for movement in 0..18 {
                for inverse in [false, true] {
                    for excess in 0..=13 {
                        let mut tree = context(3, 0);
                        for (index, frame) in tree.stack.iter_mut().enumerate() {
                            frame.side = sides & (1 << index) != 0;
                        }
                        tree.stack[0].chosen_move = previous;
                        tree.stack[1].chosen_move = movement;
                        let mut old = SearchStats::default();
                        let mut new = SearchStats::default();
                        let original = tree.coset_chain_proof_gated::<false>(inverse, excess, &mut old);
                        let gated = tree.coset_chain_proof_gated::<true>(inverse, excess, &mut new);
                        let key = |proof: CosetChainProof| (proof.keep, proof.equal, proof.normal);
                        assert_eq!(original.map(key), gated.map(key));
                        if old.coset_chain_attempts != new.coset_chain_attempts {
                            assert!(original.is_none());
                            assert_eq!((old.coset_chain_attempts, old.coset_chain_edges), (1, 1));
                            assert_eq!((new.coset_chain_attempts, new.coset_chain_edges), (0, 0));
                            skipped += 1;
                        }
                        old.coset_chain_attempts = new.coset_chain_attempts;
                        old.coset_chain_edges = new.coset_chain_edges;
                        assert_eq!(old, new);
                    }
                }
            }
        }
    }
    assert!(skipped > 0);
}

#[cfg(all(test, feature = "opt10-native-coset-chain", not(target_family = "wasm")))]
#[test]
fn coset_chain_control_root_sides_and_split_ownership() {
    // These are control sentinels, not a fake admissible search oracle.
    // Real search coverage and optimality are checked separately above.
    for flip in [false, true] {
        let mut tree = context(3, 0);
        tree.stack[0].side = flip;
        tree.stack[1].side = !flip;
        tree.stack[2].side = !flip;
        tree.stack[0].chosen_move = 1; // Opposite-side half turn: zero loss.
        tree.stack[1].chosen_move = 3; // Same-side right move: lose one.
        let before = tree.stack.clone();
        let mut stats = SearchStats::default();
        let proof = tree.coset_chain_proof(false, 3, &mut stats).unwrap();
        assert_eq!((proof.keep, proof.equal, proof.normal), (1, 0, false));
        for (old, new) in before.iter().zip(&tree.stack) {
            assert!(unchanged_except_normal_mask(old, new));
            assert_eq!(old.normal_mask, new.normal_mask);
        }
        tree.reject_bound(3, true, &mut stats);
        assert_eq!(tree.stack.len(), 1);
        tree.apply_coset_chain(proof, &mut stats);
        assert_eq!(tree.stack.len(), 1);
        assert_eq!(tree.stack[0].normal_mask, NO_HALF_TURNS);
        assert_eq!((stats.coset_chain_proofs, stats.coset_chain_ancestor_cuts, stats.coset_chain_half_prunes), (1, 0, 6));

        let mut root_cut = Context { stack: before.clone(), job: Some(17), weight: 73, needs_query: false };
        let mut stats = SearchStats::default();
        let proof = root_cut.coset_chain_proof(false, 4, &mut stats).unwrap();
        assert_eq!((proof.keep, proof.equal), (0, u8::MAX));
        root_cut.reject_bound(4, true, &mut stats);
        assert_eq!(root_cut.stack.len(), 1, "old BPMX still owns root siblings");
        root_cut.apply_coset_chain(proof, &mut stats);
        assert!(root_cut.stack.is_empty());
        assert_eq!((root_cut.job, root_cut.weight), (Some(17), 73), "normal finish still owns the job lifecycle");
        assert_eq!((stats.coset_chain_proofs, stats.coset_chain_ancestor_cuts, stats.coset_chain_half_prunes), (1, 1, 0));

        let mut quarter_stop = Context { stack: before.clone(), job: None, weight: 0, needs_query: false };
        quarter_stop.stack[0].chosen_move = 0;
        let proof = quarter_stop.coset_chain_proof(false, 4, &mut SearchStats::default()).unwrap();
        assert_eq!((proof.keep, proof.equal), (1, u8::MAX), "opposite quarter ends the certificate");
        quarter_stop.reject_bound(4, true, &mut SearchStats::default());
        let old_root = quarter_stop.stack[0];
        quarter_stop.apply_coset_chain(proof, &mut SearchStats::default());
        assert_eq!(quarter_stop.stack.len(), 1);
        assert!(unchanged_except_normal_mask(&old_root, &quarter_stop.stack[0]));
        assert_eq!(old_root.normal_mask, quarter_stop.stack[0].normal_mask);

        let mut split = Context { stack: before.clone(), job: Some(17), weight: 73, needs_query: false };
        let mut other = Context::empty();
        assert!(split.split_into(&mut other));
        let other_before = other.stack.clone();
        let proof = split.coset_chain_proof(false, 4, &mut SearchStats::default()).unwrap();
        split.reject_bound(4, true, &mut SearchStats::default());
        split.apply_coset_chain(proof, &mut SearchStats::default());
        for (old, new) in other_before.iter().zip(&other.stack) {
            assert!(unchanged_except_normal_mask(old, new));
            assert_eq!(old.normal_mask, new.normal_mask);
        }
    }
    let single = Context { stack: vec![Frame::root(Cube::SOLVED)], job: None, weight: 0, needs_query: false };
    assert!(single.coset_chain_proof(false, 13, &mut SearchStats::default()).is_none());
    let tree = context(3, 0);
    for excess in [0, 1, 2] {
        assert!(tree.coset_chain_proof(false, excess, &mut SearchStats::default()).is_none());
    }
}

#[cfg(all(test, feature = "opt10-native-lookahead", not(target_family = "wasm")))]
#[test]
fn lookahead_matches_all_radius_three_distances_with_exact_and_weakened_co() {
    use std::cell::Cell;
    fn orientation(cube: &Cube) -> usize {
        cube.corners[..7].iter().rev().fold(0, |n, &corner| n * 3 + usize::from(corner >> 3))
    }
    let mut co = [u8::MAX; 2187];
    let mut queue = std::collections::VecDeque::from([Cube::SOLVED]);
    co[0] = 0;
    while let Some(cube) = queue.pop_front() {
        let next = co[orientation(&cube)] + 1;
        for movement in 0..18 {
            let child = cube.moved(movement);
            let key = orientation(&child);
            if co[key] == u8::MAX { co[key] = next; queue.push_back(child); }
        }
    }
    struct Oracle<'a> {
        co: &'a [u8; 2187], weakened: bool, enabled: bool, early: bool,
        expected: Cell<Option<(Cube, u8)>>, attempts: Cell<u64>, reads: Cell<u64>, early_rejects: Cell<u64>,
    }
    impl Oracle<'_> {
        fn bound(&self, cube: &Cube) -> u8 {
            if self.weakened && cube.corners[0] >> 3 != 0 { 0 } else { self.co[orientation(cube)] }
        }
        fn strengthened(&self, cube: &Cube) -> u8 {
            self.bound(cube).max(self.bound(&cube.moved(1)).saturating_sub(1))
        }
    }
    impl PruningOracle for Oracle<'_> {
        type Query = (u8, bool);
        fn prepare(&self, cube: &Cube, remaining: u8) -> Result<Self::Query, u8> {
            let extra = if let Some((expected_cube, expected_remaining)) = self.expected.take() {
                assert_eq!((*cube, remaining), (expected_cube, expected_remaining));
                self.attempts.set(self.attempts.get() + 1);
                true
            } else { false };
            let bound = self.bound(cube);
            if self.early && bound > remaining {
                if extra { self.early_rejects.set(self.early_rejects.get() + 1); }
                Err(bound)
            } else { Ok((bound, extra)) }
        }
        fn lookup(&self, (bound, extra): Self::Query) -> u8 {
            if extra { self.reads.set(self.reads.get() + 1); }
            bound
        }
        fn max_bound(&self) -> u8 { 13 }
        fn allow_parent_propagation(&self) -> bool { true }
        fn allow_quarter_pruning(&self) -> bool { true }
        fn allow_backward_coset(&self) -> bool { true }
        fn lookahead_move(&self, cube: &Cube, remaining: u8, _: u8) -> Option<u8> {
            if !self.enabled { return None; }
            // Exact CO is consistent, so this independently checks every
            // actual strengthened query, not just the initial BFS states.
            assert!(self.strengthened(cube) <= self.co[orientation(cube)]);
            assert!(self.expected.replace(Some((cube.moved(1), remaining + 1))).is_none());
            Some(1)
        }
    }
    let distances = ball(Cube::SOLVED);
    assert_eq!(distances.len(), 3502);
    let mut totals = [0_u64; 8];
    let mut nodes = [[0_u64; 2]; 2];
    for (state, distance) in distances {
        let start = Cube::from_bytes(&state).unwrap();
        for weakened in [false, true] { for contexts in [1, 8] { for early in [false, true] {
            let mut baseline = None;
            for enabled in [false, true] {
                let oracle = Oracle { co: &co, weakened, enabled, early, expected: Cell::new(None),
                    attempts: Cell::new(0), reads: Cell::new(0), early_rejects: Cell::new(0) };
                assert!(oracle.strengthened(&start) <= distance);
                for half in (1..18).step_by(3) {
                    assert_eq!(oracle.strengthened(&MOVES[half].multiplied(&start)), oracle.strengthened(&start));
                }
                let result = solve(start, &oracle, SearchOptions { max_depth: 3, max_nodes: 0, contexts }).unwrap();
                assert!(!result.cancelled);
                assert_eq!(result.completed_depth, distance.checked_sub(1));
                let solution = result.solution.unwrap();
                assert_eq!(solution.len(), usize::from(distance));
                assert!(solution.iter().fold(start, |cube, &movement| cube.moved(movement)).is_solved());
                assert_eq!(result.stats.lookahead_attempts, oracle.attempts.get());
                assert_eq!(result.stats.lookahead_probes, oracle.reads.get());
                assert_eq!(oracle.attempts.get(), oracle.reads.get() + oracle.early_rejects.get());
                assert!(oracle.expected.get().is_none());
                if !weakened {
                    assert_eq!((result.stats.lookahead_raises, result.stats.lookahead_rejects,
                        result.stats.lookahead_tightened_at_budget, result.stats.lookahead_half_prunes), (0, 0, 0, 0));
                    let mut normalized = result.stats;
                    normalized.probes -= normalized.lookahead_probes;
                    normalized.lookahead_attempts = 0;
                    normalized.lookahead_probes = 0;
                    if let Some(before) = &baseline { assert_eq!(&(solution, normalized), before); }
                    else { baseline = Some((solution, normalized)); }
                }
                nodes[usize::from(weakened)][usize::from(enabled)] += result.stats.nodes;
                totals[0] += result.stats.lookahead_attempts;
                totals[1] += result.stats.lookahead_probes;
                totals[2] += result.stats.lookahead_raises;
                totals[3] += result.stats.lookahead_rejects;
                totals[4] += result.stats.lookahead_tightened_at_budget;
                totals[5] += result.stats.lookahead_half_prunes;
                totals[6] += oracle.early_rejects.get();
                totals[7] += result.stats.splits + result.stats.cache_reuses;
            }
        } } }
    }
    assert!(totals.iter().all(|&count| count > 0), "every claimed live path must have genuine coverage: {totals:?}");
    println!("lookahead: bfsStates=3502 searches=56032 attempts/probes/raises/rejects/tightened/halfBits/early/splitCache={totals:?} nodesExact={:?} nodesWeakened={:?} pdbBytes=0", nodes[0], nodes[1]);
}

#[cfg(all(test, feature = "opt10-native-lookahead", not(target_family = "wasm")))]
#[test]
fn lookahead_zero_merge_niss_cache_and_cancellation_boundaries() {
    // Frame sentinels test ownership/side transport only. Admissibility is
    // covered independently by all real CO states in the previous fixture.
    let mut frame = Frame::root(Cube::from_scramble("R F U").unwrap());
    frame.normal_bound = 2;
    let before = frame;
    let mut excess = 0;
    let mut stats = SearchStats::default();
    assert!(!merge_lookahead_bound(&mut frame, 4, 0, &mut excess, &mut stats));
    assert_eq!(frame.normal_bound, before.normal_bound);
    assert_eq!((excess, stats.lookahead_raises), (0, 0));
    frame.inverse_mask = 1 << 1;
    assert!(!merge_lookahead_bound(&mut frame, 4, 4, &mut excess, &mut stats));
    frame.plan(4, 13);
    assert!(frame.side);
    assert_eq!(frame.inverse_bound, 3);
    let child = frame.child();
    assert!(child.cached_inverse);
    assert_eq!(child.inverse_bound, 3);

    use std::cell::Cell;
    struct CancelOnExtra { prepares: Cell<u8>, stopped: Cell<bool>, expected: Cell<bool> }
    impl PruningOracle for CancelOnExtra {
        type Query = ();
        fn prepare(&self, _: &Cube, remaining: u8) -> Result<(), u8> {
            self.prepares.set(self.prepares.get() + 1);
            if self.expected.replace(false) {
                assert_eq!(remaining, 2);
                self.stopped.set(true);
            }
            Ok(())
        }
        fn lookup(&self, _: ()) -> u8 { 0 }
        fn cancelled(&self) -> bool { self.stopped.get() }
        fn lookahead_move(&self, _: &Cube, remaining: u8, _: u8) -> Option<u8> {
            assert_eq!(remaining, 1);
            self.expected.set(true);
            Some(1)
        }
    }
    let oracle = CancelOnExtra { prepares: Cell::new(0), stopped: Cell::new(false), expected: Cell::new(false) };
    let result = solve(Cube::from_scramble("R").unwrap(), &oracle,
        SearchOptions { max_depth: 3, max_nodes: 0, contexts: 1 }).unwrap();
    assert!(result.cancelled && result.solution.is_none());
    assert_eq!(result.completed_depth, Some(0));
    assert_eq!((result.stats.probes, result.stats.lookahead_attempts, result.stats.lookahead_probes), (2, 1, 0));
    assert_eq!(oracle.prepares.get(), 3);
}

#[cfg(all(test, feature = "opt10-native-projection", not(target_family = "wasm")))]
#[test]
fn projection_matches_all_radius_three_distances_with_two_real_co_bounds() {
    use std::cell::Cell;
    fn orientation(cube: &Cube) -> usize {
        cube.corners[..7].iter().rev().fold(0, |n, &corner| n * 3 + usize::from(corner >> 3))
    }
    let mut co = [u8::MAX; 2187];
    let mut queue = std::collections::VecDeque::from([Cube::SOLVED]);
    co[0] = 0;
    while let Some(cube) = queue.pop_front() {
        let next = co[orientation(&cube)] + 1;
        for movement in 0..18 {
            let child = cube.moved(movement);
            let key = orientation(&child);
            if co[key] == u8::MAX { co[key] = next; queue.push_back(child); }
        }
    }
    struct Oracle<'a> {
        co: &'a [u8; 2187], weakened: bool, enabled: bool, early: bool,
        selected: Cell<u64>, reads: Cell<u64>, all_reads: Cell<u64>,
    }
    impl Oracle<'_> {
        fn bound(&self, cube: &Cube, alternative: bool) -> u8 {
            let exact = self.co[orientation(cube)];
            // Both are legitimate left-H-invariant weakenings of exact CO.
            // They discard different information and neither may overestimate.
            if self.weakened && cube.corners[usize::from(alternative)] >> 3 != 0 {
                exact.saturating_sub(1)
            } else { exact }
        }
    }
    impl PruningOracle for Oracle<'_> {
        type Query = (u8, bool);
        fn prepare(&self, cube: &Cube, remaining: u8) -> Result<Self::Query, u8> {
            let bound = self.bound(cube, false);
            if self.early && bound > remaining { Err(bound) } else { Ok((bound, false)) }
        }
        fn lookup(&self, (bound, extra): Self::Query) -> u8 {
            self.all_reads.set(self.all_reads.get() + 1);
            if extra { self.reads.set(self.reads.get() + 1); }
            bound
        }
        fn max_bound(&self) -> u8 { 13 }
        fn allow_parent_propagation(&self) -> bool { true }
        fn allow_quarter_pruning(&self) -> bool { true }
        fn allow_backward_coset(&self) -> bool { true }
        fn alternative_query(&self, cube: &Cube, original: Self::Query, remaining: u8, normal: u8) -> Option<Self::Query> {
            assert_eq!(original, (self.bound(cube, false), false));
            assert_eq!(normal, original.0);
            if !self.enabled || normal != remaining { return None; }
            let bound = self.bound(cube, true);
            assert!(bound.max(normal) <= self.co[orientation(cube)]);
            self.selected.set(self.selected.get() + 1);
            Some((bound, true))
        }
    }
    let distances = ball(Cube::SOLVED);
    assert_eq!(distances.len(), 3502);
    let mut totals = [0_u64; 5];
    let mut nodes = [[0_u64; 2]; 2];
    for (state, distance) in distances {
        let start = Cube::from_bytes(&state).unwrap();
        for weakened in [false, true] { for contexts in [1, 8] { for early in [false, true] {
            let mut baseline = None;
            for enabled in [false, true] {
                let oracle = Oracle { co: &co, weakened, enabled, early,
                    selected: Cell::new(0), reads: Cell::new(0), all_reads: Cell::new(0) };
                for alternative in [false, true] {
                    assert!(oracle.bound(&start, alternative) <= distance);
                    for half in (1..18).step_by(3) {
                        assert_eq!(oracle.bound(&MOVES[half].multiplied(&start), alternative), oracle.bound(&start, alternative));
                    }
                }
                let result = solve(start, &oracle, SearchOptions { max_depth: 3, max_nodes: 0, contexts }).unwrap();
                assert!(!result.cancelled);
                assert_eq!(result.completed_depth, distance.checked_sub(1));
                let solution = result.solution.unwrap();
                assert_eq!(solution.len(), usize::from(distance));
                assert!(solution.iter().fold(start, |cube, &movement| cube.moved(movement)).is_solved());
                assert_eq!(result.stats.probes, oracle.all_reads.get());
                assert_eq!(result.stats.projection_attempts, oracle.selected.get());
                assert_eq!(result.stats.projection_probes, oracle.reads.get());
                assert_eq!(result.stats.projection_attempts, result.stats.projection_probes);
                assert_eq!(result.stats.projection_raises, result.stats.projection_rejects);
                if !weakened {
                    assert_eq!((result.stats.projection_raises, result.stats.projection_rejects), (0, 0));
                    let mut normalized = result.stats;
                    normalized.probes -= normalized.projection_probes;
                    normalized.projection_attempts = 0;
                    normalized.projection_probes = 0;
                    if let Some(before) = &baseline { assert_eq!(&(solution, normalized), before); }
                    else { baseline = Some((solution, normalized)); }
                }
                nodes[usize::from(weakened)][usize::from(enabled)] += result.stats.nodes;
                totals[0] += result.stats.projection_attempts;
                totals[1] += result.stats.projection_probes;
                totals[2] += result.stats.projection_raises;
                totals[3] += result.stats.projection_rejects;
                totals[4] += result.stats.splits + result.stats.cache_reuses;
            }
        } } }
    }
    assert!(totals.iter().all(|&count| count > 0), "genuine projection coverage: {totals:?}");
    println!("projection: bfsStates=3502 searches=56032 attempts/probes/raises/rejects/splitCache={totals:?} nodesExact={:?} nodesWeakened={:?} pdbBytes=0", nodes[0], nodes[1]);
}

#[cfg(all(test, feature = "opt10-native-projection", not(target_family = "wasm")))]
#[test]
fn projection_zero_merge_niss_cache_and_cancellation_boundaries() {
    // These sentinels isolate certificate transport; admissibility is checked
    // against true cube distances by the complete CO fixture above.
    let mut frame = Frame::root(Cube::from_scramble("R F U").unwrap());
    frame.normal_bound = 2;
    let mut excess = 0;
    let mut stats = SearchStats::default();
    merge_projection_bound(&mut frame, 4, 0, &mut excess, &mut stats);
    assert_eq!((frame.normal_bound, excess, stats.projection_raises), (2, 0, 0));
    frame.inverse_mask = 1 << 1;
    merge_projection_bound(&mut frame, 4, 3, &mut excess, &mut stats);
    frame.plan(4, 13);
    assert!(frame.side);
    assert_eq!(frame.inverse_bound, 3);
    let child = frame.child();
    assert!(child.cached_inverse);
    assert_eq!(child.inverse_bound, 3);

    use std::cell::Cell;
    struct CancelOnProjection { prepares: Cell<u8>, stopped: Cell<bool> }
    impl PruningOracle for CancelOnProjection {
        type Query = ();
        fn prepare(&self, _: &Cube, _: u8) -> Result<(), u8> {
            self.prepares.set(self.prepares.get() + 1); Ok(())
        }
        fn lookup(&self, _: ()) -> u8 { 0 }
        fn cancelled(&self) -> bool { self.stopped.get() }
        fn alternative_query(&self, _: &Cube, _: (), remaining: u8, _: u8) -> Option<()> {
            assert_eq!(remaining, 1);
            self.stopped.set(true);
            Some(())
        }
    }
    let oracle = CancelOnProjection { prepares: Cell::new(0), stopped: Cell::new(false) };
    let result = solve(Cube::from_scramble("R").unwrap(), &oracle,
        SearchOptions { max_depth: 3, max_nodes: 0, contexts: 1 }).unwrap();
    assert!(result.cancelled && result.solution.is_none());
    assert_eq!(result.completed_depth, Some(0));
    assert_eq!((result.stats.probes, result.stats.projection_attempts, result.stats.projection_probes), (2, 1, 0));
    assert_eq!(oracle.prepares.get(), 2);
}

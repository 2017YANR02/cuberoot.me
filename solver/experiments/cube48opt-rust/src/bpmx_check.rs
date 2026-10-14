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
    let mut queue = PrefixQueue { jobs: vec![PrefixJob { moves: [0;4], len: 1, weight: 0 }; 18], next: 18, shard: None };
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
    ], next: 0, shard: None };
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
            let h = exact_distance(before.last().unwrap().cube, &solved)?;
            require(usize::from(h) == length, "short path fixture is not the asserted exact distance")?;
            let remaining = 1;
            let excess = h - remaining;
            require((3..=5).contains(&excess), "real fixture misses new BPMX thresholds")?;
            let extra = usize::from((excess - 1) / 2);
            for up in 1..=extra {
                let ancestor = &before[before.len() - 1 - up];
                let exact = exact_distance(ancestor.cube, &solved)?;
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

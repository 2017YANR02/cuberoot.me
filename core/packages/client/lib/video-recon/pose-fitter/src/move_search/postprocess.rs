//! Color-checked removal of closed state walks after a solution is found.
//! The ordering DAG represents every order obtainable by swapping simultaneous
//! moves on disjoint slabs. Noncommuting moves keep their recorded order.
use super::{
    cube::{Group, Tables},
    frontier,
    prepared::{Geometry, Prepared, COLORS},
    Config,
};
use serde_json::{json, Value};
use std::collections::HashMap;
mod normalize;

const EPS: f64 = 1e-12;
#[derive(Clone, Copy, Debug)]
struct MoveRef {
    frame: usize,
    index: usize,
}
struct Node {
    frame: usize,
    rank: usize,
    mask: Vec<u64>,
    state: Vec<u8>,
    edges: Vec<(usize, Option<MoveRef>)>,
}
#[derive(Clone, Copy, Default)]
struct Best {
    removed: usize,
    sections: usize,
}
#[derive(Clone, Copy)]
enum Link {
    Move { from: usize, token: Option<MoveRef> },
    Loop { from: usize },
}
struct Observation<'a> {
    geometry: Option<&'a Geometry>,
    alternatives: Vec<&'a Geometry>,
    state: Vec<u8>,
    original: Option<f64>,
}
fn held<'a>(
    t: &Tables,
    observed: &Observation<'a>,
    state: &[u8],
    colors: &[usize],
) -> (Option<&'a Geometry>, Option<f64>) {
    let mut geometry = observed.geometry;
    let mut error = color(t, geometry, state, colors);
    if state != observed.state {
        for &candidate in &observed.alternatives {
            let next = color(t, Some(candidate), state, colors);
            if next.zip(error).is_some_and(|(next, old)| next + EPS < old) {
                geometry = Some(candidate);
                error = next;
            }
        }
    }
    (geometry, error)
}
#[derive(Clone, Copy, Default)]
struct ColorPrefix {
    delta: f64,
    original: f64,
    count: usize,
    invalid: usize,
}

fn subset(a: &[u64], b: &[u64]) -> bool {
    a.iter().zip(b).all(|(a, b)| a & !b == 0)
}
fn contains(mask: &[u64], index: usize) -> bool {
    mask.get(index / 64)
        .is_some_and(|word| word & (1 << (index % 64)) != 0)
}
fn independent(a: Option<&Group>, b: Option<&Group>) -> bool {
    a.zip(b).is_some_and(|(a, b)| {
        a.axis == b.axis && (0..3).all(|i| a.offsets[i] == 0 || b.offsets[i] == 0)
    })
}
fn better(a: Best, b: Option<Best>) -> bool {
    b.is_none_or(|b| a.removed > b.removed || a.removed == b.removed && a.sections < b.sections)
}
fn cleaned_step_changed(original: &Value, step: &serde_json::Map<String, Value>) -> bool {
    [
        "state_moves",
        "geometry_option_index",
        "orientation_symmetry_index",
    ]
    .iter()
    .any(|key| original.get(*key) != step.get(*key))
}
fn apply(t: &Tables, state: &[u8], name: &str) -> Result<Vec<u8>, String> {
    let perm = t
        .moves
        .get(name)
        .ok_or_else(|| format!("Unknown solution move: {name}"))?;
    Ok(perm.iter().map(|&i| state[i]).collect())
}
fn simplify_frame(t: &Tables, names: Vec<String>) -> Vec<String> {
    let groups: Option<Vec<_>> = names
        .iter()
        .map(|name| {
            t.groups
                .iter()
                .find(|g| g.sources == t.moves[name])
                .map(|g| g.group.clone())
        })
        .collect();
    let Some(groups) = groups else {
        return names;
    };
    let normalized = super::cube::normalize(&groups);
    let (_, shorter) = t.permutation(&normalized);
    if shorter.len() < names.len() {
        shorter
    } else {
        names
    }
}
fn color(t: &Tables, g: Option<&Geometry>, state: &[u8], colors: &[usize]) -> Option<f64> {
    g.filter(|g| !g.observations.is_empty())
        .map(|g| frontier::color(t, g, state, colors).0)
}
fn selected_geometry<'a>(p: &'a Prepared, step: &Value) -> Result<Option<&'a Geometry>, String> {
    if p.held {
        return Ok(None);
    }
    let bank = step["geometry_option_index"]
        .as_u64()
        .ok_or("Solution step has no fitted geometry")? as usize;
    let symmetry = step["orientation_symmetry_index"]
        .as_u64()
        .map(|s| s as usize)
        .unwrap_or(super::orientations::tables().identity_index);
    p.geometries
        .iter()
        .find(|g| g.bank_index == bank && g.symmetry == symmetry)
        .map(Some)
        .ok_or_else(|| format!("Unknown solution geometry at frame {}", p.frame))
}
fn removed_tokens(nodes: &[Node], from: usize, to: usize, moves: &[Vec<String>]) -> Vec<MoveRef> {
    let a = &nodes[from];
    let b = &nodes[to];
    let mut result = vec![];
    for frame in a.frame..=b.frame {
        for index in 0..moves[frame].len() {
            let after_start = frame != a.frame || !contains(&a.mask, index);
            let before_end = frame != b.frame || contains(&b.mask, index);
            if after_start && before_end {
                result.push(MoveRef { frame, index });
            }
        }
    }
    result
}

pub(super) fn clean(
    t: &Tables,
    c: &Config,
    frames: &[Prepared],
    mut result: Value,
) -> Result<Value, String> {
    if !matches!(result["status"].as_str(), Some("solved" | "already_solved")) {
        return Err("Postprocessing requires a solved result".into());
    }
    if result["postprocess"]["removed_moves"].as_u64().unwrap_or(0) > 0
        && result.get("unprocessed_steps").is_none()
    {
        return Err("Reprocessing requires the original unprocessed_steps".into());
    }
    let raw_original = result
        .get("unprocessed_steps")
        .unwrap_or(&result["steps"])
        .as_array()
        .ok_or("Solution has no frame steps")?
        .clone();
    let original = if c.postprocess_pose_cleanup {
        normalize::normalize(t, &raw_original)?
    } else {
        raw_original.clone()
    };
    let normalized = original != raw_original;
    let mut moves = vec![];
    for step in &original {
        moves.push(
            step["state_moves"]
                .as_array()
                .ok_or("Solution step has no moves")?
                .iter()
                .map(|name| {
                    name.as_str()
                        .map(String::from)
                        .ok_or_else(|| "Invalid solution move".to_string())
                })
                .collect::<Result<Vec<_>, _>>()?,
        );
    }
    let color_names = t.colors(&c.scramble)?;
    let colors: Vec<_> = color_names
        .iter()
        .map(|name| COLORS.iter().position(|v| v == name).unwrap())
        .collect();
    let mut state = t.identity.clone();
    let mut observations = vec![];
    let mut last_frame = None;
    for (step, names) in original.iter().zip(&moves) {
        let frame = step["frame_index"]
            .as_u64()
            .ok_or("Invalid solution frame")? as usize;
        if last_frame.is_some_and(|previous| frame <= previous) {
            return Err("Solution frames must increase".into());
        }
        last_frame = Some(frame);
        let index = frames
            .binary_search_by_key(&frame, |p| p.frame)
            .map_err(|_| "Solution frame has no fitted input")?;
        let geometry = selected_geometry(&frames[index], step)?;
        for name in names {
            state = apply(t, &state, name)?;
        }
        observations.push(Observation {
            geometry,
            alternatives: if c.postprocess_pose_cleanup {
                geometry
                    .map(|old| {
                        frames[index]
                            .geometries
                            .iter()
                            .filter(|g| g.score <= old.score + EPS && !g.observations.is_empty())
                            .collect()
                    })
                    .unwrap_or_default()
            } else {
                vec![]
            },
            state: state.clone(),
            original: color(t, geometry, &state, &colors),
        });
    }
    if !t.solved(&state, &color_names) {
        return Err("Input solution does not solve the cube".into());
    }
    let final_state = state;

    // A prefix is a down-set of the noncommuting-token precedence relation.
    // Prefixes reached in different commuting orders share a node, avoiding a
    // Cartesian product of full-solution orderings.
    let mut groups = HashMap::new();
    for name in moves.iter().flatten() {
        groups.entry(name.clone()).or_insert_with(|| {
            t.groups
                .iter()
                .find(|g| g.sources == t.moves[name])
                .map(|g| g.group.clone())
        });
    }
    let mut nodes = vec![Node {
        frame: 0,
        rank: 0,
        mask: vec![],
        state: t.identity.clone(),
        edges: vec![],
    }];
    let mut end = 0;
    let mut offset = 0;
    let mut simultaneous_frames = 0;
    for (frame, names) in moves.iter().enumerate() {
        let words = names.len().div_ceil(64);
        let mut predecessors = vec![vec![0_u64; words]; names.len()];
        let mut can_reorder = false;
        for j in 0..names.len() {
            for i in 0..j {
                if independent(groups[&names[i]].as_ref(), groups[&names[j]].as_ref()) {
                    can_reorder = true;
                } else {
                    predecessors[j][i / 64] |= 1 << (i % 64);
                }
            }
        }
        simultaneous_frames += usize::from(can_reorder);
        let root = nodes.len();
        let before = nodes[end].state.clone();
        nodes[end].edges.push((root, None));
        nodes.push(Node {
            frame,
            rank: offset,
            mask: vec![0; words],
            state: before,
            edges: vec![],
        });
        let mut local = HashMap::from([(vec![0_u64; words], root)]);
        let mut queue = vec![root];
        let mut cursor = 0;
        while cursor < queue.len() {
            let id = queue[cursor];
            cursor += 1;
            let mask = nodes[id].mask.clone();
            let state = nodes[id].state.clone();
            for index in 0..names.len() {
                if contains(&mask, index) || !subset(&predecessors[index], &mask) {
                    continue;
                }
                let mut next = mask.clone();
                next[index / 64] |= 1 << (index % 64);
                let successor = apply(t, &state, &names[index])?;
                let child = if let Some(&child) = local.get(&next) {
                    debug_assert_eq!(nodes[child].state, successor);
                    child
                } else {
                    let child = nodes.len();
                    local.insert(next.clone(), child);
                    queue.push(child);
                    nodes.push(Node {
                        frame,
                        rank: offset + next.iter().map(|v| v.count_ones() as usize).sum::<usize>(),
                        mask: next,
                        state: successor,
                        edges: vec![],
                    });
                    child
                };
                nodes[id]
                    .edges
                    .push((child, Some(MoveRef { frame, index })));
            }
        }
        offset += names.len();
        end = *queue.last().unwrap();
    }
    let mut best = vec![None; nodes.len()];
    let mut parents = vec![None; nodes.len()];
    best[0] = Some(Best::default());
    let mut seen: HashMap<Vec<u8>, Vec<usize>> = HashMap::new();
    let mut averages: HashMap<Vec<u8>, Vec<ColorPrefix>> = HashMap::new();
    let mut checked = 0;
    let mut rejected_sections = vec![];
    let mut color_evaluations = 0;
    for to in 0..nodes.len() {
        let b = &nodes[to];
        // A segment starts immediately before a removed token and ends just
        // after one. Bridge/empty-frame nodes must not pad its average with
        // unchanged frames before or after the actual closed move sequence.
        if let Some(starts) = seen
            .get(&b.state)
            .filter(|_| b.mask.iter().any(|&word| word != 0))
        {
            for &from in starts {
                let a = &nodes[from];
                if a.rank >= b.rank || a.frame == b.frame && !subset(&a.mask, &b.mask) {
                    continue;
                }
                let Some(score) = best[from] else {
                    continue;
                };
                checked += 1;
                let prefix = averages.entry(a.state.clone()).or_insert_with(|| {
                    let mut prefix = vec![ColorPrefix::default()];
                    for observed in &observations {
                        let delta = held(t, observed, &a.state, &colors)
                            .1
                            .zip(observed.original)
                            .map(|(held, old)| held - old);
                        color_evaluations += usize::from(delta.is_some());
                        let mut next = *prefix.last().unwrap();
                        if let Some(delta) = delta {
                            next.count += 1;
                            if delta.is_finite() {
                                next.delta += delta;
                                next.original += observed.original.unwrap();
                            } else {
                                next.invalid += 1;
                            }
                        }
                        prefix.push(next);
                    }
                    prefix
                });
                // Include both endpoint frames. At the exit, the kept suffix
                // restores the original after-frame state: zero error increase.
                let first = prefix[a.frame];
                let last = prefix[b.frame];
                let exit_original = observations[b.frame].original;
                let count = last.count - first.count + usize::from(exit_original.is_some());
                if last.invalid != first.invalid
                    || last.delta - first.delta
                        > (c.postprocess_color_tolerance + EPS) * count as f64
                {
                    if c.diagnostics {
                        let mean = (last.delta - first.delta) / count.max(1) as f64;
                        let original_mean = (last.original - first.original
                            + exit_original.unwrap_or(0.))
                            / count.max(1) as f64;
                        let tokens = removed_tokens(&nodes, from, to, &moves);
                        rejected_sections.push(json!({"start_frame":original[a.frame]["frame_index"],
                            "end_frame":original[b.frame]["frame_index"],
                            "removed_moves":tokens.iter().map(|r| &moves[r.frame][r.index]).collect::<Vec<_>>(),
                            "scored_frames":count,"mean_color_increase":mean,
                            "original_mean_color_error":original_mean,"held_mean_color_error":original_mean+mean}));
                    }
                    continue;
                }
                let candidate = Best {
                    removed: score.removed + b.rank - a.rank,
                    sections: score.sections + 1,
                };
                if better(candidate, best[to]) {
                    best[to] = Some(candidate);
                    parents[to] = Some(Link::Loop { from });
                }
            }
        }
        if let Some(score) = best[to] {
            for &(child, token) in &b.edges {
                if better(score, best[child]) {
                    best[child] = Some(score);
                    parents[child] = Some(Link::Move { from: to, token });
                }
            }
        }
        if b.edges.iter().any(|(_, token)| token.is_some()) {
            seen.entry(b.state.clone()).or_default().push(to);
        }
    }
    let best = best[end].ok_or("Could not traverse solution orderings")?;
    let mut kept = vec![vec![]; moves.len()];
    let mut loops = vec![];
    let mut id = end;
    while let Some(link) = parents[id] {
        match link {
            Link::Move { from, token } => {
                if let Some(token) = token {
                    kept[token.frame].push(token.index);
                }
                id = from;
            }
            Link::Loop { from } => {
                loops.push((from, id));
                id = from;
            }
        }
    }
    for names in &mut kept {
        names.reverse();
    }
    loops.reverse();
    // A half-turn is atomic in the ordering DAG. Reduce same-frame layer
    // algebra too: R' R2 is R, with identical state at every observed frame.
    let replay_moves: Vec<_> = kept
        .iter()
        .enumerate()
        .map(|(frame, indices)| {
            simplify_frame(
                t,
                indices.iter().map(|&i| moves[frame][i].clone()).collect(),
            )
        })
        .collect();
    let moves_after: usize = replay_moves.iter().map(Vec::len).sum();
    let simplified_moves = offset - best.removed - moves_after;
    let simplified_frames = kept
        .iter()
        .zip(&replay_moves)
        .filter(|(indices, names)| indices.len() > names.len())
        .count();
    let mut cleaned = original.clone();
    let mut state = t.identity.clone();
    let mut deltas = vec![];
    let mut geometry_changes = 0;
    for (frame, names) in replay_moves.iter().enumerate() {
        for name in names {
            state = apply(t, &state, name)?;
        }
        let observed = &observations[frame];
        let (geometry, error) = held(t, observed, &state, &colors);
        let delta = error.zip(observed.original).map(|(held, old)| held - old);
        if delta.is_some_and(|v| !v.is_finite()) {
            return Err("Combined loop removal has a nonfinite color score".into());
        }
        deltas.push(delta);
        if best.removed == 0 && !normalized && simplified_moves == 0 {
            continue;
        }
        let step = cleaned[frame].as_object_mut().unwrap();
        // Search rankings describe the original queue, not the cleaned path.
        for key in [
            "queue_priority",
            "sibling_rank",
            "branch_cutoff_bypassed",
            "window_mismatch_rate",
            "window_mismatch_penalty",
            "recent_motion_penalty",
            "required_tps_ratio",
        ] {
            step.remove(key);
        }
        let geometry_changed = geometry
            .zip(observed.geometry)
            .is_some_and(|(a, b)| a.index != b.index);
        geometry_changes += usize::from(geometry_changed);
        if let Some(g) = geometry.filter(|_| geometry_changed) {
            step.insert("geometry_option_index".into(), json!(g.bank_index));
            if g.symmetry == super::orientations::tables().identity_index {
                step.remove("orientation_symmetry_index");
            } else {
                step.insert("orientation_symmetry_index".into(), json!(g.symmetry));
            }
        }
        if *names != moves[frame]
            || geometry_changed
            || cleaned_step_changed(&raw_original[frame], step)
        {
            step.insert("state_moves".into(), json!(names));
            step.insert("postprocessed".into(), true.into());
            for key in [
                "angular_travel_degrees",
                "rotation_budget_degrees",
                "rotation_budget",
                "cube_rotation_motion",
                "cube_rotation_budget_degrees",
            ] {
                step.remove(key);
            }
        }
        if c.diagnostics {
            if let Some(g) = geometry {
                let (error, correct, confused, forbidden) = frontier::color(t, g, &state, &colors);
                if error.is_finite() {
                    step.insert("color_error".into(), error.into());
                    step.insert("state_score".into(), (0.5 * g.score + 0.5 * error).into());
                    for (key, value) in [
                        ("color_correct_count", correct),
                        ("color_confusion_count", confused),
                        ("color_forbidden_count", forbidden),
                        ("color_match_count", correct + confused + forbidden),
                    ] {
                        step.insert(key.into(), value.into());
                    }
                }
            }
        }
    }
    if state != final_state {
        return Err("Loop removal changed the final cube state".into());
    }
    let mut sections = vec![];
    let mut max_segment_mean_color_increase = 0_f64;
    for (from, to) in &loops {
        let tokens = removed_tokens(&nodes, *from, *to, &moves);
        if tokens.len() != nodes[*to].rank - nodes[*from].rank {
            return Err("Invalid closed-section ordering".into());
        }
        let mut state = nodes[*from].state.clone();
        for token in &tokens {
            state = apply(t, &state, &moves[token.frame][token.index])?;
        }
        if state != nodes[*to].state {
            return Err("Removed section is not an identity".into());
        }
        let range = nodes[*from].frame..=nodes[*to].frame;
        let scored: Vec<_> = range
            .filter_map(|i| deltas[i].map(|delta| (delta, observations[i].original.unwrap())))
            .collect();
        let count = scored.len();
        let mean_increase =
            scored.iter().map(|(delta, _)| delta).sum::<f64>() / count.max(1) as f64;
        let original_mean = scored.iter().map(|(_, old)| old).sum::<f64>() / count.max(1) as f64;
        if mean_increase > c.postprocess_color_tolerance + EPS {
            return Err("Combined loop removal exceeds the segment mean color tolerance".into());
        }
        max_segment_mean_color_increase = max_segment_mean_color_increase.max(mean_increase);
        if c.diagnostics {
            let first = tokens.first().unwrap().frame;
            let last = tokens.last().unwrap().frame;
            sections.push(json!({"start_frame":original[first]["frame_index"],"end_frame":original[last]["frame_index"],
                "removed_moves":tokens.iter().map(|r|&moves[r.frame][r.index]).collect::<Vec<_>>(),
                "scored_frames":count,"original_mean_color_error":original_mean,
                "held_mean_color_error":original_mean+mean_increase,"mean_color_increase":mean_increase,
                "max_color_increase":scored.iter().map(|(delta, _)| *delta).fold(0.,f64::max)}));
        }
    }
    result.as_object_mut().unwrap().remove("unprocessed_steps");
    if (best.removed > 0 || normalized || simplified_moves > 0) && c.diagnostics {
        result["unprocessed_steps"] = json!(raw_original);
    }
    result["steps"] = json!(cleaned);
    result["postprocess"] = json!({"enabled":true,"color_tolerance":c.postprocess_color_tolerance,"color_aggregation":"segment_mean",
        "pose_cleanup":c.postprocess_pose_cleanup,"center_frame_normalized":normalized,"reselected_geometries":geometry_changes,
        "raw_moves_before":raw_original.iter().filter_map(|s| s["state_moves"].as_array()).map(Vec::len).sum::<usize>(),
        "moves_before":offset,"moves_after":moves_after,"removed_moves":best.removed+simplified_moves,
        "simplified_moves":simplified_moves,"simplified_frames":simplified_frames,
        "removed_sections":best.sections,"candidate_sections":checked,"ordering_states":nodes.len(),
        "simultaneous_frames":simultaneous_frames,"color_evaluations":color_evaluations,
        "max_segment_mean_color_increase":max_segment_mean_color_increase,
        "max_color_increase":deltas.iter().flatten().copied().fold(0.,f64::max)});
    if c.diagnostics {
        result["postprocess"]["sections"] = json!(sections);
        result["postprocess"]["rejected_sections"] = json!(rejected_sections);
    }
    Ok(result)
}

#[cfg(test)]
mod tests;

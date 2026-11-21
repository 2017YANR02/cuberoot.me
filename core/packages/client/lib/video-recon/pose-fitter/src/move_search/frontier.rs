use super::{
    cube::Tables,
    motion_history::{required_tps_ratio, MotionHistory},
    prepared::{Geometry, Prepared, Row, RowBatch, COLORS},
    Config,
};
use serde::Serialize;
use std::{
    cmp::Ordering,
    collections::{BinaryHeap, HashMap, HashSet},
    sync::Arc,
};

#[derive(Clone, Debug, Serialize)]
pub struct Step {
    pub frame_index: usize,
    pub geometry_option_index: Option<usize>,
    pub previous_geometry_index: Option<usize>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub orientation_symmetry_index: Option<u8>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cube_rotation_motion: Option<super::motion::Motion>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cube_rotation_budget_degrees: Option<f64>,
    pub state_moves: Vec<String>,
    pub state_score: f64,
    pub color_error: f64,
    pub color_match_count: usize,
    pub color_correct_count: usize,
    pub color_confusion_count: usize,
    pub color_forbidden_count: usize,
    pub angular_travel_degrees: f64,
    pub rotation_budget_degrees: f64,
    pub rotation_budget: bool,
    pub sibling_rank: usize,
    pub branch_cutoff_bypassed: bool,
    pub pose_flagged: bool,
    pub queue_priority: f64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub recent_motion_penalty: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub required_tps_ratio: Option<f64>,
    pub window_mismatch_rate: Option<f64>,
    pub window_mismatch_penalty: f64,
}
impl Step {
    pub(super) fn hold(frame: usize, cue: Option<usize>) -> Self {
        Self {
            frame_index: frame,
            geometry_option_index: cue,
            previous_geometry_index: cue,
            orientation_symmetry_index: None,
            cube_rotation_motion: None,
            cube_rotation_budget_degrees: None,
            state_moves: vec![],
            state_score: 0.,
            color_error: 0.,
            color_match_count: 0,
            color_correct_count: 0,
            color_confusion_count: 0,
            color_forbidden_count: 0,
            angular_travel_degrees: 0.,
            rotation_budget_degrees: 0.,
            rotation_budget: true,
            sibling_rank: 1,
            branch_cutoff_bypassed: false,
            pose_flagged: false,
            queue_priority: 0.,
            recent_motion_penalty: None,
            required_tps_ratio: None,
            window_mismatch_rate: None,
            window_mismatch_penalty: 0.,
        }
    }
}
// Search keeps the reconstruction path even when optional diagnostics are off.
#[derive(Serialize)]
pub(super) struct EssentialStep {
    frame_index: usize,
    geometry_option_index: Option<usize>,
    previous_geometry_index: Option<usize>,
    #[serde(skip_serializing_if = "Option::is_none")]
    orientation_symmetry_index: Option<u8>,
    state_moves: Vec<String>,
    pose_flagged: bool,
}
#[derive(Clone)]
pub(super) enum SavedStep {
    Detailed(Arc<Step>),
    Essential(Arc<EssentialStep>),
}
impl SavedStep {
    pub(super) fn frame_index(&self) -> usize {
        match self {
            Self::Detailed(step) => step.frame_index,
            Self::Essential(step) => step.frame_index,
        }
    }
    pub(super) fn new(step: Step, diagnostics: bool) -> Self {
        if diagnostics {
            Self::Detailed(Arc::new(step))
        } else {
            Self::Essential(Arc::new(EssentialStep {
                frame_index: step.frame_index,
                geometry_option_index: step.geometry_option_index,
                previous_geometry_index: step.previous_geometry_index,
                orientation_symmetry_index: step.orientation_symmetry_index,
                state_moves: step.state_moves,
                pose_flagged: step.pose_flagged,
            }))
        }
    }
    #[cfg(test)]
    fn detailed(&self) -> &Step {
        match self {
            Self::Detailed(step) => step,
            Self::Essential(_) => panic!("Step diagnostics are disabled"),
        }
    }
}
impl Serialize for SavedStep {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        match self {
            Self::Detailed(step) => step.as_ref().serialize(serializer),
            Self::Essential(step) => step.as_ref().serialize(serializer),
        }
    }
}
#[derive(Clone)]
pub struct Choice {
    pub state: Vec<u8>,
    pub cue: Option<usize>,
    pub step: Step,
    pub rank: [f64; 4],
}
fn color_at(
    g: &Geometry,
    state: &[u8],
    colors: &[usize],
    position: impl Fn(usize) -> usize,
) -> (f64, usize, usize, usize) {
    let (mut correct, mut confused, mut forbidden) = (0, 0, 0);
    for (face, costs) in &g.observations {
        let expected = colors[state[position(*face)] as usize];
        if costs[expected] == 0. {
            correct += 1;
        } else if costs[expected] < 1. {
            confused += 1;
        } else {
            forbidden += 1;
        }
    }
    let total = correct + confused + forbidden;
    let error = if total > 0 {
        (0.5 * confused as f64 + forbidden as f64) / total as f64
    } else if g.signature.is_empty() {
        0.
    } else {
        f64::INFINITY
    };
    (error, correct, confused, forbidden)
}
pub(super) fn color(t: &Tables, g: &Geometry, state: &[u8], colors: &[usize]) -> (f64, usize, usize, usize) {
    color_at(g, state, colors, |face| t.geometry_positions[face])
}

// Sorting these descriptors never moves a cube state or clones move strings.
struct ScoredChoice {
    batch: usize,
    row: usize,
    rank: [f64; 4],
    error: f64,
    correct: usize,
    confused: usize,
    forbidden: usize,
}
impl ScoredChoice {
    fn match_count(&self) -> usize {
        self.correct + self.confused + self.forbidden
    }
}
struct ScoredChoices<'a> {
    frame: &'a Prepared,
    incoming_cue: Option<usize>,
    dynamic: Vec<Arc<RowBatch>>,
    candidates: Vec<ScoredChoice>,
}
impl ScoredChoices<'_> {
    fn row(&self, choice: &ScoredChoice) -> Option<&Row> {
        if self.frame.held {
            None
        } else if self.frame.resolve_orientation {
            Some(&self.dynamic[choice.batch].rows[choice.row])
        } else {
            Some(&self.frame.rows[choice.row])
        }
    }
    fn cue(&self, choice: &ScoredChoice) -> Option<usize> {
        self.row(choice).map(|r| r.after).or(self.incoming_cue)
    }
    fn state(&self, choice: &ScoredChoice, state: &[u8]) -> Vec<u8> {
        match self.row(choice) {
            Some(row) => row.sources.iter().map(|&i| state[i]).collect(),
            None => state.to_vec(),
        }
    }
    fn moves(&self, choice: &ScoredChoice) -> &[String] {
        self.row(choice).map_or(&[], |row| row.moves.as_slice())
    }
    fn essential_step(&self, choice: &ScoredChoice, flagged: bool) -> EssentialStep {
        let row = self.row(choice);
        let g = row.and_then(|r| self.frame.geometry(r.after));
        EssentialStep {
            frame_index: self.frame.frame,
            geometry_option_index: g.map(|g| g.bank_index).or(self.incoming_cue),
            previous_geometry_index: row.map_or(self.incoming_cue, |r| r.before),
            orientation_symmetry_index: g.and_then(|g| {
                (g.symmetry != super::orientations::tables().identity_index)
                    .then_some(g.symmetry as u8)
            }),
            state_moves: self.moves(choice).to_vec(),
            pose_flagged: flagged,
        }
    }
    fn step(&self, choice: &ScoredChoice) -> Step {
        let p = self.frame;
        let Some(row) = self.row(choice) else {
            return Step::hold(p.frame, self.incoming_cue);
        };
        let g = p.geometry(row.after).unwrap();
        Step {
            frame_index: p.frame,
            geometry_option_index: Some(g.bank_index),
            previous_geometry_index: row.before,
            orientation_symmetry_index: (g.symmetry
                != super::orientations::tables().identity_index)
                .then_some(g.symmetry as u8),
            cube_rotation_motion: row.motion,
            cube_rotation_budget_degrees: p.rotation_limit,
            state_moves: row.moves.as_ref().clone(),
            state_score: choice.rank[0],
            color_error: choice.error,
            color_match_count: choice.match_count(),
            color_correct_count: choice.correct,
            color_confusion_count: choice.confused,
            color_forbidden_count: choice.forbidden,
            angular_travel_degrees: row.degrees,
            rotation_budget_degrees: row.budget,
            rotation_budget: true,
            sibling_rank: 0,
            branch_cutoff_bypassed: false,
            pose_flagged: p.flagged,
            queue_priority: 0.,
            recent_motion_penalty: None,
            required_tps_ratio: None,
            window_mismatch_rate: None,
            window_mismatch_penalty: 0.,
        }
    }
}
fn score_choices<'a>(
    t: &Tables,
    p: &'a Prepared,
    state: &[u8],
    cue: Option<usize>,
    colors: &[usize],
) -> ScoredChoices<'a> {
    if p.held {
        return ScoredChoices {
            frame: p,
            incoming_cue: cue,
            dynamic: vec![],
            candidates: vec![ScoredChoice {
                batch: 0,
                row: 0,
                rank: [0.; 4],
                error: 0.,
                correct: 0,
                confused: 0,
                forbidden: 0,
            }],
        };
    }
    let mut result: Vec<ScoredChoice> = vec![];
    let mut dynamic = vec![];
    if p.resolve_orientation {
        if let Some((_, prior, _)) = p.orientation_parents.get(&cue) {
            for base in p.geometries.iter().filter(|g| g.index < 6) {
                let mut endpoints = vec![base.index];
                if prior.is_none_or(|r| super::orientations::angle(r, base.rotation) > 45.) {
                    let variants: Vec<_> = p
                        .geometries
                        .iter()
                        .filter(|g| g.bank_index == base.bank_index)
                        .collect();
                    if let Some(prior) = prior {
                        let closest = variants
                            .iter()
                            .min_by(|a, b| {
                                super::orientations::similarity(*prior, b.rotation)
                                    .total_cmp(&super::orientations::similarity(*prior, a.rotation))
                            })
                            .unwrap();
                        endpoints.push(closest.index);
                    }
                    if p.rotation_limit.is_some() && prior.is_none() {
                        let best = variants
                            .iter()
                            .min_by(|a, b| {
                                color(t, a, state, colors)
                                    .0
                                    .total_cmp(&color(t, b, state, colors).0)
                                    .then_with(|| {
                                        prior
                                            .map(|r| {
                                                super::orientations::angle(r, a.rotation).total_cmp(
                                                    &super::orientations::angle(r, b.rotation),
                                                )
                                            })
                                            .unwrap_or(Ordering::Equal)
                                    })
                            })
                            .unwrap();
                        endpoints.push(best.index);
                    }
                }
                endpoints.sort_unstable();
                endpoints.dedup();
                for after in endpoints {
                    dynamic.push(super::prepared::orientation_rows(t, p, cue, after));
                }
            }
        }
    }
    let mut score = |batch: usize, index: usize, row: &Row| {
        let g = p.geometry(row.after).unwrap();
        // Pull only observed colors through the permutation; construct the full
        // successor state after sorting, when sibling deduplication needs it.
        let (error, correct, confused, forbidden) = color_at(g, state, colors, |face| {
            row.sources[t.geometry_positions[face]]
        });
        let zero_unassigned = correct + confused + forbidden == 0 && !g.signature.is_empty();
        if zero_unassigned && !p.flag_sparse_color_contexts {
            return;
        }
        let error = if zero_unassigned { 0. } else { error };
        let score = 0.5 * g.score + 0.5 * error;
        if !score.is_finite() {
            return;
        }
        result.push(ScoredChoice {
            batch,
            row: index,
            rank: [score, -(g.inliers as f64), g.p90, -(g.layer_inliers as f64)],
            error,
            correct,
            confused,
            forbidden,
        });
    };
    if p.resolve_orientation {
        for (batch, rows) in dynamic.iter().enumerate() {
            for &index in &rows.scoring_indices {
                score(batch, index, &rows.rows[index]);
            }
        }
    } else if let Some(indices) = p.scoring_rows.get(&cue) {
        for &index in indices {
            score(0, index, &p.rows[index]);
        }
    }
    let all_sparse = p.color_evidence_threshold.is_some_and(|threshold| {
        !result.is_empty()
            && result
                .iter()
                .all(|choice| choice.match_count() <= threshold)
    });
    let no_dense_candidate = result
        .iter()
        .all(|choice| choice.match_count() <= p.color_evidence_threshold.unwrap_or(0));
    let allow_zero_color =
        p.flag_sparse_color_contexts && no_dense_candidate && (p.flagged || all_sparse);
    result.retain(|choice| {
        choice.match_count() > 0
            || p.geometry(if p.resolve_orientation {
                dynamic[choice.batch].rows[choice.row].after
            } else {
                p.rows[choice.row].after
            })
            .unwrap()
            .signature
            .is_empty()
            || allow_zero_color
    });
    // Keep the stable sort: original row order is the final tie breaker.
    result.sort_by(|a, b| rank_cmp(&a.rank, &b.rank));
    ScoredChoices {
        frame: p,
        incoming_cue: cue,
        dynamic,
        candidates: result,
    }
}
pub(super) fn choices(
    t: &Tables,
    p: &Prepared,
    state: &[u8],
    cue: Option<usize>,
    colors: &[usize],
) -> Vec<Choice> {
    let scored = score_choices(t, p, state, cue, colors);
    scored
        .candidates
        .iter()
        .map(|choice| Choice {
            state: scored.state(choice, state),
            cue: scored.cue(choice),
            step: scored.step(choice),
            rank: choice.rank,
        })
        .collect()
}
/// Score an already checked mechanical edge at its known successor. Reverse
/// search inverts this row; it does not invent a second motion/pose model.
pub(super) fn reverse_step(t: &Tables, p: &Prepared, row: &Row, state: &[u8], colors: &[usize]) -> Option<Step> {
    let g = p.geometry(row.after)?;
    let (mut error, correct, confused, forbidden) = color(t, g, state, colors);
    let count = correct + confused + forbidden;
    if count == 0 && !g.signature.is_empty() {
        let sparse = p.geometries.iter().all(|g| g.observations.len() <= p.color_evidence_threshold.unwrap_or(0));
        if !p.flag_sparse_color_contexts || !(p.flagged || sparse) { return None; }
        error = 0.;
    }
    let score = 0.5 * g.score + 0.5 * error;
    if !score.is_finite() { return None; }
    Some(Step {
        frame_index: p.frame,
        geometry_option_index: Some(g.bank_index),
        previous_geometry_index: row.before,
        orientation_symmetry_index: (g.symmetry != super::orientations::tables().identity_index).then_some(g.symmetry as u8),
        cube_rotation_motion: row.motion,
        cube_rotation_budget_degrees: p.rotation_limit,
        state_moves: row.moves.as_ref().clone(),
        state_score: score, color_error: error,
        color_match_count: count, color_correct_count: correct,
        color_confusion_count: confused, color_forbidden_count: forbidden,
        angular_travel_degrees: row.degrees, rotation_budget_degrees: row.budget,
        rotation_budget: true, sibling_rank: 0, branch_cutoff_bypassed: false,
        pose_flagged: p.flagged, queue_priority: 0., recent_motion_penalty: None,
        required_tps_ratio: None, window_mismatch_rate: None, window_mismatch_penalty: 0.,
    })
}
pub(super) fn rank_cmp(a: &[f64; 4], b: &[f64; 4]) -> Ordering {
    for i in 0..4 {
        let order = a[i].partial_cmp(&b[i]).unwrap();
        if order != Ordering::Equal {
            return order;
        }
    }
    Ordering::Equal
}
#[derive(Clone, PartialEq, Eq, Hash)]
struct Context {
    depth: usize,
    state: Vec<u8>,
    cue: Option<usize>,
}
#[derive(Clone)]
struct Node {
    context: Context,
    priority: f64,
    parent: Option<usize>,
    step: Option<SavedStep>,
    window: Vec<(usize, usize)>,
    motion_history: MotionHistory,
    color_priority: f64,
    status: u8,
}
#[derive(Clone, Copy)]
struct Entry {
    priority: f64,
    depth: usize,
    serial: usize,
    id: usize,
}
impl PartialEq for Entry {
    fn eq(&self, b: &Self) -> bool {
        self.serial == b.serial
    }
}
impl Eq for Entry {}
impl Ord for Entry {
    fn cmp(&self, b: &Self) -> Ordering {
        b.priority
            .partial_cmp(&self.priority)
            .unwrap()
            .then(self.depth.cmp(&b.depth))
            .then(b.serial.cmp(&self.serial))
    }
}
impl PartialOrd for Entry {
    fn partial_cmp(&self, b: &Self) -> Option<Ordering> {
        Some(self.cmp(b))
    }
}
#[derive(Default, Serialize)]
pub struct Stats {
    pub evaluated_states: usize,
    pub attempted_transitions: usize,
    pub dominated_pruned: usize,
    pub reopened_states: usize,
    pub improved_pending: usize,
    pub deferred_promoted: usize,
    pub furthest_frames: usize,
    pub unsolved_endpoints: usize,
    pub branch_stage: usize,
    pub peak_pending: usize,
    pub flagged_expanded_states: usize,
}
pub struct Frontier {
    pub stats: Stats,
    nodes: Vec<Node>,
    pending: BinaryHeap<Entry>,
    blocked: Vec<usize>,
    seen: HashMap<Context, usize>,
    deferred: HashMap<(usize, Context), usize>,
    serial: usize,
    stage_start: usize,
    pub winner: Option<usize>,
    best: usize,
    pub status: String,
    pub colors: Vec<String>,
    color_ids: Vec<usize>,
    solution_pending: bool,
    meeting_events: Option<Vec<usize>>,
}
impl Frontier {
    fn context_key(t: &Tables, frames: &[Prepared], context: &Context) -> Context {
        let mut key = context.clone();
        if let Some(frame) = frames[..context.depth.min(frames.len())]
            .iter()
            .rev()
            .find(|f| !f.held)
        {
            if frame.resolve_orientation {
                if let Some(g) = context.cue.and_then(|cue| frame.geometry(cue)) {
                    key.cue = Some(g.bank_index);
                    if g.symmetry != super::orientations::tables().identity_index {
                        let perm = &super::orientations::tables().face_permutations[g.symmetry];
                        for face in 0..54 {
                            key.state[t.geometry_positions[face]] =
                                context.state[t.geometry_positions[perm[face]]];
                        }
                    }
                }
            }
        }
        key
    }
    pub fn add_static(&mut self) {
        if self.stats.branch_stage == 0 {
            self.stage_start += 1;
        }
    }
    pub fn new(t: &Tables, c: &Config) -> Result<Self, String> {
        let colors = t.colors(&c.scramble)?;
        let color_ids = colors
            .iter()
            .map(|s| COLORS.iter().position(|&v| v == s).unwrap())
            .collect();
        let root = Node {
            context: Context {
                depth: 0,
                state: t.identity.clone(),
                cue: None,
            },
            priority: 0.,
            parent: None,
            step: None,
            window: vec![],
            motion_history: MotionHistory::default(),
            color_priority: 0.,
            status: 0,
        };
        let mut s = Self {
            stats: Stats::default(),
            nodes: vec![],
            pending: BinaryHeap::new(),
            blocked: vec![],
            seen: HashMap::new(),
            deferred: HashMap::new(),
            serial: 0,
            stage_start: 0,
            winner: None,
            best: 0,
            status: "waiting_for_frames".into(),
            colors,
            color_ids,
            solution_pending: false,
            meeting_events: None,
        };
        s.offer(root, t, &[], false);
        if t.solved(&t.identity, &s.colors) {
            s.winner = Some(0);
            s.status = "already_solved".into();
        }
        Ok(s)
    }
    fn enqueue(&mut self, id: usize, t: &Tables, frames: &[Prepared], ended: bool) {
        self.serial += 1;
        let n = &mut self.nodes[id];
        let solved = t.solved(&n.context.state, &self.colors);
        self.solution_pending |= solved;
        if solved
            || (n.context.depth < frames.len() && frames[n.context.depth].ready)
            || ended && n.context.depth == frames.len()
        {
            n.status = 0;
            self.pending.push(Entry {
                id,
                priority: n.priority,
                depth: n.context.depth,
                serial: self.serial,
            });
        } else {
            n.status = 1;
            self.blocked.push(id);
        }
    }
    fn offer(&mut self, mut node: Node, t: &Tables, frames: &[Prepared], ended: bool) -> bool {
        let key = Self::context_key(t, frames, &node.context);
        if let Some(&old) = self.seen.get(&key) {
            if self.nodes[old].priority <= node.priority {
                self.stats.dominated_pruned += 1;
                return false;
            }
            if self.nodes[old].status == 2 {
                self.stats.reopened_states += 1;
            } else {
                self.stats.improved_pending += 1;
            }
            self.nodes[old].status = 4;
        }
        let id = self.nodes.len();
        node.status = 0;
        self.seen.insert(key, id);
        self.nodes.push(node);
        if let Some(events)=&mut self.meeting_events {events.push(id);}
        if self.nodes[id].context.depth > self.nodes[self.best].context.depth {
            self.best = id;
        }
        self.enqueue(id, t, frames, ended);
        true
    }
    pub fn unblock(&mut self, t: &Tables, frames: &[Prepared], ended: bool) {
        let blocked = std::mem::take(&mut self.blocked);
        for id in blocked {
            if self.nodes[id].status == 1 {
                self.enqueue(id, t, frames, ended);
            }
        }
    }
    fn clean(&mut self) {
        while self
            .pending
            .peek()
            .is_some_and(|e| self.nodes[e.id].status != 0)
        {
            self.pending.pop();
        }
    }
    pub fn run(&mut self, t: &Tables, c: &Config, frames: &[Prepared], ended: bool, budget: usize) {
        if self.winner.is_some() || self.status == "state_limit" {
            return;
        }
        self.unblock(t, frames, ended);
        let limit = self.stats.evaluated_states.saturating_add(budget);
        loop {
            self.clean();
            if self.stats.evaluated_states >= c.state_limit {
                self.status = "state_limit".into();
                break;
            }
            // Once any admitted path has consumed the entire available
            // prefix, wait for more evidence instead of spending the search
            // budget on shallower alternatives simply because frames are late.
            // Keep every alternative; EOF releases ordinary full backtracking.
            let available = frames.iter().take_while(|frame| frame.ready).count();
            if c.pause_at_live_frontier
                && !ended
                && !self.solution_pending
                && self.nodes[self.best].context.depth >= available
            {
                self.status = "waiting_for_frames".into();
                break;
            }
            let waiting = self.blocked.iter().any(|&i| self.nodes[i].status == 1);
            let stage = self.stats.branch_stage;
            if stage + 1 < c.branch_widths.len()
                && ((self.pending.is_empty() && !waiting)
                    || self.stats.evaluated_states.saturating_sub(self.stage_start)
                        >= c.branch_stage_expansions)
            {
                self.stats.branch_stage += 1;
                self.stage_start = self.stats.evaluated_states;
                let width = c.branch_widths[self.stats.branch_stage];
                let mut ready: Vec<_> = self
                    .deferred
                    .iter()
                    .filter_map(|((rank, _), &id)| (*rank <= width).then_some((*rank, id)))
                    .collect();
                // Python promotes by required width then deferred queue serial.
                ready.sort_by(|&(ar, a), &(br, b)| {
                    ar.cmp(&br)
                        .then(
                            self.nodes[a]
                                .priority
                                .partial_cmp(&self.nodes[b].priority)
                                .unwrap(),
                        )
                        .then(
                            self.nodes[b]
                                .context
                                .depth
                                .cmp(&self.nodes[a].context.depth),
                        )
                        .then(a.cmp(&b))
                });
                for (rank, id) in ready {
                    let node = self.nodes[id].clone();
                    self.deferred
                        .remove(&(rank, Self::context_key(t, frames, &node.context)));
                    if self.offer(node, t, frames, ended) {
                        self.stats.deferred_promoted += 1;
                    }
                }
                continue;
            }
            if self.pending.is_empty() {
                self.status = if waiting || !ended {
                    "waiting_for_frames"
                } else {
                    "exhausted"
                }
                .into();
                break;
            }
            if self.stats.evaluated_states >= limit {
                self.status = "running".into();
                break;
            }
            let entry = self.pending.pop().unwrap();
            let id = entry.id;
            let node = self.nodes[id].clone();
            self.nodes[id].status = 2;
            self.stats.furthest_frames = self.stats.furthest_frames.max(node.context.depth);
            if t.solved(&node.context.state, &self.colors) {
                self.winner = Some(id);
                self.status = "solved".into();
                break;
            }
            if node.context.depth == frames.len() {
                self.stats.unsolved_endpoints += 1;
                continue;
            }
            self.stats.evaluated_states += 1;
            let options = score_choices(
                t,
                &frames[node.context.depth],
                &node.context.state,
                node.context.cue,
                &self.color_ids,
            );
            // Unreliable color evidence must neither prune legal children nor
            // select just one geometric context for a shared move sequence.
            // The frame-wide evidence warning is conservative across the whole
            // bank. A particular state/cue can have only sparse legal options
            // even when another (currently illegal) fit has ample assignments.
            // Such a context gets the same no-color-evidence treatment as a flagged
            // frame, using Python's existing <=3 assigned-sticker predicate.
            let sparse = !frames[node.context.depth].held
                && c.unrestricted_sticker_count.is_some_and(|threshold| {
                    !options.candidates.is_empty()
                        && options
                            .candidates
                            .iter()
                            .all(|v| v.match_count() <= threshold)
                });
            let flagged = frames[node.context.depth].flagged || (c.expand_flagged_frames && sparse);
            if flagged {
                self.stats.flagged_expanded_states += 1;
            }
            // With the flagged-frame feature disabled, preserve Python's
            // original sparse-context behavior: bypass cutoff only.
            let unrestricted = flagged || sparse;
            let (mut moves_seen, mut contexts) = (HashSet::new(), HashSet::new());
            let mut physical_moves = HashSet::new();
            let mut prior_rank = None;
            let mut admission = 0;
            for candidate in &options.candidates {
                self.stats.attempted_transitions += 1;
                let key = Context {
                    depth: node.context.depth + 1,
                    state: options.state(candidate, &node.context.state),
                    cue: options.cue(candidate),
                };
                let canonical = Self::context_key(t, frames, &key);
                if (!flagged
                    && if c.resolve_orientation_ambiguity {
                        physical_moves.contains(&canonical.state)
                    } else {
                        moves_seen.contains(options.moves(candidate))
                    })
                    || contexts.contains(&canonical)
                {
                    continue;
                }
                if !flagged {
                    if c.resolve_orientation_ambiguity {
                        physical_moves.insert(canonical.state.clone());
                    } else {
                        moves_seen.insert(options.moves(candidate).to_vec());
                    }
                }
                contexts.insert(canonical.clone());
                let rank = contexts.len();
                if prior_rank.is_none_or(|p| rank_cmp(&p, &candidate.rank) != Ordering::Equal) {
                    admission = rank;
                    prior_rank = Some(candidate.rank);
                }
                let preserve_hold = c.preserve_hold && options.moves(candidate).is_empty();
                if !unrestricted && admission > *c.branch_widths.last().unwrap() && !preserve_hold {
                    // Candidates are sorted by rank and admission only grows.
                    // Once outside the final width, later orientation aliases
                    // cannot re-enter it. Only an explicitly preserved hold can
                    // still be admitted from the remainder of this list.
                    if c.preserve_hold {
                        continue;
                    } else {
                        break;
                    }
                }
                let mut window = node.window.clone();
                let total = candidate.match_count();
                // A flagged frame contributes no color evidence to the eight-frame
                // mismatch window. The next reliable frame resumes normally.
                if !flagged && (total > 0 || !window.is_empty()) {
                    if window.len() == 8 {
                        window.remove(0);
                    }
                    window.push((candidate.forbidden, total));
                }
                let (misses, total) = window.iter().fold((0, 0), |(m, n), (a, b)| (m + a, n + b));
                let rate = (total > 0).then(|| misses as f64 / total as f64);
                let penalty = if window.len() == 8 {
                    c.mismatch_window_weight * rate.unwrap_or(0.)
                } else {
                    0.
                };
                let color_priority = if flagged {
                    node.color_priority
                } else {
                    0.5 * candidate.error + penalty
                };
                let (motion_history, ratio, motion_penalty) = if c.motion_cost_weight > 0. {
                    let (degrees, budget) = options
                        .row(candidate)
                        .map_or((0., 0.), |row| (row.degrees, row.budget));
                    let ratio = required_tps_ratio(degrees, budget);
                    let history = node.motion_history.with_ratio(ratio);
                    let cost = history.penalty(c.motion_cost_weight);
                    (history, Some(ratio), Some(cost))
                } else {
                    (MotionHistory::default(), None, None)
                };
                // A flagged frame inherits color evidence only. Its preceding
                // motion penalty is replaced by the updated bounded window.
                let priority = color_priority + motion_penalty.unwrap_or(0.);
                let step = if c.diagnostics {
                    let mut step = options.step(candidate);
                    step.sibling_rank = rank;
                    step.pose_flagged = flagged;
                    step.branch_cutoff_bypassed = unrestricted;
                    step.window_mismatch_rate = rate;
                    step.window_mismatch_penalty = penalty;
                    step.required_tps_ratio = ratio;
                    step.recent_motion_penalty = motion_penalty;
                    step.queue_priority = priority;
                    SavedStep::Detailed(Arc::new(step))
                } else {
                    SavedStep::Essential(Arc::new(options.essential_step(candidate, flagged)))
                };
                let child = Node {
                    context: key,
                    priority,
                    parent: Some(id),
                    step: Some(step),
                    window,
                    motion_history,
                    color_priority,
                    status: 0,
                };
                if !unrestricted
                    && !preserve_hold
                    && admission > c.branch_widths[self.stats.branch_stage]
                {
                    let key = (admission, canonical);
                    if self
                        .deferred
                        .get(&key)
                        .is_none_or(|&old| self.nodes[old].priority > priority)
                    {
                        let child_id = self.nodes.len();
                        self.nodes.push(child);
                        self.deferred.insert(key, child_id);
                        self.serial += 1;
                    }
                } else {
                    self.offer(child, t, frames, ended);
                }
            }
            self.stats.peak_pending = self
                .stats
                .peak_pending
                .max(self.pending.len() + self.blocked.len());
        }
    }
    fn path(&self) -> Vec<&SavedStep> {
        let mut path = vec![];
        let mut at = Some(self.winner.unwrap_or(self.best));
        while let Some(i) = at {
            let n = &self.nodes[i];
            if let Some(step) = &n.step {
                path.push(step);
            }
            at = n.parent;
        }
        path.reverse();
        path
    }
    pub(super) fn observe_meeting_events(&mut self) { self.meeting_events = Some(vec![0]); }
    pub(super) fn take_meeting_events(&mut self) -> Vec<usize> { self.meeting_events.as_mut().map(std::mem::take).unwrap_or_default() }
    pub(super) fn node_context(&self, id: usize) -> Option<(usize, &[u8], Option<usize>)> {
        self.nodes.get(id).map(|node| (node.context.depth,node.context.state.as_slice(),node.context.cue))
    }
    pub(super) fn node_path(&self, mut id: usize) -> Option<Vec<SavedStep>> {
        let mut path=vec![];
        loop {
            let node=self.nodes.get(id)?;
            if let Some(step)=&node.step {path.push(step.clone());}
            if let Some(parent)=node.parent {id=parent;} else {break;}
        }
        path.reverse();Some(path)
    }
    pub fn snapshot(
        &self,
        frames: &[Prepared],
        waiting_preparation: usize,
        ended: bool,
    ) -> serde_json::Value {
        let path = self.path();
        let winner = self.winner.map(|i| &self.nodes[i]);
        serde_json::json!({"status":self.status,"stats":self.stats,"frames_received":frames.len()+waiting_preparation,
            "flagged_frames":frames.iter().filter(|f|f.flagged).map(|f|serde_json::json!({"frame":f.frame,"reason":f.reliability_reason})).collect::<Vec<_>>(),
            "furthest_admitted_frames":self.nodes[self.best].context.depth,
            "frames_prepared":frames.len()+waiting_preparation,"frames_searchable":frames.iter().take_while(|f|f.ready).count(),
            "pending":self.pending.len(),"blocked":self.blocked.iter().filter(|&&i|self.nodes[i].status==1).count(),
            "deferred":self.deferred.len(),"ended":ended,"steps":path,
            "solved_frame_index":winner.and_then(|n|n.step.as_ref().map(|s|s.frame_index()))})
    }
    pub fn probe(&self, t: &Tables, p: &Prepared, state: &[u8], cue: Option<usize>) -> Vec<Step> {
        let scored = score_choices(t, p, state, cue, &self.color_ids);
        scored
            .candidates
            .iter()
            .map(|choice| scored.step(choice))
            .collect()
    }
}

#[cfg(test)]
#[path = "optimization_tests.rs"]
mod optimization_tests;

#[cfg(test)]
mod flagged_tests {
    use super::*;
    use crate::move_search::{Engine, Frame};

    fn synthetic_fit() -> crate::Fit {
        crate::Fit {
            recovery_score_components: None,
            axis: 0,
            params: [0.; 8],
            angles: [0.; 3],
            score: 0.,
            source: "synthetic".into(),
            flat_fallback: false,
            metrics: crate::Metrics::default(),
            nearest: vec![],
            valid: vec![],
            assignment_objects: vec![],
            assignment_projected: vec![],
            assignment_classes: vec![],
        }
    }

    #[test]
    fn flagged_frames_inherit_color_priority_without_compounding_motion_cost() {
        let data: serde_json::Value = serde_json::from_str(include_str!(
            "../../tests/fixtures/move-search-golden.json"
        )).unwrap();
        let weight = 0.025;
        let mut engine = Engine::new(Config {
            scramble: "R U F L D B".into(),
            branch_widths: vec![1],
            unrestricted_sticker_count: None,
            pause_at_live_frontier: false,
            expand_flagged_frames: true,
            motion_cost_weight: weight,
            ..Config::default()
        }).unwrap();
        for sequence in 0..2 {
            let mut frame: Frame = serde_json::from_value(
                data["frames"][sequence + 1].clone()
            ).unwrap();
            frame.sequence = sequence;
            frame.frame = sequence;
            frame.flagged = Some(true);
            engine.push(frame).unwrap();
        }
        engine.end().unwrap();
        let mut history = MotionHistory::default();
        for _ in 0..8 { history = history.with_ratio(1.); }
        let root = &mut engine.frontier.nodes[0];
        root.motion_history = history;
        root.color_priority = 0.42;
        root.priority = 0.42 + root.motion_history.penalty(weight);
        root.window = vec![(1, 8); 3];
        engine.advance(1);
        engine.advance(1);
        let mut depths = HashSet::new();
        for node in engine.frontier.nodes.iter().filter(|node|node.parent.is_some()) {
            depths.insert(node.context.depth);
            let step = node.step.as_ref().unwrap().detailed();
            assert!(step.pose_flagged && step.branch_cutoff_bypassed);
            assert_eq!(node.window, vec![(1, 8); 3]);
            assert_eq!(node.color_priority, 0.42);
            let cost = node.motion_history.penalty(weight);
            assert_eq!(step.recent_motion_penalty, Some(cost));
            assert_eq!(step.required_tps_ratio, Some(required_tps_ratio(
                step.angular_travel_degrees, step.rotation_budget_degrees
            )));
            assert!((node.priority - (0.42 + cost)).abs() < 1e-12);
        }
        assert!(depths.contains(&1) && depths.contains(&2));
    }
    #[test]
    fn cube_basis_aliases_share_one_physical_search_key() {
        let mut engine = Engine::new(Config {
            scramble: "R U F".into(),
            resolve_orientation_ambiguity: true,
            max_rotation_tps: Some(20.),
            ..Config::default()
        })
        .unwrap();
        engine
            .push(Frame {
                bank: vec![synthetic_fit()],
                ..Frame::default()
            })
            .unwrap();
        let state = engine.tables.identity.clone();
        let expected = Frontier::context_key(
            &engine.tables,
            &engine.frames,
            &Context {
                depth: 1,
                state: state.clone(),
                cue: Some(0),
            },
        );
        for geometry in &engine.frames[0].geometries {
            let perm =
                &crate::move_search::orientations::tables().face_permutations[geometry.symmetry];
            let mut alternate = state.clone();
            for face in 0..54 {
                alternate[engine.tables.geometry_positions[perm[face]]] =
                    state[engine.tables.geometry_positions[face]];
            }
            let key = Frontier::context_key(
                &engine.tables,
                &engine.frames,
                &Context {
                    depth: 1,
                    state: alternate,
                    cue: Some(geometry.index),
                },
            );
            assert!(
                key == expected,
                "a coordinate relabeling must not create a new physical search state"
            );
        }
        assert_eq!(engine.frames[0].geometries.len(), 24);
    }
    #[test]
    fn a_committed_solution_does_not_enumerate_turns_in_the_video_tail() {
        let mut engine = Engine::new(Config::default()).unwrap();
        assert!(engine.frontier.winner.is_some());
        engine
            .push(Frame {
                frame: 0,
                bank: vec![synthetic_fit()],
                ..Frame::default()
            })
            .unwrap();
        engine
            .push(Frame {
                sequence: 1,
                frame: 3000,
                bank: vec![synthetic_fit()],
                ..Frame::default()
            })
            .unwrap();
        assert!(engine.frames.iter().all(|f| f.ready && f.rows.is_empty()));
        assert_eq!(engine.frontier.stats.evaluated_states, 0);
    }

    #[test]
    fn flagged_expansion_keeps_every_context_and_next_frame_uses_normal_queue() {
        let data: serde_json::Value =
            serde_json::from_str(include_str!("../../tests/fixtures/move-search-golden.json"))
                .unwrap();
        let mut engine = Engine::new(Config {
            scramble: "R U F L D B".into(),
            fps: 30.,
            turning_start_frame: None,
            branch_widths: vec![1],
            branch_stage_expansions: usize::MAX,
            unrestricted_sticker_count: None,
            pause_at_live_frontier: false,
            expand_flagged_frames: true,
            ..Config::default()
        })
        .unwrap();
        for index in 0..3 {
            let mut frame: Frame =
                serde_json::from_value(data["frames"][index + 1].clone()).unwrap();
            frame.sequence = index;
            frame.frame = index;
            frame.flagged = Some(index == 0);
            engine.push(frame).unwrap();
        }
        engine.end().unwrap();
        let expected: HashSet<_> = choices(
            &engine.tables,
            &engine.frames[0],
            &engine.tables.identity,
            None,
            &engine.frontier.color_ids,
        )
        .into_iter()
        .map(|choice| (choice.state, choice.cue))
        .collect();
        assert!(expected.len() > 3);
        engine.advance(1);
        let actual: HashSet<_> = engine
            .frontier
            .nodes
            .iter()
            .filter(|node| node.parent == Some(0))
            .map(|node| {
                assert_eq!(
                    node.priority, 0.,
                    "bad-pose scores must not affect queue priority"
                );
                assert!(
                    node.window.is_empty(),
                    "bad-pose mismatches must not enter history"
                );
                assert!(node.step.as_ref().unwrap().detailed().pose_flagged);
                assert!(node.step.as_ref().unwrap().detailed().branch_cutoff_bypassed);
                (node.context.state.clone(), node.context.cue)
            })
            .collect();
        assert_eq!(
            actual, expected,
            "include all legal move/geometry contexts, even shared move sequences"
        );
        engine.advance(1);
        let normal: Vec<_> = engine
            .frontier
            .nodes
            .iter()
            .filter(|node| node.context.depth == 2)
            .collect();
        assert!(!normal.is_empty());
        for node in normal {
            let step = node.step.as_ref().unwrap().detailed();
            assert!(!step.pose_flagged);
            assert!(!step.branch_cutoff_bypassed);
            assert_eq!(node.window.len(), 1);
            assert_eq!(
                node.priority,
                0.5 * step.color_error + step.window_mismatch_penalty
            );
        }
        assert_eq!(engine.frontier.stats.flagged_expanded_states, 1);
    }

    #[test]
    fn sparse_legal_context_ignores_evidence_even_when_frame_bank_is_dense() {
        let mut dense = synthetic_fit();
        dense.params[5] = 600.;
        dense.nearest = (0..8).collect();
        dense.valid = vec![true; 8];
        dense.metrics.inlier_count = 28;
        dense.metrics.layer_inlier_count = 8;
        let mut sparse = dense.clone();
        sparse.nearest = vec![0, 1, 0, 1, 0, 1, 0, 1];
        let mut unreachable_dense = dense.clone();
        unreachable_dense.angles = [20., 0., 0.];
        unreachable_dense.params[6] = 20.;
        let middle_bank = vec![sparse, unreachable_dense];
        assert_eq!(super::super::reliability::maximum_assigned_stickers(&middle_bank), Some(8));
        let config = Config {
            scramble: "R U F L D B".into(),
            fps: 1000., // 4.86 degrees cannot reach the 20-degree dense fit.
            branch_widths: vec![1],
            unrestricted_sticker_count: Some(3),
            pause_at_live_frontier: false,
            expand_flagged_frames: true,
            ..Config::default()
        };
        let colors = vec!["white".to_string(); 8];
        let inputs: Vec<_> = [vec![dense.clone()], middle_bank, vec![dense]].into_iter().enumerate()
            .map(|(sequence, bank)| Frame {sequence, frame:sequence, bank, colors:colors.clone(),
                landmark_count:Some(20), flagged:Some(false), geometry_flagged:Some(false)}).collect();
        for feature in [true, false] {
        let mut engine = Engine::new(Config {expand_flagged_frames:feature,..config.clone()}).unwrap();
        for frame in &inputs { engine.push(frame.clone()).unwrap(); }
        engine.end().unwrap();
        assert!(!engine.frames[1].flagged, "The usable frame-wide bank is not sparse");
        let options = choices(&engine.tables, &engine.frames[1], &engine.tables.identity,
            Some(0), &engine.frontier.color_ids);
        assert!(!options.is_empty());
        assert!(options.iter().all(|choice| choice.step.color_match_count <= 3),
            "Only the low-evidence fit is mechanically legal from this cue");
        // Start exactly at this reviewed type of boundary, with existing evidence
        // in the history. The context warning must preserve it unchanged.
        engine.frontier.nodes[0].context.depth = 1;
        engine.frontier.nodes[0].context.cue = Some(0);
        engine.frontier.nodes[0].window = vec![(1, 8); 3];
        engine.frontier.nodes[0].priority = 0.42;
        engine.frontier.nodes[0].color_priority = 0.42;
        engine.advance(1);
        let children: Vec<_> = engine.frontier.nodes.iter().filter(|node| node.parent == Some(0)).collect();
        assert!(!children.is_empty());
        for child in children {
            let step = child.step.as_ref().unwrap().detailed();
            assert_eq!(step.pose_flagged, feature);
            assert!(step.branch_cutoff_bypassed);
            if feature {
                assert_eq!(child.priority, 0.42);
                assert_eq!(child.window, vec![(1, 8); 3]);
            } else {
                assert_eq!(child.priority, 0.5 * step.color_error + step.window_mismatch_penalty);
                assert_eq!(child.window.len(), 4);
            }
        }
        engine.advance(1);
        let following: Vec<_> = engine.frontier.nodes.iter().filter(|node| node.context.depth == 3).collect();
        assert!(!following.is_empty());
        for node in following {
            let step = node.step.as_ref().unwrap().detailed();
            assert!(!step.pose_flagged && !step.branch_cutoff_bypassed);
            assert_eq!(node.window.len(), if feature {4} else {5});
            assert_eq!(node.priority, 0.5 * step.color_error + step.window_mismatch_penalty);
        }
        }
    }

    #[test]
    fn configured_opening_hold_is_not_a_sparse_color_context() {
        let mut dense = synthetic_fit();
        dense.params[5] = 600.;
        dense.nearest = (0..8).collect();
        dense.valid = vec![true; 8];
        dense.metrics.inlier_count = 28;
        assert_eq!(super::super::reliability::reason(&[dense.clone()], Some(20), 8), None);
        let mut engine = Engine::new(Config {
            scramble:"R U".into(), turning_start_frame:Some(0),
            expand_flagged_frames:true, unrestricted_sticker_count:Some(3),
            pause_at_live_frontier:false,..Config::default()
        }).unwrap();
        engine.push(Frame {sequence:0,frame:0,bank:vec![dense],colors:vec!["white".into();8],
            landmark_count:Some(20),flagged:Some(false),geometry_flagged:Some(false)}).unwrap();
        engine.end().unwrap();
        assert!(engine.frames[0].held && !engine.frames[0].flagged);
        engine.advance(1);
        let children:Vec<_> = engine.frontier.nodes.iter().filter(|node|node.parent==Some(0)).collect();
        assert_eq!(children.len(),1);
        let step = children[0].step.as_ref().unwrap().detailed();
        assert_eq!(step.color_match_count,0,"Static hold rows contain no color scoring by design");
        assert!(!step.pose_flagged && !step.branch_cutoff_bypassed,
            "Synthetic zero match count must not hide a well-observed opening pose");
    }

    #[test]
    fn color_only_flags_preserve_motion_constraints_for_current_and_previous_geometry() {
        for (previous_flag,previous_geometry,current_flag,current_geometry,bypass) in [
            (false,Some(false),true,Some(false),false),
            (true,Some(false),false,Some(false),false),
            (false,Some(false),true,Some(true),true),
            (true,Some(true),false,Some(false),true),
            // Before typed geometry flags existed, an explicit flag meant bad geometry.
            (false,Some(false),true,None,true),
        ] {
            let mut first=synthetic_fit();
            first.params[5]=600.;
            first.nearest=(0..8).collect();
            first.valid=vec![true;8];
            first.metrics.inlier_count=28;
            let mut next=first.clone();
            next.params[2]=73_f64.to_radians();
            let mut engine=Engine::new(Config {
                scramble:"R U".into(),fps:1000.,max_rotation_tps:Some(20.),
                resolve_orientation_ambiguity:true,expand_flagged_frames:true,
                ..Config::default()
            }).unwrap();
            for (sequence,fit,flagged,geometry_flagged) in [
                (0,first,previous_flag,previous_geometry),
                (1,next,current_flag,current_geometry),
            ] {
                engine.push(Frame {sequence,frame:sequence,bank:vec![fit],
                    colors:vec!["white".into();8],landmark_count:Some(20),
                    flagged:Some(flagged),geometry_flagged}).unwrap();
            }
            engine.end().unwrap();
            let rows=super::super::prepared::orientation_rows(&engine.tables,
                &engine.frames[1],Some(0),0);
            assert_eq!(!rows.is_empty(),bypass,
                "A good but color-poor pose still rules out the impossible 73-degree motion; only bad geometry disables that gate");
        }
    }

    #[test]
    fn zero_color_fallback_requires_every_legal_fit_to_lack_adequate_color() {
        let mut dense=synthetic_fit();
        dense.params[5]=600.;
        dense.nearest=(0..8).collect();
        dense.valid=vec![true;8];
        dense.metrics.inlier_count=28;
        let mut zero=dense.clone();
        zero.valid=vec![false;8];
        let build=|bank:Vec<crate::Fit>,feature:bool| {
            let mut engine=Engine::new(Config {
                scramble:"R U".into(),fps:1000.,max_rotation_tps:Some(20.),
                resolve_orientation_ambiguity:true,expand_flagged_frames:feature,
                unrestricted_sticker_count:Some(3),pause_at_live_frontier:false,
                ..Config::default()
            }).unwrap();
            for (sequence,bank) in [vec![dense.clone()],bank].into_iter().enumerate() {
                engine.push(Frame {sequence,frame:sequence,bank,colors:vec!["white".into();8],
                    landmark_count:Some(20),flagged:Some(false),geometry_flagged:Some(false)}).unwrap();
            }
            engine.end().unwrap();
            engine
        };
        let mut only_zero=build(vec![zero.clone()],true);
        let options=choices(&only_zero.tables,&only_zero.frames[1],&only_zero.tables.identity,
            Some(0),&only_zero.frontier.color_ids);
        assert!(!options.is_empty(),"Reliable geometry still supplies legal moves without any assigned colors");
        assert!(options.iter().all(|choice|choice.step.color_match_count==0 && choice.step.color_error==0.));
        only_zero.frontier.nodes[0].context.depth=1;
        only_zero.frontier.nodes[0].context.cue=Some(0);
        only_zero.frontier.nodes[0].priority=0.42;
        only_zero.frontier.nodes[0].color_priority=0.42;
        only_zero.frontier.nodes[0].window=vec![(1,8);3];
        only_zero.advance(1);
        let children:Vec<_>=only_zero.frontier.nodes.iter().filter(|node|node.parent==Some(0)).collect();
        assert!(!children.is_empty());
        assert!(children.iter().all(|node|node.priority==0.42 && node.window.len()==3
            && node.step.as_ref().unwrap().detailed().pose_flagged));
        let supported=build(vec![zero.clone(),dense.clone()],true);
        let options=choices(&supported.tables,&supported.frames[1],&supported.tables.identity,
            Some(0),&supported.frontier.color_ids);
        assert!(!options.is_empty());
        assert!(options.iter().all(|choice|choice.step.color_match_count>3
            && choice.step.geometry_option_index==Some(1)),
            "An adequately supported fit prevents an all-invalid fit from manufacturing perfect color");
        let legacy=build(vec![zero.clone()],false);
        assert!(choices(&legacy.tables,&legacy.frames[1],&legacy.tables.identity,
            Some(0),&legacy.frontier.color_ids).is_empty(),"Disabled flag feature preserves legacy rejection");
        let mut fast=zero;
        fast.params[2]=73_f64.to_radians();
        let impossible=build(vec![fast],true);
        assert!(choices(&impossible.tables,&impossible.frames[1],&impossible.tables.identity,
            Some(0),&impossible.frontier.color_ids).is_empty(),
            "Missing colors cannot make mechanically impossible geometry legal");
    }
}

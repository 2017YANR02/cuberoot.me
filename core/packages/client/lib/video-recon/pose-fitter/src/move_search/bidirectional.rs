//! Post-fitting, cooperative two-frontier search over the existing mechanical
//! rows. End-frame solved colors constrain the reverse frontier, never a known
//! solution sequence. Reverse ties use predecessor-frame color evidence.
use super::{
    cube::Tables,
    frontier::{self, Choice, SavedStep, Stats, Step},
    motion_history::{required_tps_ratio, MotionHistory},
    prepared::{self, Prepared, RowBatch, COLORS},
    Config,
};
use std::{
    cmp::Ordering,
    collections::{BinaryHeap, HashMap, HashSet},
    sync::Arc,
};

#[derive(Clone, Hash, PartialEq, Eq)]
struct Context {
    depth: usize,
    state: Vec<u8>,
    cue: Option<usize>,
}
#[derive(Clone)]
struct Node {
    context: Context,
    priority: f64,
    color_priority: f64,
    parent: Option<usize>,
    step: Option<SavedStep>,
    window: Vec<(usize, usize)>,
    motion: MotionHistory,
    expanded: bool,
}
#[derive(Clone, Copy)]
struct Entry {
    priority: f64,
    progress: usize,
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
            .total_cmp(&self.priority)
            .then(self.progress.cmp(&b.progress))
            .then(b.serial.cmp(&self.serial))
    }
}
impl PartialOrd for Entry {
    fn partial_cmp(&self, b: &Self) -> Option<Ordering> {
        Some(self.cmp(b))
    }
}
#[derive(Default)]
struct Side {
    nodes: Vec<Node>,
    pending: BinaryHeap<Entry>,
    seen: HashMap<Context, usize>,
    deferred: HashMap<(usize, Context), usize>,
    expanded: usize,
    stage: usize,
    stage_start: usize,
    serial: usize,
    best: usize,
}
impl Side {
    fn clean(&mut self) {
        while self
            .pending
            .peek()
            .is_some_and(|e| self.seen.get(&self.nodes[e.id].context) != Some(&e.id))
        {
            self.pending.pop();
        }
    }
    fn offer(
        &mut self,
        node: Node,
        direction: usize,
        length: usize,
        stats: &mut Stats,
    ) -> Option<usize> {
        if let Some(&old) = self.seen.get(&node.context) {
            if self.nodes[old].priority <= node.priority {
                stats.dominated_pruned += 1;
                return None;
            }
            if self.nodes[old].expanded {
                stats.reopened_states += 1;
            } else {
                stats.improved_pending += 1;
            }
        }
        let progress = if direction == 0 {
            node.context.depth
        } else {
            length - node.context.depth
        };
        let id = self.nodes.len();
        if self.nodes.is_empty()
            || progress
                > if direction == 0 {
                    self.nodes[self.best].context.depth
                } else {
                    length - self.nodes[self.best].context.depth
                }
        {
            self.best = id;
        }
        self.seen.insert(node.context.clone(), id);
        self.nodes.push(node);
        self.serial += 1;
        self.pending.push(Entry {
            priority: self.nodes[id].priority,
            progress,
            serial: self.serial,
            id,
        });
        Some(id)
    }
    fn widen(
        &mut self,
        c: &Config,
        direction: usize,
        length: usize,
        stats: &mut Stats,
        events: &mut Vec<usize>,
    ) {
        self.clean();
        if self.stage + 1 >= c.branch_widths.len()
            || (!self.pending.is_empty()
                && self.expanded - self.stage_start < c.branch_stage_expansions)
        {
            return;
        }
        self.stage += 1;
        self.stage_start = self.expanded;
        let width = c.branch_widths[self.stage];
        let mut ready: Vec<_> = self
            .deferred
            .iter()
            .filter(|((rank, _), _)| *rank <= width)
            .map(|(key, &id)| (key.clone(), id))
            .collect();
        ready.sort_by(|(a, ai), (b, bi)| {
            a.0.cmp(&b.0)
                .then(
                    self.nodes[*ai]
                        .priority
                        .total_cmp(&self.nodes[*bi].priority),
                )
                .then(ai.cmp(bi))
        });
        for (key, id) in ready {
            self.deferred.remove(&key);
            stats.deferred_promoted += 1;
            if let Some(id) = self.offer(self.nodes[id].clone(), direction, length, stats) {
                events.push(id);
            }
        }
    }
    fn path(&self, mut id: usize, reverse: bool) -> Vec<SavedStep> {
        let mut path = vec![];
        loop {
            let node = &self.nodes[id];
            if let Some(step) = &node.step {
                path.push(step.clone());
            }
            if let Some(parent) = node.parent {
                id = parent;
            } else {
                break;
            }
        }
        if !reverse {
            path.reverse();
        }
        path
    }
}
struct Candidate {
    choice: Choice,
    rank: [f64; 5],
}
pub(super) struct Bidirectional {
    sides: [Side; 2],
    stats: Stats,
    color_ids: Vec<usize>,
    length: usize,
    winner: Option<(usize, Option<usize>)>,
    status: &'static str,
    reverse_rows: HashMap<(usize, Option<usize>), Arc<Vec<Arc<RowBatch>>>>,
    forward_meetings: HashMap<Context, usize>,
    backward_meetings: HashMap<Context, usize>,
    events: Vec<usize>,
    backward_status: &'static str,
}

fn root(state: Vec<u8>, depth: usize) -> Node {
    Node {
        context: Context {
            state,
            depth,
            cue: None,
        },
        priority: 0.,
        color_priority: 0.,
        parent: None,
        step: None,
        window: vec![],
        motion: MotionHistory::default(),
        expanded: false,
    }
}
fn rank_cmp(a: &[f64; 5], b: &[f64; 5]) -> Ordering {
    a.iter()
        .zip(b)
        .map(|(x, y)| x.total_cmp(y))
        .find(|v| *v != Ordering::Equal)
        .unwrap_or(Ordering::Equal)
}
fn held_step(frames: &[Prepared], index: usize, cue: Option<usize>) -> Step {
    let mut step = Step::hold(frames[index].frame, cue);
    if let Some(g) = frames[..index]
        .iter()
        .rev()
        .find(|p| !p.held)
        .and_then(|p| cue.and_then(|cue| p.geometry(cue)))
    {
        step.geometry_option_index = Some(g.bank_index);
        step.orientation_symmetry_index = (g.symmetry
            != super::orientations::tables().identity_index)
            .then_some(g.symmetry as u8);
    }
    step
}
impl Bidirectional {
    pub(super) fn has_winner(&self)->bool {self.winner.is_some()}
    /// Start of the last corroborated cluster of flat solved views. This is the
    /// same boundary evidence used by the standalone Python search; no inference.
    pub(super) fn new(t: &Tables, c: &Config, frames: &[Prepared]) -> Option<Self> {
        let colors = t.colors(&c.scramble).ok()?;
        let color_ids: Vec<_> = colors
            .iter()
            .map(|s| COLORS.iter().position(|v| v == s).unwrap())
            .collect();
        let goals = t.solved_seeds(&c.scramble).ok()?;
        let mut cluster: Vec<usize> = vec![];
        let max_gap = (0.15 * c.fps).round().max(2.) as usize;
        for index in (0..frames.len()).rev() {
            let p = &frames[index];
            if cluster
                .last()
                .is_some_and(|&j| frames[j].frame - p.frame > max_gap)
            {
                if cluster.len() >= 2 {
                    break;
                }
                cluster.clear();
            }
            if p.held || p.geometry_flagged {
                continue;
            }
            let solved_view = p
                .geometries
                .iter()
                .filter(|g| g.index < 6 && g.shape.axis.is_none() && g.observations.len() >= 12)
                .any(|g| {
                    goals
                        .iter()
                        .any(|state| frontier::color(t, g, state, &color_ids).0 <= 0.1)
                });
            if solved_view {
                cluster.push(index);
            }
        }
        if cluster.len() < 2 {
            return None;
        }
        let length = cluster.last().copied()? + 1;
        let mut search = Self {
            sides: [Side::default(), Side::default()],
            stats: Stats::default(),
            color_ids,
            length,
            winner: None,
            status: "running",
            reverse_rows: HashMap::new(),
            forward_meetings: HashMap::new(),
            backward_meetings: HashMap::new(),
            events: vec![],
            backward_status: "running",
        };
        for goal in goals {
            if let Some(id) =
                search.sides[1].offer(root(goal, length), 1, length, &mut search.stats)
            {
                search.events.push(id);
            }
        }
        Some(search)
    }
    // Every row is generated by the forward mechanical compiler, including its
    // shared turn, slice, rigid-camera and material-motion checks. Cache lazily.
    fn rows(
        &mut self,
        t: &Tables,
        frames: &[Prepared],
        index: usize,
        after: Option<usize>,
    ) -> Arc<Vec<Arc<RowBatch>>> {
        if let Some(rows) = self.reverse_rows.get(&(index, after)) {
            return Arc::clone(rows);
        }
        let p = &frames[index];
        let mut result = vec![];
        if p.resolve_orientation {
            for (&before, (_, prior, _)) in &p.orientation_parents {
                for base in p.geometries.iter().filter(|g| g.index < 6) {
                    let mut endpoints = vec![base.index];
                    if prior.is_none_or(|r| super::orientations::angle(r, base.rotation) > 45.) {
                        let variants: Vec<_> = p
                            .geometries
                            .iter()
                            .filter(|g| g.bank_index == base.bank_index)
                            .collect();
                        if let Some(prior) = prior {
                            if let Some(closest) = variants.iter().min_by(|a, b| {
                                super::orientations::similarity(*prior, b.rotation)
                                    .total_cmp(&super::orientations::similarity(*prior, a.rotation))
                            }) {
                                endpoints.push(closest.index);
                            }
                        } else if p.rotation_limit.is_some() {
                            if let Some(best) = variants.iter().min_by(|a, b| {
                                frontier::color(t, a, &t.identity, &self.color_ids)
                                    .0
                                    .total_cmp(
                                        &frontier::color(t, b, &t.identity, &self.color_ids).0,
                                    )
                            }) {
                                endpoints.push(best.index);
                            }
                        }
                    }
                    endpoints.sort_unstable();
                    endpoints.dedup();
                    for endpoint in endpoints {
                        if after.is_some_and(|a| a != endpoint)
                            || (after.is_none() && endpoint >= 6)
                        {
                            continue;
                        }
                        let rows = prepared::orientation_rows(t, p, before, endpoint);
                        result.push(rows);
                    }
                }
            }
        } else {
            let rows: Vec<_> = p
                .scoring_rows
                .values()
                .flatten()
                .filter_map(|&i| {
                    let row = &p.rows[i];
                    (!after.is_some_and(|a| a != row.after)).then(|| row.clone())
                })
                .collect();
            result.push(Arc::new(RowBatch {
                scoring_indices: (0..rows.len()).collect(),
                rows,
            }));
        }
        let rows = Arc::new(result);
        self.reverse_rows.insert((index, after), Arc::clone(&rows));
        rows
    }
    fn candidates(
        &mut self,
        t: &Tables,
        frames: &[Prepared],
        direction: usize,
        node: &Node,
    ) -> Vec<Candidate> {
        if direction == 0 {
            return frontier::choices(
                t,
                &frames[node.context.depth],
                &node.context.state,
                node.context.cue,
                &self.color_ids,
            )
            .into_iter()
            .map(|mut choice| {
                if frames[node.context.depth].held {
                    choice.step = held_step(frames, node.context.depth, node.context.cue);
                }
                let r = choice.rank;
                Candidate {
                    choice,
                    rank: [r[0], r[1], r[2], r[3], 0.],
                }
            })
            .collect();
        }
        let index = node.context.depth - 1;
        let p = &frames[index];
        if p.held {
            return vec![Candidate {
                choice: Choice {
                    state: node.context.state.clone(),
                    cue: node.context.cue,
                    step: held_step(frames, index, node.context.cue),
                    rank: [0.; 4],
                },
                rank: [0.; 5],
            }];
        }
        let rows = self.rows(t, frames, index, node.context.cue);
        let mut candidates = vec![];
        for row in rows
            .iter()
            .flat_map(|batch| batch.scoring_indices.iter().map(move |&i| &batch.rows[i]))
        {
            let Some(step) =
                frontier::reverse_step(t, p, row, &node.context.state, &self.color_ids)
            else {
                continue;
            };
            let mut state = vec![0; 54];
            for (target, &source) in row.sources.iter().enumerate() {
                state[source] = node.context.state[target];
            }
            if row.before.is_none() && state != t.identity {
                continue;
            }
            let prior = p.previous.and_then(|i| {
                row.before
                    .and_then(|cue| frames[i].geometry(cue))
                    .map(|g| (i, g))
            });
            let earlier_color = prior.map_or(0., |(i, g)| {
                if frames[i].flagged {
                    0.
                } else {
                    frontier::color(t, g, &state, &self.color_ids).0
                }
            });
            if !earlier_color.is_finite() {
                continue;
            }
            let g = p.geometry(row.after).unwrap();
            let rank = [
                step.state_score,
                earlier_color,
                -(g.inliers as f64),
                g.p90,
                -(g.layer_inliers as f64),
            ];
            candidates.push(Candidate {
                choice: Choice {
                    state,
                    cue: row.before,
                    rank: [rank[0], rank[2], rank[3], rank[4]],
                    step,
                },
                rank,
            });
        }
        candidates.sort_by(|a, b| rank_cmp(&a.rank, &b.rank));
        candidates
    }
    pub(super) fn run_backward(
        &mut self,
        t: &Tables,
        c: &Config,
        frames: &[Prepared],
        budget: usize,
    ) {
        if self.backward_status != "running" {
            return;
        }
        let direction = 1;
        for _ in 0..budget {
            self.sides[1].widen(c, 1, self.length, &mut self.stats, &mut self.events);
            self.sides[1].clean();
            if self.sides[1].pending.is_empty() {
                self.backward_status = "exhausted";
                break;
            }
            if self.stats.evaluated_states >= c.state_limit {
                self.backward_status = "state_limit";
                break;
            }
            let id = self.sides[1].pending.pop().unwrap().id;
            let node = self.sides[1].nodes[id].clone();
            self.sides[1].nodes[id].expanded = true;
            if node.context.depth == 0 {
                continue;
            }
            self.stats.evaluated_states += 1;
            self.sides[1].expanded += 1;
            let index = if direction == 0 {
                node.context.depth
            } else {
                node.context.depth - 1
            };
            let p = &frames[index];
            let candidates = self.candidates(t, frames, direction, &node);
            let sparse = !p.held
                && c.unrestricted_sticker_count.is_some_and(|threshold| {
                    !candidates.is_empty()
                        && candidates
                            .iter()
                            .all(|v| v.choice.step.color_match_count <= threshold)
                });
            let flagged = p.flagged || c.expand_flagged_frames && sparse;
            let unrestricted = flagged || sparse;
            if flagged {
                self.stats.flagged_expanded_states += 1;
            }
            let mut contexts = HashSet::new();
            let mut moves = HashSet::new();
            let mut prior_rank = None;
            let mut admission = 0;
            for candidate in candidates {
                self.stats.attempted_transitions += 1;
                let Candidate { choice, rank } = candidate;
                let mut step = choice.step;
                let context = Context {
                    depth: if direction == 0 {
                        node.context.depth + 1
                    } else {
                        node.context.depth - 1
                    },
                    state: choice.state,
                    cue: choice.cue,
                };
                if contexts.contains(&context) || !flagged && moves.contains(&step.state_moves) {
                    continue;
                }
                contexts.insert(context.clone());
                moves.insert(step.state_moves.clone());
                let sibling = contexts.len();
                if prior_rank.is_none_or(|old| rank_cmp(&old, &rank) != Ordering::Equal) {
                    admission = sibling;
                    prior_rank = Some(rank);
                }
                let preserve = c.preserve_hold && step.state_moves.is_empty();
                if !unrestricted && !preserve && admission > *c.branch_widths.last().unwrap() {
                    continue;
                }
                let mut window = node.window.clone();
                if !flagged && (step.color_match_count > 0 || !window.is_empty()) {
                    if window.len() == 8 {
                        window.remove(0);
                    }
                    window.push((step.color_forbidden_count, step.color_match_count));
                }
                let (misses, total) = window.iter().fold((0, 0), |(a, b), (c, d)| (a + c, b + d));
                let rate = (total > 0).then(|| misses as f64 / total as f64);
                let penalty = if window.len() == 8 {
                    c.mismatch_window_weight * rate.unwrap_or(0.)
                } else {
                    0.
                };
                let color_priority = if flagged {
                    node.color_priority
                } else {
                    0.5 * step.color_error + penalty
                };
                let ratio =
                    required_tps_ratio(step.angular_travel_degrees, step.rotation_budget_degrees);
                let motion = if c.motion_cost_weight > 0. {
                    node.motion.with_ratio(ratio)
                } else {
                    MotionHistory::default()
                };
                let motion_penalty = motion.penalty(c.motion_cost_weight);
                let priority = color_priority + motion_penalty;
                step.sibling_rank = sibling;
                step.pose_flagged = flagged;
                step.branch_cutoff_bypassed = unrestricted;
                step.window_mismatch_rate = rate;
                step.window_mismatch_penalty = penalty;
                step.queue_priority = priority;
                if c.motion_cost_weight > 0. {
                    step.recent_motion_penalty = Some(motion_penalty);
                    step.required_tps_ratio = Some(ratio);
                }
                let child = Node {
                    context: context.clone(),
                    priority,
                    color_priority,
                    parent: Some(id),
                    step: Some(SavedStep::new(step, c.diagnostics)),
                    window,
                    motion,
                    expanded: false,
                };
                let side = &mut self.sides[direction];
                if !unrestricted && !preserve && admission > c.branch_widths[side.stage] {
                    let key = (admission, context);
                    if side
                        .deferred
                        .get(&key)
                        .is_none_or(|&old| side.nodes[old].priority > priority)
                    {
                        let id = side.nodes.len();
                        side.nodes.push(child);
                        side.deferred.insert(key, id);
                    }
                } else {
                    if let Some(id) = side.offer(child, direction, self.length, &mut self.stats) {
                        self.events.push(id);
                    }
                }
            }
            self.stats.peak_pending = self
                .stats
                .peak_pending
                .max(self.sides.iter().map(|s| s.pending.len()).sum());
        }
        self.stats.branch_stage = self.sides[1].stage;
        if self.stats.evaluated_states >= c.state_limit {
            self.backward_status = "state_limit";
        }
    }
    pub(super) fn run(
        &mut self,
        forward: &mut frontier::Frontier,
        t: &Tables,
        c: &Config,
        frames: &[Prepared],
        budget: usize,
    ) {
        if self.status != "running" {
            return;
        }
        let limit = forward.stats.evaluated_states + self.stats.evaluated_states + budget;
        while forward.stats.evaluated_states + self.stats.evaluated_states < limit {
            if forward.stats.evaluated_states >= c.state_limit
                && self.stats.evaluated_states >= c.state_limit {
                self.status = "state_limit";
                break;
            }
            let f_running = !matches!(
                forward.status.as_str(),
                "exhausted" | "state_limit" | "solved" | "already_solved"
            );
            let b_running = self.backward_status == "running";
            if !f_running && !b_running {
                self.status = if forward.status == "state_limit" || self.backward_status == "state_limit" {
                    "state_limit"
                } else { "exhausted" };
                break;
            }
            if f_running
                && (!b_running || forward.stats.evaluated_states <= self.stats.evaluated_states)
            {
                forward.run(t, c, frames, true, 1);
                for id in forward.take_meeting_events() {
                    let (depth, state, cue) = forward.node_context(id).unwrap();
                    let context = Context {
                        depth,
                        state: state.to_vec(),
                        cue,
                    };
                    self.forward_meetings.entry(context.clone()).or_insert(id);
                    if let Some(&other) = self.backward_meetings.get(&context) {
                        self.winner = Some((id, Some(other)));
                        self.status = "solved";
                        break;
                    }
                }
                if let Some(id) = forward.winner {
                    self.winner = Some((id, None));
                    self.status = "solved";
                }
            } else {
                self.run_backward(t, c, frames, 1);
                for id in self.take_events() {
                    let context = &self.sides[1].nodes[id].context;
                    self.backward_meetings.entry(context.clone()).or_insert(id);
                    if let Some(&other) = self.forward_meetings.get(context) {
                        self.winner = Some((other, Some(id)));
                        self.status = "solved";
                        break;
                    }
                }
            }
            if self.status != "running" {
                break;
            }
        }
        if self.status == "running"
            && forward.stats.evaluated_states >= c.state_limit
            && self.stats.evaluated_states >= c.state_limit
        {
            self.status = "state_limit";
        }
    }
    pub(super) fn take_events(&mut self) -> Vec<usize> {
        std::mem::take(&mut self.events)
    }
    pub(super) fn anchor_frame(&self, frames: &[Prepared]) -> usize {
        frames[self.length - 1].frame
    }
    pub(super) fn node(&self, id: usize) -> Option<(usize, &[u8], Option<usize>)> {
        self.sides[1]
            .nodes
            .get(id)
            .map(|n| (n.context.depth, n.context.state.as_slice(), n.context.cue))
    }
    pub(super) fn node_path(&self, id: usize) -> Option<Vec<SavedStep>> {
        self.sides[1].nodes.get(id)?;
        Some(self.sides[1].path(id, true))
    }
    pub(super) fn fragment(&self, mut id:usize)->Option<serde_json::Value>{
        let root=self.sides[1].nodes.get(id)?;let depth=root.context.depth;let state=root.context.state.clone();let cue=root.context.cue;
        let mut steps=vec![];
        while let Some(parent)=self.sides[1].nodes.get(id)?.parent {
            let node=&self.sides[1].nodes[id];let after=&self.sides[1].nodes[parent];
            let mut step=serde_json::to_value(node.step.as_ref()?).ok()?;
            let bank=step["geometry_option_index"].as_u64().map(|n|n as usize);
            let selected=bank.map(|bank|step["orientation_symmetry_index"].as_u64().map_or(bank,|sym|6+24*bank+sym as usize));
            step["state_after"]=serde_json::to_value(&after.context.state).ok()?;
            step["cue_after"]=after.context.cue.or(selected).into();steps.push(step);id=parent;
        }
        Some(serde_json::json!({"depth":depth,"state":state,"cue":cue,"steps":steps}))
    }
    pub(super) fn backward_snapshot(&self, frames: &[Prepared]) -> serde_json::Value {
        serde_json::json!({"status":self.backward_status,"stats":self.stats,"search_direction":"bidirectional",
            "frames_received":frames.len(),"frames_prepared":frames.len(),"frames_searchable":frames.len(),
            "pending":self.sides[1].pending.len(),"deferred":self.sides[1].deferred.len(),"blocked":0,"ended":true,
            "steps":[],"solved_frame_index":null,"solved_anchor_frame":frames[self.length-1].frame})
    }
    pub(super) fn snapshot(
        &self,
        forward: &frontier::Frontier,
        frames: &[Prepared],
    ) -> serde_json::Value {
        let mut result = forward.snapshot(frames, 0, true);
        let stats = result["stats"].as_object_mut().unwrap();
        let back = serde_json::to_value(&self.stats).unwrap();
        for key in [
            "evaluated_states",
            "attempted_transitions",
            "dominated_pruned",
            "reopened_states",
            "improved_pending",
            "deferred_promoted",
            "unsolved_endpoints",
            "flagged_expanded_states",
        ] {
            stats.insert(
                key.into(),
                (stats[key].as_u64().unwrap() + back[key].as_u64().unwrap()).into(),
            );
        }
        stats.insert(
            "branch_stage".into(),
            forward
                .stats
                .branch_stage
                .max(self.stats.branch_stage)
                .into(),
        );
        stats.insert(
            "peak_pending".into(),
            (forward.stats.peak_pending + self.stats.peak_pending).into(),
        );
        stats.insert(
            "forward_expanded".into(),
            forward.stats.evaluated_states.into(),
        );
        stats.insert(
            "backward_expanded".into(),
            self.stats.evaluated_states.into(),
        );
        let winner = self.winner.or_else(|| forward.winner.map(|id| (id, None)));
        result["status"] = if winner.is_some() {
            "solved"
        } else {
            self.status
        }
        .into();
        result["search_direction"] = "bidirectional".into();
        result["solved_anchor_frame"] = frames[self.length - 1].frame.into();
        result["pending"] =
            (result["pending"].as_u64().unwrap() + self.sides[1].pending.len() as u64).into();
        result["deferred"] =
            (result["deferred"].as_u64().unwrap() + self.sides[1].deferred.len() as u64).into();
        if let Some((id, backward)) = winner {
            let mut path = forward.node_path(id).unwrap();
            if let Some(backward) = backward {
                path.extend(self.sides[1].path(backward, true));
            }
            result["solved_frame_index"] = path.last().map(SavedStep::frame_index).into();
            result["furthest_admitted_frames"] = path.len().into();
            let depth = forward.node_context(id).unwrap().0;
            result["join_frame_index"] = if backward.is_some() {
                depth.checked_sub(1).map(|i| frames[i].frame).into()
            } else {
                serde_json::Value::Null
            };
            result["steps"] = serde_json::to_value(path).unwrap();
        }
        result
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::move_search::{Engine, Frame};

    fn inputs(scramble: &str) -> (Config, Vec<Frame>) {
        let t = Tables::load();
        let colors = t.colors(scramble).unwrap();
        let goal = t.solved_seeds(scramble).unwrap().remove(0);
        let frames = (0..4)
            .map(|sequence| {
                let state = if sequence == 0 { &t.identity } else { &goal };
                let colors = t
                    .geometry_positions
                    .iter()
                    .map(|&position| colors[state[position] as usize].clone())
                    .collect();
                Frame {
                    sequence,
                    frame: sequence * 2,
                    bank: vec![crate::Fit {
                        axis: 0,
                        params: [0.; 8],
                        angles: [0.; 3],
                        score: 0.,
                        recovery_score_components: None,
                        source: "bidirectional test".into(),
                        flat_fallback: true,
                        metrics: crate::Metrics {
                            inlier_count: 54,
                            keypoint_inlier_count: 54,
                            ..Default::default()
                        },
                        nearest: (0..54).collect(),
                        valid: vec![true; 54],
                        assignment_objects: vec![],
                        assignment_projected: vec![],
                        assignment_classes: vec![],
                    }],
                    colors,
                    landmark_count: Some(54),
                    flagged: Some(false),
                    geometry_flagged: Some(false),
                }
            })
            .collect();
        (
            Config {
                scramble: scramble.into(),
                fps: 60.,
                bidirectional: true,
                motion_cost_weight: 0.025,
                state_limit: 10000,
                ..Config::default()
            },
            frames,
        )
    }
    fn finish(engine: &mut Engine, budget: usize) -> serde_json::Value {
        for _ in 0..10000 {
            engine.advance(budget);
            if engine.snapshot()["status"] != "running" {
                return engine.snapshot();
            }
        }
        panic!("search did not terminate");
    }
    #[test]
    fn solved_seeds_invert_scrambles_in_all_rigid_orientations() {
        let t = Tables::load();
        for scramble in ["R U R' U'", "r U’ x R2'", "F2 U' L' U2 F D2"] {
            let colors = t.colors(scramble).unwrap();
            let seeds = t.solved_seeds(scramble).unwrap();
            assert_eq!(seeds.len(), 24);
            assert!(seeds.iter().all(|s| t.solved(s, &colors)));
        }
    }
    #[test]
    fn fitting_must_close_before_either_direction_expands_and_end_is_idempotent() {
        let (config, frames) = inputs("R");
        let mut engine = Engine::new(config).unwrap();
        for frame in frames {
            engine.push(frame).unwrap();
            engine.advance(100);
            assert_eq!(engine.snapshot()["stats"]["evaluated_states"], 0);
        }
        engine.end().unwrap();
        engine.advance(1);
        assert_eq!(engine.snapshot()["stats"]["evaluated_states"], 1);
        engine.end().unwrap();
        assert_eq!(engine.snapshot()["stats"]["evaluated_states"], 1);
        let result = finish(&mut engine, 1);
        assert_eq!(result["status"], "solved");
        assert_eq!(result["search_direction"], "bidirectional");
    }
    #[test]
    fn stitched_steps_replay_through_forward_probes_and_solve_the_scramble() {
        let (config, frames) = inputs("R");
        let t = Tables::load();
        let colors = t.colors(&config.scramble).unwrap();
        let mut engine = Engine::new(config).unwrap();
        for frame in &frames {
            engine.push(frame.clone()).unwrap();
        }
        engine.end().unwrap();
        let result = finish(&mut engine, 3);
        assert_eq!(result["status"], "solved");
        let mut state = t.identity.clone();
        let mut cue = None;
        for (sequence, step) in result["steps"].as_array().unwrap().iter().enumerate() {
            let choices = engine.probe(sequence, state.clone(), cue).unwrap();
            let matched = choices["choices"]
                .as_array()
                .unwrap()
                .iter()
                .find(|choice| {
                    choice["state_moves"] == step["state_moves"]
                        && choice["geometry_option_index"] == step["geometry_option_index"]
                        && choice["orientation_symmetry_index"]
                            == step["orientation_symmetry_index"]
                });
            assert!(
                matched.is_some(),
                "stitched edge must be a real forward edge"
            );
            for name in step["state_moves"].as_array().unwrap() {
                state = t.moves[name.as_str().unwrap()]
                    .iter()
                    .map(|&i| state[i])
                    .collect();
            }
            cue = step["geometry_option_index"].as_u64().map(|i| i as usize);
        }
        assert!(t.solved(&state, &colors));
    }
    #[test]
    fn diagnostics_and_cooperative_chunk_size_do_not_change_the_solution() {
        let (config, frames) = inputs("R");
        let mut results = vec![];
        for (diagnostics, budget) in [(true, 1), (true, 128), (false, 7)] {
            let mut engine = Engine::new(Config {
                diagnostics,
                ..config.clone()
            })
            .unwrap();
            for frame in &frames {
                engine.push(frame.clone()).unwrap();
            }
            engine.end().unwrap();
            results.push(finish(&mut engine, budget));
        }
        assert_eq!(results[0], results[1]);
        assert_eq!(results[0]["stats"], results[2]["stats"]);
        for (detailed, essential) in results[0]["steps"]
            .as_array()
            .unwrap()
            .iter()
            .zip(results[2]["steps"].as_array().unwrap())
        {
            for (key, value) in essential.as_object().unwrap() {
                assert_eq!(detailed[key], *value);
            }
            assert!(essential.get("queue_priority").is_none());
        }
    }
    #[test]
    fn a_missing_solved_anchor_falls_back_to_forward_after_fitting() {
        let (config, mut frames) = inputs("R");
        for frame in &mut frames {
            frame.bank.clear();
            frame.colors.clear();
        }
        let mut engine = Engine::new(config).unwrap();
        for frame in frames {
            engine.push(frame).unwrap();
        }
        engine.end().unwrap();
        assert_eq!(engine.snapshot()["search_direction"], "forward");
        assert!(engine.snapshot()["bidirectional_fallback"].is_string());
        assert_eq!(finish(&mut engine, 16)["status"], "exhausted");
    }
    #[test]
    fn each_direction_retains_its_full_expansion_budget() {
        let (config, frames) = inputs("R U F");
        let mut engine = Engine::new(Config {
            state_limit: 1,
            ..config
        })
        .unwrap();
        for frame in frames {
            engine.push(frame).unwrap();
        }
        engine.end().unwrap();
        let result = finish(&mut engine, 128);
        assert_eq!(result["status"], "state_limit");
        assert_eq!(result["stats"]["evaluated_states"], 2);
        assert_eq!(
            result["stats"]["forward_expanded"].as_u64().unwrap()
                + result["stats"]["backward_expanded"].as_u64().unwrap(),
            2
        );
    }
    #[test]
    fn backward_work_does_not_change_any_forward_progress_snapshot() {
        let (config, frames) = inputs("R U");
        let mut plain = Engine::new(Config {
            bidirectional: false,
            ..config.clone()
        })
        .unwrap();
        let mut paired = Engine::new(config).unwrap();
        for frame in frames {
            plain.push(frame.clone()).unwrap();
            paired.push(frame).unwrap();
        }
        plain.end().unwrap();
        paired.end().unwrap();
        for _ in 0..1000 {
            // Arbitrary reverse work may populate mechanical caches, but must
            // never change the forward queue, admission, history, or dominance.
            paired.advance_side(1, 7).unwrap();
            let actual = paired.advance_side(0, 1).unwrap();
            plain.advance(1);
            let expected = plain.snapshot();
            assert_eq!(actual["stats"], expected["stats"]);
            assert_eq!(actual["steps"], expected["steps"]);
            assert_eq!(actual["status"], expected["status"]);
            if actual["status"] != "running" {
                break;
            }
        }
    }
    #[test]
    fn cleanup_runs_for_serial_and_parallel_forward_winners_without_changing_expansions() {
        let (config, frames) = inputs("R");
        for parallel in [false,true] {
            let mut outputs=vec![];
            for enabled in [false,true] {
                let mut engine=Engine::new(Config{postprocess_identity_loops:enabled,postprocess_pose_cleanup:enabled,..config.clone()}).unwrap();
                for frame in &frames {engine.push(frame.clone()).unwrap();}engine.end().unwrap();
                let result=if parallel {
                    let mut result=engine.snapshot();
                    for _ in 0..100 {result=engine.advance_side(0,128).unwrap();if result["status"]!="running" {break;}}
                    result
                } else {finish(&mut engine,128)};
                assert_eq!(result["status"],"solved");
                assert_eq!(result.get("postprocess").is_some(),enabled);
                assert!(result["postprocess"].get("error").is_none());
                outputs.push(result);
            }
            assert_eq!(outputs[0]["steps"],outputs[1]["steps"]);
            assert_eq!(outputs[0]["stats"],outputs[1]["stats"]);
        }
    }
    #[test]
    fn remote_fragments_rebase_across_all_cube_pose_bases_without_changing_forward_search() {
        let (config,frames)=inputs("R");let t=Tables::load();let goal=t.solved_seeds("R").unwrap().remove(0);
        let mut changed_notation=false;
        for symmetry in 0..24 {
            if symmetry==super::super::orientations::tables().identity_index {continue;}
            let mut engine=Engine::new(Config{postprocess_identity_loops:true,resolve_orientation_ambiguity:true,max_rotation_tps:Some(20.),..config.clone()}).unwrap();
            for frame in &frames {engine.push(frame.clone()).unwrap();}engine.end().unwrap();
            let initial=engine.advance_side(0,1).unwrap();
            let id=initial["meeting_states"].as_array().unwrap().iter().find(|row|row[1]==1).unwrap()[0].as_u64().unwrap() as usize;
            let(_,state,_)=engine.frontier.node_context(id).unwrap();let state=state.to_vec();
            let perm=&super::super::orientations::tables().face_permutations[symmetry];
            let mut inverse=vec![0;54];
            for face in 0..54 {inverse[t.geometry_positions[perm[face]]]=t.geometry_positions[face];}
            let before:Vec<_>=inverse.iter().map(|&i|state[i]).collect();
            let after:Vec<_>=inverse.iter().map(|&i|goal[i]).collect();
            let cue=6+symmetry;
            let options=engine.probe(1,before.clone(),Some(cue)).unwrap();
            let choice=options["choices"].as_array().unwrap().iter().find(|choice|{
                if choice["geometry_option_index"]!=0||choice["orientation_symmetry_index"].as_u64()!=Some(symmetry as u64){return false;}
                let mut state=before.clone();for name in choice["state_moves"].as_array().unwrap(){state=t.moves[name.as_str().unwrap()].iter().map(|&i|state[i]).collect();}state==after
            }).expect("a rotated copy of the ordinary R-prime transition");
            let mut step=choice.clone();step["state_after"]=serde_json::json!(after);step["cue_after"]=cue.into();
            changed_notation|=step["state_moves"]!=serde_json::json!(["R'"]);
            let result=engine.complete_join(id,vec![step],Some(before),serde_json::json!({"evaluated_states":1})).unwrap();
            assert_eq!(result["status"],"solved");
            assert_eq!(result["postprocess"]["color_aggregation"],"segment_mean");
            assert!(result["postprocess"].get("error").is_none());
            assert_eq!(result["steps"][1]["state_moves"],serde_json::json!(["R'"]));
            assert!(result["steps"][1]["orientation_symmetry_index"].is_null());
            assert_eq!(engine.frontier.stats.evaluated_states,1);
        }
        assert!(changed_notation,"test must exercise a real move-basis transformation");
    }
    #[test]
    fn reverse_rows_are_inverses_of_forward_rows_and_keep_their_motion_caps() {
        let (config, frames) = inputs("R");
        let mut engine = Engine::new(Config {
            resolve_orientation_ambiguity: true,
            max_rotation_tps: Some(20.),
            ..config
        })
        .unwrap();
        for frame in frames {
            engine.push(frame).unwrap();
        }
        engine.end().unwrap();
        let mut search = engine.bidirectional.take().unwrap();
        let goals = engine.tables.solved_seeds("R").unwrap();
        let index = search.length - 1;
        let node = root(goals[0].clone(), search.length);
        let candidates = search.candidates(&engine.tables, &engine.frames, 1, &node);
        assert!(!candidates.is_empty());
        for candidate in candidates {
            let c = candidate.choice;
            let mut after = c.state.clone();
            for name in &c.step.state_moves {
                after = engine.tables.moves[name]
                    .iter()
                    .map(|&i| after[i])
                    .collect();
            }
            assert_eq!(after, node.context.state);
            assert!(c.step.angular_travel_degrees <= c.step.rotation_budget_degrees + 1e-6);
            if let Some(m) = c.step.cube_rotation_motion {
                assert!(m.rigid_degrees <= c.step.cube_rotation_budget_degrees.unwrap() + 1e-6);
                assert!(m.combined_degrees <= c.step.rotation_budget_degrees + 1e-6);
            }
            let probe = engine.probe(index, c.state, c.cue).unwrap();
            assert!(probe["choices"]
                .as_array()
                .unwrap()
                .iter()
                .any(
                    |s| s["state_moves"] == serde_json::json!(c.step.state_moves)
                        && s["geometry_option_index"]
                            == serde_json::json!(c.step.geometry_option_index)
                        && s["orientation_symmetry_index"]
                            == serde_json::json!(c.step.orientation_symmetry_index)
                ));
        }
    }
}

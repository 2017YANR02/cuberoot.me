//! Synchronous counterpart of the buffered host. Startup selection may depend
//! on finalized earlier poses, so complete passes cannot run stage-by-stage.
//! Each frame still runs the same numerical stages once, with immutable initial
//! neighbors and the same recovery window. Reference eligibility depends only
//! on source time, never on worker completion order.
use super::*;

struct Sequence<'a> {
    g: &'a Geometry,
    input: &'a Input,
    startups: Vec<Option<Pose>>,
    reference_cores: Vec<Option<V2>>,
    motion_allowances: Vec<f64>,
    anchors: Vec<usize>,
    initial: Vec<Vec<Fit>>,
    temporal: Vec<Vec<Fit>>,
    oriented: Vec<Vec<Fit>>,
    final_banks: Vec<Vec<Fit>>,
    targets: Vec<Option<f64>>,
    recovered: Vec<bool>,
    initial_cursor: usize,
    final_cursor: usize,
    previous: Option<Pose>,
    orientation_reference: Option<jobs::Reference>,
    core_history: Vec<startup::FinalizedCore>,
    has_startup: bool,
}
impl Sequence<'_> {
    fn neighbor(&mut self, i: usize) {
        let neighbors = [i.checked_sub(1), Some(i + 1)]
            .into_iter()
            .flatten()
            .filter_map(|j| self.initial.get(j).and_then(|b| b.first()).map(pose))
            .collect();
        let frame = &self.input.frames[i];
        self.temporal[i] = jobs::neighbors(
            self.g,
            frame,
            self.initial[i].clone(),
            neighbors,
            static_frame(self.input, frame),
        );
        self.orient(i);
    }
    fn orient(&mut self,i:usize) {
        let frame = &self.input.frames[i];
        let bank = jobs::orient(
            self.g,
            frame,
            self.temporal[i].clone(),
            &self.input.expected_center_colors,
            self.orientation_reference.as_ref(),
            self.input.fps,
        );
        self.oriented[i]=bank;
        self.orientation_reference = jobs::next_reference(frame, &self.oriented[i], self.orientation_reference.take());
    }
    fn advance_initial(&mut self, selected: usize, eof: bool) {
        while self.initial_cursor < selected {
            let i = self.initial_cursor;
            let frame = &self.input.frames[i];
            let source = self.startups[i]
                .clone()
                .or_else(|| self.previous.clone())
                .or_else(|| self.startups[i + 1..selected].iter().find_map(Clone::clone));
            if source.is_none()
                && frame.observations.points.len() >= 3
                && !frame.observations.stickers.is_empty()
                && !eof
            {
                break;
            }
            self.initial[i] = jobs::initial(
                self.g,
                frame,
                source,
                self.previous.clone(),
                static_frame(self.input, frame),
            );
            if let Some(first) = self.initial[i].first() {
                self.previous = Some(pose(first));
            }
            self.initial_cursor += 1;
            if i > 0 {
                self.neighbor(i - 1);
            }
        }
        if eof && selected > 0 && self.initial_cursor == selected {
            self.neighbor(selected - 1);
        }
    }
    fn finalize(&mut self, i: usize) {
        let frame = &self.input.frames[i];
        let mut bank = self.oriented[i].clone();
        if !bank.is_empty() && self.startups[i].is_some() && !static_frame(self.input, frame) {
            let time = frame.frame as f64 / self.input.fps;
            let (mut lo, mut hi) = (i, i);
            while lo > 0 && time - self.input.frames[lo - 1].frame as f64 / self.input.fps <= 0.18 {
                lo -= 1;
            }
            while hi + 1 < self.input.frames.len()
                && self.input.frames[hi + 1].frame as f64 / self.input.fps - time <= 0.18
            {
                hi += 1;
            }
            let anchors = self
                .anchors
                .iter()
                .copied()
                .filter(|&a| a >= lo && a <= hi)
                .map(|a| a - lo)
                .collect::<Vec<_>>();
            self.targets[i] = depth::targets_from_anchors(
                &self.input.frames[lo..=hi],
                &self.startups[lo..=hi],
                &anchors,
                self.input.fps,
            )[i - lo];
            if let Some(target) = self.targets[i] {
                (bank, self.recovered[i]) = depth::recover(
                    self.g,
                    frame,
                    self.startups[i].as_ref().unwrap(),
                    bank,
                    target,
                );
            }
        }
        if let Some(core) = jobs::continuity_core(frame, &bank) {
            self.core_history.push(startup::FinalizedCore {
                frame: frame.frame,
                core,
            });
            if self.core_history.len() > 2 {
                self.core_history.remove(0);
            }
        }
        // All initial, orientation and continuity state above uses the original
        // score-first bank. Only the immutable final output is simplified.
        self.final_banks[i] = if let Some(first) = bank.first() {
            let w = work(frame, &pose(first), None, vec![], vec![], false);
            crate::final_bank::select(self.g, &w, &bank).bank
        } else { bank };
    }
}

pub(super) fn run(g: &Geometry, input: &Input) -> Result<Output, String> {
    opencv::diagnostic("CPU pipeline: finalized_unflagged_core_startup");
    let n = input.frames.len();
    let mut s = Sequence {
        g,
        input,
        startups: vec![None; n],
        reference_cores: vec![None; n],
        motion_allowances: vec![0.; n],
        anchors: vec![],
        initial: vec![vec![]; n],
        temporal: vec![vec![]; n],
        oriented: vec![vec![]; n],
        final_banks: vec![vec![]; n],
        targets: vec![None; n],
        recovered: vec![false; n],
        initial_cursor: 0,
        final_cursor: 0,
        previous: None,
        orientation_reference: None,
        core_history: vec![],
        has_startup: false,
    };
    for (i, frame) in input.frames.iter().enumerate() {
        while s.has_startup
            && s.final_cursor + 1 < i
            && frame.frame as f64 / input.fps
                - input.frames[s.final_cursor].frame as f64 / input.fps
                > 0.18
        {
            s.finalize(s.final_cursor);
            s.final_cursor += 1;
        }
        let candidates = startup::seeds(
            g,
            &startup::Input {
                width: frame.width,
                height: frame.height,
                observations: frame.observations.clone(),
                landmark_presence: frame.landmark_presence.clone(),
            },
        );
        let (reference, allowance) = startup::selection_context(&s.core_history, frame.frame);
        s.reference_cores[i] = reference;
        s.motion_allowances[i] = allowance;
        s.startups[i] = startup::select_seed_with_allowance(&candidates, reference, allowance)
            .map(|c| c.pose.clone());
        if let Some(p) = &s.startups[i] {
            s.has_startup = true;
            if jobs::anchor(g, frame, p) {
                s.anchors.push(i);
            }
        }
        s.advance_initial(i + 1, i + 1 == n);
    }
    while s.final_cursor < n {
        s.finalize(s.final_cursor);
        s.final_cursor += 1;
    }
    let stages = input.capture_stages.then(|| {
        let mut map = std::collections::BTreeMap::new();
        let mut state = State {
            startups: s.startups.clone(),
            startup_reference_cores: s.reference_cores.clone(),
            startup_motion_allowances: s.motion_allowances.clone(),
            ..State::default()
        };
        map.insert("startup".into(), state.clone());
        state.depth_targets = s.targets.clone();
        map.insert("depth_targets".into(), state.clone());
        for (label, banks) in [
            ("initial", &s.initial),
            ("neighbors", &s.temporal),
            ("orientation", &s.oriented),
        ] {
            state.banks = banks.clone();
            map.insert(label.into(), state.clone());
        }
        state.banks = s.final_banks.clone();
        state.recovered = s.recovered.clone();
        map.insert("recovery".into(), state);
        map
    });
    Ok(Output {
        frames: input
            .frames
            .iter()
            .enumerate()
            .map(|(i, f)| FrameOutput {
                frame: f.frame,
                startup: s.startups[i].clone(),
                startup_reference_core: s.reference_cores[i],
                startup_motion_allowance: s.motion_allowances[i],
                bank: s.final_banks[i].clone(),
                depth_recovery: s.recovered[i],
            })
            .collect(),
        stages,
    })
}

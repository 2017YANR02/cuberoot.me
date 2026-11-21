//! Buffered CPU pipeline: independent camera seeds, immutable-neighbor refit,
//! color/continuity orientation, and sparse depth/outlier recovery.
use crate::{
    math::*, opencv, projection, search, solver, startup, Camera, Fit, Geometry, Observations,
    Pose, Workload,
};
use nalgebra::{DMatrix, DVector};
use serde::{Deserialize, Serialize};

#[derive(Clone, Deserialize)]
pub struct Frame {
    pub frame: usize,
    pub width: f64,
    pub height: f64,
    pub observations: Observations,
    #[serde(default)]
    pub landmark_presence: Vec<f64>,
    pub colors: Vec<String>,
    pub pixel_scale: f64,
}
#[derive(Clone, Deserialize)]
pub struct Center {
    pub axis: usize,
    pub side: i32,
    pub color: String,
}
#[derive(Clone, Deserialize)]
pub struct Input {
    pub frames: Vec<Frame>,
    pub fps: f64,
    pub turning_start_frame: Option<usize>,
    pub expected_center_colors: Vec<Center>,
    #[serde(default)]
    pub capture_stages: bool,
}
#[derive(Serialize)]
pub struct Output {
    pub frames: Vec<FrameOutput>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stages: Option<std::collections::BTreeMap<String, State>>,
}
#[derive(Serialize)]
pub struct FrameOutput {
    pub frame: usize,
    pub startup: Option<Pose>,
    pub startup_reference_core: Option<V2>,
    pub startup_motion_allowance: f64,
    pub bank: Vec<Fit>,
    pub depth_recovery: bool,
}
fn pose(f: &Fit) -> Pose {
    Pose {
        rvec: [f.params[0], f.params[1], f.params[2]],
        tvec: [f.params[3], f.params[4], f.params[5]],
    }
}
fn work(
    frame: &Frame,
    camera: &Pose,
    prior: Option<Pose>,
    neighbors: Vec<Pose>,
    retained: Vec<Fit>,
    static_mode: bool,
) -> Workload {
    let input = startup::Input {
        width: frame.width,
        height: frame.height,
        observations: frame.observations.clone(),
        landmark_presence: frame.landmark_presence.clone(),
    };
    let mut c = startup::camera(&input);
    c.rvec = camera.rvec;
    c.tvec = camera.tvec;
    Workload {
        name: "pipeline".into(),
        frame: frame.frame,
        stage: "initial_geometry".into(),
        camera: c,
        observations: frame.observations.clone(),
        prior,
        neighbors,
        retained,
        static_mode,
        refinement_traces: vec![],
    }
}
fn mean_prior(g: &Geometry, base: &Pose, neighbors: &[Pose]) -> Pose {
    let reference = rodrigues(base.rvec).0;
    let delta = neighbors.iter().fold([0.; 3], |a, n| {
        add(
            a,
            matrix_rvec(mm(
                search::align(g, n.rvec, reference),
                transpose(reference),
            )),
        )
    });
    Pose {
        rvec: matrix_rvec(mm(
            rodrigues(scale(delta, 1. / neighbors.len() as f64)).0,
            reference,
        )),
        tvec: scale(
            neighbors.iter().fold([0.; 3], |a, n| add(a, n.tvec)),
            1. / neighbors.len() as f64,
        ),
    }
}

pub mod assignment;
pub mod depth;
pub mod jobs;
pub mod orientation;
mod sequence;
#[cfg(test)]
mod tests;

#[derive(Clone, Default, Serialize, Deserialize)]
pub struct State {
    #[serde(default)]
    pub startup_reference_cores: Vec<Option<V2>>,
    #[serde(default)]
    pub startup_motion_allowances: Vec<f64>,
    #[serde(default)]
    pub startups: Vec<Option<Pose>>,
    #[serde(default)]
    pub depth_targets: Vec<Option<f64>>,
    #[serde(default)]
    pub banks: Vec<Vec<Fit>>,
    #[serde(default)]
    pub recovered: Vec<bool>,
}
#[derive(Clone, Copy, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Stage {
    Startup,
    DepthTargets,
    Initial,
    Neighbors,
    Orientation,
    Recovery,
}
#[derive(Deserialize)]
pub struct StageRequest {
    pub stage: Stage,
    pub input: Input,
    #[serde(default)]
    pub state: State,
}
fn static_frame(input: &Input, f: &Frame) -> bool {
    input
        .turning_start_frame
        .is_some_and(|start| f.frame <= start)
}

pub fn startup_pass(
    g: &Geometry,
    input: &Input,
    reference_cores: &[Option<V2>],
    allowances: &[f64],
) -> Vec<Option<Pose>> {
    input
        .frames
        .iter()
        .enumerate()
        .map(|(i, frame)| {
            let seeds = startup::seeds(
                g,
                &startup::Input {
                    width: frame.width,
                    height: frame.height,
                    observations: frame.observations.clone(),
                    landmark_presence: frame.landmark_presence.clone(),
                },
            );
            startup::select_seed_with_allowance(
                &seeds,
                reference_cores[i],
                allowances.get(i).copied().unwrap_or(0.),
            )
            .map(|seed| seed.pose.clone())
        })
        .collect()
}
pub fn initial_pass(g: &Geometry, input: &Input, startups: &[Option<Pose>]) -> Vec<Vec<Fit>> {
    let mut banks = vec![];
    let mut previous = None;
    for (i, frame) in input.frames.iter().enumerate() {
        let source = startups[i]
            .clone()
            .or_else(|| previous.clone())
            .or_else(|| startups[i + 1..].iter().find_map(Clone::clone));
        let bank = if let Some(source) = source {
            let w = work(
                frame,
                &source,
                previous.clone(),
                vec![],
                vec![],
                static_frame(input, frame),
            );
            search::fit_frame(g, &w, &mut vec![])
        } else {
            vec![]
        };
        if let Some(first) = bank.first() {
            previous = Some(pose(first))
        }
        banks.push(bank);
    }
    banks
}
pub fn neighbor_pass(g: &Geometry, input: &Input, banks: &[Vec<Fit>]) -> Vec<Vec<Fit>> {
    let initial: Vec<_> = banks.iter().map(|b| b.first().map(pose)).collect();
    let mut revised = banks.to_vec();
    for (i, frame) in input.frames.iter().enumerate() {
        if banks[i].is_empty() {
            continue;
        }
        let neighbors: Vec<_> = [i.checked_sub(1), Some(i + 1)]
            .into_iter()
            .flatten()
            .filter_map(|i| initial.get(i).and_then(Clone::clone))
            .collect();
        if neighbors.is_empty() {
            continue;
        }
        let base = pose(&banks[i][0]);
        let prior = mean_prior(g, &base, &neighbors);
        let w = work(
            frame,
            &base,
            Some(prior),
            neighbors,
            banks[i].clone(),
            static_frame(input, frame),
        );
        revised[i] = search::fit_frame(g, &w, &mut vec![]);
    }
    revised
}
pub fn orientation_pass(g: &Geometry, input: &Input, banks: &[Vec<Fit>]) -> Vec<Vec<Fit>> {
    let mut revised = banks.to_vec();
    let mut reference = None;
    for (i, frame) in input.frames.iter().enumerate() {
        if banks[i].is_empty() {
            continue;
        }
        let bank = jobs::orient(
            g,
            frame,
            banks[i].clone(),
            &input.expected_center_colors,
            reference.as_ref(),
            input.fps,
        );
        revised[i]=bank;
        reference=jobs::next_reference(frame,&revised[i],reference);
    }
    revised
}
pub fn recovery_pass(g: &Geometry, input: &Input, state: &State) -> (Vec<Vec<Fit>>, Vec<bool>) {
    let mut banks = state.banks.clone();
    let mut recovered = vec![false; input.frames.len()];
    for (i, frame) in input.frames.iter().enumerate() {
        if !static_frame(input, frame) {
            if let (Some(source), Some(target)) = (&state.startups[i], state.depth_targets[i]) {
                (banks[i], recovered[i]) =
                    depth::recover(g, frame, source, banks[i].clone(), target);
            }
        }
    }
    (banks, recovered)
}
fn validate_input(input: &Input) -> Result<(), String> {
    if !input.fps.is_finite() || input.fps <= 0. {
        return Err("fps must be positive".into());
    }
    if !input.expected_center_colors.is_empty()
        && (input.expected_center_colors.len() != 6
            || input
                .expected_center_colors
                .iter()
                .any(|c| c.axis > 2 || ![-1, 1].contains(&c.side))
            || input
                .expected_center_colors
                .iter()
                .enumerate()
                .any(|(i, c)| {
                    input.expected_center_colors[..i]
                        .iter()
                        .any(|p| p.axis == c.axis && p.side == c.side)
                }))
    {
        return Err(
            "Expected center colors must contain all six distinct face normals, or be empty".into(),
        );
    }
    for (i, frame) in input.frames.iter().enumerate() {
        if frame.width <= 0.
            || frame.height <= 0.
            || !frame.pixel_scale.is_finite()
            || frame.pixel_scale <= 0.
            || frame.observations.points.len() != frame.observations.classes.len()
            || frame.observations.stickers.len() != frame.colors.len()
            || (!frame.landmark_presence.is_empty()
                && frame.landmark_presence.len() != frame.observations.points.len())
            || (!frame.observations.uncertainties.is_empty()
                && frame.observations.uncertainties.len() != frame.observations.stickers.len())
        {
            return Err(format!(
                "Invalid observation dimensions or pixel scale at frame {}",
                frame.frame
            ));
        }
        if i > 0 && input.frames[i - 1].frame >= frame.frame {
            return Err("Frame indices must increase strictly".into());
        }
    }
    Ok(())
}

pub fn run_stage(g: &Geometry, request: StageRequest) -> Result<State, String> {
    let StageRequest {
        stage,
        input,
        mut state,
    } = request;
    validate_input(&input)?;
    let n = input.frames.len();
    if matches!(stage, Stage::Startup) && state.startup_reference_cores.len() != n {
        return Err("Startup stage requires explicit reference cores; use pipeline_json for automatic finalized-unflagged references".into());
    }
    if matches!(stage, Stage::Startup)
        && !state.startup_motion_allowances.is_empty()
        && (state.startup_motion_allowances.len() != n
            || state
                .startup_motion_allowances
                .iter()
                .any(|v| !v.is_finite() || *v < 0.))
    {
        return Err(
            "Startup motion allowances must be finite, nonnegative and match the frame sequence"
                .into(),
        );
    }
    if matches!(
        stage,
        Stage::DepthTargets | Stage::Initial | Stage::Recovery
    ) && state.startups.len() != n
    {
        return Err("Startup checkpoint does not match frame sequence".into());
    }
    if matches!(
        stage,
        Stage::Neighbors | Stage::Orientation | Stage::Recovery
    ) && state.banks.len() != n
    {
        return Err("Geometry checkpoint does not match frame sequence".into());
    }
    if matches!(stage, Stage::Recovery) && state.depth_targets.len() != n {
        return Err("Depth-target checkpoint does not match frame sequence".into());
    }
    match stage {
        Stage::Startup => {
            state.startups = startup_pass(
                g,
                &input,
                &state.startup_reference_cores,
                &state.startup_motion_allowances,
            )
        }
        Stage::DepthTargets => {
            state.depth_targets = depth::depth_targets(g, &input.frames, &state.startups, input.fps)
        }
        Stage::Initial => state.banks = initial_pass(g, &input, &state.startups),
        Stage::Neighbors => state.banks = neighbor_pass(g, &input, &state.banks),
        Stage::Orientation => state.banks = orientation_pass(g, &input, &state.banks),
        Stage::Recovery => (state.banks, state.recovered) = recovery_pass(g, &input, &state),
    }
    Ok(state)
}
pub fn run(g: &Geometry, input: Input) -> Result<Output, String> {
    validate_input(&input)?;
    sequence::run(g, &input)
}

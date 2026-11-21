pub mod browser;
pub mod final_bank;
pub mod move_search;
mod math;
#[cfg(feature = "cpu-pipeline")]
mod opencv;
#[cfg(feature = "cpu-pipeline")]
pub mod pipeline;
mod projection;
mod search;
mod solver;
#[cfg(feature = "cpu-pipeline")]
pub mod startup;
pub use math::{M3, V2, V3};
use serde::{Deserialize, Serialize};
#[derive(Clone, Serialize, Deserialize)]
pub struct AxisGeometry {
    pub points: Vec<V3>,
    pub normals: Vec<[V3; 3]>,
    pub masks: Vec<[bool; 3]>,
    pub classes: Vec<i32>,
    pub layers: Vec<usize>,
    pub face_layers: Vec<usize>,
    pub point_aliases: Vec<usize>,
    pub face_aliases: Vec<usize>,
}
#[derive(Clone, Serialize, Deserialize)]
pub struct Geometry {
    pub faces: Vec<[V3; 4]>,
    pub face_normals: Vec<V3>,
    pub corners: Vec<V3>,
    pub symmetries: Vec<M3>,
    pub cube_size: f64,
    pub assignment_fraction: f64,
    pub sticker_scale: f64,
    pub axes: Vec<AxisGeometry>,
}
#[derive(Clone, Serialize, Deserialize)]
pub struct Pose {
    pub rvec: V3,
    pub tvec: V3,
}
#[derive(Clone, Serialize, Deserialize)]
pub struct Camera {
    pub rvec: V3,
    pub tvec: V3,
    pub k: M3,
    pub dist: Vec<f64>,
}
#[derive(Clone, Serialize, Deserialize)]
pub struct Observations {
    pub points: Vec<V2>,
    pub classes: Vec<i32>,
    pub stickers: Vec<V2>,
    pub uncertainties: Vec<f64>,
}
#[derive(Clone, Serialize, Deserialize)]
pub struct Workload {
    pub name: String,
    pub frame: usize,
    pub stage: String,
    pub camera: Camera,
    pub observations: Observations,
    pub prior: Option<Pose>,
    pub neighbors: Vec<Pose>,
    pub retained: Vec<Fit>,
    pub static_mode: bool,
    #[serde(default)]
    pub refinement_traces: Vec<SolverProbe>,
}
#[derive(Clone, Serialize, Deserialize, Default)]
pub struct Metrics {
    pub keypoint_error: f64,
    pub sticker_error: f64,
    pub combined_mean_error: f64,
    pub robust_error: f64,
    pub p90_error: f64,
    pub inlier_count: usize,
    pub layer_inlier_count: usize,
    pub keypoint_inlier_count: usize,
    pub keypoint_layer_inlier_count: usize,
    pub sticker_match_count: usize,
    pub layer_support: [usize; 3],
}
#[derive(Clone, Serialize, Deserialize)]
pub struct RecoveryScoreComponents {
    /// Sum of capped landmark/sticker reprojection losses (not detector scores).
    pub observation_loss: f64,
    pub pose_prior_loss: f64,
    pub active_layers: usize,
    pub observation_count: usize,
    pub reprojection_weight: f64,
}
impl RecoveryScoreComponents {
    pub fn cost(&self) -> f64 {
        (0.5 * (self.reprojection_weight * self.observation_loss + self.pose_prior_loss)
            + self.active_layers as f64)
            / self.observation_count.max(1) as f64
    }
}
#[derive(Clone, Serialize, Deserialize)]
pub struct Fit {
    pub axis: usize,
    pub params: [f64; 8],
    pub angles: [f64; 3],
    pub score: f64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub recovery_score_components: Option<RecoveryScoreComponents>,
    pub source: String,
    #[serde(default)]
    pub flat_fallback: bool,
    pub metrics: Metrics,
    pub nearest: Vec<usize>,
    pub valid: Vec<bool>,
    pub assignment_objects: Vec<V3>,
    pub assignment_projected: Vec<V2>,
    pub assignment_classes: Vec<i32>,
}
#[derive(Clone, Serialize, Deserialize)]
pub struct SolverProbe {
    axis: usize,
    seed: [f64; 8],
    output: [f64; 8],
    prior: [f64; 6],
    mask: [bool; 2],
    nfev: usize,
    status: i32,
    cost: f64,
}
#[derive(Deserialize)]
pub struct Probe {
    workload: usize,
    axis: usize,
    params: [f64; 8],
    dist: Vec<f64>,
    residual: Vec<f64>,
    jacobian: Vec<Vec<f64>>,
    diameter: f64,
    #[serde(default)]
    corners: Vec<V2>,
}
#[derive(Deserialize)]
pub struct SweepProbe {
    workload: usize,
    camera: Pose,
    scores: Vec<f64>,
}
#[derive(Deserialize)]
pub struct FixtureSet {
    geometry: Geometry,
    pub workloads: Vec<Workload>,
    probes: Vec<Probe>,
    #[serde(default)]
    sweep_probes: Vec<SweepProbe>,
}
#[derive(Clone, Serialize, Deserialize)]
pub struct RefinementTrace {
    axis: usize,
    seed_score: Option<f64>,
    seed: [f64; 8],
    output: [f64; 8],
    nfev: usize,
    status: i32,
    cost: f64,
}
#[derive(Serialize)]
pub struct FitResult {
    pub bank: Vec<Fit>,
    pub refinements: Vec<RefinementTrace>,
}
/// Run the complete CPU-policy geometry fitter on one already filtered workload.
pub fn fit_frame(geometry: &Geometry, workload: &Workload) -> FitResult {
    let mut refinements = vec![];
    let bank = search::fit_frame(geometry, workload, &mut refinements);
    FitResult { bank, refinements }
}
pub fn fit_case(set: &FixtureSet, index: usize) -> FitResult {
    fit_frame(&set.geometry, &set.workloads[index])
}
pub fn check_probes(set: &FixtureSet) -> serde_json::Value {
    let mut circle_error = 0f64;
    let mut residual_error = 0f64;
    let mut jacobian_error = 0f64;
    let mut diameter_error = 0f64;
    for p in &set.probes {
        if !p.corners.is_empty() {
            circle_error = circle_error.max((math::diameter(&p.corners) - p.diameter).abs());
        }
        let mut w = set.workloads[p.workload].clone();
        w.camera.dist = p.dist.clone();
        let (r, j) = projection::evaluate(&set.geometry, &w, p.axis, &p.params);
        for (a, b) in r.iter().zip(&p.residual) {
            residual_error = residual_error.max((a - b).abs());
        }
        for (i, row) in j.iter().enumerate() {
            for (k, a) in row.iter().enumerate() {
                jacobian_error = jacobian_error.max((a - p.jacobian[i][k]).abs());
            }
        }
        diameter_error = diameter_error.max(
            (projection::cube_diameter(
                &set.geometry,
                &w.camera,
                [p.params[0], p.params[1], p.params[2]],
                [p.params[3], p.params[4], p.params[5]],
            ) - p.diameter)
                .abs(),
        );
    }
    serde_json::json!({"probes":set.probes.len(),"circle_reference_max_abs":circle_error,"residual_max_abs":residual_error,"jacobian_max_abs":jacobian_error,"diameter_max_abs":diameter_error})
}
#[cfg(target_arch = "wasm32")]
mod wasm;

pub fn check_solvers(set: &FixtureSet) -> serde_json::Value {
    let mut max_param = 0f64;
    let mut max_cost = 0f64;
    let mut stops = 0;
    let mut count = 0;
    for w in &set.workloads {
        for p in &w.refinement_traces {
            let r = solver::refine(&set.geometry, w, p.axis, p.seed, p.prior, p.mask);
            for i in 0..8 {
                max_param = max_param.max((r.params[i] - p.output[i]).abs());
            }
            max_cost = max_cost.max((r.cost - p.cost).abs());
            stops += usize::from((r.nfev, r.status) != (p.nfev, p.status));
            count += 1;
        }
    }
    serde_json::json!({"solves":count,"parameter_max_abs":max_param,"cost_max_abs":max_cost,"stopping_differences":stops})
}

pub fn check_sweeps(set: &FixtureSet) -> serde_json::Value {
    let mut score_error = 0f64;
    let mut rows = 0;
    let mut length_differences = 0;
    for p in &set.sweep_probes {
        let fits = search::sweep(&set.geometry, &set.workloads[p.workload], &p.camera);
        length_differences += usize::from(fits.len() != p.scores.len());
        for (fit, expected) in fits.iter().zip(&p.scores) {
            score_error = score_error.max((fit.score - expected).abs());
            rows += 1;
        }
    }
    serde_json::json!({"cameras":set.sweep_probes.len(),"rows":rows,"score_max_abs":score_error,"length_differences":length_differences})
}

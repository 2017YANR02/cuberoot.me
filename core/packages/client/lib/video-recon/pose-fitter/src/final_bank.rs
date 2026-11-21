//! Final output alternatives. Internal fitting, camera seeds, continuity anchors
//! and recovery keep the original score-first bank. Weakly supported slabs can
//! flatten; a weak middle is re-expressed through the rigid pose while keeping
//! supported outer slab geometry fixed.
use crate::{
    math::{axis_rotation, matrix_rvec, mm, rodrigues},
    search, Fit, Geometry, Workload,
};
use serde::Serialize;
use std::{cmp::Ordering, collections::HashMap};

#[derive(Default, Clone, Serialize)]
pub struct Diagnostics {
    pub attempted_materializations: usize,
    pub qualified_variants: usize,
    pub selected_replacements: usize,
}
pub struct Output {
    pub bank: Vec<Fit>,
    pub diagnostics: Diagnostics,
}
fn flatter(a: &Fit, b: &Fit, g: &Geometry) -> Ordering {
    let active = |f: &Fit| f.angles.iter().filter(|&&a| a != 0.).count();
    let travel = |f: &Fit| f.angles.iter().map(|a| a.abs()).sum::<f64>();
    active(a)
        .cmp(&active(b))
        .then_with(|| travel(a).total_cmp(&travel(b)))
        .then_with(|| search::cost(g, &a.metrics).total_cmp(&search::cost(g, &b.metrics)))
}
fn qualifies(g: &Geometry, parent: &Fit, candidate: &Fit) -> bool {
    search::cost(g, &candidate.metrics) <= search::cost(g, &parent.metrics) + 1e-9
        || same_assignments(parent, candidate)
}
fn same_assignments(parent: &Fit, candidate: &Fit) -> bool {
    candidate.valid == parent.valid
        && candidate.nearest.len() == parent.nearest.len()
        && candidate
            .nearest
            .iter()
            .zip(&parent.nearest)
            .zip(&parent.valid)
            .all(|((&a, &b), &valid)| !valid || a == b)
}
/// Generate at most three alternatives, without any solver or camera call.
/// Support is the existing geometric-proximity count, not detector confidence
/// or a count of distinct assigned sticker/landmark objects.
pub fn alternatives(g: &Geometry, w: &Workload, parent: &Fit) -> (Vec<Fit>, Diagnostics) {
    alternatives_with_middle(g, w, parent, true)
}
fn alternatives_with_middle(
    g: &Geometry,
    w: &Workload,
    parent: &Fit,
    allow_middle: bool,
) -> (Vec<Fit>, Diagnostics) {
    let weak = [
        parent.params[6] != 0. && parent.metrics.layer_support[0] <= 1,
        parent.params[7] != 0. && parent.metrics.layer_support[2] <= 1,
    ];
    let mut diagnostics = Diagnostics::default();
    let mut fits = vec![];
    for mask in [[true, false], [false, true], [true, true]] {
        if !(mask[0] || mask[1]) || (mask[0] && !weak[0]) || (mask[1] && !weak[1]) {
            continue;
        }
        let mut params = parent.params;
        if mask[0] {
            params[6] = 0.;
        }
        if mask[1] {
            params[7] = 0.;
        }
        diagnostics.attempted_materializations += 1;
        if let Some(mut candidate) = search::materialize(g, w, parent.axis, params) {
            if qualifies(g, parent, &candidate) {
                candidate.source = "final_weak_layer_flatten".into();
                diagnostics.qualified_variants += 1;
                fits.push(candidate);
            }
        }
    }
    // The middle slab is represented by the rigid pose, not a third angle.
    // Align a weak middle to either supported outer slab, then re-express all
    // three slab angles in that middle frame. Optional weak outers can flatten
    // in the same proposal; supported slab projections remain fixed.
    if allow_middle && parent.metrics.layer_support[1] <= 1 {
        for anchor in [0, 2] {
            let angle = parent.angles[anchor];
            if parent.metrics.layer_support[anchor] <= 1 || angle == 0. {
                continue;
            }
            for mask in [[false, false], [true, false], [false, true], [true, true]] {
                if (mask[0] && parent.metrics.layer_support[0] > 1)
                    || (mask[1] && parent.metrics.layer_support[2] > 1)
                {
                    continue;
                }
                let mut angles = parent.angles;
                angles[1] = angle;
                if mask[0] {
                    angles[0] = angle;
                }
                if mask[1] {
                    angles[2] = angle;
                }
                let rotation = mm(
                    rodrigues([parent.params[0], parent.params[1], parent.params[2]]).0,
                    axis_rotation(parent.axis, angle),
                );
                let mut params = parent.params;
                params[..3].copy_from_slice(&matrix_rvec(rotation));
                params[6] = (angles[0] - angle + 45.).rem_euclid(90.) - 45.;
                params[7] = (angles[2] - angle + 45.).rem_euclid(90.) - 45.;
                // materialize snaps sub-half-degree angles to zero. Do not
                // let that convention move a supported outer slab on rebasing.
                if [(0, 6), (2, 7)].iter().any(|&(layer, param)| {
                    parent.metrics.layer_support[layer] > 1
                        && params[param].abs() > 1e-9
                        && params[param].abs() < 0.5
                }) {
                    continue;
                }
                diagnostics.attempted_materializations += 1;
                if let Some(mut candidate) = search::materialize(g, w, parent.axis, params) {
                    if qualifies(g, parent, &candidate) {
                        candidate.source = "final_weak_middle_flatten".into();
                        diagnostics.qualified_variants += 1;
                        fits.push(candidate);
                    }
                }
            }
        }
    }
    (fits, diagnostics)
}
/// Freeze the first five original regular fits, select their qualified flatter
/// alternatives, then fill any merged assignment groups from the originals.
/// The original full-flat fallback is preserved outside the five-fit quota and
/// never competes as a regular representative.
pub fn select(g: &Geometry, w: &Workload, bank: &[Fit]) -> Output {
    let original: Vec<_> = bank
        .iter()
        .filter(|f| !f.flat_fallback)
        .take(5)
        .cloned()
        .collect();
    let flat = bank.iter().find(|f| f.flat_fallback).cloned();
    let Some(first) = original.first() else {
        return Output {
            bank: flat.into_iter().collect(),
            diagnostics: Diagnostics::default(),
        };
    };
    let reference = rodrigues([first.params[0], first.params[1], first.params[2]]).0;
    let mut diagnostics = Diagnostics::default();
    let mut preferred = vec![];
    // A weaker interpretation must not erase middle-layer evidence already
    // established by the best fit. The same <=1 support threshold gates the
    // middle extension; ordinary outer-layer cleanup is unchanged.
    let allow_middle = first.metrics.layer_support[1] <= 1;
    for parent in &original {
        let (alternatives, count) = alternatives_with_middle(g, w, parent, allow_middle);
        diagnostics.attempted_materializations += count.attempted_materializations;
        diagnostics.qualified_variants += count.qualified_variants;
        let best = alternatives
            .into_iter()
            .fold(parent.clone(), |best, candidate| {
                if flatter(&candidate, &best, g).is_lt() {
                    candidate
                } else {
                    best
                }
            });
        preferred.push(best);
    }
    let mut signatures = HashMap::new();
    let mut permutations = vec![None; g.symmetries.len()];
    let mut selected: Vec<Fit> = vec![];
    for mut fit in preferred.into_iter().chain(original.iter().cloned()) {
        fit.flat_fallback = false;
        let signature = search::assignment_key(g, &fit, reference, &mut permutations);
        if let Some(&index) = signatures.get(&signature) {
            if flatter(&fit, &selected[index], g).is_lt() {
                selected[index] = fit;
            }
        } else if selected.len() < 5 {
            signatures.insert(signature, selected.len());
            selected.push(fit);
        }
    }
    diagnostics.selected_replacements = selected
        .iter()
        .filter(|fit| {
            !original
                .iter()
                .any(|old| fit.axis == old.axis && fit.params == old.params)
        })
        .count();
    if let Some(flat) = flat {
        selected.push(flat);
    }
    Output {
        bank: selected,
        diagnostics,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn weak_middle_case(frame: usize) -> (Geometry, Workload, Vec<Fit>) {
        let fixture: serde_json::Value =
            serde_json::from_str(include_str!("../tests/fixtures/weak-middle-flat.json")).unwrap();
        let geometry: serde_json::Value =
            serde_json::from_str(include_str!("../tests/fixtures/final-bank-reviewed.json"))
                .unwrap();
        let g: Geometry = serde_json::from_value(geometry["geometry"].clone()).unwrap();
        let c = fixture["cases"]
            .as_array()
            .unwrap()
            .iter()
            .find(|c| c["frame"]["frame"] == frame)
            .unwrap();
        let bank: Vec<Fit> = serde_json::from_value(c["bank"].clone()).unwrap();
        let p = bank[0].params;
        let width = c["frame"]["width"].as_f64().unwrap();
        let height = c["frame"]["height"].as_f64().unwrap();
        let focal = width.max(height) * 1.2;
        let w = Workload {
            name: "single-layer".into(),
            frame,
            stage: "final".into(),
            camera: crate::Camera {
                rvec: [p[0], p[1], p[2]],
                tvec: [p[3], p[4], p[5]],
                k: [
                    [focal, 0., width / 2.],
                    [0., focal, height / 2.],
                    [0., 0., 1.],
                ],
                dist: vec![0.; 4],
            },
            observations: serde_json::from_value(c["frame"]["observations"].clone()).unwrap(),
            prior: None,
            neighbors: vec![],
            retained: vec![],
            static_mode: false,
            refinement_traces: vec![],
        };
        (g, w, bank)
    }
    #[test]
    fn single_layer_ambiguity_is_flat_without_moving_observed_geometry() {
        for frame in [71, 73, 89] {
            let (g, w, bank) = weak_middle_case(frame);
            let before = serde_json::to_value(&bank).unwrap();
            let output = select(&g, &w, &bank);
            let parent = &bank[0];
            let flat = &output.bank[0];
            assert_eq!(parent.metrics.layer_support[0..2], [0, 0]);
            assert_eq!(flat.source, "final_weak_middle_flatten");
            assert_eq!(flat.angles, [0.; 3]);
            assert_eq!(flat.params[3..6], parent.params[3..6]);
            assert!(same_assignments(parent, flat));
            assert!(parent
                .assignment_projected
                .iter()
                .zip(&flat.assignment_projected)
                .all(|(&a, &b)| crate::math::distance(a, b) <= 1e-6));
            assert_eq!(serde_json::to_value(&bank).unwrap(), before);
            assert_eq!(
                serde_json::to_value(output.bank.last().unwrap()).unwrap(),
                serde_json::to_value(bank.last().unwrap()).unwrap()
            );
        }
    }
    #[test]
    fn supported_multilayer_best_fit_cannot_be_flattened_by_a_weaker_hypothesis() {
        for frame in [99, 105, 119] {
            let (g, w, bank) = weak_middle_case(frame);
            let output = select(&g, &w, &bank);
            assert_eq!(
                serde_json::to_value(output.bank).unwrap(),
                serde_json::to_value(bank).unwrap(),
                "frame {frame}"
            );
        }
    }
    #[test]
    fn middle_uses_the_same_support_threshold_as_outer_layers() {
        let (g, w, bank) = weak_middle_case(71);
        let mut parent = bank[0].clone();
        parent.metrics.layer_support[1] = 2;
        let (fits, d) = alternatives(&g, &w, &parent);
        assert_eq!(d.attempted_materializations, 0);
        assert!(fits.is_empty());
        parent.metrics.layer_support[1] = 1;
        let (fits, d) = alternatives(&g, &w, &parent);
        assert!(d.attempted_materializations > 0);
        assert!(fits.iter().any(|fit| fit.angles == [0.; 3]));
    }
    #[test]
    fn weak_middle_generalizes_to_two_supported_outer_layers() {
        let (g, w, bank) = weak_middle_case(620);
        let parent = &bank[0];
        assert!(parent.metrics.layer_support[0] > 1 && parent.metrics.layer_support[2] > 1);
        assert_eq!(parent.metrics.layer_support[1], 1);
        let (fits, d) = alternatives(&g, &w, parent);
        assert_eq!(d.attempted_materializations, 2);
        assert!(!fits.is_empty());
        let old = rodrigues([parent.params[0], parent.params[1], parent.params[2]]).0;
        for fit in fits {
            let new = rodrigues([fit.params[0], fit.params[1], fit.params[2]]).0;
            for layer in [0, 2] {
                let a = mm(old, axis_rotation(parent.axis, parent.angles[layer]));
                let b = mm(new, axis_rotation(fit.axis, fit.angles[layer]));
                assert!(a
                    .iter()
                    .flatten()
                    .zip(b.iter().flatten())
                    .all(|(a, b)| (a - b).abs() < 1e-9));
            }
            assert!(qualifies(&g, parent, &fit));
        }
    }
    #[test]
    fn rebasing_cannot_snap_away_a_supported_outer_difference() {
        let (g, w, bank) = weak_middle_case(620);
        let mut parent = bank[0].clone();
        parent.angles[2] = parent.angles[0] + 0.2;
        parent.params[7] = parent.angles[2];
        let (fits, diagnostics) = alternatives(&g, &w, &parent);
        assert_eq!(diagnostics.attempted_materializations, 0);
        assert!(fits.is_empty());
    }
    fn case(frame: usize) -> (Geometry, Workload, Vec<Fit>) {
        let fixture: serde_json::Value =
            serde_json::from_str(include_str!("../tests/fixtures/final-bank-reviewed.json"))
                .unwrap();
        let g: Geometry = serde_json::from_value(fixture["geometry"].clone()).unwrap();
        let c = fixture["cases"]
            .as_array()
            .unwrap()
            .iter()
            .find(|c| c["frame"]["frame"] == frame)
            .unwrap();
        let bank: Vec<Fit> = serde_json::from_value(c["bank"].clone()).unwrap();
        let params = bank[0].params;
        let width = c["frame"]["width"].as_f64().unwrap();
        let height = c["frame"]["height"].as_f64().unwrap();
        let focal = width.max(height) * 1.2;
        let w = Workload {
            name: "final-bank-policy-test".into(),
            frame,
            stage: "final_output".into(),
            camera: crate::Camera {
                rvec: [params[0], params[1], params[2]],
                tvec: [params[3], params[4], params[5]],
                k: [
                    [focal, 0., width / 2.],
                    [0., focal, height / 2.],
                    [0., 0., 1.],
                ],
                dist: vec![0.; 4],
            },
            observations: serde_json::from_value(c["frame"]["observations"].clone()).unwrap(),
            prior: None,
            neighbors: vec![],
            retained: vec![],
            static_mode: false,
            refinement_traces: vec![],
        };
        (g, w, bank)
    }
    #[test]
    fn support_gate_preserves_observed_layer_and_frozen_camera() {
        let (g, w, bank) = case(124);
        let parent = &bank[0];
        assert_eq!(parent.metrics.layer_support[0], 1);
        assert!(parent.metrics.layer_support[2] > 1);
        let (candidates, d) = alternatives(&g, &w, parent);
        assert_eq!(d.attempted_materializations, 1);
        assert_eq!(candidates.len(), 1);
        let fit = &candidates[0];
        assert_eq!(&fit.params[..6], &parent.params[..6]);
        assert_eq!(fit.params[6], 0.);
        assert_eq!(fit.params[7], parent.params[7]);
        assert_eq!(fit.axis, parent.axis);
        assert!(qualifies(&g, parent, fit));
    }
    #[test]
    fn unchanged_assignments_allow_worse_reprojection_without_quality_window() {
        let (g, w, bank) = case(118);
        let mut parent = bank[0].clone();
        // Isolate the acceptance predicate from its independently tested gate.
        parent.metrics.layer_support[2] = 1;
        let (candidates, d) = alternatives(&g, &w, &parent);
        assert_eq!(d.attempted_materializations, 1);
        let fit = &candidates[0];
        assert!(search::cost(&g, &fit.metrics) > search::cost(&g, &parent.metrics) + 0.01);
        assert_eq!(fit.valid, parent.valid);
        assert_eq!(fit.nearest, parent.nearest);
        assert_eq!(fit.params[6], parent.params[6]);
        assert_eq!(fit.params[7], 0.);
    }
    #[test]
    fn better_reprojection_can_accept_a_different_assignment() {
        let (g, w, bank) = case(120);
        let mut parent = bank[4].clone();
        parent.metrics.layer_support[0] = 1;
        let (candidates, _) = alternatives(&g, &w, &parent);
        let fit = candidates.iter().find(|fit| fit.params[6] == 0.).unwrap();
        assert!(search::cost(&g, &fit.metrics) < search::cost(&g, &parent.metrics));
        assert!(fit.nearest != parent.nearest || fit.valid != parent.valid);
        assert_eq!(fit.params[7], parent.params[7]);
    }
    #[test]
    fn invalid_assignment_placeholders_do_not_block_equivalence() {
        let (g, _, bank) = case(118);
        let mut parent = bank[0].clone();
        let mut fit = parent.clone();
        parent.valid[0] = false;
        fit.valid[0] = false;
        fit.nearest[0] = (parent.nearest[0] + 1) % 54;
        fit.metrics.keypoint_error = 10.;
        fit.metrics.sticker_error = 10.;
        assert!(qualifies(&g, &parent, &fit));
        fit.valid[0] = true;
        assert!(!qualifies(&g, &parent, &fit));
    }
    #[test]
    fn strong_layers_skip_work_and_fallback_never_promotes_into_regular_group() {
        let (g, w, bank) = case(118);
        let (candidates, d) = alternatives(&g, &w, &bank[0]);
        assert_eq!(d.attempted_materializations, 0);
        assert!(candidates.is_empty());
        let output = select(&g, &w, &bank);
        assert_eq!(output.bank[0].params, bank[0].params);
        assert!(output.bank.len() <= 6);
        assert!(output.bank.last().unwrap().flat_fallback);
        assert_eq!(
            output.bank.last().unwrap().params,
            bank.last().unwrap().params
        );
        assert!(output.bank[..output.bank.len() - 1]
            .iter()
            .all(|f| !f.flat_fallback));
    }
    #[test]
    fn both_weak_sides_try_single_masks_and_joint_at_most_once() {
        let (g, w, bank) = case(118);
        let mut parent = bank[0].clone();
        parent.metrics.layer_support = [0, 10, 1];
        let (candidates, d) = alternatives(&g, &w, &parent);
        assert_eq!(d.attempted_materializations, 3);
        assert!(candidates
            .iter()
            .any(|fit| fit.params[6] == 0. && fit.params[7] == 0.));
        for fit in candidates {
            assert_eq!(&fit.params[..6], &parent.params[..6]);
        }
    }
}

#[cfg(test)]
mod quota_tests {
    use super::*;
    #[test]
    fn output_has_unique_regular_signatures_and_keeps_original_fallback() {
        let fixture: serde_json::Value =
            serde_json::from_str(include_str!("../tests/fixtures/final-bank-reviewed.json"))
                .unwrap();
        let g: Geometry = serde_json::from_value(fixture["geometry"].clone()).unwrap();
        let c = fixture["cases"]
            .as_array()
            .unwrap()
            .iter()
            .find(|c| c["frame"]["frame"] == 124)
            .unwrap();
        let bank: Vec<Fit> = serde_json::from_value(c["bank"].clone()).unwrap();
        let p = bank[0].params;
        let raw = &c["frame"];
        let width = raw["width"].as_f64().unwrap();
        let height = raw["height"].as_f64().unwrap();
        let focal = width.max(height) * 1.2;
        let w = Workload {
            name: "quota".into(),
            frame: 124,
            stage: "final".into(),
            camera: crate::Camera {
                rvec: [p[0], p[1], p[2]],
                tvec: [p[3], p[4], p[5]],
                k: [
                    [focal, 0., width / 2.],
                    [0., focal, height / 2.],
                    [0., 0., 1.],
                ],
                dist: vec![0.; 4],
            },
            observations: serde_json::from_value(raw["observations"].clone()).unwrap(),
            prior: None,
            neighbors: vec![],
            retained: vec![],
            static_mode: false,
            refinement_traces: vec![],
        };
        let before = serde_json::to_value(&bank).unwrap();
        let out = select(&g, &w, &bank);
        assert_eq!(
            serde_json::to_value(&bank).unwrap(),
            before,
            "Finalization must not mutate retained/internal fits"
        );
        let regular: Vec<_> = out.bank.iter().filter(|f| !f.flat_fallback).collect();
        assert_eq!(regular.len(), 5);
        let r = rodrigues([bank[0].params[0], bank[0].params[1], bank[0].params[2]]).0;
        let mut permutations = vec![None; g.symmetries.len()];
        let mut signatures = std::collections::HashSet::new();
        for fit in regular {
            assert!(signatures.insert(search::assignment_key(&g, fit, r, &mut permutations)));
        }
        assert_eq!(
            serde_json::to_value(out.bank.last()).unwrap(),
            serde_json::to_value(bank.last()).unwrap()
        );
        assert!(out.diagnostics.attempted_materializations > 0);
        assert!(out.diagnostics.selected_replacements > 0);
    }
}

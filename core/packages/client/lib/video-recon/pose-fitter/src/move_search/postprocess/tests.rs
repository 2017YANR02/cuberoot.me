use super::*;
use crate::move_search::{Engine, Frame};

fn recording(
    scramble: &str,
    moves: &[&[&str]],
    hold_observations: bool,
    positions: Option<Vec<usize>>,
) -> (Engine, Value) {
    let t = Tables::load();
    let colors = t.colors(scramble).unwrap();
    let mut state = t.identity.clone();
    let mut states = vec![];
    for names in moves {
        for name in *names {
            state = apply(&t, &state, name).unwrap();
        }
        states.push(state.clone());
    }
    assert!(t.solved(&state, &colors));
    let mut engine = Engine::new(Config {
        scramble: scramble.into(),
        fps: 15.,
        resolve_orientation_ambiguity: true,
        postprocess_identity_loops: true,
        ..Config::default()
    })
    .unwrap();
    let faces = positions.unwrap_or_else(|| (0..54).collect());
    for (index, observed) in states.iter().enumerate() {
        let observed = if hold_observations && index + 1 < moves.len() {
            &t.identity
        } else {
            observed
        };
        let fit = crate::Fit {
            axis: 0,
            params: [0.; 8],
            angles: [0.; 3],
            score: 0.,
            source: "cleanup test".into(),
            recovery_score_components: None,
            flat_fallback: true,
            metrics: crate::Metrics {
                inlier_count: 54,
                keypoint_inlier_count: 54,
                ..Default::default()
            },
            nearest: faces.clone(),
            valid: vec![true; faces.len()],
            assignment_objects: vec![],
            assignment_projected: vec![],
            assignment_classes: vec![],
        };
        engine
            .push(Frame {
                sequence: index,
                frame: index + 1,
                bank: vec![fit],
                colors: faces
                    .iter()
                    .map(|&f| colors[observed[t.geometry_positions[f]] as usize].clone())
                    .collect(),
                landmark_count: Some(54),
                flagged: Some(false),
                geometry_flagged: Some(false),
            })
            .unwrap();
    }
    engine.end().unwrap();
    let steps: Vec<_> = moves
        .iter()
        .enumerate()
        .map(|(i, names)| {
            json!({"frame_index":i+1,"geometry_option_index":0,
        "previous_geometry_index":0,"state_moves":names,"pose_flagged":false})
        })
        .collect();
    let result = json!({"status":"solved","ended":true,"steps":steps,"solved_frame_index":moves.len(),"stats":{"evaluated_states":77}});
    (engine, result)
}
fn names(result: &Value) -> Vec<String> {
    result["steps"]
        .as_array()
        .unwrap()
        .iter()
        .flat_map(|s| s["state_moves"].as_array().unwrap())
        .map(|n| n.as_str().unwrap().to_string())
        .collect()
}

#[test]
fn removes_a_long_identity_and_keeps_frames_final_state_and_search_stats() {
    let (engine, raw) = recording(
        "F",
        &[&["R"], &["L"], &["R'"], &["L'"], &["F'"]],
        true,
        None,
    );
    let cleaned = engine.postprocess_result(raw.clone()).unwrap();
    assert_eq!(names(&cleaned), ["F'"]);
    assert_eq!(cleaned["steps"].as_array().unwrap().len(), 5);
    assert_eq!(cleaned["stats"], raw["stats"]);
    assert_eq!(cleaned["solved_frame_index"], raw["solved_frame_index"]);
    assert_eq!(cleaned["unprocessed_steps"], raw["steps"]);
    assert_eq!(cleaned["postprocess"]["removed_moves"], 4);
    assert_eq!(cleaned["postprocess"]["removed_sections"], 1);
}
#[test]
fn recognizes_noncommuting_identity_sequences_by_state_and_reprocessing_is_idempotent() {
    let mut moves: Vec<&[&str]> = vec![];
    for _ in 0..6 {
        moves.extend([&["R"][..], &["U"][..], &["R'"][..], &["U'"][..]]);
    }
    moves.push(&["F'"]);
    let (engine, raw) = recording("F", &moves, true, None);
    let cleaned = engine.postprocess_result(raw).unwrap();
    assert_eq!(names(&cleaned), ["F'"]);
    assert_eq!(cleaned["postprocess"]["removed_moves"], 24);
    assert_eq!(engine.postprocess_result(cleaned.clone()).unwrap(), cleaned);
}
#[test]
fn retains_identity_sections_supported_by_visible_colors() {
    let (engine, raw) = recording(
        "F",
        &[&["R"], &["L"], &["R'"], &["L'"], &["F'"]],
        false,
        None,
    );
    let cleaned = engine.postprocess_result(raw.clone()).unwrap();
    assert_eq!(cleaned["steps"], raw["steps"]);
    assert_eq!(cleaned["postprocess"]["removed_moves"], 0);
}
#[test]
fn explores_disjoint_layer_orderings_but_never_reorders_noncommuting_moves() {
    for turn in ["R", "M", "Rw"] {
        let inverse = format!("{turn}'");
        let (engine, raw) = recording("L'", &[&[turn], &["L", &inverse]], true, None);
        let cleaned = engine.postprocess_result(raw).unwrap();
        assert_eq!(names(&cleaned), ["L"], "{turn}");
        assert_eq!(cleaned["postprocess"]["removed_moves"], 2);
    }
    let (engine, raw) = recording("R U' R'", &[&["R"], &["U", "R'"]], true, None);
    let cleaned = engine.postprocess_result(raw.clone()).unwrap();
    assert_eq!(cleaned["steps"], raw["steps"]);
    assert_eq!(cleaned["postprocess"]["simultaneous_frames"], 0);
}
#[test]
fn explores_all_three_disjoint_slabs_without_a_full_solution_cartesian_product() {
    let (engine, raw) = recording("L'", &[&["R"], &["M"], &["L", "R'", "M'"]], true, None);
    let cleaned = engine.postprocess_result(raw).unwrap();
    assert_eq!(names(&cleaned), ["L"]);
    assert_eq!(cleaned["postprocess"]["removed_moves"], 4);
}
#[test]
fn handles_cycles_within_one_frame_and_prefers_fewer_sections_on_a_tie() {
    let (engine, raw) = recording("F", &[&["R", "L", "R'", "L'", "F'"]], false, None);
    assert_eq!(names(&engine.postprocess_result(raw).unwrap()), ["F'"]);
    let (engine, raw) = recording(
        "F",
        &[&["R"], &["R'"], &["R"], &["R'"], &["F'"]],
        true,
        None,
    );
    let cleaned = engine.postprocess_result(raw).unwrap();
    assert_eq!(cleaned["postprocess"]["removed_sections"], 1);
    assert_eq!(cleaned["postprocess"]["removed_moves"], 4);
}
#[test]
fn accepts_exactly_two_percentage_points_but_rejects_a_smaller_allowance() {
    let t = Tables::load();
    let colors = t.colors("F").unwrap();
    let (turn, faces) = ["R2", "U2", "F2"]
        .into_iter()
        .find_map(|turn| {
            let after = apply(&t, &t.identity, turn).unwrap();
            let before_color =
                |face: usize| &colors[t.identity[t.geometry_positions[face]] as usize];
            let after_color = |face: usize| &colors[after[t.geometry_positions[face]] as usize];
            let changed = (0..54).find(|&f| {
                before_color(f) != after_color(f)
                    && !t.confusion[before_color(f)].contains(after_color(f))
            })?;
            let mut faces = vec![changed];
            faces.extend(
                (0..54)
                    .filter(|&f| before_color(f) == after_color(f))
                    .take(24),
            );
            (faces.len() == 25).then_some((turn, faces))
        })
        .unwrap();
    let (mut engine, raw) = recording("F", &[&[turn], &[turn], &["F'"]], false, Some(faces));
    let cleaned = engine.postprocess_result(raw.clone()).unwrap();
    assert_eq!(cleaned["postprocess"]["removed_moves"], 2);
    assert!(
        (cleaned["postprocess"]["max_segment_mean_color_increase"]
            .as_f64()
            .unwrap()
            - 0.02)
            .abs()
            < 1e-12
    );
    engine.config.postprocess_color_tolerance = 0.019;
    assert_eq!(
        names(&engine.postprocess_result(raw.clone()).unwrap()),
        names(&raw)
    );
}
#[test]
fn diagnostics_do_not_change_cleanup_and_invalid_solutions_are_rejected() {
    let (mut engine, raw) = recording("F", &[&["R"], &["R'"], &["F'"]], true, None);
    let detailed = engine.postprocess_result(raw.clone()).unwrap();
    engine.config.diagnostics = false;
    let essential = engine.postprocess_result(raw.clone()).unwrap();
    assert_eq!(names(&essential), names(&detailed));
    assert!(essential.get("unprocessed_steps").is_none());
    let mut bad = raw.clone();
    bad["steps"][0]["state_moves"] = json!(["bad"]);
    assert!(engine.postprocess_result(bad).is_err());
    let mut bad = raw;
    bad["steps"][2]["state_moves"] = json!([]);
    assert!(engine.postprocess_result(bad).is_err());
}
#[test]
fn segment_average_allows_a_bad_frame_but_does_not_dilute_with_missing_evidence() {
    let t = Tables::load();
    let colors = t.colors("F").unwrap();
    let after = apply(&t, &t.identity, "R2").unwrap();
    let changed = (0..54)
        .find(|&f| {
            colors[t.identity[t.geometry_positions[f]] as usize]
                != colors[after[t.geometry_positions[f]] as usize]
        })
        .unwrap();
    let mut faces = vec![changed];
    faces.extend(
        (0..54)
            .filter(|&f| {
                colors[t.identity[t.geometry_positions[f]] as usize]
                    == colors[after[t.geometry_positions[f]] as usize]
            })
            .take(24),
    );
    let (mut engine, raw) = recording(
        "F",
        &[&["R2"], &[], &[], &["R2"], &["F'"]],
        false,
        Some(faces),
    );
    // One frame has positive hold error; two other observed frames have zero.
    for frame in &mut engine.frames[1..3] {
        for geometry in &mut frame.geometries {
            geometry.observations.retain(|(face, _)| {
                colors[t.identity[t.geometry_positions[*face]] as usize]
                    == colors[after[t.geometry_positions[*face]] as usize]
            });
        }
    }
    let cleaned = engine.postprocess_result(raw.clone()).unwrap();
    assert_eq!(names(&cleaned), ["F'"]);
    let maximum = cleaned["postprocess"]["max_color_increase"]
        .as_f64()
        .unwrap();
    let average = cleaned["postprocess"]["max_segment_mean_color_increase"]
        .as_f64()
        .unwrap();
    assert!(maximum >= 0.02);
    assert!((average - maximum / 4.).abs() < 1e-12);
    assert_eq!(cleaned["postprocess"]["sections"][0]["scored_frames"], 4);
    engine.config.postprocess_color_tolerance = maximum * 0.3;
    assert_eq!(
        names(&engine.postprocess_result(raw.clone()).unwrap()),
        ["F'"]
    );
    for frame in &mut engine.frames[1..3] {
        for geometry in &mut frame.geometries {
            geometry.observations.clear();
        }
    }
    assert_eq!(
        names(&engine.postprocess_result(raw).unwrap()),
        ["R2", "R2", "F'"]
    );
}
#[test]
fn tightening_tolerance_rechecks_original_and_does_not_accumulate_changes() {
    let (mut engine, raw) = recording("F", &[&["R"], &["R'"], &["F'"]], false, None);
    engine.config.postprocess_color_tolerance = 1.;
    let cleaned = engine.postprocess_result(raw.clone()).unwrap();
    assert_eq!(names(&cleaned), ["F'"]);
    engine.config.postprocess_color_tolerance = 0.;
    let restored = engine.postprocess_result(cleaned).unwrap();
    assert_eq!(restored["steps"], raw["steps"]);
}
#[test]
fn automatic_processing_runs_once_after_a_real_forward_solution() {
    let (mut engine, _) = recording("F", &[&[], &["F'"]], true, None);
    engine.advance(10000);
    let result = engine.snapshot();
    assert_eq!(result["status"], "solved");
    assert!(result.get("postprocess").is_some());
    assert!(result["postprocess"].get("error").is_none());
    assert_eq!(engine.snapshot(), result);
    engine.advance(10000);
    assert_eq!(engine.snapshot(), result);
}
#[test]
fn simplifies_inverse_plus_half_turn_inside_one_frame_without_changing_observed_states() {
    for (scramble, moves, expected) in [
        ("R'", vec!["R'", "R2"], "R"),
        ("R", vec!["R", "R2"], "R'"),
        ("R'", vec!["R2", "R'"], "R"),
    ] {
        let (engine, raw) = recording(scramble, &[&moves], false, None);
        let cleaned = engine.postprocess_result(raw.clone()).unwrap();
        assert_eq!(names(&cleaned), [expected]);
        assert_eq!(cleaned["postprocess"]["simplified_moves"], 1);
        assert_eq!(cleaned["postprocess"]["simplified_frames"], 1);
        assert_eq!(cleaned["postprocess"]["removed_sections"], 0);
        assert_eq!(cleaned["postprocess"]["max_color_increase"], 0.);
        assert_eq!(cleaned["unprocessed_steps"], raw["steps"]);
        assert_eq!(engine.postprocess_result(cleaned.clone()).unwrap(), cleaned);
    }
    let t = Tables::load();
    let moves = ["L", "R'", "R2"].map(String::from).to_vec();
    let simpler = simplify_frame(&t, moves.clone());
    assert_eq!(simpler.len(), 2);
    let replay = |names: Vec<String>| {
        names.iter().fold(t.identity.clone(), |state, name| {
            apply(&t, &state, name).unwrap()
        })
    };
    assert_eq!(replay(moves), replay(simpler));
    let noncommuting = ["R'", "U", "R2"].map(String::from).to_vec();
    assert_eq!(simplify_frame(&t, noncommuting.clone()), noncommuting);
}
#[test]
fn normalization_preserves_every_sticker_with_the_corresponding_pose_basis() {
    let t = Tables::load();
    let orientations = super::super::orientations::tables();
    for name in t.moves.keys() {
        for old in 0..24 {
            let original = json!({"frame_index":1,"state_moves":[name],"geometry_option_index":0,"orientation_symmetry_index":old});
            let normalized = normalize::normalize(&t, &[original]).unwrap().remove(0);
            let mut actual = t.identity.clone();
            for token in normalized["state_moves"].as_array().unwrap() {
                actual = apply(&t, &actual, token.as_str().unwrap()).unwrap();
            }
            let raw = apply(&t, &t.identity, name).unwrap();
            let new = normalized["orientation_symmetry_index"]
                .as_u64()
                .map(|i| i as usize)
                .unwrap_or(orientations.identity_index);
            // Same sticker at the same base-fit surface, for all input pose bases.
            for face in 0..54 {
                assert_eq!(
                    actual[t.geometry_positions[orientations.face_permutations[new][face]]],
                    raw[t.geometry_positions[orientations.face_permutations[old][face]]],
                    "{name}, {old}, {face}"
                );
            }
        }
    }
}
#[test]
fn pose_cleanup_can_use_a_better_existing_fit_but_never_worse_geometry() {
    let (mut engine, mut raw) = recording("F", &[&["R"], &["R'"], &["F'"]], false, None);
    let (held_engine, _) = recording("F", &[&["R"], &["R'"], &["F'"]], true, None);
    engine.config.postprocess_pose_cleanup = true;
    let mut selected = engine.frames[0].geometries[0].clone();
    selected.index = 1;
    selected.bank_index = 1;
    selected.score = 0.5;
    engine.frames[0].geometries[0].observations =
        held_engine.frames[0].geometries[0].observations.clone();
    engine.frames[0].geometries.push(selected);
    raw["steps"][0]["geometry_option_index"] = json!(1);
    let cleaned = engine.postprocess_result(raw.clone()).unwrap();
    assert_eq!(names(&cleaned), ["F'"]);
    assert_eq!(cleaned["steps"][0]["geometry_option_index"], 0);
    assert_eq!(cleaned["postprocess"]["reselected_geometries"], 1);
    engine.config.diagnostics = false;
    let essential = engine.postprocess_result(raw.clone()).unwrap();
    assert_eq!(names(&essential), names(&cleaned));
    assert_eq!(
        essential["steps"][0]["geometry_option_index"],
        cleaned["steps"][0]["geometry_option_index"]
    );
    assert!(essential.get("unprocessed_steps").is_none());
    engine.config.diagnostics = true;
    engine.frames[0].geometries[0].score = 1.;
    let retained = engine.postprocess_result(raw).unwrap();
    assert_eq!(names(&retained), ["R", "R'", "F'"]);
}

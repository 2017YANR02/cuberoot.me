use super::*;
use crate::move_search::{Engine, Frame};

fn fixture() -> serde_json::Value {
    serde_json::from_str(include_str!("../../tests/fixtures/move-search-golden.json")).unwrap()
}

#[test]
fn compact_scoring_matches_full_permutations_and_raw_first_row_order() {
    let data = fixture();
    for orientation in [false, true] {
        let mut config: Config = serde_json::from_value(data["config"].clone()).unwrap();
        config.turning_start_frame = None;
        config.resolve_orientation_ambiguity = orientation;
        config.max_rotation_tps = orientation.then_some(20.);
        config.expand_flagged_frames = true;
        let mut engine = Engine::new(config).unwrap();
        for input in data["frames"].as_array().unwrap() {
            engine
                .push(serde_json::from_value(input.clone()).unwrap())
                .unwrap();
        }
        let mut state = engine.tables.identity.clone();
        for token in ["R", "U", "F'", "M", "Rw", "D2"] {
            state = engine.tables.moves[token]
                .iter()
                .map(|&i| state[i])
                .collect();
            for p in &engine.frames {
                if p.held {
                    continue;
                }
                for cue in [None, Some(0), Some(1), Some(7), Some(21)] {
                    let scored =
                        score_choices(&engine.tables, p, &state, cue, &engine.frontier.color_ids);
                    let rows: Vec<&Row> = if orientation {
                        scored
                            .dynamic
                            .iter()
                            .flat_map(|batch| batch.rows.iter())
                            .collect()
                    } else {
                        p.rows.iter().filter(|row| row.before == cue).collect()
                    };
                    let mut seen = HashSet::new();
                    let mut expected = vec![];
                    for row in rows {
                        if !seen.insert((row.after, &row.sources)) {
                            continue;
                        }
                        let g = p.geometry(row.after).unwrap();
                        let after: Vec<_> = row.sources.iter().map(|&i| state[i]).collect();
                        let (error, correct, confused, forbidden) =
                            color(&engine.tables, g, &after, &engine.frontier.color_ids);
                        let zero = correct + confused + forbidden == 0 && !g.signature.is_empty();
                        let error = if zero { 0. } else { error };
                        let score = 0.5 * g.score + 0.5 * error;
                        if score.is_finite() {
                            expected.push((
                                row,
                                after,
                                [score, -(g.inliers as f64), g.p90, -(g.layer_inliers as f64)],
                                error,
                                correct,
                                confused,
                                forbidden,
                            ));
                        }
                    }
                    let all_sparse = p.color_evidence_threshold.is_some_and(|threshold| {
                        !expected.is_empty()
                            && expected.iter().all(|v| v.4 + v.5 + v.6 <= threshold)
                    });
                    let no_dense = expected
                        .iter()
                        .all(|v| v.4 + v.5 + v.6 <= p.color_evidence_threshold.unwrap_or(0));
                    let allow_zero = no_dense && (p.flagged || all_sparse);
                    expected.retain(|v| {
                        v.4 + v.5 + v.6 > 0
                            || p.geometry(v.0.after).unwrap().signature.is_empty()
                            || allow_zero
                    });
                    expected.sort_by(|a, b| rank_cmp(&a.2, &b.2));
                    let actual =
                        choices(&engine.tables, p, &state, cue, &engine.frontier.color_ids);
                    assert_eq!(actual.len(), expected.len());
                    for (a, e) in actual.iter().zip(expected) {
                        assert_eq!(a.state, e.1);
                        assert_eq!(a.cue, Some(e.0.after));
                        assert_eq!(a.rank, e.2);
                        assert_eq!(a.step.color_error, e.3);
                        assert_eq!(
                            (
                                a.step.color_correct_count,
                                a.step.color_confusion_count,
                                a.step.color_forbidden_count
                            ),
                            (e.4, e.5, e.6)
                        );
                        assert_eq!(a.step.state_moves, *e.0.moves);
                        assert_eq!(a.step.angular_travel_degrees, e.0.degrees);
                        assert_eq!(a.step.rotation_budget_degrees, e.0.budget);
                        assert_eq!(a.step.cube_rotation_motion, e.0.motion);
                    }
                }
            }
        }
    }
}

fn essential_snapshot(mut snapshot: serde_json::Value) -> serde_json::Value {
    for step in snapshot["steps"].as_array_mut().unwrap() {
        step.as_object_mut().unwrap().retain(|key, _| {
            matches!(
                key.as_str(),
                "frame_index"
                    | "geometry_option_index"
                    | "previous_geometry_index"
                    | "orientation_symmetry_index"
                    | "state_moves"
                    | "pose_flagged"
            )
        });
    }
    snapshot
}

#[test]
fn diagnostics_toggle_preserves_every_progress_snapshot_and_explicit_probe() {
    let data = fixture();
    for orientation in [false, true] {
        let mut config: Config = serde_json::from_value(data["config"].clone()).unwrap();
        config.resolve_orientation_ambiguity = orientation;
        config.max_rotation_tps = orientation.then_some(20.);
        config.motion_cost_weight = 0.025;
        config.expand_flagged_frames = true;
        config.preserve_hold = true;
        let mut logged = Engine::new(config.clone()).unwrap();
        config.diagnostics = false;
        let mut quiet = Engine::new(config).unwrap();
        let frames = data["frames"].as_array().unwrap();
        // Prepare future banks before earlier ones, and search between arrivals.
        for pair in (0..frames.len()).collect::<Vec<_>>().chunks(2) {
            for &index in pair.iter().rev() {
                let frame: Frame = serde_json::from_value(frames[index].clone()).unwrap();
                logged.push(frame.clone()).unwrap();
                quiet.push(frame).unwrap();
                logged.advance(3);
                quiet.advance(3);
                assert_eq!(essential_snapshot(logged.snapshot()), quiet.snapshot());
            }
        }
        logged.end().unwrap();
        quiet.end().unwrap();
        loop {
            logged.advance(7);
            quiet.advance(7);
            assert_eq!(essential_snapshot(logged.snapshot()), quiet.snapshot());
            if logged.snapshot()["status"] != "running" {
                break;
            }
        }
        assert!(quiet.frontier.nodes.iter().all(|n| n
            .step
            .as_ref()
            .is_none_or(|s| matches!(s, SavedStep::Essential(_)))));
        let probe = &data["probes"][0];
        let sequence = probe["sequence"].as_u64().unwrap() as usize;
        let state: Vec<u8> = serde_json::from_value(probe["state"].clone()).unwrap();
        let cue = serde_json::from_value(probe["cue"].clone()).unwrap();
        assert_eq!(
            logged.probe(sequence, state.clone(), cue).unwrap(),
            quiet.probe(sequence, state, cue).unwrap()
        );
    }
}

use super::*;
use crate::move_search::routes::{between, Shape};
#[test]
fn motion_weight_is_optional_and_requires_a_finite_nonnegative_value() {
    let legacy: Config = serde_json::from_str(r#"{"scramble":"R"}"#).unwrap();
    assert_eq!(legacy.motion_cost_weight, 0.);
    for value in [0., 0.025, 1.] {
        assert!(Engine::new(Config {motion_cost_weight:value,..legacy.clone()}).is_ok());
    }
    for value in [-0.025, f64::NAN, f64::INFINITY, f64::NEG_INFINITY] {
        assert!(Engine::new(Config {motion_cost_weight:value,..legacy.clone()}).is_err());
    }
}
#[test]
fn immutable_tables_follow_cube_conventions() {
    let t = cube::Tables::load();
    let colors = t.colors("").unwrap();
    assert!(t.solved(&t.identity, &colors));
    let scrambled = t.colors("R U R' U'").unwrap();
    assert!(!t.solved(&t.identity, &scrambled));
    let mut state = t.identity.clone();
    for token in ["U", "R", "U'", "R'"] {
        state = t.moves[token].iter().map(|&i| state[i]).collect();
    }
    assert!(t.solved(&state, &scrambled));
    assert_eq!(t.colors("R2'").unwrap(), t.colors("R2").unwrap());
    assert_eq!(t.colors("r U’").unwrap(), t.colors("Rw U'").unwrap());
}
#[test]
fn shared_rate_has_no_double_exception() {
    let flat = Shape::flat();
    let routes = between(&flat, &flat, 120.);
    assert_eq!(routes.len(), 37);
    assert!(routes.iter().all(|r| r.degrees == 0. || r.degrees == 90.));
    assert!(between(&flat, &flat, 90.).iter().any(|r| r.groups
        == vec![cube::Group {
            axis: 2,
            offsets: [0, -1, 0]
        }]
        && r.degrees == 90.));
    assert!(between(&flat, &flat, 180.).iter().any(|r| r.groups
        == vec![cube::Group {
            axis: 0,
            offsets: [2, 0, 0]
        }]));
    let a = Shape::new(0, [0., 0., 40.]);
    let b = Shape::new(0, [0., 0., -40.]);
    assert!(between(&a, &b, 54.).iter().any(|r| r.groups
        == vec![cube::Group {
            axis: 0,
            offsets: [0, 0, 1]
        }]
        && r.degrees == 10.));
}
#[test]
fn slices_have_an_independent_rate_in_every_rigid_basis() {
    use super::routes::between_with_slice_limit;
    let flat = Shape::flat();
    let routes = between_with_slice_limit(&flat, &flat, 90., 90. * 40. / 54.);
    for axis in 0..3 {
        // A direct slice and its opposite-outer spelling must both respect it.
        for offsets in [[0, -1, 0], [1, 0, 1]] {
            let group = cube::Group { axis, offsets };
            assert!(!routes.iter().any(|r| r.groups == vec![group.clone()]));
            assert!(between_with_slice_limit(&flat, &flat, 121.5, 90.).iter()
                .any(|r| r.groups == vec![group.clone()] && r.degrees == 90.));
        }
        // A face or wide quarter still uses the ordinary 54 TPS budget.
        for offsets in [[1, 0, 0], [1, 1, 0]] {
            assert!(routes.iter().any(|r| r.groups == vec![cube::Group { axis, offsets }]));
        }
    }
    let before = Shape::new(2, [15.045883504893528, 0., 23.665434536185003]);
    let after = Shape::new(0, [0., 0., 28.678335684368218]);
    let budget = 90. * 54. * 2. / (60000. / 1001.);
    let expected = vec![cube::Group { axis: 2, offsets: [0, -1, 0] }];
    let route = between_with_slice_limit(&before, &after, budget, budget * 40. / 54.)
        .into_iter().find(|r| r.groups == expected).expect("reviewed Tommy slice plus partial R must remain legal");
    assert!((route.degrees - 103.6324521794747).abs() < 1e-10);
}
#[test]
fn frame_frontier_waits_and_end_is_explicit() {
    let mut engine = Engine::new(Config {
        scramble: "R U".into(),
        ..Config::default()
    })
    .unwrap();
    engine.advance(10);
    assert_eq!(engine.snapshot()["status"], "waiting_for_frames");
    engine
        .push(Frame {
            sequence: 1,
            frame: 2,
            bank: vec![],
            colors: vec![],
            ..Frame::default()
        })
        .unwrap();
    engine.advance(10);
    assert_eq!(engine.snapshot()["frames_prepared"], 1);
    assert_eq!(engine.snapshot()["frames_searchable"], 0);
    assert!(engine.end().is_err());
    engine
        .push(Frame {
            sequence: 0,
            frame: 0,
            bank: vec![],
            colors: vec![],
            ..Frame::default()
        })
        .unwrap();
    engine.advance(10);
    assert_eq!(engine.snapshot()["frames_searchable"], 2);
    assert_eq!(engine.snapshot()["status"], "waiting_for_frames");
    assert_eq!(engine.snapshot()["stats"]["evaluated_states"], 2);
    engine.end().unwrap();
    engine.advance(10);
    assert_eq!(engine.snapshot()["status"], "exhausted");
    assert!(engine
        .push(Frame {
            sequence: 2,
            frame: 4,
            bank: vec![],
            colors: vec![],
            ..Frame::default()
        })
        .is_err());
}
fn opening_gap_pose(sequence: usize, frame: usize) -> Frame {
    let data: serde_json::Value = serde_json::from_str(include_str!("../../tests/fixtures/move-search-golden.json")).unwrap();
    let input = data["frames"].as_array().unwrap().iter()
        .find(|input| !input["bank"].as_array().unwrap().is_empty()).unwrap();
    let mut pose: Frame = serde_json::from_value(input.clone()).unwrap();
    pose.sequence = sequence;
    pose.frame = frame;
    pose
}
#[test]
fn missing_opening_poses_do_not_accumulate_hidden_turns_even_out_of_order() {
    let mut engine = Engine::new(Config {
        scramble: "R U".into(), fps: 50., resolve_orientation_ambiguity: true,
        ..Config::default()
    }).unwrap();
    engine.push(opening_gap_pose(3, 17)).unwrap();
    for (sequence, frame) in [(2, 16), (0, 12), (1, 14)] {
        engine.push(Frame { sequence, frame, ..Frame::default() }).unwrap();
    }
    assert_eq!(engine.frames.len(), 4);
    assert!(engine.frames[..3].iter().all(|p| p.held));
    assert_eq!(engine.frames[3].previous, None);
    assert!((engine.frames[3].limit - 90. * engine.config.max_tps / 50.).abs() < 1e-9);
    assert_eq!(engine.baseline, Some(16));
}
#[test]
fn missing_poses_after_search_starts_preserve_the_full_motion_gap() {
    let mut engine = Engine::new(Config {
        scramble: "R U".into(), fps: 50., resolve_orientation_ambiguity: true,
        ..Config::default()
    }).unwrap();
    engine.push(opening_gap_pose(0, 17)).unwrap();
    engine.push(Frame { sequence: 1, frame: 18, ..Frame::default() }).unwrap();
    engine.push(opening_gap_pose(2, 20)).unwrap();
    assert_eq!(engine.frames[2].previous, Some(0));
    assert!((engine.frames[2].limit - 90. * engine.config.max_tps * 3. / 50.).abs() < 1e-9);
}
#[test]
fn lower_turn_limit_excludes_a_hidden_quarter_turn_over_twenty_ms_and_replays_legacy_rates() {
    assert_eq!(Config::default().max_tps, 40.);
    for (rate, allows_quarter) in [(40., false), (54., true)] {
        let mut engine=Engine::new(Config {
            scramble:"R U".into(),fps:1000.,max_tps:rate,
            resolve_orientation_ambiguity:true,max_rotation_tps:Some(20.),
            ..Config::default()
        }).unwrap();
        engine.push(opening_gap_pose(0,100)).unwrap();
        engine.push(opening_gap_pose(1,120)).unwrap();
        let frame=&engine.frames[1];
        assert!((frame.limit-90.*rate*0.020).abs()<1e-9);
        assert!((frame.rotation_limit.unwrap()-36.).abs()<1e-9);
        let routes=between(&Shape::flat(),&Shape::flat(),frame.limit);
        assert_eq!(routes.iter().any(|route|route.degrees==90.),allows_quarter);
    }
    for rate in [0.,-1.,f64::NAN,f64::INFINITY] {
        assert!(Engine::new(Config {max_tps:rate,..Config::default()}).is_err());
    }
}
#[test]
fn saved_cpu_scorer_and_widening_oracle() {
    let data: serde_json::Value =
        serde_json::from_str(include_str!("../../tests/fixtures/move-search-golden.json")).unwrap();
    let mut engine = Engine::new(serde_json::from_value(data["config"].clone()).unwrap()).unwrap();
    for input in data["frames"].as_array().unwrap() {
        engine
            .push(serde_json::from_value(input.clone()).unwrap())
            .unwrap();
    }
    engine.end().unwrap();
    for probe in data["probes"].as_array().unwrap() {
        let actual = engine
            .probe(
                probe["sequence"].as_u64().unwrap() as usize,
                serde_json::from_value(probe["state"].clone()).unwrap(),
                serde_json::from_value(probe["cue"].clone()).unwrap(),
            )
            .unwrap();
        let expected = probe["choices"].as_array().unwrap();
        let actual = actual["choices"].as_array().unwrap();
        assert_eq!(expected.len(), actual.len());
        for (a, b) in expected.iter().zip(actual) {
            assert!(b.get("recent_motion_penalty").is_none());
            assert!(b.get("required_tps_ratio").is_none());
            for key in [
                "geometry_option_index",
                "previous_geometry_index",
                "state_moves",
                "color_match_count",
                "color_forbidden_count",
            ] {
                assert_eq!(a[key], b[key], "{key}");
            }
            for key in [
                "state_score",
                "color_error",
                "angular_travel_degrees",
                "rotation_budget_degrees",
            ] {
                if let Some(value) = a[key].as_f64() {
                    assert!((value - b[key].as_f64().unwrap()).abs() < 1e-12, "{key}");
                }
            }
        }
    }
    engine.advance(10000);
    let actual = engine.snapshot();
    for step in actual["steps"].as_array().unwrap() {
        assert!(step.get("recent_motion_penalty").is_none());
        assert!(step.get("required_tps_ratio").is_none());
    }
    assert_eq!(actual["status"], data["expected"]["status"]);
    for (key, value) in data["expected"]["stats"].as_object().unwrap() {
        assert_eq!(actual["stats"][key], *value, "{key}");
    }
}

#[test]
fn live_frontier_pauses_alternatives_and_resumes_on_input_or_eof() {
    let data: serde_json::Value = serde_json::from_str(include_str!("../../tests/fixtures/move-search-golden.json")).unwrap();
    let mut config: Config = serde_json::from_value(data["config"].clone()).unwrap();
    config.state_limit = 10000;
    let mut engine = Engine::new(config).unwrap();
    for frame in data["frames"].as_array().unwrap().iter().take(3) {
        engine.push(serde_json::from_value(frame.clone()).unwrap()).unwrap();
    }
    engine.advance(1);
    assert_eq!(engine.snapshot()["status"], "running", "keep exploring until a path catches up");
    engine.advance(10000);
    let caught_up = engine.snapshot();
    assert_eq!(caught_up["status"], "waiting_for_frames");
    assert_eq!(caught_up["furthest_admitted_frames"], 3);
    assert!(caught_up["pending"].as_u64().unwrap() > 0, "retain shallower alternatives");
    engine.advance(10000);
    assert_eq!(engine.snapshot()["stats"]["evaluated_states"], caught_up["stats"]["evaluated_states"]);
    engine.push(serde_json::from_value(data["frames"][3].clone()).unwrap()).unwrap();
    engine.advance(10000);
    let next = engine.snapshot();
    assert_eq!(next["status"], "waiting_for_frames");
    assert_eq!(next["furthest_admitted_frames"], 4);
    assert!(next["stats"]["evaluated_states"].as_u64().unwrap() > caught_up["stats"]["evaluated_states"].as_u64().unwrap());
    engine.end().unwrap();
    engine.advance(10000);
    assert_ne!(engine.snapshot()["status"], "waiting_for_frames");
    assert!(engine.snapshot()["stats"]["evaluated_states"].as_u64().unwrap() > next["stats"]["evaluated_states"].as_u64().unwrap());
}

#[test]
fn a_pending_solution_is_not_parked_at_the_live_frontier() {
    let data: serde_json::Value = serde_json::from_str(include_str!("../../tests/fixtures/move-search-golden.json")).unwrap();
    let mut frame: Frame = serde_json::from_value(data["frames"][0].clone()).unwrap();
    frame.frame = 0;
    frame.sequence = 0;
    let mut engine = Engine::new(Config {
        scramble: "R".into(),
        fps: 30.,
        unrestricted_sticker_count: Some(1000),
        ..Config::default()
    }).unwrap();
    engine.push(frame).unwrap();
    engine.advance(10000);
    assert_eq!(engine.snapshot()["status"], "solved");
    assert_eq!(engine.snapshot()["ended"], false);
}

#[test]
fn cheap_reliability_matches_saved_python_checks() {
    let data: serde_json::Value = serde_json::from_str(include_str!("../../tests/fixtures/move-search-golden.json")).unwrap();
    let frame: Frame = serde_json::from_value(data["frames"][0].clone()).unwrap();
    let cases: serde_json::Value = serde_json::from_str(include_str!("../../tests/fixtures/reliability-golden.json")).unwrap();
    for case in cases.as_array().unwrap() {
        let mut fit = frame.bank[0].clone();
        fit.metrics.robust_error = case["robust_error"].as_f64().unwrap();
        fit.metrics.inlier_count = case["inlier_count"].as_u64().unwrap() as usize;
        let reason = reliability::reason(&[fit], Some(case["landmarks"].as_u64().unwrap() as usize), case["stickers"].as_u64().unwrap() as usize);
        assert_eq!(reason, case["reason"].as_str(), "{} frame {}", case["case"], case["frame"]);
    }
}

#[test]
fn finalized_upstream_flags_are_authoritative_and_do_not_persist_to_next_frame() {
    let data: serde_json::Value = serde_json::from_str(include_str!("../../tests/fixtures/move-search-golden.json")).unwrap();
    let mut frame: Frame = serde_json::from_value(data["frames"][0].clone()).unwrap();
    for fit in &mut frame.bank {
        fit.metrics.robust_error = 0.01;
        fit.metrics.keypoint_error = 0.;
        fit.metrics.combined_mean_error = 0.;
        fit.metrics.inlier_count = 100;
    }
    frame.landmark_count = Some(20);
    assert_eq!(reliability::reason(&frame.bank, frame.landmark_count, frame.colors.len()), None);
    frame.sequence = 0;
    frame.flagged = Some(true);
    let first_frame = frame.frame;
    let mut next = frame.clone();
    next.sequence = 1;
    next.frame += 2;
    next.flagged = Some(false);
    let mut engine = Engine::new(Config {expand_flagged_frames:true,..Config::default()}).unwrap();
    engine.push(frame).unwrap();
    engine.push(next).unwrap();
    let flagged = engine.snapshot()["flagged_frames"].as_array().unwrap().clone();
    assert_eq!(flagged.len(), 1);
    assert_eq!(flagged[0]["frame"], first_frame);
}

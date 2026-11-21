use super::*;

fn golden_geometry() -> Geometry {
    let golden: serde_json::Value =
        serde_json::from_str(include_str!("../../tests/fixtures/cpu-golden.json")).unwrap();
    serde_json::from_value(golden["geometry"].clone()).unwrap()
}

#[test]
fn reviewed_jeff_recovery_prefers_observed_articulation_without_removing_priors() {
    let fixture: serde_json::Value = serde_json::from_str(include_str!(
        "../../tests/fixtures/recovery-ranking.json"
    )).unwrap();
    let mut rigid: crate::RecoveryScoreComponents = serde_json::from_value(fixture["rigid"].clone()).unwrap();
    let mut correct: crate::RecoveryScoreComponents = serde_json::from_value(fixture["correct_articulated"].clone()).unwrap();
    rigid.reprojection_weight = 1.;
    correct.reprojection_weight = 1.;
    assert!(rigid.cost() < correct.cost(), "Original recovery ranking preferred the wrong rigid fit");
    assert!((rigid.cost() - 0.26398847024494765).abs() < 1e-12);
    assert!((correct.cost() - 0.2860530839716329).abs() < 1e-12);
    rigid.reprojection_weight = depth::RECOVERY_REPROJECTION_WEIGHT;
    correct.reprojection_weight = depth::RECOVERY_REPROJECTION_WEIGHT;
    assert!(correct.cost() < rigid.cost(), "Reviewed articulated pose should outrank the rigid fit");
    // Image evidence cannot override arbitrarily implausible camera/depth motion.
    correct.pose_prior_loss += 100.;
    assert!(correct.cost() > rigid.cost());
}

#[test]
fn startup_quarter_diameter_rule_respects_gates_and_image_plane_only() {
    use startup::{select_seed, Seed};
    let seed = |u, error, visual| Seed {
        pose: Pose {
            rvec: [0.; 3],
            tvec: [0., 0., 500.],
        },
        visual_score: visual,
        fit_metric: error,
        core_uv: [u, 0.],
        diameter: 100.,
    };
    let cases = [
        // Visual jump at the boundary is unchanged; greater than it may switch.
        (vec![seed(25., 0.05, 0.05), seed(0., 0.06, 0.06)], 0),
        (vec![seed(26., 0.05, 0.05), seed(0., 0.06, 0.06)], 1),
        // An alternative must more than halve displacement, not merely improve.
        (vec![seed(30., 0.05, 0.05), seed(15., 0.06, 0.06)], 0),
        (vec![seed(30., 0.05, 0.05), seed(14., 0.06, 0.06)], 1),
        // Exclude poor roots if a <=0.1 fit exists; otherwise allow finite roots.
        (vec![seed(30., 0.05, 0.05), seed(0., 0.11, 0.11)], 0),
        (vec![seed(30., 0.2, 0.2), seed(0., 0.3, 0.3)], 1),
    ];
    for (seeds, expected) in cases {
        let selected = select_seed(&seeds, Some([0., 0.])).unwrap();
        assert!(std::ptr::eq(selected, &seeds[expected]));
        assert!(std::ptr::eq(select_seed(&seeds, None).unwrap(), &seeds[0]));
    }
    assert!(select_seed(&[], Some([0., 0.])).is_none());
    let mut seeds = vec![seed(30., 0.05, 0.05), seed(0., 0.06, 0.06)];
    seeds[1].pose.tvec = [1e6, -1e6, 1e9];
    assert!(std::ptr::eq(
        select_seed(&seeds, Some([0., 0.])).unwrap(),
        &seeds[1]
    ));
    // Lagged-reference movement cannot itself trigger a root switch.
    assert!(std::ptr::eq(
        startup::select_seed_with_allowance(&seeds, Some([0., 0.]), 10.).unwrap(),
        &seeds[0]
    ));
    let history = [
        startup::FinalizedCore {
            frame: 2,
            core: [0., 0.],
        },
        startup::FinalizedCore {
            frame: 4,
            core: [3., 4.],
        },
    ];
    assert_eq!(startup::selection_context(&history[..1], 10), (None, 0.));
    assert_eq!(
        startup::selection_context(&history, 10),
        (Some([3., 4.]), 15.)
    );
}

#[test]
fn flagged_final_bank_cannot_supply_a_continuity_core() {
    let fixture: serde_json::Value =
        serde_json::from_str(include_str!("../../tests/fixtures/orientation.json")).unwrap();
    let frame: Frame = serde_json::from_value(fixture["frame"].clone()).unwrap();
    let mut bank: Vec<Fit> = serde_json::from_value(fixture["expected"].clone()).unwrap();
    bank[0].metrics.robust_error = 0.01;
    assert!(jobs::continuity_core(&frame, &bank).is_some());
    bank[0].metrics.robust_error = 0.16;
    assert!(jobs::continuity_core(&frame, &bank).is_none());
    bank[0].metrics.robust_error = 0.11;
    bank[0].metrics.inlier_count = 0;
    assert!(jobs::continuity_core(&frame, &bank).is_none());
    assert!(jobs::continuity_core(&frame, &[]).is_none());
}

#[test]
fn reviewed_support_flags_agree_with_finalized_reference_eligibility() {
    // Policy-only fixture: the bank is evidence to classify, not an initializer
    // for a fitter/parity run. Full rollout validation refits raw inputs afresh.
    let cases: serde_json::Value = serde_json::from_str(include_str!(
        "../../tests/fixtures/pose-support-reviewed.json"
    )).unwrap();
    let g = golden_geometry();
    for case in cases.as_array().unwrap() {
        let frame: Frame = serde_json::from_value(case["raw_frame"].clone()).unwrap();
        let bank: Vec<Fit> = vec![serde_json::from_value(case["fit"].clone()).unwrap()];
        let flagged = case["expected_reason"].as_str().is_some();
        assert_eq!(jobs::continuity_core(&frame, &bank).is_none(), flagged);
        let output = jobs::run(&g, jobs::Job::Finalize {
            frame, source: None, bank, target: None, static_mode: false,
        });
        assert_eq!(output["pose_flag_reason"], case["expected_reason"]);
        assert_eq!(output["continuity_core"].is_null(), flagged);
    }
}

#[test]
fn accurate_color_poor_pose_remains_a_finalized_geometry_reference() {
    let case: serde_json::Value = serde_json::from_str(include_str!(
        "../../tests/fixtures/sticker-evidence-reviewed.json"
    )).unwrap();
    let frame: Frame = serde_json::from_value(case["raw_frame"].clone()).unwrap();
    let bank: Vec<Fit> = serde_json::from_value(case["bank"].clone()).unwrap();
    assert_eq!(crate::move_search::reliability::geometry_reason(&bank,
        Some(frame.observations.points.len()),frame.observations.stickers.len()),None);
    assert_eq!(crate::move_search::reliability::reason(&bank,
        Some(frame.observations.points.len()),frame.observations.stickers.len()),
        Some("insufficient_assigned_sticker_evidence"));
    assert!(jobs::continuity_core(&frame,&bank).is_some(),
        "Poor color coverage must not discard trustworthy camera geometry");
    let output=jobs::run(&golden_geometry(),jobs::Job::Finalize {
        frame,source:None,bank,target:None,static_mode:false,
    });
    assert_eq!(output["pose_flag_reason"],"insufficient_assigned_sticker_evidence");
    assert!(output["pose_geometry_flag_reason"].is_null());
    assert!(!output["continuity_core"].is_null());
}
#[test]
fn each_search_geometry_keeps_its_own_projected_mesh() {
    let g = golden_geometry();
    let fixture: serde_json::Value =
        serde_json::from_str(include_str!("../../tests/fixtures/move-search-golden.json")).unwrap();
    let bank: Vec<Fit> = serde_json::from_value(fixture["frames"][1]["bank"].clone()).unwrap();
    assert_eq!(bank.len(), 6);
    let frame = Frame {
        frame: 382,
        width: 720.,
        height: 1280.,
        observations: Observations {
            points: vec![],
            classes: vec![],
            stickers: vec![],
            uncertainties: vec![],
        },
        landmark_presence: vec![],
        colors: vec![],
        pixel_scale: 1.,
    };
    let output = jobs::run(
        &g,
        jobs::Job::Finalize {
            frame: frame.clone(),
            source: None,
            bank: bank.clone(),
            target: None,
            static_mode: false,
        },
    );
    assert_eq!(output["wireframes"].as_array().unwrap().len(), 6);
    assert_eq!(output["wireframe"], output["wireframes"][0]);
    for (i, fit) in bank.iter().enumerate() {
        let alone = jobs::run(
            &g,
            jobs::Job::Finalize {
                frame: frame.clone(),
                source: None,
                bank: vec![fit.clone()],
                target: None,
                static_mode: false,
            },
        );
        assert_eq!(output["wireframes"][i], alone["wireframe"]);
        assert_eq!(output["wireframeFaces"][i], alone["wireframeFaces"][0]);
        assert_eq!(output["wireframeDepths"][i], alone["wireframeDepths"][0]);
        let ids = output["wireframeFaces"][i].as_array().unwrap();
        assert_eq!(ids.len(), output["wireframes"][i].as_array().unwrap().len());
        assert!(ids.iter().all(|id| id.as_u64().unwrap() < 54));
        assert!(output["wireframeDepths"][i]
            .as_array()
            .unwrap()
            .iter()
            .all(|z| z.as_f64().unwrap().is_finite()));
    }
}
#[test]
fn cpu_sticker_groups_and_correspondence_sequences() {
    let fixture: serde_json::Value =
        serde_json::from_str(include_str!("../../tests/fixtures/startup-golden.json")).unwrap();
    for case in fixture["cases"].as_array().unwrap() {
        let input: startup::Input = serde_json::from_value(case["input"].clone()).unwrap();
        let expected: Vec<startup::Match> =
            serde_json::from_value(case["matches"].clone()).unwrap();
        let actual = startup::matches(&input);
        assert_eq!(
            actual.len(),
            expected.len(),
            "{} {}",
            case["name"],
            case["frame"]
        );
        for (a, b) in actual.iter().zip(&expected) {
            assert_eq!(a.indices, b.indices);
            assert_eq!(a.sticker_index, b.sticker_index);
            assert_eq!(a.sticker_type, b.sticker_type);
            assert_eq!(a.sequences, b.sequences);
            assert!((a.center_error - b.center_error).abs() < 1e-8);
            assert_eq!(a.mean_presence, b.mean_presence);
        }
    }
}
#[test]
fn fixed_input_sparse_depth_solver_matches_cpu() {
    let fixture: serde_json::Value =
        serde_json::from_str(include_str!("../../tests/fixtures/depth-recovery.json")).unwrap();
    let geometry = golden_geometry();
    let workload: Workload = serde_json::from_value(fixture["workload"].clone()).unwrap();
    let seed: [f64; 8] = serde_json::from_value(fixture["seed"].clone()).unwrap();
    let expected: [f64; 8] = serde_json::from_value(fixture["expected"].clone()).unwrap();
    let actual = depth::depth_refine(
        &geometry,
        &workload,
        fixture["axis"].as_u64().unwrap() as usize,
        seed,
        fixture["target"].as_f64().unwrap(),
    );
    for (i, (&a, &b)) in actual.iter().zip(&expected).enumerate() {
        assert!((a - b).abs() < 1e-6, "parameter {i}: {a} vs {b}");
    }
}
#[test]
fn fixed_input_orientation_preserves_cpu_assignments_and_order() {
    let fixture: serde_json::Value =
        serde_json::from_str(include_str!("../../tests/fixtures/orientation.json")).unwrap();
    let g = golden_geometry();
    let frame: Frame = serde_json::from_value(fixture["frame"].clone()).unwrap();
    let bank: Vec<Fit> = serde_json::from_value(fixture["input_bank"].clone()).unwrap();
    let expected: Vec<Fit> = serde_json::from_value(fixture["expected"].clone()).unwrap();
    let centers: Vec<Center> = serde_json::from_value(fixture["centers"].clone()).unwrap();
    let x: Vec<f64> = serde_json::from_value(fixture["reference"]["params"].clone()).unwrap();
    let reference = Some((
        rodrigues([x[0], x[1], x[2]]).0,
        fixture["reference"]["frame"].as_u64().unwrap() as usize,
    ));
    let w = work(&frame, &pose(&bank[0]), None, vec![], vec![], false);
    let actual = orientation::orient(
        &g,
        &w,
        bank,
        &centers,
        reference,
        fixture["fps"].as_f64().unwrap(),
        &frame.colors,
    );
    assert_eq!(actual.len(), expected.len());
    for (a, b) in actual.iter().zip(&expected) {
        assert_eq!(a.nearest, b.nearest);
        assert_eq!(a.valid, b.valid);
        assert_eq!(a.flat_fallback, b.flat_fallback);
        assert!((a.score - b.score).abs() < 1e-6);
    }
}

#[test]
fn stage_entry_rejects_mismatched_checkpoints_and_frame_order() {
    let fixture: serde_json::Value =
        serde_json::from_str(include_str!("../../tests/fixtures/orientation.json")).unwrap();
    let frame: Frame = serde_json::from_value(fixture["frame"].clone()).unwrap();
    let g = golden_geometry();
    let mut input = Input {
        frames: vec![frame.clone()],
        fps: 30.,
        turning_start_frame: None,
        expected_center_colors: vec![],
        capture_stages: false,
    };
    let error = run_stage(
        &g,
        StageRequest {
            stage: Stage::Neighbors,
            input: input.clone(),
            state: State::default(),
        },
    )
    .err()
    .unwrap();
    assert!(error.contains("Geometry checkpoint"));
    input.frames.push(frame);
    let error = run_stage(
        &g,
        StageRequest {
            stage: Stage::Startup,
            input,
            state: State::default(),
        },
    )
    .err()
    .unwrap();
    assert!(error.contains("increase strictly"));
}

#[test]
fn final_output_alternatives_keep_original_continuity_source_and_internal_bank() {
    let fixture: serde_json::Value=serde_json::from_str(include_str!("../../tests/fixtures/final-bank-reviewed.json")).unwrap();
    let g:Geometry=serde_json::from_value(fixture["geometry"].clone()).unwrap();
    let c=fixture["cases"].as_array().unwrap().iter().find(|c|c["frame"]["frame"]==124).unwrap();
    let frame:Frame=serde_json::from_value(c["frame"].clone()).unwrap();
    let bank:Vec<Fit>=serde_json::from_value(c["bank"].clone()).unwrap();
    let before=serde_json::to_value(&bank).unwrap();
    let expected_core=jobs::continuity_core(&frame,&bank);
    let expected_pose=pose(&bank[0]);
    let expected_flag=crate::move_search::reliability::geometry_reason(&bank,Some(frame.observations.points.len()),frame.observations.stickers.len());
    let output=jobs::run(&g,jobs::Job::Finalize{frame,source:None,bank:bank.clone(),target:None,static_mode:false});
    assert_eq!(serde_json::to_value(&bank).unwrap(),before);
    assert_eq!(output["continuity_core"],serde_json::to_value(expected_core).unwrap());
    assert_eq!(output["continuity_source_pose"],serde_json::to_value(expected_pose).unwrap());
    assert_eq!(output["continuity_source_geometry_flag_reason"],serde_json::to_value(expected_flag).unwrap());
    assert!(output["final_bank_diagnostics"]["attempted_materializations"].as_u64().unwrap()>0);
    assert!(output["final_bank_diagnostics"]["selected_replacements"].as_u64().unwrap()>0);
    assert_eq!(output["bank"][0]["params"][6],0.);
    assert_ne!(output["bank"][0]["params"][6],before[0]["params"][6]);
}

#[test]
fn single_layer_flat_camera_is_not_used_for_internal_continuity() {
    let fixture: serde_json::Value=serde_json::from_str(include_str!("../../tests/fixtures/weak-middle-flat.json")).unwrap();
    let geometry: serde_json::Value=serde_json::from_str(include_str!("../../tests/fixtures/final-bank-reviewed.json")).unwrap();
    let g:Geometry=serde_json::from_value(geometry["geometry"].clone()).unwrap();
    let c=&fixture["cases"][0];
    let frame:Frame=serde_json::from_value(c["frame"].clone()).unwrap();
    let bank:Vec<Fit>=serde_json::from_value(c["bank"].clone()).unwrap();
    let source=pose(&bank[0]);let core=jobs::continuity_core(&frame,&bank);
    let output=jobs::run(&g,jobs::Job::Finalize{frame,source:None,bank,target:None,static_mode:false});
    assert_eq!(output["bank"][0]["angles"],serde_json::json!([0.,0.,0.]));
    assert_ne!(output["pose"]["rvec"],serde_json::to_value(source.rvec).unwrap());
    assert_eq!(output["continuity_source_pose"],serde_json::to_value(source).unwrap());
    assert_eq!(output["continuity_core"],serde_json::to_value(core).unwrap());
}

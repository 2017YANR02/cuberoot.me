//! Individual operations for a buffered host. These call the batch pipeline's
//! stages directly; scheduling and worker count do not change fit behavior.
use super::*;

#[derive(Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum Job {
    Prepare {
        frame: Frame,
    },
    SelectStartup {
        frame: Frame,
        candidates: Vec<startup::Seed>,
        references: Vec<startup::FinalizedCore>,
    },
    Initial {
        frame: Frame,
        source: Option<Pose>,
        prior: Option<Pose>,
        static_mode: bool,
    },
    Neighbors {
        frame: Frame,
        bank: Vec<Fit>,
        neighbors: Vec<Pose>,
        static_mode: bool,
    },
    Orient {
        frame: Frame,
        bank: Vec<Fit>,
        centers: Vec<Center>,
        reference: Option<Reference>,
        fps: f64,
    },
    Target {
        frames: Vec<Frame>,
        startups: Vec<Option<Pose>>,
        anchors: Vec<usize>,
        index: usize,
        fps: f64,
    },
    Finalize {
        frame: Frame,
        source: Option<Pose>,
        bank: Vec<Fit>,
        target: Option<f64>,
        static_mode: bool,
    },
}
#[derive(Clone, Serialize, Deserialize)]
pub struct Reference {
    pub rvec: V3,
    pub frame: usize,
}
pub(super) fn next_reference(frame: &Frame, bank: &[Fit], previous: Option<Reference>) -> Option<Reference> {
    if !bank.is_empty() {
        Some(Reference {rvec:pose(&bank[0]).rvec,frame:frame.frame})
    } else { previous }
}
pub(super) fn anchor(g: &Geometry, frame: &Frame, p: &Pose) -> bool {
    let w = work(frame, p, None, vec![], vec![], false);
    p.tvec[2] > g.cube_size && depth::supported(g, frame, &w.camera, p)
}
pub(super) fn continuity_core(frame: &Frame, bank: &[Fit]) -> Option<V2> {
    if crate::move_search::reliability::geometry_reason(
        bank,
        Some(frame.observations.points.len()),
        frame.observations.stickers.len(),
    )
    .is_some()
    {
        return None;
    }
    let p = bank.first().map(pose)?;
    let camera = startup::camera(&startup::Input {
        width: frame.width,
        height: frame.height,
        observations: frame.observations.clone(),
        landmark_presence: vec![],
    });
    Some(startup::projected_core(&camera, &p))
}

pub(super) fn initial(
    g: &Geometry,
    frame: &Frame,
    source: Option<Pose>,
    prior: Option<Pose>,
    static_mode: bool,
) -> Vec<Fit> {
    source
        .map(|p| {
            search::fit_frame(
                g,
                &work(frame, &p, prior, vec![], vec![], static_mode),
                &mut vec![],
            )
        })
        .unwrap_or_default()
}
pub(super) fn neighbors(
    g: &Geometry,
    frame: &Frame,
    bank: Vec<Fit>,
    neighbors: Vec<Pose>,
    static_mode: bool,
) -> Vec<Fit> {
    if bank.is_empty() || neighbors.is_empty() {
        return bank;
    }
    let base = pose(&bank[0]);
    let prior = mean_prior(g, &base, &neighbors);
    search::fit_frame(
        g,
        &work(frame, &base, Some(prior), neighbors, bank, static_mode),
        &mut vec![],
    )
}
pub(super) fn orient(
    g: &Geometry,
    frame: &Frame,
    bank: Vec<Fit>,
    centers: &[Center],
    reference: Option<&Reference>,
    fps: f64,
) -> Vec<Fit> {
    if bank.is_empty() {
        return bank;
    }
    let base = pose(&bank[0]);
    orientation::orient(
        g,
        &work(frame, &base, None, vec![], vec![], false),
        bank,
        centers,
        reference.map(|r|(rodrigues(r.rvec).0,r.frame)),
        fps,
        &frame.colors,
    )
}
pub fn run(g: &Geometry, job: Job) -> serde_json::Value {
    match job {
        Job::Prepare { frame } => {
            let candidates = startup::seeds(
                g,
                &startup::Input {
                    width: frame.width,
                    height: frame.height,
                    observations: frame.observations.clone(),
                    landmark_presence: frame.landmark_presence.clone(),
                },
            );
            serde_json::json!({"candidates":candidates})
        }
        Job::SelectStartup {
            frame,
            candidates,
            references,
        } => {
            let (reference_core, motion_allowance) =
                startup::selection_context(&references, frame.frame);
            let selected =
                startup::select_seed_with_allowance(&candidates, reference_core, motion_allowance);
            let source = selected.map(|c| c.pose.clone());
            let anchor = source.as_ref().is_some_and(|p| anchor(g, &frame, p));
            serde_json::json!({"source":source,"reference_core":reference_core,
                "motion_allowance":motion_allowance,"anchor":anchor})
        }
        Job::Initial {
            frame,
            source,
            prior,
            static_mode,
        } => {
            let bank = initial(g, &frame, source, prior, static_mode);
            serde_json::json!({"bank":bank})
        }
        Job::Neighbors {
            frame,
            bank,
            neighbors,
            static_mode,
        } => {
            let bank = self::neighbors(g, &frame, bank, neighbors, static_mode);
            serde_json::json!({"bank":bank})
        }
        Job::Orient {
            frame,
            bank,
            centers,
            reference,
            fps,
        } => {
            let bank=orient(g,&frame,bank,&centers,reference.as_ref(),fps);
            let reference = next_reference(&frame, &bank, reference);
            serde_json::json!({"bank":bank,"reference":reference})
        }
        Job::Target {
            frames,
            startups,
            anchors,
            index,
            fps,
        } => {
            let targets = depth::targets_from_anchors(&frames, &startups, &anchors, fps);
            serde_json::json!({"target":targets[index]})
        }
        Job::Finalize {
            frame,
            source,
            bank,
            target,
            static_mode,
        } => {
            let (bank, recovered) = if !static_mode {
                if let (Some(p), Some(target)) = (source, target) {
                    depth::recover(g, &frame, &p, bank, target)
                } else {
                    (bank, false)
                }
            } else {
                (bank, false)
            };
            // Final alternatives cannot change which finalized geometry supplied
            // future PnP continuity. Capture its eligibility and core first.
            let continuity_source_pose = bank.first().map(pose);
            let continuity_source_geometry_flag_reason =
                crate::move_search::reliability::geometry_reason(
                    &bank, Some(frame.observations.points.len()), frame.observations.stickers.len(),
                );
            let continuity_core = continuity_core(&frame, &bank);
            let final_bank = continuity_source_pose.as_ref().map(|p| {
                let w = work(&frame, p, None, vec![], vec![], false);
                crate::final_bank::select(g, &w, &bank)
            });
            let (bank, final_bank_diagnostics) = final_bank
                .map(|result| (result.bank, result.diagnostics))
                .unwrap_or_else(|| (bank, crate::final_bank::Diagnostics::default()));
            // Projection is state-independent. Save every retained geometry now,
            // so the eventual search winner can be rendered without refitting.
            let mut wireframe_faces = vec![];
            let mut wireframe_depths = vec![];
            let wireframes: Vec<Vec<_>> = bank
                .iter()
                .map(|fit| {
                    let p = pose(fit);
                    let w = work(&frame, &p, None, vec![], vec![], false);
                    let s = projection::surface(g, &w.camera, fit.axis, fit.angles, p.rvec, p.tvec);
                    let faces: Vec<_> = s
                        .face_front
                        .iter()
                        .enumerate()
                        .filter_map(|(i, &front)| front.then_some(i))
                        .collect();
                    let depths: Vec<_> = faces
                        .iter()
                        .map(|&i| {
                            let center = scale(g.faces[i].iter().copied().fold([0.; 3], add), 0.25);
                            let articulated =
                                mv(s.matrices[g.axes[fit.axis].face_layers[i]], center);
                            mv(s.rotation, articulated)[2] + p.tvec[2]
                        })
                        .collect();
                    wireframe_faces.push(faces);
                    wireframe_depths.push(depths);
                    s.face_polygons
                        .iter()
                        .zip(&s.face_front)
                        .filter_map(|(p, &front)| front.then_some(*p))
                        .collect()
                })
                .collect();
            let wireframe = wireframes.first().cloned().unwrap_or_default();
            let selected = bank.first().map(pose);
            let pose_flag_reason = crate::move_search::reliability::reason(
                &bank,
                Some(frame.observations.points.len()),
                frame.observations.stickers.len(),
            );
            let pose_geometry_flag_reason = crate::move_search::reliability::geometry_reason(
                &bank,
                Some(frame.observations.points.len()),
                frame.observations.stickers.len(),
            );
            serde_json::json!({"bank":bank,"wireframe":wireframe,"wireframes":wireframes,
                "wireframeFaces":wireframe_faces,"wireframeDepths":wireframe_depths,
                "pose":selected,"depth_recovery":recovered,"stage":"cpu_pipeline",
                "continuity_core":continuity_core,"pose_flag_reason":pose_flag_reason,
                "continuity_source_pose":continuity_source_pose,
                "continuity_source_geometry_flag_reason":continuity_source_geometry_flag_reason,
                "final_bank_diagnostics":final_bank_diagnostics,
                "pose_geometry_flag_reason":pose_geometry_flag_reason,
                "bootstrap":false,"message":if recovered{"CPU pose · depth recovery"}else{"CPU pose · neighbor refinement"}})
        }
    }
}

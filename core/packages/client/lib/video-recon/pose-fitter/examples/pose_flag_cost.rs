//! Standalone scalar-flag microbenchmark. No fitting, projections, or search.
use cube_pose_fitter::{move_search::reliability, Fit};
use serde::Deserialize;
use std::{hint::black_box, time::Instant};

#[derive(Deserialize)]
struct Case {
    fit: Fit,
    landmarks: usize,
    stickers: usize,
}

fn old_reason(bank: &[Fit], landmarks: usize, stickers: usize) -> Option<&'static str> {
    let fit = bank.first()?;
    let error = fit.metrics.robust_error;
    if !error.is_finite() { return Some("nonfinite_geometric_error"); }
    if error > 0.15 { return Some("high_robust_geometric_error"); }
    if error > 0.10 && fit.metrics.inlier_count as f64 / (landmarks + stickers).max(1) as f64 <= 0.80 {
        return Some("moderate_error_with_weak_support");
    }
    if landmarks <= 5 && stickers <= 5 { return Some("sparse_pose_evidence"); }
    None
}

fn main() {
    let cases: Vec<Case> = serde_json::from_str(include_str!(
        "../tests/fixtures/pose-support-reviewed.json"
    )).unwrap();
    let rounds = 1_000_000;
    let time = |new: bool| {
        let start = Instant::now();
        for _ in 0..rounds {
            for case in &cases {
                let bank = std::slice::from_ref(black_box(&case.fit));
                black_box(if new {
                    reliability::reason(bank, Some(black_box(case.landmarks)), black_box(case.stickers))
                } else {
                    old_reason(bank, black_box(case.landmarks), black_box(case.stickers))
                });
            }
        }
        start.elapsed().as_secs_f64() * 1e9 / (rounds * cases.len()) as f64
    };
    // Alternate order to make the rough scalar cost less dependent on warmup.
    let old_first = time(false);
    let support_first = time(true);
    let old_second = time(false);
    let support_second = time(true);
    println!("{}", serde_json::json!({"cases":cases.len(),"calls_per_trial":rounds*cases.len(),
        "old_ns":[old_first,old_second],"support_ns":[support_first,support_second],
        "scope":"Native scalar reason() on the reviewed support fixture; includes coordinate deduplication; excludes fitting, projection, JSON, worker scheduling and WASM boundary costs"}));
}

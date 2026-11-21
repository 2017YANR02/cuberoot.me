//! Read-only pose reliability from metrics already produced by fitting.
//! These are geometric residuals and observation counts, not detector scores.
use crate::Fit;

/// Frame-wide analogue of Python's unrestricted_sticker_branch threshold.
/// Count assigned projected stickers, not raw detections or correct colors.
/// All usable five-plus-flat options participate, so one fit cannot manufacture
/// an evidence warning simply by discarding observations that another uses.
pub fn maximum_assigned_stickers(bank: &[Fit]) -> Option<usize> {
    let mut maximum = None;
    let (mut regular, mut flat) = (0, false);
    for fit in bank {
        if fit.flat_fallback {
            if flat { continue; }
            flat = true;
        } else {
            if regular >= 5 { continue; }
            regular += 1;
        }
        if (fit.angles.iter().any(|&angle| angle != 0.) && fit.metrics.layer_inlier_count == 0)
            || !fit.metrics.keypoint_error.is_finite()
            || !fit.metrics.sticker_error.is_finite()
        {
            continue;
        }
        let mut faces = 0_u64;
        for (&face, &valid) in fit.nearest.iter().zip(&fit.valid) {
            if valid && face < 54 { faces |= 1_u64 << face; }
        }
        let count = faces.count_ones() as usize;
        maximum = Some(maximum.unwrap_or(0).max(count));
    }
    maximum
}

pub fn geometry_reason(bank: &[Fit], landmark_count: Option<usize>, stickers: usize) -> Option<&'static str> {
    let fit = bank.first()?;
    let error = fit.metrics.robust_error;
    if !error.is_finite() {
        return Some("nonfinite_geometric_error");
    }
    if error > 0.15 {
        return Some("high_robust_geometric_error");
    }
    let landmarks = landmark_count.unwrap_or(fit.assignment_objects.len());
    let fraction = fit.metrics.inlier_count as f64 / (landmarks + stickers).max(1) as f64;
    if error > 0.10 && fraction <= 0.80 {
        return Some("moderate_error_with_weak_support");
    }
    if landmarks <= 5 && stickers <= 5 {
        return Some("sparse_pose_evidence");
    }
    // Sparse observations can support a small normalized robust residual while
    // the landmark mean is still too large to trust the pose. Counts are the
    // accepted observations, not object detection or keypoint-presence scores.
    if landmarks <= 10 && stickers <= 5 && fit.metrics.keypoint_error > 0.025 {
        return Some("sparse_landmark_reprojection_error");
    }
    // An implausibly large cube can reduce diameter-normalized errors by
    // assigning several observed landmarks to the same projected landmark.
    // Require independent sticker-assignment failure too. Count already-made
    // assignments; no extra projection or fitting is needed.
    if fit.metrics.combined_mean_error > 0.03
        && landmarks > 0
        && stickers > 0
        && fit.valid.iter().filter(|&&valid| valid).count() as f64 <= 0.70 * stickers as f64
    {
        let unique = fit.assignment_objects.iter().enumerate()
            .filter(|(index, point)| !fit.assignment_objects[..*index].contains(point))
            .count();
        if unique as f64 <= 0.70 * landmarks as f64 {
            return Some("collapsed_landmark_and_sticker_support");
        }
    }
    None
}

pub fn reason(bank: &[Fit], landmark_count: Option<usize>, stickers: usize) -> Option<&'static str> {
    if let Some(reason) = geometry_reason(bank, landmark_count, stickers) {
        return Some(reason);
    }
    // This warns about insufficient color evidence, not necessarily incorrect
    // geometric localization. The search's context-specific <=3 assigned-
    // sticker expansion remains separate and unchanged.
    if maximum_assigned_stickers(bank).is_some_and(|count| count <= 3) {
        return Some("insufficient_assigned_sticker_evidence");
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reviewed_support_failures_and_accepted_sparse_pose() {
        let cases: serde_json::Value = serde_json::from_str(include_str!(
            "../../tests/fixtures/pose-support-reviewed.json"
        )).unwrap();
        for case in cases.as_array().unwrap() {
            let fit: Fit = serde_json::from_value(case["fit"].clone()).unwrap();
            assert_eq!(
                reason(&[fit], case["landmarks"].as_u64().map(|n| n as usize),
                    case["stickers"].as_u64().unwrap() as usize),
                case["expected_reason"].as_str(),
                "{} frame {}", case["case"], case["frame"]
            );
        }
    }

    #[test]
    fn minimum_stickers_uses_unique_assigned_faces_across_every_usable_option() {
        let cases: serde_json::Value = serde_json::from_str(include_str!(
            "../../tests/fixtures/pose-support-reviewed.json"
        )).unwrap();
        let mut fit: Fit = serde_json::from_value(cases[0]["fit"].clone()).unwrap();
        fit.metrics.robust_error = 0.01;
        fit.metrics.keypoint_error = 0.001;
        fit.metrics.sticker_error = 0.001;
        fit.metrics.combined_mean_error = 0.002;
        fit.metrics.inlier_count = 30;
        fit.angles = [0.; 3];
        fit.flat_fallback = false;
        fit.nearest = vec![0, 1, 2, 0, 1, 2, 0];
        fit.valid = vec![true; 7];
        assert_eq!(maximum_assigned_stickers(&[fit.clone()]), Some(3));
        assert_eq!(geometry_reason(&[fit.clone()], Some(20), 7), None,
            "Insufficient color evidence is not a geometry failure");
        assert_eq!(reason(&[fit.clone()], Some(20), 7), Some("insufficient_assigned_sticker_evidence"));
        let mut sufficient = fit.clone();
        sufficient.nearest = (0..7).collect();
        assert_eq!(maximum_assigned_stickers(&[sufficient.clone()]), Some(7));
        assert_eq!(reason(&[sufficient.clone()], Some(20), 7), None, "Seven independently assigned stickers are sufficient");
        sufficient.nearest = vec![0, 1, 2, 3, 3, 3, 3];
        assert_eq!(reason(&[fit.clone(), sufficient.clone()], Some(20), 7), None,
            "One adequately supported option prevents a frame-wide warning");
        sufficient.angles = [10., 0., 0.];
        sufficient.metrics.layer_inlier_count = 0;
        assert_eq!(reason(&[fit.clone(), sufficient], Some(20), 7), Some("insufficient_assigned_sticker_evidence"),
            "An unsupported articulated option is not usable search evidence");
        assert_eq!(maximum_assigned_stickers(&[]), None);
        assert_eq!(reason(&[], Some(20), 7), None, "No bank remains unavailable rather than a sticker-count warning");
    }
}

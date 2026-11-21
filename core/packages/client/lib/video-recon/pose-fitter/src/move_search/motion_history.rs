//! Bounded recent motion evidence; no fitting, projection, or rate constraints.
const WINDOW: usize = 8;

#[derive(Clone, Default)]
pub(super) struct MotionHistory(Vec<f64>);

/// Existing route travel divided by its existing maximum-TPS travel budget.
/// Static holds have no budget and contribute zero.
pub(super) fn required_tps_ratio(degrees: f64, budget_degrees: f64) -> f64 {
    if budget_degrees > 0. {
        degrees / budget_degrees
    } else {
        0.
    }
}

impl MotionHistory {
    pub(super) fn with_ratio(&self, ratio: f64) -> Self {
        let mut ratios = self.0.clone();
        if ratios.len() == WINDOW {
            ratios.remove(0);
        }
        ratios.push(ratio);
        Self(ratios)
    }

    pub(super) fn penalty(&self, weight: f64) -> f64 {
        weight * self.0.iter().sum::<f64>()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn recent_cost_is_bounded_and_old_motion_expires() {
        let mut history = MotionHistory::default();
        for _ in 0..20 {
            history = history.with_ratio(1.);
        }
        assert_eq!(history.0.len(), 8);
        assert_eq!(history.penalty(0.025), 0.2);
        for _ in 0..8 {
            history = history.with_ratio(0.);
        }
        assert_eq!(history.penalty(0.025), 0.);
    }

    #[test]
    fn existing_route_budget_normalizes_speed_without_new_caps() {
        assert_eq!(required_tps_ratio(40.5, 162.), 0.25);
        assert_eq!(required_tps_ratio(81., 81.), 1.);
        assert_eq!(required_tps_ratio(0., 0.), 0.);
        assert_eq!(MotionHistory::default().with_ratio(1.).penalty(0.), 0.);
    }
}

use cube_pose_fitter::{check_probes, check_solvers, check_sweeps, fit_case, FixtureSet};
use serde_json::Value;

const GOLDEN: &str = include_str!("fixtures/cpu-golden.json");

fn compare(expected: &Value, actual: &Value, path: &str, tolerance: f64) {
    match (expected, actual) {
        (Value::Number(a), Value::Number(b)) => {
            let error = (a.as_f64().unwrap() - b.as_f64().unwrap()).abs();
            assert!(error <= tolerance, "{path}: error {error} > {tolerance}");
        }
        (Value::Array(a), Value::Array(b)) => {
            assert_eq!(a.len(), b.len(), "{path}: array length");
            for (index, (a, b)) in a.iter().zip(b).enumerate() {
                compare(a, b, &format!("{path}[{index}]"), tolerance);
            }
        }
        (Value::Object(a), Value::Object(b)) => {
            assert_eq!(a.len(), b.len(), "{path}: field count");
            for (key, a) in a {
                let tolerance = match key.as_str() {
                    "params" | "angles" | "assignment_objects" | "assignment_projected" => 1e-4,
                    "metrics" | "score" => 1e-6,
                    "axis" | "nearest" | "valid" | "assignment_classes" | "layer_support" => 0.,
                    k if k.ends_with("count") => 0.,
                    _ => tolerance,
                };
                compare(a, &b[key], &format!("{path}.{key}"), tolerance);
            }
        }
        _ => assert_eq!(expected, actual, "{path}"),
    }
}

#[test]
fn saved_cpu_banks_and_discrete_assignments() {
    let fixture: FixtureSet = serde_json::from_str(GOLDEN).unwrap();
    let values: Value = serde_json::from_str(GOLDEN).unwrap();
    for (index, workload) in values["workloads"].as_array().unwrap().iter().enumerate() {
        let result = fit_case(&fixture, index);
        compare(
            &workload["expected"],
            &serde_json::to_value(result.bank).unwrap(),
            &format!("workload[{index}].bank"),
            0.,
        );
    }
}

#[test]
fn cpu_projection_coarse_search_and_exact_seed_trf() {
    let fixture: FixtureSet = serde_json::from_str(GOLDEN).unwrap();
    let projection = check_probes(&fixture);
    assert_eq!(projection["probes"], 45);
    for key in ["residual_max_abs", "jacobian_max_abs"] {
        assert!(projection[key].as_f64().unwrap() < 2e-5, "{projection}");
    }
    assert!(projection["diameter_max_abs"].as_f64().unwrap() < 1e-4);
    let sweep = check_sweeps(&fixture);
    assert!(sweep["rows"].as_u64().unwrap() >= 3000);
    assert_eq!(sweep["length_differences"], 0);
    assert!(sweep["score_max_abs"].as_f64().unwrap() < 1e-6, "{sweep}");
    let solver = check_solvers(&fixture);
    assert!(solver["solves"].as_u64().unwrap() >= 77);
    assert_eq!(solver["stopping_differences"], 0);
    assert!(
        solver["parameter_max_abs"].as_f64().unwrap() < 1e-8,
        "{solver}"
    );
    assert!(solver["cost_max_abs"].as_f64().unwrap() < 1e-8, "{solver}");
}

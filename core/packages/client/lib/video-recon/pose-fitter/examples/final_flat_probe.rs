//! Rematerialize final banks from saved raw observations without any fitting.
use cube_pose_fitter::{
    pipeline::{
        jobs::{run, Job},
        Frame,
    },
    Fit, Geometry,
};
use std::{env, fs};
fn main() {
    let args: Vec<_> = env::args().collect();
    let input: serde_json::Value =
        serde_json::from_str(&fs::read_to_string(&args[1]).unwrap()).unwrap();
    let geometry: Geometry = serde_json::from_value(input["geometry"].clone()).unwrap();
    let cases: Vec<_> = input["cases"].as_array().unwrap().iter().map(|case| {
        let frame: Frame = serde_json::from_value(case["frame"].clone()).unwrap();
        let bank: Vec<Fit> = serde_json::from_value(case["bank"].clone()).unwrap();
        let output = run(&geometry, Job::Finalize {frame, source: None, bank,
            target: None, static_mode: false});
        serde_json::json!({"name":case["name"],"frame":case["frame"]["frame"],"before":case["bank"],"output":output})
    }).collect();
    fs::write(
        &args[2],
        serde_json::to_vec(&serde_json::json!({"cases":cases})).unwrap(),
    )
    .unwrap();
}

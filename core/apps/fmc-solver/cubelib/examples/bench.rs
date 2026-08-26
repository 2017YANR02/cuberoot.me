//! Streaming-convergence benchmark: replays exactly what cubelib-server's
//! /solve_stream does (multi-path-channel solver, step-limit doubling
//! 2^5..2^19, deployed-mallard default config) and prints every improvement
//! with its timestamp. Compare against joba.me/mallard in a browser — the
//! upstream is the same engine behind the same quality-doubling backend.
//!
//! Run: cargo run --release -p cubelib --example bench

use std::str::FromStr;
use std::time::{Duration, Instant};

use cubelib::algs::Algorithm;
use cubelib::cube::Cube333;
use cubelib::defs::{NissSwitchType, StepKind};
use cubelib::steps::step::StepConfig;

fn cfg(kind: StepKind, niss: NissSwitchType, min: u8, max: u8, params: &[(&str, &str)]) -> StepConfig {
    let mut c = StepConfig::new(kind);
    c.niss = Some(niss);
    c.min = Some(min);
    c.max = Some(max);
    c.quality = 10000;
    for (k, v) in params {
        c.params.insert(k.to_string(), v.to_string());
    }
    c
}

/// Deployed mallard default request (captured off joba.me/mallard's POST).
fn pipeline() -> Vec<StepConfig> {
    vec![
        cfg(StepKind::EO, NissSwitchType::Always, 0, 5, &[]),
        cfg(StepKind::RZP, NissSwitchType::Never, 0, 3, &[]),
        cfg(StepKind::DR, NissSwitchType::Before, 0, 12, &[("triggers", "R,R U2 R,R F2 R,R U R,R U' R")]),
        cfg(StepKind::HTR, NissSwitchType::Before, 0, 12, &[]),
        cfg(StepKind::FR, NissSwitchType::Before, 0, 10, &[]),
        cfg(StepKind::FIN, NissSwitchType::Never, 0, 10, &[]),
    ]
}

fn main() {
    let budget = Duration::from_secs(60);
    let scrambles = [
        ("trivial", "R U F R'"),
        ("wca-1", "R' U' F D2 L2 F R2 U2 R2 B D2 L B2 L' B D' U R2 D L2 U' R' U' F"),
        ("wca-2", "D B U B2 R2 U' L2 D2 R2 D' L D2 B D' L2 F' D L' D'"),
        ("wca-3", "D R2 F2 U R2 U B2 L2 U' F2 D' L B F2 R D2 B' D L' U2"),
    ];

    for (name, scr) in scrambles {
        println!("== {name}: {scr}");
        let cube: Cube333 = Algorithm::from_str(scr).unwrap().into();
        let started = Instant::now();
        let mut best = usize::MAX;
        'levels: for level in 5..20usize {
            if started.elapsed() >= budget {
                break;
            }
            let mut steps = cubelib::solver_new::build_steps(pipeline()).unwrap();
            steps.apply_step_limit(1 << level);
            let mut worker = steps.into_worker(cube.clone());
            loop {
                if started.elapsed() >= budget {
                    break 'levels;
                }
                match worker.try_next() {
                    Ok(sol) => {
                        if sol.len() < best {
                            best = sol.len();
                            println!("   {:>2} HTM @ {:>7}ms (limit 2^{level})", best, started.elapsed().as_millis());
                        }
                        break;
                    }
                    Err(cubelib::solver_new::TryRecvError::Disconnected) => break,
                    Err(_) => std::thread::sleep(Duration::from_millis(10)),
                }
            }
        }
        println!("   done in {:?} (best {best})", started.elapsed());
    }
}

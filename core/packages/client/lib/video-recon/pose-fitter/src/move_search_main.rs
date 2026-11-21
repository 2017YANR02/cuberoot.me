use cube_pose_fitter::move_search::{Config, Engine, Frame};
use serde::Deserialize;
use std::{collections::BTreeSet, fs, time::Instant};
#[derive(Deserialize)]
struct Input {
    config: Config,
    frames: Vec<Frame>,
    #[serde(default)]
    probes: Vec<Probe>,
    #[serde(default)]
    actions: Option<Vec<Action>>,
}
#[derive(Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
enum Action {
    Frame { sequence: usize },
    Advance { budget: usize },
    AdvanceSide { direction:usize, budget:usize },
    CompleteJoin { forward_node:usize, backward_steps:Vec<serde_json::Value>, backward_state:Option<Vec<u8>>, stats:serde_json::Value },
    End,
}
#[derive(Deserialize)]
struct Probe {
    sequence: usize,
    state: Vec<u8>,
    cue: Option<usize>,
}
fn main() {
    let args: Vec<_> = std::env::args().collect();
    let data: Input = serde_json::from_str(&fs::read_to_string(&args[1]).unwrap()).unwrap();
    let mode = args.get(3).map(String::as_str).unwrap_or("batch");
    assert!(matches!(mode, "batch" | "stream" | "journal"));
    let budget = args
        .get(4)
        .map(|value| value.parse::<usize>().unwrap())
        .unwrap_or(128);
    let mut engine = Engine::new(data.config).unwrap();
    let mut prepare_seconds = 0.;
    let mut search_seconds = 0.;
    let mut arrival_trace = vec![];
    let mut appended_frames = 0;
    if mode == "journal" {
        let mut received = BTreeSet::new();
        let mut ended = false;
        for action in data
            .actions
            .expect("Journal mode requires recorded actions")
        {
            let start = Instant::now();
            match action {
                Action::Frame { sequence } => {
                    let frame = data
                        .frames
                        .iter()
                        .find(|frame| frame.sequence == sequence)
                        .expect("Journal references an absent fresh frame");
                    engine.push(frame.clone()).unwrap();
                    received.insert(sequence);
                    prepare_seconds += start.elapsed().as_secs_f64();
                }
                Action::Advance { budget } => {
                    engine.advance(budget);
                    search_seconds += start.elapsed().as_secs_f64();
                }
                Action::AdvanceSide {direction,budget}=>{
                    engine.advance_side(direction,budget).unwrap();
                    search_seconds += start.elapsed().as_secs_f64();
                }
                Action::CompleteJoin {forward_node,backward_steps,backward_state,stats}=>{
                    engine.complete_join(forward_node,backward_steps,backward_state,stats).unwrap();
                    search_seconds += start.elapsed().as_secs_f64();
                }
                Action::End => {
                    engine.end().unwrap();
                    ended = true;
                }
            }
        }
        // An EOF capture may precede the worker consuming queued frame messages.
        // Append every missing fresh frame rather than truncating the video.
        for frame in data.frames {
            if received.contains(&frame.sequence) {
                continue;
            }
            assert!(!ended, "Ended journal is missing a fresh frame");
            let start = Instant::now();
            engine.push(frame).unwrap();
            prepare_seconds += start.elapsed().as_secs_f64();
            appended_frames += 1;
        }
        if !ended {
            engine.end().unwrap();
        }
    } else {
        for frame in data.frames {
            let start = Instant::now();
            engine.push(frame).unwrap();
            prepare_seconds += start.elapsed().as_secs_f64();
            if mode == "stream" {
                let start = Instant::now();
                engine.advance(budget);
                search_seconds += start.elapsed().as_secs_f64();
                let result = engine.snapshot();
                arrival_trace.push(serde_json::json!({"frames":result["frames_searchable"],"status":result["status"],
                "expanded":result["stats"]["evaluated_states"],"furthest_admitted":result["furthest_admitted_frames"],
                "pending":result["pending"],"blocked":result["blocked"]}));
            }
        }
        engine.end().unwrap();
    }
    let probes: Vec<_> = data
        .probes
        .into_iter()
        .map(|p| engine.probe(p.sequence, p.state, p.cue).unwrap())
        .collect();
    loop {
        let start = Instant::now();
        engine.advance(10000);
        search_seconds += start.elapsed().as_secs_f64();
        if engine.snapshot()["status"] != "running" {
            break;
        }
    }
    let out = serde_json::json!({"mode":mode,"result":engine.snapshot(),"probes":probes,"prepare_seconds":prepare_seconds,"search_seconds":search_seconds,"arrival_trace":arrival_trace,"appended_frames":appended_frames});
    fs::write(&args[2], serde_json::to_vec(&out).unwrap()).unwrap();
    println!("{}", engine.snapshot()["status"]);
}

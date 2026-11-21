use cube_pose_fitter::{check_probes, check_solvers, fit_case, FixtureSet};
use std::{
    env, fs,
    io::{self, BufRead, Write},
    time::Instant,
};
fn main() {
    let args: Vec<String> = env::args().collect();
    let set: FixtureSet = serde_json::from_str(&fs::read_to_string(&args[1]).unwrap()).unwrap();

    if args.get(2).is_some_and(|v| v == "--serve") {
        println!(
            "{}",
            serde_json::json!({"ready":true,"probes":{"projection":check_probes(&set),"solver":check_solvers(&set),"sweep":cube_pose_fitter::check_sweeps(&set)}})
        );
        io::stdout().flush().unwrap();
        for line in io::stdin().lock().lines() {
            let request: serde_json::Value = serde_json::from_str(&line.unwrap()).unwrap();
            let index = request["index"].as_u64().unwrap() as usize;
            let start = Instant::now();
            let result = fit_case(&set, index);
            let ms = start.elapsed().as_secs_f64() * 1000.;
            println!(
                "{}",
                serde_json::json!({"index":index,"ms":ms,"bank":result.bank,"refinements":result.refinements})
            );
            io::stdout().flush().unwrap();
        }
        return;
    }
    let repeats: usize = args.get(2).map(|s| s.parse().unwrap()).unwrap_or(5);
    let mut cases = vec![];
    for i in 0..set.workloads.len() {
        let _ = fit_case(&set, i);
        let mut times = vec![];
        let mut result = fit_case(&set, i);
        for _ in 0..repeats {
            let start = Instant::now();
            result = fit_case(&set, i);
            times.push(start.elapsed().as_secs_f64() * 1000.);
        }
        eprintln!(
            "{} {} {} candidates {}ms",
            set.workloads[i].name,
            set.workloads[i].stage,
            result.bank.len(),
            times[0]
        );
        cases.push(serde_json::json!({"index":i,"times_ms":times,"bank":result.bank,"refinements":result.refinements}));
    }
    println!(
        "{}",
        serde_json::json!({"probes":{"projection":check_probes(&set),"solver":check_solvers(&set),"sweep":cube_pose_fitter::check_sweeps(&set)},"cases":cases})
    );
}

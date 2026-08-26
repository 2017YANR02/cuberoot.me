//! cubelib-server: tiny HTTP front for cubelib's FMC solver.
//! Mirrors the upstream mallard deployment (joba.me/cubeapi), which is a native
//! backend service — NOT browser wasm. Two endpoints:
//!
//!   GET /solve?scramble=&steps=&count=        one-shot, nginx-cacheable JSON
//!   GET /solve_stream?scramble=&steps=&budget= NDJSON stream, quality-doubling
//!       (2^5..2^19 step-limit levels via the multi-path-channel solver, same
//!       as mallard's `backend=multi_path_channel`), each strictly-shorter
//!       solution pushed as a line, final {"done":true}.
//!
//! DR steps carry the HTR subset annotation (e.g. "4a1 4e") in `comment`,
//! ported verbatim from mallard's backend add_comments().

use std::collections::HashMap;
use std::io::Write;
use std::str::FromStr;
use std::sync::{Arc, LazyLock, Mutex};
use std::thread;
use std::time::{Duration, Instant};

use cubelib::algs::Algorithm;
use cubelib::cube::turn::{ApplyAlgorithm, TransformableMut};
use cubelib::cube::{Cube333, Transformation333};
use cubelib::defs::{NissSwitchType, StepKind};
use cubelib::solver::df_search::CancelToken;
use cubelib::solver::solution::Solution;
use cubelib::solver_new::TryRecvError;
use cubelib::steps::coord::Coord;
use cubelib::steps::dr::coords::DRUDEOFBCoord;
use cubelib::steps::htr::coords::HTRDRUDCoord;
use cubelib::steps::htr::subsets::DR_SUBSETS;
use cubelib::steps::solver;
use cubelib::steps::step::StepConfig;
use cubelib::steps::tables::PruningTables333;
use tiny_http::{Header, Method, Response, Server};

/// The deployed mallard's default request, captured verbatim off
/// joba.me/mallard's POST to /cubeapi/solve_stream: RELATIVE per-step
/// min/max (not the absolute caps in current git HEAD), quality 10000
/// (overridden per level by the step-limit doubling anyway).
const DEFAULT_STEPS: &str = "EO[niss=always;min=0;max=5;quality=10000] > \
    RZP[niss=never;min=0;max=3;quality=10000] > \
    DR[niss=before;min=0;max=12;quality=10000;triggers=R,R U2 R,R F2 R,R U R,R U' R] > \
    HTR[niss=before;min=0;max=12;quality=10000] > \
    FR[niss=before;min=0;max=10;quality=10000] > \
    FIN[niss=never;min=0;max=10;quality=10000]";

const DEFAULT_BUDGET_MS: u64 = 30_000;
const MAX_BUDGET_MS: u64 = 120_000;
/// mallard backend: (5..20).map(|q| 2^q) step-limit levels.
const LEVELS: std::ops::Range<usize> = 5..20;

static SOLVE_GATE: LazyLock<Mutex<()>> = LazyLock::new(|| Mutex::new(()));
static STREAM_CACHE: LazyLock<Mutex<HashMap<String, String>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));

fn main() {
    let addr = std::env::args().nth(1).unwrap_or_else(|| "127.0.0.1:8099".to_string());
    let server = Arc::new(Server::http(addr.as_str()).expect("bind"));
    eprintln!("[cubelib-server] listening on http://{addr}/solve");

    // Bind first, generate tables behind the mutex: early requests queue on the
    // lock instead of getting connection-refused during first-boot generation.
    let tables = Arc::new(Mutex::new(PruningTables333::new()));
    {
        let tables = tables.clone();
        thread::spawn(move || {
            let t0 = Instant::now();
            let mut guard = tables.lock().unwrap();
            // Both FIN shapes (with/without FR) so one-shot requests never
            // hit a missing-table panic; leave-slice variants gen lazily.
            for steps in ["EO > RZP > DR > HTR > FR > FIN", "EO > DR > HTR > FIN"] {
                solver::gen_tables(&parse_steps(steps).unwrap(), &mut guard);
            }
            drop(guard);
            // Force the multi-path-channel solver's lazy statics (small tables
            // only — DR-finish would be ~10 GB and stays gated off).
            LazyLock::force(&cubelib::solver_new::eo::EO_TABLE);
            LazyLock::force(&cubelib::solver_new::dr::DR_TABLE);
            LazyLock::force(&cubelib::solver_new::htr::HTR_TABLES);
            LazyLock::force(&cubelib::solver_new::fr::FR_TABLE);
            LazyLock::force(&cubelib::solver_new::fr::FR_LEAVE_SLICE_TABLE);
            LazyLock::force(&cubelib::solver_new::finish::FR_FINISH_TABLE);
            LazyLock::force(&cubelib::solver_new::finish::HTR_FINISH_TABLE);
            LazyLock::force(&cubelib::solver_new::finish::HTR_LEAVE_SLICE_FINISH_TABLE);
            eprintln!("[cubelib-server] tables ready in {}ms", t0.elapsed().as_millis());
        });
    }

    loop {
        let request = match server.recv() {
            Ok(r) => r,
            Err(_) => break,
        };
        let tables = tables.clone();
        thread::spawn(move || {
            let url = request.url().to_string();
            let (path, query) = url.split_once('?').unwrap_or((url.as_str(), ""));
            if request.method() != &Method::Get {
                respond_json(request, r#"{"error":"use GET"}"#.to_string());
            } else if path == "/solve_stream" {
                handle_stream(request, query);
            } else if path.starts_with("/solve") {
                let body = handle_solve(query, &tables);
                respond_json(request, body);
            } else {
                respond_json(request, r#"{"error":"not found"}"#.to_string());
            }
        });
    }
}

fn respond_json(request: tiny_http::Request, body: String) {
    let mut resp = Response::from_string(body);
    resp.add_header(Header::from_bytes(&b"Content-Type"[..], &b"application/json"[..]).unwrap());
    resp.add_header(Header::from_bytes(&b"Access-Control-Allow-Origin"[..], &b"*"[..]).unwrap());
    let _ = request.respond(resp);
}

struct Params {
    scramble: String,
    steps: String,
    count: usize,
    budget: Duration,
}

fn parse_query(query: &str) -> Params {
    let mut p = Params {
        scramble: String::new(),
        steps: DEFAULT_STEPS.to_string(),
        count: 10,
        budget: Duration::from_millis(DEFAULT_BUDGET_MS),
    };
    for kv in query.split('&') {
        let Some((k, v)) = kv.split_once('=') else { continue };
        let v = urldecode(v);
        match k {
            "scramble" => p.scramble = v,
            "steps" => p.steps = v,
            "count" => p.count = v.parse().unwrap_or(10),
            "budget" => {
                p.budget = Duration::from_millis(
                    v.parse::<u64>().unwrap_or(DEFAULT_BUDGET_MS).clamp(1_000, MAX_BUDGET_MS),
                )
            }
            _ => {}
        }
    }
    p
}

// ---------------- one-shot /solve (nginx-cacheable) ----------------

fn handle_solve(query: &str, tables: &Mutex<PruningTables333>) -> String {
    let p = parse_query(query);
    let alg = match Algorithm::from_str(p.scramble.trim()) {
        Ok(a) => a,
        Err(_) => return r#"{"error":"invalid scramble"}"#.to_string(),
    };
    let cube: Cube333 = alg.into();
    let configs = match parse_steps(&p.steps) {
        Ok(c) => c,
        Err(e) => return format!("{{\"error\":\"{}\"}}", json_escape(&e)),
    };
    if let Err(e) = check_supported(&configs) {
        return format!("{{\"error\":\"{}\"}}", json_escape(&e));
    }
    let sols_result: Result<Vec<_>, String> = {
        let mut guard = tables.lock().unwrap();
        solver::gen_tables(&configs, &mut guard);
        let r = match solver::build_steps(configs, &guard) {
            Ok(built) => {
                let cancel = CancelToken::default();
                Ok(cubelib::solver::solve_steps(cube, &built, &cancel)
                    .take(p.count.clamp(1, 50))
                    .collect())
            }
            Err(e) => Err(e),
        };
        r
    };
    let mut sols = match sols_result {
        Ok(s) => s,
        Err(e) => return format!("{{\"error\":\"{}\"}}", json_escape(&e)),
    };
    for sol in sols.iter_mut() {
        add_comments(&cube, sol);
    }
    let mut out = String::from("{\"solutions\":[");
    for (i, sol) in sols.iter().enumerate() {
        if i > 0 {
            out.push(',');
        }
        out.push_str(&solution_to_json(sol));
    }
    out.push_str("]}");
    out
}

// ---------------- streaming /solve_stream (mallard parity) ----------------
//
// tiny_http's Response pipeline buffers the whole chunked body until EOF
// (measured: every line arrived only when the budget expired), so we take the
// raw connection via Request::into_writer() and hand-write an HTTP/1.1
// chunked response, flushing after every NDJSON line. A failed flush = client
// disconnected = stop solving immediately (frees the solve gate).

/// Hand-rolled chunked response writer; flush-per-line is the whole point.
struct StreamSink {
    w: Box<dyn Write + Send + 'static>,
    transcript: String,
    alive: bool,
}

impl StreamSink {
    fn open(request: tiny_http::Request) -> Option<StreamSink> {
        let mut w = request.into_writer();
        let head = "HTTP/1.1 200 OK\r\n\
            Content-Type: application/x-ndjson\r\n\
            Access-Control-Allow-Origin: *\r\n\
            X-Accel-Buffering: no\r\n\
            Cache-Control: no-store\r\n\
            Transfer-Encoding: chunked\r\n\
            Connection: close\r\n\r\n";
        if w.write_all(head.as_bytes()).and_then(|_| w.flush()).is_err() {
            return None;
        }
        Some(StreamSink { w, transcript: String::new(), alive: true })
    }

    fn write_chunk(&mut self, data: &[u8]) -> bool {
        if !self.alive {
            return false;
        }
        let r = write!(self.w, "{:x}\r\n", data.len())
            .and_then(|_| self.w.write_all(data))
            .and_then(|_| self.w.write_all(b"\r\n"))
            .and_then(|_| self.w.flush());
        if r.is_err() {
            self.alive = false;
        }
        self.alive
    }

    /// One NDJSON line: recorded in the transcript (for the replay cache) and
    /// flushed to the client.
    fn line(&mut self, line: &str) -> bool {
        self.transcript.push_str(line);
        self.transcript.push('\n');
        self.write_chunk(format!("{line}\n").as_bytes())
    }

    /// Blank keepalive (not part of the transcript). Doubles as disconnect
    /// detection: a dead socket fails the flush within ~1-2 ticks.
    fn keepalive(&mut self) -> bool {
        self.write_chunk(b"\n")
    }

    fn finish(mut self) -> String {
        if self.alive {
            let _ = self.w.write_all(b"0\r\n\r\n").and_then(|_| self.w.flush());
        }
        self.transcript
    }
}

fn handle_stream(request: tiny_http::Request, query: &str) {
    let p = parse_query(query);
    let cache_key = format!("{}\x1f{}\x1f{}", p.scramble, p.steps, p.budget.as_millis());
    if let Some(hit) = STREAM_CACHE.lock().unwrap().get(&cache_key).cloned() {
        respond_stream_string(request, hit);
        return;
    }
    let Some(mut sink) = StreamSink::open(request) else { return };
    let found = run_stream(&p, &mut sink);
    let complete = sink.alive;
    let transcript = sink.finish();
    // Cache only fully-delivered transcripts (key includes the budget, so
    // partial convergence under a small budget never poisons a larger one).
    if found && complete && transcript.len() < 256 * 1024 {
        let mut cache = STREAM_CACHE.lock().unwrap();
        if cache.len() >= 300 {
            cache.clear();
        }
        cache.insert(cache_key, transcript);
    }
}

/// Returns whether any solution was found.
fn run_stream(p: &Params, sink: &mut StreamSink) -> bool {
    let started = Instant::now();

    let alg = match Algorithm::from_str(p.scramble.trim()) {
        Ok(a) => a,
        Err(_) => {
            sink.line(r#"{"error":"invalid scramble","done":true}"#);
            return false;
        }
    };
    let cube: Cube333 = alg.into();
    let configs = match parse_steps(&p.steps).and_then(|c| check_supported(&c).map(|_| c)) {
        Ok(c) => c,
        Err(e) => {
            sink.line(&format!("{{\"error\":\"{}\",\"done\":true}}", json_escape(&e)));
            return false;
        }
    };

    // Single-flight: one heavy solve at a time on the small box. Tell the
    // client it's queued (UI progress) and keep the socket alive.
    let mut told_queued = false;
    let _gate = loop {
        match SOLVE_GATE.try_lock() {
            Ok(g) => break g,
            Err(_) => {
                if started.elapsed() >= p.budget {
                    sink.line(r#"{"done":true,"queue_timeout":true}"#);
                    return false;
                }
                if !told_queued {
                    told_queued = true;
                    if !sink.line(&format!(
                        "{{\"queued\":true,\"elapsed_ms\":{}}}",
                        started.elapsed().as_millis()
                    )) {
                        return false;
                    }
                } else if !sink.keepalive() {
                    return false;
                }
                thread::sleep(Duration::from_millis(500));
            }
        }
    };

    let mut best = usize::MAX;
    let mut completed = true;
    let mut last_keepalive = Instant::now();
    'levels: for level in LEVELS {
        let quality = 1usize << level;
        if started.elapsed() >= p.budget {
            completed = false;
            break;
        }
        // Per-level progress marker so the UI can show how deep the search is.
        if !sink.line(&format!(
            "{{\"progress\":{{\"limit\":{},\"elapsed_ms\":{}}}}}",
            quality,
            started.elapsed().as_millis()
        )) {
            return best != usize::MAX;
        }
        let mut steps = match cubelib::solver_new::build_steps(configs.clone()) {
            Ok(s) => s,
            Err(e) => {
                sink.line(&format!("{{\"error\":\"{}\",\"done\":true}}", json_escape(&e)));
                return best != usize::MAX;
            }
        };
        steps.apply_step_limit(quality);
        let mut worker = steps.into_worker(cube.clone());
        loop {
            if started.elapsed() >= p.budget {
                completed = false;
                break 'levels;
            }
            match worker.try_next() {
                Ok(mut sol) => {
                    if sol.len() < best {
                        best = sol.len();
                        add_comments(&cube, &mut sol);
                        let line = format!(
                            "{{\"solution\":{},\"quality\":{},\"elapsed_ms\":{},\"done\":false}}",
                            solution_to_json(&sol),
                            quality,
                            started.elapsed().as_millis(),
                        );
                        if !sink.line(&line) {
                            return true;
                        }
                    }
                    break; // first solution of this level -> next level
                }
                Err(TryRecvError::Disconnected) => break, // level exhausted
                Err(_) => {
                    if last_keepalive.elapsed() > Duration::from_secs(1) {
                        last_keepalive = Instant::now();
                        if !sink.keepalive() {
                            return best != usize::MAX;
                        }
                    }
                    thread::sleep(Duration::from_millis(25));
                }
            }
        }
    }

    sink.line(&format!(
        "{{\"done\":true,\"elapsed_ms\":{},\"exhausted\":{}}}",
        started.elapsed().as_millis(),
        completed,
    ));
    best != usize::MAX
}

fn respond_stream_string(request: tiny_http::Request, body: String) {
    let mut resp = Response::from_string(body);
    resp.add_header(
        Header::from_bytes(&b"Content-Type"[..], &b"application/x-ndjson"[..]).unwrap(),
    );
    resp.add_header(Header::from_bytes(&b"Access-Control-Allow-Origin"[..], &b"*"[..]).unwrap());
    let _ = request.respond(resp);
}

// ---------------- shared pieces ----------------

/// The DR-finish pruning table behind `htr-breaking` is ~10 GB (generated
/// in-memory) — far beyond this server. Gate it off with a clear error.
fn check_supported(configs: &[StepConfig]) -> Result<(), String> {
    for c in configs {
        if c.params.get("htr-breaking").map(|v| v == "true").unwrap_or(false) {
            return Err("htr-breaking requires the ~10GB DR-finish table; not enabled on this server".to_string());
        }
    }
    Ok(())
}

/// Ported verbatim from mallard's backend (controller.rs add_comments):
/// after each DR step, normalize orientation until the DR axis is UD, then
/// look up the HTR subset and store its name ("4a1 4e") as the comment.
fn add_comments(scrambled: &Cube333, solution: &mut Solution) {
    let subset_table = &cubelib::solver_new::htr::HTR_TABLES.1;
    let mut cube = scrambled.clone();
    for step in solution.steps.iter_mut() {
        cube.apply_alg(&step.alg);
        if StepKind::from(step.variant) == StepKind::DR {
            let mut c = cube.clone();
            for _ in 0..3 {
                if DRUDEOFBCoord::from(&c).val() == 0 {
                    break;
                }
                c.transform(Transformation333::X);
                c.transform(Transformation333::Z);
            }
            let subset_id = subset_table.get_direct(HTRDRUDCoord::from(&c));
            step.comment = DR_SUBSETS[subset_id as usize].to_string();
        }
    }
}

fn parse_steps(steps: &str) -> Result<Vec<StepConfig>, String> {
    steps.split('>').map(|s| s.trim()).filter(|s| !s.is_empty()).map(parse_one).collect()
}

fn parse_one(step: &str) -> Result<StepConfig, String> {
    let (name, params) = match step.find('[') {
        None => (step, ""),
        Some(i) => {
            if !step.ends_with(']') {
                return Err(format!("expected ] in '{}'", step));
            }
            (&step[..i], &step[i + 1..step.len() - 1])
        }
    };
    let kind =
        StepKind::from_str(name.trim()).map_err(|_| format!("invalid step '{}'", name.trim()))?;
    let mut cfg = StepConfig::new(kind);
    for param in params.split(';') {
        let param = param.trim();
        if param.is_empty() {
            continue;
        }
        let Some((k, v)) = param.split_once('=') else {
            cfg.substeps.get_or_insert_with(Vec::new).push(param.to_string());
            continue;
        };
        let (k, v) = (k.trim(), v.trim());
        match k {
            "min" => cfg.min = Some(u8::from_str(v).map_err(|_| "bad min")?),
            "max" => cfg.max = Some(u8::from_str(v).map_err(|_| "bad max")?),
            "min-abs" => cfg.absolute_min = Some(u8::from_str(v).map_err(|_| "bad min-abs")?),
            "max-abs" => cfg.absolute_max = Some(u8::from_str(v).map_err(|_| "bad max-abs")?),
            "limit" => cfg.step_limit = Some(usize::from_str(v).map_err(|_| "bad limit")?),
            "quality" => cfg.quality = usize::from_str(v).map_err(|_| "bad quality")?,
            "niss" => {
                cfg.niss = Some(match v {
                    "always" | "true" => NissSwitchType::Always,
                    "before" => NissSwitchType::Before,
                    "none" | "never" | "false" => NissSwitchType::Never,
                    x => return Err(format!("invalid niss '{}'", x)),
                })
            }
            "substeps" | "variants" => {
                for sub in v.split(',') {
                    let sub = sub.trim();
                    if !sub.is_empty() {
                        cfg.substeps.get_or_insert_with(Vec::new).push(sub.to_string());
                    }
                }
            }
            // DR params cubelib reads from the params map: triggers (comma
            // algs) and subsets (comma subset names like 4a1).
            "triggers" | "subsets" => {
                cfg.params.insert(k.to_string(), v.to_string());
            }
            // Exclude solutions: '|'-separated algs (NISS notation ok, e.g. "(R U)").
            "excl" => {
                for a in v.split('|') {
                    let a = a.trim();
                    if !a.is_empty() {
                        if let Ok(alg) = Algorithm::from_str(a) {
                            cfg.excluded.insert(alg);
                        }
                    }
                }
            }
            other => {
                cfg.params.insert(other.to_string(), v.to_string());
            }
        }
    }
    Ok(cfg)
}

/// One solution -> mallard-shaped JSON. `cum` follows the upstream Display
/// impl: running canonicalized length (move cancellations between steps are
/// reflected), `cancelled` is how many moves merged away at this step.
fn solution_to_json(sol: &Solution) -> String {
    let mut out = String::from("{\"steps\":[");
    let mut collected = Algorithm::new();
    let n = sol.steps.len();
    for (i, step) in sol.steps.iter().enumerate() {
        if i > 0 {
            out.push(',');
        }
        let kind_enum = StepKind::from(step.variant);
        let kind = format!("{:?}", kind_enum).to_lowercase();
        let normal =
            step.alg.normal_moves.iter().map(|t| t.to_string()).collect::<Vec<_>>().join(" ");
        let inverse =
            step.alg.inverse_moves.iter().map(|t| t.to_string()).collect::<Vec<_>>().join(" ");
        let len = step.alg.len();
        let prev = collected.len();
        collected = if i + 1 == n && matches!(kind_enum, StepKind::FIN | StepKind::FINLS) {
            (collected + step.alg.clone()).to_uninverted()
        } else {
            collected + step.alg.clone()
        }
        .canonicalize();
        let cancelled = (prev + len).saturating_sub(collected.len());
        out.push_str(&format!(
            "{{\"kind\":\"{}\",\"variant\":\"{}\",\"normal\":\"{}\",\"inverse\":\"{}\",\"comment\":\"{}\",\"len\":{},\"cancelled\":{},\"cum\":{}}}",
            json_escape(&kind),
            json_escape(&step.variant.to_string()),
            json_escape(&normal),
            json_escape(&inverse),
            json_escape(step.comment.trim()),
            len,
            cancelled,
            collected.len(),
        ));
    }
    out.push_str(&format!(
        "],\"solution\":\"{}\",\"total\":{}}}",
        json_escape(&collected.to_string()),
        collected.len()
    ));
    out
}

fn json_escape(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for c in s.chars() {
        match c {
            '"' => out.push_str("\\\""),
            '\\' => out.push_str("\\\\"),
            '\n' => out.push_str("\\n"),
            '\r' => out.push_str("\\r"),
            '\t' => out.push_str("\\t"),
            c if (c as u32) < 0x20 => out.push_str(&format!("\\u{:04x}", c as u32)),
            c => out.push(c),
        }
    }
    out
}

fn urldecode(s: &str) -> String {
    let b = s.as_bytes();
    let mut out = Vec::with_capacity(b.len());
    let mut i = 0;
    while i < b.len() {
        match b[i] {
            b'+' => {
                out.push(b' ');
                i += 1;
            }
            b'%' if i + 2 < b.len() => {
                let h = u8::from_str_radix(&s[i + 1..i + 3], 16);
                if let Ok(byte) = h {
                    out.push(byte);
                    i += 3;
                } else {
                    out.push(b'%');
                    i += 1;
                }
            }
            c => {
                out.push(c);
                i += 1;
            }
        }
    }
    String::from_utf8_lossy(&out).into_owned()
}

#[cfg(test)]
mod tests {
    use super::*;

    const TRIVIAL: &str = "R U F R'";
    const WCA1: &str = "R' U' F D2 L2 F R2 U2 R2 B D2 L B2 L' B D' U R2 D L2 U' R' U' F";
    const WCA2: &str = "D B U B2 R2 U' L2 D2 R2 D' L D2 B D' L2 F' D L' D'";
    const WCA3: &str = "D R2 F2 U R2 U B2 L2 U' F2 D' L B F2 R D2 B' D L' U2";

    /// Does (scramble ++ solution) bring a solved cube back to solved?
    fn solves(scr: &str, sol: &str) -> bool {
        let mut cube = Cube333::default();
        cube.apply_alg(&Algorithm::from_str(scr).unwrap());
        cube.apply_alg(&Algorithm::from_str(sol).unwrap());
        cube == Cube333::default()
    }

    fn linearize(sol: &Solution) -> (usize, String) {
        let a: Algorithm = sol.clone().into();
        let last_fin = matches!(
            sol.steps.last().map(|s| StepKind::from(s.variant)),
            Some(StepKind::FIN) | Some(StepKind::FINLS)
        );
        let a = if last_fin { a.to_uninverted() } else { a };
        let a = a.canonicalize();
        (a.len(), a.to_string())
    }

    /// First solution from the multi-path-channel solver at one step-limit level.
    fn solve_mpc(scr: &str, level_limit: usize) -> Option<Solution> {
        let cube: Cube333 = Algorithm::from_str(scr).unwrap().into();
        let configs = parse_steps(DEFAULT_STEPS).unwrap();
        let mut steps = cubelib::solver_new::build_steps(configs).unwrap();
        steps.apply_step_limit(level_limit);
        let mut worker = steps.into_worker(cube);
        worker.next()
    }

    // ---- correctness: mpc solutions at the deployed default config must
    // actually solve, and quality-doubling must never lengthen ----
    #[test]
    fn mpc_solutions_solve_and_converge() {
        for scr in [TRIVIAL, WCA1, WCA2, WCA3] {
            let lo = solve_mpc(scr, 1 << 5).expect("level-32 solution");
            let (lo_len, lo_sol) = linearize(&lo);
            assert!(solves(scr, &lo_sol), "does NOT solve: {scr} -> {lo_sol}");
            assert_eq!(lo_len, lo.len());

            let hi = solve_mpc(scr, 1 << 9).expect("level-512 solution");
            let (hi_len, hi_sol) = linearize(&hi);
            assert!(solves(scr, &hi_sol), "does NOT solve: {scr} -> {hi_sol}");
            assert!(hi_len <= lo_len, "doubling must not lengthen ({hi_len} > {lo_len})");
        }
    }

    // ---- DR subset annotation (mallard add_comments parity): every DR step
    // gets a valid subset name like "4a1 4e" ----
    #[test]
    fn dr_subset_comment_present() {
        let cube: Cube333 = Algorithm::from_str(WCA1).unwrap().into();
        let mut sol = solve_mpc(WCA1, 1 << 7).expect("solution");
        add_comments(&cube, &mut sol);
        let dr = sol
            .steps
            .iter()
            .find(|s| StepKind::from(s.variant) == StepKind::DR)
            .expect("a DR step");
        assert!(
            DR_SUBSETS.iter().any(|s| s.to_string() == dr.comment),
            "comment '{}' is not a known DR subset",
            dr.comment
        );
    }

    // ---- one-shot path: solves + golden baseline at the mallard default
    // config (deterministic). Update intentionally on config/engine change. ----
    #[test]
    fn oneshot_golden() {
        let mut tables = PruningTables333::new();
        solver::gen_tables(&parse_steps(DEFAULT_STEPS).unwrap(), &mut tables);
        let tables = Mutex::new(tables);
        for (scr, expect) in [(TRIVIAL, 4usize)] {
            let body = handle_solve(
                &format!("scramble={}&count=1", scr.replace(' ', "+")),
                &tables,
            );
            assert!(body.contains(&format!("\"total\":{expect}")), "{scr}: {body}");
        }
        // trivial scramble: exact bit-identical solution as upstream
        let body = handle_solve("scramble=R+U+F+R'&count=1", &tables);
        assert!(body.contains("\"solution\":\"R F' U' R'\""), "{body}");
    }

    // ---- htr-breaking is gated (DR-finish table ~10GB) ----
    #[test]
    fn htr_breaking_gated() {
        let configs = parse_steps("EO > DR > HTR > FIN[htr-breaking=true]").unwrap();
        assert!(check_supported(&configs).is_err());
        let configs = parse_steps(DEFAULT_STEPS).unwrap();
        assert!(check_supported(&configs).is_ok());
    }

    // ---- steps-string parser ----
    #[test]
    fn parse_steps_basic() {
        let c = parse_steps(DEFAULT_STEPS).unwrap();
        assert_eq!(c.len(), 6);
        assert_eq!(c[0].kind, StepKind::EO);
        assert_eq!(c[0].niss, Some(NissSwitchType::Always));
        assert_eq!(c[0].max, Some(5));
        assert_eq!(c[1].kind, StepKind::RZP);
        assert_eq!(c[1].max, Some(3));
        assert_eq!(c[2].params.get("triggers").unwrap(), "R,R U2 R,R F2 R,R U R,R U' R");
        assert_eq!(c[2].max, Some(12));
        assert_eq!(c[2].quality, 10000);
        assert_eq!(c[5].kind, StepKind::FIN);
        // invalid niss rejected
        assert!(parse_steps("EO[niss=bogus]").is_err());
        // bare axis token -> substep
        let d = parse_steps("DR[drud;drfb]").unwrap();
        assert_eq!(d[0].substeps.as_ref().unwrap().len(), 2);
    }
}

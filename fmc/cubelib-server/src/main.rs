//! cubelib-server: tiny HTTP front for cubelib's FMC solver.
//! Generates every pruning table once at startup (cached on disk via the `fs`
//! feature, then mmap'd — ~9 MB resident), then serves:
//!   GET /solve?scramble=<wca>&steps=<cli-steps>&count=<n>
//! returning {"solutions":[{"steps":[…],"solution":"…","total":N}]} (mallard format).

use std::str::FromStr;

use cubelib::algs::Algorithm;
use cubelib::cube::Cube333;
use cubelib::defs::{NissSwitchType, StepKind};
use cubelib::solver::df_search::CancelToken;
use cubelib::steps::solver;
use cubelib::steps::step::StepConfig;
use cubelib::steps::tables::PruningTables333;
use tiny_http::{Header, Method, Response, Server};

fn main() {
    let addr = std::env::args().nth(1).unwrap_or_else(|| "127.0.0.1:8099".to_string());

    eprintln!("[cubelib-server] generating tables…");
    let t0 = std::time::Instant::now();
    let mut tables = PruningTables333::new();
    let full = vec![
        StepConfig::new(StepKind::EO),
        StepConfig::new(StepKind::RZP),
        StepConfig::new(StepKind::DR),
        StepConfig::new(StepKind::HTR),
        StepConfig::new(StepKind::FR),
        StepConfig::new(StepKind::FIN),
    ];
    solver::gen_tables(&full, &mut tables);
    eprintln!("[cubelib-server] tables ready in {}ms", t0.elapsed().as_millis());

    let server = Server::http(addr.as_str()).expect("bind");
    eprintln!("[cubelib-server] listening on http://{addr}/solve");

    for request in server.incoming_requests() {
        let url = request.url().to_string();
        let body = if request.method() == &Method::Get {
            handle(&url, &mut tables)
        } else {
            r#"{"error":"use GET /solve?scramble=…&steps=…"}"#.to_string()
        };
        let mut resp = Response::from_string(body);
        resp.add_header(Header::from_bytes(&b"Content-Type"[..], &b"application/json"[..]).unwrap());
        resp.add_header(Header::from_bytes(&b"Access-Control-Allow-Origin"[..], &b"*"[..]).unwrap());
        let _ = request.respond(resp);
    }
}

fn handle(url: &str, tables: &mut PruningTables333) -> String {
    let (path, query) = url.split_once('?').unwrap_or((url, ""));
    if !path.starts_with("/solve") {
        return r#"{"error":"not found"}"#.to_string();
    }
    let mut scramble = String::new();
    let mut steps = String::from("EO[niss=always] > DR[niss=before] > HTR[niss=before] > FIN");
    let mut count = 10usize;
    for kv in query.split('&') {
        let Some((k, v)) = kv.split_once('=') else { continue };
        let v = urldecode(v);
        match k {
            "scramble" => scramble = v,
            "steps" => steps = v,
            "count" => count = v.parse().unwrap_or(10),
            _ => {}
        }
    }
    solve_json(&scramble, &steps, count, tables)
}

fn solve_json(scramble: &str, steps: &str, count: usize, tables: &mut PruningTables333) -> String {
    let alg = match Algorithm::from_str(scramble.trim()) {
        Ok(a) => a,
        Err(_) => return r#"{"error":"invalid scramble"}"#.to_string(),
    };
    let cube: Cube333 = alg.into();
    let configs = match parse_steps(steps) {
        Ok(c) => c,
        Err(e) => return format!("{{\"error\":\"{}\"}}", json_escape(&e)),
    };
    // Generate any tables this specific pipeline needs but we don't have yet
    // (gen_tables only fills missing ones; first request of each shape pays ~ms).
    solver::gen_tables(&configs, tables);
    let built = match solver::build_steps(configs, tables) {
        Ok(s) => s,
        Err(e) => return format!("{{\"error\":\"{}\"}}", json_escape(&e)),
    };
    let cancel = CancelToken::default();
    let sols: Vec<_> =
        cubelib::solver::solve_steps(cube, &built, &cancel).take(count.clamp(1, 50)).collect();
    solutions_to_json(&sols)
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
            "substeps" | "variants" | "subsets" => {
                for sub in v.split(',') {
                    let sub = sub.trim();
                    if !sub.is_empty() {
                        cfg.substeps.get_or_insert_with(Vec::new).push(sub.to_string());
                    }
                }
            }
            // DR triggers: cubelib reads them from params["triggers"] (comma algs).
            "triggers" => {
                cfg.params.insert("triggers".to_string(), v.to_string());
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

fn solutions_to_json(solutions: &[cubelib::solver::solution::Solution]) -> String {
    let mut out = String::from("{\"solutions\":[");
    for (si, sol) in solutions.iter().enumerate() {
        if si > 0 {
            out.push(',');
        }
        out.push_str("{\"steps\":[");
        let mut cum = 0usize;
        for (i, step) in sol.get_steps().iter().enumerate() {
            if i > 0 {
                out.push(',');
            }
            let kind = format!("{:?}", StepKind::from(step.variant)).to_lowercase();
            let normal =
                step.alg.normal_moves.iter().map(|t| t.to_string()).collect::<Vec<_>>().join(" ");
            let inverse =
                step.alg.inverse_moves.iter().map(|t| t.to_string()).collect::<Vec<_>>().join(" ");
            let len = step.alg.len();
            cum += len;
            out.push_str(&format!(
                "{{\"kind\":\"{}\",\"variant\":\"{}\",\"normal\":\"{}\",\"inverse\":\"{}\",\"comment\":\"{}\",\"len\":{},\"cum\":{}}}",
                json_escape(&kind),
                json_escape(&step.variant.to_string()),
                json_escape(&normal),
                json_escape(&inverse),
                json_escape(step.comment.trim()),
                len,
                cum,
            ));
        }
        let alg: Algorithm = sol.clone().into();
        let last_fin =
            matches!(sol.get_steps().last().map(|s| StepKind::from(s.variant)), Some(StepKind::FIN));
        let alg = if last_fin { alg.to_uninverted() } else { alg };
        let alg = alg.canonicalize();
        out.push_str(&format!(
            "],\"solution\":\"{}\",\"total\":{}}}",
            json_escape(&alg.to_string()),
            alg.len()
        ));
    }
    out.push_str("]}");
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
    use cubelib::cube::turn::ApplyAlgorithm;

    // Deployed default pipeline (what ChainExplorer sends): EO(always) > RZP >
    // DR(before) > HTR(before) > FR(before) > FIN, quality=1000.
    const DEPLOYED: &str = "EO[niss=always;quality=1000] > RZP[niss=never] > \
        DR[niss=before;quality=1000] > HTR[niss=before;quality=1000] > \
        FR[niss=before;quality=1000] > FIN[niss=never;quality=1000]";

    const TRIVIAL: &str = "R U F R'";
    const WCA1: &str = "R' U' F D2 L2 F R2 U2 R2 B D2 L B2 L' B D' U R2 D L2 U' R' U' F";
    const WCA2: &str = "D B U B2 R2 U' L2 D2 R2 D' L D2 B D' L2 F' D L' D'";
    const WCA3: &str = "D R2 F2 U R2 U B2 L2 U' F2 D' L B F2 R D2 B' D L' U2";

    fn tables() -> PruningTables333 {
        let mut t = PruningTables333::new();
        solver::gen_tables(&parse_steps("EO > RZP > DR > HTR > FR > FIN").unwrap(), &mut t);
        t
    }

    /// (best total, linearized solution) for the first solution.
    fn solve_one(scr: &str, steps: &str, t: &PruningTables333) -> Option<(usize, String)> {
        let alg = Algorithm::from_str(scr).unwrap();
        let cube: Cube333 = alg.into();
        let built = solver::build_steps(parse_steps(steps).unwrap(), t).unwrap();
        let cancel = CancelToken::default();
        let sol = cubelib::solver::solve_steps(cube, &built, &cancel).next()?;
        let a: Algorithm = sol.clone().into();
        let last_fin =
            matches!(sol.get_steps().last().map(|s| StepKind::from(s.variant)), Some(StepKind::FIN));
        let a = if last_fin { a.to_uninverted() } else { a };
        let a = a.canonicalize();
        Some((a.len(), a.to_string()))
    }

    /// Does (scramble ++ solution) bring a solved cube back to solved?
    fn solves(scr: &str, sol: &str) -> bool {
        let mut cube = Cube333::default();
        cube.apply_alg(&Algorithm::from_str(scr).unwrap());
        cube.apply_alg(&Algorithm::from_str(sol).unwrap());
        cube == Cube333::default()
    }

    // ---- correctness: every solution must actually solve the cube ----
    #[test]
    fn solutions_actually_solve() {
        let t = tables();
        for scr in [TRIVIAL, WCA1, WCA2, WCA3] {
            let (len, sol) = solve_one(scr, DEPLOYED, &t).expect("a solution");
            assert!(solves(scr, &sol), "does NOT solve: {scr} -> {sol}");
            // linearized length must equal the reported total
            assert_eq!(len, Algorithm::from_str(&sol).unwrap().len());
        }
    }

    // ---- golden baselines (deployed config, quality=1000; deterministic IDA*).
    // Update intentionally when the config/algorithm changes (review signal). ----
    #[test]
    fn golden_totals() {
        let t = tables();
        assert_eq!(solve_one(TRIVIAL, DEPLOYED, &t).unwrap(), (4, "R F' U' R'".to_string()));
        assert_eq!(solve_one(WCA1, DEPLOYED, &t).unwrap().0, 22);
        assert_eq!(solve_one(WCA2, DEPLOYED, &t).unwrap().0, 21);
        assert_eq!(solve_one(WCA3, DEPLOYED, &t).unwrap().0, 21);
    }

    // ---- higher quality finds shorter (same engine; quality = search breadth).
    // q=20000 (~2-3s) to keep the test fast; q=100000 reaches mallard's 20 in ~30s. ----
    #[test]
    fn quality_converges_shorter() {
        let t = tables();
        let hi = "EO[niss=always;quality=20000] > RZP[niss=never] > \
            DR[niss=before;quality=20000] > HTR[niss=before;quality=20000] > \
            FR[niss=before;quality=20000] > FIN[niss=never;quality=20000]";
        let (lo_total, _) = solve_one(WCA1, DEPLOYED, &t).unwrap();
        let (hi_total, hi_sol) = solve_one(WCA1, hi, &t).unwrap();
        assert!(hi_total < lo_total, "higher quality must improve ({hi_total} !< {lo_total})");
        assert!(solves(WCA1, &hi_sol));
    }

    // ---- steps-string parser ----
    #[test]
    fn parse_steps_basic() {
        let c = parse_steps("EO[niss=always;max=5;min=1] > DR > FIN[niss=never;quality=1000]").unwrap();
        assert_eq!(c.len(), 3);
        assert_eq!(c[0].kind, StepKind::EO);
        assert_eq!(c[0].niss, Some(NissSwitchType::Always));
        assert_eq!(c[0].max, Some(5));
        assert_eq!(c[0].min, Some(1));
        assert_eq!(c[2].niss, Some(NissSwitchType::Never));
        assert_eq!(c[2].quality, 1000);
        // invalid niss rejected
        assert!(parse_steps("EO[niss=bogus]").is_err());
        // bare axis token -> substep
        let d = parse_steps("DR[drud;drfb]").unwrap();
        assert_eq!(d[0].substeps.as_ref().unwrap().len(), 2);
    }
}

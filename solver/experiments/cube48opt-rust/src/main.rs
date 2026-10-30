use cube48opt_research::{
    coord::CoordTables,
    cube::{Cube, MOVE_NAMES},
    h10_table::{H10Table, Validation},
    search::{PruningOracle, SearchOptions},
    table::{PruningTable, Variant},
    H48Solver, H48Table, H48Variant, OptSolver,
};
mod native_parallel;
mod table_init;
use std::{
    env, fs,
    io::{self, BufRead, Write},
    path::Path,
    time::Instant,
};

fn run() -> Result<(), String> {
    let args: Vec<String> = env::args().collect();
    if args.get(1).is_some_and(|arg| arg == "--server-info") {
        println!("{{\"engine\":\"rust-native\",\"variant\":\"opt8\",\"protocol\":1,\"maxThreads\":4,\"optimized\":{}}}",
            cfg!(all(feature = "opt8-native-search", feature = "opt8-native-quarter", feature = "opt9-native-fixed-contexts")));
        return Ok(());
    }
    if args.get(1).is_some_and(|arg| arg == "init") {
        return table_init::run(&args[2..]);
    }
    if args.len() == 1 || args.get(1).is_some_and(|arg| arg == "--help" || arg == "-h") {
        println!("{}\n\nSolve: CUBEOPT_VARIANT=6 cube48opt-research solve SMALL_TABLES PDB [CONTEXTS MAX_DEPTH MAX_NODES]\nInput: id<TAB>scramble, one per line.\nOpt1–9 solve caches successful table validation on Unix. Set CUBEOPT_VERIFY_TABLE=1 to force a full recheck.\nNative x86 SIMD: CUBEOPT_SIMD=auto|scalar|avx2|avx512 (default auto prefers AVX2; unsupported explicit modes fail).", table_init::HELP);
        return Ok(());
    }
    if matches!(args.get(1).map(String::as_str), Some("generate-opt10" | "solve-opt10")) {
        // Default builds reject before reading a table or allocating a PDB.
        // The dedicated Opt10 build is launched through its budgeted guard.
        if !cfg!(feature = "opt10-runtime") {
            return Err("Opt10 large-table execution is disabled in this build; code and bounded validation only".into());
        }
        return eo_command::<10>(&args);
    }
    if matches!(args.get(1).map(String::as_str), Some("generate-opt11" | "solve-opt11")) {
        cube48opt_research::opt11::ensure_local_cli_allowed()?;
        return eo_command::<11>(&args);
    }
    if args.len() < 3
        || !matches!(
            args[1].as_str(),
            "inspect" | "solve" | "solve-h10" | "query-h10" | "solve-h48" | "query-h48"
        )
    {
        return Err("Usage: cube48opt-research inspect SMALL_TABLES | solve SMALL_TABLES PDB [CONTEXTS MAX_DEPTH MAX_NODES] | solve-h10 H10 [CONTEXTS MAX_DEPTH MAX_NODES] | query-h10 H10 | solve-h48 H TABLE [CONTEXTS MAX_DEPTH MAX_NODES] | query-h48 H TABLE; stdin: id<TAB>scramble; H11 is code-only and disabled in this CLI".into());
    }
    if let Some(request) = h48_request(&args)? {
        // h48_request rejects h11 before any file metadata/open/mmap call.
        let parallelism = if request.query { None } else { Some(Parallelism::from_env(request.options)?) };
        let oracle = if request.legacy_h10 {
            H48Solver::new(H10Table::open(Path::new(request.path), Validation::Full)?)
        } else {
            H48Solver::new(H48Table::open(
                Path::new(request.path),
                request.variant,
                Validation::Full,
            )?)
        };
        if request.query {
            for line in io::stdin().lock().lines() {
                let line = line.map_err(|e| e.to_string())?;
                let (id, scramble) = input(&line)?;
                let cube = Cube::from_scramble(scramble)?;
                let (index, corner_bound, bound) = oracle.query(&cube);
                let (inverse_index, inverse_corner_bound, inverse_bound) =
                    oracle.query(&cube.inverse());
                println!("{{\"id\":\"{id}\",\"index\":{index},\"corner_bound\":{corner_bound},\"bound\":{bound},\"inverse_index\":{inverse_index},\"inverse_corner_bound\":{inverse_corner_bound},\"inverse_bound\":{inverse_bound}}}");
            }
            return Ok(());
        }
        return run_solver(&oracle, request.options, parallelism.unwrap());
    }
    let variant_text = env::var("CUBEOPT_VARIANT").unwrap_or("1".into());
    if variant_text.len() != 1 {
        return Err("CUBEOPT_VARIANT must be one digit from 1 to 9".into());
    }
    let variant = Variant::new(
        variant_text
            .parse()
            .map_err(|_| "CUBEOPT_VARIANT must be an integer from 1 to 9")?,
    )?;
    let search = if args[1] == "solve" {
        args.get(3).ok_or("missing variant table path")?;
        let options = options(&args[4..])?;
        Some((options, Parallelism::from_env(options)?))
    } else { None };
    if server_protocol()? && (args[1] != "solve" || variant.number() != 8
        || search.is_none_or(|(opts, parallel)| parallel.batch_threads != 1
            || parallel.search_threads > 4 || opts.max_nodes != 0 || opts.max_depth != 20 || opts.contexts != 8)) {
        return Err("tsv-v1 requires Opt8 solve, 8 contexts, depth 20, unlimited nodes, one batch worker and at most four search threads".into());
    }
    #[cfg(target_arch = "x86_64")]
    if search.is_some() {
        eprintln!("Native SIMD: {}", cube48opt_research::x86_simd::initialize()?.name());
    }
    let coordinates = CoordTables::from_variant_bytes(
        &fs::read(&args[2]).map_err(|e| e.to_string())?,
        variant.number(),
    )?;
    if args[1] == "inspect" {
        for line in io::stdin().lock().lines() {
            let line = line.map_err(|e| e.to_string())?;
            let (id, scramble) = input(&line)?;
            let cube = Cube::from_scramble(scramble)?;
            let conjugates: Vec<_> = (0..48)
                .map(|s| coordinates.conjugate(&cube, s).to_bytes())
                .collect();
            println!("{{\"id\":\"{id}\",\"cube\":{:?},\"fast\":{:?},\"coordinate\":{},\"inverse_coordinate\":{},\"conjugates\":{:?}}}",
                cube.to_bytes(), cube.to_fast_bytes(), coordinates.index64(&cube), coordinates.index64(&cube.inverse()), conjugates);
        }
        return Ok(());
    }
    let pdb_path = args.get(3).ok_or("missing variant table path")?;
    let force_validation = match env::var("CUBEOPT_VERIFY_TABLE") {
        Err(env::VarError::NotPresent) => false,
        Ok(value) if value == "0" => false,
        Ok(value) if value == "1" => true,
        _ => return Err("CUBEOPT_VERIFY_TABLE must be 0 or 1".into()),
    };
    let oracle = OptSolver::new(
        coordinates,
        PruningTable::load_variant_cached(Path::new(pdb_path), variant, force_validation)?,
    )?;
    let (options, parallelism) = search.unwrap();
    #[cfg(all(feature = "opt8-native-specialized", not(target_family = "wasm")))]
    if let Some(specialized) = oracle.experimental_native_opt8_oracle() {
        return run_solver(&specialized, options, parallelism);
    }
    // Preserve the default native binary and every other table variant.
    // Only an explicitly built candidate opts into the Opt9 specialized
    // oracle and the selected experimental pruning/scheduling policy.
    #[cfg(all(
        any(feature = "opt9-native-bpmx", feature = "opt9-native-dynamic", feature = "opt9-native-prefetch", feature = "opt9-native-quarter", feature = "opt9-native-root-bound"),
        not(target_family = "wasm"),
    ))]
    if let Some(specialized) = oracle.experimental_native_opt9_oracle() {
        return run_solver(&specialized, options, parallelism);
    }
    run_solver(&oracle, options, parallelism)
}

fn eo_command<const EO: u8>(args: &[String]) -> Result<(), String> {
    use cube48opt_research::{opt10::{Opt10Coordinates, Opt10Solver},
        opt10_generate::{generate, GenerationConfig}, opt10_table::{AtomicOpt10Table, DEFAULT_BASE}};
    // The dedicated Opt10 guard has its own budget and validates the completed
    // small-table generator proof. Do not silently use an Opt1/H10 budget.
    let backend = format!("opt{EO}");
    if env::var("CUBEOPT_BACKEND").as_deref() != Ok(backend.as_str()) {
        return Err(format!("Opt{EO} requires its own guarded backend; other variants' budgets do not apply"));
    }
    let generation = args[1] == format!("generate-opt{EO}");
    if generation && !(args.len() == 4 || args.len() == 5) || !generation && !(4..=7).contains(&args.len()) {
        return Err(format!("generate-opt{EO} OPT9_SMALL NEW_TABLE [THREADS] | solve-opt{EO} OPT9_SMALL TABLE [CONTEXTS MAX_DEPTH MAX_NODES]"));
    }
    let threads = if generation {
        let threads: usize = args.get(4).map(|s| s.parse()).transpose().map_err(|_| "invalid generation threads")?.unwrap_or(16);
        let available = std::thread::available_parallelism().map_err(|e| e.to_string())?.get();
        if threads == 0 || threads > 16 || threads > available { return Err(format!("generation threads must be 1..{}", available.min(16))); }
        threads
    } else { 1 };
    let search_options = if !generation { Some(options(&args[4..])?) } else { None };
    let parallelism = search_options.map(Parallelism::from_env).transpose()?;
    let path = Path::new(&args[3]);
    if generation && (path.exists() || std::path::PathBuf::from(format!("{}.partial", path.display())).exists()) {
        return Err(format!("Opt{EO} output or partial already exists; refusing to overwrite"));
    }
    if fs::metadata(&args[2]).map_err(|e| e.to_string())?.len() != 818_008 {
        return Err(format!("Opt{EO} expects an 818008-byte Opt9 small snapshot"));
    }
    let snapshot = fs::read(&args[2]).map_err(|e| e.to_string())?;
    if EO == 11 {
        if !generation {
            return run_solver(&cube48opt_research::opt11::Opt11Solver::open(&snapshot, path)?, search_options.unwrap(), parallelism.unwrap());
        }
        let header = cube48opt_research::opt11_generate::generate_to(&snapshot, path, threads)?;
        eprintln!("Opt11 complete: depth={}, payload={} bytes", header.completed_depth, cube48opt_research::opt11::TABLE_BYTES);
        return Ok(());
    }
    if !generation { return run_solver(&Opt10Solver::open(&snapshot, path)?, search_options.unwrap(), parallelism.unwrap()); }
    let coordinates = Opt10Coordinates::from_opt9_snapshot(&snapshot)?;
    let table = AtomicOpt10Table::new(DEFAULT_BASE)?;
    let result = generate(&coordinates, &table, GenerationConfig { threads, ..GenerationConfig::default() }, |progress| {
        eprintln!("Opt10 {:?}: depth={} short={} seeds={}/{} expanded={} elapsed={:.1}s",
            progress.stage, progress.depth, progress.short_states, progress.seeds_done,
            progress.seeds_total, progress.expanded, progress.seconds);
    })?;
    let header = table.write_complete(path, &snapshot, result.completed_depth)?;
    eprintln!("Opt10 complete: depth={}, expanded={}, payload={} bytes", header.completed_depth, result.expanded, table.byte_len());
    Ok(())
}

struct H48Request<'a> {
    variant: H48Variant,
    path: &'a str,
    query: bool,
    legacy_h10: bool,
    options: SearchOptions,
}

/// Argument parsing and local H11 policy have no filesystem side effects.
fn h48_request(args: &[String]) -> Result<Option<H48Request<'_>>, String> {
    let Some(command) = args.get(1).map(String::as_str) else {
        return Ok(None);
    };
    let legacy_h10 = matches!(command, "solve-h10" | "query-h10");
    if !legacy_h10 && !matches!(command, "solve-h48" | "query-h48") {
        return Ok(None);
    }
    let (variant, path_at) = if legacy_h10 {
        (H48Variant::H10, 2)
    } else {
        let value = args.get(2).ok_or("missing H48 h (0..11)")?;
        let h: u8 = value
            .parse()
            .map_err(|_| "H48 h must be an integer from 0 to 11")?;
        if value != &h.to_string() {
            return Err("H48 h must be a canonical integer from 0 to 11".into());
        }
        (H48Variant::new(h)?, 3)
    };
    variant.ensure_local_cli_allowed()?;
    let path = args.get(path_at).ok_or("missing H48 table path")?;
    let query = matches!(command, "query-h10" | "query-h48");
    if query && args.len() != path_at + 1 {
        return Err("query accepts only the H48 table path".into());
    }
    let options = options(&args[path_at + 1..])?;
    Ok(Some(H48Request {
        variant,
        path,
        query,
        legacy_h10,
        options,
    }))
}

fn options(args: &[String]) -> Result<SearchOptions, String> {
    if args.len() > 3 {
        return Err("too many search options".into());
    }
    let contexts = args
        .first()
        .map(|s| s.parse())
        .transpose()
        .map_err(|_| "invalid contexts")?
        .unwrap_or(8);
    let max_depth = args
        .get(1)
        .map(|s| s.parse())
        .transpose()
        .map_err(|_| "invalid max depth")?
        .unwrap_or(20);
    let max_nodes = args
        .get(2)
        .map(|s| s.parse())
        .transpose()
        .map_err(|_| "invalid node budget")?
        .unwrap_or(50_000_000);
    if contexts != 1 && contexts != 8 {
        return Err("contexts must be 1 or 8".into());
    }
    if max_depth > 20 {
        return Err("max depth must be at most 20".into());
    }
    Ok(SearchOptions {
        contexts,
        max_depth,
        max_nodes,
    })
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
struct Parallelism { batch_threads: usize, search_threads: usize }

impl Parallelism {
    fn parse(batch: Option<&str>, search: Option<&str>, available: usize, options: SearchOptions) -> Result<Self, String> {
        fn count(value: Option<&str>, name: &str, maximum: usize) -> Result<usize, String> {
            let text = value.unwrap_or("1");
            let n = text.parse::<usize>().map_err(|_| format!("invalid {name}"))?;
            if n == 0 || n > maximum || text != n.to_string() {
                return Err(format!("{name} must be a canonical integer from 1 to {maximum}"));
            }
            Ok(n)
        }
        let batch_threads = count(batch, "CUBEOPT_SOLVE_THREADS", available.min(256))?;
        let search_threads = count(search, "CUBEOPT_SEARCH_THREADS", available.min(native_parallel::MAX_SEARCH_THREADS))?;
        if batch_threads > 1 && search_threads > 1 {
            return Err("choose batch parallelism or single-cube parallelism; CUBEOPT_SOLVE_THREADS and CUBEOPT_SEARCH_THREADS cannot both exceed 1".into());
        }
        native_parallel::validate(options, search_threads)?;
        Ok(Self { batch_threads, search_threads })
    }

    fn from_env(options: SearchOptions) -> Result<Self, String> {
        Self::parse(env::var("CUBEOPT_SOLVE_THREADS").ok().as_deref(),
            env::var("CUBEOPT_SEARCH_THREADS").ok().as_deref(),
            std::thread::available_parallelism().map_err(|e| e.to_string())?.get(), options)
    }
}

fn run_solver<O: PruningOracle + Sync>(oracle: &O, options: SearchOptions, parallelism: Parallelism) -> Result<(), String> {
    let contexts = options.contexts;
    let Parallelism { batch_threads, search_threads } = parallelism;
    let server = server_protocol()?;
    if server {
        println!("READY\t{search_threads}");
        io::stdout().flush().map_err(|e| e.to_string())?;
    }
    cube48opt_research::batch::run(io::BufReader::new(io::stdin()), io::stdout(), batch_threads, |line| {
        let (id, scramble) = input(&line)?;
        if server && (scramble.split_whitespace().count() > 50 || scramble.trim().is_empty()) {
            return Ok(format!("{id}\tERROR\tinvalid scramble"));
        }
        if server && scramble.split_whitespace().any(|token| !MOVE_NAMES.contains(&token)) {
            return Ok(format!("{id}\tERROR\tinvalid scramble"));
        }
        let cube = Cube::from_scramble(scramble)?;
        let started = Instant::now();
        let result = native_parallel::solve(cube, oracle, options, search_threads)?;
        let seconds = started.elapsed().as_secs_f64();
        let solution = result.solution.as_ref().map(|moves| {
            moves
                .iter()
                .map(|&m| MOVE_NAMES[m as usize])
                .collect::<Vec<_>>()
                .join(" ")
        });
        if let Some(moves) = &result.solution {
            if !moves.iter().fold(cube, |c, &m| c.moved(m)).is_solved() {
                return Err("internal solution replay failed".into());
            }
        }
        if server {
            let moves = result.solution.as_ref().ok_or("optimal search returned no solution")?;
            return Ok(format!("{id}\t{}\t{}", moves.len(), solution.as_deref().unwrap_or("")));
        }
        let solution_json = solution
            .as_ref()
            .map(|s| format!("\"{s}\""))
            .unwrap_or("null".into());
        let length = result
            .solution
            .as_ref()
            .map(|s| s.len().to_string())
            .unwrap_or("null".into());
        let completed = result
            .completed_depth
            .map(|v| v.to_string())
            .unwrap_or("null".into());
        let s = result.stats;
        #[cfg(all(feature = "opt10-native-profile", not(target_family = "wasm")))]
        if oracle.profile_search() && !s.profile.matches_totals(&s) {
            return Err("diagnostic profile does not conserve search totals".into());
        }
        #[cfg(all(feature = "opt9-native-quarter", not(target_family = "wasm")))]
        let quarter_stats = format!(",\"quarter_siblings_removed\":{}", s.quarter_siblings_removed);
        #[cfg(not(all(feature = "opt9-native-quarter", not(target_family = "wasm"))))]
        let quarter_stats = "";
        #[cfg(all(feature = "opt9-native-quarter-cache", not(target_family = "wasm")))]
        let quarter_cache_stats = format!(",\"quarter_cache_reuses\":{}", s.quarter_cache_reuses);
        #[cfg(not(all(feature = "opt9-native-quarter-cache", not(target_family = "wasm"))))]
        let quarter_cache_stats = "";
        #[cfg(all(feature = "opt9-native-axis", not(target_family = "wasm")))]
        let axis_stats = format!(",\"axis_siblings_removed\":{},\"axis_deferred_marks\":{},\"axis_deferred_siblings_removed\":{}",
            s.axis_siblings_removed, s.axis_deferred_marks, s.axis_deferred_siblings_removed);
        #[cfg(not(all(feature = "opt9-native-axis", not(target_family = "wasm"))))]
        let axis_stats = "";
        #[cfg(all(feature = "opt9-native-ranked", not(target_family = "wasm")))]
        let ranked_stats = format!(",\"exhausted_depth_nodes\":{},\"solution_depth_nodes\":{}",
            s.exhausted_depth_nodes, s.solution_depth_nodes);
        #[cfg(not(all(feature = "opt9-native-ranked", not(target_family = "wasm"))))]
        let ranked_stats = "";
        #[cfg(all(feature = "opt10-native-dual", not(target_family = "wasm")))]
        let dual_stats = format!(",\"dual_attempts\":{},\"dual_raised\":{},\"dual_parent_cuts\":{}",
            s.dual_attempts, s.dual_raised, s.dual_parent_cuts);
        #[cfg(not(all(feature = "opt10-native-dual", not(target_family = "wasm"))))]
        let dual_stats = "";
        #[cfg(all(any(feature = "opt10-native-coset", feature = "opt11-native-coset"), not(target_family = "wasm")))]
        let coset_stats = format!(",\"coset_parent_proofs\":{},\"coset_half_prunes\":{}", s.coset_parent_proofs, s.coset_half_prunes);
        #[cfg(not(all(any(feature = "opt10-native-coset", feature = "opt11-native-coset"), not(target_family = "wasm"))))]
        let coset_stats = "";
        #[cfg(all(feature = "opt10-native-coset-chain", not(target_family = "wasm")))]
        let coset_chain_stats = format!(",\"coset_chain_proofs\":{},\"coset_chain_attempts\":{},\"coset_chain_edges\":{},\"coset_chain_ancestor_cuts\":{},\"coset_chain_half_prunes\":{}",
            s.coset_chain_proofs, s.coset_chain_attempts, s.coset_chain_edges, s.coset_chain_ancestor_cuts, s.coset_chain_half_prunes);
        #[cfg(not(all(feature = "opt10-native-coset-chain", not(target_family = "wasm"))))]
        let coset_chain_stats = "";
        #[cfg(all(feature = "opt10-native-profile", not(target_family = "wasm")))]
        let profile_stats = format!(",\"profile\":{}", s.profile.json());
        #[cfg(not(all(feature = "opt10-native-profile", not(target_family = "wasm"))))]
        let profile_stats = "";
        #[cfg(all(feature = "opt10-native-lookahead", not(target_family = "wasm")))]
        let lookahead_stats = format!(",\"lookahead_attempts\":{},\"lookahead_probes\":{},\"lookahead_raises\":{},\"lookahead_rejects\":{},\"lookahead_tightened_at_budget\":{},\"lookahead_half_prunes\":{},\"lookahead_by_remaining\":{{\"remaining\":[10,11,12],\"attempts\":{:?},\"raises\":{:?},\"rejects\":{:?}}}",
            s.lookahead_attempts, s.lookahead_probes, s.lookahead_raises, s.lookahead_rejects,
            s.lookahead_tightened_at_budget, s.lookahead_half_prunes,
            s.lookahead_attempts_by_remaining, s.lookahead_raises_by_remaining, s.lookahead_rejects_by_remaining);
        #[cfg(not(all(feature = "opt10-native-lookahead", not(target_family = "wasm"))))]
        let lookahead_stats = "";
        #[cfg(all(feature = "opt10-native-projection", not(target_family = "wasm")))]
        let projection_stats = format!(",\"projection_attempts\":{},\"projection_probes\":{},\"projection_raises\":{},\"projection_rejects\":{},\"projection_by_remaining\":{{\"remaining\":[11,12],\"attempts\":{:?},\"raises\":{:?},\"rejects\":{:?}}}",
            s.projection_attempts, s.projection_probes, s.projection_raises, s.projection_rejects,
            s.projection_attempts_by_remaining, s.projection_raises_by_remaining, s.projection_rejects_by_remaining);
        #[cfg(not(all(feature = "opt10-native-projection", not(target_family = "wasm"))))]
        let projection_stats = "";
        Ok(format!("{{\"id\":\"{id}\",\"solution\":{solution_json},\"length\":{length},\"seconds\":{seconds:.9},\"completed_depth\":{completed},\"cancelled\":{},\"contexts\":{contexts},\"threads\":{search_threads},\"batch_threads\":{batch_threads},\"nodes\":{},\"probes\":{},\"inverse_probes\":{},\"cache_reuses\":{},\"splits\":{},\"face_prunes\":{},\"face_siblings_removed\":{}{quarter_stats}{quarter_cache_stats}{axis_stats}{ranked_stats}{dual_stats}{coset_stats}{coset_chain_stats}{profile_stats}{lookahead_stats}{projection_stats}}}",
            result.cancelled, s.nodes, s.probes, s.inverse_probes, s.cache_reuses, s.splits, s.face_prunes, s.face_siblings_removed))
    })
}

fn server_protocol() -> Result<bool, String> {
    match env::var("CUBEOPT_PROTOCOL") {
        Err(env::VarError::NotPresent) => Ok(false),
        Ok(value) if value == "json" => Ok(false),
        Ok(value) if value == "tsv-v1" => Ok(true),
        _ => Err("CUBEOPT_PROTOCOL must be json or tsv-v1".into()),
    }
}

fn input(line: &str) -> Result<(&str, &str), String> {
    let (id, scramble) = line.split_once('\t').ok_or("expected id<TAB>scramble")?;
    if id.is_empty()
        || !id
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'_')
    {
        return Err("id must contain only ASCII letters, digits, '_' or '-'".into());
    }
    Ok((id, scramble))
}

fn main() {
    if let Err(error) = run() {
        eprintln!("{error}");
        std::process::exit(1);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn arguments(values: &[&str]) -> Vec<String> {
        values.iter().map(|s| s.to_string()).collect()
    }

    #[test]
    fn thread_modes_are_explicit_and_reject_multiplication_and_unsupported_limits() {
        let options = SearchOptions { max_nodes: 0, ..SearchOptions::default() };
        assert_eq!(Parallelism::parse(None, None, 16, options).unwrap(), Parallelism { batch_threads: 1, search_threads: 1 });
        assert_eq!(Parallelism::parse(Some("16"), None, 16, options).unwrap().batch_threads, 16);
        assert_eq!(Parallelism::parse(None, Some("16"), 16, options).unwrap().search_threads, 16);
        assert_eq!(Parallelism::parse(None, Some("18"), 18, options).unwrap().search_threads, 18);
        assert!(Parallelism::parse(None, Some("18"), 16, options).is_err());
        assert!(Parallelism::parse(None, Some("19"), 24, options).is_err());
        assert!(Parallelism::parse(Some("2"), Some("2"), 16, options).is_err());
        for text in ["0", "17", "01", "+1", "1.0"] {
            assert!(Parallelism::parse(None, Some(text), 16, options).is_err());
        }
        assert!(Parallelism::parse(None, Some("4"), 2, options).is_err());
        assert!(Parallelism::parse(None, Some("4"), 16, SearchOptions { max_nodes: 100, ..options }).is_err());
        assert!(Parallelism::parse(Some("4"), None, 16, SearchOptions { max_nodes: 100, ..options }).is_ok());
    }

    #[test]
    fn h11_commands_reject_before_any_table_path_is_used() {
        for command in ["solve-h48", "query-h48"] {
            for suffix in [vec![], vec!["/path/that/must/not/be/opened"]] {
                let mut args = arguments(&["binary", command, "11"]);
                args.extend(suffix.into_iter().map(String::from));
                let error = h48_request(&args).err().unwrap();
                assert!(error.contains("H11 is code-only"));
            }
        }
    }

    #[test]
    fn legacy_and_generic_h10_options_match() {
        let old = arguments(&["binary", "solve-h10", "table", "1", "18", "1234"]);
        let new = arguments(&["binary", "solve-h48", "10", "table", "1", "18", "1234"]);
        let old = h48_request(&old).unwrap().unwrap();
        let new = h48_request(&new).unwrap().unwrap();
        assert_eq!(old.variant, new.variant);
        assert_eq!(old.path, new.path);
        assert_eq!(old.options.contexts, new.options.contexts);
        assert_eq!(old.options.max_depth, new.options.max_depth);
        assert_eq!(old.options.max_nodes, new.options.max_nodes);
        assert!(old.legacy_h10 && !new.legacy_h10);
        for h in ["0", "7", "10"] {
            let args = arguments(&["binary", "query-h48", h, "table"]);
            assert!(h48_request(&args).unwrap().unwrap().query);
        }
        for h in ["12", "-1", "01", "+1", "255"] {
            let args = arguments(&["binary", "query-h48", h, "table"]);
            assert!(h48_request(&args).is_err());
        }
        for extra in [
            vec!["2"],
            vec!["8", "21"],
            vec!["8", "20", "18446744073709551616"],
        ] {
            let mut args = arguments(&["binary", "solve-h48", "0", "table"]);
            args.extend(extra.into_iter().map(String::from));
            assert!(h48_request(&args).is_err());
        }
    }
}

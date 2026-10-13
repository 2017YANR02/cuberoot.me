use cube48opt_research::{
    coord::CoordTables,
    cube::{Cube, MOVE_NAMES},
    h10_table::{H10Table, Validation},
    search::{solve, PruningOracle, SearchOptions},
    table::{PruningTable, Variant},
    H48Solver, H48Table, H48Variant, OptSolver,
};
use std::{
    env, fs,
    io::{self, BufRead},
    path::Path,
    time::Instant,
};

fn run() -> Result<(), String> {
    let args: Vec<String> = env::args().collect();
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
        return run_solver(&oracle, request.options);
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
    let oracle = OptSolver::new(
        coordinates,
        PruningTable::load_variant(Path::new(pdb_path), variant)?,
    )?;
    run_solver(&oracle, options(&args[4..])?)
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

fn run_solver<O: PruningOracle>(oracle: &O, options: SearchOptions) -> Result<(), String> {
    let contexts = options.contexts;
    for line in io::stdin().lock().lines() {
        let line = line.map_err(|e| e.to_string())?;
        let (id, scramble) = input(&line)?;
        let cube = Cube::from_scramble(scramble)?;
        let started = Instant::now();
        let result = solve(cube, oracle, options)?;
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
        println!("{{\"id\":\"{id}\",\"solution\":{solution_json},\"length\":{length},\"seconds\":{seconds:.9},\"completed_depth\":{completed},\"cancelled\":{},\"contexts\":{contexts},\"nodes\":{},\"probes\":{},\"inverse_probes\":{},\"cache_reuses\":{},\"splits\":{},\"face_prunes\":{},\"face_siblings_removed\":{}}}",
            result.cancelled, s.nodes, s.probes, s.inverse_probes, s.cache_reuses, s.splits, s.face_prunes, s.face_siblings_removed);
    }
    Ok(())
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

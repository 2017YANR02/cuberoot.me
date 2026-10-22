//! Opt-in reference algorithms for the mod-M-plus-inversion investigation.
//! This binary does no work unless a command is explicitly selected.

use cube48opt_research::{
    coord::CoordTables,
    corner_coset::{self, BuildMode, CornerBfs, CornerPdb, CornerTransitions},
    corner_distance_search,
    corner_joint::{JointPdb, JointTransitions, PairPdb, PairTransitions, PAIR_COUNT, PAIR_EDGES},
    corner_oracle::{self, CornerOracle, DistanceGatedOracle, DoubleCornerOracle, FullCornerDistanceOracle, StrengthenedOracle},
    corner_oracle::eo::EoPdb,
    corner_symmetry::{self, CornerSymmetries, DoubleClasses, FullCornerBfs, FullCornerPdb},
    corner_symmetry::dense::DenseCornerPdb,
    cube::{Cube, MOVE_NAMES},
    search::{self, PruningOracle, SearchOptions},
    table::{PruningTable, Variant},
    OptSolver,
};
use std::{
    collections::HashMap,
    env, fs,
    io::{self, BufRead, Write},
    path::Path,
    time::Instant,
};

#[path = "corner-research/layouts.rs"]
mod layouts;
#[cfg(all(feature = "opt8-native-specialized", not(target_family = "wasm")))]
#[path = "corner-research/joint.rs"]
mod joint;

const HELP: &str = "corner-research (opt-in, unmeasured reference implementation)

  inspect [SCRAMBLE]
  verify-small
  verify-eo
  verify-coordinate
  verify-opt8-projection SMALL_TABLE
  joint-check SMALL_TABLE
  joint-build SMALL_TABLE OUTPUT CHECKPOINT
  joint-probe SMALL_TABLE OPT8_TABLE JOINT_TABLE MAX_NODES
  joint-pair-check SMALL_TABLE
  joint-pair-build SMALL_TABLE OUTPUT CHECKPOINT
  joint-pair-probe SMALL_TABLE OPT8_TABLE JOINT_PAIR_TABLE MAX_NODES
  joint-pair-solve SMALL_TABLE OPT8_TABLE JOINT_PAIR_TABLE MAX_NODES
  build-u OUTPUT CHECKPOINT exact|CAP [CHUNK=16384]
  verify-u TABLE
  build-double OUTPUT
  verify-double TABLE
  build96 OUTPUT CHECKPOINT [CHUNK=1024]
  verify96 TABLE
  verify-dense FULL96_TABLE
  query-u U_TABLE
  query-eo
  query-u-eo U_TABLE
  query-v U_TABLE DOUBLE_TABLE
  query96 FULL96_TABLE
  query96-dense FULL96_TABLE
  solve-corners FULL96_TABLE
  solve-u U_TABLE MAX_DEPTH MAX_NODES [CONTEXTS=1]
  solve-u-eo U_TABLE MAX_DEPTH MAX_NODES [CONTEXTS=1]
  solve-u-distance U_TABLE FULL96_TABLE MAX_DEPTH MAX_NODES [CONTEXTS=1]
  solve-u-distance-sparse U_TABLE FULL96_TABLE MAX_DEPTH MAX_NODES [CONTEXTS=1]
  solve-v U_TABLE DOUBLE_TABLE MAX_DEPTH MAX_NODES [CONTEXTS=1]
  solve-v-eo U_TABLE DOUBLE_TABLE MAX_DEPTH MAX_NODES [CONTEXTS=1]
  solve-distance FULL96_TABLE MAX_DEPTH MAX_NODES [CACHE_ENTRIES=100000]
  solve-distance-dense FULL96_TABLE MAX_DEPTH MAX_NODES [CACHE_ENTRIES=100000]
  solve-opt U_TABLE 8|9 SMALL_TABLE OPT_TABLE MAX_DEPTH MAX_NODES [CONTEXTS=1]
  solve-opt-distance U_TABLE FULL96_TABLE 8|9 SMALL_TABLE OPT_TABLE MAX_DEPTH MAX_NODES [CONTEXTS=1]
  solve-opt-distance-eo U_TABLE FULL96_TABLE 8|9 SMALL_TABLE OPT_TABLE MAX_DEPTH MAX_NODES [CONTEXTS=1]
  verify-search U_TABLE DEPTH_0_TO_3 [FULL96_TABLE]
  compare-opt8 U_TABLE FULL96_TABLE SMALL_TABLE OPT_TABLE MAX_NODES
  compare-opt8-scheduled U_TABLE FULL96_TABLE SMALL_TABLE OPT_TABLE MAX_NODES
  profile-opt8 U_TABLE FULL96_TABLE SMALL_TABLE OPT_TABLE MAX_NODES
  compare-layouts FULL96_TABLE

Query/solve input: id<TAB>scramble, one per line. Empty scramble means solved.
All commands except inspect/help require the repository guard.mts. See
corner96-research.md and corner96-optimization.md for build, guarded invocation,
resume, and validation. Dense commands verify the existing sparse file format
directly through the factorized dense index; they do not create a new format.
No command generates or replaces an Opt8/Opt9/Opt10 main table.
";

fn number(text: &str, minimum: u64, maximum: u64, name: &str) -> Result<u64, String> {
    let value = text.parse::<u64>().map_err(|_| format!("invalid {name}: {text}"))?;
    if text != value.to_string() || !(minimum..=maximum).contains(&value) {
        return Err(format!("{name} must be a canonical integer in {minimum}..={maximum}"));
    }
    Ok(value)
}

fn arity(args: &[String], minimum: usize, maximum: usize) -> Result<(), String> {
    if !(minimum..=maximum).contains(&args.len()) {
        return Err(format!("wrong number of arguments for {}; see --help", args[0]));
    }
    Ok(())
}

fn json(text: &str) -> String {
    let mut result = String::with_capacity(text.len() + 2);
    result.push('"');
    for character in text.chars() {
        match character {
            '"' => result.push_str("\\\""),
            '\\' => result.push_str("\\\\"),
            '\n' => result.push_str("\\n"),
            '\r' => result.push_str("\\r"),
            '\t' => result.push_str("\\t"),
            c if c <= '\u{1f}' => result.push_str(&format!("\\u{:04x}", c as u32)),
            c => result.push(c),
        }
    }
    result.push('"');
    result
}

fn word(moves: &[u8]) -> String {
    moves.iter().map(|&m| MOVE_NAMES[m as usize]).collect::<Vec<_>>().join(" ")
}

fn input(mut consume: impl FnMut(&str, Cube) -> Result<(), String>) -> Result<(), String> {
    for line in io::stdin().lock().lines() {
        let line = line.map_err(|error| error.to_string())?;
        if line.trim().is_empty() { continue; }
        let (id, scramble) = line.split_once('\t')
            .ok_or_else(|| "input requires id<TAB>scramble".to_string())?;
        if id.is_empty() { return Err("input ID must not be empty".into()); }
        consume(id, Cube::from_scramble(scramble)?)?;
        io::stdout().flush().map_err(|error| error.to_string())?;
    }
    Ok(())
}

fn options(depth: &str, nodes: &str, contexts: Option<&String>) -> Result<SearchOptions, String> {
    let contexts = contexts.map_or(Ok(1), |text| number(text, 1, 8, "contexts"))? as usize;
    if contexts != 1 && contexts != 8 { return Err("contexts must be 1 or 8".into()); }
    Ok(SearchOptions {
        max_depth: number(depth, 0, 20, "max depth")? as u8,
        max_nodes: number(nodes, 1, u64::MAX, "node budget")?,
        contexts,
    })
}

fn replay(start: Cube, moves: &[u8], corners_only: bool) -> Result<(), String> {
    let result = moves.iter().try_fold(start, |state, &movement| {
        if movement >= 18 { Err("solution contains an invalid move".to_string()) }
        else { Ok(state.moved(movement)) }
    })?;
    if if corners_only { result.corners == Cube::SOLVED.corners } else { result.is_solved() } {
        Ok(())
    } else {
        Err("returned solution failed replay; no successful result emitted".into())
    }
}

fn solve_input(oracle: &impl PruningOracle, options: SearchOptions) -> Result<(), String> {
    input(|id, cube| {
        let result = search::solve(cube, oracle, options)?;
        let solution = if let Some(moves) = &result.solution {
            replay(cube, moves, false)?;
            json(&word(moves))
        } else { "null".into() };
        let exhausted = result.completed_depth.map_or("null".into(), |depth| depth.to_string());
        println!("{{\"id\":{},\"scope\":\"full-cube\",\"solution\":{},\"optimal_if_found\":true,\"completed_depth\":{},\"cancelled\":{},\"nodes\":{},\"probes\":{}}}",
            json(id), solution, exhausted, result.cancelled, result.stats.nodes, result.stats.probes);
        Ok(())
    })
}

fn load_opt(variant: &str, small: &Path, main: &Path) -> Result<OptSolver, String> {
    let variant = Variant::new(number(variant, 8, 9, "Opt variant")? as u8)?;
    let expected = cube48opt_research::coord::snapshot_bytes(variant.number())?;
    if fs::metadata(small).map_err(|error| error.to_string())?.len() != expected as u64 {
        return Err("Opt coordinate snapshot has the wrong length".into());
    }
    let bytes = fs::read(small).map_err(|error| error.to_string())?;
    let coordinates = CoordTables::from_variant_bytes(&bytes, variant.number())?;
    let pruning = PruningTable::load_variant_cached(main, variant, false)?;
    OptSolver::new(coordinates, pruning)
}

/// One resident main table and certified auxiliary tables for paired,
/// single-thread measurements. Each mode/case is accepted only once.
#[cfg(all(feature = "opt8-native-specialized", not(target_family = "wasm")))]
fn compare_opt8(original: &OptSolver, corners: &CornerPdb,
    full: &DenseCornerPdb, symmetries: &CornerSymmetries, max_nodes: u64,
    load_seconds: f64, scheduled: bool, diagnostic: bool) -> Result<(), String> {
    let setup = Instant::now();
    let base = original.experimental_native_opt8_oracle().ok_or("expected Opt8")?;
    let eo = EoPdb::new()?;
    let u = StrengthenedOracle::new(&base, corners)?;
    let u_eo = StrengthenedOracle::new_with_eo(&base, corners, &eo)?;
    let distance = FullCornerDistanceOracle::from_dense(full, symmetries);
    let distance_only = DistanceGatedOracle::new(&base, &distance);
    let combined = DistanceGatedOracle::new(&u_eo, &distance);
    let prepared = full.prepare_lookup(symmetries)?;
    let fast_distance = FullCornerDistanceOracle::from_prepared(&prepared, symmetries);
    let u_deferred = StrengthenedOracle::deferred(&base, corners, None)?;
    let u_eo_deferred = StrengthenedOracle::deferred(&base, corners, Some(&eo))?;
    let distance_late = DistanceGatedOracle::after_primary(&base, &fast_distance);
    #[cfg(all(feature = "opt10-native-profile", not(target_family = "wasm")))]
    let distance_profiled = DistanceGatedOracle::profiled_after_primary(&base, &fast_distance);
    let combined_late = DistanceGatedOracle::after_primary(&u_eo_deferred, &fast_distance);
    let options = SearchOptions { max_depth: 20, max_nodes, contexts: 8 };
    let modes: &[&str] = if diagnostic { &["distance-late"] }
        else if scheduled { &["u-deferred", "distance-late", "combined-late"] }
        else { &["baseline", "u", "distance", "combined"] };
    let mut counts = [0usize; 4];
    let mut seen = std::collections::HashSet::new();
    let load_seconds = load_seconds + setup.elapsed().as_secs_f64();
    let corner_bytes = corners.values().len();
    let distance_bytes = if scheduled { prepared.memory_bytes() } else { full.memory_bytes() };
    let combined_bytes = corner_bytes + distance_bytes + 2048;
    let auxiliary = if scheduled {
        format!("{{\"u-deferred\":{corner_bytes},\"distance-late\":{distance_bytes},\"combined-late\":{combined_bytes}}}")
    } else {
        format!("{{\"baseline\":0,\"u\":{corner_bytes},\"distance\":{distance_bytes},\"combined\":{combined_bytes}}}")
    };
    println!("{{\"kind\":\"comparison-ready\",\"pid\":{},\"threads\":1,\"contexts\":8,\"load_seconds\":{load_seconds:.9},\"main_table_bytes\":{},\"auxiliary_bytes\":{auxiliary}}}",
        std::process::id(), Variant::new(8)?.bytes());
    io::stdout().flush().map_err(|error| error.to_string())?;
    input(|id, cube| {
        let (mode, case) = id.split_once(':').ok_or("comparison ID requires mode:case")?;
        let index = modes.iter().position(|&name| name == mode).ok_or("unknown comparison mode")?;
        if counts[index] >= (if diagnostic { 20 } else { 100 }) || !seen.insert(id.to_string()) {
            return Err("comparison case limit or distinct single-pass IDs violated".into());
        }
        counts[index] += 1;
        let started = Instant::now();
        let result = match mode {
            "baseline" => search::solve(cube, &base, options),
            "u" => search::solve(cube, &u, options),
            "distance" => search::solve(cube, &distance_only, options),
            "combined" => search::solve(cube, &combined, options),
            "u-deferred" => search::solve(cube, &u_deferred, options),
            "distance-late" => {
                #[cfg(all(feature = "opt10-native-profile", not(target_family = "wasm")))]
                if diagnostic { search::solve(cube, &distance_profiled, options) }
                else { search::solve(cube, &distance_late, options) }
                #[cfg(not(all(feature = "opt10-native-profile", not(target_family = "wasm"))))]
                search::solve(cube, &distance_late, options)
            }
            "combined-late" => search::solve(cube, &combined_late, options),
            _ => unreachable!(),
        }?;
        let seconds = started.elapsed().as_secs_f64();
        let solution = result.solution.as_ref().ok_or("comparison node budget exhausted without a solution")?;
        if result.cancelled { return Err("comparison cancelled".into()); }
        replay(cube, solution, false)?;
        #[cfg(all(feature = "opt10-native-profile", not(target_family = "wasm")))]
        let diagnostic_json = if diagnostic {
            if !result.stats.profile.matches_totals(&result.stats) {
                return Err("corner profile does not conserve search totals".into());
            }
            format!(",\"profile\":{}", result.stats.profile.json())
        } else { String::new() };
        #[cfg(not(all(feature = "opt10-native-profile", not(target_family = "wasm"))))]
        let diagnostic_json = String::new();
        println!("{{\"id\":{},\"case\":{},\"mode\":{},\"pid\":{},\"seconds\":{seconds:.9},\"length\":{},\"solution\":{},\"nodes\":{},\"probes\":{}{diagnostic_json}}}",
            json(id), json(case), json(mode), std::process::id(), solution.len(), json(&word(solution)),
            result.stats.nodes, result.stats.probes);
        Ok(())
    })
}

fn load_dense(path: &Path, symmetries: &CornerSymmetries) -> Result<DenseCornerPdb, String> {
    // Same persistent file format, with a complete factor-index/18-right-edge
    // certificate. No sparse nodes or 88 MB raw-distance array are retained
    // or constructed by this load route.
    DenseCornerPdb::load_and_verify(path, symmetries)
}

fn print_dense(table: &DenseCornerPdb) {
    println!("{{\"kind\":\"full-corner-96-dense\",\"certified\":true,\"orbit_vertices\":{},\"permutation_orbits\":{},\"orientation_slots\":{},\"directed_edges_checked\":{},\"maximum\":{},\"vector_buffer_bytes\":{},\"index_vector_buffer_bytes\":{}}}",
        table.len(), table.index().permutation_orbits(), table.index().orientation_slots(),
        corner_symmetry::dense::DISTANCE_CERTIFICATE_EDGE_COUNT,
        table.max_distance(), table.memory_bytes(), table.index().memory_bytes());
}

fn output_paths(output: &Path, checkpoint: Option<&Path>) -> Result<(), String> {
    if output.exists() { return Err(format!("output already exists: {}", output.display())); }
    if checkpoint.is_some_and(|path| path == output) {
        return Err("output and checkpoint must be different paths".into());
    }
    for path in std::iter::once(output).chain(checkpoint) {
        if let Some(parent) = path.parent() {
            if !parent.as_os_str().is_empty() {
                fs::create_dir_all(parent).map_err(|error| error.to_string())?;
            }
        }
    }
    Ok(())
}

fn print_u(table: &CornerPdb) {
    let certificate = table.certificate();
    let cap = certificate.cap.map_or("null".into(), |value| value.to_string());
    println!("{{\"kind\":\"corner-left-H\",\"certified\":true,\"states\":{},\"directed_edges_checked\":{},\"maximum\":{},\"cap\":{},\"checksum\":\"{:016x}\",\"fingerprint\":\"{:016x}\"}}",
        certificate.states, certificate.directed_edges_checked, certificate.maximum, cap,
        certificate.values_checksum, certificate.format_fingerprint);
}

fn print_double(classes: &DoubleClasses) {
    let statistics = classes.stats();
    println!("{{\"kind\":\"corner-double-classes\",\"double_classes\":{},\"plus_inverse\":{},\"plus_spatial\":{},\"plus_spatial_and_inverse\":{}}}",
        statistics.double_classes, statistics.inverse_classes,
        statistics.spatial_classes, statistics.all_classes);
}

fn verify_small() -> Result<(), String> {
    let transitions = CornerTransitions::new()?;
    let symmetries = CornerSymmetries::new()?;
    symmetries.verify_small()?;
    let mut checked = 0_usize;
    // Cover every factor value, then combinations with both factors nonzero.
    let indices = (0..corner_coset::PERM_COSET_COUNT).map(|p| p * corner_coset::ORIENTATION_COUNT)
        .chain(0..corner_coset::ORIENTATION_COUNT)
        .chain((0..corner_coset::PERM_COSET_COUNT).map(|p|
            p * corner_coset::ORIENTATION_COUNT + (p * 137 + 1) % corner_coset::ORIENTATION_COUNT));
    for index in indices {
        let cube = corner_coset::unrank(index)?;
        cube.validate()?;
        if corner_coset::rank(&cube)? != index { return Err("coset rank roundtrip failed".into()); }
        for movement in 0..18u8 {
            if corner_coset::rank(&cube.moved(movement))? != transitions.successor(index, movement)? {
                return Err(format!("factorized transition differs at {index}/{movement}"));
            }
            checked += 1;
        }
    }
    // No <=4 HTM word may contradict the independently proved stronger floor.
    let mut layer = vec![Cube::SOLVED];
    let mut words = 0;
    for depth in 0..=4 {
        let mut next = Vec::new();
        for cube in layer {
            if corner_coset::lower_bound5(&cube) != 0 {
                return Err("a <=4 HTM word contradicts the analytic floor".into());
            }
            words += 1;
            if depth < 4 { for movement in 0..18 { next.push(cube.moved(movement)); } }
        }
        layer = next;
    }
    let mut witness = Cube::SOLVED;
    witness.corners[..3].copy_from_slice(&[1, 2, 0]);
    witness.validate()?;
    if !corner_coset::in_k(&witness) || corner_coset::in_h(&witness)
        || corner_coset::lower_bound4(&witness) != 4
        || corner_coset::lower_bound5(&witness) != 5 {
        return Err("analytic-floor witness was not recognized".into());
    }
    println!("{{\"kind\":\"small-coordinate-check\",\"passed\":true,\"spatial_symmetries\":{},\"factor_edges_checked\":{},\"words_through_depth4\":{}}}",
        symmetries.len(), checked, words);
    Ok(())
}

fn verify_coordinate() -> Result<(), String> {
    let transitions = CornerTransitions::new()?;
    for index in 0..corner_coset::COSET_COUNT {
        let cube = corner_coset::unrank(index)?;
        if corner_coset::rank(&cube)? != index { return Err(format!("roundtrip failed at {index}")); }
        for movement in 0..18u8 {
            if corner_coset::rank(&cube.moved(movement))? != transitions.successor(index, movement)? {
                return Err(format!("full factor transition check failed at {index}/{movement}"));
            }
        }
        if index % 65536 == 0 { eprintln!("coordinate certificate: {index}/{}", corner_coset::COSET_COUNT); }
    }
    println!("{{\"kind\":\"full-coordinate-check\",\"passed\":true,\"states\":{},\"edges\":{}}}",
        corner_coset::COSET_COUNT, corner_coset::COSET_COUNT * 18);
    Ok(())
}

fn verify_opt8_projection(path: &Path) -> Result<(), String> {
    let expected = cube48opt_research::coord::snapshot_bytes(8)? as u64;
    if fs::metadata(path).map_err(|error| error.to_string())?.len() != expected {
        return Err("Opt8 coordinate snapshot has the wrong length".into());
    }
    let bytes = fs::read(path).map_err(|error| error.to_string())?;
    let coordinates = CoordTables::from_variant_bytes(&bytes, 8)?;
    let solved = coordinates.index64(&Cube::SOLVED);
    // In the selected solved-corner frame: ep=(0 1 3), EO={0,1}.
    // Enumerate only the 48 frame choices, because the snapshot chooses the
    // solved corner's canonical frame; do not assume its symmetry ID is zero.
    let mut candidate = Cube::SOLVED;
    candidate.edges[0] = 3;
    candidate.edges[1] = 7;
    candidate.edges[3] = 0;
    candidate.validate()?;
    let mut witness = None;
    for symmetry in 0..48 {
        let cube = coordinates.conjugate(&candidate, symmetry);
        if coordinates.index64(&cube) == solved && coordinates.index64(&cube.inverse()) != solved {
            witness = Some((symmetry, cube));
            break;
        }
    }
    let (symmetry, cube) = witness.ok_or_else(||
        "this snapshot did not exhibit the derived Opt8 inverse-projection counterexample".to_string())?;
    let mut extra = Cube::SOLVED;
    extra.corners[..3].copy_from_slice(&[1, 2, 0]);
    extra.validate()?;
    let extra_bound = corner_coset::lower_bound4(&extra);
    let extra_bound5 = corner_coset::lower_bound5(&extra);
    if extra_bound != 4 || extra_bound5 != 5 {
        return Err("the independent K_C\\H_C witness must have ell4=4 and ell5=5".into());
    }
    for symmetry in 0..48 {
        let image = coordinates.conjugate(&extra, symmetry);
        if coordinates.index64(&image) != solved || coordinates.index64(&image.inverse()) != solved {
            return Err("the K_C\\H_C witness did not collide with solved in all 96 old projections".into());
        }
    }
    let eo = EoPdb::new()?;
    let mut two_flips = Cube::SOLVED;
    two_flips.edges[0] ^= 1;
    two_flips.edges[1] ^= 1;
    let hidden = (0..48).map(|symmetry| coordinates.conjugate(&two_flips, symmetry))
        .find(|image| coordinates.index64(image) == solved
            && coordinates.index64(&image.inverse()) == solved)
        .ok_or_else(|| "no solved-corner frame hid the two-flip EO witness".to_string())?;
    hidden.validate()?;
    let eo_bound = eo.lower_bound_checked(&hidden)?;
    if hidden != hidden.inverse() || hidden.corners != Cube::SOLVED.corners
        || eo_bound < 3 || corner_coset::lower_bound5(&hidden) != 0 {
        return Err("the complete-EO strict-information witness failed".into());
    }
    println!("{{\"kind\":\"opt8-projection-counterexamples\",\"passed\":true,\"frame\":{},\"solved_index\":{},\"witness_index\":{},\"inverse_witness_index\":{},\"all96_old_keys_equal_solved_for_ell4_witness\":true,\"ell4_witness_bound\":{},\"ell5_witness_bound\":{},\"two_query_eo_witness_bound\":{}}}",
        symmetry, solved, coordinates.index64(&cube), coordinates.index64(&cube.inverse()),
        extra_bound, extra_bound5, eo_bound);
    Ok(())
}

fn verify_search(table: &CornerPdb, depth: u8, full: Option<(&FullCornerPdb, &CornerSymmetries)>) -> Result<(), String> {
    // Independent full-state breadth-first reference ball, not a PDB lookup.
    let mut known = HashMap::from([(Cube::SOLVED, 0_u8)]);
    let mut queue = vec![Cube::SOLVED];
    let mut head = 0;
    while head < queue.len() {
        let cube = queue[head];
        let distance = known[&cube];
        head += 1;
        if distance == depth { continue; }
        for movement in 0..18 {
            let next = cube.moved(movement);
            if let std::collections::hash_map::Entry::Vacant(entry) = known.entry(next) {
                entry.insert(distance + 1);
                queue.push(next);
            }
        }
    }
    let oracle = CornerOracle::new(table);
    let edge_orientation = EoPdb::new()?;
    let with_eo = CornerOracle::new_with_eo(table, &edge_orientation);
    let dense = full.map(|(pdb, symmetries)| DenseCornerPdb::from_sparse(pdb, symmetries)).transpose()?;
    let prepared = full.zip(dense.as_ref()).map(|((_, symmetries), table)| table.prepare_lookup(symmetries)).transpose()?;
    let sparse_oracle = full.map(|(pdb, symmetries)| FullCornerDistanceOracle::new(pdb, symmetries));
    let dense_oracle = full.zip(dense.as_ref()).map(|((_, symmetries), table)|
        FullCornerDistanceOracle::from_dense(table, symmetries));
    let prepared_oracle = full.zip(prepared.as_ref()).map(|((_, symmetries), table)|
        FullCornerDistanceOracle::from_prepared(table, symmetries));
    let deferred = StrengthenedOracle::deferred(&oracle, table, Some(&edge_orientation))?;
    for (index, &cube) in queue.iter().enumerate() {
        let expected = known[&cube] as usize;
        for state in [cube, cube.inverse()] {
            let expected_bound = with_eo.prepare(&state, 13).map(|q| with_eo.lookup(q)).unwrap();
            let deferred_bound = deferred.prepare(&state, 13).map(|q| deferred.lookup(q)).unwrap();
            if expected_bound != deferred_bound { return Err(format!("deferred bound differs at {index}")); }
        }
        for side_oracle in [&oracle, &with_eo] {
            for contexts in [1, 8] {
                let result = search::solve(cube, side_oracle, SearchOptions {
                    max_depth: depth, max_nodes: 1_000_000, contexts,
                })?;
                let moves = result.solution.ok_or_else(|| format!("NISS did not solve shallow case {index}"))?;
                if moves.len() != expected || result.cancelled {
                    return Err(format!("NISS shortest length differs at {index}/{contexts}"));
                }
                replay(cube, &moves, false)?;
            }
        }
        if let (Some(sparse), Some(dense), Some(prepared)) = (&sparse_oracle, &dense_oracle, &prepared_oracle) {
            if sparse.lower_bound(&cube)? != dense.lower_bound(&cube)? {
                return Err(format!("sparse/dense distance differs at shallow case {index}"));
            }
            let late = DistanceGatedOracle::after_primary(&deferred, prepared);
            for contexts in [1, 8] {
                let result = search::solve(cube, &late, SearchOptions {
                    max_depth: depth, max_nodes: 1_000_000, contexts,
                })?;
                let moves = result.solution.ok_or_else(|| format!("late distance NISS did not solve {index}"))?;
                if result.cancelled || moves.len() != expected { return Err(format!("late distance length differs at {index}")); }
                replay(cube, &moves, false)?;
            }
            for distance_oracle in [sparse, dense] {
                let gated = DistanceGatedOracle::new(&oracle, distance_oracle);
                for contexts in [1, 8] {
                    let result = search::solve(cube, &gated, SearchOptions {
                        max_depth: depth, max_nodes: 1_000_000, contexts,
                    })?;
                    let moves = result.solution.ok_or_else(|| format!("distance-gated NISS did not solve case {index}"))?;
                    if moves.len() != expected || result.cancelled {
                        return Err(format!("distance-gated NISS shortest length differs at {index}/{contexts}"));
                    }
                    replay(cube, &moves, false)?;
                }
                for capacity in [0, 1024] {
                    let result = corner_distance_search::solve(cube, distance_oracle,
                        corner_distance_search::Options {
                            max_depth: depth, max_nodes: 1_000_000, failed_cache_capacity: capacity,
                        })?;
                    let moves = result.solution.ok_or_else(|| format!("distance IDA did not solve case {index}"))?;
                    if moves.len() != expected || result.cancelled {
                        return Err(format!("distance IDA shortest length differs at {index}/{capacity}"));
                    }
                    replay(cube, &moves, false)?;
                }
            }
        }
        if index % 256 == 0 { eprintln!("search certificate: {index}/{}", queue.len()); }
    }
    println!("{{\"kind\":\"bounded-search-check\",\"passed\":true,\"reference_depth\":{},\"full_cube_states\":{},\"contexts\":[1,8],\"distance_only_checked\":{},\"dense_and_gated_niss_checked\":{},\"prepared_late_niss_checked\":{}}}",
        depth, queue.len(), full.is_some(), full.is_some(), full.is_some());
    Ok(())
}

fn run() -> Result<(), String> {
    let args: Vec<String> = env::args().skip(1).collect();
    if args.is_empty() || matches!(args[0].as_str(), "--help" | "-h") {
        print!("{HELP}"); return Ok(());
    }
    if args[0] == "inspect" {
        println!("{{\"status\":\"research-code-no-benchmark-claim\",\"left_cosets\":{},\"full_corners\":{},\"predicted_full96_orbits\":{},\"predicted_double96_orbits\":{}}}",
            corner_coset::COSET_COUNT, corner_symmetry::FULL_CORNER_COUNT,
            corner_symmetry::FULL_CORNER_ORBIT_COUNT, corner_symmetry::DOUBLE_ALL_CLASS_COUNT);
        if args.len() > 1 {
            let cube = Cube::from_scramble(&args[1..].join(" "))?;
            println!("{{\"left_coset_rank\":{},\"inverse_left_coset_rank\":{},\"ell4\":{},\"ell5\":{}}}",
                corner_coset::rank(&cube)?, corner_coset::rank(&cube.inverse())?,
                corner_coset::lower_bound4(&cube), corner_coset::lower_bound5(&cube));
        }
        return Ok(());
    }
    if env::var("CUBEOPT_CORNER_GUARDED").as_deref() != Ok("1")
        || env::var("CUBEOPT_BACKEND").as_deref() != Ok("corner") {
        return Err("use the repository guard.mts with CUBEOPT_BACKEND=corner; see corner96-research.md".into());
    }
    match args[0].as_str() {
        "joint-pair-solve" => {
            arity(&args, 5, 5)?;
            #[cfg(all(feature = "opt8-native-specialized", not(target_family = "wasm")))]
            { joint::solve(&args) }
            #[cfg(not(all(feature = "opt8-native-specialized", not(target_family = "wasm"))))]
            Err("joint-pair-solve requires opt8-native-specialized".into())
        }
        "joint-probe" | "joint-pair-probe" => {
            arity(&args, 5, 5)?;
            #[cfg(all(feature = "opt8-native-specialized", not(target_family = "wasm")))]
            { if args[0] == "joint-probe" { joint::probe::<24>(&args) } else { joint::probe::<PAIR_EDGES>(&args) } }
            #[cfg(not(all(feature = "opt8-native-specialized", not(target_family = "wasm"))))]
            Err("joint-probe requires opt8-native-specialized".into())
        }
        "joint-pair-check" | "joint-pair-build" => {
            let check = args[0] == "joint-pair-check";
            arity(&args, if check { 2 } else { 4 }, if check { 2 } else { 4 })?;
            let started = Instant::now();
            if fs::metadata(&args[1]).map_err(|e| e.to_string())?.len() != 818_008 {
                return Err("joint geometry requires the 818008-byte Opt8 small snapshot".into());
            }
            let small = CoordTables::from_variant_bytes(&fs::read(&args[1]).map_err(|e| e.to_string())?, 8)?;
            let transitions = PairTransitions::new(&small)?;
            if check {
                println!("{{\"kind\":\"corner-edge-pair-check\",\"verified\":true,\"refines_single_edge\":true,\"states\":{PAIR_COUNT},\"seconds\":{}}}", started.elapsed().as_secs_f64());
            } else {
                let pdb = PairPdb::build_pair(&transitions, Path::new(&args[2]), Path::new(&args[3]))?;
                println!("{{\"kind\":\"corner-edge-pair-build\",\"certified\":true,\"states\":{PAIR_COUNT},\"bytes\":{},\"maximum\":{},\"distribution\":{:?},\"seconds\":{}}}",
                    PAIR_COUNT + 24, pdb.maximum, pdb.distribution(), started.elapsed().as_secs_f64());
            }
            Ok(())
        }
        "joint-check" | "joint-build" => {
            arity(&args, if args[0] == "joint-check" { 2 } else { 4 }, if args[0] == "joint-check" { 2 } else { 4 })?;
            let started = Instant::now();
            if fs::metadata(&args[1]).map_err(|e| e.to_string())?.len() != 818_008 {
                return Err("joint geometry requires the existing 818008-byte Opt8 small snapshot".into());
            }
            let small = CoordTables::from_variant_bytes(&fs::read(&args[1]).map_err(|e| e.to_string())?, 8)?;
            let transitions = JointTransitions::new(&small)?;
            if args[0] == "joint-check" {
                println!("{{\"kind\":\"corner-edge-joint-check\",\"verified\":true,\"states\":88179840,\"seconds\":{}}}", started.elapsed().as_secs_f64());
            } else {
                let pdb = JointPdb::build(&transitions, Path::new(&args[2]), Path::new(&args[3]))?;
                println!("{{\"kind\":\"corner-edge-joint-build\",\"certified\":true,\"states\":88179840,\"bytes\":88179864,\"maximum\":{},\"distribution\":{:?},\"seconds\":{}}}",
                    pdb.maximum, pdb.distribution(), started.elapsed().as_secs_f64());
            }
            Ok(())
        }
        "compare-layouts" => { arity(&args, 2, 2)?; layouts::compare(Path::new(&args[1])) }
        "compare-opt8" | "compare-opt8-scheduled" | "profile-opt8" => {
            arity(&args, 6, 6)?;
            if args[0] == "profile-opt8" && !cfg!(feature = "opt10-native-profile") {
                return Err("profile-opt8 requires the existing opt10-native-profile diagnostics feature".into());
            }
            #[cfg(all(feature = "opt8-native-specialized", not(target_family = "wasm")))]
            {
                let started = Instant::now();
                let transitions = CornerTransitions::new()?;
                let corners = CornerPdb::load(Path::new(&args[1]), &transitions)?;
                let symmetries = CornerSymmetries::new()?;
                let full = load_dense(Path::new(&args[2]), &symmetries)?;
                let original = load_opt("8", Path::new(&args[3]), Path::new(&args[4]))?;
                compare_opt8(&original, &corners, &full, &symmetries,
                    number(&args[5], 1, 1_000_000_000, "node budget")?, started.elapsed().as_secs_f64(),
                    args[0] != "compare-opt8", args[0] == "profile-opt8")
            }
            #[cfg(not(all(feature = "opt8-native-specialized", not(target_family = "wasm"))))]
            Err("compare-opt8 requires the opt8-native-specialized feature".into())
        }
        "verify-small" => { arity(&args, 1, 1)?; verify_small() }
        "verify-eo" => {
            arity(&args, 1, 1)?;
            let table = EoPdb::new()?;
            let weights = table.weight_minima().iter().map(u8::to_string).collect::<Vec<_>>().join(",");
            println!("{{\"kind\":\"full-edge-orientation\",\"certified\":true,\"states\":2048,\"maximum\":{},\"even_weight_minima\":[{}]}}", table.maximum(), weights);
            Ok(())
        }
        "query-eo" => {
            arity(&args, 1, 1)?;
            let table = EoPdb::new()?;
            input(|id, cube| {
                let left = table.lower_bound(&cube);
                let right = table.lower_bound(&cube.inverse());
                println!("{{\"id\":{},\"raw_eo_left\":{},\"raw_eo_right\":{},\"distance_only_max\":{},\"both_H_and_96_weight_bound\":{}}}",
                    json(id), left, right, left.max(right), table.weight_bound(&cube));
                Ok(())
            })
        }
        "verify-coordinate" => { arity(&args, 1, 1)?; verify_coordinate() }
        "verify-opt8-projection" => {
            arity(&args, 2, 2)?;
            verify_opt8_projection(Path::new(&args[1]))
        }
        "build-u" => {
            arity(&args, 4, 5)?;
            let mode = if args[3] == "exact" { BuildMode::Exact }
                else { BuildMode::Capped(number(&args[3], 1, 254, "cap")? as u8) };
            let chunk = args.get(4).map_or(Ok(16384), |text| number(text, 1, 1_000_000, "checkpoint chunk"))? as usize;
            let output = Path::new(&args[1]);
            let checkpoint = Path::new(&args[2]);
            output_paths(output, Some(checkpoint))?;
            let transitions = CornerTransitions::new()?;
            let mut bfs = if checkpoint.exists() { CornerBfs::load_checkpoint(checkpoint, &transitions)? }
                else { CornerBfs::new(mode)? };
            if bfs.mode() != mode { return Err("requested mode differs from the checkpoint".into()); }
            bfs.save_checkpoint(checkpoint)?;
            loop {
                let progress = bfs.advance(&transitions, chunk)?;
                bfs.save_checkpoint(checkpoint)?;
                eprintln!("u build: processed={} discovered={} depth={} complete={}",
                    progress.expanded, progress.discovered, progress.maximum_discovered_depth, progress.complete);
                if progress.complete { break; }
            }
            let table = bfs.finish(&transitions)?;
            table.save(output)?;
            print_u(&table);
            Ok(())
        }
        "verify-u" => {
            arity(&args, 2, 2)?;
            let transitions = CornerTransitions::new()?;
            let table = CornerPdb::load(Path::new(&args[1]), &transitions)?;
            print_u(&table); Ok(())
        }
        "build-double" => {
            arity(&args, 2, 2)?;
            let output = Path::new(&args[1]);
            output_paths(output, None)?;
            let transitions = CornerTransitions::new()?;
            eprintln!("Building the finite double-class decoder in one pass; this command has no partial resume.");
            let classes = DoubleClasses::build(&transitions)?;
            classes.save(output)?;
            print_double(&classes); Ok(())
        }
        "verify-double" => {
            arity(&args, 2, 2)?;
            let transitions = CornerTransitions::new()?;
            let classes = DoubleClasses::load_and_verify(Path::new(&args[1]), &transitions)?;
            print_double(&classes); Ok(())
        }
        "build96" => {
            arity(&args, 3, 4)?;
            let chunk = args.get(3).map_or(Ok(1024), |text| number(text, 1, 1_000_000, "checkpoint chunk"))? as usize;
            let output = Path::new(&args[1]);
            let checkpoint = Path::new(&args[2]);
            output_paths(output, Some(checkpoint))?;
            let symmetries = CornerSymmetries::new()?;
            let mut bfs = if checkpoint.exists() { FullCornerBfs::resume(checkpoint, &symmetries)? }
                else { FullCornerBfs::new(&symmetries)? };
            bfs.save_checkpoint(checkpoint)?;
            loop {
                let progress = bfs.advance(&symmetries, chunk)?;
                bfs.save_checkpoint(checkpoint)?;
                eprintln!("96 build: expanded={} orbit_vertices={} raw_covered={} depth={} complete={}",
                    progress.expanded, progress.discovered, progress.raw_visited, progress.depth, progress.complete);
                if progress.complete { break; }
            }
            let table = bfs.finish(&symmetries)?;
            table.save(output)?;
            println!("{{\"kind\":\"full-corner-96\",\"certified\":true,\"orbit_vertices\":{}}}", table.len());
            Ok(())
        }
        "verify96" => {
            arity(&args, 2, 2)?;
            let symmetries = CornerSymmetries::new()?;
            let table = FullCornerPdb::load_and_verify(Path::new(&args[1]), &symmetries)?;
            println!("{{\"kind\":\"full-corner-96\",\"certified\":true,\"orbit_vertices\":{}}}", table.len());
            Ok(())
        }
        "verify-dense" => {
            arity(&args, 2, 2)?;
            let symmetries = CornerSymmetries::new()?;
            let table = load_dense(Path::new(&args[1]), &symmetries)?;
            print_dense(&table);
            Ok(())
        }
        "query-u-eo" => {
            arity(&args, 2, 2)?;
            let transitions = CornerTransitions::new()?;
            let table = CornerPdb::load(Path::new(&args[1]), &transitions)?;
            let eo = EoPdb::new()?;
            input(|id, cube| {
                let u = table.lookup(&cube);
                let edge = eo.lower_bound(&cube);
                let coupled = corner_oracle::coupled_one_step_h_bound(&table, &eo, &cube);
                println!("{{\"id\":{},\"raw_u\":{},\"eo\":{},\"independent_max\":{},\"coupled_one_step_h\":{},\"ell5\":{}}}",
                    json(id), u, edge, u.max(edge), coupled, corner_coset::lower_bound5(&cube));
                Ok(())
            })
        }
        "query-u" | "query-v" => {
            let with_double = args[0] == "query-v";
            arity(&args, if with_double { 3 } else { 2 }, if with_double { 3 } else { 2 })?;
            let transitions = CornerTransitions::new()?;
            let table = CornerPdb::load(Path::new(&args[1]), &transitions)?;
            let classes = if with_double { Some(DoubleClasses::load_and_verify(Path::new(&args[2]), &transitions)?) } else { None };
            let double = classes.as_ref().map(|classes| DoubleCornerOracle::new(classes, &table)).transpose()?;
            input(|id, cube| {
                let bounds = corner_oracle::bounds(&table, &cube);
                let v = double.as_ref().map(|oracle| oracle.value(&cube)).transpose()?
                    .map_or("null".into(), |value| value.to_string());
                println!("{{\"id\":{},\"raw_u\":{},\"raw_u_inverse\":{},\"left\":{},\"right\":{},\"distance_only_max\":{},\"pointwise_both_min\":{},\"double_invariant_v\":{},\"ell4\":{},\"ell5\":{}}}",
                    json(id), table.lookup(&cube), table.lookup(&cube.inverse()),
                    bounds.left, bounds.right, bounds.distance.get(), bounds.pointwise_both.get(),
                    v, corner_coset::lower_bound4(&cube), corner_coset::lower_bound5(&cube));
                Ok(())
            })
        }
        "query96" | "solve-corners" => {
            arity(&args, 2, 2)?;
            let symmetries = CornerSymmetries::new()?;
            let table = FullCornerPdb::load_and_verify(Path::new(&args[1]), &symmetries)?;
            input(|id, cube| {
                let distance = table.distance(&cube, &symmetries)?;
                let solution = if args[0] == "solve-corners" {
                    let moves = table.solve_corners(&cube, &symmetries)?;
                    replay(cube, &moves, true)?;
                    if moves.len() != distance as usize { return Err("corner solution length disagrees with its distance".into()); }
                    json(&word(&moves))
                } else { "null".into() };
                println!("{{\"id\":{},\"scope\":\"corners-only\",\"exact_corner_distance\":{},\"full_cube_lower_bound\":{},\"corner_solution\":{}}}",
                    json(id), distance, distance, solution);
                Ok(())
            })
        }
        "query96-dense" => {
            arity(&args, 2, 2)?;
            let symmetries = CornerSymmetries::new()?;
            let table = load_dense(Path::new(&args[1]), &symmetries)?;
            input(|id, cube| {
                let distance = table.distance(&cube, &symmetries)?;
                println!("{{\"id\":{},\"scope\":\"corners-only\",\"index_kind\":\"dense96\",\"dense_id\":{},\"exact_corner_distance\":{},\"full_cube_lower_bound\":{}}}",
                    json(id), table.index().index(&cube, &symmetries)?, distance, distance);
                Ok(())
            })
        }
        "solve-u" | "solve-u-eo" => {
            arity(&args, 4, 5)?;
            let transitions = CornerTransitions::new()?;
            let table = CornerPdb::load(Path::new(&args[1]), &transitions)?;
            let eo = if args[0] == "solve-u-eo" { Some(EoPdb::new()?) } else { None };
            let oracle = eo.as_ref().map_or_else(|| CornerOracle::new(&table),
                |eo| CornerOracle::new_with_eo(&table, eo));
            solve_input(&oracle, options(&args[2], &args[3], args.get(4))?)
        }
        "solve-u-distance" | "solve-u-distance-sparse" => {
            arity(&args, 5, 6)?;
            let transitions = CornerTransitions::new()?;
            let table = CornerPdb::load(Path::new(&args[1]), &transitions)?;
            let symmetries = CornerSymmetries::new()?;
            let dense = if args[0] == "solve-u-distance" {
                Some(load_dense(Path::new(&args[2]), &symmetries)?)
            } else { None };
            let sparse = if dense.is_none() {
                Some(FullCornerPdb::load_and_verify(Path::new(&args[2]), &symmetries)?)
            } else { None };
            let distance = if let Some(table) = dense.as_ref() {
                FullCornerDistanceOracle::from_dense(table, &symmetries)
            } else {
                FullCornerDistanceOracle::new(sparse.as_ref().expect("selected sparse mode"), &symmetries)
            };
            let subgroup = CornerOracle::new(&table);
            let oracle = DistanceGatedOracle::new(&subgroup, &distance);
            solve_input(&oracle, options(&args[3], &args[4], args.get(5))?)
        }
        "solve-v" | "solve-v-eo" => {
            arity(&args, 5, 6)?;
            let transitions = CornerTransitions::new()?;
            let table = CornerPdb::load(Path::new(&args[1]), &transitions)?;
            let classes = DoubleClasses::load_and_verify(Path::new(&args[2]), &transitions)?;
            let eo = if args[0] == "solve-v-eo" { Some(EoPdb::new()?) } else { None };
            let oracle = if let Some(eo) = eo.as_ref() {
                DoubleCornerOracle::new_with_eo(&classes, &table, eo)?
            } else {
                DoubleCornerOracle::new(&classes, &table)?
            };
            solve_input(&oracle, options(&args[3], &args[4], args.get(5))?)
        }
        "solve-distance" | "solve-distance-dense" => {
            arity(&args, 4, 5)?;
            let symmetries = CornerSymmetries::new()?;
            let dense = if args[0] == "solve-distance-dense" {
                Some(load_dense(Path::new(&args[1]), &symmetries)?)
            } else { None };
            let sparse = if dense.is_none() {
                Some(FullCornerPdb::load_and_verify(Path::new(&args[1]), &symmetries)?)
            } else { None };
            let oracle = if let Some(table) = dense.as_ref() {
                FullCornerDistanceOracle::from_dense(table, &symmetries)
            } else {
                FullCornerDistanceOracle::new(sparse.as_ref().expect("selected sparse mode"), &symmetries)
            };
            let options = corner_distance_search::Options {
                max_depth: number(&args[2], 0, 20, "max depth")? as u8,
                max_nodes: number(&args[3], 1, u64::MAX, "node budget")?,
                failed_cache_capacity: args.get(4).map_or(Ok(100000), |text| number(text, 0, 1_000_000, "cache entries"))? as usize,
            };
            input(|id, cube| {
                let result = corner_distance_search::solve(cube, &oracle, options)?;
                let solution = if let Some(moves) = &result.solution { replay(cube, moves, false)?; json(&word(moves)) }
                    else { "null".into() };
                let exhausted = result.completed_depth.map_or("null".into(), |depth| depth.to_string());
                println!("{{\"id\":{},\"scope\":\"full-cube\",\"solution\":{},\"optimal_if_found\":true,\"completed_depth\":{},\"cancelled\":{},\"nodes\":{},\"context_cache_hits\":{}}}",
                    json(id), solution, exhausted, result.cancelled, result.nodes, result.cache_hits);
                Ok(())
            })
        }
        "solve-opt" => {
            arity(&args, 7, 8)?;
            let transitions = CornerTransitions::new()?;
            let corners = CornerPdb::load(Path::new(&args[1]), &transitions)?;
            let original = load_opt(&args[2], Path::new(&args[3]), Path::new(&args[4]))?;
            let oracle = StrengthenedOracle::new(&original, &corners)?;
            solve_input(&oracle, options(&args[5], &args[6], args.get(7))?)
        }
        "solve-opt-distance" | "solve-opt-distance-eo" => {
            arity(&args, 8, 9)?;
            let transitions = CornerTransitions::new()?;
            let corners = CornerPdb::load(Path::new(&args[1]), &transitions)?;
            let symmetries = CornerSymmetries::new()?;
            let full = load_dense(Path::new(&args[2]), &symmetries)?;
            let distance = FullCornerDistanceOracle::from_dense(&full, &symmetries);
            let original = load_opt(&args[3], Path::new(&args[4]), Path::new(&args[5]))?;
            let eo = if args[0] == "solve-opt-distance-eo" { Some(EoPdb::new()?) } else { None };
            let strengthened = if let Some(eo) = eo.as_ref() {
                StrengthenedOracle::new_with_eo(&original, &corners, eo)?
            } else {
                StrengthenedOracle::new(&original, &corners)?
            };
            let oracle = DistanceGatedOracle::new(&strengthened, &distance);
            solve_input(&oracle, options(&args[6], &args[7], args.get(8))?)
        }
        "verify-search" => {
            arity(&args, 3, 4)?;
            let depth = number(&args[2], 0, 3, "reference depth")? as u8;
            let transitions = CornerTransitions::new()?;
            let table = CornerPdb::load(Path::new(&args[1]), &transitions)?;
            let full = if let Some(path) = args.get(3) {
                let symmetries = CornerSymmetries::new()?;
                let pdb = FullCornerPdb::load_and_verify(Path::new(path), &symmetries)?;
                Some((pdb, symmetries))
            } else { None };
            verify_search(&table, depth, full.as_ref().map(|(pdb, symmetries)| (pdb, symmetries)))
        }
        _ => Err(format!("unknown corner research command {}; see --help", args[0])),
    }
}

fn main() {
    if let Err(error) = run() {
        eprintln!("corner-research: {error}");
        std::process::exit(1);
    }
}

//! Bounded EO10 arithmetic check. Reads only the 818,008-byte Opt9 snapshot.
//! On x86, run separate processes with CUBEOPT_SIMD=scalar|avx2|avx512 to
//! compare each supported dispatch path against the explicit scalar reference.
use cube48opt_research::{coord::CoordTables, cube::Cube,
    opt10::{Opt10Coordinates, COORDINATES, TABLE_BYTES, project_to_opt9}};
use std::{collections::{HashMap, HashSet}, env, fs};

#[derive(Default)]
struct OrbitChecks {
    states: usize,
    conjugates: usize,
    identity_permutations: usize,
    successor_sets: usize,
}

fn successors(cube: &Cube, opt10: &Opt10Coordinates) -> HashSet<u64> {
    (0..18).map(|movement| opt10.full_key(&cube.moved(movement))).collect()
}

fn projected(cube: &Cube, opt10: &Opt10Coordinates) -> HashSet<u64> {
    let mut result = HashSet::new();
    opt10.projected_aliases(cube, &mut |index| { result.insert(index); });
    result
}

/// An even three-cycle of identities within one omitted group. Orientations
/// remain attached to positions; the permutation leaves physical parity legal.
fn relabel_group(mut cube: Cube, group: usize) -> Cube {
    if group < 2 {
        let base = group as u8 * 4;
        for piece in &mut cube.corners {
            let identity = *piece & 7;
            if (base..base + 3).contains(&identity) {
                *piece = (*piece & !7) | (base + (identity - base + 1) % 3);
            }
        }
    } else {
        let base = (group - 2) as u8 * 4;
        for piece in &mut cube.edges {
            let identity = *piece >> 1;
            if (base..base + 3).contains(&identity) {
                *piece = (*piece & 1) | ((base + (identity - base + 1) % 3) << 1);
            }
        }
    }
    cube.validate().unwrap();
    cube
}

fn check_orbit(cube: Cube, opt10: &Opt10Coordinates, counts: &mut OrbitChecks) {
    let key = opt10.full_key(&cube);
    let decoded = opt10.representative(key).unwrap();
    decoded.validate().unwrap();
    assert_eq!(opt10.full_key(&decoded), key, "canonical-key round trip");
    let aliases = projected(&cube, opt10);
    assert!(aliases.contains(&opt10.index(&cube)));
    assert_eq!(projected(&decoded, opt10), aliases);
    let expected_successors = successors(&cube, opt10);
    assert_eq!(successors(&decoded, opt10), expected_successors,
        "full abstract state must determine the successor orbit set");
    counts.successor_sets += 1;
    for symmetry in 0..48 {
        let conjugated = opt10.conjugate(&cube, symmetry);
        assert_eq!(opt10.full_key(&conjugated), key, "conjugation-invariant key");
        assert!(aliases.contains(&opt10.index(&conjugated)),
            "every queried conjugate must have its projection marked");
        assert_eq!(projected(&conjugated, opt10), aliases);
        counts.conjugates += 1;
    }
    for group in 0..5 {
        let relabeled = relabel_group(cube, group);
        assert_eq!(opt10.full_key(&relabeled), key, "omitted identity permutation");
        assert_eq!(projected(&relabeled, opt10), aliases);
        assert_eq!(successors(&relabeled, opt10), expected_successors,
            "omitted identities must not affect abstract transitions");
        counts.identity_permutations += 1;
        counts.successor_sets += 1;
    }
    counts.states += 1;
}

/// Independently enumerate concrete cubes before collapsing their coordinates.
/// Compare against a BFS that expands only reconstructed abstract states. This
/// detects orbit omissions and spurious transitions at every depth through 3.
fn check_shallow_distances(concrete: &HashMap<Cube, u8>, opt10: &Opt10Coordinates) -> usize {
    let mut expected = HashMap::<u64, u8>::new();
    for (cube, depth) in concrete {
        expected.entry(opt10.full_key(cube)).and_modify(|old| *old = (*old).min(*depth))
            .or_insert(*depth);
    }
    let start = opt10.full_key(&Cube::SOLVED);
    let mut actual = HashMap::from([(start, 0u8)]);
    let mut frontier = vec![start];
    for depth in 1..=3 {
        let mut next = Vec::new();
        for key in frontier {
            let cube = opt10.representative(key).unwrap();
            for successor in successors(&cube, opt10) {
                if let std::collections::hash_map::Entry::Vacant(entry) = actual.entry(successor) {
                    entry.insert(depth);
                    next.push(successor);
                }
            }
        }
        frontier = next;
    }
    assert_eq!(actual, expected, "abstract BFS versus independent concrete BFS distances");
    actual.len()
}

fn check(cube: Cube, opt9: &CoordTables, opt10: &Opt10Coordinates, data: &[u8]) {
    let index = opt10.index(&cube);
    assert!(index < COORDINATES);
    assert_eq!(index, opt10.index_scalar(&cube));
    assert_eq!(project_to_opt9(index).unwrap(), opt9.index64(&cube));
    let offset = data.len() - 153_090 * 4 + opt9.raw_corner(&cube) * 4;
    let class = u32::from_le_bytes(data[offset..offset+4].try_into().unwrap());
    let canonical = opt9.conjugate(&cube, (class & 63) as u8);
    let outer: u16 = canonical.edges.iter().enumerate()
        .filter(|(_, e)| **e >> 1 >= 8).map(|(i, _)| 1 << i).sum();
    let inner: u8 = canonical.edges.iter().filter(|e| **e >> 1 < 8)
        .enumerate().filter(|(_, e)| **e >> 1 >= 4).map(|(i, _)| 1 << i).sum();
    // Independent combinatorial ranking; no fast complement/rank LUT reads.
    let inner_rank = (0u16..256).rev().filter(|m| m.count_ones() == 4)
        .position(|m| m == u16::from(inner)).unwrap() as u64;
    let ordinal = (0u16..4096).rev().filter(|m| m.count_ones() == 4)
        .position(|m| m == outer).unwrap() as u64;
    let outer_rank = ordinal + 2 * (ordinal / 62 + 1);
    let eo: u64 = canonical.edges[1..11].iter().enumerate()
        .map(|(i, e)| u64::from(e & 1) << i).sum();
    assert_eq!(index, ((u64::from(class >> 6) * 70 + inner_rank) << 19)
        | (eo << 9) | outer_rank);
    // Search's cached opposite-side bound requires LEFT half-turn invariance.
    for movement in [1, 4, 7, 10, 13, 16] {
        assert_eq!(index, opt10.index(&cube.premoved(movement)));
    }
}

fn main() {
    let args: Vec<_> = env::args().collect();
    assert_eq!(args.len(), 2, "verify_opt10_coordinates OPT9_SMALL_SNAPSHOT");
    #[cfg(target_arch = "x86_64")]
    let backend = cube48opt_research::x86_simd::initialize()
        .expect("requested SIMD backend must be supported").name();
    #[cfg(target_arch = "aarch64")]
    let backend = "neon";
    #[cfg(not(any(target_arch = "x86_64", target_arch = "aarch64")))]
    let backend = "scalar";
    assert_eq!(fs::metadata(&args[1]).unwrap().len(), 818_008);
    let data = fs::read(&args[1]).unwrap();
    let opt9 = CoordTables::from_variant_bytes(&data, 9).unwrap();
    let opt10 = Opt10Coordinates::from_opt9_snapshot(&data).unwrap();
    let mut seen = HashMap::from([(Cube::SOLVED, 0u8)]);
    let mut frontier = vec![Cube::SOLVED];
    for depth in 1..=3 {
        let mut next = Vec::new();
        for cube in frontier {
            for movement in 0..18 {
                let cube = cube.moved(movement);
                if let std::collections::hash_map::Entry::Vacant(entry) = seen.entry(cube) {
                    entry.insert(depth);
                    next.push(cube);
                }
            }
        }
        frontier = next;
    }
    assert_eq!(seen.len(), 3502);
    let shallow_orbits = check_shallow_distances(&seen, &opt10);
    let mut orbit_checks = OrbitChecks::default();
    let mut queries = 0;
    for cube in seen.keys() {
        check_orbit(*cube, &opt10, &mut orbit_checks);
        for state in [*cube, cube.inverse()] {
            check(state, &opt9, &opt10, &data);
            queries += 1;
        }
    }
    // Deep deterministic walks cover wide addresses absent from shallow cubes.
    let mut rng = 0x4f505431305f454fu64;
    let mut cube = Cube::SOLVED;
    let mut max_index = 0;
    for _ in 0..407 {
        for _ in 0..25 {
            rng ^= rng << 13; rng ^= rng >> 7; rng ^= rng << 17;
            cube = cube.moved((rng % 18) as u8);
        }
        check_orbit(cube, &opt10, &mut orbit_checks);
        check_orbit(cube.inverse(), &opt10, &mut orbit_checks);
        for symmetry in 0..48 {
            let state = opt9.conjugate(&cube, symmetry);
            for state in [state, state.inverse()] {
                check(state, &opt9, &opt10, &data);
                max_index = max_index.max(opt10.index(&state));
                queries += 1;
            }
        }
    }
    assert!(max_index > u64::from(u32::MAX));
    println!("{{\"schema\":\"cuberoot.opt10.coordinates.v2\",\"coordinateBackend\":\"{backend}\",\"shallowStates\":3502,\"shallowExactOrbits\":{shallow_orbits},\"deepStates\":407,\"queries\":{queries},\"leftHalfTurnChecks\":{},\"orbitStates\":{},\"conjugateOrbitChecks\":{},\"withinGroupPermutationChecks\":{},\"successorSetChecks\":{},\"maxIndex\":{max_index},\"plannedTableBytes\":{TABLE_BYTES},\"pdbLoaded\":false,\"allEqual\":true}}", queries*6, orbit_checks.states, orbit_checks.conjugates, orbit_checks.identity_permutations, orbit_checks.successor_sets);
}

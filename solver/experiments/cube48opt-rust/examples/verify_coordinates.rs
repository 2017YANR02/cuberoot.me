//! Small-table differential checker; no PDB loading or search.
//! JSON/provenance handling is delegated to ../verify-coordinates.mjs.
use cube48opt_research::{
    coord::CoordTables,
    cube::{moved_pair, Cube},
};
use std::{
    env, fs,
    io::{self, BufRead},
};

fn hex<const N: usize>(text: &str) -> [u8; N] {
    assert_eq!(text.len(), N * 2, "hex field length");
    let mut bytes = [0; N];
    for (i, value) in bytes.iter_mut().enumerate() {
        *value = u8::from_str_radix(&text[2 * i..2 * i + 2], 16).expect("hex byte");
    }
    bytes
}

fn class(data: &[u8], tables: &CoordTables, cube: &Cube) -> u32 {
    // This raw u32 array ends at the snapshot boundary in all nine binaries.
    let offset = data.len() - 153_090 * 4 + 4 * tables.raw_corner(cube);
    u32::from_le_bytes(data[offset..offset + 4].try_into().unwrap())
}

fn check_fast_slow(tables: &CoordTables, cube: &Cube, id: &str) {
    assert_eq!(
        tables.index64(cube),
        tables.index64_slow(cube),
        "fast/slow {id}"
    );
    let inverse = cube.inverse();
    assert_eq!(
        tables.index64(&inverse),
        tables.index64_slow(&inverse),
        "inverse fast/slow {id}"
    );
}

fn main() {
    let args: Vec<_> = env::args().collect();
    assert_eq!(
        args.len(),
        2,
        "usage: verify_coordinates SMALL_MEMORY; use verify-coordinates.mjs to supply stdin"
    );
    let variant = env::var("CUBEOPT_VARIANT").unwrap_or_else(|_| "1".into());
    assert!(
        variant.len() == 1 && (b'1'..=b'9').contains(&variant.as_bytes()[0]),
        "CUBEOPT_VARIANT must be 1..9"
    );
    let variant = variant.parse::<u8>().unwrap();
    let data = fs::read(&args[1]).expect("small-table snapshot");
    let tables =
        CoordTables::from_variant_bytes(&data, variant).expect("valid small-table snapshot");
    assert_eq!(tables.variant(), variant);
    let separation_delta = match variant {
        1 => 0,
        2..=7 => 96,
        8..=9 => 832,
        _ => unreachable!(),
    };
    let eo_bits = if variant == 1 { 0 } else { variant };
    let mut states = 0;
    let mut fast_slow = 0;
    let mut max_index = 0;
    let mut wide_indices = 0;
    for line in io::stdin().lock().lines() {
        let line = line.expect("stdin line");
        // id, cube20, fast48, 48 conjugates, scramble, normal index, inverse index.
        let fields: Vec<_> = line.split('\t').collect();
        assert_eq!(fields.len(), 54, "TSV column count");
        let id = fields[0];
        assert_eq!(
            id.parse::<usize>().expect("fixture index"),
            states,
            "fixture order"
        );
        let expected = Cube::from_bytes(&hex::<20>(fields[1])).expect("oracle cube");
        let cube = Cube::from_scramble(fields[51]).expect("fixture scramble");
        assert_eq!(cube, expected, "cube {id}");
        let fast = cube.to_fast_bytes();
        let expected_fast = hex::<48>(fields[2]);
        // Original fastcube has undefined padding at 28..32 and 44..48.
        assert_eq!(fast[..28], expected_fast[..28], "fast first payload {id}");
        assert_eq!(
            fast[32..44],
            expected_fast[32..44],
            "fast inverse edges {id}"
        );
        assert_eq!(fast[28..32], [0; 4], "native first padding {id}");
        assert_eq!(fast[44..48], [0; 4], "native second padding {id}");
        assert_eq!(cube.inverse().inverse(), cube, "inverse involution {id}");
        assert!(
            cube.multiplied(&cube.inverse()).is_solved(),
            "inverse product {id}"
        );
        check_fast_slow(&tables, &cube, id);
        fast_slow += 2;
        for m in 0..18 {
            let moved = cube.moved(m);
            let premoved = cube.inverse().premoved(m);
            assert_eq!(moved.inverse(), premoved, "inverse move {id} {m}");
            let pair = moved_pair(&cube, &cube.inverse(), m);
            assert_eq!(
                pair.0.to_bytes(),
                moved.to_bytes(),
                "paired normal move {id} {m}"
            );
            assert_eq!(
                pair.1.to_bytes(),
                premoved.to_bytes(),
                "paired inverse move {id} {m}"
            );
            check_fast_slow(&tables, &moved, id);
            fast_slow += 2;
        }
        let corner_class = class(&data, &tables, &cube);
        for symmetry in 0..48 {
            let expected =
                Cube::from_bytes(&hex::<20>(fields[3 + symmetry])).expect("oracle conjugate");
            let actual = tables.conjugate(&cube, symmetry as u8);
            assert_eq!(actual, expected, "conjugate {id} {symmetry}");
            assert_eq!(
                class(&data, &tables, &actual) >> 6,
                corner_class >> 6,
                "corner class {id} {symmetry}"
            );
            check_fast_slow(&tables, &actual, id);
            fast_slow += 2;
        }
        // Independent direct rank calculation from the WASM-produced
        // canonical conjugate, rather than Rust's conjugation or SIMD.
        let canonical =
            Cube::from_bytes(&hex::<20>(fields[3 + (corner_class & 63) as usize])).unwrap();
        let identities: Vec<_> = canonical.edges.iter().map(|e| e >> 1).collect();
        let outer: u16 = identities
            .iter()
            .enumerate()
            .filter(|(_, e)| **e >= 8)
            .map(|(i, _)| 1 << i)
            .sum();
        let inner: u8 = identities
            .iter()
            .filter(|e| **e < 8)
            .enumerate()
            .filter(|(_, e)| **e >= 4)
            .map(|(i, _)| 1 << i)
            .sum();
        let offset = 6_688 + separation_delta + 2 * (outer & 2047) as usize;
        let outer_rank = u16::from_le_bytes(data[offset..offset + 2].try_into().unwrap());
        let inner_rank = data[6_560 + separation_delta + (inner & 127) as usize];
        let eo: u16 = canonical.edges[..11]
            .iter()
            .enumerate()
            .map(|(position, edge)| u16::from(edge & 1) << position)
            .sum();
        let reference = ((u64::from(corner_class >> 6) * 70 + u64::from(inner_rank))
            << (9 + eo_bits))
            | (u64::from(eo >> (11 - eo_bits)) << 9)
            | u64::from(outer_rank);
        let normal = tables.index64(&cube);
        let inverse = tables.index64(&cube.inverse());
        assert_eq!(normal, reference, "independent coordinate {id}");
        assert_eq!(
            normal,
            fields[52].parse::<u64>().unwrap(),
            "WASM hot normal {id}"
        );
        assert_eq!(
            inverse,
            fields[53].parse::<u64>().unwrap(),
            "WASM hot inverse {id}"
        );
        if variant == 1 {
            // Keep both original Opt1 u32 APIs in the regression surface.
            assert_eq!(u64::from(tables.index(&cube)), normal);
            assert_eq!(u64::from(tables.index_slow(&cube)), normal);
        }
        for index in [normal, inverse] {
            assert!(
                index < tables.coordinate_count(),
                "coordinate out of range {id}"
            );
            max_index = max_index.max(index);
            wide_indices += usize::from(index > u64::from(u32::MAX));
        }
        states += 1;
    }
    assert_eq!(states, 407, "complete fixed oracle corpus required");
    assert_eq!(tables.index64(&Cube::SOLVED), 2);
    assert_eq!(fast_slow, 54_538);
    if variant >= 6 {
        assert!(
            wide_indices > 0,
            "corpus must exercise u64 indices beyond u32"
        );
    } else {
        assert_eq!(wide_indices, 0);
    }
    #[cfg(not(target_arch = "x86_64"))]
    let coordinate_backend = if cfg!(target_arch = "aarch64") {
        "neon"
    } else {
        "scalar"
    };
    #[cfg(target_arch = "x86_64")]
    let coordinate_backend = cube48opt_research::x86_simd::initialize().unwrap().name();
    #[cfg(not(target_arch = "x86_64"))]
    let paired_backend = if cfg!(all(feature = "neon-moves", target_arch = "aarch64")) {
        "neon"
    } else {
        "scalar"
    };
    #[cfg(target_arch = "x86_64")]
    let paired_backend = cube48opt_research::x86_simd::initialize().unwrap().name();
    println!("{{\"variant\":{variant},\"states\":{states},\"conjugates\":{},\"inverseMoveIdentities\":{},\"coordinateReference\":{states},\"fastScalarCoordinates\":{fast_slow},\"originalHotQueryIndices\":{},\"pairedMoveStates\":{},\"pairedMoveBackend\":\"{paired_backend}\",\"coordinateBackend\":\"{coordinate_backend}\",\"maxObservedIndex\":{max_index},\"indicesAboveU32\":{wide_indices},\"solvedIndex\":2,\"allEqual\":true}}", states * 48, states * 18, states * 2, states * 18);
}

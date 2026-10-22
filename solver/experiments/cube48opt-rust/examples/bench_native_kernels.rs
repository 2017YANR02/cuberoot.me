//! Bounded CPU-kernel comparison, not a solver/throughput benchmark. No PDB.
use cube48opt_research::{coord::{snapshot_bytes, CoordTables}, cube::{moved_pair, Cube}, opt10::Opt10Coordinates};
use std::{hint::black_box, io::Read, time::Instant};

fn measure_coordinates(corpus: &[(Cube, Cube, u8)], index: impl Fn(&Cube) -> u64, digest: &mut u64) -> u128 {
    let started = Instant::now();
    for _ in 0..128 {
        for (cube, _, _) in corpus {
            *digest = digest.wrapping_add(black_box(index(black_box(cube))));
        }
    }
    started.elapsed().as_nanos()
}

fn main() {
    let args: Vec<_> = std::env::args().collect();
    assert!(args.len() == 3 || (args.len() == 5 && args[3] == "--passes" && args[4] == "1"),
        "bench_native_kernels VARIANT SMALL_MEMORY [--passes 1]; Opt10 uses the Opt9 small snapshot");
    let variant: u8 = args[1].parse().unwrap();
    assert!((1..=10).contains(&variant), "Expected Opt1–10");
    let snapshot_variant = if variant == 10 { 9 } else { variant };
    let expected_bytes = snapshot_bytes(snapshot_variant).unwrap();
    let file = std::fs::File::open(&args[2]).unwrap();
    assert_eq!(file.metadata().unwrap().len(), expected_bytes as u64, "Expected a small snapshot, not a PDB");
    let mut snapshot = Vec::with_capacity(expected_bytes);
    file.take(expected_bytes as u64 + 1).read_to_end(&mut snapshot).unwrap();
    assert_eq!(snapshot.len(), expected_bytes, "Small snapshot size changed");
    // Initialization and deterministic input construction are outside timing.
    // There is one measured pass per kernel, with no discarded warmup pass.
    #[cfg(target_arch = "x86_64")]
    let backend = cube48opt_research::x86_simd::initialize().unwrap().name();
    #[cfg(not(target_arch = "x86_64"))]
    let backend = std::env::consts::ARCH;
    let tables = (variant != 10).then(|| CoordTables::from_variant_bytes(&snapshot, variant).unwrap());
    let opt10 = (variant == 10).then(|| Opt10Coordinates::from_opt9_snapshot(&snapshot).unwrap());
    let mut cube = Cube::SOLVED;
    let mut seed = 0x12345678u32;
    let mut corpus = Vec::new();
    for _ in 0..4096 {
        seed ^= seed << 13; seed ^= seed >> 17; seed ^= seed << 5;
        cube = cube.moved((seed % 18) as u8);
        corpus.push((cube, cube.inverse(), (seed % 18) as u8));
    }
    let mut digest = 0u64;
    let started = Instant::now();
    for _ in 0..128 {
        for (cube, inverse, movement) in &corpus {
            let (normal, inverse) = moved_pair(black_box(cube), black_box(inverse), black_box(*movement));
            digest = digest.wrapping_add(black_box(normal.corners[0] as u64 + inverse.edges[0] as u64));
        }
    }
    let moves_ns = started.elapsed().as_nanos();
    let coordinates_ns = if let Some(tables) = tables {
        measure_coordinates(&corpus, |cube| tables.index64(cube), &mut digest)
    } else {
        let tables = opt10.unwrap();
        measure_coordinates(&corpus, |cube| tables.index(cube), &mut digest)
    };
    println!("{{\"backend\":\"{backend}\",\"variant\":{variant},\"iterations\":524288,\"movesNs\":{moves_ns},\"coordinatesNs\":{coordinates_ns},\"digest\":{digest},\"passes\":1,\"warmupPasses\":0,\"pdbLoaded\":false}}");
}

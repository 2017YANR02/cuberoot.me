//! Bounded CPU-kernel comparison, not a solver/throughput benchmark. No PDB.
use cube48opt_research::{coord::CoordTables, cube::{moved_pair, Cube}};
use std::{hint::black_box, time::Instant};

fn main() {
    let args: Vec<_> = std::env::args().collect();
    assert_eq!(args.len(), 3, "bench_native_kernels VARIANT SMALL_MEMORY");
    let variant = args[1].parse().unwrap();
    let tables = CoordTables::from_variant_bytes(&std::fs::read(&args[2]).unwrap(), variant).unwrap();
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
    let started = Instant::now();
    for _ in 0..128 {
        for (cube, _, _) in &corpus {
            digest = digest.wrapping_add(black_box(tables.index64(black_box(cube))));
        }
    }
    let coordinates_ns = started.elapsed().as_nanos();
    #[cfg(target_arch = "x86_64")]
    let backend = cube48opt_research::x86_simd::initialize().unwrap().name();
    #[cfg(not(target_arch = "x86_64"))]
    let backend = std::env::consts::ARCH;
    println!("{{\"backend\":\"{backend}\",\"variant\":{variant},\"iterations\":524288,\"movesNs\":{moves_ns},\"coordinatesNs\":{coordinates_ns},\"digest\":{digest}}}");
}

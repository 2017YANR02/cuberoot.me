//! Small native exact HTR/FR quotient export. No table manager, mmap or disk-table load.
//! CLI: dist_htr_fr htr-dr|fr-htr OUTPUT.bin
//! The caller must use the serial small-distribution resource guard.
use cube_solver::fr_solver::FrSolver;
use cube_solver::htr_solver::HtrSolver;
use std::fs::{self, OpenOptions};
use std::io::{BufWriter, Write};
use std::path::PathBuf;
use std::time::Instant;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let args: Vec<String> = std::env::args().skip(1).collect();
    if args.len() != 2 || !matches!(args[0].as_str(), "htr-dr" | "fr-htr") {
        return Err("usage: dist_htr_fr htr-dr|fr-htr OUTPUT.bin".into());
    }
    let path = PathBuf::from(&args[1]);
    if path.exists() {
        return Err("completed native table exists; do not recompute".into());
    }
    let temporary = path.with_extension("bin.part");
    let file = OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&temporary)?;
    let started = Instant::now();
    eprintln!(
        "{{\"event\":\"{}\",\"phase\":\"native-small-coordinate\"}}",
        args[0]
    );
    let (distance, transitions, moves, root, weight, physical_count, expected_god) =
        if args[0] == "htr-dr" {
            let solver = HtrSolver::new();
            let (distance, transitions, moves, root) = solver.exact_distribution_tables();
            (
                distance,
                transitions,
                moves,
                root,
                663_552u32,
                19_508_428_800u64,
                13u8,
            )
        } else {
            let (distance, transitions, moves, root) = FrSolver::exact_distribution_tables();
            (distance, transitions, moves, root, 192u32, 663_552u64, 11u8)
        };
    assert_eq!(distance.len() as u64 * weight as u64, physical_count);
    assert_eq!(transitions.len(), distance.len() * moves.len());
    assert_eq!(distance.iter().filter(|&&d| d == 0).count(), 1);
    assert_eq!(distance[root], 0);
    assert_eq!(*distance.iter().max().unwrap(), expected_god);
    let mut histogram = vec![0usize; expected_god as usize + 1];
    for (state, &depth) in distance.iter().enumerate() {
        assert_ne!(depth, 255);
        histogram[depth as usize] += 1;
        let mut descending = depth == 0;
        for &next in &transitions[state * moves.len()..(state + 1) * moves.len()] {
            let next = next as usize;
            assert!(next < distance.len());
            assert!(distance[next].abs_diff(depth) <= 1);
            descending |= distance[next] + 1 == depth;
        }
        assert!(descending, "non-goal quotient has no descending edge");
    }
    // Header: magic, states, moves, identity coordinate, uniform physical weight,
    // physical state count; then move ids, u8 distances and row-major u32LE edges.
    let mut writer = BufWriter::new(file);
    writer.write_all(b"CUBEXD01")?;
    for value in [
        distance.len() as u32,
        moves.len() as u32,
        root as u32,
        weight,
    ] {
        writer.write_all(&value.to_le_bytes())?;
    }
    writer.write_all(&physical_count.to_le_bytes())?;
    writer.write_all(&moves)?;
    writer.write_all(&distance)?;
    for value in &transitions {
        writer.write_all(&value.to_le_bytes())?;
    }
    writer.flush()?;
    writer.get_ref().sync_all()?;
    fs::rename(temporary, path)?;
    println!("{{\"event\":\"{}\",\"nativeElapsedMs\":{},\"coordinateCount\":{},\"physicalStatesPerCoordinate\":{},\"physicalStateCount\":{},\"god\":{},\"histogram\":{:?},\"complete\":true}}",
        args[0], started.elapsed().as_secs_f64() * 1000.0, distance.len(), weight, physical_count, expected_god, histogram);
    Ok(())
}

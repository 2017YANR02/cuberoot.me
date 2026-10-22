use cube48opt_research::{
    corner_symmetry::{full_corner_unrank, CornerSymmetries, FULL_CORNER_COUNT},
    corner_symmetry::dense::DenseCornerPdb,
    cube::Cube,
};
use std::{hint::black_box, io::{self, Write}, path::Path, time::Instant};

pub fn compare(path: &Path) -> Result<(), String> {
    let symmetries = CornerSymmetries::new()?;
    let dense96 = DenseCornerPdb::load_and_verify(path, &symmetries)?;
    let dense48 = DenseCornerPdb::spatial_from_certified(&dense96, &symmetries)?;
    let prepared48 = dense48.prepare_lookup(&symmetries)?;
    let prepared96 = dense96.prepare_lookup(&symmetries)?;
    println!("{{\"kind\":\"corner-layouts\",\"spatial48_orbits\":{},\"spatial96_orbits\":{},\"permutation48_orbits\":{},\"permutation96_orbits\":{},\"dense48_bytes\":{},\"dense96_bytes\":{},\"prepared48_bytes\":{},\"prepared96_bytes\":{}}}",
        dense48.len(), dense96.len(), dense48.index().permutation_orbits(), dense96.index().permutation_orbits(),
        dense48.memory_bytes(), dense96.memory_bytes(), prepared48.memory_bytes(), prepared96.memory_bytes());
    io::stdout().flush().map_err(|e| e.to_string())?;

    // Complete equality check, including all orientations and both permutation
    // parities. These APIs deliberately ignore the artificial edge completion.
    let mut histogram = [0u64; 12];
    let mut start = 0;
    for rank in 0..FULL_CORNER_COUNT {
        let cube = full_corner_unrank(rank as u32)?;
        let expected = dense96.distance(&cube, &symmetries)?;
        if dense48.distance(&cube, &symmetries)? != expected
            || prepared48.distance(&cube) != expected || prepared96.distance(&cube) != expected {
            return Err(format!("corner layouts disagree at raw rank {rank}"));
        }
        histogram[expected as usize] += 1;
        if (rank + 1) % 1_048_576 == 0 || rank + 1 == FULL_CORNER_COUNT {
            println!("{{\"kind\":\"layout-equality-range\",\"start\":{start},\"end\":{},\"passed\":true}}", rank + 1);
            io::stdout().flush().map_err(|e| e.to_string())?;
            start = rank + 1;
        }
    }
    println!("{{\"kind\":\"layout-equality-complete\",\"states\":{FULL_CORNER_COUNT},\"histogram\":{:?}}}", histogram);

    // One measured pass per layout, with the same 4M distinct deterministic
    // inputs. The multiplier is coprime to 8!*3^7, hence there are no duplicates.
    // No setup/certification is timed. This is a warm-table lookup microbenchmark,
    // not a search benchmark and not a sample of actual search visitation.
    const SAMPLES: usize = 4_194_304;
    const MULTIPLIER: u64 = 2_654_435_761;
    let mut inputs = Vec::new();
    inputs.try_reserve_exact(SAMPLES).map_err(|e| e.to_string())?;
    let mut expected_checksum = 0u64;
    for i in 0..SAMPLES {
        let rank = (i as u64 * MULTIPLIER + 1_013_904_223) % FULL_CORNER_COUNT as u64;
        let cube = full_corner_unrank(rank as u32)?;
        expected_checksum += u64::from(prepared96.distance(&cube));
        inputs.push(cube);
    }
    fn measure(label: &str, inputs: &[Cube], expected: u64, mut lookup: impl FnMut(&Cube) -> u8) -> Result<(), String> {
        let start = Instant::now();
        let mut checksum = 0u64;
        for cube in inputs { checksum += u64::from(black_box(lookup(black_box(cube)))); }
        let seconds = start.elapsed().as_secs_f64();
        if checksum != expected { return Err(format!("{label} lookup checksum changed")); }
        println!("{{\"kind\":\"layout-query-benchmark\",\"layout\":\"{label}\",\"queries\":{},\"passes\":1,\"seconds\":{seconds:.9},\"checksum\":{checksum}}}", inputs.len());
        io::stdout().flush().map_err(|e| e.to_string())?;
        Ok(())
    }
    measure("dense48", &inputs, expected_checksum, |c| dense48.distance(c, &symmetries).expect("verified legal corner"))?;
    measure("dense96", &inputs, expected_checksum, |c| dense96.distance(c, &symmetries).expect("verified legal corner"))?;
    measure("prepared48", &inputs, expected_checksum, |c| prepared48.distance(c))?;
    measure("prepared96", &inputs, expected_checksum, |c| prepared96.distance(c))?;
    Ok(())
}

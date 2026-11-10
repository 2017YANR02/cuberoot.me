//! Local preparation: upstream's h10-to-h8 collapse, with no separate table scan.
use egg_solver::tables::{file, h48_bytes, H48Table};
use std::{fs::OpenOptions, io::Write};

fn main() -> anyhow::Result<()> {
    let args: Vec<_> = std::env::args().skip(1).collect();
    anyhow::ensure!(args.len() == 2, "usage: cuberoot-derive-h8 H10 NEW_H8");
    let meta = file::read_trailer(&args[0])?.ok_or_else(|| anyhow::anyhow!("missing h10 trailer"))?;
    anyhow::ensure!(meta.k == 10 && meta.base == 10, "expected existing h10/base10");
    anyhow::ensure!(std::fs::metadata(&args[0])?.len() == file::file_bytes(h48_bytes(10), false), "wrong h10 size");
    let started = std::time::Instant::now();
    let source = H48Table::open_copy(&args[0])?;
    let table = egg_solver::gen::collapse::derive(&source, 8, 18)?;
    drop(source);
    let trailer = file::Trailer {k: 8, base: 10, data_bytes: h48_bytes(8), distribution: None, checksum: None}.to_bytes();
    let mut output = OpenOptions::new().write(true).create_new(true).open(&args[1])?;
    output.write_all(table.data()?)?;
    output.write_all(&trailer)?;
    output.sync_all()?;
    println!("{}", serde_json::json!({"sourceK":10,"k":8,"base":10,"seconds":started.elapsed().as_secs_f64(),"bytes":h48_bytes(8)+4096}));
    Ok(())
}

//! 生成浏览器 First Face / First Layer 求解器的预构建 bundle。
//!
//! 用法：cargo run --release --bin dump_first_layer_tables -- [output]
//! 默认写入 tables/opt_first_layer.bin；再由 build_wasm.ps1 gzip。

use std::fs::File;
use std::io::{BufWriter, Write};
use std::path::PathBuf;

use cube_solver::first_layer_solver::{FirstLayerSolver, FIRST_LAYER_PRECOMPUTED_BYTES};

fn main() -> std::io::Result<()> {
    let output = std::env::args_os()
        .nth(1)
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from("tables").join("opt_first_layer.bin"));
    if let Some(parent) = output.parent() {
        std::fs::create_dir_all(parent)?;
    }

    let solver = FirstLayerSolver::new();
    let file = File::create(&output)?;
    let mut writer = BufWriter::new(file);
    solver.write_precomputed(&mut writer)?;
    writer.flush()?;
    let actual = std::fs::metadata(&output)?.len() as usize;
    if actual != FIRST_LAYER_PRECOMPUTED_BYTES {
        return Err(std::io::Error::other(format!(
            "bundle length {actual} != expected {FIRST_LAYER_PRECOMPUTED_BYTES}"
        )));
    }
    eprintln!("[INFO] wrote {} bytes to {}", actual, output.display());
    Ok(())
}

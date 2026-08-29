//! Explicit generator for the optional 64 GB-class table profile.
//!
//! This binary is intentionally separate from `table_generator`: invoking the
//! default generator on the current 32 GB machine must keep its old table set.

use std::io::Write;
use std::time::Instant;

use cube_solver::{move_tables, prune_tables};

fn step(name: &str, f: impl FnOnce()) {
    let started = Instant::now();
    eprint!("[GEN high-memory] {:<42} ", name);
    let _ = std::io::stderr().flush();
    f();
    eprintln!("done in {:>6.1}s", started.elapsed().as_secs_f64());
}

fn main() {
    if std::env::var("CUBE_TABLE_PROFILE").ok().as_deref() != Some("high-memory") {
        panic!(
            "refusing to generate optional tables without CUBE_TABLE_PROFILE=high-memory"
        );
    }

    let threads = std::env::var("RAYON_NUM_THREADS")
        .ok()
        .and_then(|v| v.parse::<usize>().ok())
        .unwrap_or(14)
        .clamp(1, 14);
    std::env::set_var("RAYON_NUM_THREADS", threads.to_string());
    std::env::set_var("CUBE_ALLOW_HUGE_TABLES", "1");

    cube_solver::logo::print_logo_block();
    eprintln!("[INFO] profile = high-memory; rayon threads = {threads}");
    eprintln!(
        "[INFO] generating four physical-slot EO XCross tables sequentially; each packed file is 2,335,703,056 bytes"
    );
    if let Ok(dir) = std::env::var("CUBE_TABLE_DIR") {
        eprintln!("[INFO] CUBE_TABLE_DIR = {dir}");
    } else {
        eprintln!("[INFO] CUBE_TABLE_DIR not set; using ./tables/");
    }

    let started = Instant::now();
    let mtm = move_tables::instance();
    let ptm = prune_tables::instance();

    step("mt_ep5_high_memory", || {
        mtm.ensure_ep5_high_memory();
    });
    for slot in 0..4 {
        step(&format!("pt_eo_xcross_slot{slot}_high_memory"), || {
            ptm.ensure_pt_eo_xcross_high_memory(slot);
            ptm.release_pt_eo_xcross_high_memory(slot);
        });
    }
    mtm.release_ep5_high_memory();

    eprintln!(
        "[DONE] optional high-memory tables generated in {:.1}s",
        started.elapsed().as_secs_f64()
    );
}

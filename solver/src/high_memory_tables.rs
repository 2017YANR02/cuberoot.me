//! Shared sequential generator for the optional high-memory table profile.

use std::io::Write;
use std::time::Instant;

use crate::{move_tables, prune_tables, table_profile};

fn step(name: &str, f: impl FnOnce()) {
    let started = Instant::now();
    eprint!("[GEN high-memory] {:<42} ", name);
    let _ = std::io::stderr().flush();
    f();
    eprintln!("done in {:>6.1}s", started.elapsed().as_secs_f64());
}

pub fn generate() {
    assert!(
        table_profile::high_memory_enabled(),
        "high-memory table generation requires a detected 64 GB-class machine or CUBE_TABLE_PROFILE=high-memory"
    );

    let started = Instant::now();
    let mtm = move_tables::instance();
    let ptm = prune_tables::instance();

    eprintln!(
        "[INFO] generating four physical-slot EO XCross tables sequentially; each packed file is 2,335,703,056 bytes"
    );
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

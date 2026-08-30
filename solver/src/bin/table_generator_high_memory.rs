//! Dedicated generator for the optional 64 GB-class table profile.
//!
//! This binary is intentionally separate from `table_generator`: invoking the
//! default generator on the current 32 GB machine keeps its old table set.

use cube_solver::{high_memory_tables, table_profile};

fn main() {
    let profile = table_profile::selection();
    if !profile.high_memory() {
        panic!(
            "refusing to generate optional tables: detected profile is {}; use a 64 GB-class machine or set CUBE_TABLE_PROFILE=high-memory",
            profile.profile.as_str()
        );
    }

    let threads = table_profile::configure_rayon_threads(14);
    std::env::set_var("CUBE_ALLOW_HUGE_TABLES", "1");

    cube_solver::logo::print_logo_block();
    eprintln!(
        "[INFO] profile = high-memory; source = {}; rayon threads = {threads}",
        profile.source.as_str()
    );
    if let Ok(dir) = std::env::var("CUBE_TABLE_DIR") {
        eprintln!("[INFO] CUBE_TABLE_DIR = {dir}");
    } else {
        eprintln!("[INFO] CUBE_TABLE_DIR not set; using ./tables/");
    }

    high_memory_tables::generate();
}

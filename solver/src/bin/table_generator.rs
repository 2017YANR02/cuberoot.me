//! table_generator binary:对应 C++ `table_generator.cpp`。
//!
//! 顺序生成默认 move tables (12 张) + prune tables (61 张)，以及默认
//! F2LEO compact、Pair 首阶段与 F2B Middle 表；自动启用
//! `CUBE_ALLOW_HUGE_TABLES=1`(可通过 `CUBE_DISABLE_HUGE_TABLES=1` 关闭)。
//! 64 GB-class 机器自动追加 EO XCross 5 张、SQ1 精确表及原生 H48 h10。
//!
//! 已存在的表跳过(各 manager 内部 mmap reload)。
//!
//! 原默认 73 张实测 36.14 GB；F2LEO compact 另加约 101.5 MiB，
//! Pair 首阶段另加约 52.2 MiB，F2B Middle 另加约 1.524 GiB；
//! high-memory 档另加 9.35 GB。DeepSeven 始终仅显式生成。

use std::io::Write;
use std::sync::{
    atomic::{AtomicBool, Ordering},
    OnceLock,
};
use std::time::Instant;

static SELECTED_TABLE: OnceLock<String> = OnceLock::new();
static MATCHED_TABLE: AtomicBool = AtomicBool::new(false);

const USAGE: &str = "usage: table_generator [--only rust|sq1|h48-h7|h48-h9|h48-h10] [--table exact_file_stem (rust only)] [--resume (explicit stage checkpoint only)]";

fn parse_args(args: &[String]) -> Result<(&str, Option<&str>, bool), &'static str> {
    let (only, table, resume) = match args {
        [] => ("all", None, false),
        [flag, value] if flag == "--only" => (value.as_str(), None, false),
        [flag, value, table_flag, table]
            if flag == "--only" && value == "rust" && table_flag == "--table" =>
        {
            (
                "rust",
                Some(table.strip_suffix(".bin").unwrap_or(table)),
                false,
            )
        }
        [flag, value, table_flag, table, resume]
            if flag == "--only"
                && value == "rust"
                && table_flag == "--table"
                && resume == "--resume" =>
        {
            (
                "rust",
                Some(table.strip_suffix(".bin").unwrap_or(table)),
                true,
            )
        }
        _ => return Err(USAGE),
    };
    if !["all", "rust", "sq1", "h48-h7", "h48-h9", "h48-h10"].contains(&only) {
        return Err("unknown --only target");
    }
    if resume && !matches!(table, Some("pt_C4C5C6C7E0E1E2E3" | "pt_cross_C4C6E0E1E2")) {
        return Err(
            "--resume requires --only rust --table pt_C4C5C6C7E0E1E2E3|pt_cross_C4C6E0E1E2",
        );
    }
    Ok((only, table, resume))
}

use cube_solver::move_tables;
use cube_solver::prune_tables;
use cube_solver::{high_memory_tables, sq1_solver::Sq1WcaSolver, table_profile, table_timing};

#[path = "../h48_native.rs"]
mod h48_native;

fn step(name: &str, f: impl FnOnce()) {
    let table = name.split_whitespace().next().unwrap_or(name);
    if SELECTED_TABLE
        .get()
        .is_some_and(|selected| selected != table)
    {
        return;
    }
    MATCHED_TABLE.store(true, Ordering::Relaxed);
    let path = move_tables::table_path(&format!("{table}.bin"));
    let before = std::fs::metadata(&path).ok();
    let t = Instant::now();
    eprint!("[GEN] {:<35} ", name);
    let _ = std::io::stderr().flush();
    f();
    let elapsed = t.elapsed();
    eprintln!("done in {:>6.1}s", elapsed.as_secs_f64());
    let after = std::fs::metadata(&path).ok();
    let size = after.as_ref().map(|m| m.len()).unwrap_or(0);
    let unchanged = before
        .as_ref()
        .zip(after.as_ref())
        .is_some_and(|(a, b)| a.len() == b.len() && a.modified().ok() == b.modified().ok());
    table_timing::record(
        table,
        elapsed,
        size,
        if unchanged { "skipped" } else { "generated" },
    );
}

fn stage_table(kind: cube_solver::stage_joint_table::JointKind, threads: usize, resume: bool) {
    use cube_solver::stage_joint_table::{self, GenerationOptions, JointKind};
    let spec = kind.spec();
    let name = spec.filename.trim_end_matches(".bin");
    step(name, || {
        let path = move_tables::table_path(spec.filename);
        assert!(
            !resume || !path.exists(),
            "--resume requires an unpublished .bin.part checkpoint; published table is preserved"
        );
        let report = if path.exists() {
            stage_joint_table::verify_file(&path, kind)
        } else {
            let options = GenerationOptions {
                threads,
                max_depth: 14,
                max_transitions: if kind == JointKind::MiddleFour {
                    80_000_000_000
                } else {
                    2_500_000_000_000
                },
                resume,
            };
            stage_joint_table::generate(&path, kind, &options, |p| {
                eprintln!("[STAGE-PDB] {name} {p:?}");
                Ok(())
            })
        }
        .expect("joint stage table generation failed");
        eprintln!("[STAGE-PDB] {name} {report:?}");
    });
}

fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let (only, table, resume) = parse_args(&args).unwrap_or_else(|error| panic!("{error}"));
    if let Some(table) = table {
        SELECTED_TABLE.set(table.to_owned()).unwrap();
    }
    let rayon_threads = rayon::current_num_threads();
    cube_solver::logo::print_logo_block();

    let disable_huge = std::env::var("CUBE_DISABLE_HUGE_TABLES")
        .map(|v| v == "1")
        .unwrap_or(false);
    if !disable_huge {
        std::env::set_var("CUBE_ALLOW_HUGE_TABLES", "1");
        eprintln!(
            "[INFO] huge tables enabled (~36 GB for all 73 default tables). \
             Set CUBE_DISABLE_HUGE_TABLES=1 to skip ≥800 MB tables."
        );
    } else {
        eprintln!("[INFO] huge tables skipped (CUBE_DISABLE_HUGE_TABLES=1).");
    }
    if let Ok(dir) = std::env::var("CUBE_TABLE_DIR") {
        eprintln!("[INFO] CUBE_TABLE_DIR = {}", dir);
    } else {
        eprintln!("[INFO] CUBE_TABLE_DIR not set; using ./tables/");
    }

    let t0 = Instant::now();
    let profile = table_profile::selection();
    let detected_memory = profile
        .total_memory_bytes
        .map(|bytes| format!("{:.1} GiB", bytes as f64 / 1024_f64.powi(3)))
        .unwrap_or_else(|| "unknown".to_string());
    eprintln!(
        "[INFO] table profile = {} (source: {}; physical memory: {}; rayon threads: {})",
        profile.profile.as_str(),
        profile.source.as_str(),
        detected_memory,
        rayon_threads
    );

    if only == "sq1" || only == "h48-h7" || only == "h48-h9" || only == "h48-h10" {
        assert!(
            profile.high_memory(),
            "large-table generation requires a high-memory profile"
        );
    }
    if !disable_huge && profile.high_memory() && (only == "all" || only == "sq1") {
        eprintln!("\n=== SQ1 WCA exact phase-2 table ===");
        let started = Instant::now();
        let monitoring = std::sync::Arc::new(std::sync::atomic::AtomicBool::new(true));
        let monitor_flag = monitoring.clone();
        let memory_monitor = std::thread::spawn(move || {
            let mut peak = 0u64;
            while monitor_flag.load(std::sync::atomic::Ordering::Relaxed) {
                peak = peak.max(h48_native::resident_bytes(std::process::id()).unwrap_or(0));
                std::thread::sleep(std::time::Duration::from_millis(250));
            }
            peak
        });
        let generated =
            Sq1WcaSolver::generate_jsq_full_table().expect("SQ1 full-table generation failed");
        monitoring.store(false, std::sync::atomic::Ordering::Relaxed);
        let peak = memory_monitor.join().unwrap_or(0);
        let elapsed = started.elapsed();
        table_timing::record(
            "sq1_wca_jsqfull",
            elapsed,
            std::fs::metadata(move_tables::table_path("sq1_wca_jsqfull.bin"))
                .map(|m| m.len())
                .unwrap_or(0),
            if generated { "generated" } else { "skipped" },
        );
        table_timing::record_peak("sq1_wca_jsqfull", peak);
        eprintln!(
            "[SQ1] peak generator RSS: {peak} bytes ({:.2} GiB)",
            peak as f64 / 1024_f64.powi(3)
        );
        eprintln!(
            "[GEN] sq1_wca_jsqfull done in {:.1}s",
            elapsed.as_secs_f64()
        );
    }
    if !disable_huge
        && profile.high_memory()
        && (only == "all" || only == "h48-h7" || only == "h48-h9" || only == "h48-h10")
    {
        let dataid = match only {
            "h48-h7" => "h48h7",
            "h48-h9" => "h48h9",
            _ => "h48h10",
        };
        eprintln!("\n=== H48 {dataid} native table (57 GiB RSS alarm) ===");
        let started = Instant::now();
        let (generated, peak, bytes) = match h48_native::generate(rayon_threads, dataid) {
            Ok(result) => result,
            Err(error) => {
                table_timing::record(dataid, started.elapsed(), 0, "failed");
                panic!("H48 {dataid} generation failed: {error}");
            }
        };
        let elapsed = started.elapsed();
        table_timing::record(
            dataid,
            elapsed,
            bytes,
            if generated { "generated" } else { "skipped" },
        );
        table_timing::record_peak(dataid, peak);
        eprintln!("[GEN] {dataid} done in {:.1}s", elapsed.as_secs_f64());
    }
    if only == "sq1" || only == "h48-h7" || only == "h48-h9" || only == "h48-h10" {
        return;
    }

    // Explicit new-PDB requests stay on the unified entry without touching the
    // default table managers or generating unrelated huge tables.
    if only == "rust" {
        if let Some(selected) = SELECTED_TABLE.get() {
            for kind in cube_solver::pair_joint_table::ALL_KINDS {
                let name = kind.file_name().trim_end_matches(".bin");
                if selected == name {
                    step(name, || {
                        let report = cube_solver::pair_joint_table::generate(
                            kind,
                            &move_tables::table_dir(),
                        )
                        .expect("joint Pair table generation failed");
                        eprintln!("{report:?}");
                    });
                    return;
                }
            }
            let name = cube_solver::f2leo_compact_table::FILE_NAME.trim_end_matches(".bin");
            if selected == name {
                step(name, || {
                    let report = cube_solver::f2leo_compact_table::generate_or_verify(
                        &move_tables::table_path(cube_solver::f2leo_compact_table::FILE_NAME),
                    )
                    .expect("compact F2LEO table generation failed");
                    eprintln!("{report:?}");
                });
                return;
            }
            for kind in [
                cube_solver::stage_joint_table::JointKind::MiddleFour,
                cube_solver::stage_joint_table::JointKind::DeepSeven,
            ] {
                let name = kind.spec().filename.trim_end_matches(".bin");
                if selected == name {
                    stage_table(kind, rayon_threads, resume);
                    return;
                }
            }
        }
    }

    let mtm = move_tables::instance();
    let ptm = prune_tables::instance();

    eprintln!("\n=== Move tables (12) ===");
    step("mt_edge", || {
        mtm.ensure_edge();
    });
    step("mt_corn", || {
        mtm.ensure_corn();
    });
    step("mt_edge2", || {
        mtm.ensure_edge2();
    });
    step("mt_edge3", || {
        mtm.ensure_edge3();
    });
    step("mt_edge4", || {
        mtm.ensure_edge4();
    });
    step("mt_corn2", || {
        mtm.ensure_corn2();
    });
    step("mt_corn3", || {
        mtm.ensure_corn3();
    });
    step("mt_eo12", || {
        mtm.ensure_eo12();
    });
    step("mt_eo12_alt", || {
        mtm.ensure_eo12_alt();
    });
    step("mt_ep1", || {
        mtm.ensure_ep1();
    });
    step("mt_ep4", || {
        mtm.ensure_ep4();
    });
    if !disable_huge {
        step("mt_edge6 [HUGE ~3GB]", || {
            mtm.ensure_edge6();
        });
    } else {
        eprintln!("[SKIP] mt_edge6 (huge)");
    }

    eprintln!("\n=== Prune tables: small/medium ===");
    step("pt_cross", || {
        ptm.ensure_pt_cross();
    });
    step("pt_cross_ins_C4", || {
        ptm.ensure_pt_cross_ins_c4();
    });
    step("pt_pair_C4E0", || {
        ptm.ensure_pt_pair_c4e0();
    });
    step("pt_cross_C4E0", || {
        ptm.ensure_pt_cross_c4e0();
    });
    step("pt_pscross", || {
        ptm.ensure_pt_pscross();
    });
    step("pt_pscross_E0E1", || {
        ptm.ensure_pt_pscross_e0e1();
    });
    step("pt_pscross_E0E2", || {
        ptm.ensure_pt_pscross_e0e2();
    });
    step("pt_pscross_C4C5", || {
        ptm.ensure_pt_pscross_c4c5();
    });
    step("pt_pscross_C4C6", || {
        ptm.ensure_pt_pscross_c4c6();
    });
    step("pt_ep4eo12", || {
        ptm.ensure_pt_ep4eo12();
    });
    step("pt_cross_C4E0E1", || {
        ptm.ensure_pt_cross_c4e0e1();
    });
    step("pt_cross_C4E0E2", || {
        ptm.ensure_pt_cross_c4e0e2();
    });
    step("pt_cross_C4E0E3", || {
        ptm.ensure_pt_cross_c4e0e3();
    });
    step("pt_cross_C4C5E0", || {
        ptm.ensure_pt_cross_c4c5e0();
    });
    step("pt_cross_C4C6E0", || {
        ptm.ensure_pt_cross_c4c6e0();
    });
    step("pt_cross_C4C7E0", || {
        ptm.ensure_pt_cross_c4c7e0();
    });
    #[cfg(feature = "pair-joint-table")]
    {
        let kind = cube_solver::pair_joint_table::Kind::Pair;
        step(kind.file_name().trim_end_matches(".bin"), || {
            let report = cube_solver::pair_joint_table::generate(kind, &move_tables::table_dir())
                .expect("joint Pair table generation failed");
            eprintln!("{report:?}");
        });
    }
    #[cfg(feature = "f2leo-compact-table")]
    step(
        cube_solver::f2leo_compact_table::FILE_NAME.trim_end_matches(".bin"),
        || {
            let report = cube_solver::f2leo_compact_table::generate_or_verify(
                &move_tables::table_path(cube_solver::f2leo_compact_table::FILE_NAME),
            )
            .expect("compact F2LEO table generation failed");
            eprintln!("{report:?}");
        },
    );
    #[cfg(feature = "stage-joint-table")]
    if !disable_huge {
        stage_table(
            cube_solver::stage_joint_table::JointKind::MiddleFour,
            rayon_threads,
            false,
        );
    } else {
        eprintln!("[SKIP] pt_C4C5C6C7E0E1E2E3 (huge)");
    }

    eprintln!("\n=== Prune tables: indexed families ===");
    for i in 0..4 {
        step(&format!("pt_pscross_C4E{}", i), || {
            ptm.ensure_pt_pscross_c4e(i);
        });
    }
    for c in 0..4 {
        step(&format!("pt_pscross_C{}", c + 4), || {
            ptm.ensure_pt_pscross_c(c);
        });
    }
    for c in 0..4 {
        for e in 0..4 {
            step(&format!("pt_pscross_ins_C{}_diff{}", c + 4, e), || {
                ptm.ensure_pt_pscross_ins_c_diff(c, e);
            });
        }
    }
    for c in 0..4 {
        for e in 0..4 {
            step(&format!("pt_pspair_C{}_E{}", c + 4, e), || {
                ptm.ensure_pt_pspair_ce(c, e);
            });
        }
    }

    if !disable_huge {
        eprintln!("\n=== Prune tables: HUGE (≥800MB) ===");
        step("pt_pscross_E0E1E2 [~1GB]", || {
            ptm.ensure_pt_pscross_e0e1e2();
        });
        step("pt_pscross_C4C5C6 [~822MB]", || {
            ptm.ensure_pt_pscross_c4c5c6();
        });
        step("pt_cross_C4C5C6 [~1.2GB]", || {
            ptm.ensure_pt_cross_c4c5c6();
        });
        step("pt_cross_C4C5E0E1 [~10GB]", || {
            ptm.ensure_pt_cross_c4c5e0e1();
        });
        step("pt_cross_C4C6E0E2 [~10GB]", || {
            ptm.ensure_pt_cross_c4c6e0e2();
        });
    } else {
        eprintln!("\n[SKIP] 5 huge prune tables");
    }

    if !disable_huge && profile.high_memory() {
        eprintln!("\n=== High-memory profile: EO XCross (5) ===");
        if high_memory_tables::generate_selected(SELECTED_TABLE.get().map(String::as_str)) {
            MATCHED_TABLE.store(true, Ordering::Relaxed);
        }
    } else if disable_huge && profile.high_memory() {
        eprintln!("\n[SKIP] 5 high-memory tables (CUBE_DISABLE_HUGE_TABLES=1)");
    } else {
        eprintln!("\n[SKIP] 5 high-memory tables (default profile)");
    }

    assert!(
        MATCHED_TABLE.load(Ordering::Relaxed),
        "unknown or disabled Rust table: {:?}",
        SELECTED_TABLE.get()
    );
    eprintln!(
        "\n=== All tables ready in {:.1}s ({:.1} min) ===",
        t0.elapsed().as_secs_f64(),
        t0.elapsed().as_secs_f64() / 60.0,
    );
}

#[cfg(test)]
mod tests {
    use super::parse_args;

    fn args(values: &[&str]) -> Vec<String> {
        values.iter().map(|v| (*v).to_owned()).collect()
    }

    #[test]
    fn stage_resume_requires_explicit_exact_target() {
        for table in ["pt_C4C5C6C7E0E1E2E3", "pt_cross_C4C6E0E1E2.bin"] {
            let argv = args(&["--only", "rust", "--table", table, "--resume"]);
            let (only, selected, resume) = parse_args(&argv).unwrap();
            assert_eq!(only, "rust");
            assert_eq!(selected, Some(table.trim_end_matches(".bin")));
            assert!(resume);
        }
        for values in [
            vec!["--resume"],
            vec!["--only", "rust", "--resume"],
            vec!["--only", "h48-h11"],
            vec!["--only", "h48-h10", "--resume"],
            vec![
                "--only",
                "rust",
                "--table",
                "pt_C4C5C6C7E0E1E2E3.bin.bin",
                "--resume",
            ],
            vec!["--only", "rust", "--table", "pt_pair_all_joint", "--resume"],
            vec![
                "--only",
                "rust",
                "--table",
                "pt_cross_eo_E0E1E2E3",
                "--resume",
            ],
            vec![
                "--only",
                "rust",
                "--table",
                "pt_C4C5C6C7E0E1E2E3",
                "--resume",
                "extra",
            ],
        ] {
            assert!(parse_args(&args(&values)).is_err(), "accepted: {values:?}");
        }
    }

    #[test]
    fn default_and_explicit_new_generation_do_not_resume() {
        assert_eq!(parse_args(&[]).unwrap(), ("all", None, false));
        let argv = args(&["--only", "rust"]);
        assert_eq!(parse_args(&argv).unwrap(), ("rust", None, false));
        let argv = args(&["--only", "rust", "--table", "pt_C4C5C6C7E0E1E2E3"]);
        assert_eq!(
            parse_args(&argv).unwrap(),
            ("rust", Some("pt_C4C5C6C7E0E1E2E3"), false)
        );
    }
}

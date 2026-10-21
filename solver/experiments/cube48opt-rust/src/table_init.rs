//! User-facing table preparation; the pinned WASM generator remains the source.
use std::{
    env,
    io::{self, IsTerminal, Write},
    path::{Path, PathBuf},
    process::Command,
};

const TIERS: [&str; 9] = ["32M", "128M", "256M", "512M", "1G", "2G", "4G", "8G", "16G"];
pub const HELP: &str = "Prepare Opt1–9 tables once, then reuse them for native solving.

  cube48opt-research init                         Select a table size interactively
  cube48opt-research init --memory 2G              Build/reuse Opt6 tables
  cube48opt-research init --variant 6 --threads 4 --out ./tables/opt6

Table tiers: 32M, 128M, 256M, 512M, 1G, 2G, 4G, 8G, 16G.
These describe table capacity, not total process memory.
Default output: solver/tables/cubeopt/optN in this checkout.
Requires Node.js 24+ and this repository's pinned cubeopt WASM assets.
Existing bundles are verified and reused; invalid/incomplete files are preserved.
On macOS, initialization always runs through the existing resource guard.";

#[derive(Debug, PartialEq)]
struct Options {
    variant: Option<u8>,
    threads: usize,
    out: Option<PathBuf>,
}

fn parse(args: &[String], available: usize) -> Result<Options, String> {
    let mut result = Options { variant: None, threads: available, out: None };
    let mut seen = std::collections::HashSet::new();
    let mut args = args.iter();
    while let Some(flag) = args.next() {
        if !["--memory", "--variant", "--threads", "--out"].contains(&flag.as_str()) {
            return Err(format!("Unknown init option: {flag}. Use init --help."));
        }
        if !seen.insert(flag) { return Err(format!("Repeated option: {flag}")); }
        let value = args.next().filter(|value| !value.starts_with("--"))
            .ok_or_else(|| format!("Missing value for {flag}"))?;
        match flag.as_str() {
            "--memory" | "--variant" => {
                if result.variant.is_some() { return Err("Choose --memory or --variant, not both".into()); }
                let variant = if flag == "--memory" {
                    let tier = value.to_ascii_uppercase();
                    TIERS.iter().position(|&s| s == tier.trim_end_matches('B')).map(|i| i as u8 + 1)
                } else {
                    value.parse::<u8>().ok().filter(|v| (1..=9).contains(v))
                };
                result.variant = Some(variant.ok_or_else(|| format!("Unsupported table size: {value}. Use init --help."))?);
            }
            "--threads" => {
                result.threads = value.parse().ok().filter(|n| (1..=available).contains(n))
                    .ok_or_else(|| format!("Threads must be between 1 and {available}"))?;
            }
            "--out" => {
                if value.is_empty() { return Err("Output directory cannot be empty".into()); }
                result.out = Some(PathBuf::from(value));
            }
            _ => unreachable!(),
        }
    }
    Ok(result)
}

fn choose_variant() -> Result<u8, String> {
    if !io::stdin().is_terminal() {
        return Err("Specify a table size, for example: init --memory 2G".into());
    }
    eprintln!("Select table size:");
    for (i, tier) in TIERS.iter().enumerate() {
        let variant = cube48opt_research::table::Variant::new(i as u8 + 1)?;
        eprintln!("  {}. {:>4}  Opt{} ({:.1} MB)", i + 1, tier, i + 1, variant.bytes() as f64 / 1e6);
    }
    eprint!("Choice [1–9]: ");
    io::stderr().flush().map_err(|e| e.to_string())?;
    let mut answer = String::new();
    io::stdin().read_line(&mut answer).map_err(|e| e.to_string())?;
    answer.trim().parse::<u8>().ok().filter(|v| (1..=9).contains(v))
        .ok_or_else(|| "Expected a choice from 1 to 9; no tables were generated".into())
}

fn source_directory() -> Result<PathBuf, String> {
    // Prefer the executable's checkout so moving a complete checkout works.
    if let Ok(executable) = env::current_exe() {
        for directory in executable.ancestors().skip(1) {
            if directory.join("oracle.mjs").is_file() && directory.join("variants.mjs").is_file() {
                return Ok(directory.to_path_buf());
            }
        }
    }
    let source = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    if source.join("oracle.mjs").is_file() { return Ok(source); }
    Err("Table generator not found. Keep the executable inside the repository checkout.".into())
}

fn generator_command(node: &Path, source: &Path, out: &Path, variant: u8, threads: usize, macos: bool) -> Command {
    let mut command = Command::new(node);
    if macos {
        // No bypass flag: the guard owns the resource baseline and process group.
        command.arg(source.join("guard.mts"))
            .arg(format!("opt{variant}-init-{}", std::process::id()))
            .arg(node);
    }
    command.arg(source.join("oracle.mjs")).arg("generate").arg(out).arg("--reuse")
        .env("CUBEOPT_VARIANT", variant.to_string())
        .env("CUBEOPT_THREADS", threads.to_string());
    command
}

pub fn run(args: &[String]) -> Result<(), String> {
    if args.iter().any(|arg| arg == "--help" || arg == "-h") {
        println!("{HELP}");
        return Ok(());
    }
    let available = std::thread::available_parallelism().map_err(|e| e.to_string())?.get();
    let options = parse(args, available)?;
    let variant = options.variant.map(Ok).unwrap_or_else(choose_variant)?;
    let source = source_directory()?;
    let root = source.ancestors().nth(3).ok_or("Invalid generator location")?;
    let assets = root.join("core/packages/client/public/cubeopt");
    for extension in ["wasm", "mjs"] {
        let asset = assets.join(format!("cube48opt{variant}.{extension}"));
        if !asset.is_file() { return Err(format!("Missing generator asset: {}. Restore the repository assets first.", asset.display())); }
    }
    let out = options.out.unwrap_or_else(|| root.join(format!("solver/tables/cubeopt/opt{variant}")));
    let out = env::current_dir().map_err(|e| e.to_string())?.join(out);
    let node = Command::new("node").args(["-e", "if (Number(process.versions.node.split('.')[0]) < 24) process.exit(1); process.stdout.write(process.execPath)"])
        .output().map_err(|_| "Node.js 24+ is required for table generation. Install Node, then run init again.".to_string())?;
    if !node.status.success() { return Err("Node.js 24+ is required for table generation".into()); }
    let node = PathBuf::from(String::from_utf8(node.stdout).map_err(|e| e.to_string())?);
    eprintln!("Opt{variant} · {} threads\nTables: {}", options.threads, out.display());
    let mut command = generator_command(&node, &source, &out, variant, options.threads, cfg!(target_os = "macos"));
    // Replace this lightweight CLI on Unix. Otherwise the Mac guard would see
    // its parent as another native solver; Ctrl-C must also reach its owner.
    #[cfg(unix)]
    {
        use std::os::unix::process::CommandExt;
        Err(format!("Could not start table generator: {}", command.exec()))
    }
    #[cfg(not(unix))]
    {
        let status = command.status().map_err(|e| e.to_string())?;
        if status.success() { Ok(()) } else { Err("Table initialization failed; existing files were preserved".into()) }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn args(values: &[&str]) -> Vec<String> { values.iter().map(|s| s.to_string()).collect() }

    #[test]
    fn init_tiers_and_invalid_requests_are_checked_before_generation() {
        for (i, tier) in TIERS.iter().enumerate() {
            assert_eq!(parse(&args(&["--memory", tier]), 4).unwrap().variant, Some(i as u8 + 1));
        }
        assert_eq!(parse(&args(&["--memory", "2gb", "--threads", "2"]), 4).unwrap(),
            Options { variant: Some(6), threads: 2, out: None });
        for values in [vec!["--memory", "32G"], vec!["--variant", "11"], vec!["--threads", "0"],
            vec!["--threads", "5"], vec!["--out"], vec!["--out", "--memory", "2G"],
            vec!["--memory", "2G", "--variant", "6"], vec!["--out", "a", "--out", "b"]] {
            assert!(parse(&args(&values), 4).is_err(), "{values:?}");
        }
    }

    #[test]
    fn init_dispatch_keeps_the_mac_guard_and_uses_no_shell() {
        let node = Path::new("/node with spaces/node");
        let source = Path::new("/checkout/solver/experiments/cube48opt-rust");
        let out = Path::new("/tables with spaces/opt6");
        for macos in [false, true] {
            let command = generator_command(node, source, out, 6, 4, macos);
            let argv: Vec<_> = command.get_args().map(|s| s.to_string_lossy().into_owned()).collect();
            assert_eq!(command.get_program(), node.as_os_str());
            let offset = if macos {
                assert_eq!(argv[0], source.join("guard.mts").to_str().unwrap());
                assert_eq!(argv[2], node.to_str().unwrap());
                3
            } else { 0 };
            assert_eq!(&argv[offset..], &[source.join("oracle.mjs").to_str().unwrap(), "generate", out.to_str().unwrap(), "--reuse"]);
        }
    }
}

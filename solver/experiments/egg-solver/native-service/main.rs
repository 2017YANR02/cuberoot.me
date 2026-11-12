//! Timer's TSV adapter around the pinned, unchanged egg search library.
use egg_solver::cubie::{format_moves, parse_moves, CubieCube};
use egg_solver::lanes::share::Pool;
use egg_solver::solver::Solver;
use egg_solver::tables::{file, h48_bytes, Cocsep, H48Table};
use std::io::{self, BufRead, Read, Write};
use std::sync::{atomic::AtomicBool, mpsc, Arc, Mutex};

const UPSTREAM: &str = "947c20d93564f150aad9c292486ab730a329b86c";
const MAX_LINE: u64 = 4096;

fn parse_request(line: &str) -> Result<(String, CubieCube), &'static str> {
    let (id, scramble) = line.trim_end_matches(['\n', '\r']).split_once('\t').ok_or("missing id")?;
    if id.is_empty() || id.len() > 128 || !id.bytes().all(|c| c.is_ascii_alphanumeric() || b"_-".contains(&c)) {
        return Err("invalid id");
    }
    let tokens: Vec<_> = scramble.split_whitespace().collect();
    if tokens.is_empty() || tokens.len() > 50 || tokens.iter().any(|t| {
        let b = t.as_bytes();
        !(b.len() == 1 || (b.len() == 2 && b"2'".contains(&b[1]))) || !b"URFDLB".contains(&b[0])
    }) {
        return Err("invalid scramble");
    }
    let moves = parse_moves(&tokens.join(" ")).ok_or("invalid scramble")?;
    let cube = CubieCube::SOLVED.apply_moves(&moves).ok_or("invalid scramble")?;
    Ok((id.to_owned(), cube))
}

fn serve<R: BufRead, W: Write>(solver: &Solver, threads: usize, lanes: usize, mut input: R, mut output: W) -> anyhow::Result<()> {
    let cube = Mutex::new(CubieCube::SOLVED);
    let result = Mutex::new(None);
    let get = |index| (index == 0).then(|| *cube.lock().unwrap());
    let done = |_: usize, solution, _, _| *result.lock().unwrap() = Some(solution);
    let stop = AtomicBool::new(false);
    std::thread::scope(|scope| -> anyhow::Result<()> {
        let (finished_tx, finished_rx) = mpsc::channel();
        let mut senders = Vec::new();
        for _ in 0..threads {
            let (tx, rx) = mpsc::sync_channel::<Arc<Pool<'_>>>(1);
            let finished_tx = finished_tx.clone();
            let done = &done;
            let stop = &stop;
            std::thread::Builder::new().spawn_scoped(scope, move || {
                while let Ok(pool) = rx.recv() {
                    pool.run_pinned(solver, lanes, stop, done);
                    if finished_tx.send(()).is_err() { break; }
                }
            })?;
            senders.push(tx);
        }
        drop(finished_tx);
        writeln!(output, "READY\t{threads}")?;
        output.flush()?;
        loop {
            let mut line = String::new();
            let size = input.by_ref().take(MAX_LINE + 1).read_line(&mut line)?;
            if size == 0 { break; }
            anyhow::ensure!(size as u64 <= MAX_LINE, "request line too long");
            let (id, current) = match parse_request(&line) {
                Ok(request) => request,
                Err(message) => {
                    let id = line.split('\t').next().unwrap_or("");
                    if !id.is_empty() && id.len() <= 128 && id.bytes().all(|c| c.is_ascii_alphanumeric() || b"_-".contains(&c)) {
                        writeln!(output, "{id}\tERROR\t{message}")?;
                        output.flush()?;
                    }
                    continue;
                }
            };
            *cube.lock().unwrap() = current;
            *result.lock().unwrap() = None;
            // Reuse the OS workers and table. A fresh upstream Pool owns exactly
            // this request; idle workers block on channels rather than spinning.
            let pool = Arc::new(Pool::new(&get, 1, threads));
            for sender in &senders { sender.send(Arc::clone(&pool)).map_err(|_| anyhow::anyhow!("worker channel closed"))?; }
            for _ in 0..threads { finished_rx.recv()?; }
            let moves = result.lock().unwrap().take().flatten().ok_or_else(|| anyhow::anyhow!("no solution"))?;
            anyhow::ensure!(moves.len() <= 20 && current.apply_moves(&moves) == Some(CubieCube::SOLVED), "solution replay failed");
            writeln!(output, "{id}\t{}\t{}", moves.len(), format_moves(&moves))?;
            output.flush()?;
        }
        drop(senders);
        Ok(())
    })
}

fn generate(path: &str, threads: usize) -> anyhow::Result<()> {
    use std::fs::{self, OpenOptions};
    #[cfg(target_os = "linux")]
    use std::os::fd::AsRawFd;
    use std::process::{Command, Stdio};
    anyhow::ensure!(!std::path::Path::new(path).exists(), "table already exists");
    let partial = format!("{path}.partial");
    let mut output = OpenOptions::new().write(true).create_new(true).open(&partial)?;
    let started = std::time::Instant::now();
    let corners = Cocsep::generate()?;
    let base = egg_solver::tables::default_base(8);
    let table = egg_solver::generate_table(&corners, 8, base, threads, true)?;
    // Hash the stream while writing the generated table, without rereading it.
    // Trailer integrity scans are optional upstream and intentionally omitted.
    let trailer = file::Trailer { k: 8, base, data_bytes: h48_bytes(8), distribution: None, checksum: None }.to_bytes();
    let mut hash = Command::new("sha256sum").stdin(Stdio::piped()).stdout(Stdio::piped()).spawn()?;
    let mut hash_input = hash.stdin.take().ok_or_else(|| anyhow::anyhow!("missing hash input"))?;
    let mut written = 0u64;
    for chunk in table.data()?.chunks(64 * 1024 * 1024).chain(std::iter::once(trailer.as_slice())) {
        output.write_all(chunk)?;
        hash_input.write_all(chunk)?;
        written += chunk.len() as u64;
        output.sync_data()?;
        // Discard completed output cache pages; the generation buffer stays in RAM.
        #[cfg(target_os = "linux")]
        unsafe { libc::posix_fadvise(output.as_raw_fd(), 0, written as i64, libc::POSIX_FADV_DONTNEED); }
    }
    drop(hash_input);
    let digest = hash.wait_with_output()?;
    anyhow::ensure!(digest.status.success(), "SHA-256 stream failed");
    let digest = String::from_utf8(digest.stdout)?.split_whitespace().next().unwrap_or("").to_owned();
    anyhow::ensure!(digest.len() == 64 && digest.bytes().all(|c| c.is_ascii_hexdigit()), "invalid digest");
    output.sync_all()?;
    fs::hard_link(&partial, path)?;
    fs::remove_file(&partial)?;
    let metadata = serde_json::json!({"schema":"cuberoot.egg-generated-table/v1", "upstream":UPSTREAM,
        "k":8,"base":base,"bytes":written,"sha256":digest,"threads":threads,
        "seconds":started.elapsed().as_secs_f64(),"digestMethod":"SHA-256 during initial write; no table reread"});
    let mut receipt = OpenOptions::new().write(true).create_new(true).open(format!("{path}.generation.json"))?;
    writeln!(receipt, "{metadata}")?;
    receipt.sync_all()?;
    println!("{metadata}");
    Ok(())
}

fn main() -> anyhow::Result<()> {
    let args: Vec<_> = std::env::args().skip(1).collect();
    if args == ["--server-info"] {
        println!("{}", serde_json::json!({"engine":"egg-native","variant":"h8","protocol":1,
            "maxThreads":4,"optimized":true,"upstream":UPSTREAM}));
        return Ok(());
    }
    anyhow::ensure!(args.len() == 3 && ["serve", "generate"].contains(&args[0].as_str()), "usage: cuberoot-egg serve|generate TABLE THREADS");
    let threads = args[2].parse::<usize>()?;
    anyhow::ensure!((1..=4).contains(&threads), "threads must be 1..4");
    if args[0] == "generate" { return generate(&args[1], threads); }
    let meta = file::read_trailer(&args[1])?.ok_or_else(|| anyhow::anyhow!("missing egg table trailer"))?;
    anyhow::ensure!(meta.k == 8 && meta.base == egg_solver::tables::default_base(8)
        && std::fs::metadata(&args[1])?.len() == file::file_bytes(h48_bytes(8), false), "expected a complete egg h8 table");
    let corners = Cocsep::generate()?;
    let table = H48Table::open_copy(&args[1])?;
    let solver = Solver::new(&corners, &table);
    serve(&solver, threads, 24, io::stdin().lock(), io::stdout().lock())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn restricts_protocol_without_relaxing_scramble_syntax() {
        for text in ["1\t", "1\tR3", "1\tx", "1\tR\tERROR", "bad id\tR", "\tR"] {
            assert!(parse_request(text).is_err(), "{text}");
        }
        assert!(parse_request(&format!("1\t{}", "R ".repeat(51))).is_err());
        assert!(parse_request("job-1\tR U2 F'\r\n").is_ok());
    }

    #[test]
    fn serves_multiple_optimal_requests_with_one_worker_set() {
        let corners = Cocsep::generate().unwrap();
        let table = egg_solver::generate_table(&corners, 0, egg_solver::tables::default_base(0), 2, false).unwrap();
        let solver = Solver::new(&corners, &table);
        let mut output = Vec::new();
        serve(&solver, 2, 8, io::Cursor::new("1\tR\n2\tR U\nbad\tR3\n3\tR R'\n4\tF U2 L'\n"), &mut output).unwrap();
        let text = String::from_utf8(output).unwrap();
        let rows: Vec<_> = text.lines().collect();
        assert_eq!(rows[0], "READY\t2");
        assert_eq!(rows[1], "1\t1\tR'");
        assert!(rows[2].starts_with("2\t2\t"));
        assert_eq!(rows[3], "bad\tERROR\tinvalid scramble");
        assert_eq!(rows[4], "3\t0\t");
        assert!(rows[5].starts_with("4\t3\t"));
        assert_eq!(rows.len(), 6);
    }
}

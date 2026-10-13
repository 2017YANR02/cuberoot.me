//! Bounded batch scheduling. Workers borrow one immutable oracle; input is
//! pulled one line at a time and completed output is flushed atomically.
use std::io::{BufRead, Write};
use std::sync::{atomic::{AtomicBool, Ordering}, Mutex};

pub fn run<R, W, F>(reader: R, writer: W, threads: usize, solve: F) -> Result<(), String>
where R: BufRead + Send, W: Write + Send, F: Fn(&str) -> Result<String, String> + Sync {
    if threads == 0 || threads > 256 { return Err("invalid worker count".into()); }
    let reader = Mutex::new(reader);
    let writer = Mutex::new(writer);
    let failed = AtomicBool::new(false);
    std::thread::scope(|scope| {
        let handles: Vec<_> = (0..threads).map(|_| scope.spawn(|| {
            let work = || -> Result<(), String> {
                loop {
                    if failed.load(Ordering::Acquire) { return Ok(()); }
                    let mut line = String::new();
                    let n = reader.lock().map_err(|_| "input lock poisoned")?
                        .read_line(&mut line).map_err(|e| e.to_string())?;
                    if n == 0 { return Ok(()); }
                    let output = solve(line.trim_end_matches(['\r', '\n']))?;
                    let mut writer = writer.lock().map_err(|_| "output lock poisoned")?;
                    writeln!(writer, "{output}").and_then(|_| writer.flush()).map_err(|e| e.to_string())?;
                }
            };
            let result = work();
            if result.is_err() { failed.store(true, Ordering::Release); }
            result
        })).collect();
        let mut error = None;
        for handle in handles {
            if let Err(e) = handle.join().unwrap_or_else(|_| Err("worker panicked".into())) { error.get_or_insert(e); }
        }
        error.map_or(Ok(()), Err)
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn parallel_output_is_complete_and_never_interleaved() {
        let input = (0..500).map(|n| format!("{n}\n")).collect::<String>();
        let mut output = Vec::new();
        run(std::io::Cursor::new(input), &mut output, 16, |line| Ok(format!("{line},{}", "x".repeat(1000)))).unwrap();
        let text = String::from_utf8(output).unwrap();
        let mut ids = text.lines().map(|line| {
            let (id, tail) = line.split_once(',').unwrap();
            assert_eq!(tail, "x".repeat(1000)); id.parse::<usize>().unwrap()
        }).collect::<Vec<_>>();
        ids.sort_unstable(); assert_eq!(ids, (0..500).collect::<Vec<_>>());
    }
    #[test]
    fn errors_are_not_reported_as_success() {
        assert_eq!(run(std::io::Cursor::new("bad\n"), Vec::new(), 4, |_| Err("bad input".into())).unwrap_err(), "bad input");
    }
}

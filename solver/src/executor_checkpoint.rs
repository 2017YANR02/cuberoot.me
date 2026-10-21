//! Process-interruption checkpoints for the native analyzer executor.
//! The input bytes, output schema and caller's binary/configuration identity must
//! match before any completed row is reused. Files stay until the caller merges
//! the completed CSV into its durable dataset.

use std::collections::hash_map::DefaultHasher;
use std::fs::{File, OpenOptions};
use std::hash::Hasher;
use std::io::{self, BufRead, Seek, SeekFrom, Write};
use std::path::{Path, PathBuf};

fn invalid(message: impl Into<String>) -> io::Error {
    io::Error::new(io::ErrorKind::InvalidData, message.into())
}

fn checksum(record: &str) -> u64 {
    let mut hash = DefaultHasher::new();
    hash.write(record.as_bytes());
    hash.finish()
}

fn sidecar(output: &Path, suffix: &str) -> PathBuf {
    let mut path = output.as_os_str().to_os_string();
    path.push(suffix);
    path.into()
}

pub(super) struct Checkpoint {
    file: File,
    ids: Vec<String>,
    columns: usize,
}

impl Checkpoint {
    pub(super) fn open(
        output: &Path,
        input: &[u8],
        header: &str,
        suffix: &str,
        identity: &str,
        ids: Vec<String>,
    ) -> io::Result<(Self, Vec<String>)> {
        let path = sidecar(output, ".checkpoint");
        let meta_path = sidecar(output, ".checkpoint.meta");
        let mut metadata = b"CUBEROOT_ANALYZER_CHECKPOINT_V1\n".to_vec();
        for bytes in [
            identity.as_bytes(),
            suffix.as_bytes(),
            header.as_bytes(),
            input,
        ] {
            metadata.extend_from_slice(&(bytes.len() as u64).to_le_bytes());
            metadata.extend_from_slice(bytes);
        }
        if meta_path.exists() {
            if std::fs::read(&meta_path)? != metadata {
                return Err(invalid(format!(
                    "checkpoint input, schema or solver identity changed: {}; preserve and review this checkpoint before retrying",
                    meta_path.display()
                )));
            }
        } else {
            if path.exists() {
                return Err(invalid("checkpoint exists without its input identity"));
            }
            let mut file = OpenOptions::new()
                .write(true)
                .create_new(true)
                .open(&meta_path)?;
            file.write_all(&metadata)?;
            file.sync_all()?;
        }
        let file = OpenOptions::new()
            .read(true)
            .append(true)
            .create(true)
            .open(&path)?;
        let mut checkpoint = Self {
            file,
            ids,
            columns: header.split(',').count(),
        };
        let mut results = vec![String::new(); checkpoint.ids.len()];
        let mut reader = io::BufReader::new(checkpoint.file.try_clone()?);
        reader.seek(SeekFrom::Start(0))?;
        let mut committed = 0;
        loop {
            let mut bytes = Vec::new();
            let read = reader.read_until(b'\n', &mut bytes)?;
            if read == 0 {
                break;
            }
            if bytes.last() != Some(&b'\n') {
                // A process may die during one append. Only the unterminated
                // final record is discarded; corrupt committed rows fail closed.
                checkpoint.file.set_len(committed)?;
                checkpoint.file.sync_all()?;
                break;
            }
            let line = std::str::from_utf8(&bytes[..bytes.len() - 1])
                .map_err(|_| invalid("checkpoint contains invalid UTF-8"))?;
            let (digest, record) = line
                .split_once('\t')
                .ok_or_else(|| invalid("invalid checkpoint record"))?;
            let digest = u64::from_str_radix(digest, 16)
                .map_err(|_| invalid("invalid checkpoint checksum"))?;
            if checksum(record) != digest {
                return Err(invalid("checkpoint row checksum mismatch"));
            }
            let (index, row) = record
                .split_once('\t')
                .ok_or_else(|| invalid("missing checkpoint row index"))?;
            let index: usize = index
                .parse()
                .map_err(|_| invalid("invalid checkpoint row index"))?;
            checkpoint.validate(index, row)?;
            if !results[index].is_empty() && results[index] != row {
                return Err(invalid("conflicting completed checkpoint rows"));
            }
            results[index] = row.to_string();
            committed += read as u64;
        }
        // Drop the cloned reader before appending through the shared file offset.
        drop(reader);
        checkpoint.file.seek(SeekFrom::End(0))?;
        Ok((checkpoint, results))
    }

    fn validate(&self, index: usize, row: &str) -> io::Result<()> {
        let Some(id) = self.ids.get(index) else {
            return Err(invalid("unknown checkpoint task index"));
        };
        if row.contains(['\r', '\n', '\t'])
            || row.split(',').count() != self.columns
            || row.split(',').next() != Some(id.as_str())
        {
            return Err(invalid(
                "checkpoint row does not match its task or CSV schema",
            ));
        }
        Ok(())
    }

    pub(super) fn append(&mut self, index: usize, row: &str) -> io::Result<()> {
        self.validate(index, row)?;
        let record = format!("{index}\t{row}");
        // File (not BufWriter): completed rows reach the kernel before progress
        // is reported and survive process termination, including SIGKILL.
        writeln!(self.file, "{:016x}\t{record}", checksum(&record))?;
        self.file.flush()
    }

    pub(super) fn sync(&self) -> io::Result<()> {
        self.file.sync_all()
    }
}

pub(super) fn write_completed(output: &Path, header: &str, rows: &[String]) -> io::Result<()> {
    let temporary = sidecar(output, ".complete.tmp");
    let mut writer = io::BufWriter::new(File::create(&temporary)?);
    writeln!(writer, "{header}")?;
    for row in rows {
        writeln!(writer, "{row}")?;
    }
    writer.flush()?;
    writer.get_ref().sync_all()?;
    drop(writer);
    std::fs::rename(temporary, output)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicU64, Ordering};

    fn output() -> PathBuf {
        static NEXT: AtomicU64 = AtomicU64::new(0);
        let dir = std::env::temp_dir().join(format!(
            "cube-checkpoint-{}-{}",
            std::process::id(),
            NEXT.fetch_add(1, Ordering::Relaxed)
        ));
        std::fs::create_dir(&dir).unwrap();
        dir.join("out.csv")
    }
    fn open(path: &Path, input: &[u8]) -> io::Result<(Checkpoint, Vec<String>)> {
        Checkpoint::open(
            path,
            input,
            "id,value",
            "_test",
            "binary-and-config-v1",
            vec!["slow".into(), "fast".into()],
        )
    }
    #[test]
    fn restores_out_of_order_rows_and_discards_only_an_unfinished_tail() {
        let path = output();
        let (mut checkpoint, _) = open(&path, b"slow,U\nfast,R\n").unwrap();
        checkpoint.append(1, "fast,2").unwrap();
        drop(checkpoint);
        OpenOptions::new()
            .append(true)
            .open(sidecar(&path, ".checkpoint"))
            .unwrap()
            .write_all(b"unfinished")
            .unwrap();
        let (mut checkpoint, mut rows) = open(&path, b"slow,U\nfast,R\n").unwrap();
        assert_eq!(rows, ["", "fast,2"]);
        checkpoint.append(0, "slow,1").unwrap();
        rows[0] = "slow,1".into();
        checkpoint.sync().unwrap();
        write_completed(&path, "id,value", &rows).unwrap();
        assert_eq!(
            std::fs::read_to_string(&path).unwrap(),
            "id,value\nslow,1\nfast,2\n"
        );
        drop(checkpoint);
        assert_eq!(open(&path, b"slow,U\nfast,R\n").unwrap().1, rows);
        assert!(open(&path, b"slow,F\nfast,R\n").is_err());
        assert!(Checkpoint::open(
            &path,
            b"slow,U\nfast,R\n",
            "id,value",
            "_test",
            "new-binary",
            vec!["slow".into(), "fast".into()]
        )
        .is_err());
        std::fs::remove_dir_all(path.parent().unwrap()).unwrap();
    }
    #[test]
    fn rejects_committed_corruption_wrong_ids_and_write_failures() {
        let path = output();
        let (mut checkpoint, _) = open(&path, b"input").unwrap();
        assert!(checkpoint.append(0, "wrong,1").is_err());
        assert!(checkpoint.append(0, "slow,1,2").is_err());
        checkpoint.append(0, "slow,1").unwrap();
        drop(checkpoint);
        OpenOptions::new()
            .append(true)
            .open(sidecar(&path, ".checkpoint"))
            .unwrap()
            .write_all(b"corrupted\n")
            .unwrap();
        assert!(open(&path, b"input").is_err());
        let mut readonly = Checkpoint {
            file: File::open(sidecar(&path, ".checkpoint")).unwrap(),
            ids: vec!["slow".into()],
            columns: 2,
        };
        assert!(readonly.append(0, "slow,1").is_err());
        std::fs::remove_dir_all(path.parent().unwrap()).unwrap();
    }
}

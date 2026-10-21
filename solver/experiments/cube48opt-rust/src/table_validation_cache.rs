//! A local optimization receipt, not a content hash or a portable certificate.
//! Bump VERSION whenever the table decoder or full validation rules change.
use super::{valid_distribution, Variant};
use std::{fs::{self, File, Metadata, OpenOptions}, io::{self, Read, Write}, path::{Path, PathBuf}};

const VERSION: &str = "cubeopt-native-validation-v1";

pub(super) fn identity(metadata: &Metadata) -> String {
    #[cfg(unix)]
    {
        use std::os::unix::fs::MetadataExt;
        // ctime also invalidates a same-size rewrite with a restored mtime.
        format!("{}:{}:{}:{}:{}:{}:{}:{}", std::env::consts::OS,
            metadata.dev(), metadata.ino(), metadata.len(), metadata.mtime(),
            metadata.mtime_nsec(), metadata.ctime(), metadata.ctime_nsec())
    }
    #[cfg(not(unix))]
    { format!("{}:{:?}:{:?}", metadata.len(), metadata.modified(), metadata.created()) }
}

pub(super) struct Cache {
    path: PathBuf,
    key: String,
    variant: Variant,
}

impl Cache {
    pub(super) fn new(path: &Path, metadata: &Metadata, variant: Variant) -> Option<Self> {
        // Without a stable file identity and change time, keep full validation.
        if !cfg!(unix) || !metadata.is_file() { return None; }
        let mut name = path.as_os_str().to_os_string();
        name.push(".verified");
        Some(Self {
            path: PathBuf::from(name),
            key: format!("{VERSION}\n{}:{}:{}\n{}", variant.number(), variant.bytes(),
                variant.checksum(), identity(metadata)),
            variant,
        })
    }

    pub(super) fn read(&self) -> Option<[u64; 16]> {
        let mut text = String::new();
        File::open(&self.path).ok()?.take(4097).read_to_string(&mut text).ok()?;
        if text.len() > 4096 { return None; }
        let values = text.strip_prefix(&self.key)?.strip_prefix('\n')?;
        let mut fields = values.split_whitespace();
        let mut counts = [0; 16];
        for count in &mut counts { *count = fields.next()?.parse().ok()?; }
        (fields.next().is_none() && valid_distribution(&counts, self.variant)).then_some(counts)
    }

    pub(super) fn invalidate(&self) -> io::Result<()> {
        match fs::remove_file(&self.path) {
            Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(()),
            result => result,
        }
    }

    pub(super) fn write(&self, counts: &[u64; 16]) -> io::Result<()> {
        use std::sync::atomic::{AtomicU64, Ordering};
        static NEXT: AtomicU64 = AtomicU64::new(0);
        let mut name = self.path.as_os_str().to_os_string();
        name.push(format!(".tmp-{}-{}", std::process::id(), NEXT.fetch_add(1, Ordering::Relaxed)));
        let temporary = PathBuf::from(name);
        // Do not overwrite someone else's temporary file or follow a symlink.
        let mut file = OpenOptions::new().write(true).create_new(true).open(&temporary)?;
        let result = (|| {
            writeln!(file, "{}", self.key)?;
            for count in counts { write!(file, "{count} ")?; }
            writeln!(file)?;
            file.sync_all()?;
            fs::rename(&temporary, &self.path)
        })();
        if result.is_err() { let _ = fs::remove_file(&temporary); }
        result
    }
}

#[cfg(all(test, unix))]
mod tests {
    use super::*;
    use std::{fs::FileTimes, time::{SystemTime, UNIX_EPOCH}};

    const COUNTS: [u64; 16] = [36, 27, 77, 547, 3218, 20172, 102167, 393472,
        4953846, 34776317, 77317571, 0, 0, 0, 0, 0];

    struct Fixture(PathBuf);
    impl Fixture {
        fn new() -> Self {
            let dir = std::env::temp_dir().join(format!("cubeopt-cache-{}-{}", std::process::id(),
                SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos()));
            fs::create_dir(&dir).unwrap();
            fs::write(dir.join("table.dat"), b"tiny fixture").unwrap();
            Self(dir)
        }
        fn path(&self) -> PathBuf { self.0.join("table.dat") }
        fn cache(&self) -> Cache {
            Cache::new(&self.path(), &fs::metadata(self.path()).unwrap(), Variant(1)).unwrap()
        }
    }
    impl Drop for Fixture { fn drop(&mut self) { let _ = fs::remove_dir_all(&self.0); } }

    #[test]
    fn unchanged_file_reuses_receipt_and_missing_or_invalid_receipt_misses() {
        let fixture = Fixture::new();
        let cache = fixture.cache();
        assert_eq!(cache.read(), None);
        cache.write(&COUNTS).unwrap();
        assert_eq!(fixture.cache().read(), Some(COUNTS));
        cache.invalidate().unwrap();
        assert_eq!(cache.read(), None);
        cache.invalidate().unwrap();
        cache.write(&COUNTS).unwrap();
        let valid = fs::read_to_string(&cache.path).unwrap();
        for invalid in [valid.replace(VERSION, "old-version"), format!("{}\n0", cache.key),
            format!("{}\n{}", cache.key, vec![u64::MAX.to_string(); 16].join(" ")),
            format!("{valid} extra"), "x".repeat(4097)] {
            fs::write(&cache.path, invalid).unwrap();
            assert_eq!(cache.read(), None);
        }
    }

    #[test]
    fn changes_to_size_time_identity_or_variant_invalidate_receipt() {
        let fixture = Fixture::new();
        let original = fixture.cache();
        original.write(&COUNTS).unwrap();
        let metadata = fs::metadata(fixture.path()).unwrap();
        let other_variant = Cache::new(&fixture.path(), &metadata, Variant(2)).unwrap();
        assert_eq!(other_variant.read(), None);

        File::open(fixture.path()).unwrap().set_times(FileTimes::new().set_modified(UNIX_EPOCH)).unwrap();
        assert_eq!(fixture.cache().read(), None);
        fixture.cache().write(&COUNTS).unwrap();
        fs::write(fixture.path(), b"a different size").unwrap();
        assert_eq!(fixture.cache().read(), None);

        // Replacement with identical bytes and mtime must not inherit a receipt.
        fixture.cache().write(&COUNTS).unwrap();
        let mtime = fs::metadata(fixture.path()).unwrap().modified().unwrap();
        let replacement = fixture.0.join("replacement.dat");
        fs::copy(fixture.path(), &replacement).unwrap();
        File::open(&replacement).unwrap().set_times(FileTimes::new().set_modified(mtime)).unwrap();
        fs::rename(replacement, fixture.path()).unwrap();
        assert_eq!(fixture.cache().read(), None);
    }
}

//! Check the Opt10 generation core against every valid cell of the pinned Opt1
//! table, using EO0 projection and Opt1's base-7 packed representation.
//!
//! No arguments or --self-check run only a tiny synthetic graph. The complete
//! --verify-opt1 path must be launched through the research resource guard; it
//! never writes a table and cannot publish a partial Opt10 artifact.
use cube48opt_research::{
    coord::COORDINATE_COUNT,
    cube::Cube,
    opt10::Opt10Coordinates,
    opt10_generate::{generate, CoordinateSpace, GenerationConfig, GenerationSink},
    table::{PruningTable, Variant},
};
use std::{
    env, fs,
    path::Path,
    sync::atomic::{AtomicU8, Ordering},
    thread,
};

const OPT1_VALID_CELLS: u64 = 117_567_450;
const OPT1_BYTES: u64 = 30_401_280;
const BASE: u8 = 7;
const SATURATED: u8 = 10;

/// A deliberately independent byte-atomic implementation of the published
/// Opt1 layout. Production Opt10 storage uses u32 atomics. Comparing decoded
/// cells therefore checks both the shared generation algorithm and packing.
struct Opt1Sink {
    bytes: Vec<AtomicU8>,
}

impl Opt1Sink {
    fn new(cells: u64) -> Result<Self, String> {
        if cells == 0 || cells % 512 != 0 || cells > u64::from(COORDINATE_COUNT) {
            return Err("Opt1 fixture must contain whole 512-cell slices".into());
        }
        let length = usize::try_from(cells / 4).map_err(|_| "Opt1 allocation overflow")?;
        let mut bytes = Vec::new();
        bytes.try_reserve_exact(length).map_err(|e| e.to_string())?;
        bytes.extend(
            (0..length).map(|i| AtomicU8::new(if i % 16 == 0 { 0xf0 | BASE } else { 255 })),
        );
        Ok(Self { bytes })
    }

    fn valid(&self, index: u64) -> bool {
        index < self.cells() && index % 64 >= 2 && index % 512 != 511
    }

    fn lower_field(&self, byte: usize, shift: u32, mask: u8, value: u8) -> bool {
        let atom = &self.bytes[byte];
        let mut previous = atom.load(Ordering::Relaxed);
        loop {
            if (previous >> shift) & mask <= value {
                return false;
            }
            let next = (previous & !(mask << shift)) | (value << shift);
            match atom.compare_exchange_weak(previous, next, Ordering::Relaxed, Ordering::Relaxed) {
                Ok(_) => return true,
                Err(actual) => previous = actual,
            }
        }
    }

    fn get(&self, index: u64) -> u8 {
        assert!(self.valid(index));
        let code =
            (self.bytes[index as usize / 4].load(Ordering::Relaxed) >> ((index % 4) * 2)) & 3;
        if code == 0 {
            self.bytes[(index as usize / 64) * 16].load(Ordering::Relaxed) & 15
        } else {
            BASE + code
        }
    }
}

impl GenerationSink for Opt1Sink {
    fn cells(&self) -> u64 {
        self.bytes.len() as u64 * 4
    }
    fn record_min(&self, index: u64, depth: u8) -> Result<bool, String> {
        if !self.valid(index) {
            return Err("Opt1 fixture update is padding or out of bounds".into());
        }
        let code = depth.saturating_sub(BASE).min(3);
        let mut changed = false;
        if code == 0 {
            changed = self.lower_field((index as usize / 64) * 16, 0, 15, depth);
        }
        changed |= self.lower_field(index as usize / 4, ((index % 4) * 2) as u32, 3, code);
        Ok(changed)
    }
}

struct Opt1Projection(Opt10Coordinates);

impl CoordinateSpace for Opt1Projection {
    type State = Cube;
    fn solved(&self) -> Cube {
        Cube::SOLVED
    }
    fn full_key(&self, state: &Cube) -> u64 {
        self.0.full_key(state)
    }
    fn representative(&self, key: u64) -> Result<Cube, String> {
        self.0.representative(key)
    }
    fn moved(&self, state: &Cube, movement: u8) -> Cube {
        state.moved(movement)
    }
    fn mark_projected(&self, state: &Cube, visit: &mut dyn FnMut(u64)) {
        self.0.projected_aliases(state, &mut |eo10| {
            // Remove all ten retained EO bits, retaining the 9-bit padded
            // outer-edge coordinate and the corner/inner-edge orbit.
            visit(((eo10 >> 19) << 9) | (eo10 & 511));
        });
    }
    fn project_if_key(
        &self,
        state: &Cube,
        include: impl FnOnce(u64) -> bool,
        visit: &mut dyn FnMut(u64),
    ) -> bool {
        self.0.projected_if_key(state, include, &mut |eo10| {
            visit(((eo10 >> 19) << 9) | (eo10 & 511));
        })
    }
    fn cells(&self) -> u64 {
        u64::from(COORDINATE_COUNT)
    }
    fn allow_move(&self, previous: Option<u8>, next: u8) -> bool {
        CoordinateSpace::allow_move(&self.0, previous, next)
    }
}

struct TinyCycle;
impl CoordinateSpace for TinyCycle {
    type State = u64;
    fn solved(&self) -> u64 {
        0
    }
    fn full_key(&self, state: &u64) -> u64 {
        *state
    }
    fn representative(&self, key: u64) -> Result<u64, String> {
        if key < 32 {
            Ok(key)
        } else {
            Err("invalid tiny state".into())
        }
    }
    fn moved(&self, state: &u64, movement: u8) -> u64 {
        if movement == 0 {
            (state + 1) % 32
        } else {
            (state + 31) % 32
        }
    }
    fn mark_projected(&self, state: &u64, visit: &mut dyn FnMut(u64)) {
        visit(state * 64 + 2);
        visit(state * 64 + 3);
    }
    fn cells(&self) -> u64 {
        2048
    }
    fn move_count(&self) -> u8 {
        2
    }
}

fn self_check() -> Result<(), String> {
    let packed = Opt1Sink::new(512)?;
    packed.record_min(2, 9)?;
    packed.record_min(17, 8)?;
    packed.record_min(2, 6)?;
    packed.record_min(18, 4)?;
    assert_eq!((packed.get(2), packed.get(17), packed.get(18)), (4, 8, 4));
    assert_eq!(packed.get(19), SATURATED);
    for index in [0, 1, 64, 65, 511, 512] {
        assert!(packed.record_min(index, 0).is_err());
    }
    for threads in [
        1,
        thread::available_parallelism()
            .map_err(|e| e.to_string())?
            .get()
            .min(4),
    ] {
        let sink = Opt1Sink::new(2048)?;
        let summary = generate(
            &TinyCycle,
            &sink,
            GenerationConfig {
                threads,
                short_depth: 3,
                max_depth: 9,
                short_capacity: 32,
                max_short_states: 16,
            },
            |_| {},
        )?;
        assert_eq!(
            (
                summary.short_states,
                summary.final_layer_states,
                summary.completed_depth
            ),
            (7, 2, 9)
        );
        for state in 0u64..32 {
            let expected = state.min(32 - state).min(u64::from(SATURATED)) as u8;
            assert_eq!(sink.get(state * 64 + 2), expected);
            assert_eq!(sink.get(state * 64 + 3), expected);
        }
    }
    println!("{{\"schema\":\"cuberoot.opt10.generation-self-check.v1\",\"sharedGenerator\":true,\"fullTableAllocated\":false,\"passed\":true}}");
    Ok(())
}

fn check_combined_coordinates(snapshot_path: &Path) -> Result<(), String> {
    if fs::metadata(snapshot_path)
        .map_err(|e| e.to_string())?
        .len()
        != 818_008
    {
        return Err("expected the 818008-byte Opt9 small-coordinate snapshot".into());
    }
    let snapshot = fs::read(snapshot_path).map_err(|e| e.to_string())?;
    let space = Opt1Projection(Opt10Coordinates::from_opt9_snapshot(&snapshot)?);
    let mut cube = Cube::SOLVED;
    let mut rng = 0x4f50_5431_305f_4348u64;
    for _ in 0..1024 {
        let key = space.full_key(&cube);
        let mut expected = Vec::new();
        space.mark_projected(&cube, &mut |index| expected.push(index));
        let mut actual = Vec::new();
        let mut calls = 0;
        assert!(space.project_if_key(
            &cube,
            |observed| {
                calls += 1;
                assert_eq!(observed, key);
                true
            },
            &mut |index| actual.push(index)
        ));
        assert_eq!(calls, 1);
        assert_eq!(
            actual, expected,
            "combined projection preserves all aliases and order"
        );
        assert!(!space.project_if_key(
            &cube,
            |observed| {
                assert_eq!(observed, key);
                false
            },
            &mut |_| panic!("rejected full key emitted a projection")
        ));
        for _ in 0..25 {
            rng ^= rng << 13;
            rng ^= rng >> 7;
            rng ^= rng << 17;
            cube = cube.moved((rng % 18) as u8);
        }
    }
    println!("{{\"schema\":\"cuberoot.opt10.combined-projection-check.v1\",\"states\":1024,\"fullTableAllocated\":false,\"allEqual\":true}}");
    Ok(())
}

fn verify_opt1(snapshot_path: &Path, reference_path: &Path, threads: usize) -> Result<(), String> {
    // The shell guard owns resource observation and the shared lock. This
    // exact protocol prevents an accidentally selected default Opt1 budget.
    if env::var("CUBEOPT_BACKEND").as_deref() != Ok("opt10-verify")
        || env::var("CUBEOPT_VARIANT").as_deref() != Ok("1")
        || env::var_os("CUBEOPT_H").is_some()
    {
        return Err(
            "complete validation requires the guarded opt10-verify backend and CUBEOPT_VARIANT=1"
                .into(),
        );
    }
    let maximum = thread::available_parallelism()
        .map_err(|e| e.to_string())?
        .get()
        .min(16);
    if threads == 0 || threads > maximum {
        return Err(format!("threads must be 1..={maximum}"));
    }
    if fs::metadata(snapshot_path)
        .map_err(|e| e.to_string())?
        .len()
        != 818_008
    {
        return Err("expected the 818008-byte Opt9 small-coordinate snapshot".into());
    }
    if fs::metadata(reference_path)
        .map_err(|e| e.to_string())?
        .len()
        != OPT1_BYTES
    {
        return Err("expected the existing 30401280-byte Opt1 golden table".into());
    }
    let snapshot = fs::read(snapshot_path).map_err(|e| e.to_string())?;
    let reference = PruningTable::load_variant(reference_path, Variant::new(1)?)?;
    let coordinates = Opt1Projection(Opt10Coordinates::from_opt9_snapshot(&snapshot)?);
    let sink = Opt1Sink::new(u64::from(COORDINATE_COUNT))?;
    // short_depth is the greatest stored exact distance, not the number of
    // completed loop iterations printed by an upstream generator. Measure
    // this implementation at depth7 first; do not enlarge its fixed dictionary
    // or change the Opt10 default merely to conceal a capacity failure.
    let config = GenerationConfig {
        threads,
        short_depth: 7,
        max_depth: 9,
        ..GenerationConfig::default()
    };
    eprintln!("Opt1 reproduction config: {config:?}");
    let summary = generate(&coordinates, &sink, config, |p| {
        eprintln!(
            "Opt1 reproduction {:?}: depth={} short={} seeds={}/{} expanded={} elapsed={:.1}s",
            p.stage, p.depth, p.short_states, p.seeds_done, p.seeds_total, p.expanded, p.seconds
        );
    })?;
    if summary.completed_depth != 9 {
        return Err("Opt1 coverage stopped before depth9".into());
    }
    let mut compared = 0u64;
    let mut differences = 0u64;
    let mut first_difference = None;
    let mut distribution = [0u64; 11];
    for index in 0..u64::from(COORDINATE_COUNT) {
        if !sink.valid(index) {
            continue;
        }
        let actual = sink.get(index);
        let expected = reference.get(index);
        compared += 1;
        distribution[usize::from(actual)] += 1;
        if actual != expected {
            differences += 1;
            first_difference.get_or_insert((index, actual, expected));
        }
    }
    assert_eq!(compared, OPT1_VALID_CELLS);
    if let Some((index, actual, expected)) = first_difference {
        return Err(format!("Opt1 reproduction differs in {differences}/{compared} valid cells; first index {index}: generated {actual}, golden {expected}"));
    }
    println!("{{\"schema\":\"cuberoot.opt10.opt1-generation-validation.v1\",\"sharedGenerator\":true,\"projectionEoBits\":0,\"base\":7,\"completedDepth\":9,\"threads\":{threads},\"config\":{{\"threads\":{},\"shortDepth\":{},\"maxDepth\":{},\"shortCapacity\":{},\"maxShortStates\":{}}},\"comparedValidCells\":{compared},\"differences\":0,\"shortStates\":{},\"finalLayerStates\":{},\"expanded\":{},\"generationSeconds\":{},\"distribution\":{distribution:?},\"tableWritten\":false,\"allEqual\":true}}",
        config.threads, config.short_depth, config.max_depth, config.short_capacity, config.max_short_states,
        summary.short_states, summary.final_layer_states, summary.expanded, summary.seconds);
    Ok(())
}

fn run() -> Result<(), String> {
    let args: Vec<_> = env::args().skip(1).collect();
    match args.as_slice() {
        [] => self_check(),
        [mode] if mode == "--self-check" => self_check(),
        [mode, snapshot] if mode == "--self-check" => {
            self_check()?;
            check_combined_coordinates(Path::new(snapshot))
        }
        [mode, snapshot, reference, threads] if mode == "--verify-opt1" => verify_opt1(
            Path::new(snapshot),
            Path::new(reference),
            threads.parse().map_err(|_| "invalid thread count")?,
        ),
        _ => Err("use --self-check, or guarded --verify-opt1 OPT9_SMALL OPT1_TABLE THREADS".into()),
    }
}

fn main() {
    if let Err(error) = run() {
        eprintln!("{error}");
        std::process::exit(1);
    }
}

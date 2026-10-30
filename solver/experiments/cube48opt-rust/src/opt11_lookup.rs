//! Source-only EO11 read candidates. No table is allocated or loaded here.
//!
//! The original `Opt11Solver` remains the baseline. These adapters borrow its
//! one validated immutable table and return the same decoded subgroup bound.
//! L1 moves address work to prepare and issues a read hint. L2 additionally
//! loads the primary and block-minimum words of all live contexts before
//! decoding any result. Neither candidate has been compiled or measured.

use crate::{
    cube::Cube,
    eo_table::EoLayout,
    opt11::{Opt11Solver, Opt11Table},
    search::PruningOracle,
};

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum Opt11LookupPolicy {
    /// Decoder control inside this adapter; the unwrapped solver is B0.
    Baseline,
    /// L1: checked prepared addresses and immutable read-ahead.
    Prefetch,
    /// L2: L1 plus grouped primary/minimum loads across the eight contexts.
    Grouped,
}

impl Opt11LookupPolicy {
    fn check_available(self) -> Result<(), String> {
        if self != Self::Baseline
            && !cfg!(all(not(target_family = "wasm"), any(target_arch = "aarch64", target_arch = "x86_64")))
        {
            return Err("Opt11 lookup candidates require a native AArch64 or x86_64 target".into());
        }
        if self == Self::Grouped
            && !cfg!(all(feature = "opt11-native-batch", not(target_family = "wasm")))
        {
            return Err("Opt11 grouped reads require the opt11-native-batch feature".into());
        }
        Ok(())
    }

    #[inline(always)]
    fn prepare(self, table: &Opt11Table, index: u64) -> Opt11Probe {
        let probe = Opt11Probe::new(table, index);
        if self != Self::Baseline {
            prefetch_probe(table.immutable_words(), probe);
        }
        probe
    }

    #[inline(always)]
    fn lookup(self, table: &Opt11Table, probe: Opt11Probe) -> u8 {
        if self == Self::Baseline {
            return table.get(probe.index);
        }
        let words = table.immutable_words();
        let code = (words[probe.word] >> probe.shift) & 3;
        if code == 0 {
            (words[probe.minimum_word] & 15) as u8
        } else {
            table.header().base + code as u8
        }
    }

    #[cfg(any(
        feature = "wasm-batch-probes",
        all(any(feature = "opt10-native-batch", feature = "opt11-native-batch"), not(target_family = "wasm")),
    ))]
    #[inline(always)]
    fn lookup_batch(self, table: &Opt11Table, probes: &[Option<Opt11Probe>; 8]) -> [u8; 8] {
        if self != Self::Grouped {
            return std::array::from_fn(|slot| probes[slot].map_or(0, |probe| self.lookup(table, probe)));
        }
        let loaded = load_group(table.immutable_words(), probes);
        let base = table.header().base;
        std::array::from_fn(|slot| {
            let Some(probe) = probes[slot] else { return 0; };
            let code = (loaded[slot].primary >> probe.shift) & 3;
            if code == 0 { (loaded[slot].minimum & 15) as u8 } else { base + code as u8 }
        })
    }
}

/// A checked coordinate, not a cached distance or borrowed raw pointer.
/// Fields are private so callers cannot fabricate an out-of-range word or
/// bypass padding rejection. Reads still use safe slice indexing, even if a
/// probe were later passed to a different-sized table in an internal fixture.
#[derive(Clone, Copy, Debug)]
pub struct Opt11Probe {
    index: u64,
    word: usize,
    minimum_word: usize,
    shift: u32,
}

impl Opt11Probe {
    #[inline(always)]
    fn new(table: &Opt11Table, index: u64) -> Self {
        assert!(EoLayout::<11>::valid_index(index), "invalid EO11 coordinate");
        let word = usize::try_from(index >> 4).expect("EO11 coordinate requires a 64-bit host");
        assert!(word < table.immutable_words().len(), "EO11 probe exceeds table allocation");
        Self { index, word, minimum_word: word & !3, shift: ((index & 15) * 2) as u32 }
    }
}

/// This wrapper owns no table and does not enable any search pruning policy.
/// Construction is not run authorization: the existing Opt11 CLI/guard/hook
/// rejection must remain in place until separately reviewed and authorized.
pub struct Opt11LookupOracle<'a> {
    solver: &'a Opt11Solver,
    policy: Opt11LookupPolicy,
}

impl<'a> Opt11LookupOracle<'a> {
    pub fn new(solver: &'a Opt11Solver, policy: Opt11LookupPolicy) -> Result<Self, String> {
        policy.check_available()?;
        Ok(Self { solver, policy })
    }
}

impl PruningOracle for Opt11LookupOracle<'_> {
    type Query = Opt11Probe;

    #[inline(always)]
    fn prepare(&self, cube: &Cube, remaining: u8) -> Result<Self::Query, u8> {
        self.solver.prepare(cube, remaining).map(|index| self.policy.prepare(self.solver.table(), index))
    }

    #[inline(always)]
    fn lookup(&self, probe: Self::Query) -> u8 { self.policy.lookup(self.solver.table(), probe) }

    #[cfg(any(
        feature = "wasm-batch-probes",
        all(any(feature = "opt10-native-batch", feature = "opt11-native-batch"), not(target_family = "wasm")),
    ))]
    #[inline(always)]
    fn lookup_batch(&self, probes: &[Option<Self::Query>; 8]) -> [u8; 8] {
        self.policy.lookup_batch(self.solver.table(), probes)
    }

    #[inline(always)]
    fn cancelled(&self) -> bool { self.solver.cancelled() }

    #[inline(always)]
    fn max_bound(&self) -> u8 { self.solver.max_bound() }

    #[inline(always)]
    fn conjugate(&self, cube: &Cube, symmetry: u8) -> Option<Cube> {
        self.solver.conjugate(cube, symmetry)
    }
}

#[inline(always)]
fn prefetch_probe(words: &[u32], probe: Opt11Probe) {
    #[cfg(all(target_arch = "x86_64", not(target_family = "wasm")))]
    crate::prefetch::read_word(words, probe.index);

    #[cfg(all(target_arch = "aarch64", not(target_family = "wasm")))]
    {
        let address = &words[probe.word] as *const u32;
        // SAFETY: the hint uses an in-bounds reference from the live borrowed
        // immutable allocation. It writes nothing and retains no pointer.
        unsafe {
            std::arch::asm!(
                "prfm pldl1keep, [{address}]",
                address = in(reg) address,
                options(readonly, nostack, preserves_flags),
            );
        }
    }

    #[cfg(not(all(not(target_family = "wasm"), any(target_arch = "aarch64", target_arch = "x86_64"))))]
    let _ = (words, probe); // Non-baseline policies are rejected by the constructor.
}

#[cfg(any(
    feature = "wasm-batch-probes",
    all(any(feature = "opt10-native-batch", feature = "opt11-native-batch"), not(target_family = "wasm")),
))]
#[derive(Clone, Copy, Default)]
struct ProbeWords {
    primary: u32,
    minimum: u32,
}

/// Do not fold decoding into this pass under LTO. Both word addresses are
/// known before the primary load; preloading the minimum removes a conditional
/// load dependency at the cost of an extra read when the code is nonzero.
/// That tradeoff is experimental, not an assumed improvement.
#[cfg(any(
    feature = "wasm-batch-probes",
    all(any(feature = "opt10-native-batch", feature = "opt11-native-batch"), not(target_family = "wasm")),
))]
#[inline(never)]
fn load_group(words: &[u32], probes: &[Option<Opt11Probe>; 8]) -> [ProbeWords; 8] {
    std::array::from_fn(|slot| probes[slot].map_or_else(ProbeWords::default, |probe| {
        let primary = words[probe.word];
        let minimum = if probe.word == probe.minimum_word { primary } else { words[probe.minimum_word] };
        ProbeWords { primary, minimum }
    }))
}

// Written for future authorization; no tests were executed in this task.
#[cfg(test)]
mod tests {
    use super::*;

    fn fixture() -> Opt11Table {
        // The repeated two-bit pattern holds codes 0, 1, 2 and 3. Only the
        // first two (invalid) cells of each 64-cell block hold the minimum.
        let mut words = vec![0xe4e4_e4e4; 64];
        for block in 0..16 {
            words[block * 4] = (words[block * 4] & !15) | (block % 11) as u32;
        }
        Opt11Table::lookup_fixture(words)
    }

    fn expected(index: u64) -> u8 {
        match index % 4 {
            0 => ((index / 64) % 11) as u8,
            1 => 11,
            2 => 12,
            _ => 13,
        }
    }

    #[test]
    fn prepared_read_and_prefetch_match_the_independent_packed_fixture() {
        let table = fixture();
        let original = table.immutable_words().to_vec();
        for policy in [Opt11LookupPolicy::Baseline, Opt11LookupPolicy::Prefetch] {
            if policy.check_available().is_err() { continue; }
            for index in 0..1024 {
                if !EoLayout::<11>::valid_index(index) { continue; }
                let probe = policy.prepare(&table, index);
                assert_eq!(policy.lookup(&table, probe), expected(index));
                assert_eq!(table.get(index), expected(index));
            }
        }
        assert_eq!(table.immutable_words(), original.as_slice());
        let zero = Opt11LookupPolicy::Baseline.prepare(&table, 4);
        assert_eq!(Opt11LookupPolicy::Baseline.lookup(&table, zero), 0);
    }

    #[test]
    fn preparation_rejects_padding_and_valid_coordinates_beyond_the_allocation() {
        let table = fixture();
        for index in [0, 1, 64, 65, 511, 512, 513, 1023, 1026, (1u64 << 32) + 2, EoLayout::<11>::COORDINATES, u64::MAX] {
            assert!(std::panic::catch_unwind(|| Opt11Probe::new(&table, index)).is_err());
        }
        // Do not turn a checked probe into an unchecked pointer: even reusing
        // one with an unrelated empty fixture must keep slice bounds checks.
        let probe = Opt11Probe::new(&table, 2);
        let empty = Opt11Table::lookup_fixture(Vec::new());
        assert!(std::panic::catch_unwind(|| Opt11LookupPolicy::Prefetch.lookup(&empty, probe)).is_err());
    }

    #[test]
    fn grouped_policy_rejects_a_binary_without_its_search_batch_feature() {
        let supported = cfg!(all(
            feature = "opt11-native-batch",
            not(target_family = "wasm"),
            any(target_arch = "aarch64", target_arch = "x86_64"),
        ));
        assert_eq!(Opt11LookupPolicy::Grouped.check_available().is_ok(), supported);
    }

    #[cfg(any(
        feature = "wasm-batch-probes",
        all(any(feature = "opt10-native-batch", feature = "opt11-native-batch"), not(target_family = "wasm")),
    ))]
    #[test]
    fn grouped_reads_keep_empty_slots_duplicates_zeroes_and_block_boundaries() {
        let table = fixture();
        let original = table.immutable_words().to_vec();
        // Exercise the grouped decoder directly: no full solver/snapshot is
        // constructed. Availability is independently checked above.
        let policy = Opt11LookupPolicy::Grouped;
        let empty = Opt11Table::lookup_fixture(Vec::new());
        assert_eq!(policy.lookup_batch(&empty, &[None; 8]), [0; 8]);
        for indices in [
            [2, 3, 4, 15, 16, 63, 66, 67],
            [2, 2, 2, 3, 4, 4, 4, 4],
            [496, 510, 514, 515, 516, 527, 528, 1022],
        ] {
            for mask in 0u16..256 {
                let probes: [Option<Opt11Probe>; 8] = std::array::from_fn(|slot| {
                    if mask & (1 << slot) == 0 { None } else { Some(Opt11Probe::new(&table, indices[slot])) }
                });
                let wanted: [u8; 8] = std::array::from_fn(|slot| {
                    if mask & (1 << slot) == 0 { 0 } else { expected(indices[slot]) }
                });
                assert_eq!(policy.lookup_batch(&table, &probes), wanted);
                assert_eq!(policy.lookup_batch(&table, &probes), probes.map(|p| p.map_or(0, |p| table.get(p.index))));
            }
        }
        assert_eq!(table.immutable_words(), original.as_slice());
    }
}

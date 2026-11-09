//! Opt-in x86 hints for immutable two-bit tables; no decoding or index changes.

#[inline(always)]
fn word_at(words: &[u32], index: u64) -> Option<&u32> {
    words.get(usize::try_from(index >> 4).ok()?)
}

/// SSE prefetch is available on every x86_64 CPU, independently of AVX mode.
/// Invalid coordinates receive no hint, leaving the checked decoder authoritative.
#[cfg(any(test, not(feature = "opt8-native-prefetch-nta"),
    feature = "opt1-7-native-prefetch", feature = "opt9-native-prefetch",
    feature = "opt10-native-prefetch-x86", feature = "opt11-lookup"))]
#[inline(always)]
pub(crate) fn read_word(words: &[u32], index: u64) {
    read_word_with_hint::<{ std::arch::x86_64::_MM_HINT_T0 }>(words, index);
}

/// Opt8-only candidate for sparse primary-table reads. The hint changes no
/// address, value or memory ownership, and makes no promise of a cache hit.
#[cfg(any(test, feature = "opt8-native-prefetch-nta"))]
#[inline(always)]
pub(crate) fn read_word_nta(words: &[u32], index: u64) {
    read_word_with_hint::<{ std::arch::x86_64::_MM_HINT_NTA }>(words, index);
}

#[inline(always)]
fn read_word_with_hint<const HINT: i32>(words: &[u32], index: u64) {
    if let Some(word) = word_at(words, index) {
        // SAFETY: this pointer comes from a live in-bounds immutable reference.
        // The read hint retains nothing and cannot supply a pruning bound.
        unsafe {
            std::arch::x86_64::_mm_prefetch(
                (word as *const u32).cast::<i8>(),
                HINT,
            );
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn hints_only_use_live_words_including_partial_last_cache_line() {
        let words = [0x0123_4567, 0x89ab_cdef, 0x55aa_55aa];
        for (index, offset) in [(0, 0), (15, 0), (16, 1), (32, 2), (47, 2)] {
            assert!(std::ptr::eq(word_at(&words, index).unwrap(), &words[offset]));
            read_word(&words, index);
            read_word_nta(&words, index);
        }
        for index in [48, 49, u64::MAX] {
            assert!(word_at(&words, index).is_none());
            read_word(&words, index);
            read_word_nta(&words, index);
        }
        assert!(word_at(&[], 0).is_none());
        read_word(&[], 0);
        read_word_nta(&[], 0);
        assert_eq!(words, [0x0123_4567, 0x89ab_cdef, 0x55aa_55aa]);
    }
}

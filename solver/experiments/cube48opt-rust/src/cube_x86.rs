use super::{Cube, PAIRED_MOVES};
use crate::x86_simd::{edges, store_edges};
use std::arch::x86_64::*;

/// Normal/inverse edge products occupy the two independent 128-bit lanes.
/// Corners share one 128-bit shuffle. No load or store exceeds a Cube object.
#[target_feature(enable = "avx2")]
pub(super) unsafe fn moved_pair_avx2(cube: &Cube, inverse: &Cube, movement: u8) -> (Cube, Cube) {
    let movement = &PAIRED_MOVES[usize::from(movement)];
    let source = _mm_unpacklo_epi64(_mm_loadl_epi64(cube.corners.as_ptr().cast()),
        _mm_loadl_epi64(movement.as_ptr().add(8).cast()));
    let rhs = _mm_unpacklo_epi64(_mm_loadl_epi64(movement.as_ptr().cast()),
        _mm_loadl_epi64(inverse.corners.as_ptr().cast()));
    let indices = _mm_or_si128(_mm_and_si128(rhs, _mm_set1_epi8(7)),
        _mm_set_epi64x(0x0808080808080808, 0));
    let corners = _mm_add_epi8(_mm_shuffle_epi8(source, indices), _mm_and_si128(rhs, _mm_set1_epi8(24)));
    let corners = _mm_min_epu8(corners, _mm_add_epi8(corners, _mm_set1_epi8(-24)));

    let source = _mm256_inserti128_si256::<1>(_mm256_castsi128_si256(edges(cube)),
        _mm_loadu_si128(movement.as_ptr().add(32).cast()));
    let rhs = _mm256_inserti128_si256::<1>(
        _mm256_castsi128_si256(_mm_loadu_si128(movement.as_ptr().add(16).cast())), edges(inverse));
    // Word shifts must mask cross-byte bits before PSHUFB indexing.
    let indices = _mm256_and_si256(_mm256_srli_epi16::<1>(rhs), _mm256_set1_epi8(15));
    let result = _mm256_xor_si256(_mm256_shuffle_epi8(source, indices),
        _mm256_and_si256(rhs, _mm256_set1_epi8(1)));
    let mut normal = Cube::SOLVED;
    let mut opposite = Cube::SOLVED;
    _mm_storel_epi64(normal.corners.as_mut_ptr().cast(), corners);
    _mm_storel_epi64(opposite.corners.as_mut_ptr().cast(), _mm_srli_si128::<8>(corners));
    store_edges(_mm256_castsi256_si128(result), &mut normal);
    store_edges(_mm256_extracti128_si256::<1>(result), &mut opposite);
    (normal, opposite)
}

/// Four independent 128-bit lanes: normal corners, inverse corners, normal
/// edges, inverse edges. AVX-512BW evaluates all four permutations together.
#[target_feature(enable = "avx2,avx512f,avx512bw,avx512vl")]
pub(super) unsafe fn moved_pair_avx512(cube: &Cube, inverse: &Cube, movement: u8) -> (Cube, Cube) {
    let movement = &PAIRED_MOVES[usize::from(movement)];
    let mut source = _mm512_castsi128_si512(_mm_loadl_epi64(cube.corners.as_ptr().cast()));
    source = _mm512_inserti32x4::<1>(source, _mm_loadl_epi64(movement.as_ptr().add(8).cast()));
    source = _mm512_inserti32x4::<2>(source, edges(cube));
    source = _mm512_inserti32x4::<3>(source, _mm_loadu_si128(movement.as_ptr().add(32).cast()));
    let mut rhs = _mm512_castsi128_si512(_mm_loadl_epi64(movement.as_ptr().cast()));
    rhs = _mm512_inserti32x4::<1>(rhs, _mm_loadl_epi64(inverse.corners.as_ptr().cast()));
    rhs = _mm512_inserti32x4::<2>(rhs, _mm_loadu_si128(movement.as_ptr().add(16).cast()));
    rhs = _mm512_inserti32x4::<3>(rhs, edges(inverse));
    let indices = _mm512_mask_blend_epi8(0xffffffff00000000,
        _mm512_and_si512(rhs, _mm512_set1_epi8(7)),
        _mm512_and_si512(_mm512_srli_epi16::<1>(rhs), _mm512_set1_epi8(15)));
    let shuffled = _mm512_shuffle_epi8(source, indices);
    let corners = _mm512_add_epi8(shuffled, _mm512_and_si512(rhs, _mm512_set1_epi8(24)));
    let corners = _mm512_min_epu8(corners, _mm512_add_epi8(corners, _mm512_set1_epi8(-24)));
    let edges = _mm512_xor_si512(shuffled, _mm512_and_si512(rhs, _mm512_set1_epi8(1)));
    let result = _mm512_mask_blend_epi8(0xffffffff00000000, corners, edges);
    let mut normal = Cube::SOLVED;
    let mut opposite = Cube::SOLVED;
    _mm_storel_epi64(normal.corners.as_mut_ptr().cast(), _mm512_castsi512_si128(result));
    _mm_storel_epi64(opposite.corners.as_mut_ptr().cast(), _mm512_extracti32x4_epi32::<1>(result));
    store_edges(_mm512_extracti32x4_epi32::<2>(result), &mut normal);
    store_edges(_mm512_extracti32x4_epi32::<3>(result), &mut opposite);
    (normal, opposite)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn avx_products_match_scalar_after_moves_inverses_and_side_swaps() {
        let mut implementations: Vec<unsafe fn(&Cube, &Cube, u8) -> (Cube, Cube)> = Vec::new();
        if std::is_x86_feature_detected!("avx2") { implementations.push(moved_pair_avx2); }
        if std::is_x86_feature_detected!("avx2") && std::is_x86_feature_detected!("avx512f")
            && std::is_x86_feature_detected!("avx512bw") && std::is_x86_feature_detected!("avx512vl") {
            implementations.push(moved_pair_avx512);
        }
        let mut cube = Cube::SOLVED;
        let mut seed = 0x12345678u32;
        for _ in 0..4096 {
            seed ^= seed << 13; seed ^= seed >> 17; seed ^= seed << 5;
            cube = cube.moved((seed % 18) as u8);
            let inverse = cube.inverse();
            for implementation in &implementations {
                for movement in 0..18 {
                    let pair = unsafe { implementation(&cube, &inverse, movement) };
                    assert_eq!(pair, (cube.moved(movement), inverse.premoved(movement)));
                    let swapped = unsafe { implementation(&pair.1, &pair.0, (movement + 7) % 18) };
                    assert_eq!(swapped.0.inverse(), swapped.1);
                }
            }
        }
    }
}

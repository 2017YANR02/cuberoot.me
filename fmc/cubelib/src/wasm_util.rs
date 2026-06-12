use std::arch::wasm32::{i8x16, u16x8_add, u16x8_shuffle, u32x4_add, u32x4_shuffle, u64x2, u8x16, u8x16_swizzle, v128, v128_or};

#[inline]
pub fn u8x16_set1(a: u8) -> v128 {
    u8x16(a, a, a, a, a, a, a, a, a, a, a, a, a, a, a, a)
}

#[inline]
pub fn complete_hsum_epi16(v: v128) -> v128 {
    let sum = hsum_narrow_epi16(v);
    let sum = hsum_narrow_epi16(sum);
    hsum_narrow_epi16(sum)
}

#[inline]
pub fn mm_sad_epu8(v: v128) -> v128 {
    let a = u8x16_swizzle(v, i8x16(0, -1, 2, -1, 4, -1, 6, -1, 8, -1, 10, -1, 12, -1, 14, -1));
    let b = u8x16_swizzle(v, i8x16(1, -1, 3, -1, 5, -1, 7, -1, 9, -1, 11, -1, 13, -1, 15, -1));
    let v = u16x8_add(a, b);

    let a = u16x8_shuffle::<0, 2, 4, 6, 8, 8, 8, 8>(v, u64x2(0, 0));
    let b = u16x8_shuffle::<1, 3, 5, 7, 8, 8, 8, 8>(v, u64x2(0, 0));
    let v = u16x8_add(a, b);

    let a = u16x8_shuffle::<0, 8, 8, 8, 2, 8, 8, 8>(v, u64x2(0, 0));
    let b = u16x8_shuffle::<1, 8, 8, 8, 3, 8, 8, 8>(v, u64x2(0, 0));
    u16x8_add(a, b)
}

#[inline]
pub fn hsum_narrow_epi16(v: v128) -> v128 {
    let a = u16x8_shuffle::<0, 2, 4, 6, 8, 8, 8, 8>(v, u64x2(0, 0));
    let b = u16x8_shuffle::<1, 3, 5, 7, 8, 8, 8, 8>(v, u64x2(0, 0));
    u16x8_add(a, b)
}

#[inline]
pub fn hsum_wide_epi32(v1: v128, v2: v128) -> v128 {
    let a0 = u32x4_shuffle::<0, 2, 4, 4>(v1, u64x2(0, 0));
    let a1 = u32x4_shuffle::<1, 3, 4, 4>(v1, u64x2(0, 0));

    let b0 = u32x4_shuffle::<4, 4, 0, 2>(v2, u64x2(0, 0));
    let b1 = u32x4_shuffle::<4, 4, 1, 3>(v2, u64x2(0, 0));

    u32x4_add(v128_or(a0, b0), v128_or(a1, b1))
}

#[inline]
pub fn hsum_narrow_epi32(v1: v128) -> v128 {
    let a0 = u32x4_shuffle::<0, 2, 4, 4>(v1, u64x2(0, 0));
    let a1 = u32x4_shuffle::<1, 3, 4, 4>(v1, u64x2(0, 0));

    u32x4_add(a0, a1)
}
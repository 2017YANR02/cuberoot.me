//! Exact in-memory generation of pt_cross_C4E0.bin, for a dedicated browser worker.
//!
//! Output is byte-for-byte compatible with prune_create::gen_pt_cross_c4e0:
//! CUBEPT01, 109,486,080 entries, even index in the low nibble. No file I/O,
//! threads, SIMD requirement, unsafe indexing, downloaded data or approximate distances.
//! The runtime is unchanged until a caller explicitly adopts this generator.
//!
//! BFS uses a short frontier queue, then packed scans, then backward neighbor
//! checks once most reachable states are known. All 18 moves are invertible,
//! so an unknown state's neighbor at depth d proves its exact distance is d+1.
//! Updates from the current pass have depth d+1 and cannot seed that same pass.
//! Full byte comparison and cold-worker timing: scripts/benchmark_xcross_table.mts.

use crate::cube_common::state_space;
use crate::prune_tables::PT_MAGIC;

const ENTRY_COUNT: usize = state_space::CROSS * 24 * 24;
// The queue contains at most the 21,535 states at depth 4. Larger queues did
// not improve stable timings and increase memory. Dense scanning starts at 5.
const QUEUE_UNTIL: u8 = 4;

#[inline]
fn packed_get(dist: &[u8], i: usize) -> u8 {
    (dist[i / 2] >> ((i & 1) * 4)) & 15
}

#[inline]
fn packed_put(dist: &mut [u8], i: usize, value: u8) {
    let s = (i & 1) * 4;
    dist[i / 2] = (dist[i / 2] & !(15 << s)) | (value << s);
}

#[inline]
// Independent four-bit lanes; unlike subtraction tricks, no borrow can
// create a false match in an adjacent nibble.
fn equal_nibbles(w: u64, value: u8) -> u64 {
    let x = w ^ ((value as u64) * 0x1111111111111111);
    !(((x & 0x7777777777777777).wrapping_add(0x7777777777777777)) | x | 0x7777777777777777)
        & 0x8888888888888888
}

#[inline]
// Explicit expansion removes loop/index overhead without unchecked accesses.
fn expand_rows(nd: u8, dist: &mut [u8], row: &[u32; 18], pr: &[u16; 18]) {
    macro_rules! step {
        ($m:expr) => {{
            let ni = row[$m] as usize + pr[$m] as usize;
            let bi = ni / 2;
            let shift = (ni & 1) * 4;
            let old = (dist[bi] >> shift) & 15;
            dist[bi] ^= (old ^ old.min(nd)) << shift;
        }};
    }
    step!(0);
    step!(1);
    step!(2);
    step!(3);
    step!(4);
    step!(5);
    step!(6);
    step!(7);
    step!(8);
    step!(9);
    step!(10);
    step!(11);
    step!(12);
    step!(13);
    step!(14);
    step!(15);
    step!(16);
    step!(17);
}

#[inline]
fn expand_rows_queue(
    nd: u8,
    dist: &mut [u8],
    row: &[u32; 18],
    pr: &[u16; 18],
    queue: &mut Vec<u32>,
) {
    for m in 0..18 {
        let ni = row[m] as usize + pr[m] as usize;
        if packed_get(dist, ni) == 15 {
            packed_put(dist, ni, nd);
            queue.push(ni as u32);
        }
    }
}

#[inline]
fn reverse_rows(d: u8, dist: &[u8], row: &[u32; 18], pr: &[u16; 18]) -> bool {
    if packed_get(dist, row[0] as usize + pr[0] as usize) == d {
        return true;
    }
    if packed_get(dist, row[1] as usize + pr[1] as usize) == d {
        return true;
    }
    if packed_get(dist, row[2] as usize + pr[2] as usize) == d {
        return true;
    }
    if packed_get(dist, row[3] as usize + pr[3] as usize) == d {
        return true;
    }
    if packed_get(dist, row[4] as usize + pr[4] as usize) == d {
        return true;
    }
    if packed_get(dist, row[5] as usize + pr[5] as usize) == d {
        return true;
    }
    if packed_get(dist, row[6] as usize + pr[6] as usize) == d {
        return true;
    }
    if packed_get(dist, row[7] as usize + pr[7] as usize) == d {
        return true;
    }
    if packed_get(dist, row[8] as usize + pr[8] as usize) == d {
        return true;
    }
    if packed_get(dist, row[9] as usize + pr[9] as usize) == d {
        return true;
    }
    if packed_get(dist, row[10] as usize + pr[10] as usize) == d {
        return true;
    }
    if packed_get(dist, row[11] as usize + pr[11] as usize) == d {
        return true;
    }
    if packed_get(dist, row[12] as usize + pr[12] as usize) == d {
        return true;
    }
    if packed_get(dist, row[13] as usize + pr[13] as usize) == d {
        return true;
    }
    if packed_get(dist, row[14] as usize + pr[14] as usize) == d {
        return true;
    }
    if packed_get(dist, row[15] as usize + pr[15] as usize) == d {
        return true;
    }
    if packed_get(dist, row[16] as usize + pr[16] as usize) == d {
        return true;
    }
    if packed_get(dist, row[17] as usize + pr[17] as usize) == d {
        return true;
    }
    false
}

/// Return the complete canonical .bin bytes. The callback reports completed BFS
/// passes (0..=9); its count is processed frontier states through pass 7, then
/// newly resolved distances 9 and 10. Run this synchronously in a worker.
pub fn generate(mut on_layer: impl FnMut(u8, usize)) -> Vec<u8> {
    let ed = crate::mt_gen::create_mt_edge();
    let cn = crate::mt_gen::create_mt_corn();
    let basic: Vec<i32> = ed.iter().map(|&x| x as i32).collect();
    // Canonical move generation, using its dense 18-column representation.
    // The native 24-column mt_edge4 and all on-disk assets remain unchanged.
    let mt =
        crate::cube_common::create_multi_move_table(4, 2, 12, state_space::CROSS as i32, &basic);
    let t2 = cn.as_slice();
    let t3 = ed.as_slice();
    let total = ENTRY_COUNT;
    let mut bin = vec![255u8; total / 2 + 16];
    let dist = &mut bin[16..];
    // E marks physically impossible overlap with a cross edge; F means unknown.
    // This avoids probing unreachable states in the backward pass.
    for cr in 0..state_space::CROSS {
        let mut p = [0i32; 4];
        crate::cube_common::index_to_array(&mut p, cr as i32, 4, 2, 12);
        for v in p {
            let e = v as usize / 36 * 2;
            for c in 0..24 {
                let b = (cr * 24 + c) * 24 + e;
                dist[b / 2] = 0xee;
            }
        }
    }
    let mut pair = vec![0u16; 576 * 18];
    for c in 0..24 {
        for e in 0..24 {
            for m in 0..18 {
                pair[(c * 24 + e) * 18 + m] = (t2[c * 18 + m] * 24 + t3[e * 18 + m]) as u16;
            }
        }
    }
    let start = (state_space::CROSS_SOLVED * 24 + 12) * 24;
    packed_put(dist, start, 0);
    let mut queue = vec![start as u32];
    let mut tail = Vec::new();
    for d in 0..10u8 {
        let mut cnt = 0;
        if d <= QUEUE_UNTIL || d == 9 {
            let mut next = Vec::new();
            let states = if d == 9 { &tail } else { &queue };
            for &i in states {
                let i = i as usize;
                let cr = i / 576;
                let pe = i % 576;
                let mut row = [0u32; 18];
                for m in 0..18 {
                    row[m] = mt[cr * 18 + m] as u32 * 576;
                }
                let pr: &[u16; 18] = pair[pe * 18..pe * 18 + 18].try_into().unwrap();
                if d == 9 {
                    if reverse_rows(d, dist, &row, pr) {
                        packed_put(dist, i, d + 1);
                        cnt += 1;
                    }
                } else {
                    if d < QUEUE_UNTIL {
                        expand_rows_queue(d + 1, dist, &row, pr, &mut next);
                    } else {
                        expand_rows(d + 1, dist, &row, pr);
                    }
                    cnt += 1;
                }
            }
            queue = next;
        } else {
            for cr in 0..state_space::CROSS {
                let mut row = [0u32; 18];
                for m in 0..18 {
                    row[m] = mt[cr * 18 + m] as u32 * 576;
                }
                for offset in (0..576).step_by(16) {
                    let b = cr * 288 + offset / 2;
                    let mut mask = equal_nibbles(
                        u64::from_le_bytes(dist[b..b + 8].try_into().unwrap()),
                        if d >= 8 { 15 } else { d },
                    );
                    while mask != 0 {
                        let pe = offset + mask.trailing_zeros() as usize / 4;
                        let i = cr * 576 + pe;
                        mask &= mask - 1;
                        let pr: &[u16; 18] = pair[pe * 18..pe * 18 + 18].try_into().unwrap();
                        if d >= 8 {
                            if reverse_rows(d, dist, &row, pr) {
                                packed_put(dist, i, d + 1);
                                cnt += 1;
                            } else {
                                tail.push(i as u32);
                            }
                        } else {
                            expand_rows(d + 1, dist, &row, pr);
                            cnt += 1;
                        }
                    }
                }
            }
        }
        if d == 9 {
            assert_eq!(cnt, tail.len(), "incomplete XCross distances");
        }
        on_layer(d, cnt);
    }
    // Only unreachable E and the original unreachable F have all three high
    // nibble bits set. Convert E to F, leaving every exact distance untouched.
    for b in (0..total / 2).step_by(8) {
        let w = u64::from_le_bytes(dist[b..b + 8].try_into().unwrap());
        let out = w | ((w >> 1) & (w >> 2) & (w >> 3) & 0x1111111111111111);
        dist[b..b + 8].copy_from_slice(&out.to_le_bytes());
    }
    bin[..8].copy_from_slice(PT_MAGIC);
    bin[8..16].copy_from_slice(&(total as u64).to_le_bytes());
    bin
}

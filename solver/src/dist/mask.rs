//! 28 个 popcount==2 的 8-bit mask + 28×28 disjoint adjacency
//!
//! 在 8 个 free corner / 8 个 free edge 上"选 2 个"的所有组合 C(8,2) = 28。
//! 节点 id = mc_idx * 28 + me_idx,共 784 个节点;
//! 邻居 = mc'/me' 各自与 mc/me 不相交的所有 (k*28+l)。每节点 |adj| = C(6,2)^2 = 225,
//! 总邻居数 = 784 × 225 = 176,400。

/// 28 个 popcount==2 的 8-bit mask(按数值递增顺序)
pub const NUM_MASKS: usize = 28;
pub const ADJ_PER_NODE: usize = 15 * 15; // C(6,2)^2
pub const TOTAL_ADJ: usize = NUM_MASKS * NUM_MASKS * ADJ_PER_NODE;

pub fn masks_2bits() -> [u8; NUM_MASKS] {
    let mut out = [0u8; NUM_MASKS];
    let mut idx = 0;
    let mut m: u32 = 0;
    while m < 256 {
        if m.count_ones() == 2 {
            out[idx] = m as u8;
            idx += 1;
        }
        m += 1;
    }
    out
}

/// `lookup[i] = [b0, b1]` mask i 的两个置位 bit 位置(b0 < b1)
pub fn mask_lookup() -> [[u8; 2]; NUM_MASKS] {
    let masks = masks_2bits();
    let mut out = [[0u8; 2]; NUM_MASKS];
    for i in 0..NUM_MASKS {
        let m = masks[i];
        let mut k = 0;
        for b in 0..8u8 {
            if (m >> b) & 1 == 1 {
                out[i][k] = b;
                k += 1;
            }
        }
    }
    out
}

/// 不相交邻接表平铺。返回 `(flat, offsets)`,`flat[offsets[i]..offsets[i+1]]` 是节点 i 的邻居。
///
/// 节点 id 编码 = mc_idx * 28 + me_idx ∈ [0, 784)
pub fn disjoint_adj_28x28() -> (Vec<u16>, Vec<u32>) {
    let masks = masks_2bits();
    let mut flat: Vec<u16> = Vec::with_capacity(TOTAL_ADJ);
    let mut off: Vec<u32> = Vec::with_capacity(NUM_MASKS * NUM_MASKS + 1);
    off.push(0);
    for i in 0..NUM_MASKS {
        let mc = masks[i];
        for j in 0..NUM_MASKS {
            let me = masks[j];
            for k in 0..NUM_MASKS {
                if masks[k] & mc != 0 {
                    continue;
                }
                for l in 0..NUM_MASKS {
                    if masks[l] & me != 0 {
                        continue;
                    }
                    flat.push((k * NUM_MASKS + l) as u16);
                }
            }
            off.push(flat.len() as u32);
        }
    }
    debug_assert_eq!(flat.len(), TOTAL_ADJ);
    debug_assert_eq!(off.len(), NUM_MASKS * NUM_MASKS + 1);
    (flat, off)
}

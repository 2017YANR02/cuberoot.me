// /stack setup hot loop — port of twister.ts setup() 内层 rotate 应用。
// 输入全部是 typed-array 视图,kernel 内零分配。每次 setup() 一次 JS→WASM 调用。
//
// 数据约定 (跟 twister.ts 完全对齐):
//   dispatch = axisIdx*4 + t01  ∈ {1,2,3,5,6,7,9,10,11}  (axisIdx ∈ {0,1,2}, t01 ∈ {1,2,3})
//   坐标轴 0=x, 1=y, 2=z
//   旋转矩阵: 见 dispatch 表 (从 twister.ts switch 直译)
//   groupId = axisIdx*N + layer  ∈ [0, 3*N)
//   group_indices_offsets: [G+1],  offsets[g+1] - offsets[g] = group g 的 indices 长度
//   rotates_desc: 每个 rotate 占 2 个 u32: [dispatch, groupId]

use wasm_bindgen::prelude::*;

// SAFETY 总策略:输入 ptr/len 来自 wasm-bindgen 拷贝过来的 JS typed array,所有 index 来源已在
// JS 侧 / cube 数据结构层面校验过。热内层 bounds check × N=200 ~3 billion 次太贵,直接 get_unchecked。
//
// 诊断 variant: apply_rotates_no_flat
// - 跳过 flat 读 (gather: slice_insts[i] = i,假数据但 iter 数等于真实)
// - 跳过 flat 写
// - cube state 一定崩,但用来量「假如 perSlab 完全消掉 flat 32MB random scatter,能拿多少」
#[wasm_bindgen]
pub fn apply_rotates_no_flat(
    rotates_desc: &[u32],
    group_indices_flat: &[i32],
    group_indices_offsets: &[u32],
    vec_x: &mut [f32],
    vec_y: &mut [f32],
    vec_z: &mut [f32],
    rot_idx: &mut [u8],
    flat: &mut [i32],  // 留着保持 ABI 一致;不写
    slice_insts: &mut [i32],
    cube_compose: &[u8],
    order: u32,
) {
    let order_i = order as i32;
    let _half_f = (order_i - 1) as f32 / 2.0;
    let n_rotates = rotates_desc.len() / 2;
    let _ = flat;  // 标记不用
    let _ = group_indices_flat;

    unsafe {
        let rd_ptr = rotates_desc.as_ptr();
        let go_ptr = group_indices_offsets.as_ptr();
        let vx_ptr = vec_x.as_mut_ptr();
        let vy_ptr = vec_y.as_mut_ptr();
        let vz_ptr = vec_z.as_mut_ptr();
        let ri_ptr = rot_idx.as_mut_ptr();
        let si_ptr = slice_insts.as_mut_ptr();
        let cc_ptr = cube_compose.as_ptr();

        for r in 0..n_rotates {
            let dispatch = *rd_ptr.add(r * 2) as usize;
            let group_id = *rd_ptr.add(r * 2 + 1) as usize;

            let off_start = *go_ptr.add(group_id) as usize;
            let off_end = *go_ptr.add(group_id + 1) as usize;
            let slice_len = off_end - off_start;

            // 假 gather:slice_insts[i] = i % vis_count,iter 数对齐但跳 flat 读
            for i in 0..slice_len {
                *si_ptr.add(i) = i as i32;
            }

            let mut srow = [0u8; 24];
            for k in 0..24 {
                srow[k] = *cc_ptr.add(k * 12 + dispatch);
            }

            for i in 0..slice_len {
                let inst_idx = *si_ptr.add(i) as usize;
                let ox = *vx_ptr.add(inst_idx);
                let oy = *vy_ptr.add(inst_idx);
                let oz = *vz_ptr.add(inst_idx);
                let (nx, ny, nz) = match dispatch {
                    1  => (ox,   oz,  -oy),
                    2  => (ox,  -oy,  -oz),
                    3  => (ox,  -oz,   oy),
                    5  => (-oz,  oy,   ox),
                    6  => (-ox,  oy,  -oz),
                    7  => (oz,   oy,  -ox),
                    9  => (oy,  -ox,   oz),
                    10 => (-ox, -oy,   oz),
                    11 => (-oy,  ox,   oz),
                    _  => (ox,   oy,   oz),
                };
                *vx_ptr.add(inst_idx) = nx;
                *vy_ptr.add(inst_idx) = ny;
                *vz_ptr.add(inst_idx) = nz;
                // 跳 flat 写
                let old = *ri_ptr.add(inst_idx) as usize;
                *ri_ptr.add(inst_idx) = *srow.get_unchecked(old);
            }
        }
    }
}

#[wasm_bindgen]
pub fn apply_rotates(
    rotates_desc: &[u32],
    group_indices_flat: &[i32],
    group_indices_offsets: &[u32],
    vec_x: &mut [f32],
    vec_y: &mut [f32],
    vec_z: &mut [f32],
    rot_idx: &mut [u8],
    flat: &mut [i32],
    slice_insts: &mut [i32],
    cube_compose: &[u8],
    order: u32,
) {
    let order_i = order as i32;
    let order2 = order_i * order_i;
    // half 必须用 f32:偶数 N (e.g. 200) 时 cubelet vec 分量是 half-integer
    // (-99.5..+99.5),JS 侧 (order-1)/2 = 99.5。整数除会丢精度 →
    // 后续 (nz as i32 + half) 把 99.5 截成 99 再加 99 = 198,正确应是 199 → flat 位置写错。
    let half_f = (order_i - 1) as f32 / 2.0;
    let order_us = order_i as usize;
    let order2_us = order2 as usize;
    let n_rotates = rotates_desc.len() / 2;

    unsafe {
        let rd_ptr = rotates_desc.as_ptr();
        let gi_ptr = group_indices_flat.as_ptr();
        let go_ptr = group_indices_offsets.as_ptr();
        let vx_ptr = vec_x.as_mut_ptr();
        let vy_ptr = vec_y.as_mut_ptr();
        let vz_ptr = vec_z.as_mut_ptr();
        let ri_ptr = rot_idx.as_mut_ptr();
        let fl_ptr = flat.as_mut_ptr();
        let si_ptr = slice_insts.as_mut_ptr();
        let cc_ptr = cube_compose.as_ptr();

        for r in 0..n_rotates {
            let dispatch = *rd_ptr.add(r * 2) as usize;
            let group_id = *rd_ptr.add(r * 2 + 1) as usize;

            let off_start = *go_ptr.add(group_id) as usize;
            let off_end = *go_ptr.add(group_id + 1) as usize;
            let slice_len = off_end - off_start;

            // gather: position → instIdx (flat 存 instIdx+1,0=空)
            for i in 0..slice_len {
                let pos = *gi_ptr.add(off_start + i) as usize;
                *si_ptr.add(i) = *fl_ptr.add(pos) - 1;
            }

            // 把这次 rotate 的 24 项 compose row 提到栈上,内层只要查表 1 次。
            let mut srow = [0u8; 24];
            for k in 0..24 {
                srow[k] = *cc_ptr.add(k * 12 + dispatch);
            }

            for i in 0..slice_len {
                let inst_idx = *si_ptr.add(i) as usize;
                let ox = *vx_ptr.add(inst_idx);
                let oy = *vy_ptr.add(inst_idx);
                let oz = *vz_ptr.add(inst_idx);
                let (nx, ny, nz) = match dispatch {
                    1  => (ox,   oz,  -oy),
                    2  => (ox,  -oy,  -oz),
                    3  => (ox,  -oz,   oy),
                    5  => (-oz,  oy,   ox),
                    6  => (-ox,  oy,  -oz),
                    7  => (oz,   oy,  -ox),
                    9  => (oy,  -ox,   oz),
                    10 => (-ox, -oy,   oz),
                    11 => (-oy,  ox,   oz),
                    _  => (ox,   oy,   oz),
                };
                *vx_ptr.add(inst_idx) = nx;
                *vy_ptr.add(inst_idx) = ny;
                *vz_ptr.add(inst_idx) = nz;
                // (n* + half_f) 在偶数/奇数 N 上都是非负整数 (合法 cubelet 位置),
                // f32 → usize cast 直接落到正确槽位。
                let new_pos = (nz + half_f) as usize * order2_us
                    + (ny + half_f) as usize * order_us
                    + (nx + half_f) as usize;
                *fl_ptr.add(new_pos) = inst_idx as i32 + 1;
                let old = *ri_ptr.add(inst_idx) as usize;
                *ri_ptr.add(inst_idx) = *srow.get_unchecked(old);
            }
        }
    }
}

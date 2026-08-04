//! dist_tracked:「盯住这几块角 + 这几条棱」这一族阶段的完整深度分布,一个 bin 全包。
//!
//! 十字 / 122 / 123 / 222 / 223 / XCross / F2LEO 十字 / EO / EOLine / EOXCross —— 站内
//! `/scramble/stats` 的「完整状态空间」数据集里,固定单帧那一列基本都是这个形状:
//! 若干块角(位置+朝向)、若干条棱(位置+朝向,或只位置 + 一个整体翻转字),归位即达标。
//!
//! ## 坐标
//!
//! 状态 = A 因子 × B 因子,`idx = a * |B| + b`,BFS 走 `dist::packed4`(4-bit nibble)。
//! 每个因子由若干「分量」串起来(分量之间就是笛卡尔积):
//!   Corners(k)   P(8,k)·3^k       create_multi_move_table(k, 3, 8, ..)
//!   Edges(m)     P(12,m)·2^m      create_multi_move_table(m, 2, 12, ..)
//!   EdgePos(m)   P(12,m)          create_multi_move_table(m, 1, 12, ..)   翻转交给 EoWord
//!   EoWord       2,048            mt_eo12
//!   EdgeSet(m)   C(12,m)·2^m      本文件现算;m 条棱**互不区分**,只盯占位与翻转
//!
//! 目标集还有两个开关(都只改 `starts`,不动坐标):
//!   fold_y     并上 y 共轭那份目标 = 两条 EO 轴取最短(站内 F2LEO 一族的口径)
//!   d_offset   目标集按 D/D2/D' 闭包 = 伪口径(底层拼好即可,偏一格不算错)
//!
//! **`EdgeSet` 是这一族最省的一刀**:目标只要求那几条棱「朝向好」时,它们谁是谁根本不
//! 参与判定,而转动对翻转的作用只看位不看是谁 —— m! 种贴法是同一个态。F2LEO 十字因此
//! 从 51 亿掉到 2.13 亿(逐档 ×m! 还原),11.2 GB 的活变成 753 MB、2.6 秒。
//!
//! 拆两个因子不是为了好看,是为了**转动表**:8 条棱的精确坐标是 51 亿,转动表 368 GB,
//! 根本建不出来;拆成 4+4 两个 190,080 的因子后转动表各 13 MB,代价是乘积空间(361 亿)
//! 大于真实空间(51 亿)—— 多出来的是「两块占同一个位」的非法态,BFS 从合法目标出发永远
//! 走不到它们,所以计数仍然精确,只是 visited 位图买大了。**总数对不上 = 有 bug**,
//! 每个 preset 都把真实总数写死在 `states` 里逐次核对。
//!
//! ## 已核对(每次跑都断言,不看脸色)
//!
//!   cross        190,080   1,15,158,1394,9809,46381,97254,34966,102
//!   pseudo_cross 190,080   4,48,440,3576,21492,74660,81780,8064,16
//!   122           12,672   1,9,78,590,2922,6523,2525,24
//!   222          253,440   1,9,90,852,7169,44182,131636,68940,561
//!   123        5,322,240   1,12,132,1406,14099,122279,797145,2638638,1715068,33460
//!   xcross    72,990,720   1,15,172,1950,...,16325184,36022
//!   eo             2,048   1,2,25,202,620,900,285,13
//!   eoline       270,336   1,9,91,851,6831,41703,130239,88683,1927,1
//!
//! 来源都在别处:TS 端两台互不相干的引擎(`lib/cross-trainer/{dist,block,tracked,eoline}.ts`)、
//! 本仓库 `dist_cross_1col` / `dist_xcross_1col_fixed`,伪十字那条是站内 `pseudo_cross.unfixed.W`
//! (12!·2¹¹ 全空间口径)整除 5,160,960 得来的 —— 它盯的是 `d_offset`。
//!
//! 另外三条不是对金标,是对**恒等式**:
//!   cross_y                同一条十字曲线并上 y 共轭目标应当原封不动 → 盯 `fold_y` 的 σ
//!   f2leo1 vs _split       一个因子混口径 vs 拆两个因子 → 盯 HomeThenOriented + 非法乘积态
//!   f2leo2 vs _set         两棱可区分 vs 按集合 → 逐档正好 2 倍,盯 `EdgeSet`
//!
//! 跑 `dist_tracked verify` 一次全过一遍(~10s)。
//!
//! ## 还没跑的(见 solver/EXACT_DIST_EXPANSION.md)
//!
//!   223         E1  1,532,805,120   nibble 766 MB   ✅ 已跑
//!   eo_xcross   E2  4,671,406,080   nibble 2.3 GB   ✅ 已跑
//!   f2leo_cross E3    212,889,600   nibble 753 MB   ✅ 已跑(EdgeSet 商掉 4!,×24 还原)
//!
//! ## 用法
//!
//! ```text
//! dist_tracked                # 列出所有 preset 与规模
//! dist_tracked verify         # 跑便宜 preset,对金标 + 对恒等式
//! dist_tracked 223            # 跑单个 preset(大的要 CUBE_ALLOW_HUGE_TABLES=1)
//! ```

use std::time::Instant;

use cube_solver::cube_common::{array_to_index, create_multi_move_table, index_to_array, rot_map};
use cube_solver::dist::packed4::bfs_multi_packed4;
use cube_solver::move_tables;

/// 本机重活线程上限(项目规矩:不吃满核)。
const MAX_THREADS: usize = 14;
/// 超过这个态数就要显式开 huge 开关(nibble ≈ states/2 字节)。
const HUGE_STATES: u64 = 1 << 31;

// ── 块编号(DEFINITIONS.md)──────────────────────────────────────────────────
// 角 0..7 = UBL UBR UFR UFL DBL DBR DFR DFL;棱 0..11 = BL BR FR FL UB UR UF UL DB DR DF DL
const C_DBL: i32 = 4;
const C_DFL: i32 = 7;
const E_BL: i32 = 0;
const E_BR: i32 = 1;
const E_FR: i32 = 2;
const E_FL: i32 = 3;
const E_DB: i32 = 8;
const E_DR: i32 = 9;
const E_DF: i32 = 10;
const E_DL: i32 = 11;

/// 一个分量:盯住哪几块,以及是否连朝向一起盯。
#[derive(Clone)]
enum Comp {
    /// k 块角,位置 + 朝向。
    Corners(Vec<i32>),
    /// m 条棱,位置 + 翻转。
    Edges(Vec<i32>),
    /// m 条棱,只盯位置(翻转由 EoWord 那一份统一管)。
    EdgePos(Vec<i32>),
    /// 12 条棱的整体翻转字(2,048)。
    EoWord,
    /// m 条**互不区分**的棱:只盯「它们占了哪 m 个位、各自翻转如何」,不盯谁是谁。
    ///
    /// 目标是「这几条都朝向好」(`OrientedAnywhere`)时,给它们贴什么标签根本不影响
    /// 是否达标;而一条转动对翻转的作用只看**位**和转动、与是谁无关(F/B 面翻那四条,
    /// 其余不翻)。所以「换个贴法」是状态图的自同构、目标集在它下面封闭,距离在每条
    /// 轨道上是常数 —— 商掉这 m! 种贴法,得到的每一档计数正好是原来的 1/m!。
    ///
    /// 省下来的是数量级:F2LEO 十字那四条中层棱按可区分算是 P(12,4)·2⁴ = 190,080,
    /// 按集合算是 C(12,4)·2⁴ = 7,920,整问题从 51 亿掉到 2.13 亿。
    EdgeSet(Vec<i32>),
}

/// 棱位数。EdgeSet 的子集掩码在这 12 位上取。
const NE: usize = 12;

/// C(12,k) 个 k 子集:掩码表(升序)+ 掩码 → 编号。
fn comb_masks(k: usize) -> (Vec<u32>, Vec<i32>) {
    let mut list = Vec::new();
    let mut rank = vec![-1i32; 1 << NE];
    for mask in 0u32..(1 << NE) {
        if mask.count_ones() as usize == k {
            rank[mask as usize] = list.len() as i32;
            list.push(mask);
        }
    }
    (list, rank)
}

/// EdgeSet 索引 = 子集编号 · 2^k + 翻转字(第 i 位 = **第 i 小**的占位上那条棱的翻转)。
/// 翻转在低位,与其余分量一致 —— 「全朝向好」就是 2^k 的整数倍。
fn edge_set_decode(index: usize, k: usize, masks: &[u32]) -> (Vec<i32>, Vec<i32>) {
    let mask = masks[index >> k];
    let flips = index & ((1 << k) - 1);
    let mut pos = Vec::with_capacity(k);
    let mut ori = Vec::with_capacity(k);
    for p in 0..NE {
        if mask >> p & 1 == 1 {
            ori.push((flips >> pos.len() & 1) as i32);
            pos.push(p as i32);
        }
    }
    (pos, ori)
}

fn edge_set_encode(pairs: &mut [(i32, i32)], k: usize, rank: &[i32]) -> usize {
    pairs.sort_unstable();
    let mut mask = 0u32;
    let mut flips = 0usize;
    for (i, &(p, o)) in pairs.iter().enumerate() {
        mask |= 1 << p;
        flips |= (o as usize) << i;
    }
    (rank[mask as usize] as usize) << k | flips
}

/// 目标口径:分量在目标态里被要求成什么样。
#[derive(Clone, Copy, PartialEq)]
enum GoalKind {
    /// 归位且朝向正确(唯一一个索引)。
    Solved,
    /// 只要求朝向正确,位置随意 —— F2LEO 的中层四棱就是这个口径。
    OrientedAnywhere,
    /// 前 k 块归位,其余只要求朝向正确 —— 一个分量里两种口径混着的时候用
    /// (F2LEO 十字拆 6+2 时,那 6 条里 4 条十字棱要归位、2 条中层棱只要朝向对)。
    HomeThenOriented(usize),
}

struct Spec {
    name: &'static str,
    /// 一句话说清这个 preset 是什么阶段的什么帧。
    what: &'static str,
    a: Vec<(Comp, GoalKind)>,
    b: Vec<(Comp, GoalKind)>,
    /// 真实(合法)态数 —— 乘积空间可能更大,总数对不上就是 bug。
    states: u64,
    /// 商掉了多少(EdgeSet 那 m! 种贴法)。每档计数 × scale 就回到站内那个分母;
    /// 1 = 没商,算出来的就是站内口径。
    scale: u64,
    /// 目标集再并上「y 共轭那一份」—— 底面定死之后 EO 还剩两条轴(差一个 y 旋转),
    /// 站内口径对这两条取最短。false = 只算固定那一条轴(是上界,不是站内那条曲线)。
    fold_y: bool,
    /// 伪口径:目标集按 D / D2 / D' 闭包一次 —— 底层拼好即可,整体绕 D 轴偏一格不算错
    /// (F2L 阶段用 AUF 补回)。D 只动底层,中层那几条棱不受影响。
    d_offset: bool,
    /// 已知曲线;None = 这一条正是要跑出来的。
    golden: Option<&'static [u64]>,
}

/// 「换一条 EO 轴」在同一个坐标里怎么写:y 共轭是状态图的自同构,
/// `d(x, 轴2目标) = d(y x y⁻¹, 轴1目标)`,所以只要把目标集换成 σ⁻¹(轴1目标) 就行,
/// 一次多源 BFS 直接给出两条轴取最短 —— 不必跑两遍再逐格取 min。
///
/// σ 不手推(棱朝向约定是最容易悄悄写反的东西),而是**由恒等式传播定出**:
/// 归位态是整体旋转的不动点,再沿转动逐条推 `σ(x·m) = σ(x)·rot(m)`。
/// 每条边都会被对一次,对不上当场炸 —— 这不是近似,是恒等式。
///
/// 只有当因子盯的那组块在 y 下**整体不变**时才成立(十字四棱、E 层四棱都满足)。
fn rot_sigma(size: usize, mt: &[i32], solved: usize, rmap: &[u8; 18]) -> Vec<u32> {
    let mut sigma = vec![u32::MAX; size];
    sigma[solved] = solved as u32;
    let mut q = vec![solved];
    let mut head = 0;
    while head < q.len() {
        let x = q[head];
        head += 1;
        for m in 0..18 {
            let nx = mt[x * 18 + m] as usize;
            let img = mt[sigma[x] as usize * 18 + rmap[m] as usize] as u32;
            if sigma[nx] == u32::MAX {
                sigma[nx] = img;
                q.push(nx);
            } else {
                assert_eq!(sigma[nx], img, "σ 不自洽(size={})", size);
            }
        }
    }
    assert!(sigma.iter().all(|&v| v != u32::MAX), "σ 没盖满整个因子(size={})", size);
    // y 是 4 阶的,σ 也必须是 —— 与上面的传播互相独立,错了逮得住。
    for x in 0..size {
        let mut v = x as u32;
        for _ in 0..4 {
            v = sigma[v as usize];
        }
        assert_eq!(v as usize, x, "σ⁴ ≠ 恒等(size={})", size);
    }
    sigma
}

fn invert(p: &[u32]) -> Vec<u32> {
    let mut inv = vec![0u32; p.len()];
    for (i, &v) in p.iter().enumerate() {
        inv[v as usize] = i as u32;
    }
    inv
}

impl Comp {
    /// (n, c, pn):n 块、c 个朝向、总共 pn 块。EoWord 不走 multi_move_table,单列。
    fn dims(&self) -> Option<(i32, i32, i32)> {
        match self {
            Comp::Corners(v) => Some((v.len() as i32, 3, 8)),
            Comp::Edges(v) => Some((v.len() as i32, 2, 12)),
            Comp::EdgePos(v) => Some((v.len() as i32, 1, 12)),
            Comp::EoWord | Comp::EdgeSet(_) => None,
        }
    }

    fn size(&self) -> usize {
        if let Comp::EdgeSet(v) = self {
            let k = v.len();
            let mut c = 1usize; // C(12,k)
            for i in 0..k {
                c = c * (NE - i) / (i + 1);
            }
            return c << k;
        }
        match self.dims() {
            Some((n, c, pn)) => {
                let mut s = 1usize;
                for i in 0..n {
                    s *= (pn - i) as usize;
                }
                s * (c as usize).pow(n as u32)
            }
            None => 2048,
        }
    }

    /// 该分量的转动表(stride 18,值 = 下一个索引)。
    fn move_table(&self) -> Vec<i32> {
        let mgr = move_tables::instance();
        match self {
            Comp::Corners(v) => {
                let basic: Vec<i32> = mgr.ensure_corn().as_u32().iter().map(|&x| x as i32).collect();
                create_multi_move_table(v.len() as i32, 3, 8, self.size() as i32, &basic)
            }
            // 6 条棱那张 3 GB 表走 manager(磁盘缓存,别每次重算 ~70s);其余现算,毫秒级。
            Comp::Edges(v) if v.len() == 6 => {
                mgr.ensure_edge6().as_u32().iter().map(|&x| x as i32).collect()
            }
            Comp::Edges(v) => {
                let basic: Vec<i32> = mgr.ensure_edge().as_u32().iter().map(|&x| x as i32).collect();
                create_multi_move_table(v.len() as i32, 2, 12, self.size() as i32, &basic)
            }
            Comp::EdgePos(v) => {
                let basic: Vec<i32> = mgr.ensure_ep1().as_u32().iter().map(|&x| x as i32).collect();
                create_multi_move_table(v.len() as i32, 1, 12, self.size() as i32, &basic)
            }
            // eo12 的值预乘了 18(给 SlotView 那套用),这里要的是原始索引 —— 走 alt 那张。
            Comp::EoWord => mgr.ensure_eo12_alt().as_u32().iter().map(|&x| x as i32).collect(),
            // 集合口径没有现成的 multi 表:逐态解出「哪几个位、各自翻转」,拿单棱表
            // mt_edge(下标 18*(2*pos+ori)+m,值 2*pos'+ori')逐条推一步,再按新位升序重编。
            // 一条转动把 k 个位打到 k 个互不相同的位上,所以重编总是合法的。
            Comp::EdgeSet(v) => {
                let k = v.len();
                let basic = mgr.ensure_edge();
                let basic = basic.as_u32();
                let (masks, rank) = comb_masks(k);
                let size = self.size();
                let mut mt = vec![0i32; size * 18];
                let mut pairs = vec![(0i32, 0i32); k];
                for idx in 0..size {
                    let (pos, ori) = edge_set_decode(idx, k, &masks);
                    for m in 0..18 {
                        for i in 0..k {
                            let nx = basic[(18 * (2 * pos[i] + ori[i]) + m) as usize] as i32;
                            pairs[i] = (nx / 2, nx % 2);
                        }
                        mt[idx * 18 + m as usize] = edge_set_encode(&mut pairs, k, &rank) as i32;
                    }
                }
                mt
            }
        }
    }

    /// 归位态的索引。
    fn solved_index(&self) -> usize {
        match self {
            Comp::Corners(v) => {
                let a: Vec<i32> = v.iter().map(|&c| c * 3).collect();
                array_to_index(&a, v.len() as i32, 3, 8) as usize
            }
            Comp::Edges(v) => {
                let a: Vec<i32> = v.iter().map(|&e| e * 2).collect();
                array_to_index(&a, v.len() as i32, 2, 12) as usize
            }
            Comp::EdgePos(v) => {
                let a: Vec<i32> = v.to_vec();
                array_to_index(&a, v.len() as i32, 1, 12) as usize
            }
            Comp::EoWord => 0,
            // 这几条都在自家位上、都朝向好 —— 集合口径下只有一个索引
            Comp::EdgeSet(v) => {
                let k = v.len();
                let (_, rank) = comb_masks(k);
                let mask = v.iter().fold(0u32, |m, &e| m | 1 << e);
                (rank[mask as usize] as usize) << k
            }
        }
    }

    /// 该分量在目标集里可取的索引。
    fn goal_indices(&self, kind: GoalKind) -> Vec<usize> {
        if kind == GoalKind::Solved {
            return vec![self.solved_index()];
        }
        // 集合口径的「朝向好、位置随意」= 翻转字为 0 的全部子集
        if let Comp::EdgeSet(v) = self {
            assert!(kind == GoalKind::OrientedAnywhere, "EdgeSet 只支持 Solved / OrientedAnywhere");
            return (0..self.size()).step_by(1 << v.len()).collect();
        }
        // 朝向全 0、位置任意。array_to_index 把朝向放在低位(idx = idx_p * c^n + idx_o),
        // 所以「朝向全 0」= idx 是 c^n 的整数倍;HomeThenOriented 再筛出前 k 块在自家位的。
        let (n, c, pn) = match self.dims() {
            Some(d) => d,
            None => return vec![0],
        };
        let home: Vec<i32> = match self {
            Comp::Corners(v) | Comp::Edges(v) | Comp::EdgePos(v) => v.clone(),
            Comp::EoWord | Comp::EdgeSet(_) => Vec::new(),
        };
        let step = (c as usize).pow(n as u32);
        let keep_home = match kind {
            GoalKind::HomeThenOriented(k) => k,
            _ => 0,
        };
        let mut out = Vec::new();
        let mut p = vec![0i32; n as usize];
        for idx in (0..self.size()).step_by(step) {
            if keep_home > 0 {
                index_to_array(&mut p, idx as i32, n, c, pn);
                if (0..keep_home).any(|i| (p[i] / 18) / c != home[i]) {
                    continue;
                }
            }
            out.push(idx);
        }
        out
    }

    /// 索引 → 这些块各自占的位(角位 / 棱位)。EoWord 没有块。
    fn slots(&self, index: usize) -> Vec<(u8, i32)> {
        if let Comp::EdgeSet(v) = self {
            let k = v.len();
            let (masks, _) = comb_masks(k);
            return edge_set_decode(index, k, &masks).0.into_iter().map(|p| (1u8, p)).collect();
        }
        let kind: u8 = match self {
            Comp::Corners(_) => 0,
            _ => 1,
        };
        match self.dims() {
            Some((n, c, pn)) => {
                let mut p = vec![0i32; n as usize];
                index_to_array(&mut p, index as i32, n, c, pn);
                // index_to_array 的输出是 18 * (c * pos + ori)
                p.iter().map(|&x| (kind, (x / 18) / c)).collect()
            }
            None => Vec::new(),
        }
    }
}

/// 若干分量串成的一个因子:size / 转动表 / 目标索引集。
struct Factor {
    comps: Vec<(Comp, GoalKind)>,
    sizes: Vec<usize>,
    size: usize,
    mt: Vec<i32>,
}

impl Factor {
    fn build(comps: Vec<(Comp, GoalKind)>) -> Factor {
        let sizes: Vec<usize> = comps.iter().map(|(c, _)| c.size()).collect();
        if comps.is_empty() {
            return Factor { comps, sizes, size: 1, mt: vec![0i32; 18] };
        }
        let mut size = sizes[0];
        let mut mt = comps[0].0.move_table();
        for i in 1..comps.len() {
            let s2 = sizes[i];
            let mt2 = comps[i].0.move_table();
            let mut out = vec![0i32; size * s2 * 18];
            for i1 in 0..size {
                for i2 in 0..s2 {
                    let dst = (i1 * s2 + i2) * 18;
                    for m in 0..18 {
                        out[dst + m] = mt[i1 * 18 + m] * s2 as i32 + mt2[i2 * 18 + m];
                    }
                }
            }
            size *= s2;
            mt = out;
        }
        Factor { comps, sizes, size, mt }
    }

    /// 整个因子的归位索引(各分量归位索引按混合基串起来)—— rot_sigma 的传播起点。
    fn solved(&self) -> usize {
        let mut out = 0usize;
        for (i, (comp, _)) in self.comps.iter().enumerate() {
            out = out * self.sizes[i] + comp.solved_index();
        }
        out
    }

    /// 目标索引集(分量目标的笛卡尔积)。
    fn goals(&self) -> Vec<usize> {
        let mut out = vec![0usize];
        for (i, (comp, kind)) in self.comps.iter().enumerate() {
            let here = comp.goal_indices(*kind);
            let s = self.sizes[i];
            let mut next = Vec::with_capacity(out.len() * here.len());
            for &base in &out {
                for &g in &here {
                    next.push(base * s + g);
                }
            }
            out = next;
        }
        out
    }

    /// 索引 → 全部被盯块的占位,用来筛掉「两块同一个位」的非法乘积态。
    fn slots(&self, index: usize) -> Vec<(u8, i32)> {
        let mut rest = index;
        let mut parts = vec![0usize; self.comps.len()];
        for i in (0..self.comps.len()).rev() {
            parts[i] = rest % self.sizes[i];
            rest /= self.sizes[i];
        }
        let mut out = Vec::new();
        for (i, (comp, _)) in self.comps.iter().enumerate() {
            out.extend(comp.slots(parts[i]));
        }
        out
    }
}

fn corners(v: &[i32]) -> Comp { Comp::Corners(v.to_vec()) }
fn edges(v: &[i32]) -> Comp { Comp::Edges(v.to_vec()) }
fn edge_pos(v: &[i32]) -> Comp { Comp::EdgePos(v.to_vec()) }
fn edge_set(v: &[i32]) -> Comp { Comp::EdgeSet(v.to_vec()) }

/// 全部 preset。A 因子放外层(并行维),B 因子放内层(AVX 块扫描维)。
fn presets() -> Vec<Spec> {
    use GoalKind::*;
    vec![
        Spec {
            name: "cross",
            what: "十字(D 面四棱)",
            a: vec![(edges(&[E_DB, E_DR, E_DF, E_DL]), Solved)],
            b: vec![],
            states: 190_080,
            scale: 1,
            fold_y: false,
            d_offset: false,
            golden: Some(&[1, 15, 158, 1394, 9809, 46381, 97254, 34966, 102]),
        },
        // 十字的目标集在 y 下不变(转一下还是十字),所以并上 y 共轭那份**什么都不该变**:
        // 曲线必须还是十字那条金标。σ 只要推错一点点,目标集就跑偏,这条当场红。
        Spec {
            name: "cross_y",
            what: "校验用:十字 + 并上 y 共轭目标(应当原封不动)",
            a: vec![(edges(&[E_DB, E_DR, E_DF, E_DL]), Solved)],
            b: vec![],
            states: 190_080,
            scale: 1,
            fold_y: true,
            d_offset: false,
            golden: Some(&[1, 15, 158, 1394, 9809, 46381, 97254, 34966, 102]),
        },
        // 伪十字。金标不是新算的:站内 pseudo_cross.unfixed.W 那格是 12!·2¹¹ 全空间口径,
        // 每个追踪坐标恰好 5,160,960 个原像,整除下来就是这九个数(和 = 190,080)。
        // d=0 的 4 正是四个 D 偏移 —— d_offset 那步只要错一点点,这一行立刻不对。
        Spec {
            name: "pseudo_cross",
            what: "校验用:伪十字(目标集按 D 偏移闭包)",
            a: vec![(edges(&[E_DB, E_DR, E_DF, E_DL]), Solved)],
            b: vec![],
            states: 190_080,
            scale: 1,
            fold_y: false,
            d_offset: true,
            golden: Some(&[4, 48, 440, 3576, 21492, 74660, 81780, 8064, 16]),
        },
        Spec {
            name: "122",
            what: "一个 1×2×2(DBL 角 + DL/BL 两棱)",
            a: vec![(edges(&[E_DL, E_BL]), Solved)],
            b: vec![(corners(&[C_DBL]), Solved)],
            states: 12_672,
            scale: 1,
            fold_y: false,
            d_offset: false,
            golden: Some(&[1, 9, 78, 590, 2922, 6523, 2525, 24]),
        },
        Spec {
            name: "222",
            what: "一个 2×2×2(DBL 角 + DL/DB/BL 三棱)",
            a: vec![(edges(&[E_DL, E_DB, E_BL]), Solved)],
            b: vec![(corners(&[C_DBL]), Solved)],
            states: 253_440,
            scale: 1,
            fold_y: false,
            d_offset: false,
            golden: Some(&[1, 9, 90, 852, 7169, 44182, 131636, 68940, 561]),
        },
        Spec {
            name: "123",
            what: "一个 1×2×3(Roux 一块:DBL/DFL 两角 + BL/FL/DL 三棱)",
            a: vec![(edges(&[E_BL, E_FL, E_DL]), Solved)],
            b: vec![(corners(&[C_DBL, C_DFL]), Solved)],
            states: 5_322_240,
            scale: 1,
            fold_y: false,
            d_offset: false,
            golden: Some(&[1, 12, 132, 1406, 14099, 122279, 797145, 2638638, 1715068, 33460]),
        },
        Spec {
            name: "xcross",
            what: "固定 BL 槽的 XCross(十字四棱 + BL 棱 + DBL 角)",
            a: vec![(edges(&[E_DB, E_DR, E_DF, E_DL, E_BL]), Solved)],
            b: vec![(corners(&[C_DBL]), Solved)],
            states: 72_990_720,
            scale: 1,
            fold_y: false,
            d_offset: false,
            golden: Some(&[
                1, 15, 172, 1950, 21535, 220368, 1989591, 13431990, 40963892, 16325184, 36022,
            ]),
        },
        Spec {
            name: "eo",
            what: "EO(12 条棱的翻转字)",
            a: vec![(Comp::EoWord, Solved)],
            b: vec![],
            states: 2_048,
            scale: 1,
            fold_y: false,
            d_offset: false,
            golden: Some(&[1, 2, 25, 202, 620, 900, 285, 13]),
        },
        Spec {
            name: "eoline",
            what: "EOLine(翻转字 + DF/DB 两棱归位)",
            a: vec![(Comp::EoWord, Solved)],
            b: vec![(edge_pos(&[E_DF, E_DB]), Solved)],
            states: 270_336,
            scale: 1,
            fold_y: false,
            d_offset: false,
            golden: Some(&[1, 9, 91, 851, 6831, 41703, 130239, 88683, 1927, 1]),
        },
        // 等价性检查对:同一个问题(十字归位 + BL 棱朝向好、位置随意)两种写法 ——
        // 一个因子里混口径 vs 拆成两个因子。verify 断言两条曲线逐档相同,这是
        // HomeThenOriented 与「非法乘积态不可达」两件事唯一的便宜证据。
        Spec {
            name: "f2leo1",
            what: "校验用:十字 + BL 棱朝向好(五棱一个因子,混口径)",
            a: vec![(edges(&[E_DB, E_DR, E_DF, E_DL, E_BL]), HomeThenOriented(4))],
            b: vec![],
            states: 3_041_280,
            scale: 1,
            fold_y: false,
            d_offset: false,
            golden: None,
        },
        Spec {
            name: "f2leo1_split",
            what: "校验用:同一问题拆成 十字四棱 × BL 棱 两个因子",
            a: vec![(edges(&[E_DB, E_DR, E_DF, E_DL]), Solved)],
            b: vec![(edges(&[E_BL]), OrientedAnywhere)],
            states: 3_041_280,
            scale: 1,
            fold_y: false,
            d_offset: false,
            golden: None,
        },
        // 第二组等价性检查对:同一个问题(十字 + FR/FL 两棱朝向好)按可区分 vs 按集合。
        // 集合那份把 2! 种贴法商掉,所以逐档计数应当正好是可区分那份的一半 ——
        // verify 直接断言这个 2 倍关系。EdgeSet 的正确性全靠这一条,不靠推理。
        Spec {
            name: "f2leo2",
            what: "校验用:十字 + FR/FL 两棱朝向好(两棱可区分)",
            a: vec![(edges(&[E_DB, E_DR, E_DF, E_DL]), Solved)],
            b: vec![(edges(&[E_FR, E_FL]), OrientedAnywhere)],
            states: 42_577_920,
            scale: 1,
            fold_y: false,
            d_offset: false,
            golden: None,
        },
        Spec {
            name: "f2leo2_set",
            what: "校验用:同一问题,两棱按集合(商掉 2! 种贴法)",
            a: vec![(edges(&[E_DB, E_DR, E_DF, E_DL]), Solved)],
            b: vec![(edge_set(&[E_FR, E_FL]), OrientedAnywhere)],
            states: 21_288_960,
            scale: 2,
            fold_y: false,
            d_offset: false,
            golden: None,
        },
        // ── 以下是要机时的 ────────────────────────────────────────────────
        Spec {
            name: "223",
            what: "E1:一个 2×2×3(DBL/DFL 两角 + BL/FL/DL/DB/DF 五棱)",
            a: vec![(edges(&[E_BL, E_FL, E_DL, E_DB, E_DF]), Solved)],
            b: vec![(corners(&[C_DBL, C_DFL]), Solved)],
            states: 1_532_805_120,
            scale: 1,
            fold_y: false,
            d_offset: false,
            golden: None,
        },
        Spec {
            name: "eo_xcross",
            what: "E2:EO + 固定 BL 槽的 XCross(翻转字 × 五棱位置 × DBL 角)",
            a: vec![(edge_pos(&[E_DB, E_DR, E_DF, E_DL, E_BL]), Solved)],
            b: vec![(corners(&[C_DBL]), Solved), (Comp::EoWord, Solved)],
            states: 4_671_406_080,
            scale: 1,
            fold_y: false,
            d_offset: false,
            golden: None,
        },
        // E3。曾经按「八条可区分的棱」算,51 亿真实态 / 225 亿乘积,nibble 11.2 GB + 3 GB
        // 转动表 —— 于是它在台账里躺着等机时。但那四条中层棱的目标只是「都朝向好」,
        // 谁在哪个位不影响达标、也不影响任何一条转动的作用,4! 种贴法是同一个态。
        // 商掉之后:真实 2.13 亿、乘积 15 亿,nibble 753 MB,几分钟的事。
        // 站内口径那一条:底面定死之后 EO 还剩两条轴(差一个 y 旋转),分析器
        // `f2leo_solver::get_stats` 的折叠正是 `min(rot, rot·y)`。四条中层棱同属 E 层
        // 一个类,所以「按另一条轴算朝向」在这个坐标里表达得下来 —— 只是换一组目标。
        Spec {
            name: "f2leo_cross",
            what: "E3:F2LEO 十字,两条 EO 轴取最短(站内单色底口径)",
            a: vec![(edges(&[E_DB, E_DR, E_DF, E_DL]), Solved)],
            b: vec![(edge_set(&[E_FR, E_FL, E_BL, E_BR]), OrientedAnywhere)],
            states: 212_889_600,
            scale: 24,
            fold_y: true,
            d_offset: false,
            golden: None,
        },
        Spec {
            name: "f2leo_cross_1axis",
            what: "E3':F2LEO 十字,固定一条 EO 轴(站内口径的上界,进固定单帧那一列)",
            a: vec![(edges(&[E_DB, E_DR, E_DF, E_DL]), Solved)],
            b: vec![(edge_set(&[E_FR, E_FL, E_BL, E_BR]), OrientedAnywhere)],
            states: 212_889_600,
            scale: 24,
            fold_y: false,
            d_offset: false,
            golden: None,
        },
        // P4:伪 F2LEO 十字 —— 与 E3 同一个坐标、同一个 EdgeSet 商,只是目标集再按 D 闭包。
        Spec {
            name: "pseudo_f2leo_cross",
            what: "P4:伪 F2LEO 十字,两条 EO 轴取最短(站内单色底口径)",
            a: vec![(edges(&[E_DB, E_DR, E_DF, E_DL]), Solved)],
            b: vec![(edge_set(&[E_FR, E_FL, E_BL, E_BR]), OrientedAnywhere)],
            states: 212_889_600,
            scale: 24,
            fold_y: true,
            d_offset: true,
            golden: None,
        },
        Spec {
            name: "pseudo_f2leo_cross_1axis",
            what: "P4':伪 F2LEO 十字,固定一条 EO 轴(进固定单帧那一列)",
            a: vec![(edges(&[E_DB, E_DR, E_DF, E_DL]), Solved)],
            b: vec![(edge_set(&[E_FR, E_FL, E_BL, E_BR]), OrientedAnywhere)],
            states: 212_889_600,
            scale: 24,
            fold_y: false,
            d_offset: true,
            golden: None,
        },
        Spec {
            name: "f2leo_cross_split",
            what: "备用:E3 的可区分写法(51 亿真实 / 225 亿乘积,nibble 11.2 GB + 3 GB 表)",
            a: vec![(edges(&[E_DB, E_DR, E_DF, E_DL, E_BL, E_BR]), HomeThenOriented(4))],
            b: vec![(edges(&[E_FR, E_FL]), OrientedAnywhere)],
            states: 5_109_350_400,
            scale: 1,
            fold_y: false,
            d_offset: false,
            golden: None,
        },
    ]
}

fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let all = presets();

    if args.is_empty() {
        println!("dist_tracked <preset|verify>\n");
        println!("{:<26} {:>18}  {:>10}  {}", "preset", "states", "nibble", "阶段");
        for s in &all {
            let prod = comps_size(&s.a) as u64 * comps_size(&s.b) as u64;
            println!(
                "{:<26} {:>18}  {:>9.2}G  {}{}",
                s.name,
                group(s.states),
                prod as f64 / 2.0 / 1e9,
                s.what,
                // 标的是「有没有内建金标」,不是「跑没跑过」—— 新算出来的曲线本来就没有
                // 可对的既有数,它们的把关在 verify 那三条恒等式和真题逐档偏差上。
                if s.golden.is_some() { "" } else { "  [无内建金标]" },
            );
        }
        return;
    }

    let n = std::thread::available_parallelism().map(|v| v.get()).unwrap_or(4);
    rayon::ThreadPoolBuilder::new()
        .num_threads(n.min(MAX_THREADS))
        .build_global()
        .ok();

    let want = &args[0];
    if want == "verify" {
        for s in all.iter().filter(|s| s.golden.is_some()) {
            run(s);
        }
        // 混口径目标 + 乘积空间:同一个问题两种拆法必须给出同一条曲线。
        let one = run(all.iter().find(|s| s.name == "f2leo1").unwrap());
        let two = run(all.iter().find(|s| s.name == "f2leo1_split").unwrap());
        assert_eq!(one, two, "两种拆法结果不同");
        eprintln!("[f2leo1] 一个因子混口径 与 拆两个因子 逐档相同");
        // EdgeSet 商掉 m! 种贴法:同一个问题按集合算,每一档必须正好是可区分那份的 1/m!。
        // 这是「不可区分」那步唯一的实证 —— 不成立就说明商错了,不是省了内存是算错了。
        let dis = run(all.iter().find(|s| s.name == "f2leo2").unwrap());
        let set = run(all.iter().find(|s| s.name == "f2leo2_set").unwrap());
        assert_eq!(dis.len(), set.len(), "集合口径的深度档数不同");
        for (d, (&a, &b)) in dis.iter().zip(set.iter()).enumerate() {
            assert_eq!(a, b * 2, "d={} 可区分 {} ≠ 2 × 集合 {}", d, a, b);
        }
        eprintln!("[f2leo2] 两棱按集合算,逐档正好是可区分那份的 1/2!");
        return;
    }

    match all.iter().find(|s| s.name == want) {
        Some(s) => {
            run(s);
        }
        None => {
            eprintln!("unknown preset: {} (run with no args to list)", want);
            std::process::exit(2);
        }
    }
}

/// preset 的因子规模(只为列表显示,不建表)。
fn comps_size(comps: &[(Comp, GoalKind)]) -> usize {
    comps.iter().map(|(c, _)| c.size()).product::<usize>().max(1)
}

fn run(spec: &Spec) -> Vec<u64> {
    let t0 = Instant::now();
    let a = Factor::build(spec.a.clone());
    let b = Factor::build(spec.b.clone());
    let product = a.size as u64 * b.size as u64;

    if product > HUGE_STATES
        && std::env::var("CUBE_ALLOW_HUGE_TABLES").ok().as_deref() != Some("1")
    {
        eprintln!(
            "[{}] 乘积空间 {} 态(nibble {:.1} GB)—— 要跑请显式 CUBE_ALLOW_HUGE_TABLES=1",
            spec.name,
            group(product),
            product as f64 / 2.0 / 1e9,
        );
        std::process::exit(1);
    }

    // 目标集:两因子目标的笛卡尔积,逐个筛掉「两块占同一个位」的非法乘积态。
    let mut starts = Vec::new();
    for ga in a.goals() {
        let sa = a.slots(ga);
        for gb in b.goals() {
            let mut all = sa.clone();
            all.extend(b.slots(gb));
            all.sort();
            let n = all.len();
            all.dedup();
            if all.len() == n {
                starts.push(ga * b.size + gb);
            }
        }
    }
    assert!(!starts.is_empty(), "目标集为空");

    // 伪口径:目标集按 D / D2 / D' 闭包。D 是一条真转动,直接查两个因子各自的转动表 ——
    // 不必知道「底层是哪几块」,也就没有再推一遍公式的机会。
    if spec.d_offset {
        let base = starts.clone();
        for &s in &base {
            let (ga, gb) = (s / b.size, s % b.size);
            for m in [3usize, 4, 5] {
                starts.push(a.mt[ga * 18 + m] as usize * b.size + b.mt[gb * 18 + m] as usize);
            }
        }
        starts.sort_unstable();
        starts.dedup();
        eprintln!("[{}] 伪口径:{} 个目标按 D 闭包成 {} 个", spec.name, base.len(), starts.len());
    }

    // 两条 EO 轴取最短:并上 y 共轭那一份目标。σ 是整体旋转诱导的双射,合法态映到合法态,
    // 所以筛完剩下的条数必须与原来一样 —— 不一样说明 σ 或坐标有问题。
    if spec.fold_y {
        let rmap = &rot_map()[1];
        let sa = invert(&rot_sigma(a.size, &a.mt, a.solved(), rmap));
        let sb = invert(&rot_sigma(b.size, &b.mt, b.solved(), rmap));
        let axis1 = starts.len();
        let extra: Vec<usize> = starts
            .iter()
            .map(|&s| sa[s / b.size] as usize * b.size + sb[s % b.size] as usize)
            .collect();
        for &g in &extra {
            let mut all = a.slots(g / b.size);
            all.extend(b.slots(g % b.size));
            all.sort();
            let n = all.len();
            all.dedup();
            assert_eq!(all.len(), n, "y 共轭后的目标态占位冲突");
        }
        starts.extend(extra);
        starts.sort_unstable();
        starts.dedup();
        eprintln!(
            "[{}] 两条 EO 轴取最短:轴一 {} 个目标 + y 共轭那份,并起来 {} 个",
            spec.name, axis1, starts.len(),
        );
    }

    eprintln!(
        "[{}] {} | A={} B={} 乘积={} 目标={} | 建表 {:.1}s",
        spec.name,
        spec.what,
        group(a.size as u64),
        group(b.size as u64),
        group(product),
        starts.len(),
        t0.elapsed().as_secs_f64(),
    );

    let (_table, dist) = bfs_multi_packed4(a.size, b.size, &starts, &a.mt, &b.mt);

    println!();
    println!("== {} ==  {}", spec.name, spec.what);
    println!(" Depth |         Count      |  Percent  | Cumul %");
    println!("-------|--------------------|-----------|--------");
    let mut total: u64 = 0;
    for (d, &c) in dist.iter().enumerate() {
        total += c;
        println!(
            " {:>5} | {:>18} | {:>8.4}% | {:>6.2}%",
            d,
            group(c),
            c as f64 / spec.states as f64 * 100.0,
            total as f64 / spec.states as f64 * 100.0,
        );
    }
    let avg: f64 = dist.iter().enumerate().map(|(d, &c)| d as f64 * c as f64).sum::<f64>()
        / total as f64;
    println!(" Total : {:>18} | Avg {:.4}", group(total), avg);
    println!(
        " counts: [{}]",
        dist.iter().map(|c| c.to_string()).collect::<Vec<_>>().join(", "),
    );
    // 商过的 preset 再报一份站内口径(每档 × scale)—— 页面那格的分母是没商的那个。
    if spec.scale > 1 {
        println!(
            " counts × {} (站内口径,总数 {}): [{}]",
            spec.scale,
            group(total * spec.scale),
            dist.iter().map(|c| (c * spec.scale).to_string()).collect::<Vec<_>>().join(", "),
        );
    }
    eprintln!("[{}] {:.1}s", spec.name, t0.elapsed().as_secs_f64());

    // 合法态一个不少、非法态一个没混进来 —— 乘积空间路线的自证。
    assert_eq!(total, spec.states, "{}: 总态数对不上", spec.name);
    if let Some(g) = spec.golden {
        assert_eq!(dist.len(), g.len(), "{}: 深度档数对不上", spec.name);
        for (d, (&got, &exp)) in dist.iter().zip(g.iter()).enumerate() {
            assert_eq!(got, exp, "{}: d={} 得 {} 期望 {}", spec.name, d, got, exp);
        }
        eprintln!("[{}] 与金标逐档相同", spec.name);
    }
    dist
}

fn group(v: u64) -> String {
    let s = v.to_string();
    let mut out = String::new();
    for (i, ch) in s.chars().enumerate() {
        if i > 0 && (s.len() - i) % 3 == 0 {
            out.push(',');
        }
        out.push(ch);
    }
    out
}

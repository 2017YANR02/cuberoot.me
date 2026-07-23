//! lsll_solver: LSLL(Last Slot and Last Layer)HTM 最优求解器 —— PoC。
//!
//! LSLL = 十字 + 前三槽已还原,只剩「最后一槽(FR 槽:DFR 角 + FR 棱)+ 整个顶层
//! (4 顶角 + 4 顶棱)」。因为其余块已 home,**整方最优解 = LSLL 最优解**。
//!
//! 设计(对照 block222_solver 的「投影 + BFS 精确表」范式,但联合坐标 ~5e12 太大,
//! 故走两/多张**独立投影 PDB** + IDA*):
//!   - 追踪 5 个 LSLL 角(ULB UBR URF UFL DFR)、5 个 LSLL 棱(FR UB UR UF UL)。
//!   - **正确性关键**:搜索目标 = 整个 State == SOLVED(不是「投影归位」——否则
//!     3 个底角 / 7 个非 LSLL 棱可能被 3-循环,投影看着 home 但方块没解 → 假解)。
//!   - PDB 只作**可采纳启发式** h=max(各投影子集最优距离)。投影子集:5 LSLL 角、
//!     3 底角(DBL DRB DLF)、5 LSLL 棱、5 非 LSLL 棱(BL BR FL DB DR);角全覆盖、
//!     棱覆盖 10/12,未覆盖的 DF/DL 由整方目标兜底(启发式仍是合法下界)。
//!   - 单件运动学复用 MOVE_STATES(同 block222 的 move_piece_*):角单件值 3*pos+ori、
//!     棱单件值 2*pos+ori(均 0..24);投影态编码 = k 个单件值的 base-24 混合基。
//!
//! 自包含:只依赖 cube_common(State / MOVE_STATES / valid_moves),无磁盘表、无
//! move_tables manager。native-only(PoC,不进 wasm)。

use crate::cube_common::{move_state, valid_moves, Move, State};

/// 追踪的 5 个 LSLL 角块 idx(= home 位置):ULB UBR URF UFL DFR。
pub const LSLL_CORNERS: [usize; 5] = [0, 1, 2, 3, 6];
/// 追踪的 5 个 LSLL 棱块 idx:FR UB UR UF UL。
pub const LSLL_EDGES: [usize; 5] = [2, 4, 5, 6, 7];
/// 3 个非 LSLL 角(启发式补角覆盖):DBL DRB DLF。
pub const OTHER_CORNERS: [usize; 3] = [4, 5, 7];
/// 5 个非 LSLL 棱(启发式补棱覆盖):BL BR FL DB DR(剩 DF DL 由整方目标兜底)。
pub const OTHER_EDGES: [usize; 5] = [0, 1, 3, 8, 9];

/// 单件 step 表:corn_step[v][m] = 角单件值 v(=3*pos+ori)施加 move m 后的新单件值。
/// 语义同 State::compose:位置 pos 的块 move 后去位置 i(mcp[i]==pos),朝向 +mco[i]。
fn build_corn_step() -> Vec<[u8; 18]> {
    let mut t = vec![[0u8; 18]; 24];
    for pos in 0..8u8 {
        for ori in 0..3u8 {
            let v = (3 * pos + ori) as usize;
            for m in 0..18usize {
                let ms = move_state(Move::from_index(m));
                let (mcp, mco) = ms.cp_co();
                let mut np = 0u8;
                let mut no = 0u8;
                for i in 0..8 {
                    if mcp[i] == pos {
                        np = i as u8;
                        no = (ori + mco[i]) % 3;
                        break;
                    }
                }
                t[v][m] = 3 * np + no;
            }
        }
    }
    t
}

fn build_edge_step() -> Vec<[u8; 18]> {
    let mut t = vec![[0u8; 18]; 24];
    for pos in 0..12u8 {
        for ori in 0..2u8 {
            let v = (2 * pos + ori) as usize;
            for m in 0..18usize {
                let ms = move_state(Move::from_index(m));
                let (mep, meo) = ms.ep_eo();
                let mut np = 0u8;
                let mut no = 0u8;
                for i in 0..12 {
                    if mep[i] == pos {
                        np = i as u8;
                        no = (ori + meo[i]) % 2;
                        break;
                    }
                }
                t[v][m] = 2 * np + no;
            }
        }
    }
    t
}

#[inline]
fn enc(vals: &[u8]) -> usize {
    let mut idx = 0usize;
    for &v in vals {
        idx = idx * 24 + v as usize;
    }
    idx
}

/// 一张投影 PDB:追踪块 idx 列表 + 精确距离表(idx = base-24 编码)。
struct Pdb {
    track: Vec<usize>,
    is_corner: bool,
    dist: Vec<u8>,
}

/// 通用投影 PDB 全空间 BFS。solved 单件值 = 追踪块在 home 位置 ori0(角 3*b、棱 2*b)。
/// 转移走全 18 move(建表不做相邻剪枝)。返回 (dist 表, 可达态数)。
fn build_pdb(step: &[[u8; 18]], track: &[usize], is_corner: bool) -> (Vec<u8>, usize) {
    let k = track.len();
    let size = 24usize.pow(k as u32);
    let mut dist = vec![255u8; size];
    let mul: u8 = if is_corner { 3 } else { 2 };
    let solved: Vec<u8> = track.iter().map(|&b| mul * b as u8).collect();
    let start = enc(&solved);
    dist[start] = 0;
    let mut frontier: Vec<Vec<u8>> = vec![solved];
    let mut reached = 1usize;
    let mut d = 0u8;
    while !frontier.is_empty() {
        let mut next: Vec<Vec<u8>> = Vec::new();
        for vals in &frontier {
            for m in 0..18usize {
                let mut nv = vec![0u8; k];
                for j in 0..k {
                    nv[j] = step[vals[j] as usize][m];
                }
                let ni = enc(&nv);
                if dist[ni] == 255 {
                    dist[ni] = d + 1;
                    reached += 1;
                    next.push(nv);
                }
            }
        }
        d += 1;
        frontier = next;
    }
    (dist, reached)
}

pub struct LsllSolver {
    pdbs: Vec<Pdb>,
    /// 各 PDB 可达态数(供自检 assert)。
    pub reached: Vec<usize>,
    /// 各 PDB 最大深度(信息用)。
    pub pdb_depth: Vec<u8>,
}

impl Default for LsllSolver {
    fn default() -> Self {
        Self::new()
    }
}

impl LsllSolver {
    pub fn new() -> Self {
        let corn_step = build_corn_step();
        let edge_step = build_edge_step();

        let specs: [(&[usize], bool); 4] = [
            (&LSLL_CORNERS, true),
            (&OTHER_CORNERS, true),
            (&LSLL_EDGES, false),
            (&OTHER_EDGES, false),
        ];
        let mut pdbs = Vec::new();
        let mut reached = Vec::new();
        let mut pdb_depth = Vec::new();
        for (track, is_corner) in specs {
            let step = if is_corner { &corn_step } else { &edge_step };
            let (dist, r) = build_pdb(step, track, is_corner);
            pdb_depth.push(dist.iter().copied().filter(|&v| v != 255).max().unwrap_or(0));
            reached.push(r);
            pdbs.push(Pdb { track: track.to_vec(), is_corner, dist });
        }
        LsllSolver { pdbs, reached, pdb_depth }
    }

    /// 可采纳启发式:max 各投影子集最优距离。
    #[inline]
    fn heuristic(&self, st: &State) -> u32 {
        // 逆位置:cpos[block] = 该块当前所在位置;epos 同理。
        let mut cpos = [0u8; 8];
        for p in 0..8 {
            cpos[(st.corners[p] / 3) as usize] = p as u8;
        }
        let mut epos = [0u8; 12];
        for p in 0..12 {
            epos[(st.edges[p] / 2) as usize] = p as u8;
        }
        let mut h = 0u32;
        for pdb in &self.pdbs {
            let mut vals = [0u8; 5];
            let k = pdb.track.len();
            for (j, &b) in pdb.track.iter().enumerate() {
                if pdb.is_corner {
                    let p = cpos[b];
                    vals[j] = 3 * p + (st.corners[p as usize] % 3);
                } else {
                    let p = epos[b];
                    vals[j] = 2 * p + (st.edges[p as usize] % 2);
                }
            }
            let d = pdb.dist[enc(&vals[..k])] as u32;
            if d > h {
                h = d;
            }
        }
        h
    }

    /// IDA* 判定:g 步预算 bound 内可达整方还原?(找最优长度用)。
    fn exists(&self, st: &State, bound: u32, prev: u8, nodes: &mut u64) -> bool {
        if *st == State::SOLVED {
            return true;
        }
        if bound == 0 {
            return false;
        }
        *nodes += 1;
        if self.heuristic(st) > bound {
            return false;
        }
        let (vmoves, vcnt) = valid_moves();
        let row = &vmoves[prev as usize];
        for k in 0..vcnt[prev as usize] as usize {
            let m = row[k];
            if self.exists(&st.applied(Move::from_index(m as usize)), bound - 1, m, nodes) {
                return true;
            }
        }
        false
    }

    /// IDA* 收集:恰好 depth_left 步预算内、所有以整方还原**结束**的路径(到达 SOLVED
    /// 即停,不续尾动)。cap 截断。
    #[allow(clippy::too_many_arguments)]
    fn collect(
        &self,
        st: &State,
        depth_left: u32,
        prev: u8,
        path: &mut Vec<u8>,
        out: &mut Vec<Vec<u8>>,
        cap: usize,
        nodes: &mut u64,
    ) {
        if *st == State::SOLVED {
            out.push(path.clone());
            return;
        }
        if depth_left == 0 || out.len() >= cap {
            return;
        }
        *nodes += 1;
        if self.heuristic(st) > depth_left {
            return;
        }
        let (vmoves, vcnt) = valid_moves();
        let row = &vmoves[prev as usize];
        for k in 0..vcnt[prev as usize] as usize {
            if out.len() >= cap {
                return;
            }
            let m = row[k];
            path.push(m);
            self.collect(
                &st.applied(Move::from_index(m as usize)),
                depth_left - 1,
                m,
                path,
                out,
                cap,
                nodes,
            );
            path.pop();
        }
    }

    /// 最优步数(纯 IDA* 迭代加深);node_cap 超限返回 None(超时哨兵)。
    pub fn optimal_len(&self, st: &State, node_cap: u64) -> Option<(u32, u64)> {
        let mut nodes = 0u64;
        let mut bound = self.heuristic(st);
        loop {
            if self.exists(st, bound, 18, &mut nodes) {
                return Some((bound, nodes));
            }
            if nodes > node_cap {
                return None;
            }
            bound += 1;
            if bound > 30 {
                return None;
            }
        }
    }

    /// 枚举 [最优 .. 最优+extra] 的全部解(到达即停,cap 截断)。
    /// 返回 (最优步数, 解集 = move 索引路径, 消耗节点数);超时返回 None。
    pub fn enumerate(
        &self,
        st: &State,
        extra: u32,
        cap: usize,
        node_cap: u64,
    ) -> Option<(u32, Vec<Vec<u8>>, u64)> {
        let (best, mut nodes) = self.optimal_len(st, node_cap)?;
        let mut out = Vec::new();
        let mut path = Vec::new();
        self.collect(st, best + extra, 18, &mut path, &mut out, cap, &mut nodes);
        Some((best, out, nodes))
    }
}

// ---------- 随机合法 LSLL 态生成(PoC 输入) ----------

struct Lcg(u64);
impl Lcg {
    fn new(seed: u64) -> Self {
        Lcg(seed.wrapping_mul(0x9E3779B97F4A7C15).wrapping_add(1))
    }
    fn next_u64(&mut self) -> u64 {
        self.0 = self.0.wrapping_mul(6364136223846793005).wrapping_add(1442695040888963407);
        self.0
    }
    fn below(&mut self, n: u64) -> usize {
        (self.next_u64() >> 33) as usize % n as usize
    }
}

/// 5 元随机排列 + 其符号(偶=0,奇=1)。
fn perm5(rng: &mut Lcg) -> ([usize; 5], u8) {
    let mut p = [0usize, 1, 2, 3, 4];
    for i in (1..5).rev() {
        let j = rng.below((i + 1) as u64);
        p.swap(i, j);
    }
    // 符号 = 逆序对奇偶。
    let mut inv = 0u8;
    for i in 0..5 {
        for j in (i + 1)..5 {
            if p[i] > p[j] {
                inv ^= 1;
            }
        }
    }
    (p, inv)
}

/// 生成一个合法 LSLL 态:5 LSLL 角 / 5 LSLL 棱在各自 home 槽内任意合法排布,
/// 其余块(十字 + 前三槽)全 home。满足整方三约束(置换奇偶、角扭、棱翻)。
pub fn random_lsll_state(seed: u64) -> State {
    let mut rng = Lcg::new(seed);
    loop {
        let (cperm, sc) = perm5(&mut rng);
        let (eperm, se) = perm5(&mut rng);
        if sc != se {
            continue; // 总置换须偶(非追踪块偶):sgn(角)==sgn(棱)
        }
        // 角朝向:前 4 随机,最后一个补齐使和 ≡ 0 (mod 3)。
        let mut co = [0u8; 5];
        let mut sum = 0u8;
        for c in co.iter_mut().take(4) {
            *c = rng.below(3) as u8;
            sum = (sum + *c) % 3;
        }
        co[4] = (3 - sum) % 3;
        // 棱翻向:前 4 随机,最后一个补齐使和 ≡ 0 (mod 2)。
        let mut eo = [0u8; 5];
        let mut fsum = 0u8;
        for e in eo.iter_mut().take(4) {
            *e = rng.below(2) as u8;
            fsum ^= *e;
        }
        eo[4] = fsum;

        let mut st = State::SOLVED;
        for j in 0..5 {
            let slot = LSLL_CORNERS[j];
            let blk = LSLL_CORNERS[cperm[j]];
            st.corners[slot] = 3 * blk as u8 + co[j];
        }
        for j in 0..5 {
            let slot = LSLL_EDGES[j];
            let blk = LSLL_EDGES[eperm[j]];
            st.edges[slot] = 2 * blk as u8 + eo[j];
        }
        return st;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// PDB 可达态数 = 理论 P(npos, k) * ori^k,强校验投影 BFS 正确性。
    #[test]
    fn pdb_reachable_counts() {
        let s = LsllSolver::new();
        // 5 LSLL 角:P(8,5)*3^5 = 6720*243 = 1,632,960。
        assert_eq!(s.reached[0], 1_632_960, "LSLL corner pdb reach");
        // 3 底角:P(8,3)*3^3 = 336*27 = 9,072。
        assert_eq!(s.reached[1], 9_072, "other corner pdb reach");
        // 5 LSLL 棱:P(12,5)*2^5 = 95040*32 = 3,041,280。
        assert_eq!(s.reached[2], 3_041_280, "LSLL edge pdb reach");
        assert_eq!(s.reached[3], 3_041_280, "other edge pdb reach");
        // solved 态启发式 = 0。
        assert_eq!(s.heuristic(&State::SOLVED), 0);
    }

    /// 单件 step 表与 State::applied 逐块一致(角 + 棱)。
    #[test]
    fn step_tables_match_state() {
        let corn_step = build_corn_step();
        let edge_step = build_edge_step();
        for m in 0..18usize {
            let mv = Move::from_index(m);
            let st = State::SOLVED.applied(mv);
            // 角:home 块 b 在 SOLVED 单件值 3*b,step 后 == 施 move 后该块新单件值。
            for b in 0..8u8 {
                let v = 3 * b; // solved
                let got = corn_step[v as usize][m];
                // 施 move 后块 b 所在位置 p、朝向。
                let mut p = 0u8;
                for pp in 0..8 {
                    if st.corners[pp] / 3 == b {
                        p = pp as u8;
                    }
                }
                let want = 3 * p + st.corners[p as usize] % 3;
                assert_eq!(got, want, "corn_step move {} block {}", m, b);
            }
            for b in 0..12u8 {
                let v = 2 * b;
                let got = edge_step[v as usize][m];
                let mut p = 0u8;
                for pp in 0..12 {
                    if st.edges[pp] / 2 == b {
                        p = pp as u8;
                    }
                }
                let want = 2 * p + st.edges[p as usize] % 2;
                assert_eq!(got, want, "edge_step move {} block {}", m, b);
            }
        }
    }

    /// 随机态一定合法(整方可解)+ 非追踪块全 home。
    #[test]
    fn random_states_are_valid_lsll() {
        for seed in 0..200u64 {
            let st = random_lsll_state(seed);
            // 非 LSLL 角/棱必须 home(cross + 前三槽)。
            for p in OTHER_CORNERS {
                assert_eq!(st.corners[p], 3 * p as u8, "seed {} other corner {} moved", seed, p);
            }
            // 非追踪棱 = 全 12 减 LSLL_EDGES。
            for p in 0..12usize {
                if !LSLL_EDGES.contains(&p) {
                    assert_eq!(st.edges[p], 2 * p as u8, "seed {} other edge {} moved", seed, p);
                }
            }
            // 整方约束:角扭和 ≡0、棱翻和 ≡0、置换奇偶一致。
            let (cp, co) = st.cp_co();
            let (ep, eo) = st.ep_eo();
            assert_eq!(co.iter().map(|&x| x as u32).sum::<u32>() % 3, 0);
            assert_eq!(eo.iter().map(|&x| x as u32).sum::<u32>() % 2, 0);
            let sgn = |perm: &[u8]| {
                let mut inv = 0u8;
                for i in 0..perm.len() {
                    for j in (i + 1)..perm.len() {
                        if perm[i] > perm[j] {
                            inv ^= 1;
                        }
                    }
                }
                inv
            };
            assert_eq!(sgn(&cp), sgn(&ep), "seed {} parity", seed);
        }
    }

    /// 求解正确性:每个解物理回放整方还原;最优长度 ≥ 启发式下界;无更短解。
    #[test]
    fn solves_correctly_small_sample() {
        let s = LsllSolver::new();
        for seed in 0..12u64 {
            let st = random_lsll_state(seed);
            let (best, sols, _) = s.enumerate(&st, 0, 64, 2_000_000_000).expect("no timeout");
            assert!(best >= s.heuristic(&st), "best below heuristic");
            assert!(!sols.is_empty(), "seed {} no optimal sols", seed);
            for sol in &sols {
                assert_eq!(sol.len() as u32, best, "collected non-optimal in extra=0");
                // 物理回放:case + 解 → SOLVED(整方,不止投影)。
                let mut c = st;
                for &m in sol {
                    c.apply(Move::from_index(m as usize));
                }
                assert_eq!(c, State::SOLVED, "seed {} sol does not solve cube", seed);
            }
            // 无更短解:best-1 步不可达。
            if best > 0 {
                let mut nodes = 0u64;
                assert!(!s.exists(&st, best - 1, 18, &mut nodes), "seed {} shorter exists", seed);
            }
        }
    }

    /// 已知锚:一个 U-perm 式纯棱三循环(顶层)应有合理最优步数。
    /// 这里只锚「solved 输入 → 0 步、空解不产生假解」。
    #[test]
    fn solved_input_zero() {
        let s = LsllSolver::new();
        let (best, sols, _) = s.enumerate(&State::SOLVED, 0, 8, 1_000_000).unwrap();
        assert_eq!(best, 0);
        assert_eq!(sols.len(), 1);
        assert!(sols[0].is_empty());
    }
}

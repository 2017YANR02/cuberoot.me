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
//!
//! 拆两个因子不是为了好看,是为了**转动表**:8 条棱的精确坐标是 51 亿,转动表 368 GB,
//! 根本建不出来;拆成 4+4 两个 190,080 的因子后转动表各 13 MB,代价是乘积空间(361 亿)
//! 大于真实空间(51 亿)—— 多出来的是「两块占同一个位」的非法态,BFS 从合法目标出发永远
//! 走不到它们,所以计数仍然精确,只是 visited 位图买大了。**总数对不上 = 有 bug**,
//! 每个 preset 都把真实总数写死在 `states` 里逐次核对。
//!
//! ## 已核对(每次跑都断言,不看脸色)
//!
//!   cross   190,080        1,15,158,1394,9809,46381,97254,34966,102
//!   122     12,672         1,9,78,590,2922,6523,2525,24
//!   222     253,440        1,9,90,852,7169,44182,131636,68940,561
//!   123     5,322,240      1,12,132,1406,14099,122279,797145,2638638,1715068,33460
//!   xcross  72,990,720     1,15,172,1950,...,16325184,36022
//!   eo      2,048          1,2,25,202,620,900,285,13
//!   eoline  270,336        1,9,91,851,6831,41703,130239,88683,1927,1
//!
//! 前五条来自 TS 端两台互不相干的引擎(`lib/cross-trainer/{dist,block,tracked}.ts`)与
//! 本仓库 `dist_cross_1col` / `dist_xcross_1col_fixed`;后两条来自 `lib/cross-trainer/eoline.ts`。
//! 也就是说这台引擎的正确性不是自证的 —— 跑 `dist_tracked verify` 一次比七条曲线。
//!
//! ## 还没跑的(见 solver/EXACT_DIST_EXPANSION.md)
//!
//!   223         E1  1,532,805,120   nibble 766 MB
//!   eo_xcross   E2  4,671,406,080   nibble 2.3 GB
//!   f2leo_cross E3  5,109,350,400 真实 / 36,130,406,400 乘积,nibble 18.1 GB
//!
//! ## 用法
//!
//! ```text
//! dist_tracked                # 列出所有 preset 与规模
//! dist_tracked verify         # 跑七个便宜 preset,逐条对金标
//! dist_tracked 223            # 跑单个 preset(大的要 CUBE_ALLOW_HUGE_TABLES=1)
//! ```

use std::time::Instant;

use cube_solver::cube_common::{array_to_index, create_multi_move_table, index_to_array};
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
    /// 已知曲线;None = 这一条正是要跑出来的。
    golden: Option<&'static [u64]>,
}

impl Comp {
    /// (n, c, pn):n 块、c 个朝向、总共 pn 块。EoWord 不走 multi_move_table,单列。
    fn dims(&self) -> Option<(i32, i32, i32)> {
        match self {
            Comp::Corners(v) => Some((v.len() as i32, 3, 8)),
            Comp::Edges(v) => Some((v.len() as i32, 2, 12)),
            Comp::EdgePos(v) => Some((v.len() as i32, 1, 12)),
            Comp::EoWord => None,
        }
    }

    fn size(&self) -> usize {
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
        }
    }

    /// 该分量在目标集里可取的索引。
    fn goal_indices(&self, kind: GoalKind) -> Vec<usize> {
        if kind == GoalKind::Solved {
            return vec![self.solved_index()];
        }
        // 朝向全 0、位置任意。array_to_index 把朝向放在低位(idx = idx_p * c^n + idx_o),
        // 所以「朝向全 0」= idx 是 c^n 的整数倍;HomeThenOriented 再筛出前 k 块在自家位的。
        let (n, c, pn) = match self.dims() {
            Some(d) => d,
            None => return vec![0],
        };
        let home: Vec<i32> = match self {
            Comp::Corners(v) | Comp::Edges(v) | Comp::EdgePos(v) => v.clone(),
            Comp::EoWord => Vec::new(),
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
            golden: Some(&[1, 15, 158, 1394, 9809, 46381, 97254, 34966, 102]),
        },
        Spec {
            name: "122",
            what: "一个 1×2×2(DBL 角 + DL/BL 两棱)",
            a: vec![(edges(&[E_DL, E_BL]), Solved)],
            b: vec![(corners(&[C_DBL]), Solved)],
            states: 12_672,
            golden: Some(&[1, 9, 78, 590, 2922, 6523, 2525, 24]),
        },
        Spec {
            name: "222",
            what: "一个 2×2×2(DBL 角 + DL/DB/BL 三棱)",
            a: vec![(edges(&[E_DL, E_DB, E_BL]), Solved)],
            b: vec![(corners(&[C_DBL]), Solved)],
            states: 253_440,
            golden: Some(&[1, 9, 90, 852, 7169, 44182, 131636, 68940, 561]),
        },
        Spec {
            name: "123",
            what: "一个 1×2×3(Roux 一块:DBL/DFL 两角 + BL/FL/DL 三棱)",
            a: vec![(edges(&[E_BL, E_FL, E_DL]), Solved)],
            b: vec![(corners(&[C_DBL, C_DFL]), Solved)],
            states: 5_322_240,
            golden: Some(&[1, 12, 132, 1406, 14099, 122279, 797145, 2638638, 1715068, 33460]),
        },
        Spec {
            name: "xcross",
            what: "固定 BL 槽的 XCross(十字四棱 + BL 棱 + DBL 角)",
            a: vec![(edges(&[E_DB, E_DR, E_DF, E_DL, E_BL]), Solved)],
            b: vec![(corners(&[C_DBL]), Solved)],
            states: 72_990_720,
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
            golden: Some(&[1, 2, 25, 202, 620, 900, 285, 13]),
        },
        Spec {
            name: "eoline",
            what: "EOLine(翻转字 + DF/DB 两棱归位)",
            a: vec![(Comp::EoWord, Solved)],
            b: vec![(edge_pos(&[E_DF, E_DB]), Solved)],
            states: 270_336,
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
            golden: None,
        },
        Spec {
            name: "f2leo1_split",
            what: "校验用:同一问题拆成 十字四棱 × BL 棱 两个因子",
            a: vec![(edges(&[E_DB, E_DR, E_DF, E_DL]), Solved)],
            b: vec![(edges(&[E_BL]), OrientedAnywhere)],
            states: 3_041_280,
            golden: None,
        },
        // ── 以下是要机时的 ────────────────────────────────────────────────
        Spec {
            name: "223",
            what: "E1:一个 2×2×3(DBL/DFL 两角 + BL/FL/DL/DB/DF 五棱)",
            a: vec![(edges(&[E_BL, E_FL, E_DL, E_DB, E_DF]), Solved)],
            b: vec![(corners(&[C_DBL, C_DFL]), Solved)],
            states: 1_532_805_120,
            golden: None,
        },
        Spec {
            name: "eo_xcross",
            what: "E2:EO + 固定 BL 槽的 XCross(翻转字 × 五棱位置 × DBL 角)",
            a: vec![(edge_pos(&[E_DB, E_DR, E_DF, E_DL, E_BL]), Solved)],
            b: vec![(corners(&[C_DBL]), Solved), (Comp::EoWord, Solved)],
            states: 4_671_406_080,
            golden: None,
        },
        Spec {
            name: "f2leo_cross",
            what: "E3:F2LEO 十字(十字四棱归位 + 中层四棱朝向好、位置随意)",
            // 8 条棱的精确坐标是 51 亿,转动表 368 GB 建不出来,只能拆成两个因子跑乘积空间。
            // 6+2(42,577,920 × 528 = 225 亿,nibble 11.2 GB + mt_edge6 3 GB)是最省的拆法;
            // 4+4(190,080² = 361 亿,nibble 18.1 GB,不用 mt_edge6)是不想要 3 GB 表时的退路。
            a: vec![(edges(&[E_DB, E_DR, E_DF, E_DL, E_BL, E_BR]), HomeThenOriented(4))],
            b: vec![(edges(&[E_FR, E_FL]), OrientedAnywhere)],
            states: 5_109_350_400,
            golden: None,
        },
    ]
}

fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let all = presets();

    if args.is_empty() {
        println!("dist_tracked <preset|verify>\n");
        println!("{:<12} {:>18}  {:>10}  {}", "preset", "states", "nibble", "阶段");
        for s in &all {
            let prod = comps_size(&s.a) as u64 * comps_size(&s.b) as u64;
            println!(
                "{:<12} {:>18}  {:>9.2}G  {}{}",
                s.name,
                group(s.states),
                prod as f64 / 2.0 / 1e9,
                s.what,
                if s.golden.is_some() { "" } else { "  [待跑]" },
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

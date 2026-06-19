// EXPERIMENTAL (B): exact SQ1 slash-optimal distance via bidirectional BFS over
// free-turn rotation classes. Node = Sq1State::canon_key() (min over 144 top/bottom
// rotations + ml). Edge = one slash with free turns absorbed: from a class rep R,
// for every (a,b) with R.turned(a,b).slash_legal(), the successor class is
// R.turned(a,b).slashed().canon_key(). Slash is an involution on slash-legal states
// AND its result is slash-legal again => the class graph is UNDIRECTED, so backward
// search from SOLVED uses the same successor relation. Meet-in-the-middle => the
// timing-out IDA* depth d becomes two radius-~d/2 BFS frontiers.
//
// Input: stdin lines `id,compact` (or `id,compact,W`; W ignored). Output stdout
// `id,t` (t = slash-optimal move count) or `id,INFEASIBLE`. Purely additive — does
// not touch Sq1Solver / Sq1WcaSolver / dfs_slash_alt.
//
// run: cargo build --release --bin sq1_slash_mitm -j 14
use cube_solver::sq1_solver::{state_from_scramble, Sq1State};
use std::collections::HashMap;
use std::io::{self, BufRead, Write};

// Per-side visited-node cap (safety net; real frontiers here are ~1e5-1e6).
// ~100M u128 keys * (16B + overhead) ~ 3GB/side, 6GB both — under the 15GB budget.
const MEM_CAP: usize = 100_000_000;

/// Canonical free-turn-class key, == Sq1State::canon_key() but 24 rotations not 144:
/// the orbit group is the PRODUCT Z12(top) x Z12(bottom), so the joint 144-min of
/// (top<<49 | bottom<<1 | ml) equals (min_a rotl(top,a))<<49 | (min_b rotl(bottom,b))<<1 | ml
/// (top/bottom occupy disjoint bit ranges, a/b independent). Provably identical, ~6x faster.
#[inline]
fn fast_key(s: &Sq1State) -> u128 {
    let mut mt = u64::MAX;
    let mut mb = u64::MAX;
    for a in 0..12u32 {
        let t = s.turned(a, 0).top;
        if t < mt {
            mt = t;
        }
        let bo = s.turned(0, a).bottom;
        if bo < mb {
            mb = bo;
        }
    }
    ((mt as u128) << 49) | ((mb as u128) << 1) | s.ml as u128
}

/// Expand one BFS level on `this` side; check meets against `other`; return next frontier reps.
/// None => hit MEM_CAP (abort this monster as infeasible).
fn expand(
    frontier: &[Sq1State],
    this: &mut HashMap<u128, u8>,
    other: &HashMap<u128, u8>,
    depth: u8,
    best: &mut u8,
) -> Option<Vec<Sq1State>> {
    let mut next = Vec::new();
    for r in frontier {
        for a in 0..12u32 {
            for b in 0..12u32 {
                let y = r.turned(a, b);
                if !y.slash_legal() {
                    continue;
                }
                let z = y.slashed();
                let k = fast_key(&z);
                if let Some(&d) = other.get(&k) {
                    let t = depth + d;
                    if t < *best {
                        *best = t;
                    }
                }
                if !this.contains_key(&k) {
                    this.insert(k, depth);
                    next.push(z);
                }
            }
        }
        if this.len() > MEM_CAP {
            return None;
        }
    }
    Some(next)
}

/// BFS all classes reachable from `start` within `cap` slashes (depth-keyed). None if > MEM_CAP.
fn bfs_to_radius(start: Sq1State, cap: u8) -> Option<HashMap<u128, u8>> {
    let mut v: HashMap<u128, u8> = HashMap::new();
    v.insert(fast_key(&start), 0u8);
    let mut frontier = vec![start];
    for depth in 1..=cap {
        let mut next = Vec::new();
        for r in &frontier {
            for a in 0..12u32 {
                for b in 0..12u32 {
                    let y = r.turned(a, b);
                    if !y.slash_legal() {
                        continue;
                    }
                    let z = y.slashed();
                    let k = fast_key(&z);
                    if !v.contains_key(&k) {
                        v.insert(k, depth);
                        next.push(z);
                    }
                }
            }
            if v.len() > MEM_CAP {
                return None;
            }
        }
        frontier = next;
        if frontier.is_empty() {
            break;
        }
    }
    Some(v)
}

/// Decide t = s-1 vs t = s for an ambiguous state whose slash-optimal t is known to be in
/// {s-1, s} (the W=2s-1 case). Bounded to radius ceil((s-1)/2) = s/2 each side, so the deep
/// radius-7 frontier that OOMs the full search is never built. Any path of length <= s-1 has
/// both half-radii <= s/2, so a meet with sum <= s-1 is detected iff one exists.
fn decide_t(start: Sq1State, s: u8) -> Option<u8> {
    let cap = s / 2; // = ceil((s-1)/2)
    let vf = bfs_to_radius(start, cap)?;
    let vb = bfs_to_radius(Sq1State::SOLVED, cap)?;
    let (small, big) = if vf.len() <= vb.len() { (&vf, &vb) } else { (&vb, &vf) };
    let mut best = u32::MAX;
    for (k, &d) in small {
        if let Some(&d2) = big.get(k) {
            let sum = d as u32 + d2 as u32;
            if sum < best {
                best = sum;
            }
        }
    }
    if best <= s as u32 - 1 {
        Some(best as u8)
    } else {
        Some(s)
    }
}

/// Exact slash-optimal distance from `start` to SOLVED, or None if infeasible.
fn slash_dist(start: Sq1State) -> Option<u8> {
    let sk = fast_key(&start);
    let gk = fast_key(&Sq1State::SOLVED);
    if sk == gk {
        return Some(0);
    }
    let mut vf: HashMap<u128, u8> = HashMap::new();
    let mut vb: HashMap<u128, u8> = HashMap::new();
    vf.insert(sk, 0);
    vb.insert(gk, 0);
    let mut ff = vec![start];
    let mut fb = vec![Sq1State::SOLVED];
    let mut df = 0u8;
    let mut db = 0u8;
    let mut best = u8::MAX;
    while !ff.is_empty() || !fb.is_empty() {
        // Expand the smaller frontier (balances work + keeps memory down).
        let expand_f = !ff.is_empty() && (fb.is_empty() || ff.len() <= fb.len());
        if expand_f {
            df += 1;
            ff = expand(&ff, &mut vf, &vb, df, &mut best)?;
        } else {
            db += 1;
            fb = expand(&fb, &mut vb, &vf, db, &mut best)?;
        }
        // Bidirectional-BFS early stop: once the summed radii reach the best meet, no
        // shorter meet can appear (frontiers only grow deeper).
        if best != u8::MAX && (best as u32) <= df as u32 + db as u32 {
            break;
        }
        if df as u32 + db as u32 > 16 {
            break; // safety: slash god number is 13
        }
    }
    if best == u8::MAX {
        None
    } else {
        Some(best)
    }
}

fn main() {
    let stdin = io::stdin();
    let stdout = io::stdout();
    let mut out = stdout.lock();
    eprintln!("[INFO] sq1 SLASH-MITM (bidirectional BFS over free-turn classes)");
    for line in stdin.lock().lines() {
        let line = match line {
            Ok(l) => l,
            Err(_) => break,
        };
        let line = line.trim();
        if line.is_empty() || line == "exit" {
            continue;
        }
        let (id, rest) = match line.split_once(',') {
            Some(x) => x,
            None => {
                eprintln!("[ERR] bad line: {}", line);
                continue;
            }
        };
        // compact has no commas; an optional 3rd field = known upper bound s (W=2s-1
        // ambiguous) -> bounded decide_t (radius s/2); absent -> full slash_dist.
        let compact = rest.split(',').next().unwrap_or("").trim();
        let sbound: Option<u8> = rest.split(',').nth(1).and_then(|x| x.trim().parse().ok());
        let st = match state_from_scramble(compact) {
            Ok(s) => s,
            Err(e) => {
                eprintln!("[ERR] id={} parse: {}", id, e);
                continue;
            }
        };
        let t0 = std::time::Instant::now();
        let res = match sbound {
            Some(s) => decide_t(st, s),
            None => slash_dist(st),
        };
        match res {
            Some(t) => {
                writeln!(out, "{},{}", id, t).ok();
                eprintln!("[OK] id={} t={} ({:.2}s)", id, t, t0.elapsed().as_secs_f64());
            }
            None => {
                writeln!(out, "{},INFEASIBLE", id).ok();
                eprintln!("[INFEASIBLE] id={}", id);
            }
        }
        out.flush().ok();
    }
}

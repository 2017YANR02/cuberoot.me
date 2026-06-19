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

// Regression guard for the MITM slash machinery (decide_t / fast_key / slash edge model).
// Zero disk tables — pure in-memory BFS over Sq1State — so it runs in CI in well under a
// second. This is the proof, not a claim: the §6.4 cross-validation used to be a one-off
// manual run; this pins it. (Audited 2026-06-19; decide_t radius arithmetic is the crux.)
#[cfg(test)]
mod tests {
    use super::*;

    // Deterministic LCG — no external rng dep, no Math.random-style nondeterminism.
    fn lcg(rng: &mut u64) -> u32 {
        *rng = rng
            .wrapping_mul(6364136223846793005)
            .wrapping_add(1442695040888963407);
        (*rng >> 33) as u32
    }

    // Reachable state: apply `nslashes` slashes with random free turns between them
    // (only legal slashes taken). Deterministic in `seed`.
    fn gen_state(seed: u64, nslashes: usize) -> Sq1State {
        let mut rng = seed ^ 0x9E37_79B9_7F4A_7C15;
        let mut s = Sq1State::SOLVED;
        let mut done = 0usize;
        let mut guard = 0usize;
        while done < nslashes && guard < 100_000 {
            guard += 1;
            let a = lcg(&mut rng) % 12;
            let b = lcg(&mut rng) % 12;
            let y = s.turned(a, b);
            if y.slash_legal() {
                s = y.slashed();
                done += 1;
            }
        }
        s
    }

    // fast_key must equal the trusted 144-rotation canonical key, and be invariant under
    // every free top/bottom turn — the property the two BFS frontiers rely on to meet.
    #[test]
    fn fast_key_equals_canon_key_and_is_turn_invariant() {
        assert_eq!(fast_key(&Sq1State::SOLVED), Sq1State::SOLVED.canon_key());
        for seed in 0..100u64 {
            let s = gen_state(seed, (seed % 13) as usize + 1);
            assert_eq!(fast_key(&s), s.canon_key(), "fast_key != canon_key (seed {seed})");
            for a in 0..12u32 {
                for b in 0..12u32 {
                    assert_eq!(
                        fast_key(&s.turned(a, b)),
                        fast_key(&s),
                        "fast_key not turn-invariant (seed {seed}, {a},{b})"
                    );
                }
            }
        }
    }

    // slash is an involution on slash-legal states and stays slash-legal (so the class
    // graph is undirected => backward BFS from SOLVED is valid).
    #[test]
    fn slashed_is_involution_and_closed() {
        assert!(Sq1State::SOLVED.slash_legal(), "SOLVED must be slash-legal for backward BFS");
        let mut checked = 0usize;
        for seed in 0..150u64 {
            let s = gen_state(seed, (seed % 11) as usize + 1);
            for a in 0..12u32 {
                for b in 0..12u32 {
                    let y = s.turned(a, b);
                    if !y.slash_legal() {
                        continue;
                    }
                    let z = y.slashed();
                    assert!(z.slash_legal(), "slashed() result not slash-legal (closure broken)");
                    assert_eq!(z.slashed(), y, "slashed() not an involution");
                    checked += 1;
                }
            }
        }
        assert!(checked > 1000, "too few slash-legal states exercised: {checked}");
    }

    // The decisive guard: decide_t must agree with the full bidirectional distance
    // `slash_dist` for both s = d and s = d+1 (d = true slash-optimum). This pins the
    // radius arithmetic cap = s/2 = ceil((s-1)/2): if it were off by one, the s = d+1
    // case for ODD d would fail to find the existing length-d solution.
    #[test]
    fn decide_t_agrees_with_full_slash_dist() {
        assert_eq!(slash_dist(Sq1State::SOLVED), Some(0));
        let mut tested = 0usize;
        let mut parity = [0usize; 2];
        for seed in 0..400u64 {
            let s = gen_state(seed.wrapping_mul(2654435761), (5 + seed % 4) as usize);
            let d = match slash_dist(s) {
                Some(d) => d,
                None => continue,
            };
            if d < 2 || d > 8 {
                continue; // skip trivial (cap underflow at d<2) / keep CI fast
            }
            // true optimum is d => no <=d-1 solution => returns Some(d)
            assert_eq!(decide_t(s, d), Some(d), "decide_t(s,d) wrong (seed {seed}, d {d})");
            // a length-d solution exists and d <= (d+1)-1 => must be found => returns Some(d)
            assert_eq!(decide_t(s, d + 1), Some(d), "decide_t(s,d+1) wrong (seed {seed}, d {d})");
            parity[(d % 2) as usize] += 1;
            tested += 1;
            if tested >= 16 {
                break;
            }
        }
        assert!(tested >= 12, "too few states tested: {tested}");
        // odd d in the d+1 case is exactly what catches a radius off-by-one.
        assert!(parity[1] >= 2, "need odd-distance states to guard the off-by-one, got {parity:?}");
    }
}

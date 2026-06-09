// Sum-of-ranks combinatorial analysis over the WCA dump.
// Replicates /wca/sum-of-ranks math: subset_total(p,S) = sum over e in S of
//   world_rank(p,e) if ranked, else (participants_e + 1).
// Tie-break: smallest wca_id. (universe sorted by wca_id asc; forward strict-min)
use std::collections::HashMap;
use std::time::Instant;

const RANK_EVENTS: [&str; 21] = [
    "333", "222", "444", "555", "666", "777", "333bf", "333fm", "333oh", "minx", "pyram", "clock",
    "skewb", "sq1", "444bf", "555bf", "333mbf", // active 17 (idx 0..=16)
    "333ft", "magic", "mmagic", "333mbo", // cancelled 4 (idx 17..=20)
];
const NEV: usize = 21;
const ACTIVE: usize = 17;

fn ev_label(i: usize) -> &'static str { RANK_EVENTS[i] }

// Data dir holding pe.tsv / persons.tsv / hrs_snapshot.tsv / no_podium.tsv and outputs.
// CI sets SOR_DATA_DIR; local manual runs default to cwd (update_sor.ps1 sets it explicitly).
fn base() -> String {
    std::env::var("SOR_DATA_DIR").unwrap_or_else(|_| ".".to_string())
}

// Worker thread count — default leaves 2 cores free so the machine stays responsive
// during long runs (override with SORCALC_THREADS=N). Don't saturate every core.
fn nthreads() -> usize {
    if let Ok(v) = std::env::var("SORCALC_THREADS") {
        if let Ok(n) = v.parse::<usize>() { if n >= 1 { return n; } }
    }
    let avail = std::thread::available_parallelism().map(|x| x.get()).unwrap_or(8);
    avail.saturating_sub(2).max(1)
}

struct Data {
    n: usize,                 // universe size
    wca: Vec<String>,         // universe wca_id, sorted asc (index = tie-break priority)
    name: Vec<String>,        // universe name
    cols: Vec<Vec<i32>>,      // cols[event][person] = effective rank value W (with penalty)
    rank: Vec<Vec<i32>>,      // rank[event][person] = world_rank or 0 if not ranked (universe only)
    participants: [i32; NEV], // N_e (ranked field size, all competitors incl. non-universe)
}

fn load(is_avg: bool) -> Data {
    let t0 = Instant::now();
    let base = base();
    let pe = String::from_utf8_lossy(&std::fs::read(format!("{base}/pe.tsv")).unwrap()).into_owned();
    let pers = String::from_utf8_lossy(&std::fs::read(format!("{base}/persons.tsv")).unwrap()).into_owned();

    // name lookup
    let mut name_of: HashMap<&str, &str> = HashMap::with_capacity(300_000);
    for line in pers.lines() {
        let mut it = line.split('\t');
        let id = it.next().unwrap_or("");
        let nm = it.next().unwrap_or("");
        if !id.is_empty() { name_of.insert(id, nm); }
    }

    let ev_idx: HashMap<&str, usize> =
        RANK_EVENTS.iter().enumerate().map(|(i, e)| (*e, i)).collect();

    // global person index over ALL persons appearing in pe.tsv (needed to rank cancelled
    // events whose fields include people not in the active universe).
    let mut gid: HashMap<&str, usize> = HashMap::with_capacity(300_000);
    let mut gpersons: Vec<&str> = Vec::with_capacity(300_000);
    // per (event, global person) value: store as Vec<Vec<i32>> [event][gid] = chosen value (0 = none)
    // first pass: discover persons + which are active-present.
    let mut rows: Vec<(usize, usize, i32)> = Vec::with_capacity(pe.len() / 16); // (event, gid, value)
    let mut active_present: Vec<bool> = Vec::with_capacity(300_000);
    for line in pe.lines() {
        let mut it = line.split('\t');
        let ev = it.next().unwrap_or("");
        let pid = it.next().unwrap_or("");
        let sb: i32 = it.next().unwrap_or("0").parse().unwrap_or(0);
        let ab: i32 = it.next().unwrap_or("0").parse().unwrap_or(0);
        let &e = match ev_idx.get(ev) { Some(x) => x, None => continue };
        let g = *gid.entry(pid).or_insert_with(|| {
            gpersons.push(pid);
            active_present.push(false);
            gpersons.len() - 1
        });
        if e < ACTIVE { active_present[g] = true; }
        let v = if is_avg { ab } else { sb };
        rows.push((e, g, v));
    }
    let ng = gpersons.len();

    // per-event ranking over ALL global persons with v>0
    let mut rank_g: Vec<Vec<i32>> = vec![vec![0i32; ng]; NEV]; // [event][gid] = world rank or 0
    let mut participants = [0i32; NEV];
    {
        // bucket values per event
        let mut per_ev: Vec<Vec<(i32, usize)>> = vec![Vec::new(); NEV]; // (value, gid)
        for &(e, g, v) in &rows {
            if v > 0 { per_ev[e].push((v, g)); }
        }
        for e in 0..NEV {
            let list = &mut per_ev[e];
            list.sort_unstable_by_key(|x| x.0);
            participants[e] = list.len() as i32;
            // assignRanks: standard competition ranking (ties share lowest rank)
            let mut prev_val = -1i32;
            let mut prev_rank = 0i32;
            for (i, &(val, g)) in list.iter().enumerate() {
                let r = if val == prev_val { prev_rank } else { prev_val = val; prev_rank = (i as i32) + 1; prev_rank };
                rank_g[e][g] = r;
            }
        }
    }

    // universe = active-present persons, sorted by wca_id asc
    let mut univ: Vec<usize> = (0..ng).filter(|&g| active_present[g]).collect();
    univ.sort_unstable_by(|&a, &b| gpersons[a].cmp(gpersons[b]));
    let n = univ.len();

    let mut wca = Vec::with_capacity(n);
    let mut name = Vec::with_capacity(n);
    let mut cols: Vec<Vec<i32>> = vec![vec![0i32; n]; NEV];
    let mut rank: Vec<Vec<i32>> = vec![vec![0i32; n]; NEV];
    for (p, &g) in univ.iter().enumerate() {
        wca.push(gpersons[g].to_string());
        name.push(name_of.get(gpersons[g]).copied().unwrap_or("?").to_string());
        for e in 0..NEV {
            let r = rank_g[e][g];
            rank[e][p] = r;
            cols[e][p] = if r > 0 { r } else { participants[e] + 1 };
        }
    }

    eprintln!(
        "[load] type={} universe={} (global persons={}) in {:?}",
        if is_avg { "average" } else { "single" }, n, ng, t0.elapsed()
    );
    Data { n, wca, name, cols, rank, participants }
}

// ---- census core: distinct #1 winners over all 2^nev - 1 non-empty subsets ----
// Enumerates only the first `nev` events (17 = active only, 21 = incl. cancelled).
// Returns (distinct_count, winners sorted by subsets_won desc then index/wca_id asc).
fn census_core(d: &Data, nev: usize) -> (usize, Vec<(usize, u32)>) {
    let n = d.n;
    let nlo = nev.min(16);
    let khi = nev - nlo; // high events: idx nlo..nev
    let nthreads = nthreads();
    let groups: Vec<u32> = (0..(1u32 << khi)).collect();
    let chunk = ((groups.len() + nthreads - 1) / nthreads).max(1);

    let cols = &d.cols;
    let results: Vec<(Vec<u64>, Vec<u32>)> = std::thread::scope(|s| {
        let mut handles = Vec::new();
        for ch in groups.chunks(chunk) {
            let ch = ch.to_vec();
            let h = s.spawn(move || {
                let words = (n + 63) / 64;
                let mut seen = vec![0u64; words];           // winner bitset
                let mut wincount = vec![0u32; n];           // subsets won per player
                let mut total = vec![0i32; n];
                for &g in &ch {
                    for p in 0..n { total[p] = 0; }
                    for hb in 0..khi {
                        if g & (1 << hb) != 0 {
                            let e = nlo + hb;
                            let c = &cols[e];
                            for p in 0..n { total[p] += c[p]; }
                        }
                    }
                    // gray-code over low nlo bits
                    let mut prev_gray = 0u32;
                    let limit = 1u32 << nlo;
                    let mut code = 0u32;
                    loop {
                        let gray = code ^ (code >> 1);
                        if code != 0 {
                            let diff = gray ^ prev_gray;
                            let bit = diff.trailing_zeros() as usize; // low event index
                            let c = &cols[bit];
                            if gray & diff != 0 {
                                for p in 0..n { total[p] += c[p]; }
                            } else {
                                for p in 0..n { total[p] -= c[p]; }
                            }
                        }
                        prev_gray = gray;
                        if !(g == 0 && gray == 0) {
                            // forward strict-min => smallest index (=smallest wca_id) among ties
                            let mut best = total[0];
                            let mut wi = 0usize;
                            for p in 1..n {
                                if total[p] < best { best = total[p]; wi = p; }
                            }
                            seen[wi >> 6] |= 1u64 << (wi & 63);
                            wincount[wi] += 1;
                        }
                        code += 1;
                        if code == limit { break; }
                    }
                }
                (seen, wincount)
            });
            handles.push(h);
        }
        handles.into_iter().map(|h| h.join().unwrap()).collect()
    });

    let words = (n + 63) / 64;
    let mut seen = vec![0u64; words];
    let mut wincount = vec![0u32; n];
    for (sv, wc) in &results {
        for i in 0..words { seen[i] |= sv[i]; }
        for p in 0..n { wincount[p] += wc[p]; }
    }
    let distinct: usize = seen.iter().map(|w| w.count_ones() as usize).sum();
    let mut winners: Vec<(usize, u32)> = (0..n).filter(|&p| wincount[p] > 0).map(|p| (p, wincount[p])).collect();
    winners.sort_unstable_by(|a, b| b.1.cmp(&a.1).then(a.0.cmp(&b.0)));
    (distinct, winners)
}

fn census(d: &Data) {
    let t0 = Instant::now();
    let (distinct, winners) = census_core(d, NEV);
    println!("\n==================== CENSUS ({}) ====================", "world");
    println!("universe = {} people; non-empty subsets = 2^21-1 = {}", d.n, (1u64<<21)-1);
    println!("DISTINCT #1 winners across all non-empty subsets: {}", distinct);
    println!("\nrank  subsets_won  share%   wca_id      name");
    let total_subsets = ((1u64 << 21) - 1) as f64;
    for (i, &(p, wins)) in winners.iter().enumerate() {
        println!(
            "{:>4}  {:>11}  {:>6.2}  {:<10}  {}",
            i + 1, wins, wins as f64 / total_subsets * 100.0, d.wca[p], d.name[p]
        );
        if i >= 199 { println!("... ({} more)", winners.len() - 200); break; }
    }
    eprintln!("[census] done in {:?}", t0.elapsed());
}

// ---- historical census: per-year distinct #1 winners from year-end rank snapshots ----
// Source: hrs_snapshot.tsv (event_id, year, wca_id, single_world_rank, avg_world_rank),
// exported from prod historical_ranks_snapshot (full year-end re-rank of everyone).
struct SnapRow { year: i32, e: u8, g: u32, s: i32, a: i32 }

fn load_snapshot() -> (Vec<String>, Vec<SnapRow>, Vec<i32>) {
    let base = base();
    let data = std::fs::read_to_string(format!("{base}/hrs_snapshot.tsv")).unwrap();
    let ev_idx: HashMap<&str, usize> = RANK_EVENTS.iter().enumerate().map(|(i, e)| (*e, i)).collect();
    let mut gid: HashMap<String, u32> = HashMap::with_capacity(300_000);
    let mut gpersons: Vec<String> = Vec::with_capacity(300_000);
    let mut rows: Vec<SnapRow> = Vec::with_capacity(7_600_000);
    let mut years: std::collections::BTreeSet<i32> = std::collections::BTreeSet::new();
    for line in data.lines() {
        let mut it = line.split('\t');
        let ev = it.next().unwrap_or("");
        let year: i32 = it.next().unwrap_or("0").parse().unwrap_or(0);
        let pid = it.next().unwrap_or("");
        let s: i32 = it.next().unwrap_or("0").parse().unwrap_or(0);
        let a: i32 = it.next().unwrap_or("0").parse().unwrap_or(0);
        let &e = match ev_idx.get(ev) { Some(x) => x, None => continue };
        let g = match gid.get(pid) {
            Some(&g) => g,
            None => { let g = gpersons.len() as u32; gpersons.push(pid.to_string()); gid.insert(pid.to_string(), g); g }
        };
        rows.push(SnapRow { year, e: e as u8, g, s, a });
        years.insert(year);
    }
    (gpersons, rows, years.into_iter().collect())
}

// build a Data for one (year, is_avg) from the snapshot rows. universe = active-present
// (ranked in >=1 of the 17 active events that year), matching the current/live census.
fn build_year_data(year: i32, is_avg: bool, gpersons: &[String], rows: &[SnapRow], name_of: &HashMap<&str, &str>) -> Data {
    let ng = gpersons.len();
    let mut rank_g: Vec<Vec<i32>> = vec![vec![0i32; ng]; NEV];
    let mut active_present = vec![false; ng];
    for r in rows {
        if r.year != year { continue; }
        let v = if is_avg { r.a } else { r.s };
        if v > 0 {
            rank_g[r.e as usize][r.g as usize] = v;
            if (r.e as usize) < ACTIVE { active_present[r.g as usize] = true; }
        }
    }
    let mut participants = [0i32; NEV];
    for e in 0..NEV { participants[e] = rank_g[e].iter().filter(|&&x| x > 0).count() as i32; }
    let mut univ: Vec<usize> = (0..ng).filter(|&g| active_present[g]).collect();
    univ.sort_unstable_by(|&a, &b| gpersons[a].cmp(&gpersons[b]));
    let n = univ.len();
    let mut wca = Vec::with_capacity(n);
    let mut name = Vec::with_capacity(n);
    let mut cols: Vec<Vec<i32>> = vec![vec![0i32; n]; NEV];
    let mut rank: Vec<Vec<i32>> = vec![vec![0i32; n]; NEV];
    for (p, &g) in univ.iter().enumerate() {
        wca.push(gpersons[g].clone());
        name.push(name_of.get(gpersons[g].as_str()).copied().unwrap_or("?").to_string());
        for e in 0..NEV {
            let r = rank_g[e][g];
            rank[e][p] = r;
            cols[e][p] = if r > 0 { r } else { participants[e] + 1 };
        }
    }
    Data { n, wca, name, cols, rank, participants }
}

// full historical run: years (asc or single) x {single,average} x {no-cancelled(17), cancelled(21)}
// writes census_yearly.tsv: year, is_avg(t/f), incl_cancelled(t/f), rank, wca_id, subsets_won
fn census_history(only_year: Option<i32>) {
    use std::io::Write;
    let t0 = Instant::now();
    let base = base();
    let pers = String::from_utf8_lossy(&std::fs::read(format!("{base}/persons.tsv")).unwrap()).into_owned();
    let mut name_of: HashMap<&str, &str> = HashMap::with_capacity(300_000);
    for line in pers.lines() {
        let mut it = line.split('\t');
        let id = it.next().unwrap_or("");
        let nm = it.next().unwrap_or("");
        if !id.is_empty() { name_of.insert(id, nm); }
    }
    let (gpersons, rows, mut years) = load_snapshot();
    if let Some(y) = only_year { years.retain(|&yy| yy == y); }
    eprintln!("[hist] {} rows, {} persons, {} years {:?}", rows.len(), gpersons.len(), years.len(), years);

    let suffix = if only_year.is_some() { format!("_{}", only_year.unwrap()) } else { String::new() };
    let path = format!("{base}/census_yearly{suffix}.tsv");
    let mut f = std::io::BufWriter::new(std::fs::File::create(&path).unwrap());
    let mut written = 0u64;
    for &is_avg in &[false, true] {
        for &year in &years {
            let d = build_year_data(year, is_avg, &gpersons, &rows, &name_of);
            for &(incl_cancelled, nev) in &[(false, ACTIVE), (true, NEV)] {
                let pt = Instant::now();
                let (distinct, winners) = census_core(&d, nev);
                for (i, &(p, wins)) in winners.iter().enumerate() {
                    writeln!(f, "{}\t{}\t{}\t{}\t{}\t{}",
                        year, if is_avg {"t"} else {"f"}, if incl_cancelled {"t"} else {"f"},
                        i + 1, d.wca[p], wins).unwrap();
                    written += 1;
                }
                eprintln!("[hist] year={} {} cancelled={} n={} distinct={} ({:?})",
                    year, if is_avg {"avg"} else {"single"}, incl_cancelled, d.n, distinct, pt.elapsed());
            }
        }
    }
    f.flush().unwrap();
    eprintln!("[hist] {} rows -> {} in {:?}", written, path, t0.elapsed());
}

// ---- no-podium census: census restricted to never-podiumed cubers ----
// "never podiumed" = best_final_pos ∈ {0,>3} (same as main /sum-of-ranks hidePodium, migration 0013).
// Values (world ranks, participants+1 penalty) stay GLOBAL; we only restrict WHO is eligible to win a
// subset to never-podiumed cubers (matches the main table: it filters displayed people, not the ranks).
// reads no_podium.tsv: "wca_id \t is_avg('t'/'f')" listing ONLY never-podiumed (wca_id, is_avg) pairs.
// v1: latest snapshot year only (current podium status ≈ year-end of the latest year).
// writes census_np.tsv: year, is_avg, incl_cancelled, no_podium('t'), rank, wca_id, subsets_won.
fn load_no_podium() -> (std::collections::HashSet<String>, std::collections::HashSet<String>) {
    let base = base();
    let data = std::fs::read_to_string(format!("{base}/no_podium.tsv")).unwrap();
    let mut s_single = std::collections::HashSet::with_capacity(300_000);
    let mut s_avg = std::collections::HashSet::with_capacity(300_000);
    for line in data.lines() {
        let mut it = line.split('\t');
        let id = it.next().unwrap_or("");
        let av = it.next().unwrap_or("");
        if id.is_empty() { continue; }
        if av == "t" { s_avg.insert(id.to_string()); } else { s_single.insert(id.to_string()); }
    }
    (s_single, s_avg)
}

// rebuild Data keeping only universe members whose wca_id is in `keep`; cols/rank/participants unchanged.
// d.wca is sorted asc and filtering preserves order, so the wca_id tie-break stays correct.
fn filter_universe(d: &Data, keep: &std::collections::HashSet<String>) -> Data {
    let idx: Vec<usize> = (0..d.n).filter(|&p| keep.contains(&d.wca[p])).collect();
    let n = idx.len();
    let mut wca = Vec::with_capacity(n);
    let mut name = Vec::with_capacity(n);
    let mut cols: Vec<Vec<i32>> = vec![vec![0i32; n]; NEV];
    let mut rank: Vec<Vec<i32>> = vec![vec![0i32; n]; NEV];
    for (np, &p) in idx.iter().enumerate() {
        wca.push(d.wca[p].clone());
        name.push(d.name[p].clone());
        for e in 0..NEV { cols[e][np] = d.cols[e][p]; rank[e][np] = d.rank[e][p]; }
    }
    Data { n, wca, name, cols, rank, participants: d.participants }
}

fn census_np(only_year: Option<i32>) {
    use std::io::Write;
    let t0 = Instant::now();
    let base = base();
    let pers = String::from_utf8_lossy(&std::fs::read(format!("{base}/persons.tsv")).unwrap()).into_owned();
    let mut name_of: HashMap<&str, &str> = HashMap::with_capacity(300_000);
    for line in pers.lines() {
        let mut it = line.split('\t');
        let id = it.next().unwrap_or("");
        let nm = it.next().unwrap_or("");
        if !id.is_empty() { name_of.insert(id, nm); }
    }
    let (gpersons, rows, years) = load_snapshot();
    let year = only_year.unwrap_or_else(|| *years.last().expect("no snapshot years"));
    let (np_single, np_avg) = load_no_podium();
    eprintln!("[census_np] year={} never-podiumed pool: single={} avg={}", year, np_single.len(), np_avg.len());

    let path = format!("{base}/census_np.tsv");
    let mut f = std::io::BufWriter::new(std::fs::File::create(&path).unwrap());
    let mut written = 0u64;
    for &is_avg in &[false, true] {
        let d_all = build_year_data(year, is_avg, &gpersons, &rows, &name_of);
        let keep = if is_avg { &np_avg } else { &np_single };
        let d = filter_universe(&d_all, keep);
        for &(incl_cancelled, nev) in &[(false, ACTIVE), (true, NEV)] {
            let pt = Instant::now();
            let (distinct, winners) = census_core(&d, nev);
            for (i, &(p, wins)) in winners.iter().enumerate() {
                writeln!(f, "{}\t{}\t{}\tt\t{}\t{}\t{}",
                    year, if is_avg {"t"} else {"f"}, if incl_cancelled {"t"} else {"f"},
                    i + 1, d.wca[p], wins).unwrap();
                written += 1;
            }
            eprintln!("[census_np] year={} {} cancelled={} n={} distinct={} ({:?})",
                year, if is_avg {"avg"} else {"single"}, incl_cancelled, d.n, distinct, pt.elapsed());
        }
    }
    f.flush().unwrap();
    eprintln!("[census_np] {} rows -> {} in {:?}", written, path, t0.elapsed());
}

// ---- top-K leaderboard for a given subset (verification) ----
fn show_subset(d: &Data, events: &[usize], k: usize) {
    let n = d.n;
    let mut total = vec![0i32; n];
    for &e in events { let c = &d.cols[e]; for p in 0..n { total[p] += c[p]; } }
    let mut idx: Vec<usize> = (0..n).collect();
    idx.sort_unstable_by(|&a, &b| total[a].cmp(&total[b]).then(d.wca[a].cmp(&d.wca[b])));
    let elabels: Vec<&str> = events.iter().map(|&e| ev_label(e)).collect();
    println!("\nSubset [{}] top {}:", elabels.join(","), k);
    println!("  #  total   wca_id      name             {}", elabels.iter().map(|e| format!("{:>7}", e)).collect::<String>());
    for (i, &p) in idx.iter().take(k).enumerate() {
        let rr: String = events.iter().map(|&e| {
            let r = d.rank[e][p];
            if r > 0 { format!("{:>7}", r) } else { format!("{:>7}", format!("+{}", d.participants[e]+1)) }
        }).collect();
        println!("{:>3}  {:>5}   {:<10}  {:<16} {}", i+1, total[p], d.wca[p], trunc(&d.name[p], 16), rr);
    }
}

fn trunc(s: &str, n: usize) -> String {
    let cs: Vec<char> = s.chars().collect();
    if cs.len() <= n { s.to_string() } else { cs[..n].iter().collect() }
}

// ---- Q1: best (minimum) achievable displayed rank for a player over all subsets ----
fn player_best(d: &Data, wca_id: &str) {
    let t0 = Instant::now();
    let n = d.n;
    let t = match d.wca.iter().position(|w| w == wca_id) {
        Some(t) => t,
        None => { println!("wca_id {} not in universe", wca_id); return; }
    };
    println!("\n=== Player {} ({}) ===", wca_id, d.name[t]);
    print!("per-event world ranks: ");
    for e in 0..NEV {
        let r = d.rank[e][t];
        if r > 0 { print!("{}={} ", ev_label(e), r); }
    }
    println!();

    const KHI: usize = 5;
    const NLO: usize = NEV - KHI;
    let nthreads = nthreads();
    let groups: Vec<u32> = (0..(1u32 << KHI)).collect();
    let chunk = (groups.len() + nthreads - 1) / nthreads;
    let cols = &d.cols;

    // best = (rank, popcount, mask); minimize rank, then fewest events, then mask
    let res: Vec<(i64, u32, u32)> = std::thread::scope(|s| {
        let mut hs = Vec::new();
        for ch in groups.chunks(chunk) {
            let ch = ch.to_vec();
            let h = s.spawn(move || {
                let mut total = vec![0i32; n];
                let mut best_rank = i64::MAX;
                let mut best_pc = u32::MAX;
                let mut best_mask = 0u32;
                for &g in &ch {
                    for p in 0..n { total[p] = 0; }
                    for hb in 0..KHI {
                        if g & (1 << hb) != 0 {
                            let e = NLO + hb; let c = &cols[e];
                            for p in 0..n { total[p] += c[p]; }
                        }
                    }
                    let mut prev_gray = 0u32;
                    let limit = 1u32 << NLO;
                    let mut code = 0u32;
                    loop {
                        let gray = code ^ (code >> 1);
                        if code != 0 {
                            let diff = gray ^ prev_gray;
                            let bit = diff.trailing_zeros() as usize;
                            let c = &cols[bit];
                            if gray & diff != 0 { for p in 0..n { total[p] += c[p]; } }
                            else { for p in 0..n { total[p] -= c[p]; } }
                        }
                        prev_gray = gray;
                        let mask = (g << NLO) | gray;
                        if mask != 0 {
                            let tt = total[t];
                            // rank = 1 + #{p ahead}: total<tt, or (==tt and index<t)
                            let mut ahead = 0i64;
                            for p in 0..n {
                                let tp = total[p];
                                if tp < tt || (tp == tt && p < t) { ahead += 1; }
                            }
                            let rank = ahead + 1;
                            let pc = mask.count_ones();
                            if rank < best_rank || (rank == best_rank && pc < best_pc) {
                                best_rank = rank; best_pc = pc; best_mask = mask;
                            }
                        }
                        code += 1;
                        if code == limit { break; }
                    }
                }
                (best_rank, best_pc, best_mask)
            });
            hs.push(h);
        }
        hs.into_iter().map(|h| h.join().unwrap()).collect()
    });
    let (rank, _pc, mask) = res.into_iter().min_by(|a, b| a.0.cmp(&b.0).then(a.1.cmp(&b.1))).unwrap();
    let evs: Vec<&str> = (0..NEV).filter(|&e| mask & (1<<e) != 0).map(ev_label).collect();
    println!("BEST achievable displayed rank = #{}", rank);
    println!("  using {} event(s): [{}]", evs.len(), evs.join(","));
    // show the leaderboard around them for that subset
    let elist: Vec<usize> = (0..NEV).filter(|&e| mask & (1<<e) != 0).collect();
    show_subset(d, &elist, 10);
    eprintln!("[player] done in {:?}", t0.elapsed());
}

// ---- Q1 FAST: pruned per-player best rank ----
// Pruning facts:
//  (a) p's optimal subset ⊆ events p has actually competed in (adding a no-result
//      event strictly worsens p's rank), so enumerate only 2^|E_p|.
//  (b) only candidates q that beat-or-tie p in >=1 of E_p can ever be ahead; the rest
//      are strictly worse in every event => never ahead. Filtering them is exact.
// cap: if |E_p| > cap keep p's `cap` best-ranked events (search space bound; logged).
fn player_fast(d: &Data, wca_id: &str, cap: usize) {
    let t0 = Instant::now();
    let t = match d.wca.iter().position(|w| w == wca_id) {
        Some(t) => t,
        None => { println!("wca_id {} not in universe", wca_id); return; }
    };
    // events p competed in, sorted by rank asc
    let mut evs: Vec<usize> = (0..NEV).filter(|&e| d.rank[e][t] > 0).collect();
    evs.sort_by_key(|&e| d.rank[e][t]);
    let full = evs.len();
    let capped = full > cap;
    if capped { evs.truncate(cap); }
    let m = evs.len();
    let pv: Vec<i32> = evs.iter().map(|&e| d.cols[e][t]).collect();

    // candidate set + per-event diff (cols_q - pv) layout [j][ci]; tie-break flag lt = idx<t
    let n = d.n;
    let mut cands: Vec<usize> = Vec::new();
    for q in 0..n {
        if q == t { continue; }
        if (0..m).any(|j| d.cols[evs[j]][q] <= pv[j]) { cands.push(q); }
    }
    let nc = cands.len();
    let mut dmat: Vec<Vec<i32>> = vec![vec![0i32; nc]; m]; // [j][ci]
    let mut lt: Vec<bool> = vec![false; nc];
    for (ci, &q) in cands.iter().enumerate() {
        lt[ci] = q < t;
        for j in 0..m { dmat[j][ci] = d.cols[evs[j]][q] - pv[j]; }
    }

    // parallel over high bits
    let khi = if m > 6 { 5usize.min(m) } else { 0 };
    let nlo = m - khi;
    let nthreads = nthreads();
    let groups: Vec<u32> = (0..(1u32 << khi)).collect();
    let chunk = ((groups.len() + nthreads - 1) / nthreads).max(1);
    let dmat = &dmat; let lt = &lt;

    let res: Vec<(i64, u32, u32)> = std::thread::scope(|s| {
        let mut hs = Vec::new();
        for ch in groups.chunks(chunk) {
            let ch = ch.to_vec();
            let h = s.spawn(move || {
                let mut g = vec![0i32; nc];
                let mut best_rank = i64::MAX;
                let mut best_pc = u32::MAX;
                let mut best_mask = 0u32;
                for &grp in &ch {
                    // base = high bits (positions nlo..m) included in grp
                    for ci in 0..nc { g[ci] = 0; }
                    for hb in 0..khi {
                        if grp & (1 << hb) != 0 {
                            let row = &dmat[nlo + hb];
                            for ci in 0..nc { g[ci] += row[ci]; }
                        }
                    }
                    let mut prev_gray = 0u32;
                    let limit = 1u32 << nlo;
                    let mut code = 0u32;
                    loop {
                        let gray = code ^ (code >> 1);
                        if code != 0 {
                            let diff = gray ^ prev_gray;
                            let bit = diff.trailing_zeros() as usize; // low event 0..nlo
                            let row = &dmat[bit];
                            if gray & diff != 0 { for ci in 0..nc { g[ci] += row[ci]; } }
                            else { for ci in 0..nc { g[ci] -= row[ci]; } }
                        }
                        prev_gray = gray;
                        let mask = (grp << nlo) | gray; // bit positions over evs[]
                        if mask != 0 {
                            // count candidates ahead: g<0, or (g==0 and idx<t)
                            let mut ahead = 0i64;
                            for ci in 0..nc {
                                let gv = g[ci];
                                if gv < 0 || (gv == 0 && lt[ci]) { ahead += 1; }
                            }
                            let rank = ahead + 1;
                            let pc = mask.count_ones();
                            if rank < best_rank || (rank == best_rank && pc < best_pc) {
                                best_rank = rank; best_pc = pc; best_mask = mask;
                            }
                        }
                        code += 1;
                        if code == limit { break; }
                    }
                }
                (best_rank, best_pc, best_mask)
            });
            hs.push(h);
        }
        hs.into_iter().map(|h| h.join().unwrap()).collect()
    });
    let (rank, _pc, mask) = res.into_iter().min_by(|a, b| a.0.cmp(&b.0).then(a.1.cmp(&b.1))).unwrap();
    let chosen: Vec<usize> = (0..m).filter(|&j| mask & (1 << j) != 0).map(|j| evs[j]).collect();
    let labels: Vec<&str> = chosen.iter().map(|&e| ev_label(e)).collect();
    println!("\n=== Player {} ({}) ===", wca_id, d.name[t]);
    println!("events={} (searched {}{}), candidates={}", full, m, if capped {" CAPPED"} else {""}, nc);
    println!("BEST achievable displayed rank = #{}", rank);
    println!("  using {} event(s): [{}]", labels.len(), labels.join(","));
    eprintln!("[fast {}] m={} cands={} done in {:?}", wca_id, m, nc, t0.elapsed());
}

// single-threaded pruned best-rank core (for batch precompute across players).
// Adaptive cap: keep p's best-ranked events but bound 2^m * candidates <= BUDGET so no
// single player blows up. Candidate-light elites keep a high cap (exact); candidate-heavy
// many-event players get a smaller cap (their best RANK is robust to which #1-combo we pick).
// Fused gray step maintains the ahead-count incrementally (one pass over candidates).
const BUDGET: u64 = 200_000_000;
// (KEEP cap removed — precompute now emits every tied combo; col3 tied-count == #combos listed.)
fn floor_log2(x: u64) -> u32 { if x < 2 { 0 } else { 63 - x.leading_zeros() } }

// nev = event-universe upper bound: 17 = active only, 21 = incl. cancelled (333ft/magic/mmagic/333mbo).
fn solve_st(d: &Data, t: usize, cap_max: usize, nev: usize) -> (i64, Vec<u32>, u64, Vec<usize>, usize) {
    let n = d.n;
    let mut evs: Vec<usize> = (0..nev).filter(|&e| d.rank[e][t] > 0).collect();
    evs.sort_by_key(|&e| d.rank[e][t]);
    if evs.len() > cap_max { evs.truncate(cap_max); }
    if evs.is_empty() { return (i64::MAX, Vec::new(), 0, evs, 0); }

    // build candidates for current events (anyone <= p in some event)
    let build = |evs: &[usize]| -> (Vec<i32>, Vec<usize>) {
        let pv: Vec<i32> = evs.iter().map(|&e| d.cols[e][t]).collect();
        let mut cands = Vec::new();
        for q in 0..n {
            if q == t { continue; }
            if (0..evs.len()).any(|j| d.cols[evs[j]][q] <= pv[j]) { cands.push(q); }
        }
        (pv, cands)
    };
    let (_pv0, cands0) = build(&evs);
    // adaptive cap from candidate count (cand only shrinks if we truncate, so this stays under budget)
    let cap_eff = (evs.len()).min(floor_log2(BUDGET / (cands0.len() as u64).max(1)) as usize).max(1);
    if cap_eff < evs.len() { evs.truncate(cap_eff); }
    let m = evs.len();
    let (pv, cands) = build(&evs);
    let nc = cands.len();

    let mut dmat: Vec<Vec<i32>> = vec![vec![0i32; nc]; m]; // [j][ci]
    let mut lt: Vec<bool> = vec![false; nc];
    for (ci, &q) in cands.iter().enumerate() {
        lt[ci] = q < t;
        for j in 0..m { dmat[j][ci] = d.cols[evs[j]][q] - pv[j]; }
    }
    let mut g = vec![0i32; nc];
    // ahead-count for the empty subset (all g=0 → ahead iff tie-break idx<t)
    let mut cnt: i64 = lt.iter().filter(|&&x| x).count() as i64;
    let mut best_rank = i64::MAX;
    // all subsets achieving best_rank: collect EVERY tied combo (no KEEP cap), sorted once after
    // the loop by (popcount, mask) ascending = fewest events first. Pushing is O(1); sorting once is
    // O(n log n) — vs. the old per-insert binary_search which was O(n^2) and would choke on the
    // balance-leaders (Luke ~82k tied). count == kept.len() now (full enumeration within the
    // searched event space; the adaptive cap above may exclude a player's worst events).
    let mut kept: Vec<(u32, u32)> = Vec::new();
    let mut tied: u64 = 0;
    let limit = 1u32 << m;
    let mut prev_gray = 0u32;
    let mut code = 0u32;
    loop {
        let gray = code ^ (code >> 1);
        if code != 0 {
            let diff = gray ^ prev_gray;
            let bit = diff.trailing_zeros() as usize;
            let row = &dmat[bit];
            let add = gray & diff != 0;
            for ci in 0..nc {
                let old = g[ci];
                let nv = if add { old + row[ci] } else { old - row[ci] };
                g[ci] = nv;
                let lti = lt[ci];
                let wa = old < 0 || (old == 0 && lti);
                let nva = nv < 0 || (nv == 0 && lti);
                if wa != nva { if nva { cnt += 1; } else { cnt -= 1; } }
            }
        }
        prev_gray = gray;
        if gray != 0 {
            let rank = cnt + 1;
            if rank < best_rank {
                best_rank = rank; tied = 1; kept.clear();
                kept.push((gray.count_ones(), gray));
            } else if rank == best_rank {
                tied += 1;
                kept.push((gray.count_ones(), gray));
            }
        }
        code += 1;
        if code == limit { break; }
    }
    kept.sort_unstable(); // (popcount, mask) asc → fewest events first, stable tie-break by mask
    (best_rank, kept.iter().map(|&(_, m)| m).collect(), tied, evs, nc)
}

// batch precompute: best rank + best combo for EVERY universe player, parallel across players.
// nev = 17 (active only) or 21 (incl. cancelled); output file suffixed by nev.
fn precompute(d: &Data, is_avg: bool, cap: usize, nev: usize) {
    use std::sync::atomic::{AtomicUsize, Ordering};
    let t0 = Instant::now();
    let n = d.n;
    let nthreads = nthreads();
    let chunk = (n + nthreads - 1) / nthreads;
    let done = AtomicUsize::new(0);
    let done = &done;
    eprintln!("[precompute {}] cap={} n={} threads={}", if is_avg {"average"} else {"single"}, cap, n, nthreads);
    let parts: Vec<Vec<(usize, i64, Vec<u32>, u64, Vec<usize>)>> = std::thread::scope(|s| {
        let mut hs = Vec::new();
        for start in (0..n).step_by(chunk) {
            let end = (start + chunk).min(n);
            let h = s.spawn(move || {
                let mut out: Vec<(usize, i64, Vec<u32>, u64, Vec<usize>)> = Vec::with_capacity(end - start);
                for t in start..end {
                    let pt = Instant::now();
                    let (rank, masks, tied, evs, nc) = solve_st(d, t, cap, nev);
                    let el = pt.elapsed();
                    if el.as_millis() > 1500 {
                        eprintln!("  SLOW {} m={} cand={} {:?}", d.wca[t], evs.len(), nc, el);
                    }
                    out.push((t, rank, masks, tied, evs));
                    let c = done.fetch_add(1, Ordering::Relaxed) + 1;
                    if c % 25000 == 0 { eprintln!("  ..{}/{} ({:?})", c, n, t0.elapsed()); }
                }
                out
            });
            hs.push(h);
        }
        hs.into_iter().map(|h| h.join().unwrap()).collect()
    });
    let typ = if is_avg { "average" } else { "single" };
    let path = format!("{}/best_{}_{}.tsv", base(), typ, nev);
    use std::io::Write;
    let mut f = std::io::BufWriter::new(std::fs::File::create(&path).unwrap());
    let mut written = 0u64;
    for part in &parts {
        for (t, rank, masks, tied, evs) in part {
            if *rank == i64::MAX { continue; }
            // each kept combo = comma-joined event labels; combos joined by ';'. col3 = full tied count.
            let combos: Vec<String> = masks.iter().map(|&mask|
                (0..evs.len()).filter(|&j| mask & (1 << j) != 0).map(|j| ev_label(evs[j])).collect::<Vec<_>>().join(",")
            ).collect();
            writeln!(f, "{}\t{}\t{}\t{}", d.wca[*t], rank, tied, combos.join(";")).unwrap();
            written += 1;
        }
    }
    f.flush().unwrap();
    eprintln!("[precompute {}] {} rows -> {} in {:?}", typ, written, path, t0.elapsed());
}

// histogram of events-competed counts (over all 21) to size a full precompute
fn events_dist(d: &Data) {
    let n = d.n;
    let mut hist = [0u32; NEV + 1];
    let mut sum_pow: f64 = 0.0;
    let mut ge = [0u32; NEV + 1]; // ge[k] = #players with >= k events
    for p in 0..n {
        let k = (0..NEV).filter(|&e| d.rank[e][p] > 0).count();
        hist[k] += 1;
        sum_pow += (1u64 << k) as f64;
    }
    let mut acc = 0u32;
    for k in (0..=NEV).rev() { acc += hist[k]; ge[k] = acc; }
    println!("\n events-competed histogram (universe={}):", n);
    for k in 0..=NEV { if hist[k] > 0 { println!("  {:>2} events: {:>7}  (>= {:>2}: {})", k, hist[k], k, ge[k]); } }
    println!(" sum of 2^events over all players = {:.3e}  (raw subset-evals for full precompute, x candidates)", sum_pow);
}

fn parse_events(s: &str) -> Vec<usize> {
    s.split(',').filter_map(|e| RANK_EVENTS.iter().position(|x| *x == e.trim())).collect()
}

fn main() {
    let args: Vec<String> = std::env::args().collect();
    let typ = args.get(1).map(|s| s.as_str()).unwrap_or("single");
    if typ == "history" {
        let only_year = args.get(2).and_then(|s| s.parse::<i32>().ok());
        census_history(only_year);
        return;
    }
    if typ == "census_np" {
        let only_year = args.get(2).and_then(|s| s.parse::<i32>().ok());
        census_np(only_year);
        return;
    }
    let is_avg = typ == "average" || typ == "avg";
    let d = load(is_avg);
    let mode = args.get(2).map(|s| s.as_str()).unwrap_or("census");
    match mode {
        "census" => census(&d),
        "top" => {
            let evs = parse_events(args.get(3).map(|s| s.as_str()).unwrap_or("333,222"));
            let k: usize = args.get(4).and_then(|s| s.parse().ok()).unwrap_or(10);
            show_subset(&d, &evs, k);
        }
        "player" => {
            for w in args.iter().skip(3) { player_best(&d, &w.to_uppercase()); }
        }
        "fast" => {
            // optional first token after mode = cap (numeric); rest = wca ids
            let mut rest: Vec<&String> = args.iter().skip(3).collect();
            let cap = rest.first().and_then(|s| s.parse::<usize>().ok());
            let cap = match cap { Some(c) => { rest.remove(0); c }, None => 21 };
            for w in rest { player_fast(&d, &w.to_uppercase(), cap); }
        }
        "dist" => events_dist(&d),
        "precompute" => {
            let cap = args.get(3).and_then(|s| s.parse::<usize>().ok()).unwrap_or(21);
            // arg 4 = event-universe size: 17 (active only) or 21 (incl. cancelled). default 21.
            let nev = args.get(4).and_then(|s| s.parse::<usize>().ok()).unwrap_or(NEV);
            precompute(&d, is_avg, cap, nev);
        }
        // 定点重算: `<typ> rows <nev> <id...>` — 只对名单里的选手跑 solve_st (同 cap=21/口径),
        // 输出与 precompute 字节一致的 4 列行 (wca_id\trank\ttied\tcombos) 到 stdout, 供 merge 进现有 TSV.
        "rows" => {
            let nev = args.get(3).and_then(|s| s.parse::<usize>().ok()).unwrap_or(NEV);
            for w in args.iter().skip(4) {
                let wu = w.to_uppercase();
                match d.wca.iter().position(|x| *x == wu) {
                    Some(t) => {
                        let (rank, masks, tied, evs, _nc) = solve_st(&d, t, 21, nev);
                        if rank == i64::MAX { eprintln!("skip {} rank=MAX", wu); continue; }
                        let combos: Vec<String> = masks.iter().map(|&mask|
                            (0..evs.len()).filter(|&j| mask & (1 << j) != 0).map(|j| ev_label(evs[j])).collect::<Vec<_>>().join(",")
                        ).collect();
                        println!("{}\t{}\t{}\t{}", d.wca[t], rank, tied, combos.join(";"));
                    }
                    None => eprintln!("not in universe: {}", wu),
                }
            }
        }
        _ => eprintln!("unknown mode {}", mode),
    }
}

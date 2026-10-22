//! Observe the original search, without allowing a candidate to prune it.
use super::{input, json, load_opt, number, replay, word};
use cube48opt_research::{
    coord::CoordTables,
    corner_joint::{JointPdb, JointTransitions, JointThresholds, PAIR_EDGES},
    corner_oracle::{DistanceGatedOracle, IndependentDistance},
    cube::Cube,
    search::{self, SearchOptions},
};
use std::{cell::RefCell, fs, path::Path, time::Instant};

struct ThresholdGate<'a> {
    table: &'a JointThresholds<PAIR_EDGES>,
    transitions: &'a JointTransitions<PAIR_EDGES>,
}

impl IndependentDistance for ThresholdGate<'_> {
    #[inline(always)]
    fn bound(&self, cube: &Cube, remaining: u8) -> Option<u8> {
        if remaining == 9 || remaining == 10 { Some(self.table.lookup(cube, self.transitions)) }
        else { None }
    }
}

pub fn solve(args: &[String]) -> Result<(), String> {
    let started = Instant::now();
    if fs::metadata(&args[1]).map_err(|e| e.to_string())?.len() != 818_008 {
        return Err("joint geometry requires the 818008-byte Opt8 small snapshot".into());
    }
    let small = CoordTables::from_variant_bytes(&fs::read(&args[1]).map_err(|e| e.to_string())?, 8)?;
    let transitions = JointTransitions::<PAIR_EDGES>::new(&small)?;
    let table = JointPdb::load(Path::new(&args[3]), &transitions)?.into_thresholds()?;
    let solver = load_opt("8", Path::new(&args[1]), Path::new(&args[2]))?;
    let base = solver.experimental_native_opt8_oracle().ok_or("expected Opt8")?;
    let gate = ThresholdGate { table: &table, transitions: &transitions };
    let oracle = DistanceGatedOracle::with_independent(&base, &gate);
    let max_nodes = number(&args[4], 1, 1_000_000_000, "node budget")?;
    let pid = std::process::id();
    println!("{{\"kind\":\"joint-pair-solve-ready\",\"pid\":{pid},\"contexts\":8,\"threads\":1,\"prepared_bytes\":{},\"remaining_gate\":[9,10],\"startup_seconds\":{}}}",
        table.bytes(), started.elapsed().as_secs_f64());
    let mut count = 0;
    input(|id, cube| {
        if count >= 100 { return Err("joint pair candidate accepts at most 100 cases per resident process".into()); }
        let started = Instant::now();
        let result = search::solve(cube, &oracle, SearchOptions { max_depth: 20, max_nodes, contexts: 8 })?;
        let seconds = started.elapsed().as_secs_f64();
        if result.cancelled { return Err("joint pair candidate was cancelled".into()); }
        let moves = result.solution.ok_or("joint pair candidate exhausted its node budget")?;
        replay(cube, &moves, false)?;
        println!("{{\"kind\":\"joint-pair-solve\",\"pid\":{pid},\"id\":{},\"length\":{},\"solution\":{},\"nodes\":{},\"probes\":{},\"seconds\":{seconds}}}",
            json(id), moves.len(), json(&word(&moves)), result.stats.nodes, result.stats.probes);
        count += 1;
        Ok(())
    })
}

#[derive(Default, Clone, Copy)]
struct Depth {
    survivors: u64,
    sampled: u64,
    one: u64,
    inverse_pair: u64,
    spatial48: u64,
    all96: u64,
}

struct Observer<'a, const E: usize> {
    table: &'a JointPdb<E>,
    transitions: &'a JointTransitions<E>,
    small: &'a CoordTables,
    counts: RefCell<[Depth; 21]>,
}

impl<const E: usize> IndependentDistance for Observer<'_, E> {
    fn bound(&self, cube: &Cube, remaining: u8) -> Option<u8> {
        let mut counts = self.counts.borrow_mut();
        let row = &mut counts[usize::from(remaining)];
        row.survivors += 1;
        // Fixed deterministic sample of actual survivors, not random cubes.
        // At remaining >= maximum no view can reject; count without a lookup.
        if remaining < 9 || remaining >= self.table.maximum || row.survivors % 256 != 0 {
            return None;
        }
        row.sampled += 1;
        let bound = self.table.lookup(cube, self.transitions);
        let inverse = cube.inverse();
        let inverse_bound = self.table.lookup(&inverse, self.transitions);
        let mut normal_max = bound;
        let mut inverse_max = inverse_bound;
        // This is an optimistic strength diagnostic. It deliberately pays for
        // every spatial view, including duplicates; its timing is not a score.
        for s in 0..48 {
            normal_max = normal_max.max(self.table.lookup(&self.small.conjugate(cube, s), self.transitions));
            inverse_max = inverse_max.max(self.table.lookup(&self.small.conjugate(&inverse, s), self.transitions));
        }
        row.one += u64::from(bound > remaining);
        row.inverse_pair += u64::from(bound.max(inverse_bound) > remaining);
        row.spatial48 += u64::from(normal_max > remaining);
        row.all96 += u64::from(normal_max.max(inverse_max) > remaining);
        None // Always preserve the baseline's search decisions.
    }
}

pub fn probe<const E: usize>(args: &[String]) -> Result<(), String> {
    let started = Instant::now();
    if fs::metadata(&args[1]).map_err(|e| e.to_string())?.len() != 818_008 {
        return Err("joint geometry requires the 818008-byte Opt8 small snapshot".into());
    }
    let small = CoordTables::from_variant_bytes(&fs::read(&args[1]).map_err(|e| e.to_string())?, 8)?;
    let transitions = JointTransitions::<E>::new(&small)?;
    let table = JointPdb::load(Path::new(&args[3]), &transitions)?;
    // Exhaustive concrete shallow words and inverses: no projected bound may
    // exceed their known path length. Spatial images permute these same words.
    fn check<const E: usize>(cube: Cube, depth: u8, table: &JointPdb<E>, transitions: &JointTransitions<E>) -> Result<(), String> {
        if table.lookup(&cube, transitions) > depth || table.lookup(&cube.inverse(), transitions) > depth {
            return Err("joint bound exceeds a known concrete path".into());
        }
        if depth < 4 { for m in 0..18 { check(cube.moved(m), depth + 1, table, transitions)?; } }
        Ok(())
    }
    check(Cube::SOLVED, 0, &table, &transitions)?;
    let solver = load_opt("8", Path::new(&args[1]), Path::new(&args[2]))?;
    let base = solver.experimental_native_opt8_oracle().ok_or("expected Opt8")?;
    let max_nodes = number(&args[4], 1, 1_000_000_000, "node budget")?;
    let pid = std::process::id();
    println!("{{\"kind\":\"joint-probe-ready\",\"pid\":{pid},\"edge_states\":{E},\"contexts\":8,\"threads\":1,\"sample_stride\":256,\"maximum\":{},\"startup_seconds\":{}}}", table.maximum, started.elapsed().as_secs_f64());
    let mut count = 0;
    input(|id, cube| {
        if count >= 20 { return Err("joint diagnostic accepts at most 20 cases per resident process".into()); }
        let observer = Observer { table: &table, transitions: &transitions, small: &small,
            counts: RefCell::new([Depth::default(); 21]) };
        let oracle = DistanceGatedOracle::with_independent(&base, &observer);
        let started = Instant::now();
        let result = search::solve(cube, &oracle, SearchOptions { max_depth: 20, max_nodes, contexts: 8 })?;
        let seconds = started.elapsed().as_secs_f64();
        if result.cancelled { return Err("joint diagnostic was cancelled".into()); }
        let moves = result.solution.ok_or("joint diagnostic exhausted its node budget")?;
        replay(cube, &moves, false)?;
        let rows = observer.counts.borrow().iter().enumerate().map(|(remaining, d)|
            format!("{{\"remaining\":{remaining},\"survivors\":{},\"sampled\":{},\"one\":{},\"inverse_pair\":{},\"spatial48\":{},\"all96\":{}}}",
                d.survivors, d.sampled, d.one, d.inverse_pair, d.spatial48, d.all96)).collect::<Vec<_>>().join(",");
        println!("{{\"kind\":\"joint-probe\",\"pid\":{pid},\"id\":{},\"length\":{},\"solution\":{},\"nodes\":{},\"probes\":{},\"diagnostic_seconds\":{seconds},\"depths\":[{rows}]}}",
            json(id), moves.len(), json(&word(&moves)), result.stats.nodes, result.stats.probes);
        count += 1;
        Ok(())
    })
}

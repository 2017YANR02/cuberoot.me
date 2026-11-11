#[path = "../../src/cube_common.rs"]
mod cc;

use std::collections::{BTreeSet, HashMap, VecDeque};
use cc::{Move, State};

fn apply(mut state: State, moves: &[Move]) -> State {
    for &mv in moves { state.apply(mv); }
    state
}

fn edge(state: State, piece: usize) -> u8 {
    let p = state.edges.iter().position(|v| *v as usize / 2 == piece).unwrap();
    2 * p as u8 + state.edges[p] % 2
}

fn corner(state: State, piece: usize) -> u8 {
    let p = state.corners.iter().position(|v| *v as usize / 3 == piece).unwrap();
    3 * p as u8 + state.corners[p] % 3
}

fn cross(state: State) -> [u8; 4] {
    std::array::from_fn(|i| edge(state, i + 8))
}

type Ins = BTreeSet<([u8; 4], u8)>;
type Pair = BTreeSet<(u8, u8)>;

fn std_seeds() -> (Ins, Pair) {
    let mut states = vec![State::SOLVED];
    for text in ["L U L'", "L U' L'", "B' U B", "B' U' B"] {
        let base = apply(State::SOLVED, &cc::string_to_alg(text));
        states.push(base);
        for m in 0..3 { states.push(base.applied(Move::from_index(m))); }
    }
    (states.iter().map(|&s| (cross(s), corner(s, 4))).collect(),
     states.iter().map(|&s| (edge(s, 0), corner(s, 4))).collect())
}

fn ps_seeds(c: usize, e: usize) -> (Ins, Pair) {
    let algs = [
        ["L U L'", "L U' L'", "B' U B", "B' U' B"],
        ["R' U R", "R' U' R", "B U B'", "B U' B'"],
        ["R U R'", "R U' R'", "F' U F", "F' U' F"],
        ["L' U L", "L' U' L", "F U F'", "F U' F'"],
    ];
    let first = [[0,3,4,5],[5,0,3,4],[4,5,0,3],[3,4,5,0]];
    let mut ins_states = vec![State::SOLVED];
    let mut pair_states = vec![State::SOLVED];
    for mv in 3..6 {
        let s = State::SOLVED.applied(Move::from_index(mv));
        ins_states.push(s); pair_states.push(s);
    }
    for text in algs[e] {
        let base = apply(State::SOLVED.applied(Move::from_index(first[e][c])), &cc::string_to_alg(text));
        ins_states.push(base); pair_states.push(base);
        for mv in 3..6 {
            ins_states.push(base.applied(Move::from_index(mv)));
            pair_states.push(base.applied(Move::from_index(mv)));
        }
        let u = base.applied(Move::U);
        pair_states.push(u);
        for mv in 3..6 {
            ins_states.push(u.applied(Move::from_index(mv)));
            pair_states.push(u.applied(Move::from_index(mv)));
        }
        for off in 1..3 {
            let s = base.applied(Move::from_index(off));
            ins_states.push(s); pair_states.push(s);
            for mv in 3..6 {
                ins_states.push(s.applied(Move::from_index(mv)));
                pair_states.push(s.applied(Move::from_index(mv)));
            }
        }
    }
    (ins_states.iter().map(|&s| (cross(s), corner(s, c + 4))).collect(),
     pair_states.iter().map(|&s| (edge(s, e), corner(s, c + 4))).collect())
}

fn joint(ins: &Ins, pair: &Pair) -> BTreeSet<([u8;4], u8, u8)> {
    let mut out = BTreeSet::new();
    for &(cr, c) in ins {
        for &(e, pc) in pair {
            if c == pc && cr.iter().all(|x| *x / 2 != e / 2) {
                out.insert((cr, c, e));
            }
        }
    }
    out
}

fn move_tables() -> ([[u8;18];24], [[u8;18];24]) {
    let mut em = [[0;18];24];
    let mut cm = [[0;18];24];
    for raw in 0..24 {
        for mv in 0..18 {
            let mut e = State::SOLVED;
            e.edges[raw/2] = raw as u8;
            em[raw][mv] = edge(e.applied(Move::from_index(mv)), raw/2);
            let mut c = State::SOLVED;
            c.corners[raw/3] = raw as u8;
            cm[raw][mv] = corner(c.applied(Move::from_index(mv)), raw/3);
        }
    }
    (em,cm)
}

fn frame_map(mt: &[[u8;18];24], slot: usize, physical: usize, canonical: usize) -> [u8;24] {
    let mut out = [u8::MAX;24];
    let mut q = VecDeque::from([(physical,canonical)]);
    out[physical] = canonical as u8;
    while let Some((p,c)) = q.pop_front() {
        for mv in 0..18 {
            let pn=mt[p][mv] as usize;
            let cn=mt[c][cc::conj_moves_flat()[mv][slot] as usize] as usize;
            if out[pn] == u8::MAX { out[pn]=cn as u8; q.push_back((pn,cn)); }
            else { assert_eq!(out[pn], cn as u8); }
        }
    }
    assert!(out.iter().all(|v| *v != u8::MAX));
    out
}

fn normalise(goals: BTreeSet<([u8;4],u8,u8)>, em: &[u8;24], cm: &[u8;24]) -> BTreeSet<([u8;4],u8,u8)> {
    goals.into_iter().map(|(cross,c,e)| {
        let mut cr=[0;4];
        for i in 0..4 {
            let label=em[(8+i)*2] as usize/2-8;
            cr[label]=em[cross[i] as usize] ^ (em[(8+i)*2] & 1);
        }
        (cr,cm[c as usize],em[e as usize])
    }).collect()
}

fn pack(values: &[u8]) -> u32 {
    values.iter().enumerate().fold(0,|acc,(i,v)| acc|((*v as u32)<<(5*i)))
}

fn bfs(seeds: Vec<u32>, corner_field: usize, fields: usize, em: &[[u8;18];24], cm: &[[u8;18];24]) -> HashMap<u32,u8> {
    let mut seen=HashMap::new();
    let mut q=VecDeque::new();
    for s in seeds { if seen.insert(s,0).is_none() { q.push_back(s); } }
    while let Some(s)=q.pop_front() {
        let d=seen[&s];
        if d==3 { continue; }
        for mv in 0..18 {
            let mut n=0;
            for field in 0..fields {
                let raw=((s>>(5*field))&31) as usize;
                let v=if field==corner_field { cm[raw][mv] } else { em[raw][mv] };
                n|=(v as u32)<<(5*field);
            }
            if let std::collections::hash_map::Entry::Vacant(e)=seen.entry(n) { e.insert(d+1); q.push_back(n); }
        }
    }
    seen
}

fn psxx_goals(corners: [usize;2], edges: [usize;2]) -> Vec<[u8;8]> {
    let mut out=Vec::new();
    for d in [None,Some(Move::D),Some(Move::D2),Some(Move::DPrime)] {
        let s=d.map(|m|State::SOLVED.applied(m)).unwrap_or(State::SOLVED);
        let cr=cross(s);
        out.push([cr[0],cr[1],cr[2],cr[3],edge(s,edges[0]),edge(s,edges[1]),corner(s,corners[0]+4),corner(s,corners[1]+4)]);
    }
    out
}

fn psxx_goal_classes() {
    let pairs=[[0,1],[0,2],[0,3],[1,2],[1,3],[2,3]];
    let mut classes=std::collections::BTreeMap::<Vec<[u8;8]>,usize>::new();
    for cs in pairs {
        for es in pairs {
            let mut best=None;
            for frame in 0..4 {
                assert_eq!(cc::conj_moves_flat()[Move::D.index()][frame],Move::D.index() as u8);
                let c=cs.map(|v|(v+4-frame)%4);
                let e=es.map(|v|(v+4-frame)%4);
                for shift in 0..4 {
                    for swap_c in [false,true] {
                        for swap_e in [false,true] {
                            let mut goals=psxx_goals(c,e);
                            for g in &mut goals {
                                let cross=[g[0],g[1],g[2],g[3]];
                                for i in 0..4 {g[i]=cross[(i+shift)%4];}
                                if swap_e {g.swap(4,5);}
                                if swap_c {g.swap(6,7);}
                            }
                            goals.sort();
                            if best.as_ref().map(|b|goals<*b).unwrap_or(true) {best=Some(goals);}
                        }
                    }
                }
            }
            *classes.entry(best.unwrap()).or_default()+=1;
        }
    }
    assert_eq!(classes.len(),4);
    println!("36 pseudo XXCross (corner-set,edge-set) goals have 4 classes under y-frame, cross-label cyclic permutation, and tracked-pair ordering; class sizes={:?}", classes.values().collect::<Vec<_>>());
}

fn main() {
    let (ins, pair) = std_seeds();
    let combined = joint(&ins, &pair);
    assert_eq!(combined.len(), pair.len());
    assert!(combined.iter().all(|(c,_,_)| *c == [16,18,20,22]));
    println!("standard ins_seeds={} pair_seeds={} joint_seeds={}", ins.len(), pair.len(), combined.len());
    println!("standard_joint={combined:?}");
    for c in 0..4 {
        for e in 0..4 {
            let (ins, pair) = ps_seeds(c,e);
            let combined = joint(&ins, &pair);
            println!("pseudo c={c} e={e} ins_seeds={} pair_seeds={} joint_seeds={}", ins.len(), pair.len(), combined.len());
        }
    }
    let (em,cm)=move_tables();
    for c in 0..4 {
        let frame_e=frame_map(&em,c,2*c,0);
        let frame_c=frame_map(&cm,c,3*(c+4),12);
        for e in 0..4 {
            let (ins,pair)=ps_seeds(c,e);
            let (ci,cp)=ps_seeds(0,(e+4-c)%4);
            assert_eq!(normalise(joint(&ins,&pair), &frame_e,&frame_c),joint(&ci,&cp),"c={c} e={e}");
        }
    }
    println!("all 16 pseudo goal sets normalise exactly to 4 corner-canonical diff tables; 68 seeds each");
    psxx_goal_classes();
    let js=combined.iter().map(|&(cr,c,e)|pack(&[cr[0],cr[1],cr[2],cr[3],c,e])).collect();
    let is=ins.iter().map(|&(cr,c)|pack(&[cr[0],cr[1],cr[2],cr[3],c])).collect();
    let ps=pair.iter().map(|&(e,c)|pack(&[e,c])).collect();
    let jd=bfs(js,4,6,&em,&cm);
    let id=bfs(is,4,5,&em,&cm);
    let pd=bfs(ps,1,2,&em,&cm);
    let mut greater=0;
    let mut hist=[[0usize;4];4];
    for (&key,&d) in &jd {
        let ih=id[&(key & ((1<<25)-1))];
        let ph=pd[&pack(&[((key>>25)&31) as u8,((key>>20)&31) as u8])];
        let h=ih.max(ph);
        assert!(h<=d);
        hist[d as usize][h as usize]+=1;
        if h<d { greater+=1; }
    }
    let capacity=jd.capacity()+id.capacity()+pd.capacity();
    assert!(capacity*16<32*1024*1024);
    println!("3-ply standard coordinate model: joint={} ins={} pair={} stronger_joint={} histogram_joint_then_projection={:?} conservative_hash_capacity_bytes={}",jd.len(),id.len(),pd.len(),greater,hist,capacity*16);
    let d = State::SOLVED.applied(Move::D);
    assert_ne!(cross(d), cross(State::SOLVED));
    assert_eq!(apply(d, &[Move::DPrime]), State::SOLVED);
    println!("D counterexample: pseudo target distance=0, standard target distance=1; standard raw lookup cannot be used as pseudo lower bound");
}

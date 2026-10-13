// SPDX-License-Identifier: GPL-3.0-or-later
//! Low-memory differential check: auxiliary tables plus individual 64-byte
//! PDB rows only. No mapping, full-table scan, table generation, or search.
//! Input protocol is documented in ../h10-oracle.c; use ../verify-h10.mjs.
use cube48opt_research::{
    cube::{Cube, MOVES},
    h10_coord::{CornerData, H10State, COCSEP_ENTRIES, EOESEP_ENTRIES, ESEP_ENTRIES},
};
use std::{
    env,
    fs::File,
    io::{self, BufRead, Read, Seek, SeekFrom},
};

const TABLE_BYTES: u64 = 30_336_314_216;
const MAIN_OFFSET: u64 = 1_120_768;
const ESEP_OFFSET: u64 = 30_335_374_848;
const EOESEP_OFFSET: u64 = 30_335_513_448;

fn read_at(file: &mut File, offset: u64, bytes: &mut [u8]) {
    assert!(offset <= TABLE_BYTES && bytes.len() as u64 <= TABLE_BYTES - offset);
    file.seek(SeekFrom::Start(offset))
        .expect("seek sampled data");
    file.read_exact(bytes).expect("read sampled data");
}

fn words(file: &mut File, offset: u64, count: u32) -> Vec<u32> {
    let mut bytes = vec![0; count as usize * 4];
    read_at(file, offset, &mut bytes);
    bytes
        .chunks_exact(4)
        .map(|b| u32::from_le_bytes(b.try_into().unwrap()))
        .collect()
}

fn hex<const N: usize>(text: &str) -> [u8; N] {
    assert_eq!(text.len(), 2 * N);
    let mut result = [0; N];
    for (i, b) in result.iter_mut().enumerate() {
        *b = u8::from_str_radix(&text[2 * i..2 * i + 2], 16).expect("hex byte");
    }
    result
}

fn number(text: &str) -> u64 {
    text.parse().expect("unsigned integer")
}

fn check_fast_scalar(state: &H10State, cdata: u32, edata: u32) -> u64 {
    assert_eq!(
        state.raw_esep(),
        state.raw_esep_scalar(),
        "fast/scalar raw ESEP"
    );
    assert_eq!(state.raw_eo(), state.raw_eo_scalar(), "fast/scalar raw EO");
    assert_eq!(
        state.main_index(cdata),
        state.main_index_scalar(cdata),
        "fast/scalar main index"
    );
    assert_eq!(
        state.eoesep_index(edata),
        state.eoesep_index_scalar(edata),
        "fast/scalar EOESEP index"
    );
    let mut transformations = 0;
    for symmetry in 0..48 {
        assert_eq!(
            state.transformed_edges(symmetry),
            state.transformed_edges_scalar(symmetry),
            "fast/scalar edge transform {symmetry}"
        );
        transformations += 1;
    }
    transformations
}

fn main() {
    let args: Vec<_> = env::args().collect();
    assert_eq!(
        args.len(),
        2,
        "usage: verify_h10_coordinates H10_TABLE < oracle.tsv"
    );
    let mut file = File::open(&args[1]).expect("H10 table");
    let metadata = file.metadata().unwrap();
    assert!(metadata.is_file());
    assert_eq!(metadata.len(), TABLE_BYTES);
    let cocsep = words(&mut file, 512, COCSEP_ENTRIES);
    let esep = words(&mut file, ESEP_OFFSET, ESEP_ENTRIES);
    let mut auxiliary = vec![0; EOESEP_ENTRIES as usize / 2];
    read_at(&mut file, EOESEP_OFFSET, &mut auxiliary);
    let (mut rows, mut transformations, mut half_turns) = (0, 0, 0);
    let (mut zero_codes, mut nonzero_codes) = (0, 0);
    let (mut fast_scalar_states, mut fast_scalar_transformations) = (0, 0);
    let mut previous: Option<(String, String)> = None;
    for line in io::stdin().lock().lines() {
        let line = line.expect("input");
        let fields: Vec<_> = line.split('\t').collect();
        assert_eq!(fields.len(), 64, "oracle columns");
        let side = number(fields[1]);
        assert_eq!(side, rows % 2, "normal/inverse row order");
        if side == 0 {
            previous = Some((fields[0].into(), fields[2].into()));
        } else {
            assert_eq!(
                previous.as_ref().unwrap(),
                &(fields[0].into(), fields[2].into())
            );
        }
        let normal = Cube::from_scramble(fields[2]).expect("scramble");
        let cube = if side == 0 { normal } else { normal.inverse() };
        let state = H10State::from_cube(&cube);
        assert_eq!(
            state.to_bytes(),
            hex::<20>(fields[3]),
            "Nissy physical state {} side {side}",
            fields[0]
        );
        assert_eq!(u64::from(state.raw_cocsep()), number(fields[4]));
        assert_eq!(u64::from(state.raw_esep()), number(fields[5]));
        assert_eq!(u64::from(state.raw_eo()), number(fields[6]));
        let cdata = cocsep[state.raw_cocsep() as usize];
        assert_eq!(u64::from(cdata), number(fields[7]));
        let corner = CornerData::from_word(cdata);
        let index = state.main_index(cdata);
        assert_eq!(index, number(fields[8]), "main coordinate");
        assert_eq!(u64::from(corner.bound), number(fields[9]));
        let edata = esep[state.raw_esep() as usize];
        let auxiliary_index = state.eoesep_index(edata);
        fast_scalar_transformations += check_fast_scalar(&state, cdata, edata);
        fast_scalar_states += 1;
        assert_eq!(
            u64::from(auxiliary_index),
            number(fields[10]),
            "auxiliary coordinate"
        );
        let auxiliary_bound =
            (auxiliary[auxiliary_index as usize / 2] >> (4 * (auxiliary_index % 2))) & 15;
        assert_eq!(u64::from(auxiliary_bound), number(fields[11]));
        let mut physical_line = [0; 64];
        read_at(
            &mut file,
            MAIN_OFFSET + (index / 254) * 64,
            &mut physical_line,
        );
        let local_index = index % 254;
        let code = (physical_line[local_index as usize / 4] >> (2 * (local_index % 4))) & 3;
        let line_min = physical_line[63] >> 4;
        let main_bound = if code == 0 {
            zero_codes += 1;
            line_min.max(auxiliary_bound)
        } else {
            nonzero_codes += 1;
            10 + code
        };
        let bound = main_bound.max(corner.bound);
        assert_eq!(u64::from(code), number(fields[12]));
        assert_eq!(u64::from(line_min), number(fields[13]));
        assert_eq!(u64::from(main_bound), number(fields[14]));
        assert_eq!(u64::from(bound), number(fields[15]));
        for symmetry in 0..48 {
            assert_eq!(
                state.transformed_edges(symmetry),
                hex::<12>(fields[16 + symmetry as usize]),
                "edge transform {symmetry}"
            );
            transformations += 1;
        }
        for movement in [1, 4, 7, 10, 13, 16] {
            // Cached opposite-side bounds require LEFT half-turn invariance.
            // A right half turn is not the property used by the search.
            let moved = H10State::from_cube(&MOVES[movement].multiplied(&cube));
            assert_eq!(moved.raw_cocsep(), state.raw_cocsep());
            let moved_cdata = cocsep[moved.raw_cocsep() as usize];
            assert_eq!(
                moved.main_index(moved_cdata),
                index,
                "left half-turn main coordinate"
            );
            let moved_edata = esep[moved.raw_esep() as usize];
            fast_scalar_transformations += check_fast_scalar(&moved, moved_cdata, moved_edata);
            fast_scalar_states += 1;
            assert_eq!(
                moved.eoesep_index(moved_edata),
                auxiliary_index,
                "left half-turn auxiliary coordinate"
            );
            half_turns += 1;
        }
        rows += 1;
    }
    assert!(rows > 0 && rows % 2 == 0);
    assert_eq!(fast_scalar_states, rows + half_turns);
    assert_eq!(fast_scalar_transformations, fast_scalar_states * 48);
    println!("{{\"inputCases\":{},\"normalInverseStates\":{},\"edgeTransformations\":{},\"leftHalfTurnChecks\":{},\"sampledMainRows\":{},\"zeroCodes\":{},\"nonzeroCodes\":{},\"h10FastCoordEnabled\":{},\"fastScalar\":{{\"states\":{},\"baseStates\":{},\"leftHalfTurnStates\":{},\"rawEsepComparisons\":{},\"rawEoComparisons\":{},\"mainIndexComparisons\":{},\"eoesepIndexComparisons\":{},\"edgeTransformations\":{}}},\"allEqual\":true}}",
        rows / 2, rows, transformations, half_turns, rows, zero_codes, nonzero_codes,
        cfg!(feature = "h10-fast-coord"), fast_scalar_states, rows, half_turns,
        fast_scalar_states, fast_scalar_states, fast_scalar_states, fast_scalar_states,
        fast_scalar_transformations);
}

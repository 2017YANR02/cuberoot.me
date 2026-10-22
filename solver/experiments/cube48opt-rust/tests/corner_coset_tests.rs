#![cfg(feature = "corner-research")]

//! Mathematical boundary checks for the corner-coset experiment.
//! These tests construct only the small factorized transition arrays and the
//! 96-element corner half-turn group. They never build or load a pruning table.
//! The implementation-writing session did not execute these tests.

use cube48opt_research::corner_coset::{
    in_h, in_k, lower_bound4, lower_bound5, orientation_rank, orientation_unrank, rank,
    rank_unchecked, unrank, CornerTransitions, COSET_COUNT, HALF_TURNS,
    ORIENTATION_COUNT, PERM_COSET_COUNT, SOLVED_INDEX,
};
use cube48opt_research::cube::{Cube, MOVES};
use std::collections::HashSet;
use std::sync::OnceLock;

fn transitions() -> &'static CornerTransitions {
    static TRANSITIONS: OnceLock<CornerTransitions> = OnceLock::new();
    TRANSITIONS.get_or_init(|| CornerTransitions::new().expect("repository moves define transitions"))
}

fn three_cycle_in_one_tetrad() -> Cube {
    let mut cube = Cube::SOLVED;
    cube.corners[..3].copy_from_slice(&[1, 2, 0]);
    cube
}

fn check_representative_and_successors(index: usize) {
    let cube = unrank(index).expect("coordinate is in range");
    cube.validate().expect("unrank returns a legal complete cube");
    assert_eq!(rank(&cube).unwrap(), index, "rank/unrank at {index}");
    assert_eq!(rank_unchecked(&cube), index);
    assert_eq!(orientation_rank(&cube), index % ORIENTATION_COUNT);

    for (movement, generator) in MOVES.iter().enumerate() {
        // The reference is the repository's complete cubie multiplication,
        // independent of the two stored coordinate-transition factors.
        let actual = cube.multiplied(generator);
        let expected = rank(&actual).unwrap();
        assert_eq!(
            transitions().successor(index, movement as u8).unwrap(),
            expected,
            "factorized move at coordinate {index}, move {movement}",
        );
        assert_eq!(
            transitions().successor_unchecked(index, movement as u8),
            expected,
        );
    }
}

#[test]
fn checked_coordinates_accept_corner_states_and_reject_invalid_corners() {
    assert_eq!(rank(&Cube::SOLVED).unwrap(), SOLVED_INDEX);
    assert_eq!(unrank(SOLVED_INDEX).unwrap(), Cube::SOLVED);
    for generator in &MOVES {
        assert!(rank(generator).is_ok());
        assert!(rank(&generator.inverse()).is_ok());
    }

    let witness = three_cycle_in_one_tetrad();
    witness.validate().unwrap();
    assert!(rank(&witness).is_ok());

    let mut balanced_twists = Cube::SOLVED;
    balanced_twists.corners[0] |= 1 << 3;
    balanced_twists.corners[7] |= 2 << 3;
    balanced_twists.validate().unwrap();
    assert!(rank(&balanced_twists).is_ok());

    let mut out_of_range = Cube::SOLVED;
    out_of_range.corners[0] = 24;
    assert!(rank(&out_of_range).is_err());

    let mut duplicate = Cube::SOLVED;
    duplicate.corners[0] = duplicate.corners[1];
    assert!(rank(&duplicate).is_err());

    let mut unbalanced_twist = Cube::SOLVED;
    unbalanced_twist.corners[0] |= 1 << 3;
    assert!(rank(&unbalanced_twist).is_err());

    // A corner projection deliberately makes no claim about supplied edges.
    // Even malformed edge bytes must not be read by the checked corner rank.
    let mut ignored_edges = balanced_twists;
    ignored_edges.edges = [u8::MAX; 12];
    assert_eq!(rank(&ignored_edges), rank(&balanced_twists));

    assert!(unrank(COSET_COUNT).is_err());
    assert!(orientation_unrank(ORIENTATION_COUNT).is_err());
    assert!(transitions().successor(COSET_COUNT, 0).is_err());
    assert!(transitions().successor(0, 18).is_err());
}

#[test]
fn every_pure_permutation_coset_round_trips_and_has_correct_right_moves() {
    for permutation in 0..PERM_COSET_COUNT {
        let index = permutation * ORIENTATION_COUNT;
        check_representative_and_successors(index);
        let cube = unrank(index).unwrap();
        assert!(cube.corners.iter().all(|&corner| corner < 8));
    }
}

#[test]
fn every_pure_orientation_round_trips_and_has_correct_right_moves() {
    for orientation in 0..ORIENTATION_COUNT {
        check_representative_and_successors(orientation);
        let cube = unrank(orientation).unwrap();
        let twists = orientation_unrank(orientation).unwrap();
        let mut twist_sum = 0_u16;
        for (position, &corner) in cube.corners.iter().enumerate() {
            assert_eq!(usize::from(corner & 7), position);
            assert_eq!(corner >> 3, twists[position]);
            twist_sum += u16::from(twists[position]);
        }
        assert_eq!(twist_sum % 3, 0);
    }
}

#[test]
fn mixed_coordinates_round_trip_and_do_not_couple_the_transition_factors() {
    // Both factors are nonzero. Cover every nonzero value of each factor in
    // multiple pairings without constructing a 918540-entry distance table.
    for permutation in 1..PERM_COSET_COUNT {
        let orientation = 1 + (permutation * 97) % (ORIENTATION_COUNT - 1);
        check_representative_and_successors(permutation * ORIENTATION_COUNT + orientation);
    }
    for orientation in 1..ORIENTATION_COUNT {
        let permutation = 1 + (orientation * 73) % (PERM_COSET_COUNT - 1);
        check_representative_and_successors(permutation * ORIENTATION_COUNT + orientation);
    }
}

#[test]
fn left_half_turns_preserve_the_coordinate_for_varied_corner_states() {
    let mut indices: Vec<usize> = (0..ORIENTATION_COUNT).collect();
    indices.extend((0..PERM_COSET_COUNT).map(|permutation| permutation * ORIENTATION_COUNT));
    indices.extend((1..PERM_COSET_COUNT).map(|permutation| {
        let orientation = 1 + (permutation * 149) % (ORIENTATION_COUNT - 1);
        permutation * ORIENTATION_COUNT + orientation
    }));
    for index in indices {
        let cube = unrank(index).unwrap();
        for half_turn in HALF_TURNS {
            let left_translate = MOVES[usize::from(half_turn)].multiplied(&cube);
            assert_eq!(
                rank(&left_translate).unwrap(),
                index,
                "left H invariance at coordinate {index}, move {half_turn}",
            );
        }
    }
}

#[test]
fn inversion_does_not_descend_to_the_h_orbit_coordinate() {
    let mut found_witness = false;
    // Equal coordinates are obtained by an actual left H action. Search only
    // these 18 * 6 concrete pairs for unequal inverse coordinates.
    for cube in &MOVES {
        for half_turn in HALF_TURNS {
            let same_coset = MOVES[usize::from(half_turn)].multiplied(cube);
            assert_eq!(rank(cube).unwrap(), rank(&same_coset).unwrap());
            if rank(&cube.inverse()).unwrap() != rank(&same_coset.inverse()).unwrap() {
                found_witness = true;
            }
        }
    }
    assert!(found_witness, "H-orbit coordinates do not determine inverse coordinates");
}

fn permutations_of_four() -> Vec<[u8; 4]> {
    let mut permutations = Vec::new();
    for a in 0..4_u8 {
        for b in 0..4_u8 {
            for c in 0..4_u8 {
                for d in 0..4_u8 {
                    if a != b && a != c && a != d && b != c && b != d && c != d {
                        permutations.push([a, b, c, d]);
                    }
                }
            }
        }
    }
    permutations
}

#[test]
fn h_membership_matches_the_group_generated_by_repository_half_turns() {
    // This is a finite subgroup closure, not a distance/pruning table. It is
    // independent of phi, relative matching actions, and the membership code.
    let mut seen = HashSet::new();
    let mut elements = vec![Cube::SOLVED];
    seen.insert(Cube::SOLVED.corners);
    let mut next = 0;
    while next < elements.len() {
        let element = elements[next];
        for half_turn in HALF_TURNS {
            let product = element.multiplied(&MOVES[usize::from(half_turn)]);
            if seen.insert(product.corners) {
                elements.push(product);
            }
        }
        next += 1;
        assert!(elements.len() <= 96, "the corner half-turn group exceeds order 96");
    }
    assert_eq!(seen.len(), 96);
    for element in &elements {
        assert!(in_h(element));
        assert_eq!(lower_bound5(element), 0);
        assert_eq!(rank(element).unwrap(), SOLVED_INDEX);
    }

    let permutations = permutations_of_four();
    assert_eq!(permutations.len(), 24);
    let mut accepted = 0;
    for alpha in &permutations {
        for beta in &permutations {
            let mut cube = Cube::SOLVED;
            for i in 0..4 {
                cube.corners[i] = alpha[i];
                cube.corners[i + 4] = beta[i] + 4;
            }
            // Only the valid corner projection matters; edge parity is not
            // used by in_h or by this independently generated corner subgroup.
            assert!(rank(&cube).is_ok());
            assert!(in_k(&cube));
            assert_eq!(in_h(&cube), seen.contains(&cube.corners));
            if in_h(&cube) { accepted += 1; }
        }
    }
    assert_eq!(accepted, 96);
}

#[test]
fn tetrad_three_cycle_has_the_proven_five_move_floor_and_its_h_translates_keep_it() {
    let cube = three_cycle_in_one_tetrad();
    cube.validate().unwrap();
    assert!(in_k(&cube));
    assert!(!in_h(&cube));
    assert_eq!(lower_bound4(&cube), 4);
    assert_eq!(lower_bound5(&cube), 5);
    assert_ne!(rank(&cube).unwrap(), SOLVED_INDEX);
    assert_eq!(lower_bound4(&cube.inverse()), 4);
    assert_eq!(lower_bound5(&cube.inverse()), 5);

    for half_turn in HALF_TURNS {
        let half = &MOVES[usize::from(half_turn)];
        let left = half.multiplied(&cube);
        let right = cube.multiplied(half);
        assert_eq!(lower_bound4(&left), 4);
        assert_eq!(lower_bound4(&right), 4);
        assert_eq!(lower_bound5(&left), 5);
        assert_eq!(lower_bound5(&right), 5);
        assert_eq!(rank(&left).unwrap(), rank(&cube).unwrap());
    }
}

#[test]
fn no_word_of_at_most_four_htm_moves_receives_the_five_move_floor() {
    // Exhaust all words, including repetitions and cancellations; do not
    // assume any move-normal-form pruning when checking the analytic lemma.
    assert_eq!(lower_bound4(&Cube::SOLVED), 0);
    assert_eq!(lower_bound5(&Cube::SOLVED), 0);
    for (a, first) in MOVES.iter().enumerate() {
        assert_eq!(lower_bound4(first), 0, "one-move word [{a}]");
        assert_eq!(lower_bound5(first), 0, "one-move word [{a}]");
        for (b, second) in MOVES.iter().enumerate() {
            let pair = first.multiplied(second);
            assert_eq!(lower_bound4(&pair), 0, "two-move word [{a}, {b}]");
            assert_eq!(lower_bound5(&pair), 0, "two-move word [{a}, {b}]");
            for (c, third) in MOVES.iter().enumerate() {
                let triple = pair.multiplied(third);
                assert_eq!(lower_bound4(&triple), 0, "three-move word [{a}, {b}, {c}]");
                assert_eq!(lower_bound5(&triple), 0, "three-move word [{a}, {b}, {c}]");
                for (d, fourth) in MOVES.iter().enumerate() {
                    let quadruple = triple.multiplied(fourth);
                    assert_eq!(lower_bound5(&quadruple), 0,
                        "four-move word [{a}, {b}, {c}, {d}]");
                }
            }
        }
    }
}

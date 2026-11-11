//! Bounded coordinate validation for the production compact F2LEO table.
pub use cube_solver::f2leo_compact_table::{Coordinate, Goal, PACKED_BYTES, PLACEMENTS, STATES};

#[cfg(test)]
mod tests {
    use super::*;
    use cube_solver::cube_common::{array_to_index, index_to_array, Move, State};
    use cube_solver::mt_gen::create_mt_edge;

    fn legacy_goal(c: &Coordinate, pseudo: bool) -> bool {
        let first = c.cross()[..2].iter().map(|&v| v as i32).collect::<Vec<_>>();
        let second = c.cross()[2..].iter().map(|&v| v as i32).collect::<Vec<_>>();
        let a = array_to_index(&first, 2, 2, 12);
        let b = array_to_index(&second, 2, 2, 12);
        let solved = if pseudo {
            [(416, 520), (468, 428), (520, 416), (428, 468)].contains(&(a, b))
        } else {
            (a, b) == (416, 520)
        };
        solved && c.free().iter().all(|&e| e % 2 == 0)
    }

    // Same product projection as dist_tracked: the existing Cross index and
    // EdgeSet(4) index (physical subset mask ascending, flips in sorted positions).
    fn product_roundtrip(c: &Coordinate) -> Coordinate {
        let raw = c.cross().map(|e| e as i32);
        let cross_index = array_to_index(&raw, 4, 2, 12);
        let mut cross_out = [0i32; 4];
        index_to_array(&mut cross_out, cross_index, 4, 2, 12);
        let mask = c.free().iter().fold(0u16, |a, &e| a | (1 << (e / 2)));
        let masks = (0u16..4096)
            .filter(|m| m.count_ones() == 4)
            .collect::<Vec<_>>();
        let subset_rank = masks.binary_search(&mask).unwrap();
        let flips = c
            .free()
            .iter()
            .enumerate()
            .fold(0u8, |a, (i, &e)| a | ((e & 1) << i));
        let product_index = subset_rank * 16 + flips as usize;
        let mut free_out = [0u8; 4];
        let mut n = 0;
        for p in 0..12 {
            if masks[product_index / 16] & (1 << p) != 0 {
                free_out[n] = 2 * p + (((product_index % 16) >> n) & 1) as u8;
                n += 1;
            }
        }
        Coordinate::new(cross_out.map(|v| (v / 18) as u8), free_out).unwrap()
    }

    /// Complete any abstract coordinate to a legal full cube. Untracked edges
    /// absorb EO parity, and the untracked corners absorb permutation parity.
    fn complete(c: &Coordinate, free_labels: [u8; 4]) -> State {
        let mut full = State::SOLVED;
        full.edges = [u8::MAX; 12];
        for (i, &e) in c.cross().iter().enumerate() {
            full.edges[(e / 2) as usize] = 2 * (8 + i) as u8 + (e & 1);
        }
        for (i, &e) in c.free().iter().enumerate() {
            full.edges[(e / 2) as usize] = 2 * free_labels[i] + (e & 1);
        }
        let mut piece = 4u8;
        let mut parity_pos = 0;
        for (pos, e) in full.edges.iter_mut().enumerate() {
            if *e == u8::MAX {
                *e = 2 * piece;
                parity_pos = pos;
                piece += 1;
            }
        }
        full.edges[parity_pos] ^= full.edges.iter().fold(0u8, |a, e| a ^ (e & 1));
        let mut parity = false;
        for i in 0..12 {
            for j in i + 1..12 {
                parity ^= full.edges[i] / 2 > full.edges[j] / 2;
            }
        }
        if parity {
            full.corners.swap(0, 1);
        }
        full
    }

    #[test]
    fn exhaustive_placements_and_goal_sets() {
        assert_eq!(STATES, 212_889_600);
        assert_eq!(PACKED_BYTES, 106_444_800);
        let mut strict = 0;
        let mut pseudo = 0;
        // All 831,600 placements; orientations factor independently into 256 bits.
        for placement in 0..PLACEMENTS {
            let c = Coordinate::unrank(placement * 256).unwrap();
            assert_eq!(c.rank(), placement * 256);
            assert_eq!(Coordinate::new(c.cross(), c.free()).unwrap(), c);
            assert_eq!(c.is_goal(Goal::Cross), legacy_goal(&c, false));
            assert_eq!(c.is_goal(Goal::PseudoCross), legacy_goal(&c, true));
            assert_eq!(
                c.is_goal(Goal::PseudoCross),
                (0..4).any(|r| c.relabel_cross(r).is_goal(Goal::Cross))
            );
            strict += u32::from(c.is_goal(Goal::Cross));
            pseudo += u32::from(c.is_goal(Goal::PseudoCross));
        }
        assert_eq!(strict, 70); // 1,680 labeled goals / 4!.
        assert_eq!(pseudo, 280);
        // Orientation encoding has no parity restriction: four untracked edges
        // can supply either parity. Every nonzero flip word is outside both goals.
        let solved = Coordinate::from_edges(&State::SOLVED.edges).unwrap().rank() & !255;
        for base in [0, solved, (PLACEMENTS - 1) * 256] {
            for flips in 0..256 {
                let c = Coordinate::unrank(base + flips).unwrap();
                assert_eq!(c.rank(), base + flips);
                let full = complete(&c, [0, 1, 2, 3]);
                assert_eq!(Coordinate::from_edges(&full.edges).unwrap(), c);
                if flips != 0 {
                    assert!(!c.is_goal(Goal::Cross));
                    assert!(!c.is_goal(Goal::PseudoCross));
                }
            }
        }
        assert!(Coordinate::unrank(STATES).is_err());
        assert!(Coordinate::new([16, 18, 20, 22], [0, 2, 4, 16]).is_err());
    }

    #[test]
    fn moves_match_full_cube_and_product_projection() {
        let moves = create_mt_edge(); // 1,728 bytes; no ensure_* or disk reads.
        let mut seed = 0x6a09_e667f3bc_c909u64;
        for _ in 0..2048 {
            seed = seed.wrapping_mul(6_364_136_223_846_793_005).wrapping_add(1);
            let c = Coordinate::unrank((seed % STATES as u64) as u32).unwrap();
            assert_eq!(product_roundtrip(&c), c);
            let full = complete(&c, [0, 1, 2, 3]);
            assert_eq!(Coordinate::from_edges(&full.edges).unwrap(), c);
            for mv in 0..18 {
                let next = c.moved(mv, &moves);
                let expected =
                    Coordinate::from_edges(&full.applied(Move::from_index(mv)).edges).unwrap();
                assert_eq!(next, expected);
                assert_eq!(Coordinate::unrank(next.rank()).unwrap(), expected);
                assert_eq!(product_roundtrip(&next), next);
                for offset in 0..4 {
                    assert_eq!(
                        c.relabel_cross(offset).moved(mv, &moves),
                        next.relabel_cross(offset)
                    );
                }
            }
        }
    }

    #[test]
    fn free_edge_labels_are_a_move_preserving_quotient() {
        let moves = create_mt_edge();
        let samples = [0, 255, STATES / 3, STATES / 2, STATES - 1];
        for index in samples {
            let c = Coordinate::unrank(index).unwrap();
            for a in 0..4 {
                for b in 0..4 {
                    if b == a {
                        continue;
                    }
                    for d in 0..4 {
                        if d == a || d == b {
                            continue;
                        }
                        let last = 6 - a - b - d;
                        let full = complete(&c, [a, b, d, last]);
                        for mv in 0..18 {
                            let expected =
                                Coordinate::from_edges(&full.applied(Move::from_index(mv)).edges)
                                    .unwrap();
                            assert_eq!(c.moved(mv, &moves), expected);
                        }
                    }
                }
            }
        }
    }
}

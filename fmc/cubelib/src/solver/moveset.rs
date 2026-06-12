use crate::cube::*;

pub struct MoveSet {
    pub st_moves: &'static [Turn333],
    pub aux_moves: &'static [Turn333],
    pub transitions: &'static [TransitionTable333],
}

pub trait TransitionTable: 'static {
    fn check_move(&self, m: Turn333) -> Transition;
}

#[derive(Debug)]
pub struct Transition {
    pub allowed: bool,
    pub can_end: bool,
}

impl Transition {
    pub fn any() -> Self {
        Transition {
            allowed: true,
            can_end: true,
        }
    }
}

pub type TransitionTable333 = cube_outer_turn::TransitionTableCubeOuterTurn;

mod cube_outer_turn {
    use crate::solver::moveset::{Transition, TransitionTable};
    use crate::cube::*;

    #[derive(Copy, Clone)]
    pub struct TransitionTableCubeOuterTurn {
        pub allowed: u32,
        pub can_end: u32,
    }

    impl TransitionTable for TransitionTableCubeOuterTurn {
        fn check_move(&self, m: Turn333) -> Transition {
            let mid = Into::<usize>::into(m) as u32;
            let allowed = self.allowed & (1 << mid) != 0;
            let can_end = self.can_end & (1 << mid) != 0;
            Transition { allowed, can_end }
        }
    }

    impl TransitionTableCubeOuterTurn {
        pub const ANY: u32 = 0x3FFFF;
        pub const NONE: u32 = 0;
        pub const DEFAULT_ALL: [TransitionTableCubeOuterTurn; 18] = Self::all_ordered();

        //This enforces an order between [UFL] and [DBR] moves to avoid duplicates. U D is allowed, D U is not.
        pub const DEFAULT_ALLOWED_AFTER: [u32; 6] = [
            Self::except_faces_to_mask([CubeFace::Up]), //U
            Self::except_faces_to_mask([CubeFace::Up, CubeFace::Down]), //D
            Self::except_faces_to_mask([CubeFace::Front]), //F
            Self::except_faces_to_mask([CubeFace::Front, CubeFace::Back]), //B
            Self::except_faces_to_mask([CubeFace::Left]), //L
            Self::except_faces_to_mask([CubeFace::Left, CubeFace::Right]), //R
        ];

        pub const DEFAULT_ALLOWED_AFTER_UNORDERED: [u32; 6] = [
            Self::except_faces_to_mask([CubeFace::Up]), //U
            Self::except_faces_to_mask([CubeFace::Down]), //D
            Self::except_faces_to_mask([CubeFace::Front]), //F
            Self::except_faces_to_mask([CubeFace::Back]), //B
            Self::except_faces_to_mask([CubeFace::Left]), //L
            Self::except_faces_to_mask([CubeFace::Right]), //R
        ];

        pub const fn moves_to_mask<const L: usize>(moves: [Turn333; L]) -> u32 {
            let mut mask = 0u32;
            let mut i = 0;
            while i < L {
                mask |= 1 << moves[i].to_id();
                i += 1;
            }
            mask & 0x3FFFF
        }

        pub const fn except_moves_to_mask<const L: usize>(moves: [Turn333; L]) -> u32 {
            !Self::moves_to_mask(moves) & 0x3FFFF
        }

        pub const fn faces_to_mask<const L: usize>(faces: [CubeFace; L]) -> u32 {
            let mut mask = 0u32;
            let mut i = 0;
            while i < L {
                let f = faces[i];
                mask |= 1 << Turn333::new(f, Direction::Clockwise).to_id();
                mask |= 1 << Turn333::new(f, Direction::CounterClockwise).to_id();
                mask |= 1 << Turn333::new(f, Direction::Half).to_id();
                i += 1;
            }
            mask & 0x3FFFF
        }

        pub const fn except_faces_to_mask<const L: usize>(faces: [CubeFace; L]) -> u32 {
            !Self::faces_to_mask(faces) & 0x3FFFF
        }

        pub const fn new(allowed: u32, can_end: u32) -> Self {
            Self { allowed, can_end }
        }

        pub const fn all_ordered() -> [TransitionTableCubeOuterTurn; 18] {
            let mut transitions = [TransitionTableCubeOuterTurn::new(0, 0); 18];
            let mut i = 0;
            while i < CubeFace::ALL.len() {
                let face_table = Self::new(Self::DEFAULT_ALLOWED_AFTER[CubeFace::ALL[i] as usize], Self::ANY);
                transitions[Turn333::new(CubeFace::ALL[i], Direction::Clockwise).to_id()] = face_table;
                transitions[Turn333::new(CubeFace::ALL[i], Direction::CounterClockwise).to_id()] = face_table;
                transitions[Turn333::new(CubeFace::ALL[i], Direction::Half).to_id()] = face_table;
                i += 1;
            }
            transitions
        }

        pub const fn all_unordered() -> [TransitionTableCubeOuterTurn; 18] {
            let mut transitions = [TransitionTableCubeOuterTurn::new(0, 0); 18];
            let mut i = 0;
            while i < CubeFace::ALL.len() {
                let face_table = Self::new(Self::DEFAULT_ALLOWED_AFTER_UNORDERED[CubeFace::ALL[i] as usize], Self::ANY);
                transitions[Turn333::new(CubeFace::ALL[i], Direction::Clockwise).to_id()] = face_table;
                transitions[Turn333::new(CubeFace::ALL[i], Direction::CounterClockwise).to_id()] = face_table;
                transitions[Turn333::new(CubeFace::ALL[i], Direction::Half).to_id()] = face_table;
                i += 1;
            }
            transitions
        }
    }
}

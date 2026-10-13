// SPDX-License-Identifier: GPL-3.0-or-later
//! Historical H10 coordinate API over the shared H48 state representation.

pub use crate::h48_coord::{
    CornerData, COCSEP_ENTRIES, CORNER_CLASSES, EOESEP_ENTRIES, ESEP_CLASSES, ESEP_ENTRIES,
};
use crate::{cube::Cube, h48_coord::H48State, h48_variant::H48Variant};
use std::ops::Deref;
pub const H10_ENTRIES: u64 = H48Variant::H10.main_entries();

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct H10State(H48State);

impl H10State {
    #[inline]
    pub fn from_cube(cube: &Cube) -> Self {
        Self(H48State::from_cube(cube))
    }
    pub fn to_bytes(&self) -> [u8; 20] {
        self.0.to_bytes()
    }
    #[inline]
    pub fn raw_cocsep(&self) -> u32 {
        self.0.raw_cocsep()
    }
    #[inline]
    pub fn raw_esep(&self) -> u32 {
        self.0.raw_esep()
    }
    #[inline]
    pub fn raw_esep_scalar(&self) -> u32 {
        self.0.raw_esep_scalar()
    }
    #[inline]
    pub fn raw_eo(&self) -> u32 {
        self.0.raw_eo()
    }
    #[inline]
    pub fn raw_eo_scalar(&self) -> u32 {
        self.0.raw_eo_scalar()
    }
    #[inline]
    pub fn transformed_edges(&self, symmetry: u8) -> [u8; 12] {
        self.0.transformed_edges(symmetry)
    }
    #[inline]
    pub fn transformed_edges_scalar(&self, symmetry: u8) -> [u8; 12] {
        self.0.transformed_edges_scalar(symmetry)
    }
    #[inline]
    pub fn main_index(&self, cdata: u32) -> u64 {
        self.0.main_index(cdata, H48Variant::H10)
    }
    #[inline]
    pub fn main_index_from_corner(&self, corner: CornerData) -> u64 {
        self.0.main_index_from_corner(corner, H48Variant::H10)
    }
    #[inline]
    pub fn main_index_scalar(&self, cdata: u32) -> u64 {
        self.0.main_index_scalar(cdata, H48Variant::H10)
    }
    #[inline]
    pub fn eoesep_index(&self, edata: u32) -> u32 {
        self.0.eoesep_index(edata)
    }
    #[inline]
    pub fn eoesep_index_scalar(&self, edata: u32) -> u32 {
        self.0.eoesep_index_scalar(edata)
    }
}

impl Deref for H10State {
    type Target = H48State;
    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

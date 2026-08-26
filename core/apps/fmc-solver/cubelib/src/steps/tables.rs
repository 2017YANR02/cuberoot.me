use std::sync::Arc;
#[cfg(not(target_arch = "wasm32"))]
use std::time::Instant;

use log::{debug, info};
#[cfg(feature = "fs")]
use log::error;

#[cfg(feature = "333dr")]
use crate::steps::dr::coords::DRUDEOFBCoord;
#[cfg(feature = "333dr")]
use crate::steps::dr::dr_config::{DR_UD_EO_FB_MOVESET, DRPruningTable};
#[cfg(feature = "333eo")]
use crate::steps::eo::coords::EOCoordFB;
#[cfg(feature = "333eo")]
use crate::steps::eo::eo_config::{EO_FB_MOVESET, EOPruningTable};
#[cfg(feature = "333finish")]
use crate::steps::finish::coords::{FRUDFinishCoord, HTRFinishCoord, HTRLeaveSliceFinishCoord};
#[cfg(feature = "333finish")]
use crate::steps::finish::finish_config::{FRFinishPruningTable, FRUD_FINISH_MOVESET, HTR_FINISH_MOVESET, HTRFinishPruningTable, HTRLeaveSliceFinishPruningTable};
#[cfg(feature = "333fr")]
use crate::steps::fr::coords::{FRUDNoSliceCoord, FRUDWithSliceCoord};
#[cfg(feature = "333fr")]
use crate::steps::fr::fr_config::{FR_UD_MOVESET, FRLeaveSlicePruningTable, FRPruningTable};
#[cfg(feature = "333htr")]
use crate::steps::htr::coords::HTRDRUDCoord;
#[cfg(feature = "333htr")]
use crate::steps::htr::htr_config::{HTR_DR_UD_MOVESET, HTRPruningTable, HTRSubsetTable};
use crate::solver::lookup_table;
#[cfg(feature = "fs")]
use crate::solver::lookup_table::{LoadFromDisk, SaveToDisk};
use crate::solver::lookup_table::{DepthEstimate, InMemoryIndexTable, InMemoryNissIndexTable, TableError};
#[cfg(feature = "fs")]
use crate::steps::coord::Coord;

pub struct PruningTables333 {
    #[cfg(feature = "333eo")]
    eo: Option<EOPruningTable>,
    #[cfg(feature = "333dr")]
    dr: Option<DRPruningTable>,
    #[cfg(feature = "333htr")]
    htr: Option<HTRPruningTable>,
    #[cfg(feature = "333htr")]
    htr_subset: Option<HTRSubsetTable>,
    #[cfg(feature = "333fr")]
    frls: Option<FRLeaveSlicePruningTable>,
    #[cfg(feature = "333fr")]
    fr: Option<FRPruningTable>,
    #[cfg(feature = "333finish")]
    fr_finish: Option<FRFinishPruningTable>,
    #[cfg(feature = "333finish")]
    htr_finish: Option<HTRFinishPruningTable>,
    #[cfg(feature = "333finish")]
    htr_ls_finish: Option<HTRLeaveSliceFinishPruningTable>
}

pub struct ArcPruningTable333 {
    #[cfg(feature = "333eo")]
    pub eo: Option<Arc<EOPruningTable>>,
    #[cfg(feature = "333dr")]
    pub dr: Option<Arc<DRPruningTable>>,
    #[cfg(feature = "333htr")]
    pub htr: Option<Arc<HTRPruningTable>>,
    #[cfg(feature = "333htr")]
    pub htr_subset: Option<Arc<HTRSubsetTable>>,
    #[cfg(feature = "333fr")]
    pub frls: Option<Arc<FRLeaveSlicePruningTable>>,
    #[cfg(feature = "333fr")]
    pub fr: Option<Arc<FRPruningTable>>,
    #[cfg(feature = "333finish")]
    pub fr_finish: Option<Arc<FRFinishPruningTable>>,
    #[cfg(feature = "333finish")]
    pub htr_finish: Option<Arc<HTRFinishPruningTable>>,
    #[cfg(feature = "333finish")]
    pub htr_ls_finish: Option<Arc<HTRLeaveSliceFinishPruningTable>>
}

impl From<PruningTables333> for ArcPruningTable333 {
    fn from(value: PruningTables333) -> Self {
        Self {
            eo: value.eo.map(Arc::new),
            dr: value.dr.map(Arc::new),
            htr: value.htr.map(Arc::new),
            htr_subset: value.htr_subset.map(Arc::new),
            frls: value.frls.map(Arc::new),
            fr: value.fr.map(Arc::new),
            fr_finish: value.fr_finish.map(Arc::new),
            htr_finish: value.htr_finish.map(Arc::new),
            htr_ls_finish: value.htr_ls_finish.map(Arc::new),
        }
    }
}

impl PruningTables333 {

    pub const VERSION: u32 = 2;

    pub fn new() -> PruningTables333 {
        PruningTables333 {
            #[cfg(feature = "333eo")]
            eo: None,
            #[cfg(feature = "333dr")]
            dr: None,
            #[cfg(feature = "333htr")]
            htr: None,
            #[cfg(feature = "333htr")]
            htr_subset: None,
            #[cfg(feature = "333fr")]
            frls: None,
            #[cfg(feature = "333fr")]
            fr: None,
            #[cfg(feature = "333finish")]
            fr_finish: None,
            #[cfg(feature = "333finish")]
            htr_finish: None,
            #[cfg(feature = "333finish")]
            htr_ls_finish: None
        }
    }

    #[cfg(feature = "fs")]
    pub fn save(&self, key: &str) -> Result<(), TableError> {
        match key {
            #[cfg(feature = "333eo")]
            "eo" => if let Some(tbl) = &self.eo {
                tbl.save_to_disk("333", key)?
            },
            #[cfg(feature = "333dr")]
            "dr" => if let Some(tbl) = &self.dr {
                tbl.save_to_disk("333", key)?
            },
            #[cfg(feature = "333htr")]
            "htr" => if let Some(tbl) = &self.htr {
                tbl.save_to_disk("333", key)?;
            },
            #[cfg(feature = "333htr")]
            "htr-subset" => if let Some(tbl) = &self.htr_subset {
                tbl.save_to_disk("333", format!("{key}").as_str())?;
            },
            #[cfg(feature = "333fr")]
            "fr" => if let Some(tbl) = &self.fr {
                tbl.save_to_disk("333", key)?
            },
            #[cfg(feature = "333fr")]
            "frls" => if let Some(tbl) = &self.frls {
                tbl.save_to_disk("333", key)?
            },
            #[cfg(feature = "333finish")]
            "frfin" => if let Some(tbl) = &self.fr_finish {
                tbl.save_to_disk("333", key)?
            },
            #[cfg(feature = "333finish")]
            "htrfin" => if let Some(tbl) = &self.htr_finish {
                tbl.save_to_disk("333", key)?
            },
            #[cfg(feature = "333finish")]
            "htrlsfin" => if let Some(tbl) = &self.htr_ls_finish {
                tbl.save_to_disk("333", key)?
            },
            _ => {}
        }
        Ok(())
    }

    #[cfg(feature = "fs")]
    pub fn load(&mut self, key: &str) -> Result<(), TableError> {
        match key {
            #[cfg(feature = "333eo")]
            "eo" => self.eo = Some(EOPruningTable::load_from_disk("333", key)?),
            #[cfg(feature = "333dr")]
            "dr" => self.dr = Some(DRPruningTable::load_from_disk("333", key)?),
            #[cfg(feature = "333htr")]
            "htr" => {
                self.htr = Some(HTRPruningTable::load_from_disk("333", key)?);
                self.htr_subset = Some(HTRSubsetTable::load_from_disk("333", format!("{key}-subset").as_str())?)
            },
            #[cfg(feature = "333fr")]
            "fr" => self.fr = Some(FRPruningTable::load_from_disk("333", key)?),
            #[cfg(feature = "333fr")]
            "frls" => self.frls = Some(FRLeaveSlicePruningTable::load_from_disk("333", key)?),
            #[cfg(feature = "333finish")]
            "frfin" => self.fr_finish = Some(FRFinishPruningTable::load_from_disk("333", key)?),
            #[cfg(feature = "333finish")]
            "htrfin" => self.htr_finish = Some(HTRFinishPruningTable::load_from_disk("333", key)?),
            _ => {}
        }
        Ok(())
    }

    #[cfg(feature = "fs")]
    pub fn load_and_gen_normal<const C_SIZE: usize, C: Coord<C_SIZE>>(key: &str, val: &mut Option<InMemoryIndexTable<C_SIZE, C>>, gen_f: &dyn Fn() -> InMemoryIndexTable<C_SIZE, C>, load_f: &dyn Fn() -> Result<InMemoryIndexTable<C_SIZE, C>, TableError>) -> bool {
        if val.is_none() {
            let res = load_f();
            match res {
                Ok(v) => {
                    *val = Some(v);
                    debug!("Loaded {key} table from disk");
                },
                Err(_) => {
                    info!("{key} table not found on disk");
                }
            }
        }
        if val.is_none() {
            let table = gen_f();
            *val = Some(table);
            return true;
        }
        false
    }

    #[cfg(feature = "fs")]
    pub fn load_and_gen_niss<const C_SIZE: usize, C: Coord<C_SIZE>>(key: &str, val: &mut Option<InMemoryNissIndexTable<C_SIZE, C>>, gen_f: &dyn Fn() -> InMemoryNissIndexTable<C_SIZE, C>, load_f: &dyn Fn() -> Result<InMemoryNissIndexTable<C_SIZE, C>, TableError>) -> bool {
        if val.is_none() {
            let res = load_f();
            match res {
                Ok(v) => {
                    *val = Some(v);
                    debug!("Loaded {key} table from disk");
                },
                Err(_) => {
                    info!("Error loading {key} table from disk");
                }
            }
        }
        if val.is_none() {
            let table = gen_f();
            *val = Some(table);
            return true;
        }
        false
    }

    #[cfg(feature = "fs")]
    pub fn load_and_save_normal<const C_SIZE: usize, C: Coord<C_SIZE>>(&mut self, key: &str, mut_f: &dyn Fn(&mut Self) -> &mut Option<InMemoryIndexTable<C_SIZE, C>>, gen_f: &dyn Fn() -> InMemoryIndexTable<C_SIZE, C>, load_f: &dyn Fn() -> Result<InMemoryIndexTable<C_SIZE, C>, TableError>) -> bool {
        let should_save = Self::load_and_gen_normal(key, mut_f(self), gen_f, load_f);
        if should_save {
            if let Err(e) = self.save(key) {
                error!("Error saving {key} table to disk: {e}");
            } else {
                info!("Saved {key} table to disk");
            }
        }
        should_save
    }

    #[cfg(feature = "fs")]
    pub fn load_and_save_niss<const C_SIZE: usize, C: Coord<C_SIZE>>(&mut self, key: &str, mut_f: &dyn Fn(&mut Self) -> &mut Option<InMemoryNissIndexTable<C_SIZE, C>>, gen_f: &dyn Fn() -> InMemoryNissIndexTable<C_SIZE, C>, load_f: &dyn Fn() -> Result<InMemoryNissIndexTable<C_SIZE, C>, TableError>) -> bool {
        let should_save = Self::load_and_gen_niss(key, mut_f(self), gen_f, load_f);
        if should_save {
            if let Err(e) = self.save(key) {
                error!("Error saving {key} table to disk: {e}");
            } else {
                info!("Saved {key} table to disk");
            }
        }
        should_save
    }

    #[cfg(all(feature = "333eo", feature = "fs"))]
    pub fn gen_eo(&mut self) {
        self.load_and_save_normal("eo", &|x|&mut x.eo, &gen_eo, &|| EOPruningTable::load_from_disk("333", "eo"));
    }

    #[cfg(all(feature = "333eo", not(feature = "fs")))]
    pub fn gen_eo(&mut self) {
        self.eo = Some(gen_eo());
    }

    #[cfg(feature = "333eo")]
    pub fn eo(&self) -> Option<&EOPruningTable> {
        self.eo.as_ref()
    }

    #[cfg(all(feature = "333dr", feature = "fs"))]
    pub fn gen_dr(&mut self) {
        self.load_and_save_normal("dr", &|x|&mut x.dr, &gen_dr, &|| DRPruningTable::load_from_disk("333", "dr"));
    }

    #[cfg(all(feature = "333dr", not(feature = "fs")))]
    pub fn gen_dr(&mut self) {
        self.dr = Some(gen_dr());
    }

    #[cfg(feature = "333dr")]
    pub fn dr(&self) -> Option<&DRPruningTable> {
        self.dr.as_ref()
    }

    #[cfg(all(feature = "333htr", feature = "fs"))]
    pub fn gen_htr(&mut self) {
        let new_table = self.load_and_save_niss("htr", &|x|&mut x.htr, &gen_htr, &|| HTRPruningTable::load_from_disk("333", "htr"));
        if let Some(htr_table) = &mut self.htr {
            if self.htr_subset.is_some() {
                return;
            }
            match HTRSubsetTable::load_from_disk("333", "htr-subset") {
                Ok(v) => {
                    self.htr_subset = Some(v);
                    debug!("Loaded htr-subset table from disk");
                },
                Err(_) => {
                    info!("htr-subset table not found on disk");
                }
            }
            if new_table || self.htr_subset.is_none() {
                let table = gen_htr_subsets(htr_table);
                self.htr_subset = Some(table);
                if let Err(e) = self.save("htr-subset") {
                    error!("Error saving htr-subset table to disk: {e}");
                } else {
                    info!("Saved htr-subset table to disk");
                }
                if let Err(e) = self.save("htr") {
                    error!("Error saving htr table to disk: {e}");
                } else {
                    info!("Saved htr table to disk");
                }
            }
        }
    }

    #[cfg(all(feature = "333htr", not(feature = "fs")))]
    pub fn gen_htr(&mut self) {
        self.htr = Some(gen_htr());
    }

    #[cfg(feature = "333htr")]
    pub fn htr(&self) -> Option<&HTRPruningTable> {
        self.htr.as_ref()
    }

    #[cfg(feature = "333htr")]
    pub fn htr_subset(&self) -> Option<&HTRSubsetTable> {
        self.htr_subset.as_ref()
    }

    #[cfg(feature = "333htr")]
    pub fn htr_mut(&mut self) -> Option<&mut HTRPruningTable> {
        self.htr.as_mut()
    }

    #[cfg(all(feature = "333fr", feature = "fs"))]
    pub fn gen_fr_leave_slice(&mut self) {
        self.load_and_save_normal("frls", &|x|&mut x.frls, &gen_fr_leave_slice, &|| FRLeaveSlicePruningTable::load_from_disk("333", "frls"));
    }

    #[cfg(all(feature = "333fr", not(feature = "fs")))]
    pub fn gen_fr_leave_slice(&mut self) {
        self.frls = Some(gen_fr_leave_slice());
    }

    #[cfg(feature = "333fr")]
    pub fn fr_leave_slice(&self) -> Option<&FRLeaveSlicePruningTable> {
        self.frls.as_ref()
    }

    #[cfg(all(feature = "333fr", feature = "fs"))]
    pub fn gen_fr(&mut self) {
        self.load_and_save_normal("fr", &|x|&mut x.fr, &gen_fr, &|| FRPruningTable::load_from_disk("333", "fr"));
    }

    #[cfg(all(feature = "333fr", not(feature = "fs")))]
    pub fn gen_fr(&mut self) {
        self.fr = Some(gen_fr());
    }

    #[cfg(feature = "333fr")]
    pub fn fr(&self) -> Option<&FRPruningTable> {
        self.fr.as_ref()
    }

    #[cfg(all(feature = "333finish", feature = "fs"))]
    pub fn gen_fr_finish(&mut self) {
        self.load_and_save_normal("frfin", &|x|&mut x.fr_finish, &gen_fr_finish, &|| FRFinishPruningTable::load_from_disk("333", "frfin"));
    }

    #[cfg(all(feature = "333finish", not(feature = "fs")))]
    pub fn gen_fr_finish(&mut self) {
        self.fr_finish = Some(gen_fr_finish());
    }

    #[cfg(feature = "333finish")]
    pub fn fr_finish(&self) -> Option<&FRFinishPruningTable> {
        self.fr_finish.as_ref()
    }

    #[cfg(all(feature = "333finish", feature = "fs"))]
    pub fn gen_htr_finish(&mut self) {
        self.load_and_save_normal("htrfin", &|x|&mut x.htr_finish, &gen_htr_finish, &|| HTRFinishPruningTable::load_from_disk("333", "htrfin"));
    }

    #[cfg(all(feature = "333finish", not(feature = "fs")))]
    pub fn gen_htr_finish(&mut self) {
        self.htr_ls_finish = Some(crate::steps::tables::gen_htr_no_slice_finish());
    }

    #[cfg(feature = "333finish")]
    pub fn htr_finish(&self) -> Option<&HTRFinishPruningTable> {
        self.htr_finish.as_ref()
    }

    #[cfg(all(feature = "333finish", feature = "fs"))]
    pub fn gen_htr_leave_slice_finish(&mut self) {
        self.load_and_save_normal("htrlsfin", &|x|&mut x.htr_ls_finish, &gen_htr_no_slice_finish, &|| HTRLeaveSliceFinishPruningTable::load_from_disk("333", "htrlsfin"));
    }

    #[cfg(all(feature = "333finish", not(feature = "fs")))]
    pub fn gen_htr_leave_slice_finish(&mut self) {
        self.htr_finish = Some(crate::steps::tables::gen_htr_finish());
    }

    #[cfg(feature = "333finish")]
    pub fn htr_leave_slice_finish(&self) -> Option<&HTRLeaveSliceFinishPruningTable> {
        self.htr_ls_finish.as_ref()
    }
}

#[cfg(feature = "333eo")]
fn gen_eo() -> EOPruningTable {
    info!("Generating EO pruning table...");
    #[cfg(not(target_arch = "wasm32"))]
    let time = Instant::now();
    let table = lookup_table::generate(&EO_FB_MOVESET,
                                       &|c: &crate::cube::Cube333| EOCoordFB::from(c),
                                       &|| EOPruningTable::new(false),
                                       &|table, coord|table.get(coord),
                                       &|table, coord, val|table.set(coord, val));
    #[cfg(not(target_arch = "wasm32"))]
    debug!("Took {}ms", time.elapsed().as_millis());
    table
}

#[cfg(feature = "333dr")]
fn gen_dr() -> DRPruningTable {
    info!("Generating DR pruning table...");
    #[cfg(not(target_arch = "wasm32"))]
    let time = Instant::now();
    let table = lookup_table::generate(&DR_UD_EO_FB_MOVESET,
                                       &|c: &crate::cube::Cube333| DRUDEOFBCoord::from(c),
                                       &|| DRPruningTable::new(false),
                                       &|table, coord|table.get(coord),
                                       &|table, coord, val|table.set(coord, val));
    #[cfg(not(target_arch = "wasm32"))]
    debug!("Took {}ms", time.elapsed().as_millis());
    table
}

#[cfg(feature = "333htr")]
fn gen_htr() -> HTRPruningTable {
    info!("Generating HTR pruning table...");
    #[cfg(not(target_arch = "wasm32"))]
    let time = Instant::now();
    let table = lookup_table::generate(&HTR_DR_UD_MOVESET,
                                           &|c: &crate::cube::Cube333| HTRDRUDCoord::from(c),
                                           &|| HTRPruningTable::new(),
                                           &|table, coord|table.get(coord),
                                           &|table, coord, val|table.set(coord, val));
    #[cfg(not(target_arch = "wasm32"))]
    debug!("Took {}ms", time.elapsed().as_millis());
    table
}

#[cfg(feature = "333htr")]
#[cfg(feature = "fs")]
fn gen_htr_subsets(htr_table: &mut HTRPruningTable) -> HTRSubsetTable {
    info!("Generating HTR subset table...");
    #[cfg(not(target_arch = "wasm32"))]
    let time = Instant::now();
    let subset_table = crate::steps::htr::subsets::gen_subset_tables(htr_table);
    #[cfg(not(target_arch = "wasm32"))]
    debug!("Took {}ms", time.elapsed().as_millis());
    subset_table
}

#[cfg(feature = "333fr")]
fn gen_fr_leave_slice() -> FRLeaveSlicePruningTable {
    info!("Generating FRLS pruning table...");
    #[cfg(not(target_arch = "wasm32"))]
    let time = Instant::now();
    let table = lookup_table::generate(&FR_UD_MOVESET,
                                       &|c: &crate::cube::Cube333| FRUDNoSliceCoord::from(c),
                                       &|| FRLeaveSlicePruningTable::new(false),
                                       &|table, coord|table.get(coord),
                                       &|table, coord, val|table.set(coord, val));
    #[cfg(not(target_arch = "wasm32"))]
    debug!("Took {}ms", time.elapsed().as_millis());
    table
}

#[cfg(feature = "333fr")]
fn gen_fr() -> FRPruningTable {
    info!("Generating FR pruning table...");
    #[cfg(not(target_arch = "wasm32"))]
    let time = Instant::now();
    let table = lookup_table::generate(&FR_UD_MOVESET,
                                       &|c: &crate::cube::Cube333| FRUDWithSliceCoord::from(c),
                                       &|| FRPruningTable::new(false),
                                       &|table, coord|table.get(coord),
                                       &|table, coord, val|table.set(coord, val));
    #[cfg(not(target_arch = "wasm32"))]
    debug!("Took {}ms", time.elapsed().as_millis());
    table
}

#[cfg(feature = "333finish")]
fn gen_fr_finish() -> FRFinishPruningTable {
    info!("Generating FR finish pruning table...");
    #[cfg(not(target_arch = "wasm32"))]
    let time = Instant::now();
    let table = lookup_table::generate(&FRUD_FINISH_MOVESET,
                                       &|c: &crate::cube::Cube333| FRUDFinishCoord::from(c),
                                       &|| FRFinishPruningTable::new(false),
                                       &|table, coord|table.get(coord),
                                       &|table, coord, val|table.set(coord, val));
    #[cfg(not(target_arch = "wasm32"))]
    debug!("Took {}ms", time.elapsed().as_millis());
    table
}

#[cfg(feature = "333finish")]
fn gen_htr_finish() -> HTRFinishPruningTable {
    info!("Generating HTR finish pruning table...");
    #[cfg(not(target_arch = "wasm32"))]
    let time = Instant::now();
    let table = lookup_table::generate(&HTR_FINISH_MOVESET,
                                       &|c: &crate::cube::Cube333| HTRFinishCoord::from(c),
                                       &|| HTRFinishPruningTable::new(false),
                                       &|table, coord|table.get(coord),
                                       &|table, coord, val|table.set(coord, val));
    #[cfg(not(target_arch = "wasm32"))]
    debug!("Took {}ms", time.elapsed().as_millis());
    table
}

#[cfg(feature = "333finish")]
fn gen_htr_no_slice_finish() -> HTRLeaveSliceFinishPruningTable {
    info!("Generating HTR leave slice finish pruning table...");
    #[cfg(not(target_arch = "wasm32"))]
    let time = Instant::now();
    let table = lookup_table::generate(&HTR_FINISH_MOVESET,
                                       &|c: &crate::cube::Cube333| HTRLeaveSliceFinishCoord::from(c),
                                       &|| HTRLeaveSliceFinishPruningTable::new(false),
                                       &|table, coord|table.get(coord),
                                       &|table, coord, val|table.set(coord, val));
    #[cfg(not(target_arch = "wasm32"))]
    debug!("Took {}ms", time.elapsed().as_millis());
    table
}
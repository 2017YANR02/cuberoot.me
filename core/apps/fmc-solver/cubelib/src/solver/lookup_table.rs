use std::collections::HashMap;
use std::fmt::{Debug, Display, Formatter};
#[cfg(feature = "fs")]
use std::fs::File;
use std::hash::Hash;
#[cfg(feature = "fs")]
use std::io::{Read, Write};
use std::marker::PhantomData;
use std::ops::{Deref, DerefMut, Index, IndexMut};
#[cfg(feature = "fs")]
use home::home_dir;
use log::{debug, info, warn};
use memmap2::{Mmap, MmapOptions};
use num_traits::{FromPrimitive};
use crate::cube::*;
use crate::cube::turn::{Invertible, TurnableMut};
use crate::solver::moveset::MoveSet;
use crate::steps::coord::Coord;
use crate::steps::MoveSet333;

const VERSION: u8 = 2;

pub trait DepthEstimate<const C_SIZE: usize, C: Coord<C_SIZE>>: Send + Sync {
    fn get(&self, target: C) -> u8;
}

pub trait NissDepthEstimate<const C_SIZE: usize, C: Coord<C_SIZE>>: Send + Sync {
    fn get_niss_estimate(&self, target: C) -> (u8, u8);
}

pub type InMemoryIndexTable<const C_SIZE: usize, C: Coord<C_SIZE>> = IndexTable<C_SIZE, C, [u8], Vec<u8>>;
pub type MemoryMappedIndexTable<const C_SIZE: usize, C: Coord<C_SIZE>> = IndexTable<C_SIZE, C, [u8], Mmap>;
pub type InMemoryNissIndexTable<const C_SIZE: usize, C: Coord<C_SIZE>> = NissIndexTable<C_SIZE, C, [u8], Vec<u8>>;

#[derive(Copy, Clone, Eq, PartialEq, Debug)]
#[repr(u8)]
#[derive(FromPrimitive, ToPrimitive)]
pub enum TableType {
    Uncompressed = 0u8,
    Compressed = 1u8,
    Niss = 2u8,
    Sym = 3u8, // unused
}

struct TableHeader {
    version: u8,
    table_type: TableType,
}

impl TableHeader {
    const fn size() -> u64 {
        2
    }
}

impl TryFrom<[u8; 2]> for TableHeader {
    type Error = TableError;

    fn try_from(value: [u8; 2]) -> Result<Self, Self::Error> {
        Ok(Self {
            version: value[0],
            table_type: TableType::from_u8(value[1]).ok_or(TableError::InvalidHeader)?
        })
    }
}

impl Into<[u8; 2]> for TableHeader {
    fn into(self) -> [u8; 2] {
        [self.version, self.table_type as u8]
    }
}

pub struct IndexTable<const C_SIZE: usize, C: Coord<C_SIZE>, T: Index<usize, Output = u8> + ?Sized + Send + Sync, F: Deref<Target = T> + Send + Sync> {
    data: F,
    coord_type: PhantomData<C>,
    compressed: bool,
}

pub struct NissIndexTable<const C_SIZE: usize, C: Coord<C_SIZE>, T: Index<usize, Output = u8> + ?Sized + Send + Sync, F: Deref<Target = T> + Send + Sync> {
    table: IndexTable<C_SIZE, C, T, F>,
}
#[derive(Debug)]
pub enum TableError {
    OutdatedVersion,
    InvalidHeader,
    InvalidFormat,
    IOError(std::io::Error)
}

impl Display for TableError {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        match self {
            TableError::OutdatedVersion => write!(f, "Outdated table version"),
            TableError::InvalidHeader => write!(f, "Invalid table header data"),
            TableError::InvalidFormat => write!(f, "Invalid table type"),
            TableError::IOError(e) => write!(f, "Unexpected IO error: {e}"),
        }
    }
}

#[cfg(feature = "fs")]
impl <const C_SIZE: usize, C: Coord<C_SIZE>, T: Index<usize, Output = u8> + ?Sized + Send + Sync, F: Deref<Target = T> + Send + Sync> IndexTable<C_SIZE, C, T, F>{
    pub fn open_file(puzzle_id: &str, table_type: &str) -> Result<File, TableError> {
        let mut dir = home_dir().unwrap();
        dir.push(".cubelib");
        dir.push("tables");
        dir.push(puzzle_id);
        std::fs::create_dir_all(dir.as_path()).map_err(|e|TableError::IOError(e))?;
        dir.push(format!("{table_type}.tbl"));
        debug!("Loading {puzzle_id} {table_type} table from {dir:?}");
        File::open(dir).map_err(|e|TableError::IOError(e))
    }

    pub fn create_file(puzzle_id: &str, table_type: &str) -> Result<File, TableError> {
        let mut dir = home_dir().unwrap();
        dir.push(".cubelib");
        dir.push("tables");
        dir.push(puzzle_id);
        std::fs::create_dir_all(dir.as_path()).map_err(|e|TableError::IOError(e))?;
        dir.push(format!("{table_type}.tbl"));
        debug!("Loading {puzzle_id} {table_type} table from {dir:?}");
        File::create(dir).map_err(|e|TableError::IOError(e))
    }
}

#[cfg(feature = "fs")]
impl <const C_SIZE: usize, C: Coord<C_SIZE>, T: Index<usize, Output = u8> + ?Sized + Send + Sync, F: Deref<Target = T> + Send + Sync> IndexTable<C_SIZE, C, T, F> where Self: LoadFromDisk + SaveToDisk {
    pub fn load_and_save<FN: FnMut() -> InMemoryIndexTable<C_SIZE, C>>(key: &str, mut gen_f: FN) -> (Self, bool) {
        match Self::load_from_disk("333", key) {
            Ok(t) => {
                debug!("Loaded {key} table from disk");
                (t, false)
            },
            Err(_) => {
                info!("Generating {key} table...");
                let table = gen_f();
                if let Err(e) = table.save_to_disk("333", key) {
                    warn!("Failed to save {key} table. {e}");
                }
                let table = Self::load_from_disk("333", key).expect("Must be able to load newly created table");
                (table, true)
            }
        }
    }
}

#[cfg(feature = "fs")]
impl <const C_SIZE: usize, C: Coord<C_SIZE>> MemoryMappedIndexTable<C_SIZE, C> {
    pub fn load_and_save<FN: FnMut() -> InMemoryIndexTable<C_SIZE, C>>(key: &str, mut gen_f: FN) -> (Self, bool) {
        match Self::load_from_disk("333", key) {
            Ok(t) => {
                debug!("Loaded {key} table from disk");
                (t, false)
            },
            Err(_) => {
                info!("Generating {key} table...");
                let table = gen_f();
                if let Err(e) = table.save_to_disk("333", key) {
                    warn!("Failed to save {key} table. {e}");
                }
                let table = Self::load_from_disk("333", key).expect("Must be able to load newly created table");
                (table, true)
            }
        }
    }
}

#[cfg(feature = "fs")]
impl <const C_SIZE: usize, C: Coord<C_SIZE>, T: Index<usize, Output = u8> + ?Sized + Send + Sync, F: Deref<Target = T> + Send + Sync> NissIndexTable<C_SIZE, C, T, F> where Self: LoadFromDisk + SaveToDisk {
    pub fn load_and_save<FN: FnMut() -> InMemoryNissIndexTable<C_SIZE, C>>(key: &str, mut gen_f: FN) -> Self {
        match Self::load_from_disk("333", key) {
            Ok(t) => {
                debug!("Loaded {key} table from disk");
                t
            },
            Err(_) => {
                info!("Generating {key} table...");
                let table = gen_f();
                if let Err(e) = table.save_to_disk("333", key) {
                    warn!("Failed to save {key} table. {e}");
                }
                let table = Self::load_from_disk("333", key).expect("Must be able to load newly created table");
                table
            }
        }
    }
}

#[cfg(feature = "fs")]
impl <const C_SIZE: usize, C: Coord<C_SIZE>> LoadFromDisk for MemoryMappedIndexTable<C_SIZE, C> {
    fn load_from_disk(puzzle_id: &str, table_type: &str) -> Result<Self, TableError> where Self: Sized{
        let mut file = Self::open_file(puzzle_id, table_type)?;
        let mut buf = [0;2];
        file.read_exact(&mut buf).map_err(|e|TableError::IOError(e))?;
        let header = TableHeader::try_from(buf)?;
        if header.version != VERSION {
            return Err(TableError::OutdatedVersion);
        }
        let mmap = unsafe {
            MmapOptions::new()
                .offset(TableHeader::size())
                .map(&file)
        }.map_err(|e|TableError::IOError(e))?;
        if header.table_type == TableType::Compressed {
            assert_eq!(mmap.len(), (C_SIZE + 1) / 2, "Unexpected table size.");
        } else if header.table_type == TableType::Uncompressed {
            assert_eq!(mmap.len(), C_SIZE, "Unexpected table size.");
        } else {
            return Err(TableError::InvalidFormat);
        }
        Ok(Self {
            data: mmap,
            coord_type: PhantomData,
            compressed: header.table_type == TableType::Compressed,
        })
    }
}

#[cfg(feature = "fs")]
impl <const C_SIZE: usize, C: Coord<C_SIZE>> LoadFromDisk for InMemoryIndexTable<C_SIZE, C> {
    fn load_from_disk(puzzle_id: &str, table_type: &str) -> Result<Self, TableError>
    where
        Self: Sized
    {
        let mut file = Self::open_file(puzzle_id, table_type)?;
        let mut buf = [0;2];
        file.read_exact(&mut buf).map_err(|e|TableError::IOError(e))?;
        let header = TableHeader::try_from(buf)?;
        if header.version != VERSION {
            return Err(TableError::OutdatedVersion);
        }
        let mut buffer = Vec::new();
        file.read_to_end(&mut buffer).map_err(|e|TableError::IOError(e))?;
        if header.table_type == TableType::Compressed {
            assert_eq!(buffer.len(), (C_SIZE + 1) / 2);
        } else if header.table_type == TableType::Uncompressed {
            assert_eq!(buffer.len(), C_SIZE);
        } else {
            return Err(TableError::InvalidFormat);
        }

        Ok(Self {
            data: buffer,
            coord_type: PhantomData,
            compressed: header.table_type == TableType::Compressed,
        })
    }
}

#[cfg(feature = "fs")]
impl <const C_SIZE: usize, C: Coord<C_SIZE>> LoadFromDisk for InMemoryNissIndexTable<C_SIZE, C> {
    fn load_from_disk(puzzle_id: &str, table_type: &str) -> Result<Self, TableError>
    where
        Self: Sized
    {
        InMemoryIndexTable::load_from_disk(puzzle_id, table_type).map(|t|Self{
            table: t
        })
    }
}

#[cfg(feature = "fs")]
impl <const C_SIZE: usize, C: Coord<C_SIZE>> SaveToDisk for InMemoryIndexTable<C_SIZE, C> {
    fn save_to_disk(&self, puzzle_id: &str, table_type: &str) -> Result<(), TableError> {
        let mut file = Self::create_file(puzzle_id, table_type)?;
        let header: [u8; 2] = TableHeader {
            version: VERSION,
            table_type: if self.compressed {
                TableType::Compressed
            } else {
                TableType::Uncompressed
            }
        }.into();
        file.write_all(header.as_slice()).map_err(|e|TableError::IOError(e))?;
        file.write_all(&self.data).map_err(|e|TableError::IOError(e))?;
        Ok(())
    }
}

#[cfg(feature = "fs")]
impl <const C_SIZE: usize, C: Coord<C_SIZE>> SaveToDisk for InMemoryNissIndexTable<C_SIZE, C> {
    fn save_to_disk(&self, puzzle_id: &str, table_type: &str) -> Result<(), TableError> {
        self.table.save_to_disk(puzzle_id, table_type)
    }
}

impl <const C_SIZE: usize, C: Coord<C_SIZE>> InMemoryIndexTable<C_SIZE, C> {
    pub fn new(compressed: bool) -> Self {
        let data = if compressed {
            vec![0xFF; (C_SIZE + 1) / 2]
        } else {
            vec![0xFF; C_SIZE]
        };
        Self {
            data,
            coord_type: PhantomData,
            compressed,
        }
    }
}

#[cfg(feature = "fs")]
impl <const C_SIZE: usize, C: Coord<C_SIZE>> InMemoryNissIndexTable<C_SIZE, C> {
    pub fn new() -> Self {
        Self {
            table: InMemoryIndexTable::new(false)
        }
    }
}

impl <const C_SIZE: usize, C: Coord<C_SIZE>, T: Index<usize, Output = u8> + ?Sized + Send + Sync, F: Deref<Target = T> + Send + Sync> EmptyVal for IndexTable<C_SIZE, C, T, F>{
    fn empty_val(&self) -> u8 {
        if self.compressed {
            0x0F
        } else {
            0xFF
        }
    }
}

impl <const C_SIZE: usize, C: Coord<C_SIZE>, T: Index<usize, Output = u8> + ?Sized + Send + Sync, F: Deref<Target = T> + Send + Sync> EmptyVal for NissIndexTable<C_SIZE, C, T, F>{
    fn empty_val(&self) -> u8 {
        0x0F
    }
}

impl <const C_SIZE: usize, C: Coord<C_SIZE>, T: Index<usize, Output = u8> + ?Sized + Send + Sync, F: Deref<Target = T> + Send + Sync> DepthEstimate<C_SIZE, C> for IndexTable<C_SIZE, C, T, F>{
    fn get(&self, target: C) -> u8 {
        self.get_direct(target)
    }
}

impl <const C_SIZE: usize, C: Coord<C_SIZE>, T: Index<usize, Output = u8> + ?Sized + Send + Sync, F: Deref<Target = T> + Send + Sync> NissDepthEstimate<C_SIZE, C> for NissIndexTable<C_SIZE, C, T, F>{
    fn get_niss_estimate(&self, target: C) -> (u8, u8) {
        let entry = self.table.get(target);
        (entry & 0x0F, entry >> 4)
    }
}

impl <const C_SIZE: usize, C: Coord<C_SIZE>, T: Index<usize, Output = u8> + ?Sized + Send + Sync, F: Deref<Target = T> + Send + Sync> DepthEstimate<C_SIZE, C> for NissIndexTable<C_SIZE, C, T, F>{
    fn get(&self, target: C) -> u8 {
        self.get_niss_estimate(target).0
    }
}

impl <const C_SIZE: usize, C: Coord<C_SIZE>, T: Index<usize, Output = u8> + ?Sized + Send + Sync, F: Deref<Target = T> + Send + Sync> IndexTable<C_SIZE, C, T, F> {
    pub fn get_direct<A: Into<usize>>(&self, id: A) -> u8 {
        let id: usize = id.into();
        if self.compressed {
            let entry = self.data[id >> 1];
            let val = entry >> ((id & 1) << 2);
            val & 0x0F
        } else {
            self.data[id]
        }
    }
}

impl <const C_SIZE: usize, C: Coord<C_SIZE>, T: IndexMut<usize, Output = u8> + ?Sized + Send + Sync, F: DerefMut<Target = T> + Send + Sync> IndexTable<C_SIZE, C, T, F> {
    pub fn set(&mut self, id: C, entry: u8) {
        self.set_direct(id, entry)
    }

    pub(crate) fn set_direct<A: Into<usize>>(&mut self, id: A, entry: u8) {
        let id: usize = id.into();
        if self.compressed {
            let value = self.data[id >> 1];
            let mask = 0xF0u8 >> ((id & 1) << 2);
            let entry = entry << ((id & 1) << 2);
            self.data[id >> 1] = value & mask | entry;
        } else {
            self.data[id] = entry
        }
    }
}

impl <const C_SIZE: usize, C: Coord<C_SIZE>> InMemoryNissIndexTable<C_SIZE, C> {
    pub fn set(&mut self, id: C, entry: u8) {
        let id: usize = id.into();
        let niss = self.table.get_direct(id) & 0xF0;
        self.table.set_direct(id, (entry & 0x0F) | niss);
    }

    pub fn set_niss(&mut self, id: C, niss: u8) {
        let id: usize = id.into();
        let v = self.table.get_direct(id) & 0x0F;
        self.table.set_direct(id, v | (niss << 4));
    }
}

pub trait EmptyVal {
    fn empty_val(&self) -> u8;
}

#[cfg(feature = "fs")]
pub trait SaveToDisk {
    fn save_to_disk(&self, puzzle_id: &str, table_type: &str) -> Result<(), TableError>;
}

#[cfg(feature = "fs")]
pub trait LoadFromDisk {
    fn load_from_disk(puzzle_id: &str, table_type: &str) -> Result<Self, TableError> where Self: Sized;
}

pub fn generate<
    const COORD_SIZE: usize,
    Mapper,
    Table: EmptyVal,
    Init,
    Getter,
    Setter,
    CoordParam: Coord<COORD_SIZE> + Copy + Hash + Eq + Debug,
>(
    move_set: &MoveSet,
    mapper: &Mapper,
    init: &Init,
    getter: &Getter,
    setter: &Setter,
) -> Table
where
    Mapper: Fn(&Cube333) -> CoordParam,
    Init: Fn() -> Table,
    Setter: Fn(&mut Table, CoordParam, u8),
    Getter: Fn(&Table, CoordParam) -> u8
{
    let start = Cube333::default();
    let mut visited = HashMap::new();
    let mut to_check = vec![start.clone()];
    visited.insert(mapper(&start), start);
    while !to_check.is_empty() {
        to_check = pre_gen_coset_0(&move_set, mapper, &mut visited, &to_check);
    }

    let mut to_check = HashMap::new();
    let mut table = init();
    for (start_coord, start_cube) in visited {
        setter(&mut table, start_coord, 0);
        to_check.insert(start_coord, start_cube);
    }
    if to_check.len() > 1 {
        debug!("Found {} variations of the goal state", to_check.len());
    }
    let mut total_checked = 0;
    for depth in 0.. {
        total_checked += to_check.len();
        debug!(
            "Checked {:width$}/{} cubes at depth {depth} (new {})",
            total_checked,
            CoordParam::size(),
            to_check.len(),
            width = CoordParam::size().to_string().len(),
        );
        to_check = fill_table(&move_set, &mut table, depth, mapper, getter, setter, to_check);
        if to_check.is_empty() {
            break;
        }
    }
    total_checked += to_check.len();
    if total_checked != CoordParam::size() {
        warn!(
            "Expected {} cubes in table but got {total_checked}. The coordinate may be malformed",
            CoordParam::size()
        );
    }
    table
}

fn pre_gen_coset_0<
    const COORD_SIZE: usize,
    Mapper,
    CoordParam: Coord<COORD_SIZE> + Copy + Hash + Eq + Debug,
>(
    move_set: &MoveSet,
    mapper: &Mapper,
    visited: &mut HashMap<CoordParam, Cube333>,
    to_check: &Vec<Cube333>,
) -> Vec<Cube333>
where
    Mapper: Fn(&Cube333) -> CoordParam,
{
    let mut check_next = vec![];
    for cube in to_check {
        for m in move_set.aux_moves.iter().cloned() {
            let mut cube = cube.clone();
            cube.turn(m);
            let coord = mapper(&cube);
            if visited.contains_key(&coord) {
                continue;
            }
            visited.insert(coord, cube.clone());
            check_next.push(cube);
        }
    }
    check_next
}

fn fill_table<
    const COORD_SIZE: usize,
    Mapper,
    Table: EmptyVal,
    Getter,
    Setter,
    CoordParam: Coord<COORD_SIZE> + Copy + Hash + Eq + Debug,
>(
    move_set: &MoveSet,
    table: &mut Table,
    depth: u8,
    mapper: &Mapper,
    getter: &Getter,
    setter: &Setter,
    to_check: HashMap<CoordParam, Cube333>,
) -> HashMap<CoordParam, Cube333>
where
    Mapper: Fn(&Cube333) -> CoordParam,
    Setter: Fn(&mut Table, CoordParam, u8),
    Getter: Fn(&Table, CoordParam) -> u8
{
    let mut next_cubes: HashMap<CoordParam, Cube333> = HashMap::new();
    for (_coord, cube) in to_check.into_iter() {
        for m in move_set
            .aux_moves
            .into_iter()
            .chain(move_set.st_moves.into_iter())
            .cloned()
        {
            let mut cube = cube.clone();
            cube.turn(m);
            let coord = mapper(&cube);
            let stored = getter(&table, coord);
            if stored == table.empty_val() {
                setter(table, coord, depth + 1);
                next_cubes.insert(coord, cube);
            }
        }
    }
    next_cubes
}

// This table is much larger and requires different methods to generate.
// Since it's the only one we'll avoid a generic implementation for now
pub fn generate_large_table<
    const C_SIZE: usize,
    C: Coord<C_SIZE>,
>(move_set: &MoveSet333) -> InMemoryIndexTable<{C_SIZE}, C> where for <'a> C: From<&'a Cube333>, for <'a> &'a C: Into<Cube333>, C: From<usize> {
    let mut table = InMemoryIndexTable::new(true);
    table.set_direct(C::from(&Cube333::default()), 0);

    let mut depth = 1;
    let empty_val = table.empty_val();
    while depth < empty_val {
        let mut changed = 0usize;
        let mut touched = 0usize;
        let mut last_percentage = 0u8;
        (0..C::size())
            .into_iter()
            .for_each(|idx|{
                touched += 1;
                let percentage = (touched * 10 / C::size()) as u8;
                if percentage - 1 == last_percentage {
                    info!("Depth {depth}/{}, {}%", empty_val - 1, percentage * 10);
                    last_percentage = percentage;
                }
                if table.get_direct(idx) == depth - 1 {
                    let mut cube: Cube333 = (&C::from(idx)).into();
                    for turn in move_set.st_moves.iter().chain(move_set.aux_moves.iter()) {
                        cube.turn(turn.clone());
                        let coord = C::from(&cube);
                        if table.get(coord) == empty_val {
                            changed += 1;
                            table.set(coord, depth);
                        }
                        cube.turn(turn.invert());
                    }
                }
            });
        debug!("Positions at depth {depth}: {}", changed);
        depth += 1;
    }
    table
}

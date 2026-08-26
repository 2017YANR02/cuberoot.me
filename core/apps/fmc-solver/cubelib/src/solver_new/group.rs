use std::{mem, thread};
use std::cmp::min;
use std::collections::HashSet;
use std::thread::JoinHandle;

use crossbeam::channel::{Select, SendError};
use crate::cube::Cube333;
use crate::solver::solution::Solution;
use crate::solver_new::*;
use crate::solver_new::thread_util::*;
use crate::solver_new::util_steps::FilterFirstN;

const BUFFER_SIZE: usize = 10;

enum StepType {
    Sequential(Vec<StepGroup>),
    Parallel(Vec<StepGroup>),
    Single(Box<dyn ToWorker + Send + 'static>),
}

pub enum StepPredicateResult {
    Accepted,
    Rejected,
    Closed
}

pub trait StepPredicate: Send {
    fn check_solution(&self, solution: &Solution) -> StepPredicateResult;
}

pub struct StepGroup {
    step_type: StepType,
    predicates: Vec<Box<dyn StepPredicate>>,
}

impl StepGroup {
    pub fn apply_step_limit(&mut self, limit: usize) {
        match &mut self.step_type {
            StepType::Sequential(steps) => {
                for step in steps {
                    step.apply_step_limit(limit);
                }
            }
            StepType::Parallel(steps) => {
                for step in steps {
                    step.apply_step_limit(limit);
                }
                self.predicates.push(FilterFirstN::new(limit));
            }
            StepType::Single(_) => {
                self.predicates.push(FilterFirstN::new(limit))
            }
        }
    }

    pub fn sequential(steps: Vec<StepGroup>) -> StepGroup {
        Self::sequential_with_predicates(steps, vec![])
    }

    pub fn sequential_with_predicates(steps: Vec<StepGroup>, predicates: Vec<Box<dyn StepPredicate>>) -> StepGroup {
        Self {
            step_type: StepType::Sequential(steps),
            predicates
        }
    }

    pub fn parallel(steps: Vec<StepGroup>) -> StepGroup {
        Self::parallel_with_predicates(steps, vec![])
    }

    pub fn parallel_with_predicates(steps: Vec<StepGroup>, predicates: Vec<Box<dyn StepPredicate>>) -> StepGroup {
        Self {
            step_type: StepType::Parallel(steps),
            predicates
        }
    }

    pub fn single(step: Box<dyn ToWorker + Send + 'static>) -> StepGroup {
        Self::single_with_predicates(step, vec![])
    }

    pub fn single_with_predicates(step: Box<dyn ToWorker + Send + 'static>, predicates: Vec<Box<dyn StepPredicate>>) -> StepGroup {
        Self {
            step_type: StepType::Single(step),
            predicates
        }
    }

    pub fn with_predicates(&mut self, mut preds: Vec<Box<dyn StepPredicate>>) {
        self.predicates.append(&mut preds);
    }

    pub fn into_worker(self, cube: Cube333) -> SolverWorker {
        let b: Box<dyn ToWorker + Send> = Box::new(self);
        SolverWorker::new(b, cube)
    }
}

impl ToWorker for StepGroup {
    fn to_worker_box(mut self: Box<Self>, cube_state: Cube333, rc: Receiver<Solution>, tx: Sender<Solution>, mut additional_predicates: Vec<Box<dyn StepPredicate>>) -> Box<dyn Worker<()> + Send>
    where
        Self: Send + 'static
    {
        self.predicates.append(&mut additional_predicates);
        match self.step_type {
            StepType::Sequential(s) => Self::create_sequential_worker(s, cube_state, rc, tx, self.predicates),
            StepType::Parallel(s) => Self::create_parallel_worker(s, cube_state, rc, tx, self.predicates),
            StepType::Single(s) => s.to_worker_box(cube_state, rc, tx, self.predicates)
        }
    }
}

impl StepGroup {

    fn create_sequential_worker(mut steps: Vec<StepGroup>, cube_state: Cube333, mut rc: Receiver<Solution>, tx_last: Sender<Solution>, additional_predicates: Vec<Box<dyn StepPredicate>>) -> Box<dyn Worker<()> + Send>
    where
        Self: Sized + Send + 'static
    {
        assert!(!steps.is_empty());
        if steps.len() == 1 {
            return steps.pop().unwrap().to_worker(cube_state, rc, tx_last, additional_predicates);
        }
        let (mut tx, mut rc_next) = bounded_channel(BUFFER_SIZE);
        let mut workers = vec![];
        steps.reverse();
        for _ in 0..(steps.len() - 1) {
            workers.push(steps.pop().unwrap().to_worker(cube_state.clone(), rc, tx, vec![]));
            rc = rc_next;
            (tx, rc_next) = bounded_channel(BUFFER_SIZE);
        }
        workers.push(steps.pop().unwrap().to_worker(cube_state.clone(), rc, tx_last, additional_predicates));
        Box::new(SequentialWorker {
            workers,
        })
    }

    fn create_parallel_worker(mut steps: Vec<StepGroup>, cube_state: Cube333, rc: Receiver<Solution>, tx: Sender<Solution>, additional_predicates: Vec<Box<dyn StepPredicate>>) -> Box<dyn Worker<()> + Send>
    where
        Self: Sized + Send + 'static
    {
        assert!(!steps.is_empty());
        if steps.len() == 1 {
            return steps.pop().unwrap().to_worker(cube_state, rc, tx, additional_predicates);
        }
        let mut workers = vec![];
        let mut inputs = vec![];
        let mut outputs = vec![];
        for step in steps.into_iter() {
            let (tx0, rc0) = bounded_channel(BUFFER_SIZE);
            let (tx1, rc1) = bounded_channel(BUFFER_SIZE);
            workers.push(step.to_worker(cube_state.clone(), rc0, tx1, vec![]));
            inputs.push(rc1);
            outputs.push(tx0);
        }
        Box::new(ParallelWorker {
            broadcaster: ThreadState::PreStart(Box::new(Broadcaster::new(rc, outputs))),
            workers,
            sampler: ThreadState::PreStart(Box::new(InOrderSampler::new(tx, inputs, additional_predicates))),
        })
    }
}

struct SequentialWorker {
    workers: Vec<Box<dyn Worker<()> + Send>>,
}

impl Worker<()> for SequentialWorker {
    fn start(&mut self) {
        self.workers.iter_mut()
            .for_each(|w| w.start());
    }

    fn stop(&mut self) -> Option<JoinHandle<()>> {
        let workers = mem::take(&mut self.workers);
        Some(thread::spawn(move||{
            let mut to_join = vec![];
            for mut w in workers {
                if let Some(handle) = w.stop() {
                    to_join.push(handle);
                }
            }
            for handle in to_join {
                handle.join().unwrap();
            }
        }))
    }
}

struct Broadcaster {
    sinks: Vec<Sender<Solution>>,
    positions: Vec<usize>,
    source: Receiver<Solution>,
    buffer: Vec<Solution>
}

impl Broadcaster {
    pub fn new(source: Receiver<Solution>, sinks: Vec<Sender<Solution>>) -> Self {
        Self {
            positions: vec![0; sinks.len()],
            sinks,
            source,
            buffer: vec![],
        }
    }
}

// If only we had a good sync spmc broadcast channel :(
// I don't want to spend the time to implement myself and it doesn't have to be super fast so we'll just add another thread
impl Run<()> for Broadcaster {
    fn run(&mut self) {
        let mut source_dead = false;
        while !self.sinks.is_empty() {
            let mut select = Select::new();
            let mut lowest = self.buffer.len();
            let mut active_sinks = vec![];
            for id in 0..self.sinks.len() {
                lowest = min(lowest, self.positions[id]);
                if self.positions[id] < self.buffer.len() {
                    select.send(&self.sinks[id]);
                    active_sinks.push(id);
                }
            }
            // Has one sink reached the end of the buffer
            if active_sinks.len() < self.sinks.len() && !source_dead {
                select.recv(&self.source);
            }
            if lowest > 0 {
                self.buffer.drain(0..lowest);
                for buffer_positios in self.positions.iter_mut() {
                    *buffer_positios -= lowest;
                }
            }
            let index = select.ready();
            if index == active_sinks.len() {
                match self.source.recv() {
                    Ok(v) => {
                        self.buffer.push(v);
                    }
                    Err(_) => {
                        source_dead = true;
                    }
                }
            } else {
                let index = active_sinks[index];
                let sink = &self.sinks[index];
                let item = self.buffer[self.positions[index]].clone();
                let result = sink.send(item);
                match result {
                    Ok(_) => {
                        self.positions[index] += 1;
                    }
                    Err(_) => {
                        self.sinks.remove(index);
                        self.positions.remove(index);
                    }
                }
            }
            if source_dead {
                for idx in (0..self.sinks.len()).rev() {
                    if self.positions[idx] >= self.buffer.len() {
                        self.positions.remove(idx);
                        self.sinks.remove(idx);
                    }
                }
            }
        }
    }
}

pub struct FifoSampler {
    sources: Vec<Receiver<Solution>>,
    sink: Sender<Solution>,
}

impl FifoSampler {
    pub fn new(sink: Sender<Solution>, sources: Vec<Receiver<Solution>>) -> Self {
        Self {
            sources,
            sink,
        }
    }
}

impl Run<()> for FifoSampler {
    fn run(&mut self) -> () {
        let mut sel = Select::new();

        for source in &self.sources {
            sel.recv(source);
        }

        let mut connected = self.sources.len();
        while connected > 0 {
            let index = sel.ready();

            match self.sources[index].try_recv() {
                Ok(res) => {
                    if let Err(_) = self.sink.send(res) {
                        return;
                    }
                }
                Err(TryRecvError::Disconnected) => {
                    sel.remove(index);
                    connected -= 1;
                }
                _ => {}
            }
        }
    }
}

pub struct InOrderSampler {
    sources: Vec<Receiver<Solution>>,
    sink: Sender<Solution>,
    predicates: Vec<Box<dyn StepPredicate>>,
}

impl InOrderSampler {
    pub fn new(sink: Sender<Solution>, sources: Vec<Receiver<Solution>>, predicates: Vec<Box<dyn StepPredicate>>) -> Self {
        Self {
            sources,
            sink,
            predicates,
        }
    }
}

impl InOrderSampler {
    fn send(&self, item: Solution) -> Result<(), SendError<Solution>> {
        for p in self.predicates.iter() {
            match p.check_solution(&item) {
                StepPredicateResult::Accepted => {}
                StepPredicateResult::Rejected => {
                    return Ok(());
                }
                StepPredicateResult::Closed => {
                    return Err(SendError(item));
                }
            }
        }
        self.sink.send(item)
    }
}

impl Run<()> for InOrderSampler {
    fn run(&mut self) -> () {
        let mut cache: Vec<Option<Solution>> = vec![None; self.sources.len()];
        let mut sel = Select::new();
        let mut target_length = 0;
        let mut active = self.sources.len();
        for s in &self.sources {
            sel.recv(s);
        }
        let mut dead = HashSet::new();
        while dead.len() < self.sources.len() {
            if active == 0 {
                target_length = cache.iter().filter_map(|x| x.as_ref().map(|x| x.len())).min().unwrap_or(target_length + 1);
                for idx in 0..cache.len() {
                    if cache[idx].as_ref().filter(|x|x.len() <= target_length).is_some() {
                        if let Err(_) = self.send(cache[idx].take().unwrap()) {
                            return;
                        }
                    }
                }
                active = self.sources.len();
                sel = Select::new();
                for s in &self.sources {
                    sel.recv(s);
                }
            }
            let index = sel.ready();
            if cache[index].is_some() {
                sel.remove(index);
                active -= 1;
                continue;
            }
            match self.sources[index].try_recv() {
                Ok(res) => {
                    if res.len() > target_length {
                        sel.remove(index);
                        cache[index] = Some(res);
                        active -= 1;
                        continue
                    }
                    if let Err(_) = self.send(res) {
                        return;
                    }
                }
                Err(TryRecvError::Disconnected) => {
                    sel.remove(index);
                    dead.insert(index);
                    active -= 1;
                }
                _ => {}
            }
        }
    }
}

struct ParallelWorker {
    workers: Vec<Box<dyn Worker<()> + Send>>,
    broadcaster: ThreadState<()>,
    sampler: ThreadState<()>,
}

impl Worker<()> for ParallelWorker {
    fn start(&mut self) {
        self.broadcaster.start();
        self.workers.iter_mut()
            .for_each(|w| w.start());
        self.sampler.start();
    }

    fn stop(&mut self) -> Option<JoinHandle<()>> {
        let workers = mem::take(&mut self.workers);
        let mut broadcaster = mem::take(&mut self.broadcaster);
        let mut sampler = mem::take(&mut self.sampler);

        Some(thread::spawn(move||{
            let mut to_join = vec![];
            if let Some(handle) = broadcaster.stop() {
                to_join.push(handle);
            }
            if let Some(handle) = sampler.stop() {
                to_join.push(handle);
            }
            for mut w in workers {
                if let Some(handle) = w.stop() {
                    to_join.push(handle);
                }
            }
            for handle in to_join {
                handle.join().unwrap();
            }
        }))
    }
}

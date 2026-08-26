use std::{mem, thread};
use std::thread::JoinHandle;

use crate::cube::Cube333;
use crate::solver::solution::Solution;
use crate::solver_new::{bounded_channel, Receiver, Sender, SendError, TryRecvError};
use crate::solver_new::group::StepPredicate;
use crate::solver_new::util_steps::FilterDup;

pub struct SolverWorker {
    worker: Box<dyn Worker<()> + Send>,
    receiver: Receiver<Solution>,
    state: WorkerState,
}

impl SolverWorker {
    pub fn new<T: Into<Box<dyn ToWorker + Send + 'static>>>(worker: T, cube: Cube333) -> Self {
        Self::new_with_predicates(worker, cube, vec![])
    }

    pub fn new_with_predicates<T: Into<Box<dyn ToWorker + Send + 'static>>>(worker: T, cube: Cube333, mut pred: Vec<Box<dyn StepPredicate>>) -> Self {
        let (tx0, rc0) = bounded_channel(1);
        let (tx1, rc1) = bounded_channel(1);

        tx0.send(Solution::new()).unwrap();
        drop(tx0);
        pred.push(FilterDup::new()); // It might be there already, but it's cheap enough, so we don't care

        Self {
            worker: worker.into().to_worker_box(cube, rc0, tx1, pred),
            receiver: rc1,
            state: WorkerState::Initialized,
        }
    }

    pub fn try_next(&mut self) -> Result<Solution, TryRecvError> {
        match self.state {
            WorkerState::Initialized => {
                self.worker.start();
                self.state = WorkerState::Running;
            },
            WorkerState::Running => {}
            WorkerState::Finished => return Err(TryRecvError::Disconnected),
        }

        match self.receiver.try_recv() {
            Ok(s) => Ok(s),
            Err(TryRecvError::Empty) => Err(TryRecvError::Empty),
            Err(e) => {
                self.state = WorkerState::Finished;
                Err(e)
            }
        }
    }
}

#[derive(Copy, Clone)]
enum WorkerState {
    Initialized,
    Running,
    Finished,
}

impl Iterator for SolverWorker {
    type Item = Solution;

    fn next(&mut self) -> Option<Self::Item> {
        match self.state {
            WorkerState::Initialized => {
                self.worker.start();
                self.state = WorkerState::Running;
            },
            WorkerState::Running => {}
            WorkerState::Finished => return None,
        }
        match self.receiver.recv() {
            Ok(s) => Some(s),
            Err(_) => {
                self.state = WorkerState::Finished;
                None
            }
        }
    }
}

impl Drop for SolverWorker {
    fn drop(&mut self) {
        let (_, mut rc) = bounded_channel(1);
        mem::swap(&mut self.receiver, &mut rc);
        drop(rc);
        self.state = WorkerState::Finished;
        if let Some(join_handle) = self.worker.stop() {
            join_handle.join().unwrap();
        }
    }
}

pub enum ThreadState<O> {
    None,
    PreStart(Box<dyn Run<O> + Send>),
    PostStart(JoinHandle<O>),
}

pub type SubmitFunction = Box<dyn FnMut(&Solution) -> Result<(), SendError<Solution>>>;

impl <O> Default for ThreadState<O> {
    fn default() -> Self {
        Self::None
    }
}

impl <O: Send + 'static> Worker<O> for ThreadState<O> {
    fn start(&mut self) {
        *self = match mem::take(self) {
            ThreadState::None => ThreadState::None,
            ThreadState::PreStart(mut runner) => ThreadState::PostStart(thread::spawn(move || runner.run())),
            ThreadState::PostStart(x) => ThreadState::PostStart(x),
        }
    }

    fn stop(&mut self) -> Option<JoinHandle<O>> {
        match mem::take(self) {
            ThreadState::None => None,
            ThreadState::PreStart(x) => {
                *self = ThreadState::PreStart(x);
                None
            }
            ThreadState::PostStart(jh) => Some(jh),
        }
    }
}

pub trait Run<T> {
    fn run(&mut self) -> T;
}

pub trait Worker<O: Send + 'static> {
    fn start(&mut self);
    fn stop(&mut self) -> Option<JoinHandle<O>>;
}

pub trait ToWorker: Send {
    fn to_worker(self: Self, cube_state: Cube333, rc: Receiver<Solution>, tx: Sender<Solution>, additional_predicates: Vec<Box<dyn StepPredicate>>) -> Box<dyn Worker<()> + Send> where Self: Send + 'static + Sized {
        Box::new(self).to_worker_box(cube_state, rc, tx, additional_predicates)
    }
    fn to_worker_box(self: Box<Self>, cube_state: Cube333, rc: Receiver<Solution>, tx: Sender<Solution>, additional_predicates: Vec<Box<dyn StepPredicate>>) -> Box<dyn Worker<()> + Send> where Self: Send + 'static;
}

//! Minimal standalone ABI: persistent fixtures and numerical runs are separate
//! from JSON input/output, so benchmark timing does not hide serialization.
use crate::{FitResult, FixtureSet};
use std::sync::Mutex;
struct State {
    fixtures: FixtureSet,
    result: FitResult,
}
static STATE: Mutex<Option<State>> = Mutex::new(None);
#[no_mangle]
pub extern "C" fn alloc(len: u32) -> u32 {
    Box::into_raw(vec![0u8; len as usize].into_boxed_slice()) as *mut u8 as u32
}
#[no_mangle]
pub unsafe extern "C" fn dealloc(ptr: u32, len: u32) {
    drop(Box::from_raw(std::ptr::slice_from_raw_parts_mut(
        ptr as *mut u8,
        len as usize,
    )));
}
fn output(bytes: Vec<u8>) -> u64 {
    let len = bytes.len();
    let ptr = Box::into_raw(bytes.into_boxed_slice()) as *mut u8;
    ((ptr as u64) << 32) | len as u64
}
#[no_mangle]
pub unsafe extern "C" fn load_fixtures(ptr: u32, len: u32) -> i32 {
    #[cfg(feature = "cpu-pipeline")]
    std::panic::set_hook(Box::new(|info| {
        crate::opencv::diagnostic(&info.to_string())
    }));
    let bytes = std::slice::from_raw_parts(ptr as *const u8, len as usize);
    match serde_json::from_slice::<FixtureSet>(bytes) {
        Ok(fixtures) => {
            let count = fixtures.workloads.len();
            *STATE.lock().unwrap() = Some(State {
                fixtures,
                result: FitResult {
                    bank: vec![],
                    refinements: vec![],
                },
            });
            count as i32
        }
        Err(_) => -1,
    }
}
#[no_mangle]
pub extern "C" fn run_case(index: u32) -> i32 {
    let mut guard = STATE.lock().unwrap();
    let state = guard.as_mut().unwrap();
    if index as usize >= state.fixtures.workloads.len() {
        return -1;
    }
    state.result = crate::fit_case(&state.fixtures, index as usize);
    state.result.bank.len() as i32
}
#[no_mangle]
pub extern "C" fn result_json() -> u64 {
    let guard = STATE.lock().unwrap();
    output(serde_json::to_vec(&guard.as_ref().unwrap().result).unwrap())
}
#[no_mangle]
pub extern "C" fn probes_json() -> u64 {
    let guard = STATE.lock().unwrap();
    output(serde_json::to_vec(&serde_json::json!({"projection":crate::check_probes(&guard.as_ref().unwrap().fixtures),"solver":crate::check_solvers(&guard.as_ref().unwrap().fixtures),"sweep":crate::check_sweeps(&guard.as_ref().unwrap().fixtures)})).unwrap())
}

#[no_mangle]
pub unsafe extern "C" fn fit_browser_frame(ptr: u32, len: u32) -> u64 {
    let bytes = std::slice::from_raw_parts(ptr as *const u8, len as usize);
    let input: crate::browser::FrameInput = serde_json::from_slice(bytes).unwrap();
    let guard = STATE.lock().unwrap();
    output(
        serde_json::to_vec(&crate::browser::fit_frame(
            &guard.as_ref().unwrap().fixtures.geometry,
            input,
        ))
        .unwrap(),
    )
}

#[no_mangle]
pub unsafe extern "C" fn fit_browser_neighbors(ptr: u32, len: u32) -> u64 {
    let bytes = std::slice::from_raw_parts(ptr as *const u8, len as usize);
    let input: crate::browser::NeighborInput = serde_json::from_slice(bytes).unwrap();
    let guard = STATE.lock().unwrap();
    output(
        serde_json::to_vec(&crate::browser::refine_neighbors(
            &guard.as_ref().unwrap().fixtures.geometry,
            input,
        ))
        .unwrap(),
    )
}

#[cfg(feature = "cpu-pipeline")]
#[no_mangle]
pub unsafe extern "C" fn startup_json(ptr: u32, len: u32) -> u64 {
    let bytes = std::slice::from_raw_parts(ptr as *const u8, len as usize);
    let input: crate::startup::Input = serde_json::from_slice(bytes).unwrap();
    let guard = STATE.lock().unwrap();
    output(
        serde_json::to_vec(&crate::startup::prepare(
            &guard.as_ref().unwrap().fixtures.geometry,
            &input,
        ))
        .unwrap(),
    )
}

#[cfg(feature = "cpu-pipeline")]
#[no_mangle]
pub unsafe extern "C" fn pipeline_json(ptr: u32, len: u32) -> u64 {
    let input: crate::pipeline::Input =
        serde_json::from_slice(std::slice::from_raw_parts(ptr as *const u8, len as usize)).unwrap();
    let guard = STATE.lock().unwrap();
    output(
        serde_json::to_vec(&crate::pipeline::run(
            &guard.as_ref().unwrap().fixtures.geometry,
            input,
        ))
        .unwrap(),
    )
}

#[cfg(feature = "cpu-pipeline")]
#[no_mangle]
pub unsafe extern "C" fn pipeline_stage_json(ptr: u32, len: u32) -> u64 {
    let input: crate::pipeline::StageRequest =
        serde_json::from_slice(std::slice::from_raw_parts(ptr as *const u8, len as usize)).unwrap();
    let guard = STATE.lock().unwrap();
    output(
        serde_json::to_vec(&crate::pipeline::run_stage(
            &guard.as_ref().unwrap().fixtures.geometry,
            input,
        ))
        .unwrap(),
    )
}

#[cfg(feature = "cpu-pipeline")]
#[no_mangle]
pub unsafe extern "C" fn pipeline_job_json(ptr: u32, len: u32) -> u64 {
    let input: crate::pipeline::jobs::Job =
        serde_json::from_slice(std::slice::from_raw_parts(ptr as *const u8, len as usize)).unwrap();
    let guard = STATE.lock().unwrap();
    output(
        serde_json::to_vec(&crate::pipeline::jobs::run(
            &guard.as_ref().unwrap().fixtures.geometry,
            input,
        ))
        .unwrap(),
    )
}

static MOVE_SEARCH: std::sync::Mutex<Option<crate::move_search::Engine>> =
    std::sync::Mutex::new(None);
#[no_mangle]
pub unsafe extern "C" fn move_search_json(ptr: u32, len: u32) -> u64 {
    let result = serde_json::from_slice(std::slice::from_raw_parts(ptr as *const u8, len as usize))
        .map_err(|e| e.to_string())
        .and_then(|request| crate::move_search::request(&mut MOVE_SEARCH.lock().unwrap(), request));
    output(serde_json::to_vec(&result).unwrap())
}

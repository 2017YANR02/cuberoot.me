use std::cell::RefCell;
thread_local! { static OUTPUT: RefCell<String> = RefCell::new(String::new()); }

#[no_mangle]
pub extern "C" fn cubeopt_check_bpmx() -> i32 {
    match cube48opt_research::search::verify_bpmx_small() {
        Ok(report) => { OUTPUT.with(|out| *out.borrow_mut() = report); 0 }
        Err(error) => { OUTPUT.with(|out| *out.borrow_mut() = error); -1 }
    }
}
#[no_mangle]
pub extern "C" fn cubeopt_check_bpmx_ptr() -> *const u8 {
    OUTPUT.with(|out| out.borrow().as_ptr())
}
#[no_mangle]
pub extern "C" fn cubeopt_check_bpmx_len() -> usize {
    OUTPUT.with(|out| out.borrow().len())
}

//! OpenCV 5 camera kernels. The WASM host bridges to the pinned C++ build.
use crate::{math::*, Camera, Pose};

#[cfg(target_arch = "wasm32")]
#[link(wasm_import_module = "env")]
extern "C" {
    fn pose_cv(
        mode: i32,
        objects: *const f64,
        pixels: *const f64,
        count: i32,
        intrinsic: *const f64,
        distortion: *const f64,
        distortion_count: i32,
        guess: *const f64,
        output: *mut f64,
        capacity: i32,
    ) -> i32;
    fn pose_diagnostic(pointer: *const u8, length: usize);
}
pub(crate) fn diagnostic(message: &str) {
    #[cfg(target_arch = "wasm32")]
    unsafe {
        pose_diagnostic(message.as_ptr(), message.len());
    }
    #[cfg(not(target_arch = "wasm32"))]
    eprintln!("{message}");
}

#[cfg(not(target_arch = "wasm32"))]
unsafe fn pose_cv(
    _: i32,
    _: *const f64,
    _: *const f64,
    _: i32,
    _: *const f64,
    _: *const f64,
    _: i32,
    _: *const f64,
    _: *mut f64,
    _: i32,
) -> i32 {
    panic!("CPU pipeline camera kernels require the OpenCV WASM host")
}

fn call(
    mode: i32,
    objects: &[V3],
    pixels: &[V2],
    camera: &Camera,
    guess: Option<&Pose>,
) -> Option<Vec<f64>> {
    let mut output = vec![0.; (objects.len() * 2).max(18 * 6)];
    let pose: [f64; 6] = guess
        .map(|p| {
            [
                p.rvec[0], p.rvec[1], p.rvec[2], p.tvec[0], p.tvec[1], p.tvec[2],
            ]
        })
        .unwrap_or([0.; 6]);
    let count = unsafe {
        pose_cv(
            mode,
            objects.as_ptr().cast(),
            if pixels.is_empty() {
                std::ptr::null()
            } else {
                pixels.as_ptr().cast()
            },
            objects.len() as i32,
            camera.k.as_ptr().cast(),
            camera.dist.as_ptr(),
            camera.dist.len() as i32,
            pose.as_ptr(),
            output.as_mut_ptr(),
            output.len() as i32,
        )
    };
    if count < 0 {
        return None;
    }
    output.truncate(count as usize * if mode >= 5 { 2 } else { 6 });
    Some(output)
}
pub fn roots(
    mode: i32,
    objects: &[V3],
    pixels: &[V2],
    camera: &Camera,
    guess: Option<&Pose>,
) -> Vec<Pose> {
    call(mode, objects, pixels, camera, guess)
        .unwrap_or_default()
        .chunks_exact(6)
        .map(|p| Pose {
            rvec: [p[0], p[1], p[2]],
            tvec: [p[3], p[4], p[5]],
        })
        .collect()
}
pub fn project(objects: &[V3], camera: &Camera, pose: &Pose) -> Option<Vec<V2>> {
    Some(
        call(5, objects, &[], camera, Some(pose))?
            .chunks_exact(2)
            .map(|p| [p[0], p[1]])
            .collect(),
    )
}

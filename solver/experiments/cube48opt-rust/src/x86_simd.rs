//! Native x86 dispatch. Detection includes OS support for the vector registers.
//! CUBEOPT_SIMD pins a backend for reproducible same-binary comparisons.
use std::sync::OnceLock;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Backend { Scalar, Avx2, Avx512 }

impl Backend {
    pub fn name(self) -> &'static str {
        match self { Self::Scalar => "scalar", Self::Avx2 => "avx2", Self::Avx512 => "avx512" }
    }
}

fn choose(request: &str, avx2: bool, avx512: bool) -> Result<Backend, String> {
    match request {
        // Wider is not necessarily faster for a 20-byte state. Keep the
        // conservative default; explicit AVX-512 remains available to compare.
        "auto" => Ok(if avx2 { Backend::Avx2 } else { Backend::Scalar }),
        "scalar" => Ok(Backend::Scalar),
        "avx2" if avx2 => Ok(Backend::Avx2),
        "avx512" if avx2 && avx512 => Ok(Backend::Avx512),
        "avx2" | "avx512" => Err(format!("CUBEOPT_SIMD={request} is not supported by this CPU/OS")),
        _ => Err("CUBEOPT_SIMD must be auto, scalar, avx2 or avx512".into()),
    }
}

static BACKEND: OnceLock<Result<Backend, String>> = OnceLock::new();

pub fn initialize() -> Result<Backend, String> {
    selection().clone()
}

fn selection() -> &'static Result<Backend, String> {
    BACKEND.get_or_init(|| {
        let requested = match std::env::var("CUBEOPT_SIMD") {
            Ok(value) => value,
            Err(std::env::VarError::NotPresent) => "auto".into(),
            Err(_) => return Err("CUBEOPT_SIMD is not valid UTF-8".into()),
        };
        choose(&requested, std::is_x86_feature_detected!("avx2"),
            std::is_x86_feature_detected!("avx512f")
                && std::is_x86_feature_detected!("avx512bw")
                && std::is_x86_feature_detected!("avx512vl"))
    })
}

#[inline]
pub(crate) fn selected() -> Backend {
    *selection().as_ref().unwrap_or_else(|error| panic!("{error}"))
}

/// Cube is 20 bytes: load [4,20), discard four corners, zero upper lanes.
#[inline]
pub(crate) unsafe fn edges(cube: &crate::cube::Cube) -> std::arch::x86_64::__m128i {
    use std::arch::x86_64::*;
    _mm_srli_si128::<4>(_mm_loadu_si128((cube as *const crate::cube::Cube).cast::<u8>().add(4).cast()))
}

#[inline]
pub(crate) unsafe fn store_edges(value: std::arch::x86_64::__m128i, cube: &mut crate::cube::Cube) {
    use std::arch::x86_64::*;
    _mm_storel_epi64(cube.edges.as_mut_ptr().cast(), value);
    std::ptr::write_unaligned(cube.edges.as_mut_ptr().add(8).cast::<i32>(),
        _mm_cvtsi128_si32(_mm_srli_si128::<8>(value)));
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn dispatch_never_selects_unavailable_instructions() {
        assert_eq!(choose("auto", false, false).unwrap(), Backend::Scalar);
        assert_eq!(choose("auto", true, false).unwrap(), Backend::Avx2);
        assert_eq!(choose("scalar", true, true).unwrap(), Backend::Scalar);
        assert_eq!(choose("avx512", true, true).unwrap(), Backend::Avx512);
        assert!(choose("avx512", true, false).is_err());
        assert!(choose("avx512", false, true).is_err());
        assert!(choose("avx2", false, false).is_err());
        assert!(choose("typo", true, true).is_err());
    }
}

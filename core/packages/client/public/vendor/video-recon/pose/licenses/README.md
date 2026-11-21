# OpenCV camera kernels

The CPU pipeline uses OpenCV **5.0.0**, matching the installed Python `cv2`
reference. The official tag is
<https://github.com/opencv/opencv/tree/5.0.0>. The solver source snapshots in
this directory retain the IPPE, SQPnP, P3P and AP3P license notices. `LICENSE`
is the upstream OpenCV distribution license.

The build uses the full official source tree outside this repository, selecting
only `core`, `flann` and `geometry`; the linker retains the camera kernels needed
by `tools/opencv-pnp.cpp`. Source snapshots here are provenance/reference files,
not an alternate implementation. No patched solver is substituted.

The generated ES module and WASM remain under ignored `target/`. See
`tools/build-opencv-wasm.py` and the main fitter README for reproducible build
and diagnostic commands. The task-local build used Emscripten 4.0.20, C++17,
release optimization, float contraction disabled, no Eigen/LAPACK/IPP/OpenCL,
and one numerical thread. OpenCV's internal thresholds and iteration budgets
are unchanged.

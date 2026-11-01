// Installed Windows builds should open only the application window.
#![cfg_attr(
    all(target_os = "windows", not(debug_assertions)),
    windows_subsystem = "windows"
)]

fn main() {
    cuberoot_desktop_lib::run();
}

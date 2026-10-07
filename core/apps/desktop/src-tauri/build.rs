fn main() {
    if std::env::var("CARGO_CFG_TARGET_OS").as_deref() == Ok("macos") {
        cc::Build::new()
            .file("src/ble_address.m")
            .file("src/native_print.m")
            .file("src/screen_awake.m")
            .flag("-fobjc-arc")
            .compile("cuberoot_ble_address");
        println!("cargo:rustc-link-lib=framework=CoreBluetooth");
        println!("cargo:rustc-link-lib=framework=Foundation");
        println!("cargo:rustc-link-lib=framework=AppKit");
        println!("cargo:rustc-link-lib=framework=WebKit");
        println!("cargo:rustc-link-lib=framework=IOKit");
        println!("cargo:rerun-if-changed=src/screen_awake.m");
        println!("cargo:rerun-if-changed=src/native_print.m");
        println!("cargo:rerun-if-changed=src/ble_address.m");
    }
    tauri_build::build()
}

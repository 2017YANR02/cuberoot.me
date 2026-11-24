use std::{env, path::PathBuf, process::Command};

fn xcrun(args: &[&str]) -> String {
    let result = Command::new("xcrun").args(args).output().expect("xcrun is required");
    assert!(result.status.success(), "xcrun failed: {}", String::from_utf8_lossy(&result.stderr));
    String::from_utf8(result.stdout).expect("xcrun output").trim().to_owned()
}

fn build_apple_membership() {
    let swiftc = PathBuf::from(xcrun(&["--find", "swiftc"]));
    let sdk = xcrun(&["--sdk", "macosx", "--show-sdk-path"]);
    let arch = match env::var("CARGO_CFG_TARGET_ARCH").as_deref() {
        Ok("aarch64") => "arm64",
        Ok("x86_64") => "x86_64",
        _ => panic!("Unsupported Mac StoreKit architecture"),
    };
    let minimum = env::var("MACOSX_DEPLOYMENT_TARGET").unwrap_or_else(|_| "10.13".into());
    let object = PathBuf::from(env::var_os("OUT_DIR").unwrap()).join("apple_membership.o");
    let status = Command::new(&swiftc)
        .args(["-sdk", &sdk, "-target", &format!("{arch}-apple-macos{minimum}"),
            "-parse-as-library", "-emit-object", "-O", "-module-name", "CubeRootAppleMembership",
            "src/apple_membership.swift", "-o"])
        .arg(&object)
        .status().expect("Swift compiler is required");
    assert!(status.success(), "StoreKit Swift bridge did not compile");

    cc::Build::new().object(object).compile("cuberoot_apple_membership");
    let swift_runtime = swiftc.parent().unwrap().join("../lib/swift/macosx");
    println!("cargo:rustc-link-search=native={}", swift_runtime.display());
    println!("cargo:rustc-link-lib=framework=StoreKit");
    println!("cargo:rustc-link-lib=framework=Security");
    println!("cargo:rustc-link-arg=-Wl,-rpath,/usr/lib/swift");
    println!("cargo:rustc-link-arg=-Wl,-weak-lswiftCore,-weak-lswiftFoundation");
    println!("cargo:rerun-if-env-changed=MACOSX_DEPLOYMENT_TARGET");
    println!("cargo:rerun-if-changed=src/apple_membership.swift");
}

fn main() {
    if std::env::var("CARGO_CFG_TARGET_OS").as_deref() == Ok("macos") {
        cc::Build::new()
            .file("src/ble_address.m")
            .file("src/native_print.m")
            .file("src/web_link.m")
            .file("src/primary_navigation.m")
            .file("src/tools_search.m")
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
        println!("cargo:rerun-if-changed=src/web_link.m");
        println!("cargo:rerun-if-changed=src/primary_navigation.m");
        println!("cargo:rerun-if-changed=src/tools_search.m");
        println!("cargo:rerun-if-changed=src/ble_address.m");
        if env::var_os("CARGO_FEATURE_MAC_APP_STORE").is_some() {
            build_apple_membership();
        }
    }
    tauri_build::build()
}

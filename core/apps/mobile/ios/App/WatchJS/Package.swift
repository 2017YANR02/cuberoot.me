// swift-tools-version: 5.9
import PackageDescription
let package = Package(name: "WatchJS", platforms: [.watchOS(.v10), .macOS(.v13)],
    products: [.library(name: "WatchJS", targets: ["WatchJS"])],
    targets: [.target(name: "WatchJS", exclude: ["vendor/LICENSE"], publicHeadersPath: "include",
        // This is a bytecode interpreter: keep it optimized in device debug
        // builds as well, while leaving the Swift host fully debuggable.
        cSettings: [.define("CONFIG_VERSION", to: "\"2026-06-04\""), .define("_GNU_SOURCE"), .headerSearchPath("vendor"),
                    .unsafeFlags(["-O2"], .when(configuration: .debug))])])

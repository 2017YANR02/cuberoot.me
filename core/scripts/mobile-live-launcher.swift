import AppKit
import Foundation

struct Device: Decodable {
    let id: String
    let name: String
}

struct Target {
    let name: String
    let arguments: [String]
}

struct CommandError: LocalizedError {
    let message: String
    var errorDescription: String? { message }
}

func run(_ arguments: [String]) throws -> Data {
    let process = Process()
    process.executableURL = URL(fileURLWithPath: "/bin/zsh")
    process.arguments = ["-c", #"""
    export PATH="$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
    cd "${CUBEROOT_REPO:-$HOME/Developer/cuberoot.me}/core" || exit 1
    exec node scripts/mobile-ios-live.mjs "$@"
    """#, "cuberoot-mobile-live"] + arguments
    let output = Pipe()
    let errors = Pipe()
    let listing = arguments.first?.hasPrefix("--list-") == true
    process.standardOutput = output
    process.standardError = listing ? errors : output
    try process.run()
    let data = output.fileHandleForReading.readDataToEndOfFile()
    let diagnostics = listing ? errors.fileHandleForReading.readDataToEndOfFile() : data
    process.waitUntilExit()
    if process.terminationStatus != 0 {
        let lines = String(decoding: diagnostics, as: UTF8.self).split(separator: "\n")
        throw CommandError(message: lines.suffix(6).joined(separator: "\n"))
    }
    return data
}

func present(_ alert: NSAlert) -> NSApplication.ModalResponse {
    let app = NSApplication.shared
    app.setActivationPolicy(.accessory)
    app.activate(ignoringOtherApps: true)
    return alert.runModal()
}

func discover(_ mode: String, arguments: String, suffix: String = "") -> [Target] {
    do {
        return try JSONDecoder().decode([Device].self, from: run([mode])).map {
            Target(name: $0.name + suffix, arguments: [arguments, $0.id])
        }
    } catch {
        NSLog("CubeRoot %@: %@", mode, error.localizedDescription)
        return []
    }
}

func choose(_ targets: [Target]) -> Target? {
    guard targets.count > 1 else { return targets.first }
    let alert = NSAlert()
    alert.messageText = "在哪打开 CubeRoot？"
    let picker = NSPopUpButton(frame: NSRect(x: 0, y: 0, width: 310, height: 30))
    var repeatedNames: [String: Int] = [:]
    picker.addItems(withTitles: targets.map { target in
        repeatedNames[target.name, default: 0] += 1
        let count = repeatedNames[target.name, default: 1]
        return count == 1 ? target.name : "\(target.name) \(count)"
    })
    picker.selectItem(at: 0)
    alert.accessoryView = picker
    alert.addButton(withTitle: "打开")
    alert.addButton(withTitle: "取消")
    guard present(alert) == .alertFirstButtonReturn, targets.indices.contains(picker.indexOfSelectedItem) else { return nil }
    return targets[picker.indexOfSelectedItem]
}

let targets = [Target(name: "iPhone Duo 模拟器", arguments: [])]
    + discover("--list-phones", arguments: "--device", suffix: "（iPhone 真机）")
    + discover("--list-android", arguments: "--android")

do {
    if let target = choose(targets) { _ = try run(target.arguments) }
} catch {
    let alert = NSAlert()
    alert.alertStyle = .warning
    alert.messageText = "CubeRoot Dev 未能打开"
    alert.informativeText = error.localizedDescription
    _ = present(alert)
}

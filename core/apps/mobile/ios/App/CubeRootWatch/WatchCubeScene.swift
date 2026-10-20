import SwiftUI
import SceneKit
import Combine
import WatchJS
import CryptoKit

private struct SceneAssets: Decodable {
    struct Geometry: Decodable { let positions: [Float]; let normals: [Float]; let indices: [UInt32] }
    struct Mesh: Decodable { let geometry: Int; let capacity: Int; let color: String; let opacity: CGFloat }
    let geometries: [Geometry]
    let meshes: [Mesh]
}
private struct SceneFrame: Decodable {
    struct Update: Decodable {
        let id: Int
        let matrix: [Float]?
        let count: Int?
        let instances: [Float]?
        let colors: [String]?
    }
    let updates: [Update]
    let active: Bool
    let ready: Bool
    let facelets: String?
    let replay: WatchReplayState?
}

enum ReportValue: Decodable {
    case bool(Bool), number(Double), string(String)
    init(from decoder: Decoder) throws {
        let c = try decoder.singleValueContainer()
        if let value = try? c.decode(Bool.self) { self = .bool(value) }
        else if let value = try? c.decode(Double.self) { self = .number(value) }
        else { self = .string(try c.decode(String.self)) }
    }
    var object: Any { switch self { case .bool(let v): return v; case .number(let v): return v; case .string(let v): return v } }
    var number: Double { if case .number(let v) = self { return v }; return 0 }
    var bool: Bool { if case .bool(let v) = self { return v }; return false }
}
struct ReportAction: Decodable {
    let type: String; var key: String?; var value: ReportValue?; var timeMs: Double?
    var object: [String: Any] {
        var result: [String: Any] = ["type": type]
        if let key { result["key"] = key }; if let value { result["value"] = value.object }; if let timeMs { result["timeMs"] = timeMs }
        return result
    }
}
struct ReportNode: Decodable, Identifiable {
    struct Row: Decodable, Identifiable { let id: String; let label: String; let cells: [ReportNode] }
    struct Token: Decodable { let token: String; let before: ReportAction; let after: ReportAction }
    struct BarSegment: Decodable, Identifiable { let id: String; let fraction: Double; let tone: Int; let label: String }
    struct Option: Decodable { let value: Double; let label: String }
    let id: String; let kind: String
    var text: String?; var className: String?; var layout: String?; var title: String?; var icon: String?
    var children: [ReportNode]?; var action: ReportAction?; var disabled: Bool?; var selected: Bool?
    var value: ReportValue?; var options: [Option]?; var columns: [ReportNode]?; var rows: [Row]?
    var state: String?; var href: String?; var fills: [String]?; var tokens: [Token]?; var segments: [BarSegment]?
}
struct WatchReplayState: Decodable {
    struct Line: Decodable { let label: String; let moves: String; let fromIdx: Int; let toIdx: Int }
    struct Column: Decodable { let key: String }
    struct Stage: Decodable, Identifiable { var id: String { key }; let key: String; let label: String; let fromMs: Double; let toMs: Double; let ms: Double; let timeText: String }
    struct Segment: Decodable, Identifiable { var id: String { key }; let key: String; let pause: Bool; let shade: Int; let fromMs: Double; let toMs: Double }
    struct Effect: Decodable { let id: Int; let type: String; let value: Bool? }
    var document: ReportNode?; let effect: Effect?; let clipboard: String
    let columns: [Column]; let lines: [Line]; let timeline: [Stage]; let timelineSegments: [Segment]
    let shareUrl: String; let timeText: String; let totalText: String
    let timeMs: Double; let totalMs: Double; let index: Int; let count: Int; let playing: Bool
    let stm: Int; let tps: Double; let method: String; let analysisMs: Double; let revision: Int
    let analyzing: Bool; let analysisPending: Bool; let analysisError: String
}

/** Serial, independent renderer runtime: no BLE, timing or persistence callbacks. */
private final class SceneWorker {
    private var engine: OpaquePointer?
    private var replayLoaded = false
    private var cacheVersion = ""
    private var cachedRevision = -1
    deinit { cw_destroy(engine) }
    func evaluate(_ source: String) throws -> String {
        guard let engine else { throw NSError(domain: "WatchScene", code: 1) }
        var failed: Int32 = 0
        guard let value = cw_eval(engine, source, &failed) else { throw NSError(domain: "WatchScene", code: 2) }
        defer { cw_free(value) }
        let text = String(cString: value)
        if failed != 0 { throw NSError(domain: "WatchScene", code: 3, userInfo: [NSLocalizedDescriptionKey: text]) }
        return text
    }
    func load() throws -> SceneAssets? {
        if engine != nil { return nil }
        guard let url = Bundle.main.url(forResource: "WatchScene", withExtension: "js"), let runtime = cw_create_scene() else {
            throw NSError(domain: "WatchScene", code: 4)
        }
        engine = runtime
        _ = try evaluate(String(contentsOf: url, encoding: .utf8))
        return try JSONDecoder().decode(SceneAssets.self, from: Data(evaluate("WatchScene.assets()").utf8))
    }
    func render(_ messages: [[String: Any]]) throws -> [SceneFrame] {
        var frames = try messages.map { message in
            if message["kind"] as? String == "replay-load" { cachedRevision = -1 }
            if message["kind"] as? String == "replay-load", !replayLoaded {
                guard let script = Bundle.main.url(forResource: "WatchReplay", withExtension: "js"),
                      let dataURL = Bundle.main.url(forResource: "WatchAlgData", withExtension: "json") else {
                    throw NSError(domain: "WatchReplay", code: 1)
                }
                _ = try evaluate(String(contentsOf: script, encoding: .utf8))
                let data = try String(contentsOf: dataURL, encoding: .utf8)
                let metadata = try JSONSerialization.jsonObject(with: Data(data.utf8)) as? [String: Any]
                guard let version = metadata?["analysisVersion"] as? String else { throw NSError(domain: "WatchReplayCacheVersion", code: 1) }
                cacheVersion = version
                _ = try evaluate("WatchReplay.configureOffline(\(data))")
                if let url = try? WatchTimerDisk.url("watch-replay-cache.json"), let bytes = try? Data(contentsOf: url),
                   let saved = try? JSONSerialization.jsonObject(with: bytes) as? [String: Any],
                   saved["version"] as? String == cacheVersion, let cache = saved["cache"],
                   let json = try? JSONSerialization.data(withJSONObject: cache) {
                    _ = try? evaluate("WatchReplay.importCache(\(String(decoding: json, as: UTF8.self)))")
                }
                replayLoaded = true
            }
            let data = try JSONSerialization.data(withJSONObject: message)
            let json = String(decoding: data, as: UTF8.self)
            return try JSONDecoder().decode(SceneFrame.self, from: Data(evaluate("WatchScene.dispatch(\(json))").utf8))
        }
        // QuickJS has no host event loop. Drain analysis in bounded worker
        // slices, independent of SceneKit/AOD's display refresh frequency.
        if frames.last?.replay?.analysisPending == true {
            let deadline = ProcessInfo.processInfo.systemUptime + 0.016
            repeat {
                try supplyAlgorithms()
                if try evaluate("WatchReplay.tick(); String(WatchScene.analysisPending())") == "false" { break }
            } while ProcessInfo.processInfo.systemUptime < deadline
            let now = messages.last?["now"] as? Double ?? 0
            frames.append(try JSONDecoder().decode(SceneFrame.self,
                from: Data(evaluate("WatchScene.dispatch({kind:'frame',now:\(now)})").utf8)))
        }
        if let replay = frames.last?.replay, !replay.analysisPending, replay.analysisError.isEmpty, replay.revision != cachedRevision {
            let cache = try? evaluate("WatchReplay.exportCache()")
            if let cache, let url = try? WatchTimerDisk.url("watch-replay-cache.json") {
                try? Data("{\"version\":\"\(cacheVersion)\",\"cache\":\(cache)}".utf8).write(to: url, options: .atomic)
                cachedRevision = replay.revision
            }
        }
        return frames
    }
    private func supplyAlgorithms() throws {
        let requests = try JSONDecoder().decode([String].self, from: Data(evaluate("WatchReplay.requests()").utf8))
        for key in requests {
            let set = String(key.split(separator: "/").last ?? "")
            let allowed = ["oll", "pll", "zbll", "ollcp", "1lll", "coll", "ell", "zbls", "vls", "wv", "sv", "cmll"]
            let url = allowed.contains(set) ? Bundle.main.url(forResource: set, withExtension: "json", subdirectory: "WatchAlgorithms") : nil
            let contents = try url.map { try String(contentsOf: $0, encoding: .utf8) } ?? "null"
            let keyJSON = String(decoding: try JSONEncoder().encode(key), as: UTF8.self)
            _ = try evaluate("WatchReplay.provideAlgorithm(\(keyJSON),\(contents))")
        }
    }
}

/** Generic SceneKit mesh adapter. Cube turns and geometry are never implemented in Swift. */
final class WatchCubeScene: ObservableObject {
    let scene = SCNScene()
    let camera = SCNNode()
    @Published private(set) var ready = false
    @Published private(set) var failed = false
    @Published private(set) var replay: WatchReplayState?
    private let queue = DispatchQueue(label: "me.cuberoot.watch.scene", qos: .userInitiated)
    private var worker = SceneWorker()
    private var groups: [SCNNode] = []
    private var pending: [[String: Any]] = []
    private var gyro: [String: Any]?
    private var calibration: [String: Any]?
    private var snapshot: [String: Any]?
    private var running = false, inFlight = false, visible = false, replayVisible = false, awake = true, reportForeground = true
    private var revision = 0, frames = 0, moves = 0
    private var expected = "", displayed = "", detail = ""
    private var ticker: AnyCancellable?
    private var baseNow = 0.0
    private var baseInstant = ContinuousClock.now
    private var diagnosticAt = 0.0
    private var renderedAt = -Double.infinity

    init() {
        scene.background.contents = UIColor.clear
        camera.camera = SCNCamera()
        camera.camera?.fieldOfView = CGFloat(2 * atan(1.0 / 5) * 180 / .pi)
        camera.camera?.zNear = 1
        camera.camera?.zFar = 2048
        camera.position = SCNVector3(0, 0, 960)
        scene.rootNode.addChildNode(camera)
        let ambient = SCNNode(); ambient.light = SCNLight(); ambient.light?.type = .ambient
        ambient.light?.intensity = 750
        scene.rootNode.addChildNode(ambient)
        let light = SCNNode(); light.light = SCNLight(); light.light?.type = .directional
        light.light?.intensity = 400; light.position = SCNVector3(64, 192, 128)
        light.look(at: SCNVector3Zero)
        scene.rootNode.addChildNode(light)
        ticker = Timer.publish(every: 1.0 / 30, on: .main, in: .common).autoconnect()
            .sink { [weak self] _ in self?.render(); self?.diagnose() }
    }
    private var now: Double {
        let d = baseInstant.duration(to: .now).components
        return baseNow + Double(d.seconds) * 1000 + Double(d.attoseconds) / 1e15
    }
    func receive(_ event: [String: Any], now: Double) {
        baseNow = now; baseInstant = .now
        if let facelets = event["facelets"] as? String { expected = facelets }
        if event["kind"] as? String == "replay-load", let replay,
           let record = event["record"] as? [String: Any], let old = snapshot?["record"] as? [String: Any],
           record["id"] as? String == old["id"] as? String { return }
        var message = event; message["now"] = now
        if event["kind"] as? String == "gyro" { gyro = message }
        else if event["kind"] as? String == "gyro-reset" { calibration = message; gyro = nil }
        else if (event["kind"] as? String)?.hasPrefix("replay-") == true {
            pending.append(message)
            if event["kind"] as? String == "replay-load" { snapshot = message }
        }
        else {
            snapshot = ["kind": "snapshot", "facelets": expected, "now": now]
            if event["kind"] as? String == "snapshot" { pending = [message] }
            else { pending.append(message); moves += 1 }
            // Display-only backlog collapses to the latest authoritative state.
            if pending.count > 64, let snapshot { pending = [snapshot] }
        }
        render()
    }
    func command(_ event: [String: Any]) { receive(event, now: now) }
    func setVisible(_ value: Bool) { visible = value; render(); diagnose(force: true) }
    // The report owns analysis lifetime; scrolling its cube out of view must
    // not pause shared asynchronous builders waiting for the next host tick.
    func setReplayVisible(_ value: Bool) { replayVisible = value; render(); diagnose(force: true) }
    func setAwake(_ value: Bool, foreground: Bool = true) {
        awake = value; reportForeground = foreground
        let isReplay = snapshot?["kind"] as? String == "replay-load"
        if value, !isReplay, let snapshot { pending = [snapshot] }
        if !value, isReplay { command(["kind": "replay-pause"]) }
        render()
    }
    func clear() {
        revision += 1; ready = false; failed = false; running = false
        pending = []; gyro = nil; calibration = nil; snapshot = nil; expected = ""; displayed = ""; detail = ""
        renderedAt = -Double.infinity
        groups.forEach { $0.removeFromParentNode() }; groups = []
        // Release each QuickJS context on the same serial executor that used it.
        let old = worker; worker = SceneWorker(); queue.async { _ = old }
    }
    private func render() {
        // Inactive/AOD is still a foreground report. Pause its animation, but
        // finish shared analysis even while the user reads the lower sections.
        let reportWork = replayVisible && reportForeground && (replay?.analysisPending == true || !pending.isEmpty)
        guard ((visible || replayVisible) && awake) || reportWork,
              !failed, !inFlight, snapshot != nil,
              running || !pending.isEmpty || gyro != nil || calibration != nil else { return }
        guard reportWork || now - renderedAt >= 1000.0 / 30 else { return }
        renderedAt = now
        inFlight = true
        let current = revision, worker = worker, time = now
        var messages = pending; pending = []
        if let calibration { messages.append(calibration); self.calibration = nil }
        if let gyro { messages.append(gyro); self.gyro = nil }
        messages.append(["kind": "frame", "now": time])
        queue.async { [weak self] in
            let result = Result { (try worker.load(), try worker.render(messages)) }
            DispatchQueue.main.async {
                guard let self else { return }
                self.inFlight = false
                guard current == self.revision else { self.render(); return }
                switch result {
                case .success(let (assets, frames)):
                    if let assets { self.install(assets) }
                    for frame in frames { self.apply(frame) }
                case .failure(let error):
                    self.failed = true; self.ready = false; self.detail = String(error.localizedDescription.prefix(500))
                }
                self.diagnose()
                // Continue the worker after yielding to UI/lifecycle events;
                // do not wait for a display timer throttled by Always On.
                if self.replayVisible && self.reportForeground && self.replay?.analysisPending == true && !self.failed {
                    DispatchQueue.main.async { [weak self] in self?.render() }
                }
            }
        }
    }
    private func bytes<T>(_ values: [T]) -> Data { values.withUnsafeBytes { Data($0) } }
    private func install(_ assets: SceneAssets) {
        let geometries = assets.geometries.map { item -> SCNGeometry in
            let positions = SCNGeometrySource(data: bytes(item.positions), semantic: .vertex,
                vectorCount: item.positions.count / 3, usesFloatComponents: true, componentsPerVector: 3,
                bytesPerComponent: 4, dataOffset: 0, dataStride: 12)
            let normals = SCNGeometrySource(data: bytes(item.normals), semantic: .normal,
                vectorCount: item.normals.count / 3, usesFloatComponents: true, componentsPerVector: 3,
                bytesPerComponent: 4, dataOffset: 0, dataStride: 12)
            let indices = SCNGeometryElement(data: bytes(item.indices), primitiveType: .triangles,
                primitiveCount: item.indices.count / 3, bytesPerIndex: 4)
            return SCNGeometry(sources: [positions, normals], elements: [indices])
        }
        for mesh in assets.meshes {
            let group = SCNNode()
            for _ in 0..<mesh.capacity {
                let geometry = geometries[mesh.geometry].copy() as! SCNGeometry
                let material = SCNMaterial(); material.lightingModel = .lambert
                material.diffuse.contents = color(mesh.color); material.transparency = mesh.opacity
                geometry.materials = [material]
                let node = SCNNode(geometry: geometry); node.isHidden = true
                group.addChildNode(node)
            }
            groups.append(group); scene.rootNode.addChildNode(group)
        }
    }
    private func matrix(_ values: ArraySlice<Float>) -> SCNMatrix4 {
        let v = Array(values)
        return SCNMatrix4(simd_float4x4(SIMD4(v[0],v[1],v[2],v[3]), SIMD4(v[4],v[5],v[6],v[7]),
            SIMD4(v[8],v[9],v[10],v[11]), SIMD4(v[12],v[13],v[14],v[15])))
    }
    private func color(_ hex: String) -> UIColor {
        let rgb = UInt32(hex, radix: 16) ?? 0
        return UIColor(red: CGFloat((rgb >> 16) & 255) / 255,
            green: CGFloat((rgb >> 8) & 255) / 255, blue: CGFloat(rgb & 255) / 255, alpha: 1)
    }
    private func apply(_ frame: SceneFrame) {
        if var replay = frame.replay {
            if replay.document == nil { replay.document = self.replay?.document }
            self.replay = replay
        }
        SCNTransaction.begin(); SCNTransaction.animationDuration = 0
        for update in frame.updates {
            guard groups.indices.contains(update.id) else { continue }
            let group = groups[update.id]
            if let value = update.matrix, value.count == 16 { group.transform = matrix(value[...]) }
            if let count = update.count, let values = update.instances {
                for (index, node) in group.childNodes.enumerated() {
                    node.isHidden = index >= count
                    if index < count, values.count >= (index + 1) * 16 {
                        node.transform = matrix(values[index * 16..<(index + 1) * 16])
                    }
                }
            }
            if let colors = update.colors {
                for (index, node) in group.childNodes.enumerated() where index < colors.count {
                    node.geometry?.firstMaterial?.diffuse.contents = color(colors[index])
                }
            }
        }
        SCNTransaction.commit()
        if ready != frame.ready { ready = frame.ready }
        running = frame.active; frames += 1
        if let facelets = frame.facelets { displayed = facelets }
    }
    private func diagnose(force: Bool = false) {
        guard force || now - diagnosticAt > 1000 else { return }
        diagnosticAt = now
        var value: [String: Any] = ["ready": ready, "failed": failed, "detail": detail,
            "frames": frames, "moves": moves, "expected": expected, "displayed": displayed,
            "visible": visible, "replayVisible": replayVisible, "awake": awake,
            "inFlight": inFlight, "running": running, "reportForeground": reportForeground, "now": now, "lastRender": renderedAt.isFinite ? renderedAt : -1,
            "settledMatches": !running && expected == displayed]
        if let replay { value["replayIndex"] = replay.index; value["replayCount"] = replay.count; value["playing"] = replay.playing
            value["analysisMs"] = replay.analysisMs; value["stm"] = replay.stm; value["tps"] = replay.tps; value["columns"] = replay.columns.count; value["method"] = replay.method; value["analyzing"] = replay.analyzing
            value["reportSections"] = replay.document?.children?.map { $0.id }; value["sharedReport"] = true
            value["analysisError"] = replay.analysisError; value["analysisPending"] = replay.analysisPending
            value["lines"] = replay.lines.map { ["label": $0.label, "moves": $0.moves, "fromIdx": $0.fromIdx, "toIdx": $0.toIdx] as [String: Any] }
        }
        if let data = try? JSONSerialization.data(withJSONObject: value),
           let url = try? WatchTimerDisk.url(replay == nil ? "watch-scene-status.json" : "watch-replay-status.json") { try? data.write(to: url, options: .atomic) }
    }
}

struct WatchLiveCubeView: View {
    @ObservedObject var display: WatchCubeScene
    let language: String
    var height: CGFloat = 150
    var isStatic = false
    var body: some View {
        Group {
            if display.failed {
                Text(language == "zh" ? "三维视图加载失败。计时仍可使用。" : "3D view unavailable. Timing is still available.")
                    .font(.caption)
            } else {
                SceneView(scene: display.scene, pointOfView: display.camera, preferredFramesPerSecond: isStatic ? 1 : 30)
                    .opacity(display.ready ? 1 : 0)
                    .accessibilityLabel(isStatic ? WatchCopy.text("preview", language: language) : language == "zh" ? "智能魔方实时三维状态" : "Live 3D smart-cube state")
            }
        }
        .frame(height: height).allowsHitTesting(false)
        .onAppear { display.setVisible(true) }
        .onDisappear { display.setVisible(false) }
    }
}

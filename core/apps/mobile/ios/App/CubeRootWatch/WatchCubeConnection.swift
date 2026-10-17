import Foundation
import Combine
import CoreBluetooth
import WatchJS

/** watchOS transport only; the bundled iOS/shared JS owns GAN and timing rules. */
final class WatchCubeConnection: NSObject, ObservableObject, CBCentralManagerDelegate, CBPeripheralDelegate {
    struct Device: Identifiable { let id: UUID; let name: String }
    struct ScrambleGuidance: Decodable {
        struct Hint: Decodable { let done: [String]; let current: String?; let pending: [String] }
        let contextId: String
        let matched: Bool?
        let hint: Hint?
    }
    @Published var guidance: ScrambleGuidance?
    @Published var phase = "idle"
    @Published var devices: [Device] = []
    @Published var name = ""
    @Published var lastMove = ""
    @Published var battery: Int?
    @Published var error = ""
    @Published var resetPhase = "idle"
    @Published var timingLate = false
    @Published var canReset = true
    @Published var macPrompt = false
    @Published var macInput = ""
    @Published var macInvalid = false
    private var pendingMac: Int?
    private var selectedDeviceID = ""
    private var suppliedMac: String?
    let display = WatchCubeScene()
    var onTimer: (([String: Any]) -> Void)?
    var onFailure: (() -> Void)?
    private var central: CBCentralManager!
    private let bluetoothQueue = DispatchQueue(label: "me.cuberoot.watch.bluetooth", qos: .userInitiated)
    private var peripherals: [UUID: CBPeripheral] = [:]
    private var advertisements: [UUID: Data] = [:]
    private var peripheral: CBPeripheral?
    private var characteristics: [CBUUID: [CBUUID: CBCharacteristic]] = [:]
    private var pendingServices = Set<CBUUID>()
    private var pendingConnect: Int?
    private var pendingDisconnect: Int?
    private var pendingWrites: [String: Int] = [:]
    private var pendingNotify: [String: Int] = [:]
    private var pendingReads: [String: Int] = [:]
    private var context: OpaquePointer?
    private var ticker: AnyCancellable?
    private var contextKey = ""
    private var connectDeadline: Date?
    private var scanWanted = false
    private var scanDeadline: Date?
    private var handling = false
    private var moves = 0
    private var stage = "idle"
    private var failureDetail = ""
    private var receivedFrames = 0
    private var protocolStatus: [String: Any] = [:]
    private var trace: [[String: Any]] = []
    private var attemptTiming: [[String: Any]] = []
    private var manufacturerBytes = 0
    private var manufacturerHeader: [Int] = []
    private var ticks = 0
    private var ready = false
    private var evaluateMaxMs = 0.0, drainMaxMs = 0.0
    private var slowDispatches: [[String: Any]] = []
    private var sceneState = "active"
    private var lifecycle: [[String: Any]] = []
    private var callbackQueueDelayMaxMs = 0.0, tickGapMaxMs = 0.0
    private var lastTickAt: Double?
    private var tickGaps: [[String: Any]] = []
    var available: Bool { ready }
    private var lastDiagnostic = Data()
    private let clock = ContinuousClock()
    private let clockOrigin = ContinuousClock.now

    override init() {
        super.init()
        do {
            guard let url = Bundle.main.url(forResource: "WatchCube", withExtension: "js"),
                  let engine = cw_create() else {
                throw NSError(domain: "WatchCube", code: 1)
            }
            context = engine
            _ = try evaluate(String(contentsOf: url, encoding: .utf8))
            ready = true
        } catch { runtimeFailed(error) }
        // Instantiate Bluetooth lazily, when the user opens the device picker.
        ticker = Timer.publish(every: 0.1, on: .main, in: .common).autoconnect().sink { [weak self] _ in self?.tick() }
    }
    deinit { cw_destroy(context) }
    private func evaluate(_ source: String) throws -> String {
        let began = now
        defer { evaluateMaxMs = max(evaluateMaxMs, now - began) }
        guard let context else { throw NSError(domain: "WatchCube", code: 2) }
        var failed: Int32 = 0
        guard let value = cw_eval(context, source, &failed) else { throw NSError(domain: "WatchCube", code: 3) }
        defer { cw_free(value) }
        let result = String(cString: value)
        if failed != 0 { throw NSError(domain: "WatchCube", code: 4, userInfo: [NSLocalizedDescriptionKey: result]) }
        return result
    }
    private var now: Double {
        let duration = clockOrigin.duration(to: clock.now).components
        return Double(duration.seconds) * 1000 + Double(duration.attoseconds) / 1e15
    }
    func scan() {
        guard ready else { error = "runtime"; return }
        guard peripheral == nil, phase != "connecting" else { return }
        error = ""; scanWanted = true; devices = []
        if central == nil { central = CBCentralManager(delegate: self, queue: bluetoothQueue) }
        else { startScanIfReady() }
    }
    func stopScan() { scanWanted = false; scanDeadline = nil; central?.stopScan(); if phase == "scanning" { phase = "idle" } }
    private func startScanIfReady() {
        guard scanWanted, central.state == .poweredOn else { return }
        phase = "scanning"
        scanDeadline = Date().addingTimeInterval(20)
        central.scanForPeripherals(withServices: nil, options: [CBCentralManagerScanOptionAllowDuplicatesKey: true])
    }
    func select(_ id: UUID) {
        guard let selected = peripherals[id], peripheral == nil, phase != "connecting" else { return }
        display.clear()
        stopScan(); phase = "connecting"; name = devices.first(where: { $0.id == id })?.name ?? selected.name ?? "GAN"; error = ""
        moves = 0; lastMove = ""; battery = nil; failureDetail = ""; receivedFrames = 0; protocolStatus = [:]
        timingLate = false; evaluateMaxMs = 0; drainMaxMs = 0; slowDispatches = []
        callbackQueueDelayMaxMs = 0; tickGapMaxMs = 0; tickGaps = []; lastTickAt = now
        trace = []
        let data = advertisements[id] ?? Data()
        manufacturerBytes = data.count; manufacturerHeader = data.prefix(4).map(Int.init); stage = "resolve-device"
        var manufacturer: [[Any]] = []
        if data.count >= 2 { manufacturer = [[Int(data[0]) | Int(data[1]) << 8, Array(data.dropFirst(2)).map(Int.init)]] }
        selectedDeviceID = id.uuidString; suppliedMac = nil; canReset = true
        var device: [String: Any] = ["id": id.uuidString, "name": name, "manufacturerData": manufacturer]
        if let cached = UserDefaults.standard.string(forKey: "cubeMac." + selectedDeviceID) { device["macAddress"] = cached }
        connectDeadline = Date().addingTimeInterval(20)
        send(["kind": "connect", "device": device])
    }
    func disconnect() { guidance = nil; pendingMac = nil; macPrompt = false; display.clear(); stopScan(); send(["kind": "disconnect"]); phase = "idle"; connectDeadline = nil }
    func submitMac() {
        guard let id = pendingMac else { return }
        do {
            let json = String(decoding: try JSONSerialization.data(withJSONObject: [macInput]), as: UTF8.self)
            let normalized = try evaluate("JSON.stringify(WatchCube.normalizeMac(\(json)[0]))")
            guard let value = try JSONSerialization.jsonObject(with: Data(normalized.utf8), options: .fragmentsAllowed) as? String else { macInvalid = true; return }
            suppliedMac = value; pendingMac = nil; macPrompt = false; macInvalid = false
            connectDeadline = Date().addingTimeInterval(20); reply(id, value: value)
        } catch { macInvalid = true }
    }
    func cancelMac() { reply(pendingMac); pendingMac = nil; macPrompt = false; disconnect() }
    struct ScramblePreview: Decodable {
        struct Cell: Decodable { let x: Double; let y: Double; let color: [Double] }
        let width: Double; let height: Double; let stroke: Double; let cells: [Cell]
    }
    func scramblePreview(_ facelets: String) -> ScramblePreview? {
        do {
            let encoded = try JSONSerialization.data(withJSONObject: [facelets])
            let json = try evaluate("WatchCube.scramblePreview(\(String(decoding: encoded, as: UTF8.self))[0])")
            let preview = try JSONDecoder().decode(ScramblePreview.self, from: Data(json.utf8))
            if let url = try? WatchTimerDisk.url("watch-scramble-preview-status.json"),
               let data = try? JSONSerialization.data(withJSONObject: ["cells": preview.cells.count,
                   "width": preview.width, "height": preview.height, "at": Date().timeIntervalSince1970]) {
                try? data.write(to: url, options: .atomic)
            }
            return preview
        } catch {
            if let url = try? WatchTimerDisk.url("watch-scramble-preview-status.json"),
               let data = try? JSONSerialization.data(withJSONObject: ["error": error.localizedDescription,
                   "at": Date().timeIntervalSince1970]) { try? data.write(to: url, options: .atomic) }
            return nil
        }
    }
    func tap() { send(["kind": "tap"]) }
    func resetCube() {
        guard canReset, phase == "connected", resetPhase != "pending" else { return }
        timingLate = false; send(["kind": "reset"])
    }
    func cancel() { send(["kind": "cancel"]) }
    func sceneChanged(_ state: String) {
        sceneState = state
        lifecycle.append(["state": state, "now": now, "frames": receivedFrames])
        if lifecycle.count > 32 { lifecycle.removeFirst() }
        persistDiagnostic()
    }
    func setContext(_ slot: WatchTimerSlot?, enabled: Bool) {
        let key = "\(slot?.id ?? ""):\(enabled)"
        guard contextKey != key else { return }; contextKey = key; guidance = nil
        send(["kind": "context", "id": slot?.id ?? "", "event": slot?.event ?? "333",
              "scramble": slot?.scramble ?? "", "inspectionSec": slot?.inspectionSec ?? 0, "enabled": enabled])
    }
    private func send(_ message: [String: Any]) {
        guard context != nil, ready else { return }
        let began = now
        defer {
            let elapsed = now - began
            if elapsed > 50 {
                slowDispatches.append(["kind": message["kind"] ?? "", "now": began, "ms": elapsed])
                if slowDispatches.count > 20 { slowDispatches.removeFirst() }
            }
        }
        var value = message; value["now"] = now
        do {
            let json = String(decoding: try JSONSerialization.data(withJSONObject: value), as: UTF8.self)
            _ = try evaluate("WatchCube.dispatch(\(json));")
            DispatchQueue.main.async { [weak self] in self?.tick() }
        } catch { runtimeFailed(error) }
    }
    private func runtimeFailed(_ cause: Error) {
        display.clear()
        failureDetail = String(cause.localizedDescription.prefix(1000))
        error = "runtime"; ready = false; phase = "error"; resetPhase = "idle"; onFailure?()
        persistDiagnostic()
        if let peripheral { central?.cancelPeripheralConnection(peripheral) }
    }
    private func reply(_ id: Int?, value: Any = NSNull(), error: String? = nil) {
        guard let id else { return }
        var message: [String: Any] = ["kind": "reply", "id": id, "value": value]
        if let error { message["error"] = error; failureDetail = error }
        send(message)
    }
    private func tick() {
        let time = now
        if let previous = lastTickAt {
            let gap = time - previous
            tickGapMaxMs = max(tickGapMaxMs, gap)
            if gap > 500 {
                tickGaps.append(["from": previous, "to": time, "ms": gap, "scene": sceneState])
                if tickGaps.count > 16 { tickGaps.removeFirst() }
            }
        }
        lastTickAt = time
        if let deadline = scanDeadline, Date() >= deadline { stopScan() }
        if let deadline = connectDeadline, Date() >= deadline {
            failureDetail = "Handshake timeout at \(stage)"
            disconnect(); phase = "error"; error = "connection"
        }
        guard ready, !handling, context != nil else { return }
        let began = now
        handling = true; defer { handling = false; drainMaxMs = max(drainMaxMs, now - began) }
        do {
            _ = try evaluate("WatchCube.dispatch({kind:'clock',now:\(now)});")
            let text = try evaluate("WatchCube.drain()")
            let events = try JSONSerialization.jsonObject(with: Data(text.utf8)) as? [[String: Any]] ?? []
            var finishedAttempt = false
            for event in events {
                switch event["kind"] as? String {
                case "native": native(event)
                case "verified-mac":
                    if let mac = event["mac"] as? String {
                        suppliedMac = mac
                        UserDefaults.standard.set(mac, forKey: "cubeMac." + selectedDeviceID)
                    }
                case "connection":
                    phase = event["phase"] as? String ?? "error"
                    if let name = event["name"] as? String { self.name = name }
                    if let value = event["canReset"] as? Bool { canReset = value }
                    if phase == "connected" {
                        connectDeadline = nil
                        if let suppliedMac { UserDefaults.standard.set(suppliedMac, forKey: "cubeMac." + selectedDeviceID) }
                    }
                    if phase == "idle" || phase == "error" { guidance = nil; display.clear(); macPrompt = false; pendingMac = nil }
                    if phase == "error" {
                        error = "connection"; connectDeadline = nil
                        UserDefaults.standard.removeObject(forKey: "cubeMac." + selectedDeviceID)
                        if let message = event["message"] as? String { failureDetail = message }
                    }
                case "guidance":
                    if let data = try? JSONSerialization.data(withJSONObject: event) {
                        guidance = try? JSONDecoder().decode(ScrambleGuidance.self, from: data)
                    }
                case "move":
                    if let move = event["move"] as? String { lastMove = move; moves += 1 }
                    display.receive(event, now: now)
                case "snapshot", "gyro", "gyro-reset": display.receive(event, now: now)
                case "reset":
                    resetPhase = event["phase"] as? String ?? "failed"
                    if let message = event["message"] as? String { failureDetail = message }
                case "status":
                    let nextBattery = event["battery"] as? Int
                    if battery != nextBattery { battery = nextBattery }
                    protocolStatus = event
                    if let value = event["canReset"] as? Bool { canReset = value }
                case "timing-late": timingLate = true
                case "diagnostic":
                    trace.append(event)
                    if event["event"] as? String == "clock" { attemptTiming.append(event) }
                case "timer":
                    let recording = event["recording"] as? [String: Any]
                    let timing: [String: Any] = ["event": "timer", "phase": event["phase"] ?? "", "now": event["nowMs"] ?? now,
                        "startedAt": event["startedAtMs"] ?? NSNull(), "solve": event["solve"] ?? NSNull(),
                        "recordedMoves": (recording?["moves"] as? [Any])?.count ?? 0]
                    trace.append(timing)
                    let effects = event["effects"] as? [String] ?? []
                    if event["phase"] as? String == "ready" || effects.contains("run-started") { timingLate = false }
                    if effects.contains("run-started") { attemptTiming = [] }
                    attemptTiming.append(timing)
                    if effects.contains("run-stopped") { finishedAttempt = true }
                    onTimer?(event)
                default: break
                }
            }
            if trace.count > 256 { trace.removeFirst(trace.count - 256) }
            if attemptTiming.count > 1024 { attemptTiming.removeFirst(attemptTiming.count - 1024) }
            if finishedAttempt,
               let data = try? JSONSerialization.data(withJSONObject: attemptTiming, options: .sortedKeys),
               let url = try? WatchTimerDisk.url("watch-last-attempt-timing.json") {
                // Snapshot after draining so the final move's mapped time is included.
                try? data.write(to: url, options: .atomic)
            }
            ticks += 1
            if ticks % 10 == 0 { persistDiagnostic() }
        } catch { runtimeFailed(error) }
    }
    private func persistDiagnostic() {
                let snapshot: [String: Any] = ["phase": phase, "name": name, "lastMove": lastMove,
                    "moves": moves, "battery": battery ?? -1, "error": error, "stage": stage, "reset": resetPhase,
                    "detail": failureDetail, "frames": receivedFrames, "manufacturerBytes": manufacturerBytes,
                    "manufacturerHeader": manufacturerHeader, "protocol": protocolStatus, "trace": trace,
                    "timingLate": timingLate, "evaluateMaxMs": evaluateMaxMs, "drainMaxMs": drainMaxMs,
                    "slowDispatches": slowDispatches, "sceneState": sceneState, "lifecycle": lifecycle,
                    "callbackQueueDelayMaxMs": callbackQueueDelayMaxMs, "tickGapMaxMs": tickGapMaxMs,
                    "tickGaps": tickGaps]
                if let data = try? JSONSerialization.data(withJSONObject: snapshot, options: .sortedKeys), data != lastDiagnostic,
                   let url = try? WatchTimerDisk.url("watch-cube-status.json") {
                    // Diagnostics must never terminate a valid timer or BLE session.
                    if (try? data.write(to: url, options: .atomic)) != nil { lastDiagnostic = data }
                }
    }
    private func fullUUID(_ uuid: CBUUID) -> String {
        let value = uuid.uuidString.lowercased()
        if value.count == 4 { return "0000" + value + "-0000-1000-8000-00805f9b34fb" }
        if value.count == 8 { return value + "-0000-1000-8000-00805f9b34fb" }
        return value
    }
    private func characteristicKey(_ characteristic: CBCharacteristic) -> String {
        fullUUID(characteristic.service?.uuid ?? CBUUID(string: "0000")) + "/" + fullUUID(characteristic.uuid)
    }
    private func native(_ command: [String: Any]) {
        let id = command["id"] as? Int
        stage = command["op"] as? String ?? "unknown"
        switch command["op"] as? String {
        case "needMac":
            pendingMac = id; macPrompt = true; macInput = ""; macInvalid = false; connectDeadline = nil
        case "getServices":
            let services: [[String: Any]] = characteristics.map { service, values in
                ["uuid": fullUUID(service), "characteristics": values.values.map { characteristic -> [String: Any] in
                    let properties = characteristic.properties
                    return ["uuid": fullUUID(characteristic.uuid), "properties": [
                        "notify": properties.contains(.notify), "indicate": properties.contains(.indicate),
                        "read": properties.contains(.read), "write": properties.contains(.write),
                        "writeWithoutResponse": properties.contains(.writeWithoutResponse)]]
                }]
            }
            reply(id, value: services)
        case "connect":
            guard let raw = command["device"] as? String, let uuid = UUID(uuidString: raw), let found = peripherals[uuid] else {
                reply(id, error: "Device unavailable"); return
            }
            peripheral = found; found.delegate = self; characteristics = [:]; pendingServices = []; pendingConnect = id
            central.connect(found)
        case "disconnect":
            if let peripheral, peripheral.state != .disconnected {
                pendingDisconnect = id; central.cancelPeripheralConnection(peripheral)
            } else { self.peripheral = nil; reply(id) }
        default:
            let key = CBUUID(string: command["characteristic"] as? String ?? "0000")
            let service = CBUUID(string: command["service"] as? String ?? "0000")
            guard let characteristic = characteristics[service]?[key], let peripheral, peripheral.state == .connected else {
                reply(id, error: "Characteristic unavailable"); return
            }
            let address = characteristicKey(characteristic)
            switch command["op"] as? String {
            case "subscribe", "unsubscribe":
                pendingNotify[address] = id; peripheral.setNotifyValue(command["op"] as? String == "subscribe", for: characteristic)
            case "write":
                let data = Data((command["bytes"] as? [Int] ?? []).map { UInt8(truncatingIfNeeded: $0) })
                if characteristic.properties.contains(.write) {
                    pendingWrites[address] = id; peripheral.writeValue(data, for: characteristic, type: .withResponse)
                } else if characteristic.properties.contains(.writeWithoutResponse), peripheral.canSendWriteWithoutResponse {
                    peripheral.writeValue(data, for: characteristic, type: .withoutResponse); reply(id)
                } else { reply(id, error: "Write unavailable") }
            case "read": pendingReads[address] = id; peripheral.readValue(for: characteristic)
            default: reply(id, error: "Unsupported operation")
            }
        }
    }
    // Keep Bluetooth delivery independent of SwiftUI/SceneKit. Mutable app and
    // JS state still has a single owner (main); notification bytes are copied
    // on the Bluetooth executor BEFORE another callback can replace the value.
    private func forwardToMain(_ action: @escaping () -> Void) -> Bool {
        guard !Thread.isMainThread else { return false }
        DispatchQueue.main.async(execute: action)
        return true
    }
    func centralManagerDidUpdateState(_ central: CBCentralManager) {
        if forwardToMain({ self.centralManagerDidUpdateState(central) }) { return }
        if central.state == .poweredOn { startScanIfReady() }
        else if central.state != .unknown {
            if let peripheral { centralManager(central, didDisconnectPeripheral: peripheral, error: nil) }
            stopScan(); phase = "error"; error = "bluetooth"
        }
    }
    func centralManager(_ central: CBCentralManager, didDiscover peripheral: CBPeripheral, advertisementData: [String: Any], rssi RSSI: NSNumber) {
        if forwardToMain({ self.centralManager(central, didDiscover: peripheral, advertisementData: advertisementData, rssi: RSSI) }) { return }
        let name = peripheral.name ?? advertisementData[CBAdvertisementDataLocalNameKey] as? String ?? ""
        guard let json = try? JSONSerialization.data(withJSONObject: [name]),
              (try? evaluate("WatchCube.supportsDevice(\(String(decoding: json, as: UTF8.self))[0])")) == "true" else { return }
        peripherals[peripheral.identifier] = peripheral
        if let data = advertisementData[CBAdvertisementDataManufacturerDataKey] as? Data, data.count >= 8 {
            advertisements[peripheral.identifier] = data
        }
        if !devices.contains(where: { $0.id == peripheral.identifier }) { devices.append(Device(id: peripheral.identifier, name: name)) }
    }
    func centralManager(_ central: CBCentralManager, didConnect peripheral: CBPeripheral) {
        if forwardToMain({ self.centralManager(central, didConnect: peripheral) }) { return }
        guard self.peripheral === peripheral else { return }; stage = "discover-services"; peripheral.discoverServices(nil)
    }
    func centralManager(_ central: CBCentralManager, didFailToConnect peripheral: CBPeripheral, error: Error?) {
        if forwardToMain({ self.centralManager(central, didFailToConnect: peripheral, error: error) }) { return }
        guard self.peripheral === peripheral else { return }
        reply(pendingConnect, error: "Connection failed"); pendingConnect = nil
        self.peripheral = nil; reply(pendingDisconnect); pendingDisconnect = nil
    }
    func centralManager(_ central: CBCentralManager, didDisconnectPeripheral peripheral: CBPeripheral, error: Error?) {
        if forwardToMain({ self.centralManager(central, didDisconnectPeripheral: peripheral, error: error) }) { return }
        guard self.peripheral?.identifier == peripheral.identifier else { return }
        for id in pendingWrites.values { reply(id, error: "Disconnected") }; pendingWrites = [:]
        for id in pendingNotify.values { reply(id, error: "Disconnected") }; pendingNotify = [:]
        for id in pendingReads.values { reply(id, error: "Disconnected") }; pendingReads = [:]
        reply(pendingConnect, error: "Disconnected"); pendingConnect = nil
        self.peripheral = nil; characteristics = [:]; pendingServices = []; send(["kind": "disconnected"])
        reply(pendingDisconnect); pendingDisconnect = nil
    }
    func peripheral(_ peripheral: CBPeripheral, didDiscoverServices error: Error?) {
        if forwardToMain({ self.peripheral(peripheral, didDiscoverServices: error) }) { return }
        guard self.peripheral === peripheral else { return }
        guard error == nil, let services = peripheral.services, !services.isEmpty else { reply(pendingConnect, error: "No services"); pendingConnect = nil; return }
        stage = "discover-characteristics"
        pendingServices = Set(services.map(\.uuid))
        for service in services { peripheral.discoverCharacteristics(nil, for: service) }
    }
    func peripheral(_ peripheral: CBPeripheral, didDiscoverCharacteristicsFor service: CBService, error: Error?) {
        if forwardToMain({ self.peripheral(peripheral, didDiscoverCharacteristicsFor: service, error: error) }) { return }
        guard self.peripheral === peripheral else { return }
        if let error { reply(pendingConnect, error: error.localizedDescription); pendingConnect = nil; return }
        for characteristic in service.characteristics ?? [] { characteristics[service.uuid, default: [:]][characteristic.uuid] = characteristic }
        pendingServices.remove(service.uuid)
        if pendingServices.isEmpty { reply(pendingConnect); pendingConnect = nil }
    }
    func peripheral(_ peripheral: CBPeripheral, didUpdateNotificationStateFor characteristic: CBCharacteristic, error: Error?) {
        if forwardToMain({ self.peripheral(peripheral, didUpdateNotificationStateFor: characteristic, error: error) }) { return }
        guard self.peripheral === peripheral else { return }
        reply(pendingNotify.removeValue(forKey: characteristicKey(characteristic)), error: error?.localizedDescription)
    }
    func peripheral(_ peripheral: CBPeripheral, didWriteValueFor characteristic: CBCharacteristic, error: Error?) {
        if forwardToMain({ self.peripheral(peripheral, didWriteValueFor: characteristic, error: error) }) { return }
        guard self.peripheral === peripheral else { return }
        reply(pendingWrites.removeValue(forKey: characteristicKey(characteristic)), error: error?.localizedDescription)
    }
    func peripheral(_ peripheral: CBPeripheral, didUpdateValueFor characteristic: CBCharacteristic, error: Error?) {
        let data = characteristic.value.map { Data($0) }, key = characteristicKey(characteristic), receivedAt = now
        DispatchQueue.main.async {
            self.receiveValue(peripheral, key: key, data: data, receivedAt: receivedAt, error: error)
        }
    }
    private func receiveValue(_ peripheral: CBPeripheral, key: String, data: Data?, receivedAt: Double, error: Error?) {
        guard self.peripheral === peripheral else { return }
        callbackQueueDelayMaxMs = max(callbackQueueDelayMaxMs, now - receivedAt)
        if let id = pendingReads.removeValue(forKey: key) { reply(id, value: Array(data ?? Data()).map(Int.init), error: error?.localizedDescription); return }
        if let error {
            let failure = error as NSError
            trace.append(["event": "ble-error", "now": now, "scene": sceneState,
                          "domain": failure.domain, "code": failure.code])
            persistDiagnostic()
            return
        }
        guard let data else { return }
        receivedFrames += 1
        let address = key.split(separator: "/").map(String.init)
        guard address.count == 2 else { return }
        send(["kind": "notification", "service": address[0], "characteristic": address[1], "bytes": Array(data).map(Int.init)])
    }
}

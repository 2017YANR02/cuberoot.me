import Foundation
import Combine
import WatchKit
import WatchConnectivity
import WatchJS

/** Retains the original cubing.js tables on one serial queue across requests. */
private final class WatchScrambleWorker {
    private var engine: OpaquePointer?
    deinit { cw_destroy(engine) }
    private func evaluate(_ source: String) throws -> String {
        var failed: Int32 = 0
        guard let engine, let value = cw_eval(engine, source, &failed) else {
            throw NSError(domain: "WatchScramble", code: 1)
        }
        defer { cw_free(value) }
        let result = String(cString: value)
        guard failed == 0 else { throw NSError(domain: "WatchScramble", code: 2, userInfo: [NSLocalizedDescriptionKey: result]) }
        return result
    }
    func generate() throws -> (String, String) {
        do {
            if engine == nil {
                engine = cw_create_scramble()
                guard let url = Bundle.main.url(forResource: "WatchScramble", withExtension: "js") else {
                    throw NSError(domain: "WatchScramble", code: 3)
                }
                _ = try evaluate(String(contentsOf: url, encoding: .utf8))
            }
            _ = try evaluate("WatchScramble.start()")
            // Pending Promise jobs are bounded; native search itself has a CPU limit.
            for _ in 0..<100 {
                let result = try evaluate("WatchScramble.result()")
                if result == "null" { continue }
                let value = try JSONSerialization.jsonObject(with: Data(result.utf8)) as? [String: String]
                guard let scramble = value?["scramble"], !scramble.isEmpty,
                      let facelets = value?["facelets"], facelets.count == 54 else {
                    throw NSError(domain: "WatchScramble", code: 4, userInfo: [NSLocalizedDescriptionKey: value?["error"] ?? result])
                }
                return (scramble, facelets)
            }
            throw NSError(domain: "WatchScramble", code: 5)
        } catch {
            cw_destroy(engine); engine = nil
            throw error
        }
    }
}

struct WatchLocalState: Codable {
    var language = Locale.current.language.languageCode?.identifier == "zh" ? "zh" : "en"
    var batchId = ""
    var batchCursor = WatchBatchCursor()
    var current: WatchTimerSlot?
    var queue: [WatchTimerSlot] = []
    var draft: WatchTimerRecord?
    var interrupted: WatchTimerRecord?
    var outbox: [WatchTimerRecord] = []
    var requestId = ""
    var unsupported = false
    var recovered = false
    var lastResult: String?
    var history: [WatchTimerRecord]? = nil
    var lastSolve: WatchTimerRecord?
    var recordingVersion: Int? = nil
    var localTemplate: WatchTimerSlot? = nil
}

final class WatchTimerModel: NSObject, ObservableObject, WCSessionDelegate {
    @Published private(set) var state = WatchLocalState()
    @Published private(set) var phase = "idle"
    @Published private(set) var displayMs: Double = 0
    @Published private(set) var errorKey: String?
    @Published var reviewing = false { didSet { syncCubeContext() } }
    @Published private(set) var generating = false
    @Published private(set) var generationFailed = false
    private let scrambleQueue = DispatchQueue(label: "me.cuberoot.watch.scramble", qos: .utility)
    private let scrambleWorker = WatchScrambleWorker()
    let cube = WatchCubeConnection()
    lazy var replayDisplay = WatchCubeScene()
    var recovered: Bool { state.recovered }
    private var diskFailed = false
    private let file = "watch-timer-v1.json"
    private let clock = ContinuousClock()
    private var started: ContinuousClock.Instant?
    private var inspecting: ContinuousClock.Instant?
    private var warned = Set<Int>()
    private var startOffsetMs = 0.0
    private var ticker: AnyCancellable?
    private var ticks = 0
    var active = true

    override init() {
        super.init()
        do { try restoreFromDisk() }
        catch { diskFailed = true; errorKey = "storageError" }
        cube.onTimer = { [weak self] event in self?.receiveTimer(event) }
        cube.onFailure = { [weak self] in
            guard let self else { return }
            if self.phase == "running" {
                self.state.interrupted?.penalty = "DNF"
                self.stop(self.displayMs)
            }
            self.errorKey = "runtimeError"
        }
        if cube.error == "runtime" { errorKey = "runtimeError" }
        syncCubeContext()
        WCSession.default.delegate = self
        WCSession.default.activate()
        ticker = Timer.publish(every: 0.05, on: .main, in: .common).autoconnect().sink { [weak self] _ in self?.tick() }
        replenishLocalScrambles()
    }
    private func restoreFromDisk() throws {
        var next = try WatchTimerDisk.load(file, default: WatchLocalState())
        next.draft?.slot.previewPng = nil
        next.interrupted?.slot.previewPng = nil
        for index in next.outbox.indices { next.outbox[index].slot.previewPng = nil }
        if var interrupted = next.interrupted {
            // Continuous-clock instants cannot survive process termination or reboot.
            interrupted.penalty = "DNF"; interrupted.timeMs = 0
            next.draft = interrupted; next.interrupted = nil; next.recovered = true
            try WatchTimerDisk.save(next, file)
        }
        state = next; phase = next.draft == nil ? "idle" : "stopped"
        diskFailed = false; errorKey = nil
        if next.draft != nil { saveAndNext() }
    }
    private var localTemplate: WatchTimerSlot? {
        guard !state.unsupported else { return nil }
        // Existing installations recover the most recent phone selection, including exhausted queues.
        if let slot = state.localTemplate ?? state.queue.last ?? state.current ?? state.lastSolve?.slot {
            return slot.event == "333" ? slot : nil
        }
        guard state.batchId.isEmpty else { return nil }
        return WatchTimerSlot(id: UUID().uuidString, sessionId: "watch-local-333", sessionName: text("localSession"),
                              event: "333", eventName: "3×3×3", scramble: "", inspectionSec: 0, holdMs: 300)
    }
    func retryGeneration() { generationFailed = false; replenishLocalScrambles() }
    private func replenishLocalScrambles() {
        guard active, phase == "idle", !diskFailed, !generating, !generationFailed,
              state.draft == nil, state.outbox.count < 1000, state.queue.count < 3,
              let template = localTemplate else { return }
        generating = true
        let cursor = state.batchCursor
        scrambleQueue.async { [weak self] in
            guard let self else { return }
            let result = Result { try self.scrambleWorker.generate() }
            DispatchQueue.main.async {
                self.generating = false
                // A newly received phone selection wins over an in-flight generation.
                guard self.state.batchCursor.sourceId == cursor.sourceId,
                      self.state.batchCursor.sequence == cursor.sequence,
                      self.localTemplate?.sessionId == template.sessionId,
                      self.localTemplate?.event == "333" else { self.replenishLocalScrambles(); return }
                switch result {
                case .success(let (scramble, facelets)):
                    var slot = template
                    slot.id = UUID().uuidString; slot.scramble = scramble
                    slot.previewPng = nil; slot.localFacelets = facelets
                    var next = self.state
                    next.localTemplate = slot
                    if next.current == nil { next.current = slot } else { next.queue.append(slot) }
                    if self.commit(next) { self.replenishLocalScrambles() }
                case .failure:
                    self.generationFailed = true
                }
                // Small diagnostic contains status only, never replaces durable timer storage.
                if let data = try? JSONSerialization.data(withJSONObject: ["generating": self.generating,
                    "failed": self.generationFailed, "queued": self.state.queue.count,
                    "localCurrent": self.state.current?.localFacelets != nil]),
                   let url = try? WatchTimerDisk.url("watch-scramble-status.json") { try? data.write(to: url, options: .atomic) }
            }
        }
    }
    func text(_ key: String) -> String { WatchCopy.text(key, language: state.language) }
    private func elapsed(_ start: ContinuousClock.Instant) -> Double {
        let d = start.duration(to: clock.now).components
        return max(0, Double(d.seconds) * 1000 + Double(d.attoseconds) / 1e15)
    }
    var display: String {
        if let draft = state.draft {
            return WatchTimerRules.result(draft)
        }
        if let inspecting, phase != "running" {
            let ms = elapsed(inspecting)
            let p = WatchTimerRules.penalty(ms, limit: state.current?.inspectionSec ?? 0)
            return p == "ok" ? String(Int(ms / 1000)) : p
        }
        if phase == "idle", let last = state.lastResult { return last }
        return WatchTimerRules.format(displayMs)
    }
    @discardableResult private func commit(_ next: WatchLocalState) -> Bool {
        guard !diskFailed else { return false }
        do { try WatchTimerDisk.save(next, file); state = next; errorKey = cube.available ? nil : "runtimeError"; syncCubeContext(); return true }
        catch { errorKey = "storageError"; syncCubeContext(); return false }
    }
    private func syncCubeContext() {
        cube.setContext(state.current, enabled: !reviewing && state.current != nil && !diskFailed && errorKey == nil && state.draft == nil && state.outbox.count < 1000)
    }
    func retryStorage() {
        // Re-read an unavailable source rather than overwriting it with initial state.
        if diskFailed {
            do { try restoreFromDisk() }
            catch { errorKey = "storageError"; return }
        }
        if commit(state), state.draft != nil { saveAndNext() }
        receiveBatch(WCSession.default.receivedApplicationContext)
        replenishLocalScrambles()
    }
    private func tick() {
        guard active else { return }
        if phase == "running", let started { displayMs = elapsed(started) + startOffsetMs }
        if let inspecting, phase != "running" {
            displayMs = elapsed(inspecting)
            for second in [8, 12] where displayMs >= Double(second * 1000) && !warned.contains(second) {
                warned.insert(second)
                WKInterfaceDevice.current().play(.notification)
            }
        }
        ticks += 1
        if ticks % 200 == 0 { flush(); replenishLocalScrambles() }
    }
    func tapTimer() {
        guard cube.phase != "connected" else { return }
        syncCubeContext()
        cube.tap()
    }
    private func receiveTimer(_ event: [String: Any]) {
        guard event["contextId"] as? String == state.current?.id else { return }
        let effects = event["effects"] as? [String] ?? []
        if effects.contains("run-started") {
            guard var slot = state.current, state.draft == nil, state.outbox.count < 1000 else { return }
            slot.previewPng = nil
            let now = event["nowMs"] as? Double ?? 0
            let at = event["startedAtMs"] as? Double ?? now
            let inspectionAt = event["inspectionStartedAtMs"] as? Double ?? at
            let record = WatchTimerRecord(id: UUID().uuidString, slot: slot, timeMs: 0,
                ts: Date().timeIntervalSince1970 * 1000,
                penalty: event["autoPenalty"] as? String ?? "ok", inspectionMs: max(0, at - inspectionAt))
            var next = state; next.interrupted = record
            // Retain the attempt in memory if storage fails, so stopping can retry it.
            state = next; _ = commit(next)
            startOffsetMs = max(0, now - at); started = clock.now; inspecting = nil
            displayMs = startOffsetMs; phase = "running"
            WKInterfaceDevice.current().play(.start)
        } else if effects.contains("run-stopped"), let solve = event["solve"] as? [String: Any] {
            if let recording = event["recording"] as? [String: Any],
               let moves = recording["moves"] as? [[String: Any]], !moves.isEmpty,
               let data = try? JSONSerialization.data(withJSONObject: moves),
               let decoded = try? JSONDecoder().decode([WatchTimerRecord.Move].self, from: data) {
                state.interrupted?.moves = decoded
                state.interrupted?.gyro = recording["gyro"] as? String
                if let device = recording["device"] as? [String: String], let name = device["name"], let model = device["model"] {
                    state.interrupted?.device = .init(model: model, name: name)
                }
            }
            state.interrupted?.penalty = solve["autoPenalty"] as? String ?? "ok"
            state.interrupted?.inspectionMs = solve["inspectionMs"] as? Double ?? 0
            stop(solve["timeMs"] as? Double ?? 0)
        } else {
            phase = event["phase"] as? String ?? "idle"
            if effects.contains("inspection-started") { inspecting = clock.now; warned.removeAll(); displayMs = 0 }
            if phase == "ready" { WKInterfaceDevice.current().play(.notification) }
            if effects.contains("arm-cancelled") { inspecting = nil; displayMs = 0; phase = "idle" }
        }
    }
    private func stop(_ ms: Double) {
        guard var record = state.interrupted else { return }
        record.timeMs = min(ms, 86_400_000)
        if ms > 86_400_000 { record.penalty = "DNF" }
        var next = state; next.draft = record; next.interrupted = nil
        // Keep the exact stop instant even if disk is temporarily full.
        state = next; phase = "stopped"; displayMs = ms; started = nil
        if commit(next) { saveAndNext() }
        WKInterfaceDevice.current().play(.stop)
    }
    func saveAndNext() {
        guard var draft = state.draft, state.outbox.count < 1000 else { return }
        draft.slot.previewPng = nil
        var next = state
        next.lastResult = display
        var history = next.history ?? next.outbox
        if let previous = next.lastSolve, !history.contains(where: { $0.id == previous.id }) { history.append(previous) }
        history.removeAll { $0.id == draft.id }; history.append(draft)
        next.history = Array(history.suffix(100))
        next.lastSolve = draft
        next.outbox.append(draft); next.draft = nil; next.recovered = false
        next.current = next.queue.isEmpty ? nil : next.queue.removeFirst()
        guard commit(next) else { return }
        phase = "idle"; displayMs = 0
        if state.queue.count < 3 { requestBatch() }
        flush()
    }
    func useReplayScramble(_ record: WatchTimerRecord) {
        guard phase != "running", state.draft == nil else { return }
        var next = state
        if let current = next.current { next.queue.insert(current, at: 0) }
        var slot = record.slot; slot.id = UUID().uuidString
        next.current = slot
        if commit(next) { reviewing = false; syncCubeContext() }
    }
    func replayFeedback(_ record: WatchTimerRecord, ok: Bool?) {
        var next = state
        var updated = next.history?.first(where: { $0.id == record.id }) ?? next.lastSolve ?? record
        guard updated.id == record.id else { return }
        updated.reconOk = ok; updated.reconRevision = (updated.reconRevision ?? 0) + 1
        if next.lastSolve?.id == record.id { next.lastSolve = updated }
        if let index = next.history?.firstIndex(where: { $0.id == record.id }) { next.history?[index] = updated }
        next.outbox.removeAll { $0.id == record.id }; next.outbox.append(updated)
        if commit(next) { flush() }
    }
    func cancelInspection() {
        guard phase != "running", state.draft == nil else { return }
        cube.cancel()
    }
    func sceneActive(_ value: Bool, state sceneState: String) {
        active = value
        cube.sceneChanged(sceneState)
        cube.display.setAwake(value)
        // Wrist-down must not invent a stop.
        if !value, phase != "running", cube.phase != "connected" { cancelInspection() }
        if value { flush(); if state.current == nil || state.queue.count < 3 { requestBatch() } }
    }
    func requestBatch() {
        guard !diskFailed else { return }
        replenishLocalScrambles()
        if state.requestId.isEmpty {
            var next = state; next.requestId = UUID().uuidString
            guard commit(next) else { return }
        }
        flush()
    }
    private func flush() {
        guard WCSession.default.activationState == .activated, !diskFailed else { return }
        let session = WCSession.default
        for var record in state.outbox {
            // Older phone DTOs discard unknown recording fields before ACKing.
            // Retain recordings until the updated companion advertises support.
            if !record.canTransfer(recordingVersion: state.recordingVersion) { continue }
            record.slot.previewPng = nil
            if !session.outstandingUserInfoTransfers.contains(where: { $0.userInfo["id"] as? String == record.id }),
               !session.outstandingFileTransfers.contains(where: { $0.file.metadata?["recordId"] as? String == record.id }),
               let json = try? WatchTimerDisk.json(record) {
                if json.utf8.count > 56_000 {
                    if let url = try? WatchTimerDisk.url("watch-record-\(record.id)-\(record.reconRevision ?? 0).json"),
                       (try? Data(json.utf8).write(to: url, options: .atomic)) != nil {
                        session.transferFile(url, metadata: ["kind": "record", "recordId": record.id, "revision": record.reconRevision ?? 0])
                    }
                    continue
                }
                let packet: [String: Any] = ["kind": "record", "id": record.id, "json": json, "revision": record.reconRevision ?? 0]
                session.transferUserInfo(packet)
                if session.isReachable { session.sendMessage(packet, replyHandler: nil, errorHandler: nil) }
            }
        }
        if !state.requestId.isEmpty,
           !session.outstandingUserInfoTransfers.contains(where: { $0.userInfo["id"] as? String == state.requestId }) {
            let packet: [String: Any] = ["kind": "request", "id": state.requestId]
            session.transferUserInfo(packet)
            if session.isReachable { session.sendMessage(packet, replyHandler: nil, errorHandler: nil) }
        }
    }
    private func receiveBatch(_ context: [String: Any]) {
        guard let json = context["batch"] as? String, json.utf8.count <= 950_000,
              let batch = try? JSONDecoder().decode(WatchTimerBatch.self, from: Data(json.utf8)),
              batch.version == 1, batch.slots.count <= 10,
              let source = batch.sourceId, let sequence = batch.sequence else { return }
        var next = state
        guard next.batchCursor.accept(source: source, revision: sequence) else { return }
        next.batchId = batch.id; next.language = batch.language
        next.recordingVersion = batch.recordingVersion
        next.queue = batch.slots; next.requestId = ""; next.unsupported = batch.unsupported
        next.localTemplate = batch.slots.last
        // Never replace the scramble the user is reading, inspecting or solving.
        if next.current == nil, !next.queue.isEmpty { next.current = next.queue.removeFirst() }
        if commit(next) { generationFailed = false; replenishLocalScrambles() }
    }
    private func receive(_ info: [String: Any]) {
        if info["batch"] != nil { receiveBatch(info); return }
        if info["kind"] as? String == "ack", let ids = info["ids"] as? [String] {
            let revisions = info["revisions"] as? [String: Int] ?? [:]
            var next = state; next.outbox.removeAll { ids.contains($0.id) && ($0.reconRevision ?? 0) <= (revisions[$0.id] ?? 0) }
            if commit(next) { if state.draft != nil { saveAndNext() }; flush() }
        }
    }
    func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {
        DispatchQueue.main.async { self.receiveBatch(session.receivedApplicationContext); self.flush();
            if self.state.current == nil { self.requestBatch() } }
    }
    func session(_ session: WCSession, didReceive file: WCSessionFile) {
        guard file.metadata?["kind"] as? String == "batch",
              let size = try? file.fileURL.resourceValues(forKeys: [.fileSizeKey]).fileSize,
              size <= 950_000,
              let data = try? Data(contentsOf: file.fileURL),
              let json = String(data: data, encoding: .utf8) else { return }
        // WCSession deletes its temporary file after this callback returns.
        DispatchQueue.main.async { self.receiveBatch(["batch": json]) }
    }
    func session(_ session: WCSession, didFinish fileTransfer: WCSessionFileTransfer, error: Error?) {
        // Outbox remains authoritative until the phone ACKs; temporary files are retried from it.
        if fileTransfer.file.metadata?["kind"] as? String == "record" {
            try? FileManager.default.removeItem(at: fileTransfer.file.fileURL)
            if error == nil, let id = fileTransfer.file.metadata?["recordId"] as? String {
                let revision = fileTransfer.file.metadata?["revision"] as? Int ?? 0
                DispatchQueue.main.async { if self.state.outbox.contains(where: { $0.id == id && ($0.reconRevision ?? 0) > revision }) { self.flush() } }
            }
        }
    }
    func session(_ session: WCSession, didFinish userInfoTransfer: WCSessionUserInfoTransfer, error: Error?) {
        guard error == nil, let id = userInfoTransfer.userInfo["id"] as? String else { return }
        let revision = userInfoTransfer.userInfo["revision"] as? Int ?? 0
        DispatchQueue.main.async { if self.state.outbox.contains(where: { $0.id == id && ($0.reconRevision ?? 0) > revision }) { self.flush() } }
    }
    func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String: Any]) {
        DispatchQueue.main.async { self.receiveBatch(applicationContext) }
    }
    func session(_ session: WCSession, didReceiveUserInfo userInfo: [String: Any]) {
        DispatchQueue.main.async { self.receive(userInfo) }
    }
    func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
        DispatchQueue.main.async { self.receive(message) }
    }
}

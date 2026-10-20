import Foundation
import Capacitor
import WatchConnectivity

private struct PhoneWatchState: Codable {
    var sourceId = UUID().uuidString
    var sequence = 0
    var inbox: [WatchTimerRecord] = []
    var requestId = ""
    var handledRequests: [String] = []
    var configuration = ""
    var batch: WatchTimerBatch?
}

/** Starts before the WebView. Background deliveries survive until IndexedDB commits. */
final class PhoneWatchTimer: NSObject, WCSessionDelegate {
    static let shared = PhoneWatchTimer()
    private var state = PhoneWatchState()
    private var diskError: Error?
    private let file = "watch-timer-phone-v1.json"

    private override init() {
        super.init()
        do { state = try WatchTimerDisk.load(file, default: PhoneWatchState()) }
        catch { diskError = error } // Never overwrite a corrupt/unreadable inbox.
    }
    func start() {
        guard WCSession.isSupported() else { return }
        WCSession.default.delegate = self
        WCSession.default.activate()
    }
    private func save(_ next: PhoneWatchState) throws {
        if let diskError { throw diskError }
        try WatchTimerDisk.save(next, file)
        state = next
    }
    func read() throws -> [String: Any] {
        if let diskError { throw diskError }
        let rows = try JSONSerialization.jsonObject(with: JSONEncoder().encode(state.inbox))
        return ["installed": WCSession.isSupported() && WCSession.default.isWatchAppInstalled,
                "records": rows, "requestId": state.requestId, "configuration": state.configuration]
    }
    func publish(_ json: String, requestId: String) throws {
        guard json.utf8.count <= 1_000_000 else { throw NSError(domain: "WatchTimer", code: 1) }
        var batch = try JSONDecoder().decode(WatchTimerBatch.self, from: Data(json.utf8))
        guard batch.version == 1, batch.slots.count <= 10,
              WCSession.default.activationState == .activated else { throw NSError(domain: "WatchTimer", code: 2) }
        var next = state
        next.sequence += 1
        batch.sourceId = next.sourceId
        batch.sequence = next.sequence
        batch.recordingVersion = 1
        let payload = try batch.transportJSON(maxBytes: 950_000)
        next.batch = batch
        // Reserve the sequence before sending, including ambiguous disk/network outcomes.
        try save(next)
        try sendBatch(payload, key: "\(next.sourceId):\(next.sequence)")
        next.configuration = batch.configuration
        if !requestId.isEmpty {
            next.handledRequests = Array((next.handledRequests + [requestId]).suffix(64))
            if next.requestId == requestId { next.requestId = "" }
        }
        try save(next)
    }
    private func sendBatch(_ payload: String, key: String) throws {
        let session = WCSession.default
        if payload.utf8.count <= 56_000 {
            try session.updateApplicationContext(["batch": payload])
        } else {
            guard !session.outstandingFileTransfers.contains(where: { $0.file.metadata?["batchKey"] as? String == key }) else { return }
            let url = try WatchTimerDisk.url("watch-batch-\(UUID().uuidString).json")
            try Data(payload.utf8).write(to: url, options: .atomic)
            session.transferFile(url, metadata: ["kind": "batch", "batchKey": key])
        }
    }
    func session(_ session: WCSession, didFinish fileTransfer: WCSessionFileTransfer, error: Error?) {
        // Retry is driven by the durable batch/request; completed transfer files are disposable.
        try? FileManager.default.removeItem(at: fileTransfer.file.fileURL)
    }
    func acknowledge(_ ids: [String], revisions: [String: Int] = [:]) throws {
        var next = state
        next.inbox.removeAll { ids.contains($0.id) && ($0.reconRevision ?? 0) <= (revisions[$0.id] ?? 0) }
        try save(next)
        guard WCSession.default.activationState == .activated else { return }
        let message: [String: Any] = ["kind": "ack", "ids": ids, "revisions": revisions]
        WCSession.default.transferUserInfo(message)
        if WCSession.default.isReachable { WCSession.default.sendMessage(message, replyHandler: nil, errorHandler: nil) }
    }
    private func receive(_ info: [String: Any]) {
        do {
            var next = state
            if info["kind"] as? String == "record", let json = info["json"] as? String, json.utf8.count <= 4_000_000 {
                let record = try JSONDecoder().decode(WatchTimerRecord.self, from: Data(json.utf8))
                guard record.version == 1, UUID(uuidString: record.id) != nil else { return }
                if let index = next.inbox.firstIndex(where: { $0.id == record.id }) {
                    if (record.reconRevision ?? 0) > (next.inbox[index].reconRevision ?? 0) { next.inbox[index] = record }
                } else {
                    guard next.inbox.count < 2000 else { return } // No ACK: watch retains its outbox.
                    next.inbox.append(record)
                }
            } else if info["kind"] as? String == "request", let id = info["id"] as? String,
                      UUID(uuidString: id) != nil {
                if next.handledRequests.contains(id) {
                    if let batch = next.batch {
                        try sendBatch(WatchTimerDisk.json(batch), key: "\(batch.sourceId ?? ""):\(batch.sequence ?? 0)")
                    }
                    return
                }
                next.requestId = id
            } else { return }
            try save(next)
        } catch { /* No ACK on failure; the watch keeps the original record. */ }
    }
    func session(_ session: WCSession, didReceiveUserInfo userInfo: [String: Any]) {
        DispatchQueue.main.async { self.receive(userInfo) }
    }
    func session(_ session: WCSession, didReceive file: WCSessionFile) {
        guard file.metadata?["kind"] as? String == "record",
              let size = try? file.fileURL.resourceValues(forKeys: [.fileSizeKey]).fileSize, size <= 4_000_000,
              let data = try? Data(contentsOf: file.fileURL), let json = String(data: data, encoding: .utf8) else { return }
        DispatchQueue.main.async { self.receive(["kind": "record", "json": json]) }
    }
    func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
        DispatchQueue.main.async { self.receive(message) }
    }
    func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {}
    func sessionDidBecomeInactive(_ session: WCSession) {}
    func sessionDidDeactivate(_ session: WCSession) {
        DispatchQueue.main.async {
            // Pair switching forces a fresh batch for the new watch.
            var next = self.state
            next.configuration = ""
            try? self.save(next)
            session.activate()
        }
    }
}

@objc(WatchTimerPlugin)
final class WatchTimerPlugin: CAPPlugin, CAPBridgedPlugin {
    let identifier = "WatchTimerPlugin"
    let jsName = "WatchTimer"
    let pluginMethods: [CAPPluginMethod] = [CAPPluginMethod(name: "read", returnType: CAPPluginReturnPromise),
                         CAPPluginMethod(name: "publish", returnType: CAPPluginReturnPromise),
                         CAPPluginMethod(name: "acknowledge", returnType: CAPPluginReturnPromise)]
    @objc func read(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            do { call.resolve(try PhoneWatchTimer.shared.read()) }
            catch { call.reject("Watch inbox unavailable") }
        }
    }
    @objc func publish(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            do {
                try PhoneWatchTimer.shared.publish(call.getString("json") ?? "", requestId: call.getString("requestId") ?? "")
                call.resolve()
            } catch { call.reject("Watch transfer unavailable") }
        }
    }
    @objc func acknowledge(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            do { try PhoneWatchTimer.shared.acknowledge(call.getArray("ids", String.self) ?? [], revisions: call.getObject("revisions") as? [String: Int] ?? [:]); call.resolve() }
            catch { call.reject("Watch receipt unavailable") }
        }
    }
}

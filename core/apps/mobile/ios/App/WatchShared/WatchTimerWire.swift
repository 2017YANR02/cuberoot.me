import Foundation

// Versioned transport DTOs only. The phone validates and imports through TimerRepository.
struct WatchTimerSlot: Codable, Equatable {
    var id: String
    var sessionId: String
    var sessionName: String
    var event: String
    var eventName: String
    var scramble: String
    var inspectionSec: Double
    var holdMs: Double
    var previewPng: String? = nil
    var localFacelets: String? = nil
}
struct WatchTimerBatch: Codable {
    var version: Int
    var id: String
    var configuration: String
    var language: String
    var slots: [WatchTimerSlot]
    var unsupported: Bool
    var sourceId: String?
    var sequence: Int?
    var recordingVersion: Int? = nil

    mutating func transportJSON(maxBytes: Int = 56_000) throws -> String {
        var json = try WatchTimerDisk.json(self)
        while json.utf8.count > maxBytes && slots.count > 1 {
            slots.removeLast()
            json = try WatchTimerDisk.json(self)
        }
        if json.utf8.count > maxBytes, !slots.isEmpty {
            slots[0].previewPng = nil
            json = try WatchTimerDisk.json(self)
        }
        guard json.utf8.count <= maxBytes else { throw NSError(domain: "WatchTimer", code: 3) }
        return json
    }
}

/** Persisted high-water mark rejects stale batches across both WC delivery channels. */
struct WatchBatchCursor: Codable {
    var sourceId = ""
    var sequence = 0
    var retiredSources: [String] = []
    mutating func accept(source: String, revision: Int) -> Bool {
        guard UUID(uuidString: source) != nil, revision > 0, !retiredSources.contains(source) else { return false }
        if source == sourceId {
            guard revision > sequence else { return false }
        } else {
            if !sourceId.isEmpty { retiredSources.append(sourceId) }
            sourceId = source
        }
        sequence = revision
        return true
    }
}
struct WatchTimerRecord: Codable, Identifiable {
    struct Move: Codable { var m: String; var ts: Double }
    struct Device: Codable { var model: String; var name: String }
    var version = 1
    var id: String
    var slot: WatchTimerSlot
    var timeMs: Double
    var ts: Double
    var penalty: String
    var inspectionMs: Double
    var moves: [Move]? = nil
    var gyro: String? = nil
    var device: Device? = nil
    var reconOk: Bool? = nil
    var reconRevision: Int? = nil
    func canTransfer(recordingVersion: Int?) -> Bool { moves?.isEmpty != false || recordingVersion == 1 }
}

enum WatchTimerDisk {
    static func url(_ name: String) throws -> URL {
        let directory = try FileManager.default.url(for: .applicationSupportDirectory, in: .userDomainMask,
                                                    appropriateFor: nil, create: true)
        return directory.appendingPathComponent(name)
    }
    static func load<T: Decodable>(_ name: String, default value: T) throws -> T {
        let url = try url(name)
        guard FileManager.default.fileExists(atPath: url.path) else { return value }
        return try JSONDecoder().decode(T.self, from: Data(contentsOf: url))
    }
    static func save<T: Encodable>(_ value: T, _ name: String) throws {
        try JSONEncoder().encode(value).write(to: url(name), options: .atomic)
    }
    static func json<T: Encodable>(_ value: T) throws -> String {
        String(decoding: try JSONEncoder().encode(value), as: UTF8.self)
    }
}

// Minimal native timing presentation; shared fixtures guard parity with the TS rules.
enum WatchTimerRules {
    static func result(_ record: WatchTimerRecord) -> String {
        if record.penalty == "DNF" { return "DNF" }
        return format(record.timeMs + (record.penalty == "+2" ? 2000 : 0)) + (record.penalty == "+2" ? "+" : "")
    }
    // Mirrors shared/timer/inspection.ts; boundary fixtures exercise both implementations.
    static func penalty(_ ms: Double, limit: Double) -> String {
        if limit <= 0 { return "ok" }
        if ms > (limit + 2) * 1000 { return "DNF" }
        if ms > limit * 1000 { return "+2" }
        return "ok"
    }
    static func format(_ ms: Double) -> String {
        let centiseconds = Int(max(0, ms).rounded()) / 10
        if centiseconds >= 360000 { return String(format: "%d:%02d:%02d.%02d", centiseconds / 360000,
                                                  (centiseconds / 6000) % 60, (centiseconds / 100) % 60, centiseconds % 100) }
        if centiseconds >= 6000 { return String(format: "%d:%02d.%02d", centiseconds / 6000, (centiseconds / 100) % 60, centiseconds % 100) }
        return String(format: "%d.%02d", centiseconds / 100, centiseconds % 100)
    }
}

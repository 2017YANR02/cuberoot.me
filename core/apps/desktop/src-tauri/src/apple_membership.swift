import AppKit
import Foundation
import Security
import StoreKit

private let productIDs: Set<String> = [
    "me.cuberoot.app.membership.monthly", "me.cuberoot.app.membership.yearly",
]

private struct Request: Decodable {
    let action: String
    let productId: String?
    let appAccountToken: UUID?
    let transactionId: String?
}

typealias MembershipCallback = @convention(c) (UnsafeMutableRawPointer?, UnsafePointer<CChar>, UInt8) -> Void
typealias MembershipUpdate = @convention(c) () -> Void

private struct Reply: @unchecked Sendable {
    let context: UnsafeMutableRawPointer?
    let callback: MembershipCallback

    func send(_ message: String, success: Bool = false) {
        message.withCString { callback(context, $0, success ? 1 : 0) }
    }
}

@_cdecl("cuberoot_apple_membership_available")
func appleMembershipAvailable(_ sandbox: UInt8) -> UInt8 {
    if sandbox != 0 {
        if #available(macOS 13, *), SandboxSigning.verified { return 1 }
        return 0
    }
    if #available(macOS 12, *) { return 1 }
    return 0
}

private enum SandboxSigning {
    // StoreKit routes development-signed builds to Sandbox, including the first sign-in
    // when an AppTransaction is not available yet. Reject ad hoc and distribution builds.
    static let verified: Bool = {
        guard Bundle.main.url(forResource: "embedded", withExtension: "provisionprofile", subdirectory: nil) != nil
                || FileManager.default.fileExists(atPath: Bundle.main.bundleURL.appendingPathComponent("Contents/embedded.provisionprofile").path)
        else { return false }
        var code: SecCode?
        var requirement: SecRequirement?
        let development = """
            anchor apple generic and identifier "me.cuberoot.app" and certificate leaf[field.1.2.840.113635.100.6.1.12] exists
            """ as CFString
        let flags = SecCSFlags()
        guard SecCodeCopySelf(flags, &code) == errSecSuccess, let code,
              SecRequirementCreateWithString(development, flags, &requirement) == errSecSuccess, let requirement
        else { return false }
        return SecCodeCheckValidity(code, flags, requirement) == errSecSuccess
    }()
}

@_cdecl("cuberoot_apple_membership")
func appleMembership(
    _ json: UnsafePointer<CChar>, _ sandbox: UInt8, _ context: UnsafeMutableRawPointer?,
    _ callback: MembershipCallback
) {
    let reply = Reply(context: context, callback: callback)
    guard #available(macOS 12, *), appleMembershipAvailable(sandbox) != 0,
          let request = try? JSONDecoder().decode(Request.self, from: Data(String(cString: json).utf8))
    else {
        reply.send("Invalid or unavailable StoreKit request")
        return
    }
    Task { @MainActor in
        do {
            let result = try await perform(request, sandbox: sandbox != 0)
            let encoded = try JSONSerialization.data(withJSONObject: result)
            reply.send(String(decoding: encoded, as: UTF8.self), success: true)
        } catch let error as MembershipError {
            reply.send(error.rawValue)
        } catch {
            reply.send("StoreKit request could not be completed")
        }
    }
}

private enum MembershipError: String, Error {
    case invalidPurchase = "Invalid or unavailable subscription"
    case unverified = "Transaction verification failed"
    case invalidRequest = "Invalid StoreKit request"
    case manageUnavailable = "Unable to open Apple subscriptions"
    case busy = "A StoreKit operation is already in progress"
}

@MainActor private var presenting = false

@available(macOS 12, *)
@MainActor private func perform(_ request: Request, sandbox: Bool) async throws -> [String: Any] {
    switch request.action {
    case "products":
        let products = try await Product.products(for: productIDs)
        return ["products": products.filter { $0.type == .autoRenewable }.map {
            ["id": $0.id, "displayName": $0.displayName, "displayPrice": $0.displayPrice]
        }]
    case "purchase":
        guard !presenting else { throw MembershipError.busy }
        presenting = true
        defer { presenting = false }
        guard AppStore.canMakePayments, let id = request.productId, productIDs.contains(id),
              let token = request.appAccountToken,
              let product = try await Product.products(for: [id]).first,
              product.type == .autoRenewable else { throw MembershipError.invalidPurchase }
        let result: Product.PurchaseResult
        if #available(macOS 15.2, *), let window = NSApp.keyWindow ?? NSApp.mainWindow {
            result = try await product.purchase(confirmIn: window, options: [.appAccountToken(token)])
        } else {
            result = try await product.purchase(options: [.appAccountToken(token)])
        }
        switch result {
        case .success(let verification):
            guard var transaction = transactionPayload(verification, sandbox: sandbox) else {
                throw MembershipError.unverified
            }
            transaction["status"] = "purchased"
            return transaction
        case .pending: return ["status": "pending"]
        case .userCancelled: return ["status": "cancelled"]
        @unknown default: throw MembershipError.unverified
        }
    case "restore":
        guard !presenting else { throw MembershipError.busy }
        presenting = true
        defer { presenting = false }
        try await AppStore.sync()
        return ["transactions": await transactions(sandbox: sandbox)]
    case "transactions":
        return ["transactions": await transactions(sandbox: sandbox)]
    case "finish":
        guard let id = request.transactionId.flatMap(UInt64.init) else { throw MembershipError.invalidRequest }
        for await result in Transaction.unfinished {
            if case .verified(let transaction) = result, transaction.id == id,
               accepts(transaction, sandbox: sandbox) {
                await transaction.finish()
                break
            }
        }
        return [:]
    case "manage":
        guard let url = URL(string: "https://apps.apple.com/account/subscriptions"),
              NSWorkspace.shared.open(url) else { throw MembershipError.manageUnavailable }
        return [:]
    default:
        throw MembershipError.invalidRequest
    }
}

@available(macOS 12, *)
private func accepts(_ transaction: Transaction, sandbox: Bool) -> Bool {
    guard productIDs.contains(transaction.productID), transaction.productType == .autoRenewable else {
        return false
    }
    if #available(macOS 13, *), sandbox { return transaction.environment == .sandbox }
    return !sandbox
}

@available(macOS 12, *)
private func transactionPayload(
    _ result: VerificationResult<Transaction>, sandbox: Bool
) -> [String: String]? {
    guard case .verified(let transaction) = result, accepts(transaction, sandbox: sandbox) else { return nil }
    return ["transactionId": String(transaction.id), "signedTransaction": result.jwsRepresentation]
}

@available(macOS 12, *)
private func transactions(sandbox: Bool) async -> [[String: String]] {
    var found: [String: [String: String]] = [:]
    for await result in Transaction.unfinished {
        if let payload = transactionPayload(result, sandbox: sandbox), let id = payload["transactionId"] {
            found[id] = payload
        }
    }
    for await result in Transaction.currentEntitlements {
        if let payload = transactionPayload(result, sandbox: sandbox), let id = payload["transactionId"] {
            found[id] = payload
        }
    }
    return Array(found.values)
}

@_cdecl("cuberoot_apple_membership_listen")
func appleMembershipListen(_ sandbox: UInt8, _ notify: MembershipUpdate) {
    guard #available(macOS 12, *), appleMembershipAvailable(sandbox) != 0 else { return }
    Task {
        for await result in Transaction.updates {
            if case .verified(let transaction) = result, accepts(transaction, sandbox: sandbox != 0) {
                notify()
            }
        }
    }
}

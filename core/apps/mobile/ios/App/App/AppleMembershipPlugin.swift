import Foundation
import Capacitor
import StoreKit

/// Native transport only. The API verifies and persists Apple's signed transaction
/// before JavaScript is permitted to acknowledge delivery with finish().
@objc(AppleMembershipPlugin)
final class AppleMembershipPlugin: CAPPlugin, CAPBridgedPlugin {
    let identifier = "AppleMembershipPlugin"
    let jsName = "AppleMembership"
    let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "products", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "purchase", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "transactions", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "restore", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "finish", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "manage", returnType: CAPPluginReturnPromise)
    ]
    private let productIds: Set<String> = [
        "me.cuberoot.app.membership.monthly", "me.cuberoot.app.membership.yearly"
    ]
    private var updates: Task<Void, Never>?

    override func load() {
        updates = Task { [weak self] in
            for await result in Transaction.updates {
                guard let self else { return }
                if case .verified(let transaction) = result,
                   self.productIds.contains(transaction.productID) {
                    self.notifyListeners("transactionAvailable", data: [:])
                }
            }
        }
    }

    deinit { updates?.cancel() }

    @objc func products(_ call: CAPPluginCall) {
        Task {
            do {
                let products = try await Product.products(for: productIds)
                call.resolve(["products": products.filter { $0.type == .autoRenewable }.map {
                    ["id": $0.id, "displayName": $0.displayName, "displayPrice": $0.displayPrice]
                }])
            } catch { call.reject("Unable to load App Store products") }
        }
    }

    @objc func purchase(_ call: CAPPluginCall) {
        guard let id = call.getString("productId"), productIds.contains(id),
              let token = call.getString("appAccountToken").flatMap(UUID.init(uuidString:)) else {
            call.reject("Invalid purchase request"); return
        }
        Task { @MainActor in
            do {
                guard let product = try await Product.products(for: [id]).first,
                      product.type == .autoRenewable else {
                    call.reject("Product unavailable"); return
                }
                switch try await product.purchase(options: [.appAccountToken(token)]) {
                case .success(let result):
                    guard case .verified(let transaction) = result else {
                        call.reject("Transaction verification failed"); return
                    }
                    call.resolve(["status": "purchased", "transactionId": String(transaction.id),
                                  "signedTransaction": result.jwsRepresentation])
                case .pending: call.resolve(["status": "pending"])
                case .userCancelled: call.resolve(["status": "cancelled"])
                @unknown default: call.reject("Unknown purchase result")
                }
            } catch { call.reject("Purchase could not be completed") }
        }
    }

    private func collectTransactions() async -> [[String: String]] {
        var found = [UInt64: [String: String]]()
        for await result in Transaction.unfinished {
            if case .verified(let transaction) = result, productIds.contains(transaction.productID) {
                found[transaction.id] = ["transactionId": String(transaction.id), "signedTransaction": result.jwsRepresentation]
            }
        }
        for await result in Transaction.currentEntitlements {
            if case .verified(let transaction) = result, productIds.contains(transaction.productID) {
                found[transaction.id] = ["transactionId": String(transaction.id), "signedTransaction": result.jwsRepresentation]
            }
        }
        return Array(found.values)
    }

    @objc func transactions(_ call: CAPPluginCall) {
        Task { call.resolve(["transactions": await collectTransactions()]) }
    }

    @objc func restore(_ call: CAPPluginCall) {
        Task { @MainActor in
            do {
                try await AppStore.sync()
                call.resolve(["transactions": await collectTransactions()])
            } catch { call.reject("Restore could not be completed") }
        }
    }

    @objc func finish(_ call: CAPPluginCall) {
        guard let id = call.getString("transactionId").flatMap(UInt64.init) else {
            call.reject("Invalid transaction ID"); return
        }
        Task {
            for await result in Transaction.unfinished {
                if case .verified(let transaction) = result,
                   transaction.id == id, productIds.contains(transaction.productID) {
                    await transaction.finish(); break
                }
            }
            call.resolve()
        }
    }

    @objc func manage(_ call: CAPPluginCall) {
        Task { @MainActor in
            guard let scene = self.bridge?.viewController?.view.window?.windowScene else {
                call.reject("Window unavailable"); return
            }
            do { try await AppStore.showManageSubscriptions(in: scene); call.resolve() }
            catch { call.reject("Could not open subscriptions") }
        }
    }
}

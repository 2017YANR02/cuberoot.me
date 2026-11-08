import Capacitor
import UIKit
import UserNotifications

// Native transport only. Account ownership, subscriptions and retry live in the
// existing TypeScript controller/API; no APNs credential is packaged in the App.
final class RecordPushState {
    static let shared = RecordPushState()
    var active = false
    var generation = 0
    var token: String?
    var pendingNotification: [String: Any]?
    weak var plugin: RecordPushPlugin?

    func registered(_ data: Data) {
        guard active else { return }
        token = data.map { String(format: "%02x", $0) }.joined()
    }
    func recordTap(_ info: [AnyHashable: Any]) {
        guard let kind = info["kind"] as? String,
              ["wca_record", "comp_announcement", "comp_registration_open", "comp_registration_close"].contains(kind),
              let link = info["link"] as? String, let id = info["notificationId"] as? String else { return }
        var opened: [String: Any] = ["kind": kind, "link": link, "notificationId": id]
        if let uid = info["recipientUid"] as? String { opened["recipientUid"] = uid }
        // The shared decoder checks destination and account before navigation.
        pendingNotification = opened
        plugin?.notifyListeners("notificationOpened", data: opened)
    }
}

@objc(RecordPushPlugin)
final class RecordPushPlugin: CAPPlugin, CAPBridgedPlugin, NotificationHandlerProtocol {
    let identifier = "RecordPushPlugin"
    let jsName = "RecordPush"
    let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "status", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stop", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "pendingNotification", returnType: CAPPluginReturnPromise)
    ]
    private let state = RecordPushState.shared
    private var environment: String {
        // Must match the signed aps-environment. Debug uses development;
        // Release/TestFlight/App Store use production (see setup runbook).
        Bundle.main.object(forInfoDictionaryKey: "CubeRootAPNSEnvironment") as? String == "development" ? "sandbox" : "production"
    }
    override func load() {
        state.plugin = self
        bridge?.notificationRouter.pushNotificationHandler = self
    }
    private func resolveStatus(_ call: CAPPluginCall) {
        UNUserNotificationCenter.current().getNotificationSettings { settings in
            DispatchQueue.main.async {
                let allowed = settings.authorizationStatus == .authorized || settings.authorizationStatus == .provisional
                let configured = Bundle.main.object(forInfoDictionaryKey: "CubeRootAPNSEnvironment") as? String
                call.resolve([
                    "configured": configured == "development" || configured == "production",
                    "enabled": allowed,
                    "clientId": self.state.token as Any? ?? NSNull(),
                    "provider": "apns", "environment": self.environment
                ])
            }
        }
    }
    @objc func status(_ call: CAPPluginCall) { resolveStatus(call) }
    @objc func start(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.state.active = true
            self.state.generation += 1
            let generation = self.state.generation
            UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge]) { granted, error in
                DispatchQueue.main.async {
                    guard self.state.active && self.state.generation == generation else {
                        self.resolveStatus(call)
                        return
                    }
                    if error != nil {
                        call.reject("Notification authorization unavailable")
                        return
                    }
                    if granted { UIApplication.shared.registerForRemoteNotifications() }
                    self.resolveStatus(call)
                }
            }
        }
    }
    @objc func stop(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.state.active = false
            self.state.generation += 1
            self.state.token = nil
            self.state.pendingNotification = nil
            UIApplication.shared.unregisterForRemoteNotifications()
            UNUserNotificationCenter.current().removeAllDeliveredNotifications()
            self.resolveStatus(call)
        }
    }
    func willPresent(notification: UNNotification) -> UNNotificationPresentationOptions {
        let active = Thread.isMainThread ? state.active : DispatchQueue.main.sync { state.active }
        guard active, let kind = notification.request.content.userInfo["kind"] as? String,
              ["wca_record", "comp_announcement", "comp_registration_open", "comp_registration_close"].contains(kind) else { return [] }
        return [.banner, .list, .sound]
    }
    func didReceive(response: UNNotificationResponse) {
        guard response.actionIdentifier == UNNotificationDefaultActionIdentifier else { return }
        DispatchQueue.main.async {
            self.state.recordTap(response.notification.request.content.userInfo)
        }
    }
    // Retained through cold startup; JS deduplicates listener + pending delivery.
    @objc func pendingNotification(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            call.resolve(self.state.pendingNotification.map { ["notification": $0] } ?? [:])
        }
    }
}

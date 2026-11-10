import UIKit
import UserNotifications
import Capacitor

@objc(TimerPrintPlugin)
final class TimerPrintPlugin: CAPPlugin, CAPBridgedPlugin {
    let identifier = "TimerPrintPlugin"
    let jsName = "TimerPrint"
    let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "print", returnType: CAPPluginReturnPromise)
    ]

    @objc func print(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard let webView = self.bridge?.webView,
                  let viewController = self.bridge?.viewController else {
                call.reject("System printing is unavailable")
                return
            }

            let controller = UIPrintInteractionController.shared
            let info = UIPrintInfo(dictionary: nil)
            info.jobName = call.getString("title") ?? "CubeRoot Timer"
            info.outputType = .general
            info.orientation = .portrait
            controller.printInfo = info
            controller.printFormatter = webView.viewPrintFormatter()

            let completion: UIPrintInteractionController.CompletionHandler = { _, completed, error in
                if let error {
                    call.reject(error.localizedDescription)
                    return
                }
                call.resolve(["completed": completed])
            }

            let presented: Bool
            if UIDevice.current.userInterfaceIdiom == .pad {
                presented = controller.present(
                    from: viewController.view.bounds,
                    in: viewController.view,
                    animated: true,
                    completionHandler: completion
                )
            } else {
                presented = controller.present(animated: true, completionHandler: completion)
            }
            if !presented {
                call.reject("Could not open system printing")
            }
        }
    }
}

@objc(NativeFilesPlugin)
final class NativeFilesPlugin: CAPPlugin, CAPBridgedPlugin {
    let identifier = "NativeFilesPlugin"
    let jsName = "NativeFiles"
    let pluginMethods: [CAPPluginMethod] = [CAPPluginMethod(name: "exportFile", returnType: CAPPluginReturnPromise)]
    private var busy = false
    @objc func exportFile(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard !self.busy, let presenter = self.bridge?.viewController, presenter.presentedViewController == nil else { call.reject("File export unavailable"); return }
            let name = call.getString("filename") ?? ""
            guard !name.isEmpty, name != ".", name != "..", !name.contains("/"), !name.contains("\\") else { call.reject("Invalid filename"); return }
            let folder = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString, isDirectory: true)
            do {
                try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
                let file = folder.appendingPathComponent(name)
                try Data((call.getString("text") ?? "").utf8).write(to: file, options: .atomic)
                let controller = UIActivityViewController(activityItems: [file], applicationActivities: nil)
                self.busy = true
                controller.completionWithItemsHandler = { _, completed, _, error in
                    self.busy = false
                    try? FileManager.default.removeItem(at: folder)
                    if let error { call.reject(error.localizedDescription) }
                    else { call.resolve(["completed": completed]) }
                }
                if let popover = controller.popoverPresentationController {
                    popover.sourceView = presenter.view
                    popover.sourceRect = presenter.view.bounds
                }
                presenter.present(controller, animated: true)
            } catch { try? FileManager.default.removeItem(at: folder); call.reject(error.localizedDescription) }
        }
    }
}

final class CubeRootBridgeViewController: CAPBridgeViewController {
    private let viewportPlugin = ViewportLayoutPlugin()

    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(viewportPlugin)
        bridge?.registerPluginInstance(TimerPrintPlugin())
        bridge?.registerPluginInstance(NativeFilesPlugin())
        bridge?.registerPluginInstance(ScreenAwakePlugin())
        bridge?.registerPluginInstance(AppleMembershipPlugin())
        bridge?.registerPluginInstance(RecordPushPlugin())
        bridge?.registerPluginInstance(WatchTimerPlugin())
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        // Keep older SDK builds working; these guides are optional host geometry.
        #if compiler(>=6.4)
        if #available(iOS 27.1, *) {
            _ = view.layoutGuide(for: .safeArea(cornerAdaptation: .vertical))
            _ = view.layoutGuide(for: .bar(onEdge: NSDirectionalRectEdge.leading, extent: 52))
            _ = view.layoutGuide(for: .bar(onEdge: NSDirectionalRectEdge.trailing, extent: 52))
        }
        #endif
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        viewportPlugin.publishLayout()
    }

    override func viewSafeAreaInsetsDidChange() {
        super.viewSafeAreaInsetsDidChange()
        viewportPlugin.publishLayout()
    }
}

/// Geometry only. All three navigation destinations remain in the shared React app.
@objc(ViewportLayoutPlugin)
final class ViewportLayoutPlugin: CAPPlugin, CAPBridgedPlugin {
    let identifier = "ViewportLayoutPlugin"
    let jsName = "ViewportLayout"
    let pluginMethods: [CAPPluginMethod] = [CAPPluginMethod(name: "getLayout", returnType: CAPPluginReturnPromise)]
    private var lastLayout: NSDictionary?

    private func layout() -> [String: Any] {
        guard let view = bridge?.viewController?.view else { return [:] }
        #if compiler(>=6.4)
        if #available(iOS 27.1, *) {
            let regions = view.reservedRegions(kind: .occlusion).filter(\.isActive)
            let edge = view.traitCollection.verticalBarEdge
            guard edge != .unspecified || !regions.isEmpty else { return [:] }
            let bounds = view.bounds
            var content = view.layoutGuide(for: .safeArea(cornerAdaptation: .vertical)).layoutFrame.intersection(bounds)
            var bar: CGRect?
            if edge != .unspecified {
                let directionalEdge: NSDirectionalRectEdge = edge == .leading ? .leading : .trailing
                let candidate = view.layoutGuide(for: .bar(onEdge: directionalEdge, extent: 52)).layoutFrame.intersection(bounds)
                if candidate.width >= 52 && candidate.height >= 148 {
                    bar = candidate
                    if candidate.midX > bounds.midX {
                        content.size.width = max(0, min(content.maxX, candidate.minX) - content.minX)
                    } else {
                        let right = content.maxX
                        content.origin.x = max(content.minX, candidate.maxX)
                        content.size.width = max(0, right - content.minX)
                    }
                }
            }
            guard content.width > 0, content.height > 0 else { return [:] }
            func rect(_ value: CGRect) -> [String: CGFloat] {
                ["x": value.minX, "y": value.minY, "width": value.width, "height": value.height]
            }
            var result: [String: Any] = ["bounds": rect(bounds), "content": rect(content)]
            if let bar { result["bar"] = rect(bar) }
            return result
        }
        #endif
        return [:]
    }

    @objc func getLayout(_ call: CAPPluginCall) {
        DispatchQueue.main.async { call.resolve(self.layout()) }
    }

    func publishLayout() {
        let current = layout()
        let dictionary = current as NSDictionary
        guard lastLayout == nil || !dictionary.isEqual(lastLayout!) else { return }
        lastLayout = dictionary
        notifyListeners("layoutChanged", data: current)
    }
}

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        window = UIWindow(windowScene: windowScene)
        window?.rootViewController = CubeRootBridgeViewController()
        window?.makeKeyAndVisible()

        if let response = connectionOptions.notificationResponse,
           response.actionIdentifier == UNNotificationDefaultActionIdentifier {
            RecordPushState.shared.recordTap(response.notification.request.content.userInfo)
        }
        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }
}

// Keep ownership while inactive, but never prevent idle sleep in the background.
@objc(ScreenAwakePlugin)
final class ScreenAwakePlugin: CAPPlugin, CAPBridgedPlugin {
    let identifier = "ScreenAwakePlugin"
    let jsName = "ScreenAwake"
    let pluginMethods: [CAPPluginMethod] = [CAPPluginMethod(name: "setKeepAwake", returnType: CAPPluginReturnPromise)]
    private var requested = false

    override func load() {
        NotificationCenter.default.addObserver(self, selector: #selector(refresh), name: UIApplication.didBecomeActiveNotification, object: nil)
        NotificationCenter.default.addObserver(self, selector: #selector(suspend), name: UIApplication.willResignActiveNotification, object: nil)
    }
    @objc private func refresh() {
        UIApplication.shared.isIdleTimerDisabled = requested && UIApplication.shared.applicationState == .active
    }
    @objc private func suspend() { UIApplication.shared.isIdleTimerDisabled = false }
    @objc func setKeepAwake(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.requested = call.getBool("enabled") ?? false
            self.refresh()
            call.resolve()
        }
    }
    deinit {
        NotificationCenter.default.removeObserver(self)
        DispatchQueue.main.async { UIApplication.shared.isIdleTimerDisabled = false }
    }
}

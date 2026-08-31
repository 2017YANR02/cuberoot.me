import UIKit
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

final class CubeRootBridgeViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(TimerPrintPlugin())
    }
}

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        window = UIWindow(windowScene: windowScene)
        window?.rootViewController = CubeRootBridgeViewController()
        window?.makeKeyAndVisible()

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }
}

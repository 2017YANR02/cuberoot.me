import Capacitor
import UIKit

@objc(TimerMoreMenuPlugin)
final class TimerMoreMenuPlugin: CAPPlugin, CAPBridgedPlugin {
    let identifier = "TimerMoreMenuPlugin"
    let jsName = "TimerMoreMenu"
    let pluginMethods: [CAPPluginMethod] = [CAPPluginMethod(name: "render", returnType: CAPPluginReturnPromise)]
    private var button: UIButton?

    @objc func render(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard let parent = self.bridge?.viewController, let webView = self.bridge?.webView,
                  let state = call.getObject("state"),
                  let frame = state["frame"] as? [String: Double],
                  let x = frame["x"], let y = frame["y"], let w = frame["width"], let h = frame["height"],
                  [x, y, w, h].allSatisfy(\.isFinite), w > 0, h > 0,
                  let label = state["label"] as? String,
                  let items = state["items"] as? [[String: Any]] else {
                self.button?.menu = nil
                self.button?.isHidden = true
                call.resolve(["rendered": false])
                return
            }

            let button = self.button ?? UIButton(type: .system)
            if self.button == nil {
                button.showsMenuAsPrimaryAction = true
                button.accessibilityTraits = .button
                // The shared top bar draws the trigger. This hit target opens UIKit's menu.
                parent.view.addSubview(button)
                self.button = button
            }
            button.frame = webView.convert(CGRect(x: x, y: y, width: w, height: h), to: parent.view)
            button.accessibilityLabel = label
            let actions = items.compactMap(self.menuAction)
            button.menu = UIMenu(children: actions)
            button.isHidden = actions.isEmpty
            call.resolve(["rendered": !actions.isEmpty])
        }
    }

    private func menuAction(_ item: [String: Any]) -> UIAction? {
        guard let id = item["id"] as? String, let label = item["label"] as? String else { return nil }
        let active = item["active"] as? Bool == true
        var attributes: UIMenuElement.Attributes = []
        if item["disabled"] as? Bool == true { attributes.insert(.disabled) }
        if item["danger"] as? Bool == true { attributes.insert(.destructive) }
        let symbols = [
            "more.marks": "shoeprints.fill",
            "more.stats-mobile": "chart.bar",
            "more.language-mobile": "globe",
            "more.drill": "scope",
            "more.bld-helper": "brain",
            "more.fullscreen": active ? "arrow.down.right.and.arrow.up.left" : "arrow.up.left.and.arrow.down.right",
            "more.manual-entry": "plus",
            "more.replay": "link",
            "more.solver": "wrench",
            "more.bulk": "list.bullet",
            "more.print": "printer",
            "more.clear-event": "trash"
        ]
        let image = symbols[id].flatMap { UIImage(systemName: $0) }
        return UIAction(title: label, image: image, attributes: attributes, state: active ? .on : .off) {
            [weak self] _ in self?.notifyListeners("select", data: ["id": id])
        }
    }
}

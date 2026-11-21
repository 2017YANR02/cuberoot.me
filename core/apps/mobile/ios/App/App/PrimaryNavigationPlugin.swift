import Capacitor
import SwiftUI
import UIKit

@available(iOS 16.4, *)
@objc(PrimaryNavigationPlugin)
final class PrimaryNavigationPlugin: CAPPlugin, CAPBridgedPlugin {
    let identifier = "PrimaryNavigationPlugin"
    let jsName = "PrimaryNavigation"
    let pluginMethods: [CAPPluginMethod] = [CAPPluginMethod(name: "setNavigation", returnType: CAPPluginReturnPromise)]
    private var overlay: UIHostingController<NavigationCapsule>?
    private var searchOverlay: UIHostingController<NavigationSearchButton>?
    private let model = NavigationCapsule.Model()

    @objc func setNavigation(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard let parent = self.bridge?.viewController, let webView = self.bridge?.webView else {
                call.resolve(["rendered": false])
                return
            }
            guard let state = call.getObject("state"),
                  let frame = state["frame"] as? [String: Double],
                  let x = frame["x"], let y = frame["y"],
                  let width = frame["width"], let height = frame["height"],
                  [x, y, width, height].allSatisfy(\.isFinite), width > 0, height > 0,
                  let rawItems = state["items"] as? [[String: Any]],
                  let selected = state["selected"] as? String else {
                self.overlay?.view.isHidden = true
                self.searchOverlay?.view.isHidden = true
                call.resolve(["rendered": false])
                return
            }
            let items = rawItems.compactMap(NavigationCapsule.Item.init)
            guard items.count == 3, Set(items.map(\.id)).count == items.count,
                  items.contains(where: { $0.id == selected }) else {
                self.overlay?.view.isHidden = true
                self.searchOverlay?.view.isHidden = true
                call.resolve(["rendered": false])
                return
            }

            let view = self.overlay ?? self.installOverlay(in: parent)
            view.overrideUserInterfaceStyle = state["dark"] as? Bool == true ? .dark : .light
            self.model.state = .init(items: items, selected: selected, vertical: state["vertical"] as? Bool == true)
            view.view.frame = webView.convert(CGRect(x: x, y: y, width: width, height: height), to: parent.view)
            view.view.isHidden = false

            if let search = state["search"] as? [String: Any],
               let frame = search["frame"] as? [String: Double],
               let x = frame["x"], let y = frame["y"],
               let width = frame["width"], let height = frame["height"],
               let label = search["label"] as? String,
               [x, y, width, height].allSatisfy(\.isFinite), width > 0, height > 0 {
                let action = NavigationSearchButton(
                    label: label, expanded: search["expanded"] as? Bool == true
                ) { [weak self] in self?.notifyListeners("select", data: ["id": "search"]) }
                let accessory = self.searchOverlay ?? UIHostingController(rootView: action)
                if self.searchOverlay == nil {
                    self.install(accessory, in: parent)
                    self.searchOverlay = accessory
                }
                accessory.rootView = action
                accessory.overrideUserInterfaceStyle = view.overrideUserInterfaceStyle
                accessory.view.frame = webView.convert(CGRect(x: x, y: y, width: width, height: height), to: parent.view)
                accessory.view.isHidden = false
            } else {
                self.searchOverlay?.view.isHidden = true
            }
            call.resolve(["rendered": true])
        }
    }

    private func installOverlay(in parent: UIViewController) -> UIHostingController<NavigationCapsule> {
        let controller = UIHostingController(rootView: NavigationCapsule(model: model) { [weak self] id in
            self?.notifyListeners("select", data: ["id": id])
        })
        install(controller, in: parent)
        overlay = controller
        return controller
    }

    private func install<Content: View>(_ controller: UIHostingController<Content>, in parent: UIViewController) {
        controller.safeAreaRegions = []
        parent.addChild(controller)
        controller.view.backgroundColor = .clear
        parent.view.addSubview(controller.view)
        controller.didMove(toParent: parent)
    }
}

@available(iOS 16.4, *)
private struct NavigationCapsule: View {
    struct Item: Identifiable, Equatable {
        let id: String
        let label: String
        let symbol: String
        let disabled: Bool

        init?(_ value: [String: Any]) {
            guard let id = value["id"] as? String, let label = value["label"] as? String else { return nil }
            switch id {
            case "timer": symbol = "clock"
            case "tools": symbol = "square.grid.2x2"
            case "account": symbol = "person"
            default: return nil
            }
            self.id = id
            self.label = label
            self.disabled = value["disabled"] as? Bool ?? false
        }
    }

    struct State: Equatable {
        var items: [Item] = []
        var selected = ""
        var vertical = false
    }

    final class Model: ObservableObject {
        @Published var state = State()
    }

    @ObservedObject var model: Model
    let onSelect: (String) -> Void
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @GestureState private var dragIndex: Int?

    var body: some View {
        GeometryReader { geometry in
            let state = model.state
            let vertical = state.vertical
            let slotWidth = vertical ? geometry.size.width : geometry.size.width / 3
            let slotHeight = vertical ? geometry.size.height / 3 : geometry.size.height
            let selectedIndex = state.items.firstIndex(where: { $0.id == state.selected }) ?? 0
            let highlightedIndex = CGFloat(dragIndex ?? selectedIndex)
            let layout = vertical ? AnyLayout(VStackLayout(spacing: 0)) : AnyLayout(HStackLayout(spacing: 0))

            ZStack(alignment: .topLeading) {
                Capsule()
                    .fill(Color(uiColor: .tertiarySystemFill))
                    .padding(4)
                    .frame(width: slotWidth, height: slotHeight)
                    .offset(x: vertical ? 0 : highlightedIndex * slotWidth, y: vertical ? highlightedIndex * slotHeight : 0)
                    .animation(reduceMotion ? nil : .spring(response: 0.32, dampingFraction: 0.8), value: highlightedIndex)
                    .allowsHitTesting(false)
                    .accessibilityHidden(true)

                layout {
                    ForEach(state.items) { item in
                        Button {
                            onSelect(item.id)
                        } label: {
                            NavigationIcon(symbol: item.symbol)
                                .frame(width: slotWidth, height: slotHeight)
                                .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                        .disabled(item.disabled)
                        .accessibilityLabel(Text(verbatim: item.label))
                        .accessibilityAddTraits(item.id == state.selected ? [.isSelected] : [])
                    }
                }
            }
            .contentShape(Capsule())
            .simultaneousGesture(
                DragGesture(minimumDistance: 10)
                    .updating($dragIndex) { drag, highlight, _ in
                        highlight = destination(for: drag, size: geometry.size, state: state)
                    }
                    .onEnded { drag in
                        if let index = destination(for: drag, size: geometry.size, state: state) {
                            onSelect(state.items[index].id)
                        }
                    }
            )
        }
        .modifier(NavigationGlass())
    }

    private func destination(for drag: DragGesture.Value, size: CGSize, state: State) -> Int? {
        let distance = state.vertical ? drag.translation.height : drag.translation.width
        let crossDistance = state.vertical ? drag.translation.width : drag.translation.height
        let length = state.vertical ? size.height : size.width
        let point = state.vertical ? drag.location.y : drag.location.x
        guard length > 0, abs(distance) > abs(crossDistance) else { return nil }

        let index = min(2, Int(max(0, point) / (length / 3)))
        return state.items.indices.contains(index) && !state.items[index].disabled ? index : nil
    }
}

private struct NavigationSearchButton: View {
    let label: String
    let expanded: Bool
    let action: () -> Void
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        Button(action: action) {
            ZStack {
                NavigationIcon(symbol: "magnifyingglass")
                    .opacity(expanded ? 0 : 1)
                    .scaleEffect(expanded ? 0.8 : 1)
                NavigationIcon(symbol: "xmark")
                    .opacity(expanded ? 1 : 0)
                    .scaleEffect(expanded ? 1 : 0.8)
            }
            .animation(reduceMotion ? nil : .easeInOut(duration: 0.18), value: expanded)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .contentShape(Circle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(Text(verbatim: label))
        .modifier(NavigationGlass())
    }
}

private struct NavigationIcon: View {
    let symbol: String

    var body: some View {
        Image(systemName: symbol)
            .font(.system(size: 22, weight: .medium))
            .frame(width: 24, height: 24)
    }
}

private struct NavigationGlass: ViewModifier {
    func body(content: Content) -> some View {
        #if compiler(>=6.2)
        if #available(iOS 26, *) {
            content.glassEffect(.regular.interactive(), in: .capsule)
        } else {
            content.background(.regularMaterial, in: Capsule())
        }
        #else
        content.background(.regularMaterial, in: Capsule())
        #endif
    }
}

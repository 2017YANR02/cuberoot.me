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
    private var systemCapsule: SystemNavigationCapsule?
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
                self.systemCapsule?.isHidden = true
                self.searchOverlay?.view.isHidden = true
                call.resolve(["rendered": false])
                return
            }
            let items = rawItems.compactMap(NavigationCapsule.Item.init)
            guard items.count == 3, Set(items.map(\.id)).count == items.count,
                  items.contains(where: { $0.id == selected }) else {
                self.overlay?.view.isHidden = true
                self.systemCapsule?.isHidden = true
                self.searchOverlay?.view.isHidden = true
                call.resolve(["rendered": false])
                return
            }

            let style: UIUserInterfaceStyle = state["dark"] as? Bool == true ? .dark : .light
            let vertical = state["vertical"] as? Bool == true
            let wasVertical = self.model.state.vertical
            self.model.state = .init(items: items, selected: selected, vertical: vertical)
            let capsule: UIView
            if #available(iOS 26, *), !vertical {
                let control = self.systemCapsule ?? self.installSystemCapsule(in: parent)
                self.overlay?.view.isHidden = true
                control.apply(items: items, selected: selected)
                control.overrideUserInterfaceStyle = style
                capsule = control
            } else {
                let overlay = self.overlay ?? self.installOverlay(in: parent)
                self.systemCapsule?.isHidden = true
                overlay.overrideUserInterfaceStyle = style
                capsule = overlay.view
            }
            let target = webView.convert(CGRect(x: x, y: y, width: width, height: height), to: parent.view)
            let current = capsule.frame
            if target != current {
                if !vertical && !wasVertical && !capsule.isHidden && !UIAccessibility.isReduceMotionEnabled
                    && current.minY == target.minY && current.size == target.size {
                    UIView.animate(withDuration: 0.2, delay: 0,
                                   options: [.beginFromCurrentState, .allowUserInteraction, .curveEaseInOut]) {
                        capsule.frame = target
                    }
                } else {
                    capsule.layer.removeAnimation(forKey: "position")
                    capsule.frame = target
                }
            }
            capsule.isHidden = false

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
                accessory.overrideUserInterfaceStyle = style
                accessory.view.frame = webView.convert(CGRect(x: x, y: y, width: width, height: height), to: parent.view)
                accessory.view.isHidden = false
            } else {
                self.searchOverlay?.view.isHidden = true
            }
            call.resolve(["rendered": true])
        }
    }

    private func installSystemCapsule(in parent: UIViewController) -> SystemNavigationCapsule {
        let control = SystemNavigationCapsule { [weak self] id in
            self?.notifyListeners("select", data: ["id": id])
        }
        control.isHidden = true
        parent.view.addSubview(control)
        systemCapsule = control
        return control
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

/// A standalone system tab bar with a hit region equal to the shared capsule frame.
@available(iOS 16.4, *)
private final class SystemNavigationCapsule: UIView, UITabBarDelegate {
    private let tabBar = UITabBar()
    private let onSelect: (String) -> Void
    private var ids: [String] = []
    private var committedSelection: String?
    private var pendingSelection: Task<Void, Never>?

    init(onSelect: @escaping (String) -> Void) {
        self.onSelect = onSelect
        super.init(frame: .zero)
        tabBar.delegate = self
        tabBar.tintColor = .label
        tabBar.unselectedItemTintColor = .label
        addSubview(tabBar)
    }

    required init?(coder: NSCoder) { nil }

    override func layoutSubviews() {
        super.layoutSubviews()
        // The floating pill is inset from the tab bar's side and bottom edges.
        tabBar.frame = CGRect(x: -22, y: -2, width: bounds.width + 44, height: bounds.height + 22)
    }

    func apply(items: [NavigationCapsule.Item], selected: String) {
        let incomingIDs = items.map(\.id)
        let replacedItems = incomingIDs != ids
        if replacedItems {
            ids = incomingIDs
            let configuration = UIImage.SymbolConfiguration(pointSize: 18, weight: .medium)
            tabBar.setItems(items.map { item in
                UITabBarItem(
                    title: nil,
                    image: UIImage(systemName: item.symbol, withConfiguration: configuration),
                    selectedImage: nil
                )
            }, animated: false)
        }
        let barItems = tabBar.items ?? []
        for (tab, item) in zip(barItems, items) {
            tab.accessibilityLabel = item.label
            tab.isEnabled = !item.disabled
        }
        // Geometry updates can arrive during a scrub. Only apply a new host selection.
        if replacedItems || selected != committedSelection || isHidden,
           let index = ids.firstIndex(of: selected), barItems.indices.contains(index) {
            pendingSelection?.cancel()
            tabBar.selectedItem = barItems[index]
            committedSelection = selected
        }
    }

    func tabBar(_ tabBar: UITabBar, didSelect item: UITabBarItem) {
        guard item.isEnabled,
              let index = tabBar.items?.firstIndex(where: { $0 === item }),
              ids.indices.contains(index) else { return }
        let id = ids[index]
        pendingSelection?.cancel()
        if id != committedSelection {
            // UIKit selects immediately. Restore the host selection if navigation was rejected.
            pendingSelection = Task { @MainActor [weak self] in
                try? await Task.sleep(for: .milliseconds(400))
                guard !Task.isCancelled, let self,
                      let index = self.ids.firstIndex(where: { $0 == self.committedSelection }),
                      let items = self.tabBar.items, items.indices.contains(index) else { return }
                self.tabBar.selectedItem = items[index]
            }
        }
        onSelect(id)
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

    private struct Touch {
        var progress: CGFloat?
    }

    @ObservedObject var model: Model
    let onSelect: (String) -> Void
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @GestureState private var touch: Touch?
    @State private var landingItem: String?
    @State private var settleTask: Task<Void, Never>?

    private static let settleDuration = 0.28
    private let lift = Animation.spring(response: 0.17, dampingFraction: 0.85)
    private var settle: Animation { .spring(response: Self.settleDuration, dampingFraction: 0.82) }

    var body: some View {
        GeometryReader { geometry in
            let state = model.state
            let vertical = state.vertical
            let slotWidth = vertical ? geometry.size.width : geometry.size.width / 3
            let slotHeight = vertical ? geometry.size.height / 3 : geometry.size.height
            let selectedIndex = state.items.firstIndex(where: { $0.id == state.selected }) ?? 0
            let landingIndex = state.items.firstIndex(where: { $0.id == landingItem && !$0.disabled })
            let dragPosition = touch?.progress
            let progress = dragPosition ?? CGFloat(landingIndex ?? selectedIndex)
            let raised = !reduceMotion && (touch != nil || landingIndex != nil)
            let alongScale: CGFloat = raised ? 1.20 : 1
            let crossScale: CGFloat = raised ? 1.24 : 1
            let layout = vertical ? AnyLayout(VStackLayout(spacing: 0)) : AnyLayout(HStackLayout(spacing: 0))

            ZStack(alignment: .topLeading) {
                NavigationSelectionLens(raised: raised)
                    .frame(
                        width: max(1, slotWidth - 8) * (vertical ? crossScale : alongScale),
                        height: max(1, slotHeight - 8) * (vertical ? alongScale : crossScale)
                    )
                    .animation(reduceMotion ? nil : (raised ? lift : settle), value: raised)
                    .position(x: slotWidth * (vertical ? 0.5 : progress + 0.5),
                              y: slotHeight * (vertical ? progress + 0.5 : 0.5))
                    .animation(reduceMotion || dragPosition != nil ? nil : settle, value: progress)
                    .allowsHitTesting(false)
                    .accessibilityHidden(true)

                layout {
                    ForEach(state.items) { item in
                        Button {
                            select(item)
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
                DragGesture(minimumDistance: 0)
                    .updating($touch) { drag, contact, _ in
                        guard state.items.contains(where: { !$0.disabled }) else { return }
                        contact = Touch(progress: position(
                            for: drag, size: geometry.size, state: state, tracking: contact?.progress != nil
                        ))
                    }
                    .onEnded { drag in
                        guard let progress = position(
                            for: drag, size: geometry.size, state: state, tracking: touch?.progress != nil
                        ) else { return }
                        let index = Int(progress.rounded())
                        guard state.items.indices.contains(index) else { return }
                        select(state.items[index])
                    }
            )
        }
        .modifier(NavigationGlass(interactive: false))
        .onDisappear {
            settleTask?.cancel()
            landingItem = nil
        }
    }

    private func position(for drag: DragGesture.Value, size: CGSize, state: State, tracking: Bool) -> CGFloat? {
        let distance = state.vertical ? drag.translation.height : drag.translation.width
        let crossDistance = state.vertical ? drag.translation.width : drag.translation.height
        let length = state.vertical ? size.height : size.width
        let start = state.vertical ? drag.startLocation.y : drag.startLocation.x
        guard length > 0, tracking || (abs(distance) >= 2 && abs(distance) > abs(crossDistance)) else { return nil }

        // Preserve the original offset between the finger and the lens center.
        let slotLength = length / 3
        let startSlot = min(2, max(0, (start / slotLength).rounded(.down)))
        return min(2, max(0, startSlot + distance / slotLength))
    }

    private func select(_ item: Item) {
        guard !item.disabled else { return }
        if !reduceMotion {
            // Start settling locally while the host commits the destination.
            settleTask?.cancel()
            landingItem = item.id
            settleTask = Task { @MainActor in
                try? await Task.sleep(for: .seconds(Self.settleDuration))
                guard !Task.isCancelled else { return }
                landingItem = nil
            }
        }
        onSelect(item.id)
    }
}

private struct NavigationSelectionLens: View {
    let raised: Bool
    @Namespace private var lensNamespace
    @Environment(\.accessibilityReduceTransparency) private var reduceTransparency

    var body: some View {
        ZStack {
            Capsule()
                .fill(Color(uiColor: .tertiarySystemFill))
                .opacity(usesGlass ? 0 : 1)
            #if compiler(>=6.2)
            if #available(iOS 26, *) {
                // Keep the moving lens separate from the bar's fixed backdrop.
                GlassEffectContainer {
                    if usesGlass {
                        Color.clear
                            .glassEffect(.regular.interactive(), in: .capsule)
                            .glassEffectID("selection", in: lensNamespace)
                            .glassEffectTransition(.materialize)
                    }
                }
            }
            #endif
        }
    }

    private var usesGlass: Bool {
        #if compiler(>=6.2)
        if #available(iOS 26, *) { return raised && !reduceTransparency }
        #endif
        return false
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
    var interactive = true

    func body(content: Content) -> some View {
        #if compiler(>=6.2)
        if #available(iOS 26, *) {
            content.glassEffect(.regular.interactive(interactive), in: .capsule)
        } else {
            content.background(.regularMaterial, in: Capsule())
        }
        #else
        content.background(.regularMaterial, in: Capsule())
        #endif
    }
}

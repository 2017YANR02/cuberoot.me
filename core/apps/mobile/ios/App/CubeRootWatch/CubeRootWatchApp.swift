import SwiftUI

@main
struct CubeRootWatchApp: App {
    @StateObject private var model = WatchTimerModel()
    @Environment(\.scenePhase) private var scenePhase
    var body: some Scene {
        WindowGroup {
            NavigationStack {
                #if targetEnvironment(simulator)
                if ProcessInfo.processInfo.arguments.contains("--cube-scene-preview") {
                    WatchScenePreview()
                } else if ProcessInfo.processInfo.arguments.contains("--cube-replay-preview"),
                          let json = ProcessInfo.processInfo.environment["CUBEROOT_REPLAY"],
                          let record = try? JSONDecoder().decode(WatchTimerRecord.self, from: Data(json.utf8)) {
                    WatchReplayView(record: record, language: "zh")
                } else { WatchTimerView(model: model) }
                #else
                WatchTimerView(model: model)
                #endif
            }
                .onChange(of: scenePhase) { _, value in model.sceneActive(value == .active, state: String(describing: value)) }
        }
    }
}

#if targetEnvironment(simulator)
/** Exercises the production native mesh adapter; never compiled into a device app. */
private struct WatchScenePreview: View {
    @StateObject private var display = WatchCubeScene()
    var body: some View {
        WatchLiveCubeView(display: display, language: "zh")
            .onAppear {
                display.receive(["kind": "snapshot", "facelets": "UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB"], now: 1000)
            }
            .task {
                guard let json = ProcessInfo.processInfo.environment["CUBEROOT_SCENE_EVENTS"],
                      let events = try? JSONSerialization.jsonObject(with: Data(json.utf8)) as? [[String: Any]] else { return }
                var time = 1000.0
                for var event in events {
                    do { try await Task.sleep(for: .seconds(1)) } catch { return }
                    time += 1000; event["timestamp"] = time
                    display.receive(event, now: time)
                }
            }
    }
}
#endif

struct WatchTimerView: View {
    @ObservedObject var model: WatchTimerModel
    @State private var showsCube = false
    var body: some View {
        GeometryReader { geometry in
            ScrollView {
                VStack(spacing: 8) {
                    // One tap surface covers the full content viewport, including whitespace.
                    // Controls are siblings so opening the device picker cannot start a solve.
                    VStack(spacing: 8) {
                        if model.phase != "running", let slot = model.state.current {
                            Text([slot.eventName, model.text("random"), slot.sessionName]
                                .filter { !$0.isEmpty }.joined(separator: " · "))
                                .font(.caption2).lineLimit(1).minimumScaleFactor(0.85)
                            WatchScrambleText(scramble: slot.scramble, slotID: slot.id, cube: model.cube)
                                .font(.system(.footnote, design: .monospaced))
                                .frame(maxWidth: .infinity, alignment: .leading)
                        }
                        Text(model.display)
                            .font(.system(size: model.phase == "running" ? 42 : 36, weight: .semibold, design: .rounded))
                            .monospacedDigit().minimumScaleFactor(0.5).lineLimit(1)
                            .padding(.vertical, 8)
                        WatchCubePreview(model: model, cube: model.cube)
                        if model.state.current == nil {
                            Text(model.text(model.generating ? "generating" : model.generationFailed ? "generationFailed" : model.state.unsupported ? "unsupported" : "empty")).font(.footnote)
                        }
                    }
                    .padding(.horizontal, 4)
                    .frame(maxWidth: .infinity, minHeight: model.phase == "running" ? geometry.size.height : 0)
                    .contentShape(Rectangle())
                    .onTapGesture { model.tapTimer() }
                    .accessibilityAction { model.tapTimer() }
                    if model.generationFailed {
                        Button(model.text("retryGeneration")) { model.retryGeneration() }
                    }
                    if let error = model.errorKey {
                        Text(model.text(error)).font(.footnote)
                        if error == "storageError" { Button(model.text("retry")) { model.retryStorage() } }
                    }
                    if model.phase == "inspecting" {
                        Button(model.text("cancel")) { model.cancelInspection() }
                    }
                    if model.state.outbox.count >= 1000 { Text(model.text("full")).font(.footnote) }
                    if !model.state.outbox.isEmpty { Text(model.text("pending")).font(.caption2) }
                    if model.phase != "running" {
                        HStack(spacing: 8) {
                            if model.state.lastSolve?.moves?.isEmpty == false {
                                Button { model.reviewing = true } label: {
                                    Text(model.text("replay")).frame(maxWidth: .infinity)
                                }
                            }
                            Button { showsCube = true } label: {
                                Text(model.text("cube")).frame(maxWidth: .infinity)
                            }
                        }
                        .font(.caption2)
                    }
                }
            }
            .scrollDisabled(model.phase == "running")
        }
        .onAppear {
            #if DEBUG
            // Device tools cannot tap watchOS; inspect the existing persisted
            // solve without synthesizing a record or changing its contents.
            if ProcessInfo.processInfo.arguments.contains("--review-last-solve"), model.state.lastSolve != nil {
                model.reviewing = true
            }
            #endif
        }
        .sheet(isPresented: $showsCube) { WatchCubePicker(model: model, cube: model.cube) }
        .sheet(isPresented: $model.reviewing) {
            NavigationStack {
                if let record = model.state.lastSolve { WatchReplayView(record: record, language: model.state.language, display: model.replayDisplay, history: model.state.history ?? model.state.outbox, onUseScramble: { model.useReplayScramble(record) }, onFeedback: { model.replayFeedback(record, ok: $0) }) }
            }
        }
        .onChange(of: model.state.lastSolve?.id) { _, _ in
            if model.state.lastSolve?.moves?.isEmpty == false { model.reviewing = true }
        }
    }
}

/** watchOS has no SwiftUI DisclosureGroup; retain the report's disclosure interaction. */
/// SwiftUI's equivalent of the report's inline wrapping. All notation and grouping
/// arrive from StepMoveList's shared projection; this only measures native views.
private struct WatchReportFlow: Layout {
    private func arrange(_ subviews: Subviews, width: CGFloat) -> (CGSize, [CGPoint]) {
        var points: [CGPoint] = []
        var x: CGFloat = 0, y: CGFloat = 0, rowHeight: CGFloat = 0
        var row: [(index: Int, height: CGFloat)] = []
        func alignRow() {
            for item in row { points[item.index].y += (rowHeight - item.height) / 2 }
            row.removeAll(keepingCapacity: true)
        }
        for subview in subviews {
            let size = subview.sizeThatFits(.unspecified)
            if x > 0 && x + size.width > width { alignRow(); x = 0; y += rowHeight + 4; rowHeight = 0 }
            row.append((points.count, size.height))
            points.append(CGPoint(x: x, y: y))
            x += size.width + 4
            rowHeight = max(rowHeight, size.height)
        }
        alignRow()
        return (CGSize(width: width, height: y + rowHeight), points)
    }
    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let width = proposal.width.flatMap { $0.isFinite && $0 > 0 ? $0 : nil } ?? 180
        return arrange(subviews, width: width).0
    }
    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let (_, points) = arrange(subviews, width: bounds.width)
        for (index, subview) in subviews.enumerated() {
            subview.place(at: CGPoint(x: bounds.minX + points[index].x, y: bounds.minY + points[index].y),
                          proposal: ProposedViewSize(subview.sizeThatFits(.unspecified)))
        }
    }
}

/// Native drawing only. The shared report sends every section, label, row and action.
private struct WatchReportNodeView: View {
    let node: ReportNode
    @ObservedObject var display: WatchCubeScene
    let replay: WatchReplayState
    let language: String
    let dispatch: (ReportAction) -> Void
    private func child(_ item: ReportNode) -> WatchReportNodeView {
        WatchReportNodeView(node: item, display: display, replay: replay, language: language, dispatch: dispatch)
    }
    private func icon(_ value: String) -> String {
        ["check":"checkmark", "copy":"doc.on.doc", "share":"square.and.arrow.up", "thumb-up":"hand.thumbsup", "thumb-down":"hand.thumbsdown", "start":"backward.end.fill", "end":"forward.end.fill", "back":"backward.frame.fill", "next":"forward.frame.fill", "play":"play.fill", "pause":"pause.fill", "swap":"arrow.left.arrow.right"][value] ?? value
    }
    private func fill(_ value: String) -> Color {
        let v = UInt32(value.replacingOccurrences(of: "#", with: ""), radix: 16) ?? 0
        return Color(red: Double((v >> 16) & 255)/255, green: Double((v >> 8) & 255)/255, blue: Double(v & 255)/255)
    }
    private var label: some View {
        HStack(spacing: 3) {
            if let image = node.icon { Image(systemName: icon(image)) }
            else { Text(node.text ?? "") }
            ForEach(node.children ?? []) { child($0) }
        }.accessibilityLabel(node.text ?? "")
    }
    // Inline text is split only for native line measurement, never for analysis or seek rules.
    private func fragments(_ items: [ReportNode], prefix: String = "") -> [ReportNode] {
        items.flatMap { item -> [ReportNode] in
            let path = prefix + item.id + ":"
            if item.kind == "group", item.layout == "flow" { return fragments(item.children ?? [], prefix: path) }
            if item.kind == "moves", let tokens = item.tokens, item.action != nil {
                return tokens.enumerated().map { index, token in
                    ReportNode(id: path + String(index), kind: "button", text: token.token, className: item.className, action: token.before)
                }
            }
            if item.kind == "text", item.href == nil {
                return (item.text ?? "").split(separator: " ", omittingEmptySubsequences: true).enumerated().map { index, word in
                    ReportNode(id: path + String(index), kind: "text", text: String(word), className: item.className, title: item.title)
                }
            }
            return [ReportNode(id: path, kind: item.kind, text: item.text, className: item.className, layout: item.layout, title: item.title, icon: item.icon, children: item.children, action: item.action, disabled: item.disabled, selected: item.selected, value: item.value, options: item.options, columns: item.columns, rows: item.rows, state: item.state, href: item.href, fills: item.fills, tokens: item.tokens, segments: item.segments)]
        }
    }
    var body: some View {
        rendered.opacity(node.state == "future" ? 0.42 : 1)
            .foregroundStyle(node.state == "now" || node.selected == true ? Color.accentColor : Color.primary)
    }
    private var rendered: AnyView {
        if let href = node.href, let url = URL(string: href.hasPrefix("/") ? "https://cuberoot.me" + (language == "zh" ? "/zh" : "") + href : href) {
            var content = node; content.href = nil
            return AnyView(Link(destination: url) { child(content) })
        }
        switch node.kind {
        case "text":
            return AnyView(Text(node.text ?? "").fixedSize(horizontal: false, vertical: true)
                .font(node.className == "rc-summary-big" ? .title3.monospacedDigit() : .caption)
                .help(node.title ?? ""))
        case "color":
            return AnyView(HStack(spacing: 0) { ForEach(Array((node.fills ?? []).enumerated()), id: \.offset) { _, color in Rectangle().fill(fill(color)).frame(width: 7, height: 10) } })
        case "button":
            if node.action?.type == "share", let url = URL(string: replay.shareUrl) {
                return AnyView(ShareLink(item: url) { label }.disabled(node.disabled == true))
            }
            if node.action?.type == "copy-notation" {
                return AnyView(ShareLink(item: replay.clipboard) { label }.disabled(node.disabled == true))
            }
            return AnyView(Button { if let action = node.action { dispatch(action) } } label: { label }
                .buttonStyle(.plain).disabled(node.disabled == true).padding(.vertical, 3).help(node.title ?? ""))
        case "toggle":
            return AnyView(Toggle(node.text ?? "", isOn: Binding(get: { node.value?.bool ?? false }, set: { value in
                if var action = node.action { action.value = .bool(value); dispatch(action) }
            })))
        case "select":
            return AnyView(Picker(node.text ?? "", selection: Binding(get: { node.value?.number ?? 0 }, set: { value in
                if var action = node.action { action.value = .number(value); dispatch(action) }
            })) { ForEach(node.options ?? [], id: \.value) { Text($0.label).tag($0.value) } }.pickerStyle(.navigationLink))
        case "bar":
            return AnyView(GeometryReader { geometry in
                HStack(spacing: 0) { ForEach(node.segments ?? []) { segment in
                    Rectangle().fill(Color.accentColor.opacity(max(0.4,1-Double(segment.tone)*0.12))).frame(width: geometry.size.width*segment.fraction).accessibilityLabel(segment.label)
                } }
            }.frame(height: 8).accessibilityLabel(node.text ?? ""))
        case "moves":
            return AnyView(WatchReportFlow { ForEach(fragments([node])) { item in
                if item.kind == "moves" { Text(item.text ?? "").font(.caption.monospaced()) }
                else { child(item).font(.caption.monospaced()) }
            } })
        case "disclosure":
            return AnyView(VStack(alignment: .leading, spacing: 8) {
                Button { if let action = node.action { dispatch(action) } } label: {
                    HStack { Text(node.text ?? ""); Spacer(); Image(systemName: node.selected == true ? "chevron.down" : "chevron.right") }
                }.buttonStyle(.plain)
                if node.selected == true { ForEach(node.children ?? []) { child($0) } }
            })
        case "table":
            return AnyView(ScrollView(.horizontal) {
                Grid(alignment: .leading, horizontalSpacing: 12, verticalSpacing: 8) {
                    GridRow { Text(" "); ForEach(node.columns ?? []) { child($0).fixedSize() } }
                    ForEach(node.rows ?? []) { row in
                        GridRow { Text(row.label); ForEach(row.cells) { child($0).fixedSize() } }
                    }
                }.font(.caption.monospacedDigit()).fixedSize()
            }.defaultScrollAnchor(.leading))
        case "slot":
            switch node.id {
            case "cube": return AnyView(WatchLiveCubeView(display: display, language: language))
            case "elapsed": return AnyView(Text(replay.timeText).font(.caption.monospacedDigit()))
            case "timeline": return AnyView(timeline)
            default: return AnyView(EmptyView())
            }
        default:
            if node.layout == "flow" { return AnyView(WatchReportFlow { ForEach(fragments(node.children ?? [])) { child($0) } }) }
            if node.layout == "row" { return AnyView(ViewThatFits(in: .horizontal) {
                HStack(alignment: .center, spacing: 6) { ForEach(node.children ?? []) { child($0).fixedSize(horizontal: true, vertical: false) } }
                VStack(alignment: .leading, spacing: 6) { ForEach(node.children ?? []) { child($0) } }
            }) }
            return AnyView(VStack(alignment: .leading, spacing: 8) { ForEach(node.children ?? []) { child($0) } }.frame(maxWidth: .infinity, alignment: .leading))
        }
    }
    private var timeline: some View {
        VStack(spacing: 4) {
            Slider(value: Binding(get: { replay.timeMs }, set: { dispatch(ReportAction(type: "time", value: .number($0))) }), in: 0...max(1, replay.totalMs))
            GeometryReader { geometry in
                ZStack(alignment: .leading) {
                    ForEach(replay.timelineSegments) { segment in
                        Rectangle().fill(Color.accentColor.opacity(segment.pause ? 0.26 : max(0.64, 1 - Double(segment.shade) * 0.12)))
                            .frame(width: max(0, geometry.size.width * (segment.toMs-segment.fromMs)/max(1,replay.totalMs)))
                            .offset(x: geometry.size.width*segment.fromMs/max(1,replay.totalMs))
                    }
                }
            }.frame(height: 8)
            GeometryReader { geometry in
                HStack(spacing: 1) {
                    ForEach(replay.timeline) { stage in
                        Button { dispatch(ReportAction(type: "time", value: .number(stage.fromMs))) } label: {
                            VStack(spacing: 2) { Text(stage.timeText); Text(stage.label) }.font(.system(size: 8)).lineLimit(1)
                                .frame(width: max(1,(geometry.size.width-CGFloat(replay.timeline.count))*stage.ms/max(1,replay.totalMs)),height:28)
                        }.buttonStyle(.plain)
                    }
                }
            }.frame(height: 28)
        }
    }
}

private struct WatchReplayView: View {
    let record: WatchTimerRecord
    let language: String
    @StateObject var display = WatchCubeScene()
    var history: [WatchTimerRecord] = []
    var onUseScramble: (() -> Void)? = nil
    var onFeedback: ((Bool?) -> Void)? = nil
    @State private var appliedEffect = 0
    @Environment(\.scenePhase) private var scenePhase
    var body: some View {
        ScrollView {
            if let replay = display.replay, let document = replay.document {
                WatchReportNodeView(node: document, display: display, replay: replay, language: language) { action in
                    display.command(["kind":"replay-action", "action":action.object])
                }
            } else { ProgressView() }
        }
        .onAppear {
            display.setReplayVisible(true)
            display.setAwake(scenePhase == .active, foreground: scenePhase != .background)
            guard let json = try? WatchTimerDisk.json(record),
                  let object = try? JSONSerialization.jsonObject(with: Data(json.utf8)) else { return }
            let historyObjects = (try? JSONSerialization.jsonObject(with: JSONEncoder().encode(history))) ?? []
            display.command(["kind":"replay-load", "record":object, "language":language, "history":historyObjects, "capabilities":[
                "canUse":onUseScramble != nil, "canFeedback":onFeedback != nil,
                "date":["short":Date(timeIntervalSince1970: record.ts / 1000).formatted(date: .numeric, time: .omitted),
                        "full":Date(timeIntervalSince1970: record.ts / 1000).formatted(date: .numeric, time: .standard)]
            ]])
        }
        .onChange(of: display.replay?.effect?.id) { _, _ in
            guard let effect = display.replay?.effect, effect.id > appliedEffect else { return }
            appliedEffect = effect.id
            if effect.type == "feedback" { onFeedback?(effect.value) }
            if effect.type == "use-scramble" { onUseScramble?() }
        }
        .onDisappear { display.setReplayVisible(false) }
        .onChange(of: scenePhase) { _, phase in display.setAwake(phase == .active, foreground: phase != .background) }
    }
}

private struct WatchScrambleText: View {
    let scramble: String
    let slotID: String
    @ObservedObject var cube: WatchCubeConnection
    private var content: AttributedString {
        guard cube.phase == "connected", let guidance = cube.guidance, guidance.contextId == slotID else {
            return AttributedString(scramble)
        }
        if guidance.matched == true {
            var text = AttributedString(scramble)
            text.foregroundColor = Color(uiColor: .lightGray)
            return text
        }
        guard let hint = guidance.hint else { return AttributedString(scramble) }
        var parts: [(String, Color)] = hint.done.map { ($0, Color(uiColor: .lightGray)) }
        if let current = hint.current { parts.append((current, .green)) }
        parts += hint.pending.map { ($0, .primary) }
        var text = AttributedString()
        for (index, part) in parts.enumerated() {
            var token = AttributedString((index == 0 ? "" : " ") + part.0)
            token.foregroundColor = part.1
            text.append(token)
        }
        return text
    }
    var body: some View { Text(content) }
}

private struct WatchCubePreview: View {
    @ObservedObject var model: WatchTimerModel
    @ObservedObject var cube: WatchCubeConnection
    var body: some View {
        if cube.phase == "connected" {
            WatchLiveCubeView(display: cube.display, language: model.state.language)
            if cube.timingLate { Text(model.text("timingLate")).font(.footnote) }
            if model.phase != "running" { if cube.canReset { WatchCubeResetControl(model: model, cube: cube) } }
        } else if model.phase != "running", let facelets = model.state.current?.localFacelets {
            WatchLocalScramblePreview(facelets: facelets, label: model.text("preview"), cube: cube)
        } else if model.phase != "running", let png = model.state.current?.previewPng,
                  let data = Data(base64Encoded: png), let preview = UIImage(data: data) {
            Image(uiImage: preview).resizable().scaledToFit()
                .frame(maxWidth: 120, maxHeight: 100)
                .accessibilityLabel(model.text("preview"))
        }
    }
}

private struct WatchLocalScramblePreview: View {
    let facelets: String
    let label: String
    let cube: WatchCubeConnection
    @State private var preview: WatchCubeConnection.ScramblePreview?
    var body: some View {
        Canvas { context, size in
            guard let preview else { return }
            let scale = size.width / preview.width
            for cell in preview.cells {
                let path = Path(CGRect(x: cell.x * scale, y: cell.y * scale, width: scale, height: scale))
                context.fill(path, with: .color(Color(red: cell.color[0], green: cell.color[1], blue: cell.color[2])))
                context.stroke(path, with: .color(.black), lineWidth: preview.stroke * scale)
            }
        }
        // Keep a real, sized view mounted while loading. An initially empty
        // Group has no child whose onAppear can initialize the preview.
        .frame(width: 120, height: preview.map { 120 * $0.height / $0.width } ?? 91)
        .accessibilityLabel(label)
        .task(id: facelets) { preview = cube.scramblePreview(facelets) }
    }
}

private struct WatchCubeResetControl: View {
    @ObservedObject var model: WatchTimerModel
    @ObservedObject var cube: WatchCubeConnection
    var body: some View {
        VStack(spacing: 6) {
            Button(model.text("resetState")) { cube.resetCube() }
                .disabled(cube.resetPhase == "pending" || model.phase == "running")
            Text(model.text("resetGyroHint")).font(.footnote)
            if cube.resetPhase == "pending" { ProgressView() }
            if cube.resetPhase == "success" { Text(model.text("stateReset")).font(.footnote) }
            if cube.resetPhase == "failed" { Text(model.text("resetFailed")).font(.footnote) }
        }
    }
}

struct WatchCubePicker: View {
    @ObservedObject var model: WatchTimerModel
    @ObservedObject var cube: WatchCubeConnection
    var body: some View {
        ScrollView {
            VStack(spacing: 10) {
                if cube.phase == "connected" {
                    Text(cube.name).font(.headline)
                    Text(model.text("connected"))
                    if cube.canReset { WatchCubeResetControl(model: model, cube: cube) }
                    if let battery = cube.battery { Text("\(battery)%") }
                    if !cube.lastMove.isEmpty { Text(cube.lastMove).font(.title2.monospaced()) }
                    Button(model.text("disconnect")) { cube.disconnect() }
                } else if cube.macPrompt {
                    Text(model.text("macHint")).font(.footnote)
                    TextField("AA:BB:CC:DD:EE:FF", text: $cube.macInput)
                    if cube.macInvalid { Text(model.text("macInvalid")).font(.footnote) }
                    Button(model.text("macConfirm")) { cube.submitMac() }
                    Button(model.text("macCancel")) { cube.cancelMac() }
                } else if cube.phase == "connecting" {
                    ProgressView(model.text("connecting"))
                } else {
                    if !cube.error.isEmpty { Text(model.text(cube.error)).font(.footnote) }
                    ForEach(cube.devices) { device in
                        Button(device.name) { cube.select(device.id) }
                    }
                    if cube.phase == "scanning" { Text(model.text("scanning")).font(.footnote) }
                    else {
                        if cube.devices.isEmpty { Text(model.text("noCube")).font(.footnote) }
                        Button(model.text("scan")) { cube.scan() }
                    }
                }
            }
        }
        .navigationTitle(model.text("cube"))
        .onAppear { if cube.phase != "connected" && cube.phase != "connecting" { cube.scan() } }
        .onDisappear { cube.stopScan() }
    }
}

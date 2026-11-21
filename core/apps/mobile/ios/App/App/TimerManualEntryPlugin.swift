import Capacitor
import SwiftUI
import UIKit

@objc(TimerManualEntryPlugin)
final class TimerManualEntryPlugin: CAPPlugin, CAPBridgedPlugin, UIAdaptivePresentationControllerDelegate {
    let identifier = "TimerManualEntryPlugin"
    let jsName = "TimerManualEntry"
    let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "present", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "update", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "dismiss", returnType: CAPPluginReturnPromise)
    ]

    private var model: ManualEntrySheetModel?
    private var controller: UIViewController?
    private var sheetId: String?

    @objc func present(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard let parent = self.bridge?.viewController, parent.viewIfLoaded?.window != nil,
                  parent.presentedViewController == nil, self.controller == nil,
                  let config = ManualEntrySheetConfig(call) else {
                call.resolve(["presented": false])
                return
            }

            let model = ManualEntrySheetModel { [weak self] type, revision, input in
                guard let self else { return }
                if type == "dismiss" {
                    self.close(id: config.id, notify: true)
                } else {
                    if type == "save" { self.controller?.isModalInPresentation = true }
                    self.notifyListeners("sheetEvent", data: [
                        "id": config.id, "type": type, "revision": revision, "input": input
                    ])
                }
            }
            let view = ManualEntrySheetView(config: config, model: model)
            let controller = UIHostingController(rootView: view)
            controller.modalPresentationStyle = .pageSheet
            controller.presentationController?.delegate = self
            if let sheet = controller.sheetPresentationController {
                sheet.detents = [.medium(), .large()]
                sheet.prefersGrabberVisible = true
                sheet.prefersEdgeAttachedInCompactHeight = true
            }
            self.model = model
            self.controller = controller
            self.sheetId = config.id
            parent.present(controller, animated: true) { [weak model] in model?.ready = true }
            call.resolve(["presented": true])
        }
    }

    @objc func update(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            if call.getString("id") == self.sheetId, let model = self.model,
               call.getInt("revision") == model.revision {
                model.feedback = call.getString("message")
                model.moveCount = call.getInt("moveCount")
                model.canSave = call.getBool("canSave") == true
                if call.getBool("saveFailed") == true {
                    model.busy = false
                    self.controller?.isModalInPresentation = false
                }
            }
            call.resolve()
        }
    }

    @objc func dismiss(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            if let id = call.getString("id") { self.close(id: id, notify: false) }
            call.resolve()
        }
    }

    private func close(id: String, notify: Bool) {
        guard id == sheetId, let controller else { return }
        sheetId = nil
        controller.dismiss(animated: true) { [weak self] in
            self?.controller = nil
            self?.model = nil
            if notify { self?.notifyListeners("sheetEvent", data: ["id": id, "type": "dismiss"]) }
        }
    }

    func presentationControllerDidDismiss(_ presentationController: UIPresentationController) {
        guard presentationController.presentedViewController === controller, let id = sheetId else { return }
        sheetId = nil
        controller = nil
        model = nil
        notifyListeners("sheetEvent", data: ["id": id, "type": "dismiss"])
    }
}

private struct ManualEntryField: Identifiable {
    let id: String
    let label: String
    let placeholder: String
    let keyboard: UIKeyboardType
    let multiline: Bool

    init?(_ value: [String: Any]) {
        guard let key = value["key"] as? String, let label = value["label"] as? String,
              let placeholder = value["placeholder"] as? String else { return nil }
        id = key
        self.label = label
        self.placeholder = placeholder
        multiline = value["multiline"] as? Bool == true
        switch value["keyboard"] as? String {
        case "number": keyboard = .numberPad
        case "time": keyboard = .numbersAndPunctuation
        default: keyboard = .default
        }
    }
}

private struct ManualEntrySheetConfig {
    let id: String
    let title: String
    let cancel: String
    let save: String
    let penalty: String?
    let resultFields: [ManualEntryField]
    let notesFields: [ManualEntryField]

    init?(_ call: CAPPluginCall) {
        guard let id = call.getString("id"), let title = call.getString("title"),
              let cancel = call.getString("cancel"), let save = call.getString("save"),
              let result = call.getArray("resultFields", [String: Any].self),
              let notes = call.getArray("notesFields", [String: Any].self) else { return nil }
        self.id = id
        self.title = title
        self.cancel = cancel
        self.save = save
        penalty = call.getString("penalty")
        resultFields = result.compactMap(ManualEntryField.init)
        notesFields = notes.compactMap(ManualEntryField.init)
        guard !resultFields.isEmpty else { return nil }
    }
}

private final class ManualEntrySheetModel: ObservableObject {
    @Published private(set) var input = ["penalty": "ok"]
    @Published var feedback: String?
    @Published var moveCount: Int?
    @Published var canSave = false
    @Published var ready = false
    @Published var busy = false
    private(set) var revision = 0
    private let send: (String, Int, [String: String]) -> Void

    init(send: @escaping (String, Int, [String: String]) -> Void) {
        self.send = send
    }

    func binding(_ key: String) -> Binding<String> {
        Binding(get: { self.input[key] ?? "" }, set: { value in
            guard !self.busy, (self.input[key] ?? "") != value else { return }
            self.input[key] = value
            self.revision += 1
            self.send("change", self.revision, self.input)
        })
    }

    func cancel() {
        if !busy { send("dismiss", revision, input) }
    }

    func save() {
        guard canSave && !busy else { return }
        busy = true
        send("save", revision, input)
    }
}

private struct ManualEntrySheetView: View {
    let config: ManualEntrySheetConfig
    @ObservedObject var model: ManualEntrySheetModel
    @FocusState private var focusedField: String?

    var body: some View {
        NavigationView {
            Form {
                Section {
                    ForEach(config.resultFields) { field($0) }
                    if let feedback = model.feedback {
                        Text(feedback).font(.footnote).foregroundStyle(.secondary)
                    }
                }
                if let penalty = config.penalty {
                    Section(header: Text(penalty)) {
                        Picker(penalty, selection: model.binding("penalty")) {
                            Text("OK").tag("ok")
                            Text("+2").tag("+2")
                            Text("DNF").tag("DNF")
                            Text("DNS").tag("DNS")
                        }
                        .pickerStyle(.segmented)
                    }
                }
                ForEach(config.notesFields) { note in
                    Section(header: Text(note.label)) { editor(note) }
                }
            }
            .disabled(model.busy)
            .navigationTitle(config.title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(config.cancel, action: model.cancel).disabled(model.busy)
                }
                ToolbarItem(placement: .confirmationAction) {
                    if model.busy { ProgressView() }
                    else { Button(config.save, action: model.save).disabled(!model.canSave) }
                }
            }
        }
        .navigationViewStyle(.stack)
        .onChange(of: model.ready) { ready in
            if ready { focusedField = config.resultFields.first?.id }
        }
    }

    private func field(_ field: ManualEntryField) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(field.label).font(.subheadline)
            if field.multiline {
                editor(field)
            } else {
                let placeholder = field.id == "fmcMoveCount"
                    ? model.moveCount.map(String.init) ?? field.placeholder : field.placeholder
                TextField(placeholder, text: model.binding(field.id))
                    .accessibilityLabel(field.label)
                    .keyboardType(field.keyboard)
                    .autocorrectionDisabled()
                    .focused($focusedField, equals: field.id)
            }
        }
    }

    private func editor(_ field: ManualEntryField) -> some View {
        ZStack(alignment: .topLeading) {
            TextEditor(text: model.binding(field.id))
                .frame(minHeight: 70)
                .accessibilityLabel(field.label)
                .autocorrectionDisabled(field.id != "comment")
                .textInputAutocapitalization(field.id == "comment" ? .sentences : .never)
                .focused($focusedField, equals: field.id)
            if model.input[field.id]?.isEmpty != false {
                Text(field.placeholder)
                    .foregroundStyle(.secondary)
                    .lineLimit(3)
                    .padding(.horizontal, 5)
                    .padding(.top, 8)
                    .allowsHitTesting(false)
                    .accessibilityHidden(true)
            }
        }
    }
}

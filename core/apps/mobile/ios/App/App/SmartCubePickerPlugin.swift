import Capacitor
import CoreBluetooth
import UIKit

/// Platform picker only: supported prefixes and translated labels come from app-ui.
@objc(SmartCubePickerPlugin)
final class SmartCubePickerPlugin: CAPPlugin, CAPBridgedPlugin, CBCentralManagerDelegate {
    let identifier = "SmartCubePickerPlugin"
    let jsName = "SmartCubePicker"
    let pluginMethods: [CAPPluginMethod] = [CAPPluginMethod(name: "requestDevice", returnType: CAPPluginReturnPromise)]
    private var central: CBCentralManager?
    private var pending: CAPPluginCall?
    private var picker: SmartCubePickerController?
    private var navigation: UINavigationController?
    private var prefixes: [String] = []
    private var timeout: DispatchWorkItem?
    private var backgroundObserver: NSObjectProtocol?

    @objc func requestDevice(_ call: CAPPluginCall) {
        DispatchQueue.main.async { self.begin(call) }
    }

    private func begin(_ call: CAPPluginCall) {
        guard pending == nil else { call.reject("A smart cube scan is already active"); return }
        let names = (call.getArray("namePrefixes", String.self) ?? [])
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines).uppercased() }
            .filter { !$0.isEmpty }
        guard !names.isEmpty else { call.reject("At least one smart cube name prefix is required"); return }
        guard let presenter = bridge?.viewController, presenter.presentedViewController == nil else {
            call.reject("Smart cube picker is unavailable"); return
        }
        pending = call
        prefixes = names
        let controller = SmartCubePickerController(style: .plain)
        controller.title = call.getString("scanning")
        controller.navigationItem.leftBarButtonItem = UIBarButtonItem(
            title: call.getString("cancel"), style: .plain, target: self, action: #selector(cancel))
        controller.onSelect = { [weak self] device in
            self?.finish(device: device)
        }
        let nav = UINavigationController(rootViewController: controller)
        nav.modalPresentationStyle = .pageSheet
        nav.isModalInPresentation = true
        picker = controller
        navigation = nav
        presenter.present(nav, animated: true)
        backgroundObserver = NotificationCenter.default.addObserver(
            forName: UIApplication.didEnterBackgroundNotification, object: nil, queue: .main
        ) { [weak self] _ in self?.finish(error: "Smart cube selection closed") }
        central = CBCentralManager(delegate: self, queue: .main)
    }

    @objc private func cancel() { finish(error: "Smart cube selection cancelled") }

    func centralManagerDidUpdateState(_ central: CBCentralManager) {
        guard central === self.central, pending != nil else { return }
        switch central.state {
        case .poweredOn:
            guard timeout == nil else { return }
            // Many cubes advertise a name but expose services only after connecting.
            central.scanForPeripherals(withServices: nil, options: [CBCentralManagerScanOptionAllowDuplicatesKey: true])
            let work = DispatchWorkItem { [weak self] in
                guard let self, let call = self.pending else { return }
                self.central?.stopScan()
                self.picker?.title = call.getString(self.picker?.devices.isEmpty == false ? "availableDevices" : "noDeviceFound")
            }
            timeout = work
            DispatchQueue.main.asyncAfter(deadline: .now() + 20, execute: work)
        case .unknown, .resetting: break
        default: finish(error: "Bluetooth is disabled or unavailable")
        }
    }

    func centralManager(_ central: CBCentralManager, didDiscover peripheral: CBPeripheral,
                        advertisementData: [String: Any], rssi RSSI: NSNumber) {
        guard central === self.central, central.isScanning, let call = pending else { return }
        let advertised = (advertisementData[CBAdvertisementDataLocalNameKey] as? String)?
            .trimmingCharacters(in: .whitespacesAndNewlines)
        let name = (advertised?.isEmpty == false ? advertised : peripheral.name)?
            .trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        guard !name.isEmpty, prefixes.contains(where: { name.uppercased().hasPrefix($0) }) else { return }
        picker?.upsert(id: peripheral.identifier.uuidString, name: name)
        picker?.title = call.getString("availableDevices")
    }

    private func finish(device: SmartCubePickerController.Device? = nil, error: String? = nil) {
        guard let call = pending else { return }
        pending = nil
        timeout?.cancel()
        timeout = nil
        central?.stopScan()
        central?.delegate = nil
        central = nil
        if let observer = backgroundObserver { NotificationCenter.default.removeObserver(observer) }
        backgroundObserver = nil
        picker?.onSelect = nil
        picker = nil
        prefixes = []
        let nav = navigation
        navigation = nil
        nav?.dismiss(animated: true) {
            if let device { call.resolve(["deviceId": device.id, "name": device.name]) }
            else { call.reject(error ?? "Smart cube selection cancelled") }
        }
    }
}

private final class SmartCubePickerController: UITableViewController {
    struct Device { let id: String; let name: String }
    var devices: [Device] = []
    var onSelect: ((Device) -> Void)?

    override func viewDidLoad() {
        super.viewDidLoad()
        tableView.rowHeight = UITableView.automaticDimension
        tableView.estimatedRowHeight = 56
    }

    func upsert(id: String, name: String) {
        if let index = devices.firstIndex(where: { $0.id == id }) {
            guard devices[index].name != name else { return }
            devices[index] = Device(id: id, name: name)
        } else {
            devices.append(Device(id: id, name: name))
        }
        tableView.reloadData()
    }

    override func tableView(_ tableView: UITableView, numberOfRowsInSection section: Int) -> Int { devices.count }

    override func tableView(_ tableView: UITableView, cellForRowAt indexPath: IndexPath) -> UITableViewCell {
        let cell = tableView.dequeueReusableCell(withIdentifier: "device") ?? UITableViewCell(style: .default, reuseIdentifier: "device")
        var content = cell.defaultContentConfiguration()
        content.text = devices[indexPath.row].name
        content.textProperties.numberOfLines = 0
        cell.contentConfiguration = content
        return cell
    }

    override func tableView(_ tableView: UITableView, didSelectRowAt indexPath: IndexPath) {
        onSelect?(devices[indexPath.row])
    }
}

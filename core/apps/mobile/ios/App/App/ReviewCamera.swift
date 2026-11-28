import AVFoundation
import UIKit
import WebKit

/// Only the timer review frame may request capture or read its temporary movie.
final class ReviewCamera: NSObject, WKScriptMessageHandlerWithReply {
    weak var presenter: UIViewController?
    private var active = false
    private var picker: AnyObject?
    private let directory = FileManager.default.temporaryDirectory.appendingPathComponent("review-camera", isDirectory: true)
    // WebKit may retain the selected file for the lifetime of the web view.
    private static var cleaned = false

    init(_ presenter: UIViewController) {
        self.presenter = presenter
        super.init()
        if !Self.cleaned {
            try? FileManager.default.removeItem(at: directory)
            Self.cleaned = true
        }
    }

    static func format(_ device: AVCaptureDevice, height: Int, rate: Int) -> AVCaptureDevice.Format? {
        device.formats.first { format in
            let size = CMVideoFormatDescriptionGetDimensions(format.formatDescription)
            return size.height == height && size.width == (height == 2160 ? 3840 : 1920)
                && format.videoSupportedFrameRateRanges.contains { $0.minFrameRate <= Double(rate) && $0.maxFrameRate >= Double(rate) }
        }
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage,
                               replyHandler reply: @escaping (Any?, String?) -> Void) {
        let origin = message.frameInfo.securityOrigin
        var trusted = origin.protocol == "https" && origin.host == "cuberoot.me" && [0, 443].contains(origin.port)
        #if DEBUG
        trusted = trusted || (origin.protocol == "http" && origin.host == "127.0.0.1" && origin.port == 3000)
        #endif
        guard trusted, !message.frameInfo.isMainFrame,
              let path = message.frameInfo.request.url?.path, ["/zh/timer", "/en/timer", "/timer"].contains(path),
              let body = message.body as? [String: Any], let action = body["action"] as? String else {
            reply(nil, "Unavailable"); return
        }
        guard #available(iOS 18.4, *), let web = message.webView else { reply(nil, "Unavailable"); return }
        let front = body["front"] as? Bool == true
        let device = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: front ? .front : .back)
        if action == "formats" {
            var pairs: [String] = []
            if let device {
                for height in [1080, 2160] {
                    for rate in [24, 30, 60, 120] where Self.format(device, height: height, rate: rate) != nil {
                        pairs.append("\(height)/\(rate)")
                    }
                }
            }
            reply(pairs, nil); return
        }
        guard action == "record", !active, let presenter, presenter.presentedViewController == nil,
              AVCaptureDevice.authorizationStatus(for: .video) == .authorized,
              let height = body["height"] as? Int, [1080, 2160].contains(height),
              let rate = body["rate"] as? Int, [24, 30, 60, 120].contains(rate),
              let device, let format = Self.format(device, height: height, rate: rate) else {
            reply(nil, "Recording format unavailable"); return
        }
        active = true
        let id = UUID().uuidString
        do { try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true) }
        catch { active = false; reply(nil, error.localizedDescription); return }
        let url = directory.appendingPathComponent("CubeRoot-" + id + ".mov")
        let picker = ReviewFilePicker(web: web, frame: message.frameInfo)
        self.picker = picker
        picker.open = { [weak self] completion in
            let camera = ReviewCaptureController(device: device, format: format, rate: rate, url: url)
            camera.finished = { [weak camera] error in
                camera?.dismiss(animated: false) {
                    self?.active = false
                    self?.picker = nil
                    if let error {
                        try? FileManager.default.removeItem(at: url)
                        completion(nil)
                        reply(nil, error.localizedDescription)
                    } else {
                        completion([url])
                        reply(true, nil)
                    }
                }
            }
            camera.modalPresentationStyle = .overFullScreen
            presenter.present(camera, animated: false)
        }
        picker.failed = { [weak self] in
            self?.picker = nil
            self?.active = false
            reply(nil, "Could not open video capture")
        }
        picker.begin()
    }
}

/// Supply the original file to an HTML file input, the same handoff WebKit uses
/// for its camera picker. Other delegate methods and unrelated pickers keep
/// their usual implementation. The override lasts only until the input opens.
@available(iOS 18.4, *)
private final class ReviewFilePicker: NSObject, WKUIDelegate {
    let web: WKWebView
    let frame: WKFrameInfo
    let original: WKUIDelegate?
    var open: ((@escaping ([URL]?) -> Void) -> Void)?
    var failed: (() -> Void)?

    init(web: WKWebView, frame: WKFrameInfo) {
        self.web = web; self.frame = frame; self.original = web.uiDelegate
    }
    func begin() {
        web.uiDelegate = self
        web.callAsyncJavaScript("document.querySelector('input[data-native-review-file]').click()",
                                arguments: [:], in: frame, in: .page) { [weak self] result in
            if case .failure = result { self?.abort() }
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 3) { [weak self] in self?.abort() }
    }
    private func abort() {
        guard web.uiDelegate === self else { return }
        web.uiDelegate = original
        failed?()
    }
    override func responds(to selector: Selector!) -> Bool {
        super.responds(to: selector) || original?.responds(to: selector) == true
    }
    override func forwardingTarget(for selector: Selector!) -> Any? {
        original?.responds(to: selector) == true ? original : super.forwardingTarget(for: selector)
    }
    func webView(_ webView: WKWebView, runOpenPanelWith parameters: WKOpenPanelParameters,
                 initiatedByFrame source: WKFrameInfo, completionHandler: @escaping ([URL]?) -> Void) {
        guard let open, source.request.url == frame.request.url, source.isMainFrame == frame.isMainFrame else {
            completionHandler(nil); abort(); return
        }
        web.uiDelegate = original
        open(completionHandler)
    }
}

private final class ReviewCaptureController: UIViewController, AVCaptureFileOutputRecordingDelegate {
    private let device: AVCaptureDevice
    private let format: AVCaptureDevice.Format
    private let rate: Int
    private let url: URL
    private let session = AVCaptureSession()
    private let movie = AVCaptureMovieFileOutput()
    private let queue = DispatchQueue(label: "me.cuberoot.camera.record")
    private let shutter = UIButton(type: .custom)
    private let stopShape = UIView()
    private let clock = UILabel()
    private var timer: Timer?
    private var rotationCoordinator: AnyObject?
    private var previewRotation: NSKeyValueObservation?
    private lazy var preview = AVCaptureVideoPreviewLayer(session: session)
    var finished: ((Error?) -> Void)?
    override var prefersStatusBarHidden: Bool { true }

    init(device: AVCaptureDevice, format: AVCaptureDevice.Format, rate: Int, url: URL) {
        self.device = device; self.format = format; self.rate = rate; self.url = url
        super.init(nibName: nil, bundle: nil)
    }
    required init?(coder: NSCoder) { nil }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .black
        preview.videoGravity = .resizeAspect
        view.layer.addSublayer(preview)
        if #available(iOS 17, *) {
            let coordinator = AVCaptureDevice.RotationCoordinator(device: device, previewLayer: preview)
            rotationCoordinator = coordinator
            previewRotation = coordinator.observe(\.videoRotationAngleForHorizonLevelPreview, options: [.new]) { [weak self] _, _ in
                self?.view.setNeedsLayout()
            }
        }
        NotificationCenter.default.addObserver(self, selector: #selector(stop), name: UIApplication.didEnterBackgroundNotification, object: nil)
        shutter.layer.cornerRadius = 32
        shutter.layer.borderWidth = 2
        shutter.layer.borderColor = UIColor.white.cgColor
        shutter.backgroundColor = UIColor.black.withAlphaComponent(0.45)
        shutter.accessibilityLabel = NSLocalizedString("Stop recording", comment: "")
        shutter.addTarget(self, action: #selector(stop), for: .touchUpInside)
        stopShape.backgroundColor = .systemRed
        stopShape.isUserInteractionEnabled = false
        stopShape.layer.cornerRadius = 5
        stopShape.frame = CGRect(x: 19, y: 19, width: 26, height: 26)
        shutter.addSubview(stopShape)
        shutter.isEnabled = false
        view.addSubview(shutter)
        clock.text = "00:00:00"
        clock.font = .monospacedDigitSystemFont(ofSize: 16, weight: .semibold)
        clock.textAlignment = .center
        clock.textColor = .white
        clock.backgroundColor = .systemRed
        clock.layer.cornerRadius = 7
        clock.clipsToBounds = true
        view.addSubview(clock)
    }

    private var orientation: AVCaptureVideoOrientation {
        switch view.window?.windowScene?.interfaceOrientation {
        case .landscapeLeft: return .landscapeLeft
        case .landscapeRight: return .landscapeRight
        case .portraitUpsideDown: return .portraitUpsideDown
        default: return .portrait
        }
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        preview.frame = view.bounds
        if let connection = preview.connection {
            if #available(iOS 17, *), let coordinator = rotationCoordinator as? AVCaptureDevice.RotationCoordinator,
               connection.isVideoRotationAngleSupported(coordinator.videoRotationAngleForHorizonLevelPreview) {
                connection.videoRotationAngle = coordinator.videoRotationAngleForHorizonLevelPreview
            } else if connection.isVideoOrientationSupported { connection.videoOrientation = orientation }
        }
        let safe = view.safeAreaLayoutGuide.layoutFrame
        let landscape = safe.width > safe.height
        shutter.frame = CGRect(x: landscape ? safe.maxX - 88 : safe.midX - 32,
                               y: landscape ? safe.midY - 32 : safe.maxY - 80, width: 64, height: 64)
        clock.frame = CGRect(x: safe.midX - 46, y: safe.minY + 10, width: 92, height: 28)
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        let orientation = self.orientation
        let captureAngle: CGFloat?
        if #available(iOS 17, *), let coordinator = rotationCoordinator as? AVCaptureDevice.RotationCoordinator {
            captureAngle = coordinator.videoRotationAngleForHorizonLevelCapture
        } else { captureAngle = nil }
        queue.async {
            do {
                let input = try AVCaptureDeviceInput(device: self.device)
                self.session.beginConfiguration()
                guard self.session.canAddInput(input) else { self.session.commitConfiguration(); throw CocoaError(.featureUnsupported) }
                self.session.addInput(input)
                guard self.session.canAddOutput(self.movie) else { self.session.commitConfiguration(); throw CocoaError(.featureUnsupported) }
                self.session.addOutput(self.movie)
                self.session.sessionPreset = .inputPriority
                do {
                    try self.device.lockForConfiguration()
                    defer { self.device.unlockForConfiguration() }
                    self.device.activeFormat = self.format
                    let duration = CMTime(value: 1, timescale: Int32(self.rate))
                    self.device.activeVideoMinFrameDuration = duration
                    self.device.activeVideoMaxFrameDuration = duration
                } catch { self.session.commitConfiguration(); throw error }
                self.session.commitConfiguration()
                guard let connection = self.movie.connection(with: .video) else { throw CocoaError(.featureUnsupported) }
                if #available(iOS 17, *), let captureAngle, connection.isVideoRotationAngleSupported(captureAngle) {
                    connection.videoRotationAngle = captureAngle
                } else if connection.isVideoOrientationSupported { connection.videoOrientation = orientation }
                if self.movie.availableVideoCodecTypes.contains(.hevc) {
                    self.movie.setOutputSettings([AVVideoCodecKey: AVVideoCodecType.hevc], for: connection)
                }
                self.session.startRunning()
                guard self.session.isRunning else { throw CocoaError(.featureUnsupported) }
                self.movie.startRecording(to: self.url, recordingDelegate: self)
                DispatchQueue.main.async { self.view.setNeedsLayout() }
            } catch { self.finish(error) }
        }
    }

    @objc private func stop() {
        shutter.isEnabled = false
        queue.async { if self.movie.isRecording { self.movie.stopRecording() } }
    }
    func fileOutput(_ output: AVCaptureFileOutput, didStartRecordingTo fileURL: URL, from connections: [AVCaptureConnection]) {
        DispatchQueue.main.async {
            self.shutter.isEnabled = true
            self.timer = Timer.scheduledTimer(withTimeInterval: 0.25, repeats: true) { [weak self] _ in
                guard let self else { return }
                let seconds = Int(max(0, CMTimeGetSeconds(self.movie.recordedDuration)))
                self.clock.text = String(format: "%02d:%02d:%02d", seconds / 3600, seconds / 60 % 60, seconds % 60)
            }
        }
    }
    func fileOutput(_ output: AVCaptureFileOutput, didFinishRecordingTo outputFileURL: URL,
                    from connections: [AVCaptureConnection], error: Error?) {
        let saved = (error as NSError?)?.userInfo[AVErrorRecordingSuccessfullyFinishedKey] as? Bool
        finish(saved == true ? nil : error)
    }
    private func finish(_ error: Error?) {
        queue.async {
            self.session.stopRunning()
            DispatchQueue.main.async {
                self.timer?.invalidate()
                let callback = self.finished
                self.finished = nil
                callback?(error)
            }
        }
    }
}

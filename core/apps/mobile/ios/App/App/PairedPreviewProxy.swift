#if DEBUG && !targetEnvironment(simulator)
import Foundation
import Network

/// Keeps WebKit on the same trustworthy loopback origin as the Android preview.
/// The Mac endpoint changes between pairing sessions and is never a WebKit origin.
final class PairedPreviewProxy {
    static let localURL = "http://127.0.0.1:1420"
    private let listeners: [NWListener]

    init?(remoteURL: String) {
        guard let parts = URLComponents(string: remoteURL), parts.scheme == "http", parts.port == 1420,
              let host = parts.host, host.hasPrefix("["), host.hasSuffix("]"),
              let address = IPv6Address(String(host.dropFirst().dropLast())), address.rawValue.first == 0xfd,
              parts.path.isEmpty, parts.user == nil, parts.password == nil,
              parts.query == nil, parts.fragment == nil else { return nil }

        let queue = DispatchQueue(label: "me.cuberoot.preview-proxy")
        guard let mobile = Self.listen(on: 1420, to: address, queue: queue) else { return nil }
        guard let website = Self.listen(on: 3000, to: address, queue: queue) else {
            mobile.cancel()
            return nil
        }
        listeners = [mobile, website]
    }

    private static func listen(on port: NWEndpoint.Port, to address: IPv6Address, queue: DispatchQueue) -> NWListener? {
        let parameters = NWParameters.tcp
        parameters.requiredLocalEndpoint = .hostPort(host: .ipv4(.loopback), port: port)
        guard let listener = try? NWListener(using: parameters) else { return nil }
        let started = DispatchGroup()
        started.enter()
        // The state handler runs on its own serial queue while Capacitor sets up the view.
        var ready = false
        listener.stateUpdateHandler = { [weak listener] state in
            switch state {
            case .ready:
                ready = true
            case .failed, .cancelled:
                break
            default:
                return
            }
            listener?.stateUpdateHandler = nil
            started.leave()
        }
        listener.newConnectionHandler = { client in
            let upstream = NWConnection(host: .ipv6(address), port: port, using: .tcp)
            upstream.start(queue: queue)
            client.start(queue: queue)
            Self.pipe(client, to: upstream)
            Self.pipe(upstream, to: client)
        }
        listener.start(queue: queue)
        guard started.wait(timeout: .now() + 2) == .success, ready else {
            listener.cancel()
            return nil
        }
        return listener
    }

    deinit { listeners.forEach { $0.cancel() } }

    /// A paired tunnel address may expire while the phone is away from the Mac.
    /// Probe the actual Vite entry before reusing a previous development session.
    func hasLiveApp() -> Bool {
        let session = URLSession(configuration: .ephemeral)
        defer { session.invalidateAndCancel() }
        let ready = DispatchSemaphore(value: 0)
        let request = URLRequest(url: URL(string: Self.localURL + "/")!,
                                 cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 1.5)
        let task = session.dataTask(with: request) { data, response, _ in
            if (response as? HTTPURLResponse)?.statusCode == 200,
               let data, String(decoding: data, as: UTF8.self).contains("/src/main.tsx") {
                ready.signal()
            }
        }
        task.resume()
        return ready.wait(timeout: .now() + 1.5) == .success
    }

    private static func pipe(_ source: NWConnection, to destination: NWConnection) {
        source.receive(minimumIncompleteLength: 1, maximumLength: 64 * 1024) { data, _, complete, error in
            guard error == nil else {
                source.cancel()
                destination.cancel()
                return
            }
            destination.send(content: data, contentContext: complete ? .finalMessage : .defaultMessage,
                             isComplete: complete, completion: .contentProcessed { error in
                if error != nil {
                    source.cancel()
                    destination.cancel()
                } else if !complete {
                    pipe(source, to: destination)
                }
            })
        }
    }
}
#endif

#if DEBUG && !targetEnvironment(simulator)
import Foundation
import Network

/// Keeps WebKit on the same trustworthy loopback origin as the Android preview.
/// The Mac endpoint changes between pairing sessions and is never a WebKit origin.
final class PairedPreviewProxy {
    static let localURL = "http://127.0.0.1:1420"
    private let listener: NWListener

    init?(remoteURL: String) {
        guard let parts = URLComponents(string: remoteURL), parts.scheme == "http", parts.port == 1420,
              let host = parts.host, host.hasPrefix("["), host.hasSuffix("]"),
              let address = IPv6Address(String(host.dropFirst().dropLast())), address.rawValue.first == 0xfd,
              parts.path.isEmpty, parts.user == nil, parts.password == nil,
              parts.query == nil, parts.fragment == nil else { return nil }

        let port: NWEndpoint.Port = 1420
        let parameters = NWParameters.tcp
        parameters.requiredLocalEndpoint = .hostPort(host: .ipv4(.loopback), port: port)
        guard let listener = try? NWListener(using: parameters) else { return nil }
        self.listener = listener

        let queue = DispatchQueue(label: "me.cuberoot.preview-proxy")
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
    }

    deinit { listener.cancel() }

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

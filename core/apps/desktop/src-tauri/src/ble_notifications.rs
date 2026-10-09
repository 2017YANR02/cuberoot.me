//! Desktop BLE notification forwarding. Keep BLEC discovery/GATT ownership,
//! but avoid its capacity-one try_send queue, which panics on notification bursts.
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::ipc::Channel;

fn forwarder(
    on_data: Channel<Vec<u8>>,
    on_error: Channel<()>,
) -> impl Fn(Vec<u8>) + Send + Sync + 'static {
    let failed = AtomicBool::new(false);
    move |data| {
        if failed.load(Ordering::Relaxed) {
            return;
        }
        // Tauri already provides ordered IPC delivery; a second bounded queue
        // adds an overflow/panic point without adding any delivery guarantees.
        if let Err(error) = on_data.send(data) {
            if !failed.swap(true, Ordering::Relaxed) {
                eprintln!("BLE notification IPC failed: {error}");
                // The owning frontend session disconnects outside BLEC's
                // listener lock. A closed webview must not panic this task.
                let _ = on_error.send(());
            }
        }
    }
}

#[tauri::command]
pub async fn ble_subscribe(
    characteristic: String,
    service: String,
    on_data: Channel<Vec<u8>>,
    on_error: Channel<()>,
) -> Result<(), String> {
    let characteristic = characteristic
        .parse()
        .map_err(|error| format!("Invalid characteristic UUID: {error}"))?;
    let service = service
        .parse()
        .map_err(|error| format!("Invalid service UUID: {error}"))?;
    tauri_plugin_blec::get_handler()
        .map_err(|error| error.to_string())?
        .subscribe(characteristic, Some(service), forwarder(on_data, on_error))
        .await
        .map_err(|error| error.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::AtomicUsize;
    use std::sync::{Arc, Mutex};
    use tauri::ipc::InvokeResponseBody;

    #[test]
    fn notification_burst_is_delivered_in_order_without_loss() {
        let received = Arc::new(Mutex::new(Vec::new()));
        let output = received.clone();
        let send = forwarder(
            Channel::new(move |body| {
                let InvokeResponseBody::Json(json) = body else {
                    panic!("expected JSON bytes")
                };
                output
                    .lock()
                    .unwrap()
                    .push(serde_json::from_str::<Vec<u8>>(&json).unwrap());
                Ok(())
            }),
            Channel::new(|_| panic!("unexpected notification failure")),
        );
        let expected: Vec<_> = (0_u32..4096)
            .map(|index| index.to_le_bytes().to_vec())
            .collect();
        for frame in &expected {
            send(frame.clone());
        }
        assert_eq!(*received.lock().unwrap(), expected);
    }

    #[test]
    fn closed_ipc_reports_failure_once_and_does_not_panic() {
        let failures = Arc::new(AtomicUsize::new(0));
        let output = failures.clone();
        let send = forwarder(
            Channel::new(|_| Err(std::io::Error::other("closed").into())),
            Channel::new(move |_| {
                output.fetch_add(1, Ordering::Relaxed);
                Err(std::io::Error::other("webview also closed").into())
            }),
        );
        for _ in 0..4096 {
            send(vec![1]);
        }
        assert_eq!(failures.load(Ordering::Relaxed), 1);
    }
}

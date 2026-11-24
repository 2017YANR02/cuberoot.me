#[tauri::command]
pub fn apple_membership_mode(window: tauri::WebviewWindow) -> Option<&'static str> {
    if window.label() != "main" {
        return None;
    }
    #[cfg(all(target_os = "macos", feature = "mac-app-store"))]
    if unsafe { macos::cuberoot_apple_membership_available(u8::from(macos::SANDBOX)) } != 0 {
        return Some(if macos::SANDBOX { "sandbox" } else { "store" });
    }
    None
}

#[tauri::command]
pub async fn apple_membership(
    window: tauri::WebviewWindow,
    action: String,
    product_id: Option<String>,
    app_account_token: Option<String>,
    transaction_id: Option<String>,
) -> Result<serde_json::Value, String> {
    if apple_membership_mode(window).is_none() {
        return Err("Apple subscriptions unavailable".into());
    }
    #[cfg(all(target_os = "macos", feature = "mac-app-store"))]
    {
        let result = macos::call(serde_json::json!({
            "action": action, "productId": product_id,
            "appAccountToken": app_account_token, "transactionId": transaction_id,
        }))
        .await;
        if macos::SANDBOX {
            if let Err(error) = &result {
                eprintln!("Apple Sandbox StoreKit: {error}");
            }
        }
        result
    }
    #[cfg(not(all(target_os = "macos", feature = "mac-app-store")))]
    {
        let _ = (action, product_id, app_account_token, transaction_id);
        Err("Apple subscriptions unavailable".into())
    }
}

#[cfg(all(target_os = "macos", feature = "mac-app-store"))]
pub use macos::listen_for_updates;

#[cfg(all(target_os = "macos", feature = "mac-app-store"))]
mod macos {
    use serde_json::Value;
    use std::ffi::{c_char, c_void, CStr, CString};
    use std::sync::OnceLock;
    use tauri::async_runtime::{channel, Sender};
    use tauri::Emitter;

    pub(super) const SANDBOX: bool = cfg!(feature = "apple-iap-sandbox");
    type Reply = Result<Value, String>;

    unsafe extern "C" {
        pub(super) fn cuberoot_apple_membership_available(sandbox: u8) -> u8;
        fn cuberoot_apple_membership(
            request: *const c_char,
            sandbox: u8,
            context: *mut c_void,
            callback: extern "C" fn(*mut c_void, *const c_char, u8),
        );
        fn cuberoot_apple_membership_listen(sandbox: u8, callback: extern "C" fn());
    }

    extern "C" fn receive(context: *mut c_void, result: *const c_char, success: u8) {
        // Swift invokes this exactly once. Both pointers are valid for the callback.
        let sender = unsafe { Box::from_raw(context.cast::<Sender<Reply>>()) };
        let response = unsafe { CStr::from_ptr(result) }.to_string_lossy();
        let reply = if success == 0 {
            Err(response.into_owned())
        } else {
            serde_json::from_str(&response).map_err(|_| "Invalid StoreKit response".into())
        };
        let _ = sender.try_send(reply);
    }

    pub(super) async fn call(payload: Value) -> Reply {
        let request = CString::new(payload.to_string()).map_err(|_| "Invalid StoreKit request")?;
        let (sender, mut receiver) = channel::<Reply>(1);
        // Swift decodes the request synchronously before starting its async task.
        unsafe {
            cuberoot_apple_membership(
                request.as_ptr(),
                u8::from(SANDBOX),
                Box::into_raw(Box::new(sender)).cast(),
                receive,
            );
        }
        receiver.recv().await.ok_or("StoreKit did not respond")?
    }

    static APP: OnceLock<tauri::AppHandle> = OnceLock::new();

    extern "C" fn transaction_available() {
        if let Some(app) = APP.get() {
            let _ = app.emit_to("main", "apple-membership-update", ());
        }
    }

    pub fn listen_for_updates(app: &tauri::AppHandle) {
        if APP.set(app.clone()).is_ok() {
            unsafe { cuberoot_apple_membership_listen(u8::from(SANDBOX), transaction_available) };
        }
    }
}

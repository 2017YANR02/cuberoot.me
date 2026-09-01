package me.cuberoot.app;

import android.os.Bundle;
import android.view.Gravity;
import android.webkit.WebView;
import android.widget.TextView;

import androidx.core.splashscreen.SplashScreen;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;

import com.getcapacitor.BridgeActivity;

import java.util.Collections;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        SplashScreen.installSplashScreen(this);
        registerPlugin(TimerPrintPlugin.class);
        super.onCreate(savedInstanceState);
    }

    @Override
    protected void load() {
        if (!canInstallMainFrameBridge()) {
            TextView message = new TextView(this);
            int padding = Math.round(24 * getResources().getDisplayMetrics().density);
            message.setGravity(Gravity.CENTER);
            message.setPadding(padding, padding, padding, padding);
            message.setText(R.string.webview_update_required);
            setContentView(message);
            return;
        }
        super.load();
    }

    private boolean canInstallMainFrameBridge() {
        if (!WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) return false;
        WebView webView = findViewById(com.getcapacitor.android.R.id.webview);
        try {
            WebViewCompat.addWebMessageListener(
                webView,
                "cuberootBridgeProbe",
                Collections.singleton("https://localhost"),
                (view, message, sourceOrigin, isMainFrame, replyProxy) -> {}
            );
            WebViewCompat.removeWebMessageListener(webView, "cuberootBridgeProbe");
            return true;
        } catch (RuntimeException error) {
            return false;
        }
    }
}

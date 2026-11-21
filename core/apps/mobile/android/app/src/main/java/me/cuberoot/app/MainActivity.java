package me.cuberoot.app;

import android.os.Bundle;
import android.util.Log;
import android.view.Gravity;
import android.webkit.WebView;
import android.widget.TextView;

import androidx.core.splashscreen.SplashScreen;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;

import com.getcapacitor.BridgeActivity;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.Collections;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        SplashScreen.installSplashScreen(this);
        registerPlugin(TimerPrintPlugin.class);
        registerPlugin(NativeFilesPlugin.class);
        registerPlugin(ScreenAwakePlugin.class);
        registerPlugin(RecordPushPlugin.class);
        registerPlugin(SmartCubePickerPlugin.class);
        registerPlugin(DistributionPlugin.class);
        if ("play".equals(BuildConfig.DISTRIBUTION)) registerPlugin(GoogleMembershipPlugin.class);
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
        installEmbeddedLayout();
        super.load();
    }

    private void installEmbeddedLayout() {
        if (!WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) return;
        WebView webView = findViewById(com.getcapacitor.android.R.id.webview);
        try (InputStream asset = getAssets().open("public/embedded-layout.js");
             ByteArrayOutputStream contents = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[4096];
            int size;
            while ((size = asset.read(buffer)) != -1) contents.write(buffer, 0, size);
            String script = new String(contents.toByteArray(), StandardCharsets.UTF_8);
            WebViewCompat.addDocumentStartJavaScript(webView, script, Collections.singleton("https://cuberoot.me"));
        } catch (IOException | RuntimeException error) {
            Log.w("CubeRoot", "Embedded layout unavailable", error);
        }
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

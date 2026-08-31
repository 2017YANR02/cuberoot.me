package me.cuberoot.app;

import android.content.Context;
import android.os.Bundle;
import android.os.CancellationSignal;
import android.os.ParcelFileDescriptor;
import android.print.PageRange;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.webkit.WebView;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.concurrent.atomic.AtomicBoolean;

@CapacitorPlugin(name = "TimerPrint")
public class TimerPrintPlugin extends Plugin {
    @PluginMethod
    public void print(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            try {
                WebView webView = getBridge().getWebView();
                PrintManager printManager = (PrintManager) getContext()
                    .getSystemService(Context.PRINT_SERVICE);
                if (webView == null || printManager == null) {
                    call.reject("System printing is unavailable");
                    return;
                }

                String title = call.getString("title", "CubeRoot Timer");
                PrintDocumentAdapter webViewAdapter = webView.createPrintDocumentAdapter(title);
                AtomicBoolean settled = new AtomicBoolean(false);
                // Keep the shared report mounted until Android's asynchronous
                // print adapter is actually finished (including cancellation).
                PrintDocumentAdapter adapter = new PrintDocumentAdapter() {
                    @Override
                    public void onStart() {
                        webViewAdapter.onStart();
                    }

                    @Override
                    public void onLayout(
                        PrintAttributes oldAttributes,
                        PrintAttributes newAttributes,
                        CancellationSignal cancellationSignal,
                        LayoutResultCallback callback,
                        Bundle extras
                    ) {
                        webViewAdapter.onLayout(
                            oldAttributes,
                            newAttributes,
                            cancellationSignal,
                            callback,
                            extras
                        );
                    }

                    @Override
                    public void onWrite(
                        PageRange[] pages,
                        ParcelFileDescriptor destination,
                        CancellationSignal cancellationSignal,
                        WriteResultCallback callback
                    ) {
                        webViewAdapter.onWrite(pages, destination, cancellationSignal, callback);
                    }

                    @Override
                    public void onFinish() {
                        webViewAdapter.onFinish();
                        if (settled.compareAndSet(false, true)) call.resolve();
                    }
                };
                PrintAttributes attributes = new PrintAttributes.Builder()
                    .setMediaSize(PrintAttributes.MediaSize.ISO_A4)
                    .setColorMode(PrintAttributes.COLOR_MODE_COLOR)
                    .build();
                printManager.print(title, adapter, attributes);
            } catch (RuntimeException error) {
                call.reject("Could not open system printing", error);
            }
        });
    }
}

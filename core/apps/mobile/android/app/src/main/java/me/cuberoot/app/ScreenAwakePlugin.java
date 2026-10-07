package me.cuberoot.app;

import android.view.WindowManager;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "ScreenAwake")
public class ScreenAwakePlugin extends Plugin {
    @PluginMethod
    public void setKeepAwake(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            if (call.getBoolean("enabled", false)) {
                getActivity().getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            } else {
                getActivity().getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            }
            call.resolve();
        });
    }

    @Override
    protected void handleOnDestroy() {
        getActivity().runOnUiThread(() ->
            getActivity().getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON));
    }
}

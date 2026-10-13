package me.cuberoot.app;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "Distribution")
public class DistributionPlugin extends Plugin {
    @PluginMethod
    public void get(PluginCall call) {
        JSObject result = new JSObject();
        result.put("channel", BuildConfig.DISTRIBUTION);
        call.resolve(result);
    }
}

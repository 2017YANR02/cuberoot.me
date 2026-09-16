package me.cuberoot.app;

import android.Manifest;
import android.app.AlertDialog;
import android.app.NotificationManager;
import android.os.Build;
import android.text.Html;
import android.text.method.LinkMovementMethod;
import android.widget.TextView;
import androidx.core.app.NotificationManagerCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import com.igexin.sdk.PushManager;

@CapacitorPlugin(name = "RecordPush", permissions = {
    @Permission(alias = "notifications", strings = { Manifest.permission.POST_NOTIFICATIONS })
})
public class RecordPushPlugin extends Plugin {
    private boolean requested = false;
    private boolean initialized = false;

    private boolean configured() { return !BuildConfig.GETUI_APP_ID.isEmpty(); }
    private boolean consented() {
        return getContext().getSharedPreferences("record_push", 0).getBoolean("consent", false);
    }
    private boolean permitted() {
        return NotificationManagerCompat.from(getContext()).areNotificationsEnabled();
    }
    private void resolveStatus(PluginCall call) {
        JSObject result = new JSObject();
        result.put("configured", configured());
        result.put("enabled", requested && permitted() && consented());
        result.put("clientId", initialized ? PushManager.getInstance().getClientid(getContext()) : "");
        call.resolve(result);
    }
    @PluginMethod public void status(PluginCall call) { resolveStatus(call); }

    @PluginMethod public void start(PluginCall call) {
        if (!configured()) { resolveStatus(call); return; }
        requested = true;
        if (consented()) { initialize(call); return; }
        getActivity().runOnUiThread(() -> {
            AlertDialog dialog = new AlertDialog.Builder(getActivity())
                .setTitle(R.string.record_push_title)
                .setMessage(Html.fromHtml(getContext().getString(R.string.record_push_consent), Html.FROM_HTML_MODE_LEGACY))
                .setPositiveButton(R.string.record_push_enable, (d, which) -> {
                    if (!requested) { resolveStatus(call); return; }
                    getContext().getSharedPreferences("record_push", 0).edit().putBoolean("consent", true).apply();
                    if (Build.VERSION.SDK_INT >= 33 && getPermissionState("notifications") != PermissionState.GRANTED) {
                        requestPermissionForAlias("notifications", call, "permissionResult");
                    } else { initialize(call); }
                })
                .setNegativeButton(R.string.record_push_later, (d, which) -> { requested = false; resolveStatus(call); })
                .setOnCancelListener(d -> { requested = false; resolveStatus(call); })
                .create();
            dialog.show();
            TextView text = dialog.findViewById(android.R.id.message);
            if (text != null) text.setMovementMethod(LinkMovementMethod.getInstance());
        });
    }

    @PermissionCallback private void permissionResult(PluginCall call) { initialize(call); }
    private void initialize(PluginCall call) {
        if (requested && consented() && permitted()) {
            PushManager manager = PushManager.getInstance();
            manager.setIndividuationPush(getContext(), false);
            manager.setLinkMerge(getContext(), false);
            manager.setScenePush(getContext(), false);
            manager.setEmergencyPush(getContext(), false);
            manager.setImeiEnable(getContext(), false);
            manager.setImsiEnable(getContext(), false);
            manager.setMacEnable(getContext(), false);
            manager.setIccIdEnable(getContext(), false);
            manager.setSerialNumberEnable(getContext(), false);
            manager.setAdvertisingIdEnable(getContext(), false);
            manager.setCellInfoEnable(getContext(), false);
            PushManager.getInstance().preInit(getContext().getApplicationContext());
            PushManager.getInstance().initialize(getContext());
            PushManager.getInstance().turnOnPush(getContext());
            initialized = true;
        }
        resolveStatus(call);
    }

    @PluginMethod public void stop(PluginCall call) {
        requested = false;
        if (configured() && consented()) PushManager.getInstance().turnOffPush(getContext());
        NotificationManager manager = (NotificationManager) getContext().getSystemService(android.content.Context.NOTIFICATION_SERVICE);
        if (manager != null) manager.cancelAll();
        resolveStatus(call);
    }
}

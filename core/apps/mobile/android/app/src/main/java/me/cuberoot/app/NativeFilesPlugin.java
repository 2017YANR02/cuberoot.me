package me.cuberoot.app;

import android.app.Activity;
import android.content.Intent;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.*;
import com.getcapacitor.annotation.*;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

@CapacitorPlugin(name = "NativeFiles")
public class NativeFilesPlugin extends Plugin {
    private volatile boolean busy = false;
    @PluginMethod
    public void exportFile(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            if (busy) { call.reject("File export already open"); return; }
            String name = call.getString("filename", "");
            if (name.isEmpty() || name.contains("/") || name.contains("\\") || name.equals(".") || name.equals("..")) {
                call.reject("Invalid filename"); return;
            }
            busy = true;
            Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
            intent.addCategory(Intent.CATEGORY_OPENABLE);
            intent.setType(call.getString("mime", "application/octet-stream").split(";", 2)[0]);
            intent.putExtra(Intent.EXTRA_TITLE, name);
            try { startActivityForResult(call, intent, "fileSelected"); }
            catch (RuntimeException error) { busy = false; call.reject("Could not open file picker", error); }
        });
    }
    @ActivityCallback
    private void fileSelected(PluginCall call, ActivityResult result) {
        if (call == null) { busy = false; return; }
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null || result.getData().getData() == null) {
            busy = false; call.resolve(new JSObject().put("completed", false)); return;
        }
        getBridge().execute(() -> {
            try (OutputStream output = getContext().getContentResolver().openOutputStream(result.getData().getData(), "wt")) {
                if (output == null) throw new java.io.IOException("No output stream");
                output.write(call.getString("text", "").getBytes(StandardCharsets.UTF_8));
                output.flush();
                call.resolve(new JSObject().put("completed", true));
            } catch (Exception error) { call.reject("File export failed", error); }
            finally { busy = false; }
        });
    }
}

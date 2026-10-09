package me.cuberoot.app;

import android.annotation.SuppressLint;
import android.app.AlertDialog;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothManager;
import android.bluetooth.le.BluetoothLeScanner;
import android.bluetooth.le.ScanCallback;
import android.bluetooth.le.ScanRecord;
import android.bluetooth.le.ScanResult;
import android.bluetooth.le.ScanSettings;
import android.content.Context;
import android.os.Handler;
import android.os.Looper;
import android.widget.ArrayAdapter;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONException;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@CapacitorPlugin(name = "SmartCubePicker")
public class SmartCubePickerPlugin extends Plugin {
    private static final long SCAN_DURATION_MS = 20_000L;

    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private final List<DeviceCandidate> devices = new ArrayList<>();
    private final List<String> deviceRows = new ArrayList<>();
    private final Map<String, DeviceCandidate> devicesByAddress = new LinkedHashMap<>();

    private AlertDialog dialog;
    private ArrayAdapter<String> listAdapter;
    private BluetoothLeScanner scanner;
    private ScanCallback scanCallback;
    private Runnable scanTimeout;
    private PluginCall pendingCall;
    private List<String> normalizedPrefixes = Collections.emptyList();
    private String availableDevicesLabel = "Available devices";
    private String noDeviceFoundLabel = "No device found";
    private boolean scanning;

    @PluginMethod
    public void requestDevice(PluginCall call) {
        if (getActivity() == null) {
            call.reject("Smart cube picker is unavailable");
            return;
        }
        getActivity().runOnUiThread(() -> beginScan(call));
    }

    @SuppressLint("MissingPermission")
    private void beginScan(PluginCall call) {
        if (pendingCall != null) {
            call.reject("A smart cube scan is already active");
            return;
        }

        List<String> prefixes;
        try {
            prefixes = readPrefixes(call);
        } catch (JSONException error) {
            call.reject("Invalid smart cube name prefixes", error);
            return;
        }
        if (prefixes.isEmpty()) {
            call.reject("At least one smart cube name prefix is required");
            return;
        }

        BluetoothManager manager = (BluetoothManager) getContext().getSystemService(Context.BLUETOOTH_SERVICE);
        BluetoothAdapter bluetoothAdapter = manager == null ? null : manager.getAdapter();
        if (bluetoothAdapter == null) {
            call.reject("Bluetooth Low Energy is unavailable");
            return;
        }

        try {
            if (!bluetoothAdapter.isEnabled()) {
                call.reject("Bluetooth is disabled");
                return;
            }
            scanner = bluetoothAdapter.getBluetoothLeScanner();
        } catch (SecurityException error) {
            call.reject("Bluetooth permission is required", error);
            return;
        }
        if (scanner == null) {
            call.reject("Bluetooth scanner is unavailable");
            return;
        }

        pendingCall = call;
        normalizedPrefixes = prefixes;
        availableDevicesLabel = call.getString("availableDevices", "Available devices");
        noDeviceFoundLabel = call.getString("noDeviceFound", "No device found");
        devices.clear();
        deviceRows.clear();
        devicesByAddress.clear();

        listAdapter = new ArrayAdapter<>(
            getActivity(),
            android.R.layout.simple_selectable_list_item,
            deviceRows
        );
        dialog = new AlertDialog.Builder(getActivity())
            .setTitle(call.getString("scanning", "Scanning for a smart cube..."))
            .setAdapter(listAdapter, (ignored, index) -> selectDevice(index))
            .setNegativeButton(call.getString("cancel", "Cancel"), (ignored, which) -> {
                rejectCurrent("Smart cube selection cancelled", null);
            })
            .setOnCancelListener(ignored -> rejectCurrent("Smart cube selection cancelled", null))
            .create();
        dialog.show();

        scanCallback = createScanCallback();
        ScanSettings settings = new ScanSettings.Builder()
            .setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY)
            .build();
        try {
            scanner.startScan(null, settings, scanCallback);
            scanning = true;
        } catch (RuntimeException error) {
            rejectCurrent("Could not start Bluetooth scan", error);
            return;
        }

        scanTimeout = () -> {
            if (pendingCall == null) return;
            stopScan();
            if (dialog != null) {
                dialog.setTitle(devices.isEmpty() ? noDeviceFoundLabel : availableDevicesLabel);
            }
        };
        mainHandler.postDelayed(scanTimeout, SCAN_DURATION_MS);
    }

    private ScanCallback createScanCallback() {
        return new ScanCallback() {
            @Override
            public void onScanResult(int callbackType, ScanResult result) {
                mainHandler.post(() -> handleScanResult(this, result));
            }

            @Override
            public void onBatchScanResults(List<ScanResult> results) {
                if (results == null) return;
                for (ScanResult result : results) {
                    mainHandler.post(() -> handleScanResult(this, result));
                }
            }

            @Override
            public void onScanFailed(int errorCode) {
                mainHandler.post(() -> {
                    if (scanCallback != this) return;
                    rejectCurrent("Bluetooth scan failed (" + errorCode + ")", null);
                });
            }
        };
    }

    @SuppressLint("MissingPermission")
    private void handleScanResult(ScanCallback source, ScanResult result) {
        if (pendingCall == null || source != scanCallback || result == null) return;

        try {
            BluetoothDevice device = result.getDevice();
            if (device == null) return;
            ScanRecord record = result.getScanRecord();
            String name = record == null ? null : record.getDeviceName();
            if (name == null || name.trim().isEmpty()) name = device.getName();
            if (name == null) return;
            name = name.trim();
            if (!matchesKnownPrefix(name)) return;

            String address = device.getAddress();
            if (address == null || address.isEmpty()) return;
            String addressKey = address.toUpperCase(Locale.US);
            if (devicesByAddress.containsKey(addressKey)) return;

            DeviceCandidate candidate = new DeviceCandidate(address, name);
            devicesByAddress.put(addressKey, candidate);
            devices.add(candidate);
            deviceRows.add(name);
            if (dialog != null) dialog.setTitle(availableDevicesLabel);
            if (listAdapter != null) listAdapter.notifyDataSetChanged();
        } catch (SecurityException error) {
            rejectCurrent("Bluetooth permission is required", error);
        }
    }

    private boolean matchesKnownPrefix(String deviceName) {
        String normalizedName = deviceName.toUpperCase(Locale.US);
        for (String prefix : normalizedPrefixes) {
            if (normalizedName.startsWith(prefix)) return true;
        }
        return false;
    }

    private List<String> readPrefixes(PluginCall call) throws JSONException {
        JSArray values = call.getArray("namePrefixes", new JSArray());
        List<String> prefixes = new ArrayList<>();
        for (int index = 0; index < values.length(); index++) {
            String prefix = values.getString(index).trim();
            if (!prefix.isEmpty()) prefixes.add(prefix.toUpperCase(Locale.US));
        }
        return prefixes;
    }

    private void selectDevice(int index) {
        if (pendingCall == null || index < 0 || index >= devices.size()) return;
        DeviceCandidate selected = devices.get(index);
        PluginCall call = takePendingCall();
        JSObject result = new JSObject();
        result.put("deviceId", selected.address);
        result.put("name", selected.name);
        call.resolve(result);
    }

    private void rejectCurrent(String message, Exception error) {
        if (pendingCall == null) return;
        PluginCall call = takePendingCall();
        if (error == null) call.reject(message);
        else call.reject(message, error);
    }

    private PluginCall takePendingCall() {
        PluginCall call = pendingCall;
        pendingCall = null;
        stopScan();
        if (dialog != null) {
            AlertDialog currentDialog = dialog;
            dialog = null;
            if (currentDialog.isShowing()) currentDialog.dismiss();
        }
        listAdapter = null;
        devices.clear();
        deviceRows.clear();
        devicesByAddress.clear();
        normalizedPrefixes = Collections.emptyList();
        return call;
    }

    @SuppressLint("MissingPermission")
    private void stopScan() {
        if (scanTimeout != null) {
            mainHandler.removeCallbacks(scanTimeout);
            scanTimeout = null;
        }
        ScanCallback currentCallback = scanCallback;
        scanCallback = null;
        if (scanning && scanner != null && currentCallback != null) {
            try {
                scanner.stopScan(currentCallback);
            } catch (RuntimeException ignored) {}
        }
        scanning = false;
        scanner = null;
    }

    @Override
    protected void handleOnDestroy() {
        if (pendingCall != null) rejectCurrent("Smart cube selection closed", null);
        else stopScan();
        super.handleOnDestroy();
    }

    private static final class DeviceCandidate {
        final String address;
        final String name;

        DeviceCandidate(String address, String name) {
            this.address = address;
            this.name = name;
        }
    }
}
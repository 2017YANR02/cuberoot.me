package me.cuberoot.app;

import com.getcapacitor.CapConfig;

public class LiveReloadActivity extends MainActivity {
    @Override
    protected void load() {
        config = new CapConfig.Builder(this).setServerUrl("http://127.0.0.1:1420").create();
        super.load();
    }
}

package me.cuberoot.app;

import android.content.Context;
import com.igexin.sdk.GTIntentService;
import com.igexin.sdk.message.GTCmdMessage;
import com.igexin.sdk.message.GTTransmitMessage;

/** CID is read by the authenticated host; never log device identifiers/payloads. */
public class RecordPushIntentService extends GTIntentService {
    @Override public void onReceiveServicePid(Context context, int pid) { }
    @Override public void onReceiveClientId(Context context, String clientId) { }
    @Override public void onReceiveOnlineState(Context context, boolean online) { }
    @Override public void onReceiveCommandResult(Context context, GTCmdMessage command) { }
    @Override public void onReceiveMessageData(Context context, GTTransmitMessage message) { }
}

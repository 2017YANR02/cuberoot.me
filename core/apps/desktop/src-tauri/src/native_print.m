#import <AppKit/AppKit.h>
#import <WebKit/WebKit.h>

// Called on the main thread by Tauri's with_webview. runOperation maintains
// its modal event loop and returns only when the print panel/job is finished.
int cuberoot_print(void *view, const char *title) {
    @try {
        WKWebView *webview = (__bridge WKWebView *)view;
        if (!webview.window || ![webview respondsToSelector:@selector(printOperationWithPrintInfo:)]) return -1;
        if (@available(macOS 11.0, *)) {
        NSPrintInfo *info = [NSPrintInfo.sharedPrintInfo copy];
        NSPrintOperation *operation = [webview printOperationWithPrintInfo:info];
        operation.jobTitle = [NSString stringWithUTF8String:title];
        operation.showsPrintPanel = YES;
        operation.showsProgressPanel = YES;
        return [operation runOperation] ? 1 : 0;
        }
        return -1;
    } @catch (NSException *exception) { return -1; }
}

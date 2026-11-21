#import <WebKit/WebKit.h>

@interface CubeRootToolsSearch : NSObject <WKScriptMessageHandler>
@end

@implementation CubeRootToolsSearch
- (void)userContentController:(WKUserContentController *)controller didReceiveScriptMessage:(WKScriptMessage *)message {
    WKFrameInfo *frame = message.frameInfo;
    if (frame.mainFrame || ![frame.securityOrigin.protocol isEqualToString:@"https"]
        || ![frame.securityOrigin.host isEqualToString:@"cuberoot.me"]
        || ![@[@"", @"/", @"/zh", @"/zh/", @"/en", @"/en/"] containsObject:frame.request.URL.path]) return;
    if (@available(macOS 11.0, *)) {
        WKWebView *view = message.webView;
        [view.window makeFirstResponder:view];
        [view evaluateJavaScript:@"if (window.name.startsWith('cuberoot-mobile-tools') && document.documentElement.hasAttribute('data-embedded-search-open')) document.querySelector('.landing-page > .landing-search .landing-search-field')?.focus({preventScroll:true})"
                         inFrame:frame inContentWorld:WKContentWorld.defaultClientWorld completionHandler:nil];
    }
}
@end

void cuberoot_install_tools_search(void *pointer) {
    WKWebView *view = (__bridge WKWebView *)pointer;
    [view.configuration.userContentController addScriptMessageHandler:[CubeRootToolsSearch new] name:@"cuberootDesktopSearch"];
}

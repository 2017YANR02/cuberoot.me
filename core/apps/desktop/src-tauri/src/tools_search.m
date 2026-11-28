#import <WebKit/WebKit.h>

@interface CubeRootToolsSearch : NSObject <WKScriptMessageHandler>
@end

@implementation CubeRootToolsSearch
- (void)userContentController:(WKUserContentController *)controller didReceiveScriptMessage:(WKScriptMessage *)message {
    WKFrameInfo *frame = message.frameInfo;
    if (frame.mainFrame || ![frame.securityOrigin.protocol isEqualToString:@"https"]
        || ![frame.securityOrigin.host isEqualToString:@"cuberoot.me"]) return;
    if ([message.name isEqualToString:@"cuberootGuestTourSeen"]) {
        if ([message.body isEqual:@YES]) [[NSUserDefaults standardUserDefaults] setBool:YES forKey:@"tools.guestTourSeen"];
        return;
    }
    if (![@[@"", @"/", @"/zh", @"/zh/", @"/en", @"/en/"] containsObject:frame.request.URL.path]) return;
    if (@available(macOS 11.0, *)) {
        WKWebView *view = message.webView;
        [view.window makeFirstResponder:view];
        [view evaluateJavaScript:@"if (window.name.startsWith('cuberoot-mobile-tools') && document.documentElement.hasAttribute('data-embedded-search-open')) document.querySelector('.landing-page > .landing-search .landing-search-field')?.focus({preventScroll:true})"
                         inFrame:frame inContentWorld:WKContentWorld.defaultClientWorld completionHandler:nil];
    }
}
@end

void cuberoot_install_tools_search(void *pointer, const char *guestTour) {
    WKWebView *view = (__bridge WKWebView *)pointer;
    WKUserContentController *controller = view.configuration.userContentController;
    CubeRootToolsSearch *handler = [CubeRootToolsSearch new];
    [controller addScriptMessageHandler:handler name:@"cuberootDesktopSearch"];
    BOOL seen = [[NSUserDefaults standardUserDefaults] boolForKey:@"tools.guestTourSeen"];
    NSString *source = [NSString stringWithFormat:@"((seen) => {\n%@\n})(%@);",
                        [NSString stringWithUTF8String:guestTour], seen ? @"true" : @"false"];
    WKUserScript *script;
    if (@available(macOS 11.0, *)) {
        WKContentWorld *world = WKContentWorld.defaultClientWorld;
        [controller addScriptMessageHandler:handler contentWorld:world name:@"cuberootGuestTourSeen"];
        script = [[WKUserScript alloc] initWithSource:source injectionTime:WKUserScriptInjectionTimeAtDocumentStart forMainFrameOnly:NO inContentWorld:world];
    } else {
        [controller addScriptMessageHandler:handler name:@"cuberootGuestTourSeen"];
        script = [[WKUserScript alloc] initWithSource:source injectionTime:WKUserScriptInjectionTimeAtDocumentStart forMainFrameOnly:NO];
    }
    [controller addUserScript:script];
}

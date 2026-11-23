#import <Cocoa/Cocoa.h>
#import <WebKit/WebKit.h>

static BOOL IsWebLink(NSURL *url) {
    NSString *scheme = url.scheme.lowercaseString;
    return url.host.length > 0 && ([scheme isEqualToString:@"https"] || [scheme isEqualToString:@"http"]);
}

@interface CubeRootWebLinkWindow : NSWindowController <NSWindowDelegate, WKNavigationDelegate, WKUIDelegate>
@property(nonatomic, strong) WKWebView *webView;
@end

static CubeRootWebLinkWindow *webLinkWindow;

@implementation CubeRootWebLinkWindow

- (instancetype)init {
    NSWindow *window = [[NSWindow alloc] initWithContentRect:NSMakeRect(0, 0, 800, 650)
        styleMask:NSWindowStyleMaskTitled | NSWindowStyleMaskClosable | NSWindowStyleMaskMiniaturizable | NSWindowStyleMaskResizable
        backing:NSBackingStoreBuffered defer:NO];
    self = [super initWithWindow:window];
    if (self) {
        window.releasedWhenClosed = NO;
        // Third-party pages have no Tauri bridge or access to the app WebView's session.
        WKWebViewConfiguration *configuration = [[WKWebViewConfiguration alloc] init];
        configuration.websiteDataStore = [WKWebsiteDataStore nonPersistentDataStore];
        self.webView = [[WKWebView alloc] initWithFrame:window.contentView.bounds configuration:configuration];
        self.webView.navigationDelegate = self;
        self.webView.UIDelegate = self;
        self.webView.allowsBackForwardNavigationGestures = YES;
        window.contentView = self.webView;
        window.delegate = self;
        [window center];
    }
    return self;
}

- (void)windowWillClose:(NSNotification *)notification {
    [self.webView stopLoading];
    webLinkWindow = nil;
}

- (void)webView:(WKWebView *)webView decidePolicyForNavigationAction:(WKNavigationAction *)action
    decisionHandler:(void (^)(WKNavigationActionPolicy))decisionHandler {
    BOOL embeddedFrame = action.targetFrame && !action.targetFrame.isMainFrame;
    BOOL allowed = IsWebLink(action.request.URL) || (embeddedFrame && [action.request.URL.scheme isEqualToString:@"about"]);
    decisionHandler(allowed ? WKNavigationActionPolicyAllow : WKNavigationActionPolicyCancel);
}

- (WKWebView *)webView:(WKWebView *)webView createWebViewWithConfiguration:(WKWebViewConfiguration *)configuration
    forNavigationAction:(WKNavigationAction *)action windowFeatures:(WKWindowFeatures *)features {
    if (IsWebLink(action.request.URL)) [webView loadRequest:action.request];
    return nil;
}

- (void)webView:(WKWebView *)webView didCommitNavigation:(WKNavigation *)navigation {
    self.window.title = webView.URL.host ?: @"CubeRoot";
}

@end

void cuberoot_open_web_link(const char *href) {
    NSURL *url = [NSURL URLWithString:[NSString stringWithUTF8String:href]];
    if (!IsWebLink(url)) return;
    if (!webLinkWindow) webLinkWindow = [[CubeRootWebLinkWindow alloc] init];
    webLinkWindow.window.title = url.host;
    [webLinkWindow.webView loadRequest:[NSURLRequest requestWithURL:url]];
    [webLinkWindow showWindow:nil];
    [webLinkWindow.window makeKeyAndOrderFront:nil];
}

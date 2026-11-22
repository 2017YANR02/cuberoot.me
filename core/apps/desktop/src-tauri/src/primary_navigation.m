#import <AppKit/AppKit.h>
#import <WebKit/WebKit.h>
#import <objc/runtime.h>
#include <stdbool.h>

#if __MAC_OS_X_VERSION_MAX_ALLOWED >= 260000

static NSArray<NSString *> *NavigationIDs(void) {
    return @[@"timer", @"tools", @"account"];
}

API_AVAILABLE(macos(26.0))
static NSColor *NavigationAccent(id value) {
    if ([value isKindOfClass:NSString.class] && [value length] == 7 && [value hasPrefix:@"#"]) {
        NSScanner *scanner = [NSScanner scannerWithString:[value substringFromIndex:1]];
        unsigned int hex;
        if ([scanner scanHexInt:&hex] && scanner.isAtEnd) {
            return [NSColor colorWithSRGBRed:((hex >> 16) & 255) / 255.0 green:((hex >> 8) & 255) / 255.0
                                       blue:(hex & 255) / 255.0 alpha:1];
        }
    }
    return NSColor.controlAccentColor;
}

static BOOL NavigationFrame(WKWebView *webView, CGFloat viewportHeight, id value, NSRect *result) {
    if (![value isKindOfClass:NSDictionary.class]) return NO;
    NSDictionary *frame = value;
    for (NSString *key in @[@"x", @"y", @"width", @"height"]) {
        if (![frame[key] isKindOfClass:NSNumber.class] || !isfinite([frame[key] doubleValue])) return NO;
    }
    NSRect rect = NSMakeRect([frame[@"x"] doubleValue], [frame[@"y"] doubleValue],
                             [frame[@"width"] doubleValue], [frame[@"height"] doubleValue]);
    if (NSIsEmptyRect(rect)) return NO;
    // The WKWebView can extend under the title bar; DOM coordinates start at the viewport.
    CGFloat bottom = viewportHeight - NSMaxY(rect);
    rect.origin.y = webView.isFlipped ? NSHeight(webView.bounds) - bottom - NSHeight(rect) : bottom;
    *result = [webView convertRect:rect toView:webView.superview];
    return YES;
}

API_AVAILABLE(macos(26.0))
@interface CubeRootPrimaryNavigation : NSObject
@property (nonatomic, weak) WKWebView *webView;
@property (nonatomic, strong) NSView *tabGroup;
@property (nonatomic, strong) NSGlassEffectContainerView *glassGroup;
@property (nonatomic, strong) NSGlassEffectView *capsule;
@property (nonatomic, strong) NSGlassEffectView *selection;
@property (nonatomic, copy) NSArray<NSButton *> *tabs;
@property (nonatomic, strong) NSGlassEffectView *searchCapsule;
@property (nonatomic, strong) NSButton *searchButton;
@property (nonatomic, strong) NSImage *searchIcon;
@property (nonatomic, strong) NSImage *closeIcon;
@property (nonatomic) NSInteger selectedSegment;
@property (nonatomic) NSInteger pressedSegment;
@property (nonatomic) CGFloat pressCenterOffset;
@property (nonatomic) CGFloat pressedCenter;
- (instancetype)initWithWebView:(WKWebView *)webView;
- (BOOL)render:(id)state;
@end

@implementation CubeRootPrimaryNavigation

- (instancetype)initWithWebView:(WKWebView *)webView {
    self = [super init];
    if (!self) return nil;
    _webView = webView;
    _pressedSegment = -1;
    _tabGroup = [[NSView alloc] initWithFrame:NSZeroRect];
    _tabGroup.accessibilityElement = YES;
    _tabGroup.accessibilityRole = NSAccessibilityTabGroupRole;
    _glassGroup = [[NSGlassEffectContainerView alloc] initWithFrame:NSZeroRect];
    _glassGroup.contentView = [[NSView alloc] initWithFrame:NSZeroRect];
    [_tabGroup addSubview:_glassGroup];
    _capsule = [[NSGlassEffectView alloc] initWithFrame:NSZeroRect];
    _capsule.contentView = [[NSView alloc] initWithFrame:NSZeroRect];
    [_glassGroup.contentView addSubview:_capsule];
    _selection = [[NSGlassEffectView alloc] initWithFrame:NSZeroRect];
    _selection.style = NSGlassEffectViewStyleClear;
    _selection.contentView = [[NSView alloc] initWithFrame:NSZeroRect];
    [_glassGroup.contentView addSubview:_selection];

    NSImageSymbolConfiguration *tabSymbol = [NSImageSymbolConfiguration configurationWithPointSize:15 weight:NSFontWeightMedium];
    NSArray<NSString *> *symbols = @[@"clock", @"square.grid.2x2", @"person.crop.circle"];
    NSMutableArray<NSButton *> *tabs = [NSMutableArray arrayWithCapacity:symbols.count];
    for (NSInteger index = 0; index < (NSInteger)symbols.count; index++) {
        NSImage *icon = [NSImage imageWithSystemSymbolName:symbols[index] accessibilityDescription:nil];
        NSButton *tab = [NSButton buttonWithTitle:@"" image:[icon imageWithSymbolConfiguration:tabSymbol]
                                          target:self action:@selector(switchTab:)];
        tab.bordered = NO;
        tab.imagePosition = NSImageLeading;
        tab.imageHugsTitle = YES;
        tab.font = [NSFont systemFontOfSize:NSFont.systemFontSize weight:NSFontWeightMedium];
        tab.tag = index;
        tab.accessibilityRole = NSAccessibilityRadioButtonRole;
        tab.accessibilityChildren = @[];
        [tab addTarget:self action:@selector(pressTab:) forControlEvents:NSControlEventTrackingBegan];
        [tab addTarget:self action:@selector(dragTab:) forControlEvents:NSControlEventTrackingInside
            | NSControlEventTrackingOutside | NSControlEventTrackingEntered | NSControlEventTrackingExited];
        [tab addTarget:self action:@selector(releaseTab:) forControlEvents:
            NSControlEventTrackingEndedInside | NSControlEventTrackingEndedOutside];
        [tab addTarget:self action:@selector(cancelTab:) forControlEvents:NSControlEventTrackingCancelled];
        [_tabGroup addSubview:tab];
        [tabs addObject:tab];
    }
    _tabs = [tabs copy];
    _tabGroup.accessibilityTabs = _tabs;
    _tabGroup.accessibilityChildren = _tabs;

    NSImageSymbolConfiguration *searchSymbol = [NSImageSymbolConfiguration configurationWithPointSize:18 weight:NSFontWeightMedium];
    _searchIcon = [[NSImage imageWithSystemSymbolName:@"magnifyingglass" accessibilityDescription:nil] imageWithSymbolConfiguration:searchSymbol];
    _closeIcon = [[NSImage imageWithSystemSymbolName:@"xmark" accessibilityDescription:nil] imageWithSymbolConfiguration:searchSymbol];
    _searchButton = [NSButton buttonWithImage:_searchIcon target:self action:@selector(toggleSearch:)];
    _searchButton.bordered = NO;
    _searchCapsule = [[NSGlassEffectView alloc] initWithFrame:NSZeroRect];
    _searchCapsule.contentView = _searchButton;

#if __MAC_OS_X_VERSION_MAX_ALLOWED >= 270000
    if (@available(macOS 27.0, *)) {
        _searchCapsule.effectIsInteractive = YES;
    }
#endif
    return self;
}

- (void)hide {
    self.tabGroup.hidden = YES;
    self.pressedSegment = -1;
    self.searchCapsule.hidden = YES;
}

- (NSRect)tabFrame:(NSInteger)index {
    CGFloat width = (NSWidth(self.tabGroup.bounds) - 10) / self.tabs.count;
    return NSMakeRect(5 + width * index, 4, width, NSHeight(self.tabGroup.bounds) - 8);
}

- (void)layoutSelectionAnimated:(BOOL)animated {
    BOOL reduceMotion = NSWorkspace.sharedWorkspace.accessibilityDisplayShouldReduceMotion;
    NSInteger index = self.pressedSegment < 0 ? self.selectedSegment : self.pressedSegment;
    NSRect frame = [self tabFrame:index];
    if (self.pressedSegment >= 0) {
        if (!reduceMotion) frame = NSInsetRect(frame, -NSWidth(frame) * 0.09, -2.5);
        CGFloat left = self.pressedCenter - NSWidth(frame) / 2;
        frame.origin.x = MAX(2, MIN(left, NSWidth(self.tabGroup.bounds) - NSWidth(frame) - 2));
    }
    CGFloat radius = NSHeight(frame) / 2;
    if (animated && !reduceMotion) {
        [NSAnimationContext runAnimationGroup:^(NSAnimationContext *context) {
            context.duration = 0.16;
            self.selection.animator.frame = frame;
            self.selection.cornerRadius = radius;
        }];
    } else {
        self.selection.frame = frame;
        self.selection.cornerRadius = radius;
    }
}

- (BOOL)render:(id)value {
    if (value == NSNull.null) {
        [self hide];
        return YES;
    }
    if (![value isKindOfClass:NSDictionary.class]) {
        [self hide];
        return NO;
    }
    NSDictionary *state = value;
    WKWebView *webView = self.webView;
    NSView *parent = webView.superview;
    NSArray<NSString *> *ids = NavigationIDs();
    NSArray *items = state[@"items"];
    NSDictionary *search = state[@"search"];
    NSNumber *viewportHeight = state[@"viewportHeight"];
    NSUInteger selected = [ids indexOfObject:state[@"selected"] ?: NSNull.null];
    NSRect capsuleFrame, searchFrame;
    if (!parent || selected == NSNotFound || [state[@"vertical"] isEqual:@YES]
        || ![viewportHeight isKindOfClass:NSNumber.class] || !isfinite(viewportHeight.doubleValue) || viewportHeight.doubleValue <= 0
        || ![items isKindOfClass:NSArray.class] || items.count != ids.count
        || !NavigationFrame(webView, viewportHeight.doubleValue, state[@"frame"], &capsuleFrame)
        || (search && (![search isKindOfClass:NSDictionary.class] || ![search[@"label"] isKindOfClass:NSString.class]
                       || !NavigationFrame(webView, viewportHeight.doubleValue, search[@"frame"], &searchFrame)))) {
        [self hide];
        return NO;
    }
    NSColor *accent = NavigationAccent(state[@"accent"]);
    for (NSUInteger index = 0; index < items.count; index++) {
        NSDictionary *item = items[index];
        if (![item isKindOfClass:NSDictionary.class] || ![ids[index] isEqual:item[@"id"]]
            || ![item[@"label"] isKindOfClass:NSString.class]) {
            [self hide];
            return NO;
        }
        NSString *label = item[@"label"];
        NSButton *tab = self.tabs[index];
        tab.title = label;
        tab.toolTip = label;
        tab.accessibilityLabel = label;
        tab.enabled = ![item[@"disabled"] isEqual:@YES];
        tab.contentTintColor = index == selected ? accent : nil;
        tab.accessibilityValue = @(index == selected);
    }

    if (self.tabGroup.superview != parent) {
        [parent addSubview:self.tabGroup positioned:NSWindowAbove relativeTo:webView];
        [parent addSubview:self.searchCapsule positioned:NSWindowAbove relativeTo:self.tabGroup];
    }

    NSAppearance *appearance = [NSAppearance appearanceNamed:[state[@"dark"] isEqual:@YES] ? NSAppearanceNameDarkAqua : NSAppearanceNameAqua];
    self.tabGroup.appearance = appearance;
    BOOL animateSelection = !self.tabGroup.hidden && !NSIsEmptyRect(self.selection.frame)
        && self.selectedSegment != (NSInteger)selected && NSEqualSizes(self.tabGroup.frame.size, capsuleFrame.size);
    self.tabGroup.frame = capsuleFrame;
    self.glassGroup.frame = self.tabGroup.bounds;
    self.glassGroup.contentView.frame = self.glassGroup.bounds;
    self.capsule.frame = self.glassGroup.bounds;
    self.capsule.cornerRadius = NSHeight(capsuleFrame) / 2;
    self.capsule.contentView.frame = self.capsule.bounds;
    self.selection.tintColor = [accent colorWithAlphaComponent:0.20];
    self.selectedSegment = (NSInteger)selected;
    for (NSButton *tab in self.tabs) tab.frame = [self tabFrame:tab.tag];
    [self layoutSelectionAnimated:animateSelection];
    self.tabGroup.hidden = NO;

    self.searchCapsule.hidden = search == nil;
    if (search) {
        BOOL expanded = [search[@"expanded"] isEqual:@YES];
        self.searchCapsule.appearance = appearance;
        self.searchCapsule.frame = searchFrame;
        self.searchCapsule.cornerRadius = NSHeight(searchFrame) / 2;
        self.searchButton.frame = self.searchCapsule.bounds;
        self.searchButton.image = expanded ? self.closeIcon : self.searchIcon;
        self.searchButton.accessibilityLabel = search[@"label"];
        self.searchButton.accessibilityExpanded = expanded;
        self.searchButton.toolTip = search[@"label"];
    }
    return YES;
}

- (void)sendAction:(NSString *)action {
    // All action IDs are constants from this adapter. Only the local main document receives them.
    NSString *script = [NSString stringWithFormat:@"window.dispatchEvent(new CustomEvent('cuberoot:mac-primary-navigation', {detail: '%@'}))", action];
    [self.webView evaluateJavaScript:script completionHandler:nil];
}

- (void)pressTab:(NSButton *)sender {
    NSPoint point = [self.tabGroup convertPoint:NSApp.currentEvent.locationInWindow fromView:nil];
    self.pressedSegment = sender.tag;
    self.pressedCenter = NSMidX([self tabFrame:sender.tag]);
    self.pressCenterOffset = self.pressedCenter - point.x;
    [self layoutSelectionAnimated:YES];
}

- (void)dragTab:(NSButton *)sender {
    if (self.pressedSegment != sender.tag) return;
    NSPoint point = [self.tabGroup convertPoint:NSApp.currentEvent.locationInWindow fromView:nil];
    self.pressedCenter = point.x + self.pressCenterOffset;
    [self layoutSelectionAnimated:NO];
}

- (void)cancelTab:(NSButton *)sender {
    self.pressedSegment = -1;
    [self layoutSelectionAnimated:YES];
}

- (void)releaseTab:(NSButton *)sender {
    if (self.pressedSegment != sender.tag) return;
    NSPoint point = [self.tabGroup convertPoint:NSApp.currentEvent.locationInWindow fromView:nil];
    [self cancelTab:sender];
    // The native button handles release in its own segment. A drag can end in a different one.
    if (!NSPointInRect(point, self.tabGroup.bounds)) return;
    for (NSButton *tab in self.tabs) {
        if (tab != sender && NSPointInRect(point, tab.frame)) {
            [self switchTab:tab];
            return;
        }
    }
}

- (void)switchTab:(NSButton *)sender {
    NSInteger index = sender.tag;
    NSArray<NSString *> *ids = NavigationIDs();
    if (index < 0 || index >= (NSInteger)ids.count || !sender.enabled) return;
    NSEventType event = NSApp.currentEvent.type;
    if (index == 0 && (event == NSEventTypeLeftMouseUp || event == NSEventTypeLeftMouseDown)) {
        [self.webView.window makeFirstResponder:self.webView];
    }
    [self sendAction:ids[index]];
}

- (void)toggleSearch:(NSButton *)sender {
    [self sendAction:@"search"];
}

@end

#endif

bool cuberoot_render_primary_navigation(void *pointer, const char *json) {
#if __MAC_OS_X_VERSION_MAX_ALLOWED >= 260000
    if (@available(macOS 26.0, *)) {
        WKWebView *webView = (__bridge WKWebView *)pointer;
        NSData *data = [[NSString stringWithUTF8String:json] dataUsingEncoding:NSUTF8StringEncoding];
        id state = [NSJSONSerialization JSONObjectWithData:data options:NSJSONReadingFragmentsAllowed error:nil];
        static char navigationKey;
        CubeRootPrimaryNavigation *navigation = objc_getAssociatedObject(webView, &navigationKey);
        if (!navigation && state == NSNull.null) return true;
        if (!navigation) {
            navigation = [[CubeRootPrimaryNavigation alloc] initWithWebView:webView];
            objc_setAssociatedObject(webView, &navigationKey, navigation, OBJC_ASSOCIATION_RETAIN_NONATOMIC);
        }
        return [navigation render:state];
    }
#endif
    return false;
}

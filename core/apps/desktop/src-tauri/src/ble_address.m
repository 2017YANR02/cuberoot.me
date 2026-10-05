#import <CoreBluetooth/CoreBluetooth.h>
#import <Foundation/Foundation.h>

// CoreBluetooth's public identifier remains the GATT identity. This optional
// macOS-only lookup supplies a separate protocol-key address, as Bleak's
// use_bdaddr backend does. Never infer an address from the UUID or cube name.
@interface CubeRootAddressDelegate : NSObject <CBCentralManagerDelegate>
@property(nonatomic, strong) dispatch_semaphore_t ready;
@end
@implementation CubeRootAddressDelegate
- (void)centralManagerDidUpdateState:(CBCentralManager *)central {
    if (central.state != CBManagerStateUnknown && central.state != CBManagerStateResetting) {
        dispatch_semaphore_signal(self.ready);
    }
}
@end

// Called on a Rust blocking worker, never on the App's main/UI thread.
// Returns no address on missing API, unavailable adapter, timeout or bad data.
bool cuberoot_ble_address(const char *identifier, unsigned char *output) {
    @autoreleasepool {
        NSUUID *uuid = [[NSUUID alloc] initWithUUIDString:[NSString stringWithUTF8String:identifier]];
        if (!uuid) return false;
        dispatch_queue_t queue = dispatch_queue_create("me.cuberoot.ble-address", DISPATCH_QUEUE_SERIAL);
        CubeRootAddressDelegate *delegate = [CubeRootAddressDelegate new];
        delegate.ready = dispatch_semaphore_create(0);
        CBCentralManager *central = [[CBCentralManager alloc] initWithDelegate:delegate queue:queue
            options:@{CBCentralManagerOptionShowPowerAlertKey: @NO}];
        bool ready = dispatch_semaphore_wait(delegate.ready,
            dispatch_time(DISPATCH_TIME_NOW, 3 * NSEC_PER_SEC)) == 0;
        __block NSData *address = nil;
        dispatch_sync(queue, ^{
            @try {
                SEL selector = NSSelectorFromString(@"retrieveAddressForPeripheral:");
                if (ready && central.state == CBManagerStatePoweredOn && [central respondsToSelector:selector]) {
                    CBPeripheral *peripheral = [central retrievePeripheralsWithIdentifiers:@[uuid]].firstObject;
                    if (peripheral) {
                        id (*lookup)(id, SEL, id) = (id (*)(id, SEL, id))[central methodForSelector:selector];
                        id value = lookup(central, selector, peripheral);
                        if ([value isKindOfClass:[NSData class]] && [value length] == 6) address = [value copy];
                    }
                }
            } @catch (NSException *exception) {
                // Undocumented APIs can disappear/change across system updates.
                // Keep the existing advertisement/manual fallback available.
            }
            central.delegate = nil;
        });
        if (address.length != 6) return false;
        const unsigned char *bytes = address.bytes;
        bool nonzero = false;
        bool nonbroadcast = false;
        for (NSUInteger i = 0; i < 6; i++) {
            nonzero |= bytes[i] != 0;
            nonbroadcast |= bytes[i] != 255;
        }
        if (!nonzero || !nonbroadcast) return false;
        [address getBytes:output length:6];
        return true;
    }
}

#import <IOKit/pwr_mgt/IOPMLib.h>

// All access is on the Tauri main thread.
int cuberoot_keep_awake(int enabled) {
    static IOPMAssertionID assertion = kIOPMNullAssertionID;
    if (enabled) {
        if (assertion != kIOPMNullAssertionID) return 0;
        return IOPMAssertionCreateWithName(kIOPMAssertionTypePreventUserIdleDisplaySleep,
            kIOPMAssertionLevelOn, CFSTR("CubeRoot timer"), &assertion);
    }
    if (assertion == kIOPMNullAssertionID) return 0;
    IOReturn result = IOPMAssertionRelease(assertion);
    if (result == kIOReturnSuccess) assertion = kIOPMNullAssertionID;
    return result;
}

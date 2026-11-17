# Windows certification notes — draft

Use this text only after the submitted candidate has passed the corresponding Windows checks. Supply the exact package version and restricted test credentials in Partner Center separately. Never put passwords, tokens or real customer data in this file.

## Product and access

CubeRoot is a non-game speedcubing timing and training utility. Its three main tabs are Timer, Tools and Account. The desktop executable contains the local timer UI; Tools and Account also provide access to CubeRoot online pages. Core local timing does not require an account or payment. Online account, membership and community features require an internet connection.

For a basic test, open Timer, choose a puzzle and random scramble source, then use the keyboard timing control to start and stop a solve. Confirm that the result appears in the local history, review the statistics, and restart the app to check persistence. Use the timer data controls to export and import a backup. Use a disposable test profile when checking imports or deletion. The package's visible controls and labels must be checked against these steps before submission.

Open Account to sign in to an existing CubeRoot account. Authentication may open the system browser and return through the me.cuberoot.app URI scheme. Test both a cold start and an already running app. Close any separately installed CubeRoot EXE edition before testing: the current editions share a single-instance identity and their coexistence still requires release validation.

## Optional hardware and permissions

runFullTrust is required because CubeRoot is a packaged Win32 Tauri desktop application. Native functions include Bluetooth communication, secure credential storage, file export and printing. The app does not request administrator elevation.

Bluetooth is used when the user chooses to connect a compatible smart cube. Microphone/audio-input permission is used for optional Stackmat timing through a connected audio input. Neither peripheral is required for keyboard timing. Select the relevant input in timer settings, connect compatible hardware and follow the device controls. Declining access must leave keyboard timing usable. Record the tested Windows version, cube model/firmware and Stackmat connection in the candidate's validation report.

Internet access supports sign-in, membership, online tools and community features. Do not classify the reachable online surface as containing no user-generated content or no communication merely because the local timer is usable offline.

## Membership and payments

The download and core timer are free. Optional paid membership uses the existing CubeRoot account and backend entitlements. This Windows edition does not use Microsoft Store in-app purchase products. Website checkout currently offers Alipay and WeChat Pay; the selected plan and price are shown before payment. The Store description discloses the current prices and must be refreshed against the live membership catalogue before submission.

Paid access is granted only after server-side payment verification. Returning from a browser or scanning a payment code alone does not grant membership. Existing membership can be accessed by signing in to the same account. Existing Apple and Google subscriptions remain managed through their original stores; switching to Windows does not cancel or migrate those subscriptions.

Provide a dedicated non-administrator review account with the required test entitlement through Partner Center's restricted certification field so that reviewers do not need to make a real purchase. Verify that the credentials and entitlement remain valid throughout review. Do not reuse an administrator or customer account.

Website order and refund support: https://cuberoot.me/contact
User agreement and privacy policy: https://cuberoot.me/privacy
Membership plans: https://cuberoot.me/membership

## Installation and updates

The candidate is an x64 MSIX for Windows Desktop. It requires Microsoft Edge WebView2 Runtime. A clean machine with no preinstalled runtime must pass the chosen runtime deployment or onboarding path before submission; listing the dependency here does not resolve that release gate.

The Microsoft Store channel does not expose the standalone EXE update entry. Updates for this channel are delivered through the Store. Validate package upgrades, local data retention, protocol association and uninstall behavior on the exact submitted build. Do not ask reviewers to disable security protections or install an untrusted test certificate for the Store-delivered package.

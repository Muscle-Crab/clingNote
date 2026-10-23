#!/usr/bin/env python3
"""Make the generated OneSignal Cordova plugin build under Capacitor's Swift Package Manager setup.

`npx cap sync ios` generates ios/capacitor-cordova-ios-plugins/sources/OnesignalCordovaPlugin, which imports
<OneSignalFramework/OneSignalFramework.h> but declares no dependency on the OneSignal iOS SDK (the plugin only ships a
CocoaPods spec). This adds the official OneSignal-XCFramework Swift package and drops the Live Activities methods
(the app does not use them and their Swift header is not exposed through SwiftPM). Idempotent. Run after `cap sync ios`.
"""
import re, pathlib, sys
d = pathlib.Path('ios/capacitor-cordova-ios-plugins/sources/OnesignalCordovaPlugin')
if not d.exists():
    sys.exit('OnesignalCordovaPlugin not generated; run `npx cap sync ios` first')
pkg = d / 'Package.swift'; s = pkg.read_text()
if 'OneSignal-XCFramework' not in s:
    s = s.replace('.package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", from: "8.5.3")',
                  '.package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", from: "8.5.3"),\n        .package(url: "https://github.com/OneSignal/OneSignal-XCFramework", exact: "5.2.9")')
    s = s.replace('.product(name: "Cordova", package: "capacitor-swift-pm")',
                  '.product(name: "Cordova", package: "capacitor-swift-pm"),\n                .product(name: "OneSignalFramework", package: "OneSignal-XCFramework")')
    pkg.write_text(s)
m = d / 'OneSignalPush.m'; t = m.read_text()
t = t.replace('#import "OneSignalLiveActivities/OneSignalLiveActivities-Swift.h"\n', '')
i = t.find('- (void)enterLiveActivity:'); j = t.rfind('@end')
if i != -1 and j > i:
    t = t[:i] + t[j:]
m.write_text(t)
print('patched OnesignalCordovaPlugin for SwiftPM')

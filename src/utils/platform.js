// Tiny platform helpers. The same Vue bundle runs on the web (Stripe paywall, web push) and inside the Capacitor iOS shell (Apple IAP).
import { Capacitor } from '@capacitor/core';
export const isNative = () => { try { return Capacitor.isNativePlatform(); } catch (e) { return false; } };
export const isNativeIOS = () => { try { return Capacitor.getPlatform() === 'ios'; } catch (e) { return false; } };

// Guideline 1.2 tools live on Community (age 18+, EULA, filter, report, block, hide, developer eject).
// Legacy rooms, rankings, and other people's profiles stay hidden in the iOS app. The web is unchanged.
export const UGC_TOOLS_AVAILABLE = false;
export const ugcHidden = () => isNativeIOS() && !UGC_TOOLS_AVAILABLE;
// Web Speech API (SpeechRecognition) does not exist in WKWebView, so voice input is not offered inside the iOS shell.
export const voiceInputBlocked = () => isNativeIOS();

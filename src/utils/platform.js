// Tiny platform helpers. The same Vue bundle runs on the web (Stripe paywall, web push) and inside the Capacitor iOS shell (Apple IAP).
import { Capacitor } from '@capacitor/core';
export const isNative = () => { try { return Capacitor.isNativePlatform(); } catch (e) { return false; } };
export const isNativeIOS = () => { try { return Capacitor.getPlatform() === 'ios'; } catch (e) { return false; } };

// User-generated content (Guideline 1.2): community surfaces (Rankings, Community, Discussion, Chat Rooms, other users' profiles) expose other
// people's names/photos/posts. They stay hidden in the iOS app until in-app report + block + moderation tools exist; the web is unchanged.
export const UGC_TOOLS_AVAILABLE = false; // flip to true only once report/block/filter are implemented
export const ugcHidden = () => isNativeIOS() && !UGC_TOOLS_AVAILABLE;
// Web Speech API (SpeechRecognition) does not exist in WKWebView, so voice input is not offered inside the iOS shell.
export const voiceInputBlocked = () => isNativeIOS();

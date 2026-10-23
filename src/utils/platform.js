// Tiny platform helpers. The same Vue bundle runs on the web (Stripe paywall, web push) and inside the Capacitor iOS shell (Apple IAP).
import { Capacitor } from '@capacitor/core';
export const isNative = () => { try { return Capacitor.isNativePlatform(); } catch (e) { return false; } };
export const isNativeIOS = () => { try { return Capacitor.getPlatform() === 'ios'; } catch (e) { return false; } };

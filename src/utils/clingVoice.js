// JS side of the local iOS plugin "ClingVoice" (ios/App/App/ClingVoicePlugin.swift): boss TTS + on-device speech recognition.
import { Capacitor, registerPlugin } from '@capacitor/core';
export const nativeVoiceAvailable = () => { try { return Capacitor.getPlatform() === 'ios' && Capacitor.isPluginAvailable('ClingVoice'); } catch (e) { return false; } };
export const ClingVoice = registerPlugin('ClingVoice');

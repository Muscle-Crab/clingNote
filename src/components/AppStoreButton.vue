<template>
  <a v-if="!native" :href="APP_STORE_URL" target="_blank" rel="noopener" class="asb" :class="{ 'asb-sm': small }" data-test="app-store-btn" aria-label="Download ClingNote on the App Store">
    <svg class="asb-logo" viewBox="0 0 384 512" aria-hidden="true"><path fill="currentColor" d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"/></svg>
    <span class="asb-t"><small>Download on the</small><b>App Store</b></span>
  </a>
</template>
<script setup>
import { APP_STORE_URL } from '@/config/appStore';
import { isNativeIOS } from '@/utils/platform';
import { Capacitor } from '@capacitor/core';
defineProps({ small: Boolean });
const native = (() => { try { return isNativeIOS() || Capacitor.isNativePlatform(); } catch (e) { return false; } })();
</script>
<style scoped>
.asb { display: inline-flex; align-items: center; gap: 8px; background: #000; color: #fff; border: 1px solid #a6a6a6; border-radius: 10px; padding: 6px 14px 6px 10px; text-decoration: none; line-height: 1; transition: transform .12s, border-color .12s; }
.asb:hover { border-color: #fff; transform: translateY(-1px); }
.asb-logo { width: 22px; height: 26px; }
.asb-t { display: flex; flex-direction: column; text-align: left; }
.asb-t small { font-size: 10px; letter-spacing: .02em; }
.asb-t b { font-size: 19px; font-weight: 600; letter-spacing: -.01em; margin-top: 2px; }
.asb-sm { padding: 5px 12px 5px 9px; } .asb-sm .asb-logo { width: 18px; height: 22px; } .asb-sm .asb-t b { font-size: 16px; }
.asb-wrap { margin-top: 18px; display: flex; justify-content: center; }
</style>

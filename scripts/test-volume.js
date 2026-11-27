// Background music volume slider: touch/wheel math, live GainNode, wiring. Run: node scripts/test-volume.js
const assert = require('assert'); const fs = require('fs'); const path = require('path'); const sr = require('./lib/srcRequire');
const p = sr.load('utils/bgPrefs.js'); let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; };
const rect = { left: 100, width: 200 };
ok(p.volumeFromX(100, rect) === 0 && p.volumeFromX(300, rect) === 1 && p.volumeFromX(200, rect) === 0.5 && p.volumeFromX(50, rect) === 0 && p.volumeFromX(999, rect) === 1, 'x -> volume clamped');
ok(p.volumeFromX(161, rect) === 0.3, '0.05 steps');
ok(p.nudgeVolume(0.5, -100) === 0.55 && p.nudgeVolume(0.5, 100) === 0.45 && p.nudgeVolume(1, -1) === 1 && p.nudgeVolume(0, 1) === 0, 'wheel up/down');
const panel = fs.readFileSync(path.join(__dirname, '../src/components/background/BackgroundPanel.vue'), 'utf8');
ok(/data-test="bg-volume-hit"[^>]*@pointerdown="volDown"[^>]*@touchstart="volDown"[^>]*@pointermove="volMove"[^>]*@wheel\.prevent="volWheel"/.test(panel) && /setPointerCapture/.test(panel) && /addEventListener\('pointermove'/.test(panel) && /addEventListener\('touchmove'/.test(panel) && !/lostpointercapture/.test(panel) && !/pointerType !== 'pen'/.test(panel) && /\.bgp-vol-hit \{[^}]*min-height: 44px[^}]*touch-action: none/.test(panel), 'slider: drag follows the finger even if the sheet steals the capture');
const audio = fs.readFileSync(path.join(__dirname, '../src/composables/useBackgroundAudio.js'), 'utf8');
ok(/const punchGain = \(\) => \{[\s\S]*setValueAtTime\(target, t\)/.test(audio) && /setVolume\(v\) \{[^\n]*return punchGain\(\)/.test(audio) && !/setTargetAtTime\(v \* 0\.9/.test(audio) && !/\.volume\s*=/.test(audio), 'volume is applied immediately on the GainNode, not media.volume');
const bg = fs.readFileSync(path.join(__dirname, '../src/composables/useBackground.js'), 'utf8');
ok(/setVolume\(v\) \{[^\n]*persist\(\)[^\n]*engine\.setVolume/.test(bg), 'persists and applies live');
console.log(`volume: ${n} checks passed`);

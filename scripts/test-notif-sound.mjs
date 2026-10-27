// Custom notification sounds: mapping, mute, bundled .caf files, Xcode resources, and push payloads.
import assert from 'assert';
import { readFileSync, existsSync } from 'fs';
import { createRequire } from 'module';
import path from 'path'; import { fileURLToPath } from 'url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { NOTIF_SOUNDS, soundKind, notifSound, voiceMutedNow, VOICE_MUTE_KEY } = await import(path.join(root, 'src/utils/notifSound.js'));

// mapping
for (const t of ['reminder', 'time', 'sched', 'scheduled', 'repeat', 'timer', 'mgr']) assert.strictEqual(soundKind(t), 'task', t);
assert.strictEqual(soundKind(undefined, 'rem:abc'), 'task');
assert.strictEqual(soundKind('morning'), 'morning');
for (const t of ['dayend', 'rollover', 'evening', 'recap']) assert.strictEqual(soundKind(t), 'evening', t);
assert.strictEqual(soundKind(undefined, 'rollover:2026-10-27:a'), 'evening');
assert.strictEqual(soundKind('community'), null);
assert.strictEqual(notifSound('reminder'), 'cn_task.caf');
assert.strictEqual(notifSound('morning'), 'cn_morning.caf');
assert.strictEqual(notifSound('dayend'), 'cn_evening.caf');
assert.strictEqual(notifSound('community'), undefined);
// mute -> no custom sound (iOS default)
for (const t of ['reminder', 'morning', 'dayend']) assert.strictEqual(notifSound(t, '', { muted: true }), undefined);
const store = (v) => ({ getItem: (k) => (k === VOICE_MUTE_KEY ? v : null) });
assert.strictEqual(VOICE_MUTE_KEY, /MUTE_KEY = '([^']+)'/.exec(readFileSync(path.join(root, 'src/composables/useVoiceover.js'), 'utf8'))[1], 'mute key in sync with useVoiceover');
assert.strictEqual(voiceMutedNow(store('1')), true); assert.strictEqual(voiceMutedNow(store('0')), false); assert.strictEqual(voiceMutedNow(null), false);

// bundled .caf files: CAF header, linear PCM or IMA4, <= 3 s
const pbx = readFileSync(path.join(root, 'ios/App/App.xcodeproj/project.pbxproj'), 'utf8');
const resPhase = /504EC3021FED79650016851F \/\* Resources \*\/ = \{[\s\S]*?files = \(([\s\S]*?)\);/.exec(pbx)[1];
for (const f of Object.values(NOTIF_SOUNDS)) {
  const p = path.join(root, 'ios/App/App', f); assert.ok(existsSync(p), `${f} bundled`);
  const b = readFileSync(p); assert.strictEqual(b.toString('ascii', 0, 4), 'caff', `${f} is CAF`);
  let off = 8; let rate = 0; let fmt = ''; let bpf = 0; let fpp = 0; let dataBytes = 0;
  while (off + 12 <= b.length) {
    const type = b.toString('ascii', off, off + 4); const size = Number(b.readBigInt64BE(off + 4)); const body = off + 12;
    if (type === 'desc') { rate = b.readDoubleBE(body); fmt = b.toString('ascii', body + 8, body + 12); bpf = b.readUInt32BE(body + 16); fpp = b.readUInt32BE(body + 20); }
    if (type === 'data') { dataBytes = (size < 0 ? b.length - body : size) - 4; break; }
    off = body + size;
  }
  assert.ok(['lpcm', 'ima4'].includes(fmt), `${f} format ${fmt}`);
  const secs = (dataBytes / bpf) * fpp / rate; assert.ok(secs > 0.5 && secs <= 3.05, `${f} duration ${secs}`);
  assert.ok(pbx.includes(`path = ${f};`), `${f} file reference`);
  assert.ok(resPhase.includes(`${f} in Resources`), `${f} in App Resources build phase`);
}

// local notifications carry the sound
const ln = readFileSync(path.join(root, 'src/utils/localNotify.js'), 'utf8');
assert.ok(/notifSound\(type, key, \{ muted: voiceMutedNow\(\) \}\)/.test(ln) && /\.\.\.\(sound \? \{ sound \} : \{\}\)/.test(ln), 'scheduleLocal sets sound');

// server pushes
const { buildPayload } = require(path.join(root, 'netlify/functions/lib/notify.js'));
assert.strictEqual(buildPayload({ appId: 'a', uid: 'u', title: 't', message: 'm', sound: 'cn_task.caf' }).ios_sound, 'cn_task.caf');
assert.strictEqual(buildPayload({ appId: 'a', uid: 'u', title: 't', message: 'm', sound: '../evil.caf' }).ios_sound, undefined);
assert.strictEqual(buildPayload({ appId: 'a', uid: 'u', title: 't', message: 'm' }).ios_sound, undefined);
const { runReports } = require(path.join(root, 'netlify/functions/daily-report.js'));
const mkDb = (settings) => ({
  collection: () => ({ where: () => ({ get: async () => ({ docs: [{ id: 'ZZTEST', data: () => settings, ref: { set: async () => {} } }] }) }) }),
  doc: () => ({ get: async () => ({ exists: false, data: () => ({}) }) }),
});
const now = new Date('2026-10-27T14:00:00Z');
let sent = []; await runReports({ db: mkDb({ morningReport: { enabled: true, timeZone: 'America/New_York' } }), now, send: async (p) => sent.push(p) });
assert.strictEqual(sent.length, 1); assert.strictEqual(sent[0].ios_sound, 'cn_morning.caf');
sent = []; await runReports({ db: mkDb({ morningReport: { enabled: true, timeZone: 'America/New_York' }, notifVoice: false }), now, send: async (p) => sent.push(p) });
assert.strictEqual(sent.length, 1); assert.strictEqual(sent[0].ios_sound, undefined, 'muted -> default sound');
console.log('notif-sound OK');

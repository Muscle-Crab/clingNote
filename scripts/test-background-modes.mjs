// Guideline 2.5.4: UIBackgroundModes must not declare audio. Remote notifications stay.
// Parses the plist with Python's plistlib (the same XML the Xcode target packages via INFOPLIST_FILE).
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const py = `
import json, plistlib, sys
out = []
for path in sys.argv[1:]:
    with open(path, 'rb') as f:
        data = plistlib.load(f)
    modes = data.get('UIBackgroundModes')
    out.append({'path': path, 'modes': modes})
print(json.dumps(out))
`;

const walk = (dir, acc = []) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, acc);
    else if (name === 'Info.plist') acc.push(p);
  }
  return acc;
};

const plists = walk('ios').filter((p) => !p.includes('GoogleService-Info.plist'));
assert.ok(plists.some((p) => p.endsWith('ios/App/App/Info.plist')), 'app Info.plist is the packaged source');
const parsed = JSON.parse(execFileSync('python3', ['-c', py, ...plists], { encoding: 'utf8' }));
const app = parsed.find((row) => row.path.endsWith('ios/App/App/Info.plist'));
assert.ok(app, 'app plist parsed');
assert.deepEqual(app.modes, ['remote-notification'], 'background modes are remote notifications only');
for (const row of parsed) {
  const modes = row.modes || [];
  assert.ok(!modes.includes('audio'), `${row.path} must not declare background audio`);
}
const pbx = readFileSync('ios/App/App.xcodeproj/project.pbxproj', 'utf8');
assert.equal(pbx.match(/INFOPLIST_FILE = App\/Info\.plist;/g).length, 2, 'Debug and Release use App/Info.plist');
assert.ok(!/INFOPLIST_KEY_UIBackgroundModes/.test(pbx), 'no generated background-mode build setting');
const cap = readFileSync('capacitor.config.json', 'utf8');
assert.ok(!/"audio"/.test(cap), 'Capacitor config does not add an audio background mode');
const ents = [
  ['ios/App/App/App.entitlements', 'app.clingnote.ios'],
  ['ios/App/ClingLockMonitor/ClingLockMonitor.entitlements', 'app.clingnote.ios.lockmonitor'],
  ['ios/App/ClingShieldConfig/ClingShieldConfig.entitlements', 'app.clingnote.ios.shieldconfig'],
];
for (const [file, id] of ents) {
  assert.ok(readFileSync(file, 'utf8').includes('com.apple.developer.family-controls'), file);
  assert.ok(pbx.includes(`PRODUCT_BUNDLE_IDENTIFIER = ${id};`), id);
  assert.ok(pbx.includes(file.split('/').slice(-2).join('/')) || pbx.includes(file.split('/').pop()), file);
}
assert.ok(pbx.includes('CODE_SIGN_ENTITLEMENTS = App/App.entitlements;'));
assert.ok(pbx.includes('CODE_SIGN_ENTITLEMENTS = ClingLockMonitor/ClingLockMonitor.entitlements;'));
assert.ok(pbx.includes('CODE_SIGN_ENTITLEMENTS = ClingShieldConfig/ClingShieldConfig.entitlements;'));
assert.ok(!readFileSync('ios/App/ClingNoteWidget/ClingNoteWidget.entitlements', 'utf8').includes('family-controls'), 'widget does not claim Family Controls');
console.log('background modes: audio absent, remote-notification kept, entitlements files present');

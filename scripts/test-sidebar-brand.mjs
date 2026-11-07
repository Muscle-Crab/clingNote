// Sidebar brand uses the robot app icon already shipped with the app, and the phone drawer closes only from the scrim or the X.
import assert from 'assert';
import fs from 'fs';
import { dismissSidebar } from '../src/utils/sidebarDismiss.js';

assert.equal(dismissSidebar({ where: 'scrim', overlay: true }), true, 'tap outside the phone drawer closes it');
assert.equal(dismissSidebar({ where: 'inside', overlay: true }), false, 'a tap inside the panel does not close it');
assert.equal(dismissSidebar({ where: 'close', overlay: true }), true, 'the X still closes it');
assert.equal(dismissSidebar({ where: 'scrim', overlay: false }), false, 'the wide layout has no outside scrim');
assert.equal(dismissSidebar({ where: 'content', overlay: true }), false);

const nav = fs.readFileSync(new URL('../src/components/nav.vue', import.meta.url), 'utf8');
const asideAt = nav.indexOf('data-test="nav-sidebar"');
const scrimAt = nav.indexOf('data-test="nav-scrim"');
assert.ok(scrimAt > 0 && asideAt > scrimAt, 'scrim is a sibling in front of the panel, not inside it');
assert.ok(nav.includes('src="/app-icon-robot.png"') && nav.includes('data-test="nav-logo"') && nav.includes('alt="ClingNote"'));
assert.ok(!nav.includes('clingnote-logo'), 'sidebar no longer uses the checkmark-and-leaf logo');
assert.ok(nav.includes('@click.stop') && nav.includes('@click="onScrim"') && nav.includes('data-test="nav-close"'));
assert.ok(fs.existsSync(new URL('../public/app-icon-robot.png', import.meta.url)), 'robot artwork already in the app');
const iconSet = fs.readFileSync(new URL('../ios/App/App/Assets.xcassets/AppIcon.appiconset/Contents.json', import.meta.url), 'utf8');
assert.ok(iconSet.includes('AppIcon-512@2x.png'), 'iOS app icon set is unchanged and still points at its own file');

console.log('sidebar brand + scrim: ok');

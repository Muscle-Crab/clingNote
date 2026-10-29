// Run: node scripts/test-task-check-tap.js  (Home card: the complete circle only completes; it must never also open the details sheet)
const fs = require('fs'); const path = require('path'); const assert = require('assert');
const src = fs.readFileSync(path.join(__dirname, '..', 'src/components/home/TaskCard.vue'), 'utf8');
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok -', name); };
t('check button stops propagation to the card tap', () => assert.ok(/class="task-check"/.test(src) && /ref="checkEl" @click\.stop="onCheck"/.test(src)));
t('card tap skips interactive elements via composedPath (survives a detached event.target)', () => {
  const body = src.slice(src.indexOf('const onCardTap'), src.indexOf("emit('open-detail'); // tap = details sheet"));
  assert.ok(/composedPath\(\)/.test(body)); assert.ok(!/event\.target\.closest\(/.test(body));
});
t('card tap still opens the details sheet', () => assert.ok(src.includes("emit('open-detail'); // tap = details sheet")));
t('complete hit target stays the 44px circle (no wider)', () => { const v = fs.readFileSync(path.join(__dirname, '..', 'src/views/HomeView.vue'), 'utf8'); assert.ok(v.includes('.app-root .task-check.task-check.task-check { width: 44px; height: 44px;')); assert.ok(!/\.task-check[^{]*::(before|after)/.test(src + v)); });
console.log(`\n${n} task-check tap tests passed`);

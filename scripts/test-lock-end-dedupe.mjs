// Mirrors LockEndAlertGate + notifyLockEnded in ios/App/ClingLockMonitor/ClingLockMonitor.swift (no Swift toolchain in CI checks).
import assert from 'assert';
import fs from 'fs';
const src = fs.readFileSync(new URL('../ios/App/ClingLockMonitor/ClingLockMonitor.swift', import.meta.url), 'utf8');
assert(!/cling\.lock\.ended\.\\\(UUID/.test(src), 'lock-end alert must not use a per-call UUID identifier');
assert(/identifier: LockEndAlertGate\.identifier/.test(src));
const WINDOW = Number(src.match(/static let window: Double = (\d+)/)[1]);
const shouldPost = (last, now) => last <= 0 || now - last >= WINDOW || now < last;
const sim = (ends) => { const center = new Map(); let last = 0; let posted = 0;
  for (const now of ends) { if (!shouldPost(last, now)) continue; last = now; posted++; center.set('cling.lock.ended', now); }
  return { posted, shown: center.size }; };
// 8 per-app activities ending at the same minute -> one alert
{ const t = 1793330000; const r = sim([...Array(8)].map((_, i) => t + i * 0.2)); assert.equal(r.posted, 1); assert.equal(r.shown, 1); }
// two separate locks 2 h apart -> two alerts (latest replaces the delivered one)
{ const r = sim([1000, 1000 + 7200]); assert.equal(r.posted, 2); assert.equal(r.shown, 1); }
console.log('test-lock-end-dedupe: ok');

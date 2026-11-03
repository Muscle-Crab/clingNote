// Realistic AI/local duration estimates: sample tasks -> expected minute ranges; prompts carry duration guidance and allow long tasks.
// Run: node scripts/test-estimate-ranges.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { localEstimateMinutes, parseAiMinutes } from '../src/utils/aiEstimate.js';
const FIX = [['car inspection', 60, 120], ['Inspection', 60, 120], ['home inspection', 90, 180], ['roof inspection', 90, 180], ['site visit', 60, 120],
  ['dentist appointment', 45, 90], ['doctor appointment', 45, 90], ['job interview', 45, 90], ['renew passport', 60, 120], ['move apartments', 240, 600],
  ['assemble desk', 60, 120], ['call mom', 5, 30], ['take out trash', 5, 15], ['oil change', 60, 120]];
let n = 0;
for (const [title, lo, hi] of FIX) { const m = localEstimateMinutes({ title }).minutes; assert.ok(m >= lo && m <= hi, `${title}: ${m} not in ${lo}-${hi}`); n++; console.log(`ok - ${title} -> ${m} min`); }
assert.equal(parseAiMinutes('{"minutes": 480}'), 480); n++; // long AI answers are kept (no short clamp)
const p = fs.readFileSync(new URL('../netlify/functions/lib/aiPrompts.js', import.meta.url), 'utf8');
assert.match(p, /"car inspection" 90/); assert.match(p, /up to several hours/); assert.match(p, /between 5 and 600/); n++;
const a = fs.readFileSync(new URL('../netlify/functions/lib/agentTools.js', import.meta.url), 'utf8');
assert.match(a, /car inspection 90/); assert.doesNotMatch(a, /omit duration when they did not say one/); n++;
console.log(`${n} estimate-range tests passed`);

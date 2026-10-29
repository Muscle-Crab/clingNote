// Per-app lock by name (pure, unit-tested in scripts/test-app-lock-names.mjs).
// Apple only gives ClingNote opaque app tokens from the Screen Time picker, never app names or bundle IDs. So the user picks
// each app once and confirms a name for it (native NamedPickerView); the assistant's names ("YT", "tik tok") resolve against
// those saved labels here. Unknown names start the guided first-lock flow, then the original request resumes (resumePending).
export const ALIASES = {
  youtube: ['yt', 'you tube', 'youtube shorts', 'shorts'], tiktok: ['tik tok', 'tt', 'tic toc', 'tiktoc', 'tick tock'],
  instagram: ['ig', 'insta', 'gram', 'reels'], facebook: ['fb', 'meta'], snapchat: ['snap', 'sc'], twitter: ['x', 'twitter x', 'x twitter'],
  reddit: ['r', 'reddit app'], netflix: ['nf'], whatsapp: ['whats app', 'wa'], discord: ['dc'], twitch: [], pinterest: ['pin'],
  threads: [], linkedin: ['linked in'], messenger: ['fb messenger'], 'prime video': ['prime', 'amazon prime'], 'disney+': ['disney plus', 'disney'],
  roblox: [], fortnite: [], spotify: [], safari: [], chrome: ['google chrome'], telegram: ['tg'], bereal: ['be real'], hulu: [], 'hbo max': ['max', 'hbo'],
};
export const norm = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/\bapp\b/g, ' ').replace(/[^a-z0-9+]+/g, ' ').trim();
const squash = (s) => norm(s).replace(/ /g, '');
// canonical key for a spoken name or a label: alias -> canonical app ("yt" -> "youtube")
export const canonical = (s) => {
  const n = norm(s); const q = squash(s);
  for (const [k, al] of Object.entries(ALIASES)) if (q === squash(k) || al.some((a) => squash(a) === q || norm(a) === n)) return squash(k);
  return q;
};
const lev = (a, b) => { const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]); for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); return d[a.length][b.length]; };
// labels: saved names (strings). Returns {matched:[label], unknown:[name], ambiguous:[{name, options:[label]}]}; "all"/"everything" -> every label.
export const resolveApps = (names = [], labels = []) => {
  const out = { matched: [], unknown: [], ambiguous: [] }; const add = (l) => { if (!out.matched.includes(l)) out.matched.push(l); };
  const list = (Array.isArray(names) ? names : [names]).flatMap((x) => String(x || '').split(/\s*(?:,|&|\band\b|\bplus\b)\s*/i)).map((x) => x.trim()).filter(Boolean);
  for (const name of list) {
    if (/^(all|everything|all apps|all of them|every app|them all)$/i.test(norm(name))) { labels.forEach(add); continue; }
    const c = canonical(name); if (!c) continue;
    let hits = labels.filter((l) => canonical(l) === c);
    if (!hits.length) hits = labels.filter((l) => { const lc = canonical(l); return c.length >= 3 && (lc.startsWith(c) || (lc.length >= 4 && c.startsWith(lc))); });
    if (!hits.length && c.length >= 5) hits = labels.filter((l) => lev(canonical(l), c) <= (c.length >= 8 ? 2 : 1));
    if (hits.length === 1) add(hits[0]);
    else if (hits.length > 1) { const exact = hits.filter((l) => norm(l) === norm(name)); if (exact.length === 1) add(exact[0]); else out.ambiguous.push({ name, options: hits }); }
    else out.unknown.push(name);
  }
  return out;
};
// Pretty display name for a not-yet-picked app (used to prefill the naming row): "yt" -> "YouTube"
const PRETTY = { youtube: 'YouTube', tiktok: 'TikTok', instagram: 'Instagram', facebook: 'Facebook', snapchat: 'Snapchat', twitter: 'X', reddit: 'Reddit', netflix: 'Netflix', whatsapp: 'WhatsApp', discord: 'Discord', linkedin: 'LinkedIn', bereal: 'BeReal' };
export const prettyName = (s) => { const c = canonical(s); if (PRETTY[c]) return PRETTY[c]; const t = String(s || '').trim(); return t.replace(/\b\w/g, (m) => m.toUpperCase()); };
// minutes (number) or until_unlock -> untilMs (0 = until unlocked). Clamped 1 min .. 24 h.
export const untilFor = ({ minutes, until_unlock: uu } = {}, now = Date.now()) => {
  const m = Math.round(Number(minutes)); if (uu || !(m > 0)) return 0; return now + Math.min(1440, Math.max(1, m)) * 60000;
};
export const fmtDuration = (untilMs, now = Date.now()) => { if (!untilMs) return 'until you unlock them'; const m = Math.max(1, Math.round((untilMs - now) / 60000)); return m < 60 ? `for ${m} min` : `for ${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ''}`; };
export const joinNames = (a = []) => (a.length <= 1 ? (a[0] || '') : `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}`);

// Plan one lock/unlock request against saved labels. -> {kind:'run', labels} | {kind:'onboard', missing, pending} | {kind:'ask', question}
export const planLock = (action, args = {}, labels = [], now = Date.now()) => {
  const names = Array.isArray(args.apps) ? args.apps : (args.apps ? [args.apps] : []);
  if (action === 'unlock' && (!names.length || names.some((n) => /^(all|everything)$/i.test(norm(n))))) return { kind: 'run', labels: labels.slice(), all: true };
  if (!names.length) return { kind: 'ask', question: 'Which apps?' };
  const r = resolveApps(names, labels);
  if (r.ambiguous.length) return { kind: 'ask', question: `Which one did you mean: ${r.ambiguous.map((a) => joinNames(a.options)).join('; ')}?`, ambiguous: r.ambiguous };
  if (action === 'lock' && (r.unknown.length || !labels.length)) {
    const missing = (r.unknown.length ? r.unknown : names).map(prettyName);
    return { kind: 'onboard', missing, firstTime: !labels.length, pending: { action, apps: names, minutes: args.minutes || 0, until_unlock: !!args.until_unlock, createdAt: now } };
  }
  if (action === 'unlock' && !r.matched.length) return { kind: 'ask', question: `${joinNames(r.unknown.map(prettyName))} ${r.unknown.length > 1 ? "aren't" : "isn't"} locked.` };
  return { kind: 'run', labels: r.matched, unknown: r.unknown };
};
// After the guided picker: re-plan the saved request with the new labels. Stale (>10 min) or cancelled -> drop it.
export const PENDING_TTL = 10 * 60000;
export const resumePending = (pending, labels = [], { saved = true, now = Date.now() } = {}) => {
  if (!pending || !saved) return { kind: 'drop', reason: saved ? 'none' : 'cancelled' };
  if (now - (pending.createdAt || 0) > PENDING_TTL) return { kind: 'drop', reason: 'stale' };
  const p = planLock(pending.action, pending, labels, now);
  if (p.kind === 'onboard') { const r = resolveApps(pending.apps, labels); return r.matched.length ? { kind: 'run', labels: r.matched, stillMissing: p.missing } : { kind: 'drop', reason: 'not_picked', stillMissing: p.missing }; }
  return p;
};

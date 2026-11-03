// Per-session app selection (pure; mirrors ClingLockPlugin.swift). The tokens stay native in the App Group:
//  - "lock.selection"           : the global selection the shield applies;
//  - "lock.selection.lastUsed"  : the selection the previous session locked (set at each Begin: startLock({ sessionBegin: true })).
// A new session's picker (pickApps({ session: true })) starts from lastUsed, else the global selection, else empty.
export const LAST_USED_KEY = 'lock.selection.lastUsed';
export const SELECTION_KEY = 'lock.selection';
const count = (s) => (s ? (Number(s.apps) || 0) + (Number(s.categories) || 0) + (Number(s.sites) || 0) : 0);
export const pickerSeed = ({ lastUsed = null, global = null } = {}) => (lastUsed ? { from: 'lastUsed', selection: lastUsed } : global ? { from: 'global', selection: global } : { from: 'empty', selection: { apps: 0, categories: 0, sites: 0 } });
// What Begin records: the chosen selection becomes both the shield's and the new last-used one.
export const beginSelection = ({ chosen, lastUsed = null, global = null } = {}) => { const s = chosen || global || lastUsed || null; return { global: s, lastUsed: s }; };
// Counts reported to the server for the session record ({ apps, categories, sites }), or null when nothing is picked.
export const sessionApps = (r) => (r && count(r) > 0 ? { apps: Number(r.apps) || 0, categories: Number(r.categories) || 0, sites: Number(r.sites) || 0 } : null);
export const appsLabel = (r) => { if (!r || !count(r)) return 'No apps picked'; const p = [];
  if (r.apps) p.push(`${r.apps} app${r.apps === 1 ? '' : 's'}`); if (r.categories) p.push(`${r.categories} categor${r.categories === 1 ? 'y' : 'ies'}`); if (r.sites) p.push(`${r.sites} site${r.sites === 1 ? '' : 's'}`); return p.join(', '); };

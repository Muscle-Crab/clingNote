// Saved Screen Time names for the vault. A real name is whatever the user confirmed for that token.
// "App" and a blank are not names. A report row is never copied onto a token that has no saved name.
// An icon bitmap shared by every card is the offscreen Label snapshot (the prohibited placeholder), not an app icon.

export const isPlaceholderName = (label) => {
  const s = String(label || '').trim();
  return !s || /^app$/i.test(s);
};
export const savedName = (label) => (isPlaceholderName(label) ? '' : String(label).trim());

const byId = (list) => {
  const m = new Map();
  (list || []).forEach((a) => { if (a && a.id && savedName(a.label)) m.set(a.id, savedName(a.label)); });
  return m;
};

// catalog: lock-in selection rows. named: apps the user already confirmed. Real names win. Ids stay.
export const mergeVaultApps = (catalog, named) => {
  const names = byId(named);
  return (catalog || []).map((a) => {
    if (!a) return a;
    const own = savedName(a.label);
    const known = names.get(a.id) || '';
    const label = own || known || String(a.label || '').trim();
    return label === a.label ? a : { ...a, label };
  });
};

export const rememberNames = (storage, apps) => {
  let prev = {};
  try { prev = JSON.parse(storage.getItem(NAMES_KEY) || '{}') || {}; } catch (e) { prev = {}; }
  const next = { ...prev };
  (apps || []).forEach((a) => { const n = a && savedName(a.label); if (a && a.id && n) next[a.id] = n; });
  try { storage.setItem(NAMES_KEY, JSON.stringify(next)); } catch (e) { /* private mode */ }
  return next;
};

export const NAMES_KEY = 'cn.vault.names.v1';

export const applyRememberedNames = (storage, apps) => {
  let prev = {};
  try { prev = JSON.parse(storage.getItem(NAMES_KEY) || '{}') || {}; } catch (e) { prev = {}; }
  return (apps || []).map((a) => {
    if (!a || savedName(a.label) || !a.id || !savedName(prev[a.id])) return a;
    return { ...a, label: savedName(prev[a.id]) };
  });
};

// FamilyControls' offscreen Label draws one prohibited glyph for every token. Real icons differ.
export const dropSharedPlaceholderIcons = (apps) => {
  const icons = (apps || []).map((a) => a && a.icon).filter(Boolean);
  if (icons.length < 2 || !icons.every((i) => i === icons[0])) return apps || [];
  return (apps || []).map((a) => (a && a.icon ? { ...a, icon: '' } : a));
};

export const prepareVaultApps = (storage, catalog, named) => {
  const merged = applyRememberedNames(storage, mergeVaultApps(catalog, named));
  rememberNames(storage, merged);
  return dropSharedPlaceholderIcons(merged);
};

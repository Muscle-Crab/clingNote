// Maps a task to a display category (label + icon tile colour) for the task row.
const RULES = [
  { re: /shop|store|grocer|buy|market/i, icon: 'fa-shopping-cart', tone: 'blue' },
  { re: /work|report|publish|meeting|email|project|client|office/i, icon: 'fa-file-alt', tone: 'purple' },
  { re: /clean|house|home|laundry|dish|cook/i, icon: 'fa-home', tone: 'teal' },
  { re: /pay|rent|bill|bank|money|finance|tax/i, icon: 'fa-credit-card', tone: 'red' },
  { re: /plan|schedule|calendar|tomorrow/i, icon: 'fa-calendar-alt', tone: 'blue' },
  { re: /gym|workout|run|fitness|health|exercise|walk|yoga/i, icon: 'fa-dumbbell', tone: 'green' },
  { re: /read|study|learn|book|class|homework/i, icon: 'fa-book', tone: 'amber' },
];
const labelOf = (t) => {
  if (t.category) return String(t.category);
  const l = Array.isArray(t.labels) ? t.labels[0] : (typeof t.labels === 'string' ? t.labels.split(',')[0] : '');
  return (l || '').trim() || 'Personal';
};
export const categoryOf = (t = {}) => {
  const label = labelOf(t);
  const hay = `${label} ${t.title || ''}`;
  const r = RULES.find((x) => x.re.test(label)) || RULES.find((x) => x.re.test(hay));
  return { label: label.charAt(0).toUpperCase() + label.slice(1), icon: r ? r.icon : 'fa-check', tone: r ? r.tone : 'blue' };
};

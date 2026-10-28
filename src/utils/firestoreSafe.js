// Firestore rejects `undefined` anywhere in a write ("Unsupported field value: undefined"). Day-list tasks are built by
// spreading old docs + UI state, so strip undefined (deeply, through plain objects and arrays) before writing.
const plain = (v) => v && typeof v === 'object' && (Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null);
export const dropUndefined = (v) => {
  if (Array.isArray(v)) return v.filter((x) => x !== undefined).map(dropUndefined);
  if (!plain(v)) return v;
  const o = {};
  Object.keys(v).forEach((k) => { if (v[k] !== undefined) o[k] = dropUndefined(v[k]); });
  return o;
};

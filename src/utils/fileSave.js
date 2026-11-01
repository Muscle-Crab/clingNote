// Save a text file from the browser. Resolves 'downloaded' | 'shared' | 'cancelled' | 'failed'.
// Web: <a download>. iOS app (WKWebView, opts.native): <a download> does nothing there, so use the share sheet (Save to Files, AirDrop, Mail).
// opts.env lets tests inject { navigator, document, URL, File, Blob }.
const defaultEnv = () => ({
  navigator: typeof navigator !== 'undefined' ? navigator : undefined, document: typeof document !== 'undefined' ? document : undefined,
  URL: typeof URL !== 'undefined' ? URL : undefined, File: typeof File !== 'undefined' ? File : undefined, Blob: typeof Blob !== 'undefined' ? Blob : undefined,
});
export const saveTextFile = async (text, name, mime, opts = {}) => {
  const env = opts.env || defaultEnv();
  if (opts.native) {
    const nav = env.navigator;
    try {
      if (nav && nav.share && env.File) {
        const file = new env.File([text], name, { type: mime });
        if (!nav.canShare || nav.canShare({ files: [file] })) { await nav.share({ files: [file], title: name }); return 'shared'; }
      }
      return 'failed';
    } catch (e) { return e && e.name === 'AbortError' ? 'cancelled' : 'failed'; }
  }
  try {
    const blob = new env.Blob([text], { type: mime });
    const a = env.document.createElement('a');
    a.href = env.URL.createObjectURL(blob); a.download = name;
    env.document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => env.URL.revokeObjectURL(a.href), 5000);
    return 'downloaded';
  } catch (e) { return 'failed'; }
};

// Read a File picked by <input type="file">. Rejects files over maxBytes before reading.
export const readTextFile = (file, maxBytes = 2 * 1024 * 1024) => new Promise((resolve, reject) => {
  if (!file) { reject(new Error('No file chosen.')); return; }
  if (file.size > maxBytes) { reject(new Error('The file is too large (max 2 MB).')); return; }
  if (typeof file.text === 'function') { file.text().then(resolve, reject); return; }
  const r = new FileReader(); r.onload = () => resolve(String(r.result || '')); r.onerror = () => reject(r.error || new Error('Could not read the file.')); r.readAsText(file);
});

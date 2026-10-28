import { PROD_ORIGIN } from '@/config/api';
// Pal invite deep link: https://clingnot.netlify.app/pal/<CODE> → app route /pal/:code → /pals?code=CODE (prefill + confirm).
export const palLinkUrl = (code) => `${PROD_ORIGIN}/pal/${String(code || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase()}`;
// Accepts a raw 8-char code, /pal/<CODE>, or ?code=<CODE> URLs. Returns normalized code or ''.
export function parsePalCode(text) {
  const s = String(text || '').trim();
  let c = '';
  const m = s.match(/\/pal\/([A-Za-z0-9-]{8,12})/) || s.match(/[?&]code=([A-Za-z0-9-]{8,12})/);
  if (m) c = m[1]; else if (/^[A-Za-z0-9-]{8,12}$/.test(s)) c = s;
  c = c.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  return c.length >= 8 ? c : '';
}
export async function scanPalCode() {
  const { CapacitorBarcodeScanner, CapacitorBarcodeScannerTypeHint } = await import('@capacitor/barcode-scanner');
  const r = await CapacitorBarcodeScanner.scanBarcode({ hint: CapacitorBarcodeScannerTypeHint.QR_CODE, scanInstructions: 'Point at a ClingNote pal QR', scanButton: false });
  return parsePalCode(r && r.ScanResult);
}

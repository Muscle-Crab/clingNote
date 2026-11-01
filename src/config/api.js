// Base URL for the Netlify Functions. On the web the app and the functions share an origin, so the base is '' (relative URLs, unchanged).
// Inside the Capacitor shell the page origin is capacitor://localhost / clingnot://localhost, so relative URLs would hit the local bundle:
// native builds call the production site instead (CORS is handled by netlify/functions/lib/cors.js).
import { isNative } from '@/utils/platform';

export const PROD_ORIGIN = 'https://clingnot.netlify.app';
export const API_BASE = isNative() ? PROD_ORIGIN : '';
export const fnUrl = (name) => `${API_BASE}/.netlify/functions/${name}`;

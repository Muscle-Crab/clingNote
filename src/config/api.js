// Base URL for the Netlify Functions. Web release: the app and the functions share an origin, so relative URLs.
export const PROD_ORIGIN = 'https://clingnot.netlify.app';
export const API_BASE = '';
export const fnUrl = (name) => `${API_BASE}/.netlify/functions/${name}`;

// Apple In-App Purchase config (iOS native build only; the web build keeps Stripe).
// Product IDs are permanent in App Store Connect — they can never be reused once created. Decide before creating.
// Public SDK key is injected at build time: VUE_APP_REVENUECAT_IOS_KEY (RevenueCat "appl_..." public key; safe to ship in the binary).
export const RC_ENTITLEMENT = 'pro';
export const IAP_PRODUCTS = {
  monthly: 'clingnote_pro_monthly',
  yearly: 'clingnote_pro_yearly',
  lifetime: 'clingnote_pro_lifetime',
};
export const planIdForProduct = (productId) => Object.keys(IAP_PRODUCTS).find((k) => IAP_PRODUCTS[k] === productId) || null;
export const IAP_URLS = {
  terms: 'https://clingnot.netlify.app/terms',
  privacy: 'https://clingnote.netlify.app/privacy-policy',
  manage: 'https://apps.apple.com/account/subscriptions',
};

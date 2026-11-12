// RevenueCat's Capacitor plugin is inconsistent about the wrapper: purchase/getCustomerInfo
// resolve `{ customerInfo }`, the update listener resolves the CustomerInfo object itself.
// Anything without an entitlements map is ignored so a bad payload cannot clear a real Pro flag.
export const customerInfoOf = (payload) => {
  if (!payload || typeof payload !== 'object') return null;
  const inner = payload.customerInfo;
  if (inner && typeof inner === 'object' && inner.entitlements) return inner;
  if (payload.entitlements) return payload;
  return null;
};

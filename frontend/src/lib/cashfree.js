import { load } from '@cashfreepayments/cashfree-js';
import { api } from './api';

let _sdk = null;
let _modeP = null;

const fetchMode = async () => {
  if (_modeP) return _modeP;
  _modeP = api.req
    ? Promise.resolve(api.req('/payments/cashfree/config')).catch(() => ({ mode: 'sandbox', configured: false }))
    : fetch(`${process.env.REACT_APP_BACKEND_URL}/api/payments/cashfree/config`).then(r => r.json()).catch(() => ({ mode: 'sandbox', configured: false }));
  return _modeP;
};

export const getCashfreeConfig = () => fetchMode();

export const loadCashfree = async () => {
  if (_sdk) return _sdk;
  const cfg = await fetchMode();
  _sdk = await load({ mode: cfg.mode === 'production' ? 'production' : 'sandbox' });
  return _sdk;
};

/**
 * Open the Cashfree hosted checkout for a given payment_session_id.
 * Uses redirect target = "_self" so user comes back to /payments/return.
 */
export const openCashfreeCheckout = async (paymentSessionId) => {
  const sdk = await loadCashfree();
  return sdk.checkout({ paymentSessionId, redirectTarget: '_self' });
};

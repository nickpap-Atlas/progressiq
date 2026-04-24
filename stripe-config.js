// ============================================================
// Progress IQ — Stripe Integration Scaffold
// Connect when Stripe account is ready:
//   1. Replace the pk_live_REPLACE_ME key
//   2. Replace the price IDs from your Stripe dashboard
//   3. Build the server-side checkout session endpoint
//      (or use Stripe Payment Links for zero-backend setup)
// ============================================================

var STRIPE_PUBLISHABLE_KEY = 'pk_live_REPLACE_ME';
var STRIPE_PRICE_MONTHLY   = 'price_REPLACE_ME_MONTHLY';   // $9.99/month
var STRIPE_PRICE_YEARLY    = 'price_REPLACE_ME_YEARLY';    // $79/year

/**
 * Redirect to Stripe Checkout for a given price.
 * Requires a backend endpoint that creates a checkout session and
 * returns { url } — or swap for a Stripe Payment Link directly.
 *
 * @param {string} priceId - Stripe price ID (monthly or yearly)
 * @param {string} userId  - Supabase user UUID (passed as client_reference_id)
 */
async function redirectToStripeCheckout(priceId, userId) {
  if (STRIPE_PUBLISHABLE_KEY === 'pk_live_REPLACE_ME') {
    console.warn('[stripe] Stripe not yet configured — add keys to activate');
    // Fallback: open email contact
    window.location.href = 'mailto:nick@progressiq.app?subject=Progress IQ Pro Upgrade&body=Hi, I\'d like to upgrade to Pro. My user ID is: ' + (userId || 'unknown');
    return;
  }

  try {
    // Option A: Backend endpoint (recommended for webhooks + fulfilment)
    var res = await fetch('/api/create-checkout-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        priceId: priceId,
        userId: userId,
        successUrl: window.location.origin + window.location.pathname + '?upgrade=success',
        cancelUrl: window.location.href
      })
    });
    var data = await res.json();
    if (data && data.url) {
      window.location.href = data.url;
    } else {
      console.error('[stripe] No URL in checkout response', data);
      alert('Could not start checkout. Please contact nick@progressiq.app.');
    }
  } catch (e) {
    console.error('[stripe] redirectToStripeCheckout error:', e);
    alert('Could not start checkout. Please contact nick@progressiq.app.');
  }
}

/**
 * Handle successful return from Stripe (?upgrade=success in URL).
 * Refreshes profile tier from Supabase (Stripe webhook should have updated it).
 */
async function handleStripeSuccess() {
  var params = new URLSearchParams(window.location.search);
  if (params.get('upgrade') !== 'success') return;

  // Clean URL
  var clean = window.location.pathname;
  window.history.replaceState({}, '', clean);

  // Re-fetch profile to pick up new tier (set by webhook)
  if (typeof sb !== 'undefined' && typeof USER !== 'undefined' && USER) {
    var res = await sb.from('profiles').select('tier, subscription_status, stripe_customer_id').eq('id', USER.id).single();
    if (res.data) {
      Object.assign(window.PROFILE || {}, res.data);
      if (typeof initTierBanner === 'function') initTierBanner();
    }
  }

  setTimeout(function () {
    alert('🎉 Welcome to Progress IQ Pro! Your account has been upgraded.');
  }, 500);
}

// ============================================================
// Progress IQ — Tier Logic
// Depends on: sb (Supabase client), USER (auth user) — both
// are globals set in app.html before this module loads.
// ============================================================

var TRIAL_DAYS = 30;

/**
 * Fetch tier info for a user from Supabase.
 * Returns the profiles row subset: { tier, trial_start_date, subscription_status }
 * Falls back to { tier: 'trial', trial_start_date: null } on error.
 */
async function fetchUserTierData(userId) {
  try {
    var res = await sb
      .from('profiles')
      .select('tier, trial_start_date, subscription_status, stripe_customer_id, stripe_subscription_id')
      .eq('id', userId)
      .single();
    if (res.error || !res.data) {
      console.warn('[tier] fetchUserTierData error:', res.error);
      return { tier: 'trial', trial_start_date: null, subscription_status: 'active' };
    }
    return res.data;
  } catch (e) {
    console.warn('[tier] fetchUserTierData exception:', e);
    return { tier: 'trial', trial_start_date: null, subscription_status: 'active' };
  }
}

/**
 * Get the tier string for a user.
 * Returns 'trial' | 'free' | 'pro'
 */
async function getUserTier(userId) {
  var data = await fetchUserTierData(userId);
  return data.tier || 'trial';
}

/**
 * Returns true if the trial start date is more than TRIAL_DAYS ago.
 * @param {string|Date|null} trialStartDate
 */
function isTrialExpired(trialStartDate) {
  if (!trialStartDate) return false; // no start date = treat as not expired
  var start = new Date(trialStartDate);
  if (isNaN(start.getTime())) return false;
  var now = new Date();
  var diffMs = now - start;
  var diffDays = diffMs / (1000 * 60 * 60 * 24);
  return diffDays > TRIAL_DAYS;
}

/**
 * Returns true if the user has full Pro access.
 * Pro access = tier is 'pro', OR tier is 'trial' and not yet expired.
 * @param {string} tier - 'trial' | 'free' | 'pro'
 * @param {string|Date|null} trialStartDate
 */
function hasProAccess(tier, trialStartDate) {
  if (tier === 'pro') return true;
  if (tier === 'trial' && !isTrialExpired(trialStartDate)) return true;
  return false;
}

/**
 * Returns the number of days remaining in the trial (0 if expired/not trial).
 * @param {string|Date|null} trialStartDate
 * @returns {number}
 */
function getDaysRemaining(trialStartDate) {
  if (!trialStartDate) return TRIAL_DAYS; // assume full trial if no date
  var start = new Date(trialStartDate);
  if (isNaN(start.getTime())) return 0;
  var now = new Date();
  var diffMs = now - start;
  var diffDays = diffMs / (1000 * 60 * 60 * 24);
  var remaining = Math.ceil(TRIAL_DAYS - diffDays);
  return Math.max(0, remaining);
}

/**
 * Set trial defaults on a new signup.
 * Call this after creating a profile row if the trigger hasn't fired.
 * @param {string} userId
 */
async function initTrialForNewUser(userId) {
  try {
    var res = await sb.from('profiles').upsert({
      id: userId,
      tier: 'trial',
      trial_start_date: new Date().toISOString(),
      subscription_status: 'active'
    }, { onConflict: 'id', ignoreDuplicates: false });
    if (res.error) console.warn('[tier] initTrialForNewUser error:', res.error);
  } catch (e) {
    console.warn('[tier] initTrialForNewUser exception:', e);
  }
}

// ── Trial banner rendering ────────────────────────────────────────────────

/**
 * Initialise and render the trial banner after PROFILE is loaded.
 * Call this from loadAll() after PROFILE and USER are set.
 */
function initTierBanner() {
  var banner = document.getElementById('trial-banner');
  if (!banner) return;

  var tier = (window.PROFILE && window.PROFILE.tier) || 'trial';
  var trialStart = (window.PROFILE && window.PROFILE.trial_start_date) || null;

  if (tier === 'pro') {
    // No banner for pro users
    banner.style.display = 'none';
    return;
  }

  if (tier === 'trial' && !isTrialExpired(trialStart)) {
    var days = getDaysRemaining(trialStart);
    var msg = days <= 0
      ? '⚡ Pro Trial — Last day · <a href="#" onclick="openUpgradeModal(\'Trial Expiring\');return false;" style="color:var(--accent);font-weight:600">Upgrade</a>'
      : '⚡ Pro Trial — <strong>' + days + ' day' + (days !== 1 ? 's' : '') + '</strong> remaining · <a href="#" onclick="openUpgradeModal(\'Pro Trial\');return false;" style="color:var(--accent);font-weight:600">Upgrade</a>';
    document.getElementById('trial-banner-text').innerHTML = msg;
    banner.style.display = 'flex';
    // Update paywall modal with days remaining
    updatePaywallTrialDays(days);
    return;
  }

  if (tier === 'free' || (tier === 'trial' && isTrialExpired(trialStart))) {
    document.getElementById('trial-banner-text').innerHTML =
      '🔒 Trial ended — <a href="#" onclick="openUpgradeModal(\'Upgrade\');return false;" style="color:var(--accent);font-weight:600">Upgrade to Pro</a> to restore access';
    banner.className = 'trial-banner trial-banner-expired';
    banner.style.display = 'flex';
    updatePaywallTrialDays(0);
    return;
  }

  banner.style.display = 'none';
}

/**
 * Update the paywall modal's trial days remaining label.
 */
function updatePaywallTrialDays(days) {
  var el = document.getElementById('paywall-days-remaining');
  if (!el) return;
  if (days > 0) {
    el.textContent = days + ' day' + (days !== 1 ? 's' : '') + ' left in your trial';
    el.style.display = 'block';
  } else {
    el.textContent = 'Your trial has ended';
    el.style.display = 'block';
  }
}

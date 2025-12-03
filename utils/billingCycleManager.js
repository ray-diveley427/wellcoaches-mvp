// =====================================================================
// Billing Cycle Manager
// =====================================================================
// Handles user-specific billing cycles instead of calendar months
// Each user's billing cycle starts when they subscribe and resets monthly

/**
 * Get user's current billing cycle period
 * Returns the start and end dates of their current billing cycle
 *
 * @param {string} billingCycleStartDate - ISO date string when user's billing cycle started (e.g., "2025-01-15")
 * @returns {Object} { periodStart: Date, periodEnd: Date, periodKey: string }
 */
export function getCurrentBillingPeriod(billingCycleStartDate) {
  if (!billingCycleStartDate) {
    // If no billing cycle start date, default to current calendar month
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    return {
      periodStart: new Date(year, month, 1),
      periodEnd: new Date(year, month + 1, 0, 23, 59, 59, 999),
      periodKey: `${year}-${String(month + 1).padStart(2, '0')}`,
      isCalendarMonth: true
    };
  }

  const cycleStart = new Date(billingCycleStartDate);
  const dayOfMonth = cycleStart.getDate();
  const now = new Date();

  // Calculate which billing period we're currently in
  // Example: If cycle starts on 15th, periods are 15th-14th of next month
  let periodStart = new Date(now.getFullYear(), now.getMonth(), dayOfMonth);

  // If we haven't reached this month's cycle day yet, we're still in last month's cycle
  if (now.getDate() < dayOfMonth) {
    periodStart.setMonth(periodStart.getMonth() - 1);
  }

  // Period end is one day before next cycle starts
  const periodEnd = new Date(periodStart);
  periodEnd.setMonth(periodEnd.getMonth() + 1);
  periodEnd.setDate(periodEnd.getDate() - 1);
  periodEnd.setHours(23, 59, 59, 999);

  // Create a unique key for this billing period
  // Format: YYYY-MM-DD (the start date of this specific period)
  const periodKey = periodStart.toISOString().split('T')[0];

  return {
    periodStart,
    periodEnd,
    periodKey,
    isCalendarMonth: false
  };
}

/**
 * Calculate days remaining in current billing cycle
 *
 * @param {string} billingCycleStartDate - ISO date string
 * @returns {number} Days remaining (0-30)
 */
export function getDaysRemainingInCycle(billingCycleStartDate) {
  const { periodEnd } = getCurrentBillingPeriod(billingCycleStartDate);
  const now = new Date();
  const diffMs = periodEnd.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
}

/**
 * Check if we need to reset monthly costs for a user
 * Returns true if their billing cycle has rolled over since last check
 *
 * @param {string} billingCycleStartDate - ISO date string
 * @param {string} lastCostUpdate - ISO timestamp of last cost update
 * @returns {boolean}
 */
export function shouldResetMonthlyCosts(billingCycleStartDate, lastCostUpdate) {
  if (!lastCostUpdate) {
    return false; // Never reset if we don't know when last updated
  }

  const lastUpdate = new Date(lastCostUpdate);
  const { periodStart } = getCurrentBillingPeriod(billingCycleStartDate);

  // If last update was before current period started, we should reset
  return lastUpdate < periodStart;
}

/**
 * Initialize billing cycle start date for a new subscriber
 * Sets it to today's date
 *
 * @returns {string} ISO date string (YYYY-MM-DD)
 */
export function initializeBillingCycle() {
  const now = new Date();
  return now.toISOString().split('T')[0];
}

/**
 * Calculate pro-rated limit for partial month
 * Used when user subscribes mid-cycle or changes tiers
 *
 * @param {number} fullMonthLimit - The normal monthly limit
 * @param {string} billingCycleStartDate - When their cycle started
 * @returns {number} Pro-rated limit for remaining days
 */
export function calculateProRatedLimit(fullMonthLimit, billingCycleStartDate) {
  const { periodStart, periodEnd } = getCurrentBillingPeriod(billingCycleStartDate);
  const now = new Date();

  // Total days in this billing period
  const totalDays = Math.ceil((periodEnd - periodStart) / (1000 * 60 * 60 * 24)) + 1;

  // Days elapsed in this billing period
  const daysElapsed = Math.ceil((now - periodStart) / (1000 * 60 * 60 * 24));

  // Days remaining
  const daysRemaining = totalDays - daysElapsed;

  // Pro-rate the limit based on days remaining
  const proRatedLimit = (fullMonthLimit / totalDays) * daysRemaining;

  return Math.max(0, proRatedLimit);
}

/**
 * Get a human-readable description of the billing cycle
 *
 * @param {string} billingCycleStartDate - ISO date string
 * @returns {string} e.g., "January 15 - February 14"
 */
export function getBillingCycleDescription(billingCycleStartDate) {
  const { periodStart, periodEnd, isCalendarMonth } = getCurrentBillingPeriod(billingCycleStartDate);

  if (isCalendarMonth) {
    const monthName = periodStart.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    return monthName;
  }

  const startStr = periodStart.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
  const endStr = periodEnd.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });

  return `${startStr} - ${endStr}`;
}

/**
 * Get the next billing cycle reset date
 *
 * @param {string} billingCycleStartDate - ISO date string
 * @returns {Date} When the next billing cycle starts
 */
export function getNextBillingCycleDate(billingCycleStartDate) {
  const { periodEnd } = getCurrentBillingPeriod(billingCycleStartDate);
  const nextCycle = new Date(periodEnd);
  nextCycle.setDate(nextCycle.getDate() + 1);
  nextCycle.setHours(0, 0, 0, 0);
  return nextCycle;
}

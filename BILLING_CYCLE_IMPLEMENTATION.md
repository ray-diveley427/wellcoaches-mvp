# Billing Cycle Implementation

## Overview

The Multi-Perspective AI application now tracks user costs based on **individual billing cycles** rather than calendar months. This ensures fair billing where each user's monthly limit resets 30 days after they subscribe, not on the 1st of each month.

## The Problem We Solved

**Before:** Users were billed by calendar month
- User subscribes on January 15th
- Calendar month tracking: Jan 1-31, Feb 1-28, etc.
- Problem: User gets only 16 days of usage in January but pays for a full month
- Their limit resets on Feb 1st instead of Feb 15th

**After:** Users are billed by personal billing cycles
- User subscribes on January 15th
- Personal billing cycle: Jan 15 - Feb 14, Feb 15 - Mar 14, etc.
- User gets full 30-day periods consistently
- Their limit resets on the 15th of each month

## How It Works

### 1. Billing Cycle Start Date

When a user first subscribes or upgrades to a paid tier, we store:
- `billing_cycle_start_date`: The day of the month their cycle starts (e.g., "2025-01-15")
- `current_period_start`: ISO timestamp of when current billing period started
- `current_period_end`: ISO timestamp of when current billing period ends

### 2. Cost Tracking

Monthly costs are now tracked using billing period keys instead of calendar months:
- **Old key format:** `MONTHLY_COST#2025-01` (calendar month)
- **New key format:** `MONTHLY_COST#2025-01-15` (billing period start date)

This allows multiple billing periods to coexist in the database.

### 3. Automatic Period Calculation

The `billingCycleManager.js` module automatically calculates:
- Which billing period we're currently in
- When the next billing period starts
- How many days remaining in current period
- Pro-rated limits for mid-cycle changes

## Files Modified

### New Files Created

1. **`utils/billingCycleManager.js`**
   - Core billing cycle logic
   - Functions:
     - `getCurrentBillingPeriod(billingCycleStartDate)` - Get current period dates
     - `getDaysRemainingInCycle(billingCycleStartDate)` - Days until reset
     - `initializeBillingCycle()` - Set up new billing cycle
     - `getBillingCycleDescription(billingCycleStartDate)` - Human-readable description
     - `calculateProRatedLimit()` - For mid-cycle tier changes
     - `shouldResetMonthlyCosts()` - Check if period rolled over

### Modified Files

2. **`routes/analyze.js`**
   - Added import: `import { getCurrentBillingPeriod } from '../utils/billingCycleManager.js'`
   - New function: `getUserBillingPeriodKey(userId)` - Gets user-specific period key
   - Updated `getUserMonthlyCost()` - Now uses billing period key instead of calendar month
   - Updated `incrementUserMonthlyCost()` - Stores costs under billing period key

3. **`utils/userManager.js`**
   - Added import: `import { initializeBillingCycle, getCurrentBillingPeriod } from './billingCycleManager.js'`
   - Updated `createUser()` - Initializes billing cycle for new users
   - Updated `updateSubscription()` - Initializes billing cycle when upgrading from free to paid

4. **`scripts/createUsersTable.js`**
   - Updated schema documentation to include new billing cycle fields

## Database Schema Changes

New fields added to user records:

```javascript
{
  // Existing fields...
  email: "user@example.com",
  subscription_tier: "member",

  // NEW: Billing cycle fields
  billing_cycle_start_date: "2025-01-15",  // YYYY-MM-DD
  current_period_start: "2025-01-15T00:00:00.000Z",  // ISO timestamp
  current_period_end: "2025-02-14T23:59:59.999Z",    // ISO timestamp

  // Modified: Cost tracking
  monthly_cost: 3.50,
  last_cost_update: "2025-01-20T14:30:00.000Z"  // NEW: Track when costs last updated
}
```

**Separate DynamoDB records for monthly costs:**

```javascript
// Key structure
PK: "USER#user-123"
SK: "MONTHLY_COST#2025-01-15"  // Billing period start date

// Item data
{
  cost: 3.50,
  period: "2025-01-15",
  updated_at: "2025-01-20T14:30:00.000Z"
}
```

## Usage Examples

### Example 1: User subscribes mid-month

```javascript
// User subscribes on January 15th
const user = await createUser({
  user_id: "user-123",
  email: "john@example.com",
  given_name: "John"
});

// Billing cycle fields are automatically set:
// billing_cycle_start_date: "2025-01-15"
// current_period_start: "2025-01-15T00:00:00.000Z"
// current_period_end: "2025-02-14T23:59:59.999Z"

// Their billing periods:
// Period 1: Jan 15 - Feb 14
// Period 2: Feb 15 - Mar 14
// Period 3: Mar 15 - Apr 14
// etc.
```

### Example 2: Cost tracking during billing period

```javascript
// January 20th - User makes an API call costing $0.50
await incrementUserMonthlyCost("user-123", 0.50);

// This stores cost under key: MONTHLY_COST#2025-01-15
// Current monthly cost: $0.50

// February 10th - User makes another call costing $1.00
await incrementUserMonthlyCost("user-123", 1.00);

// Still in same billing period (Jan 15 - Feb 14)
// Current monthly cost: $1.50

// February 16th - User makes a call costing $0.75
await incrementUserMonthlyCost("user-123", 0.75);

// Now in NEW billing period (Feb 15 - Mar 14)
// This stores under key: MONTHLY_COST#2025-02-15
// Current monthly cost for new period: $0.75
// Previous period (Jan 15 - Feb 14) remains at $1.50
```

### Example 3: Upgrading from free to paid

```javascript
// User upgrades from free tier to member tier
await updateSubscription("user-123", {
  tier: "member",
  initializeBillingCycleOnUpgrade: true  // Important!
});

// This automatically:
// 1. Sets billing_cycle_start_date to today's date
// 2. Calculates current_period_start and current_period_end
// 3. Future monthly costs will be tracked from this date
```

## Migration Notes

### For Existing Users

Users who subscribed before this implementation will need their billing cycles initialized. Options:

1. **Set to subscription start date** (if known from Keap)
2. **Set to current date** (start fresh billing cycle today)
3. **Set to 1st of month** (maintain calendar month billing for existing users)

Recommended approach:
```javascript
// For each existing user without a billing_cycle_start_date
if (!user.billing_cycle_start_date) {
  // Option 1: Use their subscription start from Keap
  const subscriptionStart = await getKeapSubscriptionStartDate(user.email);

  // Option 2: Or start fresh from today
  const billingCycleStartDate = initializeBillingCycle();

  await updateUserBillingCycle(user.user_id, billingCycleStartDate);
}
```

### Backward Compatibility

The system maintains backward compatibility:
- If no `billing_cycle_start_date` exists, falls back to calendar month
- Old monthly cost records (MONTHLY_COST#2025-01) still accessible
- `getCurrentMonth()` function still available but marked DEPRECATED

## Testing Checklist

- [ ] New user creation sets billing cycle correctly
- [ ] Cost tracking uses billing period key, not calendar month
- [ ] Costs reset on user's cycle anniversary, not month start
- [ ] Upgrading from free to paid initializes billing cycle
- [ ] Users without billing_cycle_start_date fall back to calendar month
- [ ] Admin dashboard shows billing cycle dates
- [ ] Usage limit emails mention correct reset date

## Future Enhancements

1. **Pro-rating for tier changes**: When users upgrade/downgrade mid-cycle, calculate pro-rated limits
2. **Billing cycle reset automation**: Background job to reset monthly costs on each user's anniversary
3. **Annual billing option**: Support yearly billing cycles (365 days instead of 30)
4. **Grace periods**: Allow small overages with grace period before blocking
5. **Billing calendar view**: Show users their billing history across multiple cycles

## Questions?

- Why 30 days instead of calendar month? Fair billing - every user gets the same number of days per billing period
- What if user subscribes on 31st? Their cycle day is 31, so periods end on last day of months without a 31st
- Can we change a user's billing cycle day? Yes, but requires manual database update and consideration of current costs
- Do free users need billing cycles? No, but we set it anyway for consistency when they upgrade

## Summary

Billing cycle implementation ensures:
✅ Fair billing - users get full 30-day periods
✅ Predictable costs - users know when their limit resets
✅ Accurate tracking - costs are isolated to correct billing periods
✅ Flexibility - supports mid-month subscriptions
✅ Scalability - works for users joining anytime

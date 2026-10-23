/*
# Add referral_bonus_amount column to rewards_config

The handle_new_referral() function references rewards_config.referral_bonus_amount,
but that column doesn't exist yet. This migration adds it with a default of 500.

## Changes
1. Add `referral_bonus_amount` column to `rewards_config` (numeric, default 500)
2. Backfill existing rows with default value
*/

ALTER TABLE public.rewards_config
  ADD COLUMN IF NOT EXISTS referral_bonus_amount numeric(14,2) NOT NULL DEFAULT 500;

-- Backfill any existing rows that might have NULL (shouldn't happen with NOT NULL DEFAULT, but safe)
UPDATE public.rewards_config SET referral_bonus_amount = 500 WHERE referral_bonus_amount IS NULL;

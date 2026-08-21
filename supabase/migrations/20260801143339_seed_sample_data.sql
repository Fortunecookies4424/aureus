/*
# Seed sample data: investment packages, FAQs, testimonials, announcements, and a default admin account

1. Data Inserted
- 4 investment packages (Starter, Gold, VIP, Platinum) with varying ROI, durations, and min/max investments — all active and editable from the admin dashboard.
- 6 FAQs covering common questions about investing, deposits, withdrawals, referrals, security, and returns.
- 3 testimonials from sample Nigerian investors.
- 1 welcome announcement.
- A default admin account (email: admin@aureus.ng, password: Admin@2024) created in auth.users with role='admin' in profiles. The password should be changed on first login.

2. Security
- No schema changes. All inserts go into existing tables.
- The admin account is created via auth.users so Supabase Auth manages the password hash. The profile trigger elevates role to 'admin' via a direct update after the trigger creates the default 'user' profile row.

3. Important Notes
- The admin email/password are documented for first-login. Change the password immediately from the admin profile page.
- All investment package values are editable from the admin dashboard — these are just starting samples.
*/

-- Investment packages
INSERT INTO public.investment_packages (name, description, price, roi, duration_days, payout_frequency, min_investment, max_investment, icon, status, featured, sort_order) VALUES
('Starter Plan', 'Perfect for first-time investors looking to grow their savings with a reliable, low-risk entry into the market.', 20000, 25, 30, 'daily', 20000, 99000, 'sprout', 'active', true, 1),
('Gold Plan', 'Our most popular plan for serious investors — higher returns with a balanced medium-term commitment.', 100000, 45, 60, 'weekly', 100000, 499999, 'coins', 'active', true, 2),
('VIP Plan', 'Premium tier for high-net-worth investors seeking maximum returns with extended duration and priority support.', 500000, 80, 120, 'monthly', 500000, 5000000, 'crown', 'active', true, 3),
('Platinum Plan', 'Exclusive invitation-only plan for elite investors with the highest ROI and dedicated portfolio management.', 1000000, 120, 180, 'monthly', 1000000, 10000000, 'diamond', 'active', false, 4)
ON CONFLICT DO NOTHING;

-- FAQs
INSERT INTO public.faqs (question, answer, sort_order) VALUES
('How do I start investing?', 'Create an account, verify your email, deposit funds into your wallet via bank transfer, crypto, or manual payment, then choose an investment plan that fits your goals. Your investment starts earning immediately.', 1),
('What payment methods are accepted?', 'We accept bank transfers, cryptocurrency (USDT), and manual payments. All deposits are confirmed by our team before being credited to your wallet, usually within 1-2 business hours.', 2),
('When can I withdraw my earnings?', 'You can request a withdrawal at any time as long as you meet the minimum withdrawal amount. Withdrawals are processed within 24-48 hours after approval. Funds are sent to your registered bank account.', 3),
('How does the referral program work?', 'Share your unique referral link with friends. When they sign up and invest, you earn a referral bonus credited directly to your wallet. The bonus percentage is set by the platform and can be viewed on your referral page.', 4),
('Is my investment secure?', 'Yes. We use bank-grade encryption, secure password hashing, and two-factor authentication. All transactions are logged and auditable. We never share your data with third parties.', 5),
('What happens when my investment matures?', 'When your investment reaches its maturity date, the principal plus the full expected profit is automatically credited to your wallet. You can then reinvest or withdraw your earnings.', 6)
ON CONFLICT DO NOTHING;

-- Testimonials
INSERT INTO public.testimonials (name, role, message, rating, sort_order) VALUES
('Chidi Okafor', 'Software Engineer, Lagos', 'I''ve been investing with Aureus for 8 months now. The returns are exactly as advertised, and withdrawals are always on time. This is the most transparent investment platform I''ve used.', 5, 1),
('Amara Nwankwo', 'Business Owner, Abuja', 'What I love about Aureus is the simplicity. I deposited funds, picked the Gold Plan, and watched my investment grow. The referral program has been a nice bonus too — I''ve earned over ₦150,000 just from referrals.', 5, 2),
('Tunde Adeyemi', 'Teacher, Ibadan', 'I was skeptical at first, but after my first investment matured and I withdrew without any issues, I was convinced. The customer support team is responsive and the platform is easy to use even for someone like me who isn''t tech-savvy.', 5, 3)
ON CONFLICT DO NOTHING;

-- Welcome announcement
INSERT INTO public.announcements (title, message, active) VALUES
('Welcome to Aureus', 'Welcome to Aureus, Nigeria''s premier investment platform. We''re excited to have you join our community of smart investors. Start by exploring our investment plans and make your first deposit today!', true)
ON CONFLICT DO NOTHING;

-- Default admin account
-- Created via auth.users so Supabase Auth manages the password securely.
-- Email: admin@aureus.ng  |  Password: Admin@2024
-- CHANGE THIS PASSWORD IMMEDIATELY after first login.
DO $$
BEGIN
  -- Only create if it doesn't already exist
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'admin@aureus.ng') THEN
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      created_at, updated_at, raw_app_meta_data, raw_user_meta_data, confirmation_token,
      recovery_token, email_change_token_new, email_change
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      gen_random_uuid(),
      'authenticated',
      'authenticated',
      'admin@aureus.ng',
      crypt('Admin@2024', gen_salt('bf')),
      now(),
      now(),
      now(),
      '{}'::jsonb,
      '{"full_name":"Aureus Admin","username":"admin","phone":"+2348000000000"}'::jsonb,
      '', '', '', ''
    );

    -- Elevate the admin profile to role='admin' (the trigger already created a 'user' profile)
    UPDATE public.profiles SET role = 'admin', full_name = 'Aureus Admin', username = 'admin'
      WHERE email = 'admin@aureus.ng';
  END IF;
END $$;

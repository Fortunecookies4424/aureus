export type UserRole = 'user' | 'admin';
export type UserStatus = 'active' | 'suspended';

export type PayoutFrequency = 'daily' | 'weekly' | 'monthly';

export type InvestmentStatus = 'active' | 'completed' | 'cancelled';
export type DepositStatus = 'pending' | 'approved' | 'rejected';
export type WithdrawalStatus = 'pending' | 'approved' | 'rejected' | 'paid';
export type TxnType = 'deposit' | 'withdrawal' | 'investment' | 'profit' | 'referral' | 'bonus' | 'fee' | 'checkin' | 'welcome_bonus';
export type TxnStatus = 'pending' | 'completed' | 'failed';

export type NotificationType =
  | 'deposit'
  | 'withdrawal'
  | 'investment'
  | 'referral'
  | 'announcement'
  | 'system';

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  username: string;
  phone: string | null;
  avatar_url: string | null;
  role: UserRole;
  status: UserStatus;
  referral_code: string;
  referred_by: string | null;
  bank_name: string | null;
  bank_account_name: string | null;
  bank_account_number: string | null;
  created_at: string;
}

export interface InvestmentPackage {
  id: string;
  name: string;
  description: string;
  price: number;
  roi: number;
  duration_days: number;
  payout_frequency: PayoutFrequency;
  min_investment: number;
  max_investment: number;
  image_url: string | null;
  icon: string | null;
  status: 'active' | 'inactive';
  featured: boolean;
  sort_order: number;
  created_at: string;
}

export interface Investment {
  id: string;
  user_id: string;
  package_id: string;
  package_name: string;
  amount: number;
  roi: number;
  duration_days: number;
  payout_frequency: PayoutFrequency;
  expected_profit: number;
  total_return: number;
  start_date: string;
  maturity_date: string;
  status: InvestmentStatus;
  created_at: string;
  package?: InvestmentPackage;
  user?: Profile;
}

export interface Deposit {
  id: string;
  user_id: string;
  amount: number;
  method: 'bank_transfer' | 'crypto_usdt' | 'manual';
  status: DepositStatus;
  proof_url: string | null;
  reference: string;
  admin_note: string | null;
  created_at: string;
  processed_at: string | null;
  user?: Profile;
}

export interface Withdrawal {
  id: string;
  user_id: string;
  amount: number;
  fee_amount: number;
  status: WithdrawalStatus;
  bank_name: string;
  bank_account_name: string;
  bank_account_number: string;
  admin_note: string | null;
  created_at: string;
  processed_at: string | null;
  user?: Profile;
}

export interface Transaction {
  id: string;
  user_id: string;
  type: TxnType;
  amount: number;
  status: TxnStatus;
  description: string;
  reference: string;
  created_at: string;
  user?: Profile;
}

export interface Wallet {
  id: string;
  user_id: string;
  balance: number;
  bonus_balance: number;
  total_deposits: number;
  total_withdrawals: number;
  total_profit: number;
  referral_earnings: number;
  created_at: string;
}

export interface Referral {
  id: string;
  referrer_id: string;
  referred_id: string;
  bonus_amount: number;
  status: 'pending' | 'paid';
  created_at: string;
  referred?: Profile;
}

export interface Notification {
  id: string;
  user_id: string | null;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  created_at: string;
}

export type CouponStatus = 'active' | 'disabled' | 'expired' | 'fully_redeemed';

export interface Coupon {
  id: string;
  code: string;
  value: number;
  max_redemptions: number;
  redeemed_count: number;
  expires_at: string | null;
  status: 'active' | 'disabled';
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CouponRedemption {
  id: string;
  coupon_id: string;
  user_id: string;
  amount: number;
  redeemed_at: string;
}

export interface WebsiteSettings {
  id: string;
  company_name: string;
  logo_url: string | null;
  email: string;
  phone: string;
  address: string;
  currency: string;
  referral_percentage: number;
  min_withdrawal: number;
  max_withdrawal: number;
  maintenance_mode: boolean;
  hero_title: string;
  hero_subtitle: string;
  hero_stat1_label: string;
  hero_stat1_value: string;
  hero_stat2_label: string;
  hero_stat2_value: string;
  hero_stat3_label: string;
  hero_stat3_value: string;
  about_text: string;
  contact_email: string;
  contact_phone: string;
  contact_address: string;
  facebook_url: string;
  twitter_url: string;
  instagram_url: string;
  linkedin_url: string;
  telegram_url: string;
  whatsapp_url: string;
  terms_text: string;
  privacy_text: string;
  created_at: string;
}

export interface Faq {
  id: string;
  question: string;
  answer: string;
  sort_order: number;
  created_at: string;
}

export interface Announcement {
  id: string;
  title: string;
  message: string;
  active: boolean;
  created_at: string;
}

export interface Testimonial {
  id: string;
  name: string;
  role: string;
  message: string;
  avatar_url: string | null;
  rating: number;
  sort_order: number;
}

export interface BalanceAuditLog {
  id: string;
  reference_id: string;
  user_id: string;
  user_name: string;
  user_phone: string | null;
  admin_id: string;
  admin_name: string;
  previous_balance: number;
  new_balance: number;
  amount_changed: number;
  adjustment_type: 'credit' | 'debit';
  reason: string;
  created_at: string;
}

export interface RewardsConfig {
  id: string;
  welcome_bonus_enabled: boolean;
  welcome_bonus_amount: number;
  welcome_bonus_expiry_days: number | null;
  daily_checkin_enabled: boolean;
  daily_checkin_amount: number;
  daily_checkin_reset_time: string;
  daily_checkin_max_streak: number | null;
  referral_bonus_amount: number;
  updated_at: string;
}

export interface DailyCheckin {
  id: string;
  user_id: string;
  amount: number;
  streak: number;
  checkin_date: string;
  created_at: string;
}

export interface WithdrawalFeeConfig {
  id: string;
  enabled: boolean;
  fee_type: 'fixed' | 'percentage';
  fee_value: number;
  min_fee: number;
  max_fee: number | null;
  updated_at: string;
}

export interface PaymentGateway {
  id: string;
  name: string;
  slug: string;
  enabled: boolean;
  public_key: string;
  secret_key: string;
  merchant_id: string;
  webhook_secret: string;
  environment: 'sandbox' | 'production';
  supported_methods: string[];
  is_default: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface ImpersonationLog {
  id: string;
  admin_id: string;
  admin_name: string;
  user_id: string;
  user_name: string;
  start_time: string;
  end_time: string | null;
  ip_address: string | null;
  status: 'active' | 'ended';
}

export interface PasswordResetLog {
  id: string;
  admin_id: string;
  admin_name: string;
  user_id: string;
  user_name: string;
  created_at: string;
}

export interface AdminActivityLog {
  id: string;
  admin_id: string;
  admin_name: string;
  action: string;
  target_user_id: string | null;
  target_user_name: string | null;
  details: string | null;
  created_at: string;
}

export interface InvestmentEarning {
  id: string;
  investment_id: string;
  user_id: string;
  earning_date: string;
  amount: number;
  created_at: string;
}

export interface PromotionalBanner {
  id: string;
  title: string;
  description: string;
  image_url: string;
  link_url: string;
  enabled: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserPreferences {
  id: string;
  user_id: string;
  notif_deposit: boolean;
  notif_withdrawal: boolean;
  notif_investment: boolean;
  notif_referral: boolean;
  notif_announcement: boolean;
  login_alerts: boolean;
  welcome_toast_dismissed: boolean;
  updated_at: string;
}

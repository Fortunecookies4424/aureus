import { motion } from 'framer-motion';
import { useState } from 'react';
import { Users, Copy, Check, Share2, Gift, TrendingUp } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useWallet, useReferrals } from '@/hooks/useUserData';
import { useSettings } from '@/hooks/usePublicData';
import { Card, StatCard, SkeletonCard, EmptyState, PageHeader, Badge } from '@/components/ui';
import { formatCurrency, formatDate } from '@/lib/utils';

export default function ReferralPage() {
  const { profile } = useAuth();
  const { data: wallet } = useWallet();
  const { data: referrals, isLoading } = useReferrals();
  const { data: settings } = useSettings();
  const [copied, setCopied] = useState(false);

  const referralLink = `${window.location.origin}/register?ref=${profile?.referral_code || ''}`;
  const s = settings!;

  const copyLink = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareLink = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Join me on Aureus', url: referralLink });
      } catch { /* user cancelled */ }
    } else {
      copyLink();
    }
  };

  return (
    <div>
      <PageHeader title="Referral Program" subtitle="Invite friends and earn rewards" icon={<Users className="w-5 h-5" />} />

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard label="Total Referrals" value={referrals?.length || 0} icon={<Users className="w-5 h-5" />} />
        <StatCard label="Referral Earnings" value={formatCurrency(wallet?.referral_earnings || 0)} icon={<Gift className="w-5 h-5" />} />
        <StatCard label="Commission Rate" value={`${s?.referral_percentage || 5}%`} icon={<TrendingUp className="w-5 h-5" />} />
      </div>

      {/* Referral link card */}
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="mb-6 relative overflow-hidden">
          <div className="absolute -right-10 -top-10 w-40 h-40 rounded-full bg-gold-400/10 blur-2xl" />
          <div className="relative">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-gold-400/10 border border-gold-400/20 flex items-center justify-center text-gold-300">
                <Share2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-white">Your Referral Link</h3>
                <p className="text-xs text-ink-400">Share this link to earn {s?.referral_percentage || 5}% commission on every deposit your referrals make</p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 flex items-center gap-2 px-4 py-3 rounded-xl bg-ink-800/60 border border-white/10 overflow-hidden">
                <span className="text-sm text-ink-300 truncate flex-1">{referralLink}</span>
              </div>
              <button
                onClick={copyLink}
                className="px-5 py-3 rounded-xl gold-gradient text-ink-900 font-semibold text-sm hover:brightness-110 transition-all flex items-center justify-center gap-2 whitespace-nowrap"
              >
                {copied ? <><Check className="w-4 h-4" /> Copied!</> : <><Copy className="w-4 h-4" /> Copy Link</>}
              </button>
              <button
                onClick={shareLink}
                className="px-5 py-3 rounded-xl bg-ink-800 border border-white/10 text-white font-semibold text-sm hover:border-gold-400/30 transition-all flex items-center justify-center gap-2"
              >
                <Share2 className="w-4 h-4" /> Share
              </button>
            </div>
            <div className="mt-4 flex items-center gap-2 text-xs text-ink-400">
              <Gift className="w-4 h-4 text-gold-300" />
              <span>Your referral code: <span className="text-gold-300 font-mono font-semibold">{profile?.referral_code}</span></span>
            </div>
          </div>
        </Card>
      </motion.div>

      {/* Referral list */}
      <Card>
        <h3 className="text-lg font-semibold font-display mb-4">Your Referrals</h3>
        {isLoading ? (
          <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)}</div>
        ) : (referrals || []).length === 0 ? (
          <EmptyState icon={<Users className="w-6 h-6" />} title="No referrals yet" description="Share your referral link with friends to start earning commissions." />
        ) : (
          <div className="space-y-3">
            {(referrals || []).map((ref, i) => (
              <motion.div
                key={ref.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-center justify-between p-3 rounded-xl bg-ink-800/50 border border-white/5"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-gold-400/10 border border-gold-400/20 flex items-center justify-center text-gold-300 text-xs font-bold">
                    {(ref.referred as { username?: string })?.username?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">
                      {(ref.referred as { username?: string })?.username || 'User'}
                    </p>
                    <p className="text-xs text-ink-400">Joined {formatDate(ref.created_at)}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-success-400">+{formatCurrency(ref.bonus_amount)}</p>
                  <Badge variant={ref.status === 'paid' ? 'success' : 'warning'}>
                    {ref.status === 'paid' ? 'Earned' : 'Pending'}
                  </Badge>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

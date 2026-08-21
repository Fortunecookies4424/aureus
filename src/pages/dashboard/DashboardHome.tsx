import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Wallet, TrendingUp, ArrowDownToLine, ArrowUpFromLine, Users,
  Award, ArrowRight, PieChart as PieIcon, CalendarCheck,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useWallet, useMyInvestments, useMyTransactions } from '@/hooks/useUserData';
import { useToast } from '@/context/ToastContext';
import { StatCard, Card, Badge, EmptyState, SkeletonCard, Button } from '@/components/ui';
import { formatCurrency, formatDate, timeAgo, getInitials } from '@/lib/utils';
import type { Transaction } from '@/types/database';

const txnTypeConfig: Record<string, { color: string; label: string }> = {
  deposit: { color: 'text-success-400', label: 'Deposit' },
  withdrawal: { color: 'text-warning-400', label: 'Withdrawal' },
  investment: { color: 'text-blue-400', label: 'Investment' },
  profit: { color: 'text-gold-300', label: 'Profit' },
  referral: { color: 'text-purple-400', label: 'Referral' },
  bonus: { color: 'text-gold-300', label: 'Bonus' },
};

export default function DashboardHome() {
  const { profile } = useAuth();
  const { data: wallet, isLoading: walletLoading } = useWallet();
  const { data: investments } = useMyInvestments();
  const { data: transactions } = useMyTransactions();

  const activeInvestments = (investments || []).filter((i) => i.status === 'active');
  const completedInvestments = (investments || []).filter((i) => i.status === 'completed');
  const totalProfit = completedInvestments.reduce((sum, i) => sum + i.expected_profit, 0);

  // Chart data: last 7 days transaction volume
  const chartData = buildChartData(transactions || []);

  // Portfolio allocation
  const portfolioData = buildPortfolioData(investments || []);

  return (
    <div>
      {/* ===== Balance hero ===== */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative rounded-3xl overflow-hidden mb-6"
      >
        {/* Background layers */}
        <div className="absolute inset-0 bg-gradient-to-br from-ink-800 via-ink-900 to-ink-950" />
        <div className="absolute inset-0 bg-grid opacity-20" />
        <div className="absolute -right-20 -top-20 w-64 h-64 rounded-full bg-gold-400/8 blur-3xl" />
        <div className="absolute -left-10 bottom-0 w-40 h-40 rounded-full bg-gold-400/5 blur-2xl" />

        <div className="relative p-6 md:p-8">
          {/* Top row: greeting + avatar */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <p className="text-sm text-ink-400">Welcome back,</p>
              <p className="text-lg font-semibold font-display text-white">
                {profile?.full_name?.split(' ')[0] || profile?.username}
              </p>
            </div>
            <Link to="/dashboard/profile">
              <div className="w-11 h-11 rounded-full gold-gradient flex items-center justify-center text-ink-900 font-bold text-sm hover:scale-105 transition-transform">
                {profile ? getInitials(profile.full_name || profile.username) : '?'}
              </div>
            </Link>
          </div>

          {/* Balance display */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg bg-gold-400/15 border border-gold-400/20 flex items-center justify-center">
                <Wallet className="w-4 h-4 text-gold-300" />
              </div>
              <p className="text-xs font-medium text-gold-200/80 uppercase tracking-wider">Total Balance</p>
            </div>
            {walletLoading ? (
              <div className="h-12 w-48 animate-shimmer rounded-xl" />
            ) : (
              <motion.h1
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-4xl md:text-5xl font-bold font-display text-white tracking-tight"
              >
                <span className="gold-gradient-text">{formatCurrency(wallet?.balance || 0)}</span>
              </motion.h1>
            )}
            <p className="text-xs text-ink-400 mt-2">
              {profile?.referral_code && (
                <>Referral code: <span className="text-gold-300 font-mono font-semibold">{profile.referral_code}</span></>
              )}
            </p>
          </div>

          {/* Quick actions */}
          <div className="grid grid-cols-4 gap-2 md:gap-3">
            <QuickAction to="/dashboard/deposit" icon={<ArrowDownToLine className="w-5 h-5" />} label="Deposit" />
            <QuickAction to="/dashboard/withdraw" icon={<ArrowUpFromLine className="w-5 h-5" />} label="Withdraw" />
            <QuickAction to="/dashboard/invest" icon={<TrendingUp className="w-5 h-5" />} label="Invest" />
            <QuickAction to="/dashboard/referral" icon={<Users className="w-5 h-5" />} label="Refer" />
          </div>
        </div>
      </motion.div>

      {/* Promotional banner */}
      <PromoBanner />

      {/* Daily Check-in + Bonus Wallet Info */}
      <DailyCheckinCard />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
        {walletLoading ? (
          Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
        ) : (
          <>
            <MiniStat label="Active Investments" value={activeInvestments.length.toString()} icon={<TrendingUp className="w-4 h-4" />} />
            <MiniStat label="Total Profit" value={formatCurrency(totalProfit || wallet?.total_profit || 0)} icon={<Award className="w-4 h-4" />} />
            <MiniStat label="Referral Earnings" value={formatCurrency(wallet?.referral_earnings || 0)} icon={<Users className="w-4 h-4" />} />
            <MiniStat label="Total Deposits" value={formatCurrency(wallet?.total_deposits || 0)} icon={<ArrowDownToLine className="w-4 h-4" />} />
          </>
        )}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Earnings chart */}
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold font-display">Earnings Overview</h3>
              <p className="text-xs text-ink-400 mt-0.5">Last 7 days transaction activity</p>
            </div>
            <Badge variant="gold">7D</Badge>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorGold" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#d4af37" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#d4af37" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="day" stroke="#6e6e6e" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="#6e6e6e" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v: number | string) => `₦${Number(v) >= 1000 ? `${(Number(v) / 1000).toFixed(0)}K` : v}`} />
              <Tooltip
                contentStyle={{ background: '#161616', border: '1px solid rgba(212,175,55,0.2)', borderRadius: '12px', fontSize: '12px' }}
                labelStyle={{ color: '#9a9a9a' }}
                formatter={(v) => [formatCurrency(Number(v)), 'Volume']}
              />
              <Area type="monotone" dataKey="volume" stroke="#d4af37" strokeWidth={2} fill="url(#colorGold)" />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        {/* Portfolio allocation */}
        <Card>
          <h3 className="text-lg font-semibold font-display mb-1">Portfolio</h3>
          <p className="text-xs text-ink-400 mb-4">Active investment distribution</p>
          {portfolioData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={portfolioData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3}>
                  {portfolioData.map((_, i) => (
                    <Cell key={i} fill={['#d4af37', '#e6c558', '#b8941f', '#8a6c1a', '#6b531a'][i % 5]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: '#161616', border: '1px solid rgba(212,175,55,0.2)', borderRadius: '12px', fontSize: '12px' }}
                  formatter={(v) => formatCurrency(Number(v))}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[200px]">
              <p className="text-sm text-ink-400">No active investments</p>
            </div>
          )}
          {portfolioData.length > 0 && (
            <div className="mt-4 space-y-2">
              {portfolioData.map((p, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: ['#d4af37', '#e6c558', '#b8941f', '#8a6c1a', '#6b531a'][i % 5] }} />
                    <span className="text-ink-300">{p.name}</span>
                  </div>
                  <span className="text-white font-medium">{formatCurrency(p.value)}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Recent transactions + Active investments */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent transactions */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold font-display">Recent Transactions</h3>
            <Link to="/dashboard/notifications" className="text-xs text-gold-300 hover:text-gold-200 flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {(transactions || []).length === 0 ? (
            <EmptyState title="No transactions yet" description="Your transaction history will appear here once you start investing." />
          ) : (
            <div className="space-y-3">
              {(transactions || []).slice(0, 5).map((txn) => (
                <TransactionRow key={txn.id} txn={txn} />
              ))}
            </div>
          )}
        </Card>

        {/* Active investments */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold font-display">Active Investments</h3>
            <Link to="/dashboard/investments" className="text-xs text-gold-300 hover:text-gold-200 flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {activeInvestments.length === 0 ? (
            <EmptyState
              icon={<TrendingUp className="w-6 h-6" />}
              title="No active investments"
              description="Browse our investment plans and start growing your wealth today."
              action={<Link to="/dashboard/invest"><button className="px-5 py-2.5 rounded-xl gold-gradient text-ink-900 font-semibold text-sm hover:brightness-110 transition-all">Browse Plans</button></Link>}
            />
          ) : (
            <div className="space-y-3">
              {activeInvestments.slice(0, 4).map((inv) => {
                const progress = getInvestmentProgress(inv.start_date, inv.maturity_date);
                return (
                  <div key={inv.id} className="p-3 rounded-xl bg-ink-800/50 border border-white/5">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-white">{inv.package_name}</span>
                      <span className="text-xs text-gold-300">{formatCurrency(inv.amount)}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-ink-700 overflow-hidden">
                      <div className="h-full gold-gradient rounded-full transition-all" style={{ width: `${progress}%` }} />
                    </div>
                    <div className="flex items-center justify-between mt-2 text-xs text-ink-400">
                      <span>{progress}% complete</span>
                      <span>Matures {formatDate(inv.maturity_date)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      {/* CTA */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="mt-8 card-elevated rounded-2xl p-6 md:p-8 relative overflow-hidden"
      >
        <div className="absolute -right-10 -top-10 w-40 h-40 rounded-full bg-gold-400/10 blur-2xl" />
        <div className="relative flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <h3 className="text-xl font-bold font-display">Ready to grow your wealth?</h3>
            <p className="text-sm text-ink-300 mt-1">Explore our investment plans and start earning today.</p>
          </div>
          <Link to="/dashboard/invest">
            <button className="px-6 py-3 rounded-xl gold-gradient text-ink-900 font-semibold hover:shadow-gold-lg hover:brightness-110 transition-all flex items-center gap-2 whitespace-nowrap">
              Invest Now <ArrowRight className="w-4 h-4" />
            </button>
          </Link>
        </div>
      </motion.div>
    </div>
  );
}

function TransactionRow({ txn }: { txn: Transaction }) {
  const config = txnTypeConfig[txn.type] || { color: 'text-ink-300', label: txn.type };
  const isPositive = ['deposit', 'profit', 'referral', 'bonus'].includes(txn.type);
  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex items-center gap-3">
        <div className={`w-9 h-9 rounded-lg bg-ink-800 border border-white/5 flex items-center justify-center ${config.color}`}>
          {isPositive ? <ArrowDownToLine className="w-4 h-4" /> : <ArrowUpFromLine className="w-4 h-4" />}
        </div>
        <div>
          <p className="text-sm font-medium text-white">{config.label}</p>
          <p className="text-xs text-ink-400">{txn.description || timeAgo(txn.created_at)}</p>
        </div>
      </div>
      <div className="text-right">
        <p className={`text-sm font-semibold ${isPositive ? 'text-success-400' : 'text-white'}`}>
          {isPositive ? '+' : '-'}{formatCurrency(txn.amount)}
        </p>
        <p className="text-xs text-ink-500">{formatDate(txn.created_at)}</p>
      </div>
    </div>
  );
}

function PromoBanner() {
  const { data: banner } = useQuery({
    queryKey: ['active-promo-banner'],
    queryFn: async () => {
      const { data } = await supabase
        .from('promotional_banners')
        .select('*')
        .eq('enabled', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    staleTime: 30_000,
  });

  if (!banner || !banner.image_url) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-6"
    >
      <div
        className="relative rounded-2xl overflow-hidden cursor-pointer group"
        onClick={() => { if (banner.link_url) window.open(banner.link_url, '_blank', 'noopener,noreferrer'); }}
      >
        <div className="w-full aspect-[16/5] sm:aspect-[16/4] lg:aspect-[16/3] overflow-hidden">
          <img
            src={banner.image_url}
            alt={banner.title || 'Promotional banner'}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        </div>
        {(banner.title || banner.description) && (
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none">
            <div className="absolute bottom-0 left-0 right-0 p-4">
              {banner.title && <p className="text-white font-semibold text-sm sm:text-base">{banner.title}</p>}
              {banner.description && <p className="text-ink-200 text-xs mt-0.5 line-clamp-1">{banner.description}</p>}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}

function DailyCheckinCard() {
  const { data: rewardsConfig } = useQuery({
    queryKey: ['rewards-config'],
    queryFn: async () => {
      const { data } = await supabase.from('rewards_config').select('*').limit(1).maybeSingle();
      return data;
    },
  });
  const { data: wallet } = useWallet();
  const { data: myInvestments } = useMyInvestments();
  const toast = useToast();
  const qc = useQueryClient();

  const { data: todayCheckin } = useQuery({
    queryKey: ['today-checkin'],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) return null;
      const { data } = await supabase.from('daily_checkins').select('*')
        .eq('user_id', userId)
        .eq('checkin_date', new Date().toISOString().split('T')[0]).maybeSingle();
      return data;
    },
  });

  const claim = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('claim_daily_checkin');
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['wallet'] });
      qc.invalidateQueries({ queryKey: ['today-checkin'] });
      toast.success('Check-in successful!', `You earned ₦${data.amount}. Streak: ${data.streak} days.`);
    },
    onError: (err) => {
      const msg = err instanceof Error ? err.message : 'Failed to claim';
      toast.error('Check-in failed', msg);
    },
  });

  if (!rewardsConfig?.daily_checkin_enabled) return null;

  const hasActiveInvestment = (myInvestments || []).some((i) => i.status === 'active');
  const bonusBalance = wallet?.bonus_balance || 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="card-elevated rounded-2xl p-5 mb-6"
    >
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-gold-400/10 border border-gold-400/20 flex items-center justify-center text-gold-300 flex-shrink-0">
          <CalendarCheck className="w-6 h-6" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-white">Daily Check-in Reward</h3>
          <p className="text-xs text-ink-400">
            Earn {formatCurrency(rewardsConfig.daily_checkin_amount)} every day you check in. Bonus balance: {formatCurrency(bonusBalance)}
          </p>
          {!hasActiveInvestment && (
            <p className="text-xs text-warning-400 mt-1">
              Bonus rewards require an active investment before they can be withdrawn.
            </p>
          )}
        </div>
        <Button
          size="sm"
          onClick={() => claim.mutate()}
          loading={claim.isPending}
          disabled={!!todayCheckin}
        >
          <CalendarCheck className="w-4 h-4" />
          {todayCheckin ? 'Checked In' : 'Check In'}
        </Button>
      </div>
    </motion.div>
  );
}

function QuickAction({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  return (
    <Link to={to}>
      <motion.div
        whileTap={{ scale: 0.95 }}
        className="flex flex-col items-center gap-2 p-3 rounded-2xl bg-ink-800/60 border border-white/8 hover:border-gold-400/30 hover:bg-gold-400/5 transition-all group"
      >
        <div className="w-10 h-10 rounded-xl bg-gold-400/10 border border-gold-400/20 flex items-center justify-center text-gold-300 group-hover:scale-110 transition-transform">
          {icon}
        </div>
        <span className="text-xs font-medium text-ink-200 group-hover:text-white transition-colors">{label}</span>
      </motion.div>
    </Link>
  );
}

function MiniStat({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="card-elevated rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-7 h-7 rounded-lg bg-gold-400/10 border border-gold-400/15 flex items-center justify-center text-gold-300">
          {icon}
        </div>
        <p className="text-[11px] font-medium text-ink-400 uppercase tracking-wider">{label}</p>
      </div>
      <p className="text-lg font-bold text-white font-display truncate">{value}</p>
    </div>
  );
}

function getInvestmentProgress(start: string, maturity: string): number {
  const startMs = new Date(start).getTime();
  const maturityMs = new Date(maturity).getTime();
  const now = Date.now();
  if (now >= maturityMs) return 100;
  if (now <= startMs) return 0;
  return Math.round(((now - startMs) / (maturityMs - startMs)) * 100);
}

function buildChartData(transactions: Transaction[]) {
  const days: { day: string; volume: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toLocaleDateString('en', { weekday: 'short' });
    days.push({ day: key, volume: 0 });
  }
  transactions.forEach((txn) => {
    const txnDate = new Date(txn.created_at);
    const dayKey = txnDate.toLocaleDateString('en', { weekday: 'short' });
    const day = days.find((d) => d.day === dayKey);
    if (day && (txn.type === 'deposit' || txn.type === 'profit' || txn.type === 'referral')) {
      day.volume += txn.amount;
    }
  });
  return days;
}

function buildPortfolioData(investments: { package_name: string; amount: number; status: string }[]) {
  const active = investments.filter((i) => i.status === 'active');
  const grouped: Record<string, number> = {};
  active.forEach((i) => {
    grouped[i.package_name] = (grouped[i.package_name] || 0) + i.amount;
  });
  return Object.entries(grouped).map(([name, value]) => ({ name, value }));
}

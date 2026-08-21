import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Users, ArrowDownToLine, ArrowUpFromLine, TrendingUp, Package,
  Clock, Award,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { supabase } from '@/lib/supabase';
import { StatCard, Card, PageHeader, Badge, SkeletonCard } from '@/components/ui';
import { formatCurrency, formatCompactCurrency } from '@/lib/utils';

interface AdminStats {
  totalUsers: number;
  totalDeposits: number;
  totalWithdrawals: number;
  totalInvestments: number;
  totalProfitPaid: number;
  pendingDeposits: number;
  pendingWithdrawals: number;
  activePackages: number;
  recentSignups: { day: string; count: number }[];
  depositTrend: { day: string; amount: number }[];
}

export default function AdminDashboard() {
  const { data: stats, isLoading } = useQuery<AdminStats>({
    queryKey: ['admin-stats'],
    queryFn: async () => {
      const [users, deposits, withdrawals, investments, packages] = await Promise.all([
        supabase.from('profiles').select('id, created_at', { count: 'exact' }),
        supabase.from('deposits').select('amount, status, created_at'),
        supabase.from('withdrawals').select('amount, status, created_at'),
        supabase.from('investments').select('amount, expected_profit, status'),
        supabase.from('investment_packages').select('id, status', { count: 'exact' }),
      ]);

      const totalDeposits = (deposits.data || []).filter((d) => d.status === 'approved').reduce((s, d) => s + Number(d.amount), 0);
      const pendingDeposits = (deposits.data || []).filter((d) => d.status === 'pending').length;
      const totalWithdrawals = (withdrawals.data || []).filter((w) => w.status === 'paid').reduce((s, w) => s + Number(w.amount), 0);
      const pendingWithdrawals = (withdrawals.data || []).filter((w) => w.status === 'pending').length;
      const totalInvestments = (investments.data || []).reduce((s, i) => s + Number(i.amount), 0);
      const totalProfitPaid = (investments.data || []).filter((i) => i.status === 'completed').reduce((s, i) => s + Number(i.expected_profit), 0);
      const activePackages = (packages.data || []).filter((p) => p.status === 'active').length;

      // Build last 7 days signup chart
      const signups: { day: string; count: number }[] = [];
      const depTrend: { day: string; amount: number }[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const key = d.toLocaleDateString('en', { weekday: 'short' });
        signups.push({ day: key, count: 0 });
        depTrend.push({ day: key, amount: 0 });
      }
      (users.data || []).forEach((u) => {
        const dayKey = new Date(u.created_at).toLocaleDateString('en', { weekday: 'short' });
        const day = signups.find((d) => d.day === dayKey);
        if (day) day.count++;
      });
      (deposits.data || []).forEach((d) => {
        if (d.status !== 'approved') return;
        const dayKey = new Date(d.created_at).toLocaleDateString('en', { weekday: 'short' });
        const day = depTrend.find((dd) => dd.day === dayKey);
        if (day) day.amount += Number(d.amount);
      });

      return {
        totalUsers: users.count || 0,
        totalDeposits,
        totalWithdrawals,
        totalInvestments,
        totalProfitPaid,
        pendingDeposits,
        pendingWithdrawals,
        activePackages,
        recentSignups: signups,
        depositTrend: depTrend,
      };
    },
  });

  if (isLoading) {
    return (
      <div>
        <PageHeader title="Admin Dashboard" subtitle="Platform overview" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      </div>
    );
  }

  const s = stats!;

  return (
    <div>
      <PageHeader title="Admin Dashboard" subtitle="Platform overview and key metrics" />

      {/* Main stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Users" value={s.totalUsers} icon={<Users className="w-5 h-5" />} />
        <StatCard label="Total Deposits" value={formatCompactCurrency(s.totalDeposits)} icon={<ArrowDownToLine className="w-5 h-5" />} />
        <StatCard label="Total Withdrawals" value={formatCompactCurrency(s.totalWithdrawals)} icon={<ArrowUpFromLine className="w-5 h-5" />} />
        <StatCard label="Total Investments" value={formatCompactCurrency(s.totalInvestments)} icon={<TrendingUp className="w-5 h-5" />} />
      </div>

      {/* Secondary stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Profit Paid" value={formatCompactCurrency(s.totalProfitPaid)} icon={<Award className="w-5 h-5" />} />
        <StatCard label="Pending Deposits" value={s.pendingDeposits} icon={<Clock className="w-5 h-5" />} trend={s.pendingDeposits > 0 ? 'Needs attention' : undefined} trendUp={false} />
        <StatCard label="Pending Withdrawals" value={s.pendingWithdrawals} icon={<Clock className="w-5 h-5" />} trend={s.pendingWithdrawals > 0 ? 'Needs attention' : undefined} trendUp={false} />
        <StatCard label="Active Packages" value={s.activePackages} icon={<Package className="w-5 h-5" />} />
      </div>

      {/* Pending actions */}
      {(s.pendingDeposits > 0 || s.pendingWithdrawals > 0) && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="card-elevated rounded-2xl p-5 mb-6 border-gold-400/20"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gold-400/10 border border-gold-400/20 flex items-center justify-center text-gold-300">
              <Clock className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-white">Pending Actions</p>
              <p className="text-xs text-ink-400">
                {s.pendingDeposits > 0 && `${s.pendingDeposits} deposit(s) `}
                {s.pendingDeposits > 0 && s.pendingWithdrawals > 0 && 'and '}
                {s.pendingWithdrawals > 0 && `${s.pendingWithdrawals} withdrawal(s) `}
                awaiting review
              </p>
            </div>
            <div className="flex gap-2">
              {s.pendingDeposits > 0 && <Badge variant="warning">{s.pendingDeposits} Deposits</Badge>}
              {s.pendingWithdrawals > 0 && <Badge variant="warning">{s.pendingWithdrawals} Withdrawals</Badge>}
            </div>
          </div>
        </motion.div>
      )}

      {/* Projected Next-Day Payout */}
      <ProjectedPayoutCard />

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <h3 className="text-lg font-semibold font-display mb-1">New Signups</h3>
          <p className="text-xs text-ink-400 mb-4">Last 7 days</p>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={s.recentSignups}>
              <XAxis dataKey="day" stroke="#6e6e6e" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="#6e6e6e" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip contentStyle={{ background: '#161616', border: '1px solid rgba(212,175,55,0.2)', borderRadius: '12px', fontSize: '12px' }} />
              <Bar dataKey="count" fill="#d4af37" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card>
          <h3 className="text-lg font-semibold font-display mb-1">Deposit Volume</h3>
          <p className="text-xs text-ink-400 mb-4">Last 7 days approved deposits</p>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={s.depositTrend}>
              <defs>
                <linearGradient id="colorGold2" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#d4af37" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#d4af37" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="day" stroke="#6e6e6e" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="#6e6e6e" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `₦${v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v}`} />
              <Tooltip contentStyle={{ background: '#161616', border: '1px solid rgba(212,175,55,0.2)', borderRadius: '12px', fontSize: '12px' }} formatter={(v) => formatCurrency(Number(v))} />
              <Area type="monotone" dataKey="amount" stroke="#d4af37" strokeWidth={2} fill="url(#colorGold2)" />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </div>
  );
}

function ProjectedPayoutCard() {
  const { data: payout, isLoading } = useQuery<{ total_payout: number; user_count: number; breakdown: { package_name: string; amount: number; count: number }[]; target_date: string }>({
    queryKey: ['projected-payout'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('calculate_next_day_payout');
      if (error) throw error;
      return data as { total_payout: number; user_count: number; breakdown: { package_name: string; amount: number; count: number }[]; target_date: string };
    },
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="card-elevated rounded-2xl p-6 mb-6 relative overflow-hidden"
    >
      <div className="absolute -right-10 -top-10 w-40 h-40 rounded-full bg-gold-400/8 blur-2xl" />
      <div className="relative">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-gold-400/10 border border-gold-400/20 flex items-center justify-center text-gold-300">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-white">Projected Next-Day Payout</h3>
            <p className="text-xs text-ink-400">
              {payout ? `Estimate for ${new Date(payout.target_date).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}` : 'Loading...'}
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="h-20 animate-shimmer rounded-xl" />
        ) : payout && payout.total_payout > 0 ? (
          <>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <p className="text-xs text-ink-400 uppercase tracking-wider">Estimated Total Payout</p>
                <p className="text-3xl font-bold gold-gradient-text mt-1">{formatCurrency(payout.total_payout)}</p>
              </div>
              <div>
                <p className="text-xs text-ink-400 uppercase tracking-wider">Users to Receive</p>
                <p className="text-3xl font-bold text-white mt-1">{payout.user_count}</p>
              </div>
            </div>
            {payout.breakdown && payout.breakdown.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-ink-400 font-medium">Breakdown by Package</p>
                {payout.breakdown.map((b, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <span className="text-ink-300">{b.package_name} <span className="text-ink-500">({b.count} investment{b.count !== 1 ? 's' : ''})</span></span>
                    <span className="text-white font-medium">{formatCurrency(b.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="flex items-center gap-3 py-4">
            <Clock className="w-5 h-5 text-ink-400" />
            <p className="text-sm text-ink-400">No payouts projected for tomorrow. No investments are maturing.</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}

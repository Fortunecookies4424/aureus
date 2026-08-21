import { motion } from 'framer-motion';
import { Wallet, TrendingUp, CheckCircle2, Clock, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useMyInvestments } from '@/hooks/useUserData';
import { Card, Badge, SkeletonCard, EmptyState, PageHeader, StatCard } from '@/components/ui';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { Investment } from '@/types/database';

export default function MyInvestmentsPage() {
  const { data: investments, isLoading } = useMyInvestments();

  const active = (investments || []).filter((i) => i.status === 'active');
  const completed = (investments || []).filter((i) => i.status === 'completed');
  const totalActive = active.reduce((s, i) => s + i.amount, 0);
  const totalProfit = completed.reduce((s, i) => s + i.expected_profit, 0);
  const totalInvested = (investments || []).reduce((s, i) => s + i.amount, 0);

  return (
    <div>
      <PageHeader title="My Investments" subtitle="Track your investment portfolio and earnings" icon={<Wallet className="w-5 h-5" />} />

      {/* Summary stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Invested" value={formatCurrency(totalInvested)} icon={<Wallet className="w-5 h-5" />} />
        <StatCard label="Active" value={active.length} icon={<TrendingUp className="w-5 h-5" />} />
        <StatCard label="Completed" value={completed.length} icon={<CheckCircle2 className="w-5 h-5" />} />
        <StatCard label="Total Profit" value={formatCurrency(totalProfit)} icon={<Clock className="w-5 h-5" />} />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : (investments || []).length === 0 ? (
        <Card>
          <EmptyState
            icon={<TrendingUp className="w-6 h-6" />}
            title="No investments yet"
            description="Browse our investment plans and start growing your wealth today."
            action={<Link to="/dashboard/invest"><Button size="sm">Browse Plans <ArrowRight className="w-4 h-4" /></Button></Link>}
          />
        </Card>
      ) : (
        <div className="space-y-8">
          {/* Active investments */}
          {active.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold font-display mb-4">Active Investments</h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {active.map((inv, i) => (
                  <motion.div key={inv.id} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                    <InvestmentCard inv={inv} />
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* Completed investments */}
          {completed.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold font-display mb-4">Completed Investments</h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {completed.map((inv, i) => (
                  <motion.div key={inv.id} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                    <InvestmentCard inv={inv} />
                  </motion.div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function InvestmentCard({ inv }: { inv: Investment }) {
  const progress = getProgress(inv.start_date, inv.maturity_date);
  const isActive = inv.status === 'active';
  const daysLeft = Math.max(0, Math.ceil((new Date(inv.maturity_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));

  return (
    <Card className="h-full">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="font-semibold text-white">{inv.package_name}</h3>
          <p className="text-xs text-ink-400 mt-0.5">Started {formatDate(inv.start_date)}</p>
        </div>
        <Badge variant={isActive ? 'gold' : 'success'}>
          {isActive ? 'Active' : 'Completed'}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="p-3 rounded-lg bg-ink-800/50">
          <p className="text-xs text-ink-400">Invested</p>
          <p className="text-sm font-semibold text-white mt-0.5">{formatCurrency(inv.amount)}</p>
        </div>
        <div className="p-3 rounded-lg bg-ink-800/50">
          <p className="text-xs text-ink-400">Daily Payout</p>
          <p className="text-sm font-semibold text-white mt-0.5">{formatCurrency((inv.amount * inv.roi / 100) / inv.duration_days)}</p>
        </div>
        <div className="p-3 rounded-lg bg-ink-800/50">
          <p className="text-xs text-ink-400">Duration</p>
          <p className="text-sm font-semibold text-white mt-0.5">{inv.duration_days} Days</p>
        </div>
        <div className="p-3 rounded-lg bg-ink-800/50">
          <p className="text-xs text-ink-400">ROI</p>
          <p className="text-sm font-semibold text-white mt-0.5">{inv.roi}%</p>
        </div>
        <div className="col-span-2 p-3 rounded-lg bg-gold-400/5 border border-gold-400/10">
          <p className="text-xs text-gold-200">Expected Total Returns (Daily Payout × 30 Days)</p>
          <p className="text-lg font-bold text-gold-300 mt-0.5">{formatCurrency(((inv.amount * inv.roi / 100) / inv.duration_days) * 30)}</p>
        </div>
      </div>

      {isActive && (
        <>
          <div className="mb-2">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-ink-400">Progress</span>
              <span className="text-gold-300 font-medium">{progress}%</span>
            </div>
            <div className="h-2 rounded-full bg-ink-700 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                className="h-full gold-gradient rounded-full"
              />
            </div>
          </div>
          <div className="flex items-center justify-between text-xs text-ink-400 mt-3">
            <span>{daysLeft} days remaining</span>
            <span>Matures {formatDate(inv.maturity_date)}</span>
          </div>
        </>
      )}

      {!isActive && (
        <div className="flex items-center gap-2 text-xs text-success-400 mt-2">
          <CheckCircle2 className="w-4 h-4" />
          <span>Completed on {formatDate(inv.maturity_date)}</span>
        </div>
      )}
    </Card>
  );
}

function getProgress(start: string, maturity: string): number {
  const startMs = new Date(start).getTime();
  const maturityMs = new Date(maturity).getTime();
  const now = Date.now();
  if (now >= maturityMs) return 100;
  if (now <= startMs) return 0;
  return Math.round(((now - startMs) / (maturityMs - startMs)) * 100);
}

// Button import for the empty state action
import { Button } from '@/components/ui';

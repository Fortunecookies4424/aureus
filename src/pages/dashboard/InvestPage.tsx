import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Wallet, TrendingUp, Clock, ArrowRight, Check, Zap, Award, Sparkles, Coins,
} from 'lucide-react';
import { useWallet, useInvestmentPackages, useStartInvestment } from '@/hooks/useUserData';
import { useToast } from '@/context/ToastContext';
import { Card, Button, Modal, Badge, SkeletonCard, EmptyState, PageHeader } from '@/components/ui';
import { formatCurrency } from '@/lib/utils';
import { PLACEHOLDER_IMAGE } from '@/lib/upload';
import type { InvestmentPackage } from '@/types/database';

const packageIcons: Record<string, React.ReactNode> = {
  sprout: <Zap className="w-6 h-6" />,
  coins: <Coins className="w-6 h-6" />,
  crown: <Award className="w-6 h-6" />,
  diamond: <Sparkles className="w-6 h-6" />,
};

export default function InvestPage() {
  const { data: packages, isLoading } = useInvestmentPackages(true);
  const { data: wallet } = useWallet();
  const startInvestment = useStartInvestment();
  const toast = useToast();
  const [selectedPkg, setSelectedPkg] = useState<InvestmentPackage | null>(null);

  const activePackages = (packages || []).filter((p) => p.status === 'active');

  const handleInvest = async () => {
    if (!selectedPkg) return;
    if (selectedPkg.price > (wallet?.balance || 0)) {
      toast.error('Insufficient balance', 'Please deposit funds into your wallet first.');
      return;
    }

    try {
      await startInvestment.mutateAsync({ packageId: selectedPkg.id, amount: selectedPkg.price });
      toast.success('Investment started!', `Your investment in ${selectedPkg.name} is now active.`);
      setSelectedPkg(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to start investment';
      toast.error('Investment failed', msg);
    }
  };

  const expectedProfit = selectedPkg
    ? (selectedPkg.price * selectedPkg.roi / 100)
    : 0;

  // Daily payout = price * roi / 100 / duration_days
  const dailyPayout = selectedPkg
    ? (selectedPkg.price * selectedPkg.roi / 100) / selectedPkg.duration_days
    : 0;

  // Expected Total Returns = Daily Payout × 30 Days
  const expectedTotalReturns = dailyPayout * 30;

  return (
    <div>
      <PageHeader
        title="Invest"
        subtitle="Browse our investment plans and start growing your wealth"
        icon={<TrendingUp className="w-5 h-5" />}
      />

      {/* Wallet balance banner */}
      <div className="card-elevated rounded-2xl p-5 mb-6 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gold-400/10 border border-gold-400/20 flex items-center justify-center text-gold-300">
            <Wallet className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-ink-400 uppercase tracking-wider">Available Balance</p>
            <p className="text-xl font-bold text-white font-display">{formatCurrency(wallet?.balance || 0)}</p>
          </div>
        </div>
        <a href="/dashboard/deposit">
          <Button variant="outline" size="sm">Add Funds <ArrowRight className="w-4 h-4" /></Button>
        </a>
      </div>

      {/* Packages */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : activePackages.length === 0 ? (
        <Card>
          <EmptyState icon={<TrendingUp className="w-6 h-6" />} title="No plans available" description="There are no active investment plans at the moment. Please check back later." />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {activePackages.map((pkg, i) => (
            <motion.div
              key={pkg.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
            >
              <Card className={`h-full flex flex-col overflow-hidden ${pkg.featured ? 'border-gold-400/30 gold-glow' : ''}`} hover>
                {/* Package image */}
                <div className="relative h-40 -mx-6 -mt-6 mb-4 overflow-hidden bg-ink-800">
                  <img
                    src={pkg.image_url || PLACEHOLDER_IMAGE}
                    alt={pkg.name}
                    className="w-full h-full object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).src = PLACEHOLDER_IMAGE; }}
                  />
                  {pkg.featured && (
                    <div className="absolute top-3 left-3">
                      <Badge variant="gold">POPULAR</Badge>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-ink-900/80 to-transparent" />
                </div>

                <div className="w-12 h-12 rounded-xl bg-gold-400/10 border border-gold-400/20 flex items-center justify-center text-gold-300 mb-4">
                  {packageIcons[pkg.icon || ''] || <Wallet className="w-6 h-6" />}
                </div>
                <h3 className="text-xl font-bold font-display">{pkg.name}</h3>
                <p className="mt-2 text-sm text-ink-300 flex-1 line-clamp-2">{pkg.description}</p>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-3xl font-bold text-gradient-gold font-display">{formatCurrency(pkg.price)}</span>
                  <span className="text-sm text-ink-400">fixed price</span>
                </div>
                <div className="mt-4 space-y-2.5 text-sm border-t border-white/5 pt-4">
                  <Row label="ROI" value={`${pkg.roi}%`} />
                  <Row label="Duration" value={`${pkg.duration_days} days`} />
                  <Row label="Payout" value={<span className="capitalize">{pkg.payout_frequency}</span>} />
                  <Row label="Expected Profit" value={<span className="text-success-400 font-semibold">{formatCurrency(pkg.price * pkg.roi / 100)}</span>} />
                </div>
                <Button
                  fullWidth
                  className="mt-6"
                  variant={pkg.featured ? 'primary' : 'outline'}
                  onClick={() => setSelectedPkg(pkg)}
                >
                  Invest Now <ArrowRight className="w-4 h-4" />
                </Button>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Invest confirmation modal */}
      <Modal open={!!selectedPkg} onClose={() => setSelectedPkg(null)} title="Confirm Investment" size="md">
        {selectedPkg && (
          <div className="space-y-5">
            <div className="card-elevated rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gold-400/10 border border-gold-400/20 flex items-center justify-center text-gold-300">
                  {packageIcons[selectedPkg.icon || ''] || <Wallet className="w-5 h-5" />}
                </div>
                <div>
                  <p className="font-semibold text-white">{selectedPkg.name}</p>
                  <p className="text-xs text-ink-400">{selectedPkg.roi}% ROI · {selectedPkg.duration_days} days</p>
                </div>
              </div>
            </div>

            {/* Fixed price summary */}
            <div className="card-elevated rounded-xl p-4 space-y-3">
              <Row label="Package" value={selectedPkg.name} />
              <Row label="Investment Price" value={<span className="text-gold-300 font-bold text-base">{formatCurrency(selectedPkg.price)}</span>} />
              <Row label="ROI" value={`${selectedPkg.roi}%`} />
              <Row label="Duration" value={`${selectedPkg.duration_days} days`} />
              <Row label="Payout Frequency" value={<span className="capitalize">{selectedPkg.payout_frequency}</span>} />
              <div className="border-t border-white/5 pt-3">
                <Row label="Daily Payout" value={<span className="text-white font-semibold">{formatCurrency(dailyPayout)}</span>} />
                <Row label="Duration" value={`${selectedPkg.duration_days} Days`} />
                <div className="border-t border-white/5 pt-2 mt-2">
                  <Row label="Expected Total Returns" value={<span className="text-gold-300 font-bold text-base">{formatCurrency(expectedTotalReturns)}</span>} />
                </div>
                <Row label="ROI" value={`${selectedPkg.roi}%`} />
              </div>
            </div>

            {selectedPkg.price > (wallet?.balance || 0) && (
              <div className="rounded-xl bg-danger-500/10 border border-danger-500/20 p-3 text-sm text-danger-300">
                Insufficient wallet balance. You need {formatCurrency(selectedPkg.price)} but have {formatCurrency(wallet?.balance || 0)}.
              </div>
            )}

            <div className="flex gap-3">
              <Button variant="secondary" fullWidth onClick={() => setSelectedPkg(null)}>Cancel</Button>
              <Button
                fullWidth
                onClick={handleInvest}
                loading={startInvestment.isPending}
                disabled={startInvestment.isPending || selectedPkg.price > (wallet?.balance || 0)}
              >
                <Check className="w-4 h-4" /> Confirm Investment
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-ink-400">{label}</span>
      <span className="text-sm text-white font-medium">{value}</span>
    </div>
  );
}
